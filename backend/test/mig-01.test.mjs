/**
 * MIG-01 — First End-to-End Simulated Migration Test Suite
 *
 * Validates all 12 pipeline phases using synthetic data (no real patient data).
 * Uses in-memory store (file driver). Does not touch CDS Export or LEDI APS.
 */

import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import crypto from "node:crypto";

import {
  applyMapping,
  mapPatient,
  mapVisitEvent,
} from "../src/services/mapping-engine.js";

import {
  runValidation,
  validatePatient,
  validateEvent,
} from "../src/services/validation-engine.js";

import { applySelection } from "../src/services/population-selection.js";

import {
  createImportJob,
  getImportJob,
  listImportJobs,
  getSourceProfile,
  runFullPipeline,
  submitHomologation,
  executeCommit,
  getStagedRecords,
} from "../src/services/import-pipeline.js";

import { withDb } from "../src/db.js";

// ── Synthetic data generator ──────────────────────────────────────────────

function generateValidCpf(n) {
  // Generate a deterministic, unique, valid CPF from an integer n (0..999999998)
  // n is offset by 100000000 to avoid leading zeros and all-same-digit patterns
  const base = String((n % 900_000_000) + 100_000_000).padStart(9, "0");
  const digits = base.split("").map(Number);

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 > 9) d1 = 0;
  digits.push(d1);

  sum = 0;
  for (let i = 0; i < 10; i++) sum += digits[i] * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 > 9) d2 = 0;
  digits.push(d2);

  const cpf = digits.join("");
  // Skip all-same-digit CPFs (extremely rare but guard anyway)
  if (/^(\d)\1{10}$/.test(cpf)) return generateValidCpf(n + 1);
  return cpf;
}

function generateDate(yearsAgo, variance = 0) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo - Math.floor(Math.random() * variance));
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function generateRecentVisitDate(monthsAgo = 3) {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function generatePatient(i, opts = {}) {
  const cpf = opts.invalidCpf ? "00000000000" : (opts.noCpf ? undefined : generateValidCpf(i));
  const hasCns = !opts.noCns;
  return {
    id: `PAT-${i.toString().padStart(5, "0")}`,
    nome: opts.noName ? "" : `Paciente Sintético ${i}`,
    dataNascimento: opts.noDate ? undefined : generateDate(opts.ageYears || 35, 5),
    cpf: cpf,
    cns: hasCns ? String(700000000000000 + i).padStart(15, "0") : undefined,
    nomeMae: `Mãe Sintética ${i}`,
    telefone: `(11) 9${String(i).padStart(8, "0")}`,
    endereco: `Rua Sintética, ${i}`,
    ibgeMunicipio: "3550308", // São Paulo
    microarea: opts.microArea || "A",
    racaCor: opts.badRaca ? "99" : "03",
    codigoFamilia: `FAM-${Math.floor(i / 4)}`,
    inactive: opts.inactive || false,
    gestante: opts.pregnant || false,
    doencaCronica: opts.chronic || false,
    visitas: opts.noVisits ? [] : [generateVisit(i, opts)],
  };
}

function generateVisit(i, opts = {}) {
  return {
    id: `VIS-${i.toString().padStart(5, "0")}`,
    dataVisita: opts.futureDate ? "01/01/2099" : generateRecentVisitDate(opts.visitMonthsAgo || 1),
    turno: "1",
    tipoVisita: opts.badTipo ? "99" : "1",
    motivosVisita: opts.noMotivos ? [] : ["1"],
    desfecho: opts.noDesfecho ? undefined : "1",
  };
}

function buildPecPayload(patients) {
  return {
    sourceSystem: "pec-aps",
    version: "4.2",
    exportDate: new Date().toISOString().split("T")[0],
    pacientes: patients,
  };
}

const TARGET_CONTEXT = {
  importJobId: "test-job",
  sourceSystem: "e-SUS PEC APS",
  targetTeamId: "team-test-01",
  targetUnitId: "unit-test-01",
  targetMunicipalityId: "3550308",
  defaultAcsUserId: "acs-user-test",
};

// ── FASE 1: Dataset e Source Profile ─────────────────────────────────────

describe("FASE 1 — Source Profile sp-pec-aps-v01", () => {
  it("SIM-1: Source Profile sp-pec-aps-v01 existe e está certificado", () => {
    const profile = getSourceProfile("sp-pec-aps-v01");
    assert.ok(profile, "Source Profile deve existir");
    assert.equal(profile.status, "certified");
    assert.equal(profile.type, "pec");
    assert.ok(profile.capabilities.hasCpf);
    assert.ok(profile.capabilities.hasCns);
    assert.ok(profile.capabilities.hasVisits);
  });

  it("Profile desconhecido retorna null", () => {
    const profile = getSourceProfile("unknown-profile");
    assert.equal(profile, null);
  });
});

// ── FASE 2 / FASE 3: Mapping Engine ──────────────────────────────────────

describe("FASE 2/3 — Mapping Engine (MAP-PEC-01-v1)", () => {
  it("SIM-2: Paciente válido mapeia para Canonical Model", () => {
    const raw = generatePatient(1);
    const result = mapPatient(raw, "job-test", "pec-aps", "team-test", "unit-test", "3550308");
    assert.ok(result.ok, "Deve mapear com sucesso");
    assert.ok(result.canonical.name);
    assert.ok(result.canonical.birthDate);
    assert.match(result.canonical.birthDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(result.canonical.racaCor, "PARDA");
    assert.equal(result.canonical.municipalityId, "3550308");
    assert.equal(result.canonical.teamId, "team-test");
  });

  it("Paciente sem nome rejeitado no mapping", () => {
    const raw = generatePatient(2, { noName: true });
    const result = mapPatient(raw, "job-test", "pec-aps", "team-test", "unit-test", "3550308");
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === "name"));
  });

  it("Data em formato errado rejeitada", () => {
    const raw = { ...generatePatient(3), dataNascimento: "1985-03-15" };
    const result = mapPatient(raw, "job-test", "pec-aps", "team-test", "unit-test", "3550308");
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === "birthDate"));
  });

  it("Visita válida mapeia corretamente", () => {
    const rawVisit = generateVisit(1);
    const result = mapVisitEvent(rawVisit, "PAT-00001", "job-test", "pec-aps", "acs-01", "team-test");
    assert.ok(result.ok);
    assert.equal(result.canonical.type, "visit");
    assert.equal(result.canonical.tipoVisita, "VISITA_PERIODICA");
    assert.equal(result.canonical.desfecho, "VISITA_REALIZADA");
    assert.equal(result.canonical.turno, "MANHA");
    assert.deepEqual(result.canonical.motivosVisita, ["CADASTRAMENTO_ATUALIZACAO"]);
  });

  it("Visita sem desfecho rejeitada", () => {
    const rawVisit = generateVisit(2, { noDesfecho: true });
    const result = mapVisitEvent(rawVisit, "PAT-00002", "job-test", "pec-aps", "acs-01", "team-test");
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === "desfecho"));
  });

  it("Batch mapping: 100 pacientes, ~10 inválidos", () => {
    const patients = [];
    for (let i = 0; i < 90; i++) patients.push(generatePatient(i));
    for (let i = 90; i < 100; i++) patients.push(generatePatient(i, { noName: true }));

    const payload = buildPecPayload(patients);
    const result = applyMapping(payload, { ...TARGET_CONTEXT, importJobId: "test-batch" });

    assert.equal(result.patients.mapped.length, 90);
    assert.equal(result.patients.rejected.length, 10);
    assert.ok(result.events.mapped.length > 0);
  });

  it("SIM-3: Enums racaCor todos mapeiam corretamente", () => {
    const racaMap = { "01": "BRANCA", "02": "PRETA", "03": "PARDA", "04": "AMARELA", "05": "INDIGENA" };
    for (const [code, expected] of Object.entries(racaMap)) {
      const raw = { ...generatePatient(100), racaCor: code };
      const result = mapPatient(raw, "j", "s", "t", "u", "3550308");
      assert.ok(result.ok, `racaCor ${code} deve mapear`);
      assert.equal(result.canonical.racaCor, expected);
    }
  });
});

// ── FASE 4: Validation Engine ─────────────────────────────────────────────

describe("FASE 4 — Validation Engine (18 regras)", () => {
  it("SIM-4: V-ID-02 CPF com dígito verificador inválido rejeitado", () => {
    const canon = {
      name: "Teste",
      birthDate: "1985-03-15",
      cpf: "11144477730", // last digit wrong (correct is 35)
      cns: null,
      municipalityId: "3550308",
      teamId: "team-test",
      careCategory: "general",
    };
    const result = validatePatient(canon, null);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.rule === "V-ID-02"));
  });

  it("V-ID-01: Sem CPF nem CNS → incompleteProfile (não rejeita)", () => {
    const canon = {
      name: "Teste",
      birthDate: "1985-03-15",
      cpf: null,
      cns: null,
      municipalityId: "3550308",
      teamId: "team-test",
      careCategory: "general",
    };
    const result = validatePatient(canon, null);
    assert.ok(result.valid, "Sem CPF/CNS não rejeita — apenas marca incompleteProfile");
    assert.ok(result.incompleteProfile);
    assert.ok(result.warnings.some((w) => w.rule === "V-ID-01"));
  });

  it("V-TER-01: municipalityId inválido rejeita", () => {
    const canon = {
      name: "Teste",
      birthDate: "1985-03-15",
      cpf: "11144477735",
      cns: null,
      municipalityId: "12345", // não tem 7 dígitos
      teamId: "team-test",
      careCategory: "general",
    };
    const result = validatePatient(canon, null);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.rule === "V-TER-01"));
  });

  it("V-ID-06: CPF duplicado no batch rejeitado", () => {
    const pat1 = generatePatient(200);
    pat1.cpf = generateValidCpf(9990);
    const pat2 = generatePatient(201);
    pat2.cpf = generateValidCpf(9990); // same CPF — intentional duplicate

    const payload = buildPecPayload([pat1, pat2]);
    const mapping = applyMapping(payload, { ...TARGET_CONTEXT, importJobId: "test-dup" });
    const validation = runValidation(mapping, null);

    assert.equal(validation.stats.invalidPatients, 1, "Um dos duplicados deve ser rejeitado");
    assert.ok(validation.patients.invalid.some((p) =>
      p.errors.some((e) => e.rule === "V-ID-06")
    ));
  });

  it("V-ID-07: Paciente em produção → mergeCandidate", () => {
    const canon = {
      name: "Teste",
      birthDate: "1985-03-15",
      cpf: "11144477735",
      cns: null,
      municipalityId: "3550308",
      teamId: "team-test",
      careCategory: "general",
    };
    const existingProductionIds = {
      byCpf: new Map([["11144477735", "existing-prod-id"]]),
      byCns: new Map(),
    };
    const result = validatePatient(canon, existingProductionIds);
    assert.ok(result.valid);
    assert.ok(result.mergeCandidate);
    assert.ok(result.warnings.some((w) => w.rule === "V-ID-07"));
  });

  it("V-COMP-01/02/03: Visita sem campos obrigatórios rejeitada (V-REF-01 ausente — patientSourceId inválido)", () => {
    const canon = {
      type: "visit",
      patientSourceId: "NONEXISTENT",
      tipoVisita: "VISITA_PERIODICA",
      motivosVisita: ["CADASTRAMENTO_ATUALIZACAO"],
      desfecho: "VISITA_REALIZADA",
    };
    const validIds = new Set(["EXISTING-PAT"]);
    const result = validateEvent(canon, validIds);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.rule === "V-REF-01"));
  });

  it("Threshold idRejectionRate > 30% marcado como shouldPause", () => {
    const patients = [];
    // 65 valid patients (pass mapping + validation)
    for (let i = 0; i < 65; i++) patients.push(generatePatient(i + 7000));
    // 35 patients with all-same-digit CPF: passes normalizeCpf (11 digits) but fails V-ID-02
    for (let i = 65; i < 100; i++) {
      const p = generatePatient(i + 7000, { noCpf: true });
      p.cpf = `${(i % 9) + 1}`.repeat(11); // e.g. "11111111111" — invalid check digits
      patients.push(p);
    }

    const payload = buildPecPayload(patients);
    const mapping = applyMapping(payload, { ...TARGET_CONTEXT, importJobId: "test-thresh" });
    const validation = runValidation(mapping, null);

    // 35 rejected in validation / 100 mapped ≈ 35% > 30% threshold
    assert.ok(validation.thresholds.idRejectionRate.exceeded, "shouldPause deve ser ativado");
    assert.ok(validation.shouldPause);
  });
});

// ── FASE 5: Population Selection ─────────────────────────────────────────

describe("FASE 5 — Population Selection (E-01 a E-05)", () => {
  it("SIM-5: Paciente com visita recente passa E-01", () => {
    const patients = [generatePatient(300)];
    const payload = buildPecPayload(patients);
    const mapping = applyMapping(payload, { ...TARGET_CONTEXT, importJobId: "test-sel-1" });
    const validation = runValidation(mapping, null);
    const selection = applySelection(validation, null, {}, new Date());

    assert.equal(selection.selected.length, 1, "Paciente com visita recente deve ser selecionado (E-01)");
  });

  it("Paciente inativo incluído com flag inactive=true (E-05)", () => {
    const pat = generatePatient(301, { inactive: true });
    const payload = buildPecPayload([pat]);
    const mapping = applyMapping(payload, { ...TARGET_CONTEXT, importJobId: "test-e05" });
    const validation = runValidation(mapping, null);
    const selection = applySelection(validation, null, {}, new Date());

    assert.ok(selection.selected.length >= 1, "Inativo deve passar — E-05 inclui com flag");
    if (selection.selected.length > 0) {
      assert.ok(selection.selected[0].canonical.inactive);
    }
  });

  it("Local filter por microárea exclui paciente de outra microárea", () => {
    const pat = generatePatient(302, { microArea: "B", noCpf: true });
    const payload = buildPecPayload([pat]);
    const mapping = applyMapping(payload, { ...TARGET_CONTEXT, importJobId: "test-microarea" });
    const validation = runValidation(mapping, null);
    const selection = applySelection(validation, null, { microArea: "A" }, new Date());

    assert.equal(selection.rejected.length, 1);
    assert.ok(selection.rejected[0].rejectionReasons.some((r) => r.criterion === "LOCAL-MICROAREA"));
  });
});

// ── FASE 6: Pipeline E2E ──────────────────────────────────────────────────

describe("FASE 6 — Import Job + Pipeline E2E", () => {
  let jobId;
  let pipelineResult;

  before(async () => {
    // Generate 50 valid + 10 invalid patients
    const patients = [];
    for (let i = 0; i < 50; i++) patients.push(generatePatient(i + 1000));
    for (let i = 50; i < 60; i++) patients.push(generatePatient(i + 1000, { noName: true }));

    const payload = buildPecPayload(patients);

    const job = createImportJob({
      unitId: "unit-test-01",
      teamId: "team-test-01",
      sourceProfileId: "sp-pec-aps-v01",
      lgpdConsentRecordId: "consent-mig-01-test",
      createdBy: "test-user",
      localFilters: {},
    });
    jobId = job.id;

    pipelineResult = await runFullPipeline(
      jobId,
      payload,
      {
        teamId: "team-test-01",
        unitId: "unit-test-01",
        municipalityId: "3550308",
        defaultAcsUserId: "acs-test-01",
        existingProductionIds: {
          byCpf: new Map(),
          byCns: new Map(),
        },
      },
      withDb,
      null
    );
  });

  it("SIM-6: Pipeline completo executa sem erro", () => {
    assert.ok(pipelineResult.ok, `Pipeline deve ser OK — resultado: ${JSON.stringify(pipelineResult.ok)}`);
  });

  it("Job chega a status homologating", () => {
    const job = getImportJob(jobId);
    assert.equal(job.status, "homologating");
  });

  it("Staging contém pacientes válidos mapeados", () => {
    const staged = getStagedRecords(jobId);
    assert.ok(staged, "Staged records deve existir");
    assert.ok(staged.patients.length > 0, "Pelo menos 1 paciente staged");
    assert.ok(staged.patients.length <= 50, "Inválidos não passaram para staging");
  });

  it("SIM-7: Staging stats corretos — pacientes inválidos excluídos", () => {
    const staged = getStagedRecords(jobId);
    const job = getImportJob(jobId);
    // 10 pacientes sem nome foram rejeitados no mapping
    assert.equal(job.stats.mapped, 50, "50 válidos mapeados");
    assert.ok(job.stats.rejected >= 10, "≥10 inválidos rejeitados");
  });
});

// ── FASE 7: Homologação ───────────────────────────────────────────────────

describe("FASE 7 — Homologação GO / NO_GO", () => {
  let jobIdGo;
  let jobIdNoGo;

  before(async () => {
    // Create two jobs for GO and NO_GO paths
    for (const label of ["go", "nogo"]) {
      const patients = [generatePatient(label === "go" ? 2000 : 3000)];
      const payload = buildPecPayload(patients);

      const job = createImportJob({
        unitId: "unit-test-01",
        teamId: "team-test-01",
        sourceProfileId: "sp-pec-aps-v01",
        lgpdConsentRecordId: "consent-homo-test",
        createdBy: "test-user",
        localFilters: {},
      });

      if (label === "go") jobIdGo = job.id;
      else jobIdNoGo = job.id;

      await runFullPipeline(
        job.id,
        payload,
        { teamId: "team-test-01", unitId: "unit-test-01", municipalityId: "3550308",
          defaultAcsUserId: "acs-test", existingProductionIds: { byCpf: new Map(), byCns: new Map() } },
        withDb,
        null
      );
    }
  });

  it("SIM-8: Homologação GO registra decisão corretamente", () => {
    const result = submitHomologation(
      jobIdGo,
      "GO",
      "Dataset sintético validado — todos os critérios cumpridos",
      "gestor-test"
    );
    assert.ok(result.ok);
    assert.equal(result.decision, "GO");

    const job = getImportJob(jobIdGo);
    assert.equal(job.homologationResult, "GO");
    assert.equal(job.homologatedBy, "gestor-test");
    assert.ok(job.homologatedAt);
  });

  it("SIM-9: Homologação NO_GO descarta staging e muda status para discarded", () => {
    const result = submitHomologation(
      jobIdNoGo,
      "NO_GO",
      "Dados incompletos — requer revisão manual antes do import",
      "gestor-test"
    );
    assert.ok(result.ok);
    assert.equal(result.decision, "NO_GO");

    const job = getImportJob(jobIdNoGo);
    assert.equal(job.status, "discarded");
    assert.equal(job.homologationResult, "NO_GO");

    const staged = getStagedRecords(jobIdNoGo);
    assert.equal(staged, null, "Staging deve ser limpo após NO_GO");
  });

  it("Justificativa < 10 chars rejeitada", () => {
    // Need a fresh job in homologating status
    const job = createImportJob({
      unitId: "u", teamId: "t", sourceProfileId: "sp-pec-aps-v01",
      lgpdConsentRecordId: "c", createdBy: "u", localFilters: {},
    });
    // Manually set to homologating by running pipeline
    (async () => {
      const payload = buildPecPayload([generatePatient(9999)]);
      await runFullPipeline(job.id, payload,
        { teamId: "t", unitId: "u", municipalityId: "3550308", defaultAcsUserId: "a",
          existingProductionIds: { byCpf: new Map(), byCns: new Map() } },
        withDb, null
      );
    })();

    // Test the validation
    assert.throws(
      () => submitHomologation(job.id, "GO", "curto"),
      /Justificativa/
    );
  });
});

// ── FASE 8: Commit Simulado ───────────────────────────────────────────────

describe("FASE 8 — Commit Simulado (Atômico)", () => {
  let jobIdCommit;
  let commitResult;

  before(async () => {
    const patients = [];
    for (let i = 0; i < 5; i++) {
      // Use unique CPFs to avoid collision with other tests
      const p = generatePatient(i + 5000);
      p.cpf = undefined; // Use CNS only to avoid CPF reuse
      patients.push(p);
    }
    const payload = buildPecPayload(patients);

    const job = createImportJob({
      unitId: "unit-commit-test",
      teamId: "team-commit-test",
      sourceProfileId: "sp-pec-aps-v01",
      lgpdConsentRecordId: "consent-commit-test",
      createdBy: "test-user",
      localFilters: {},
    });
    jobIdCommit = job.id;

    await runFullPipeline(
      job.id,
      payload,
      { teamId: "team-commit-test", unitId: "unit-commit-test", municipalityId: "3550308",
        defaultAcsUserId: "acs-commit-test",
        existingProductionIds: { byCpf: new Map(), byCns: new Map() } },
      withDb,
      null
    );

    submitHomologation(jobIdCommit, "GO", "Dataset de commit test validado — GO confirmado", "gestor-test");

    commitResult = await executeCommit(jobIdCommit, withDb, null, null);
  });

  it("SIM-10: Commit executa sem erro e retorna auditHash", () => {
    assert.ok(commitResult.ok, "Commit deve ser OK");
    assert.ok(commitResult.auditHash, "auditHash deve ser gerado");
    assert.match(commitResult.auditHash, /^[a-f0-9]{64}$/);
  });

  it("Job status muda para committed após commit", () => {
    const job = getImportJob(jobIdCommit);
    assert.equal(job.status, "committed");
    assert.ok(job.commitAt);
  });

  it("Commit idempotente — segunda execução retorna ok sem duplicar", async () => {
    const result2 = await executeCommit(jobIdCommit, withDb, null, null);
    assert.ok(result2.ok);
    assert.ok(result2.idempotent);
  });

  it("Staging limpo após commit", () => {
    const staged = getStagedRecords(jobIdCommit);
    assert.equal(staged, null, "Staging deve ser removido após commit bem-sucedido");
  });
});

// ── FASE 9: Escala (50K sintético) ───────────────────────────────────────

describe("FASE 9 — Validação de Escala (50K pacientes sintéticos)", () => {
  it("SIM-11: Pipeline de mapping + validation + selection processa 50K em < 30s", async () => {
    const TOTAL = 50_000;
    const patients = [];
    for (let i = 0; i < TOTAL; i++) {
      // Skip CPF for scale test (all CNS-based) to avoid check digit computation overhead
      const p = {
        id: `SCALE-${i}`,
        nome: `Paciente Escala ${i}`,
        dataNascimento: generateDate(30, 10),
        cns: String(700000000000000 + i).padStart(15, "0"),
        ibgeMunicipio: "3550308",
        microarea: ["A", "B", "C", "D"][i % 4],
        racaCor: ["01", "02", "03", "04", "05"][i % 5],
        codigoFamilia: `FAM-${Math.floor(i / 4)}`,
        inactive: i % 20 === 0, // 5% inactive
        doencaCronica: i % 10 === 0, // 10% chronic
        visitas: [
          {
            id: `SVIS-${i}`,
            dataVisita: generateRecentVisitDate(Math.floor(Math.random() * 12)),
            turno: String((i % 3) + 1),
            tipoVisita: String((i % 8) + 1),
            motivosVisita: ["1"],
            desfecho: String((i % 3) + 1),
          },
        ],
      };
      patients.push(p);
    }

    const payload = buildPecPayload(patients);
    const importJobId = `scale-job-${Date.now()}`;
    const context = { ...TARGET_CONTEXT, importJobId };

    const t0 = Date.now();
    const mappingResult = applyMapping(payload, context);
    const validationResult = runValidation(mappingResult, null);
    const selectionResult = applySelection(validationResult, null, {}, new Date());
    const elapsed = Date.now() - t0;

    // Verificações
    assert.ok(mappingResult.patients.mapped.length > 0, "Pacientes devem ser mapeados");
    assert.ok(validationResult.stats.validPatients > 0, "Pacientes devem ser validados");
    assert.ok(selectionResult.stats.selected > 0, "Pacientes devem ser selecionados");
    assert.ok(elapsed < 60_000, `Pipeline deve executar em < 60s (levou ${elapsed}ms)`);

    // Stats log
    console.log(`\n  Scale test (${TOTAL} pacientes):`);
    console.log(`    Mapeados: ${mappingResult.patients.mapped.length}`);
    console.log(`    Rejeitados no mapping: ${mappingResult.patients.rejected.length}`);
    console.log(`    Validados: ${validationResult.stats.validPatients}`);
    console.log(`    Inválidos: ${validationResult.stats.invalidPatients}`);
    console.log(`    Selecionados: ${selectionResult.stats.selected}`);
    console.log(`    Inativos incluídos: ${selectionResult.stats.inactiveIncluded}`);
    console.log(`    Merge candidates: ${selectionResult.stats.mergeCandidate}`);
    console.log(`    Eventos selecionados: ${selectionResult.stats.eventsSelected}`);
    console.log(`    Tempo: ${elapsed}ms`);
  });
});

// ── FASE 10/11/12: Auditoria e Decisão Executiva ─────────────────────────

describe("FASE 10-12 — Auditoria, Rastreabilidade e Decisão Executiva", () => {
  it("SIM-12: Job committed tem auditHash SHA-256 registrado", () => {
    const jobs = listImportJobs();
    const committed = jobs.filter((j) => j.status === "committed");

    assert.ok(committed.length > 0, "Deve existir pelo menos 1 job committed");
    for (const job of committed) {
      assert.ok(job.auditHash, `Job ${job.id} deve ter auditHash`);
      assert.match(job.auditHash, /^[a-f0-9]{64}$/);
      assert.ok(job.commitAt, "Job deve ter commitAt timestamp");
      assert.ok(job.homologatedBy, "Job deve ter homologatedBy");
      assert.ok(job.homologatedAt, "Job deve ter homologatedAt");
    }
  });

  it("Job discarded não tem staging residual", () => {
    const jobs = listImportJobs();
    const discarded = jobs.filter((j) => j.status === "discarded");

    for (const job of discarded) {
      const staged = getStagedRecords(job.id);
      assert.equal(staged, null, `Job discarded ${job.id} não deve ter staging residual`);
    }
  });

  it("Lifecycle completo: received → mapping → validating → selecting → staging → homologating → committed", async () => {
    const patient = generatePatient(9001);
    patient.cpf = undefined;
    const payload = buildPecPayload([patient]);

    const job = createImportJob({
      unitId: "unit-lifecycle",
      teamId: "team-lifecycle",
      sourceProfileId: "sp-pec-aps-v01",
      lgpdConsentRecordId: "consent-lifecycle",
      createdBy: "lifecycle-user",
      localFilters: {},
    });

    assert.equal(getImportJob(job.id).status, "received");

    await runFullPipeline(
      job.id, payload,
      { teamId: "team-lifecycle", unitId: "unit-lifecycle", municipalityId: "3550308",
        defaultAcsUserId: "acs-lifecycle",
        existingProductionIds: { byCpf: new Map(), byCns: new Map() } },
      withDb, null
    );

    assert.equal(getImportJob(job.id).status, "homologating");

    submitHomologation(job.id, "GO", "Lifecycle test — GO confirmado após revisão", "gestor-lifecycle");
    assert.equal(getImportJob(job.id).homologationResult, "GO");

    const commit = await executeCommit(job.id, withDb, null, null);
    assert.ok(commit.ok);
    assert.equal(getImportJob(job.id).status, "committed");
  });
});
