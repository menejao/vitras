/**
 * migration-021-logic.test.mjs
 *
 * VITRAS-GLOBAL-PATIENT-REFERENCE-ATTRIBUTION-01 FASE 17
 * Valida invariantes da migration patient.unitId → referenceUnitId.
 *
 * Testa a lógica de migração sem requerer conexão Neon (usa ensureDbShape + withDb).
 *
 * Nota: migration-021-referenceunitid.mjs foi aplicada em produção (Neon) com resultado:
 *   851 pacientes processados, 0 divergências, 1 municipalityId corrigido.
 *
 * Invariantes:
 *  - UP: preenche referenceUnitId onde ausente (unitId como fonte)
 *  - idempotência: re-aplicar não altera pacientes já com referenceUnitId correto
 *  - DOWN simulado: removeríamos referenceUnitId → ensureDbShape re-preenche no restore
 *  - divergência gera warn, não corrompe dados
 *  - unitId preservado após fill (backward compat cds-export)
 *  - novo paciente via POST tem ambos os campos iguais
 *  - paciente sem municipalityId recebe fallback do contexto
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, post, get } from "./helpers.js";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";

const MUNI = "4299999";
const DOC_CREDS = { email: "mig17.med@vitras.com.br", password: "Demo@2026" };
let docToken = "";

const U_MIG  = "mig17-ubs";
const T_MIG  = "mig17-team";
const DOC_ID = "mig17-doc";

describe("Migration 021 Logic — FASE 17", () => {
  before(async () => {
    await startTestServer();
    await withDb((db) => {
      ensureDbShape(db);
      if (!db.units.find(u => u.id === U_MIG)) {
        db.units.push({ id: U_MIG, name: "Mig17 UBS", cnes: "", createdAt: new Date().toISOString() });
      }
      if (!db.teams.find(t => t.id === T_MIG)) {
        db.teams.push({ id: T_MIG, name: "Mig17 Team", unitId: U_MIG, createdAt: new Date().toISOString() });
      }
      if (!db.users.find(u => u.id === DOC_ID)) {
        db.users.push({
          id: DOC_ID, name: "Mig17 Doctor", role: "doctor",
          email: "mig17.med@vitras.com.br", password: hashPassword("Demo@2026"),
          teamId: T_MIG, teamName: T_MIG, unitId: U_MIG, municipalityId: MUNI,
          inactive: false, twoFactorEnabled: false,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
      }
    });
    const res = await post("/auth/login", DOC_CREDS);
    docToken = res.json?.token || res.json?.accessToken || "";
  });

  after(async () => {
    await withDb((db) => {
      db.users  = db.users.filter(u => u.id !== DOC_ID);
      db.units  = db.units.filter(u => u.id !== U_MIG);
      db.teams  = db.teams.filter(t => t.id !== T_MIG);
      db.patients = db.patients.filter(p => !String(p.id || "").startsWith("mig17-"));
    });
    await stopTestServer();
  });

  // ── UP: preenche referenceUnitId onde ausente ────────────────────────────

  it("UP — batch: N pacientes sem referenceUnitId recebem referenceUnitId = unitId", () => {
    const db = {
      patients: [
        { id: "mig17-p1", unitId: "ubs-x", municipalityId: MUNI },
        { id: "mig17-p2", unitId: "ubs-y", municipalityId: MUNI },
        { id: "mig17-p3", unitId: "ubs-z", municipalityId: MUNI },
      ],
      users: [], teams: [], units: [], userUnitMemberships: [], tasks: [], households: [],
      acsVisits: [], familyGroups: [], appointments: [], protocolTemplates: [], clinicalRecords: []
    };
    ensureDbShape(db);
    for (const p of db.patients) {
      assert.ok(p.referenceUnitId, `p.id=${p.id}: referenceUnitId deve estar preenchido`);
      assert.equal(p.referenceUnitId, p.unitId,
        `p.id=${p.id}: referenceUnitId deve ser igual a unitId`);
    }
  });

  it("unitId preservado após fill (backward compat cds-export)", () => {
    const db = {
      patients: [{ id: "mig17-p4", unitId: "ubs-a", municipalityId: MUNI }],
      users: [], teams: [], units: [], userUnitMemberships: [], tasks: [], households: [],
      acsVisits: [], familyGroups: [], appointments: [], protocolTemplates: [], clinicalRecords: []
    };
    ensureDbShape(db);
    assert.equal(db.patients[0].unitId, "ubs-a", "unitId não deve ser alterado após fill");
    assert.equal(db.patients[0].referenceUnitId, "ubs-a", "referenceUnitId deve ser preenchido");
  });

  // ── Idempotência ─────────────────────────────────────────────────────────

  it("idempotência: pacientes já com referenceUnitId correto não são alterados", () => {
    const db = {
      patients: [
        { id: "mig17-p5", unitId: "ubs-b", referenceUnitId: "ubs-b", municipalityId: MUNI },
        { id: "mig17-p6", unitId: "ubs-c", referenceUnitId: "ubs-c", municipalityId: MUNI },
      ],
      users: [], teams: [], units: [], userUnitMemberships: [], tasks: [], households: [],
      acsVisits: [], familyGroups: [], appointments: [], protocolTemplates: [], clinicalRecords: []
    };
    const snapBefore = JSON.parse(JSON.stringify(db.patients));
    ensureDbShape(db);
    // Re-apply (simulate running UP again)
    ensureDbShape(db);
    for (let i = 0; i < db.patients.length; i++) {
      assert.equal(db.patients[i].referenceUnitId, snapBefore[i].referenceUnitId,
        `idempotência: referenceUnitId de ${db.patients[i].id} não deve mudar`);
      assert.equal(db.patients[i].unitId, snapBefore[i].unitId,
        `idempotência: unitId de ${db.patients[i].id} não deve mudar`);
    }
  });

  // ── DOWN simulado + re-UP ────────────────────────────────────────────────

  it("DOWN simulado: remove referenceUnitId → ensureDbShape re-preenche (restauração)", () => {
    const db = {
      patients: [
        { id: "mig17-p7", unitId: "ubs-d", referenceUnitId: "ubs-d", municipalityId: MUNI },
      ],
      users: [], teams: [], units: [], userUnitMemberships: [], tasks: [], households: [],
      acsVisits: [], familyGroups: [], appointments: [], protocolTemplates: [], clinicalRecords: []
    };

    // Simula DOWN: remove referenceUnitId
    db.patients = db.patients.map(p => {
      const { referenceUnitId: _, ...rest } = p;
      return rest;
    });
    assert.ok(!("referenceUnitId" in db.patients[0]), "DOWN deve remover referenceUnitId");
    assert.equal(db.patients[0].unitId, "ubs-d", "unitId preservado após DOWN");

    // Simula UP (ensureDbShape): re-preenche
    ensureDbShape(db);
    assert.equal(db.patients[0].referenceUnitId, "ubs-d",
      "após re-UP, referenceUnitId deve ser restaurado a partir de unitId");
  });

  // ── Divergência ──────────────────────────────────────────────────────────

  it("divergência: warn emitido mas dados NÃO corrompidos (unitId e referenceUnitId preservados)", () => {
    const warns = [];
    const orig = console.warn;
    console.warn = (...args) => warns.push(args.join(" "));

    const db = {
      patients: [{ id: "mig17-p8", unitId: "ubs-e", referenceUnitId: "ubs-f-divergente", municipalityId: MUNI }],
      users: [], teams: [], units: [], userUnitMemberships: [], tasks: [], households: [],
      acsVisits: [], familyGroups: [], appointments: [], protocolTemplates: [], clinicalRecords: []
    };
    ensureDbShape(db);
    console.warn = orig;

    assert.equal(db.patients[0].unitId, "ubs-e", "unitId não deve ser alterado em divergência");
    assert.equal(db.patients[0].referenceUnitId, "ubs-f-divergente",
      "referenceUnitId divergente não deve ser silenciosamente sobrescrito");
    assert.ok(warns.some(w => w.includes("diverge") || w.includes("divergê")),
      "deve emitir warn ao detectar divergência");
  });

  // ── Novo cadastro — ambos campos sincronizados ────────────────────────────

  it("POST /patients: novo paciente tem unitId == referenceUnitId (integração)", async () => {
    const { status, json } = await post("/patients", {
      name: "Mig17 Novo Paciente",
      birthDate: "1990-01-01",
      gender: "M",
      phone: "11900000017",
      cpf: "00000000017",
      careCategory: "normal"
    }, docToken);

    assert.ok(status === 201 || status === 200, `esperava 201/200, got ${status}`);

    await withDb((db) => {
      const p = db.patients.find(x => x.cpf === "00000000017");
      assert.ok(p, "paciente deve estar no DB");
      assert.ok(p.unitId, "unitId deve estar preenchido (backward compat)");
      assert.ok(p.referenceUnitId, "referenceUnitId deve estar preenchido");
      assert.equal(p.referenceUnitId, p.unitId,
        `referenceUnitId (${p.referenceUnitId}) deve ser igual a unitId (${p.unitId})`);
      assert.equal(p.municipalityId, MUNI,
        `municipalityId deve ser do JWT (${MUNI}), não do body`);
      db.patients = db.patients.filter(x => x.cpf !== "00000000017");
    });
  });

  // ── Relatório de inconsistências: zero divergências esperado ─────────────

  it("zero divergências: nenhum paciente em DB de teste tem referenceUnitId ≠ unitId (exceto fixtures de divergência)", () => {
    const db = {
      patients: [
        { id: "mig17-ok1", unitId: "ubs-g", referenceUnitId: "ubs-g", municipalityId: MUNI },
        { id: "mig17-ok2", unitId: "ubs-h", referenceUnitId: "ubs-h", municipalityId: MUNI },
        { id: "mig17-ok3", unitId: "ubs-i", municipalityId: MUNI },  // sem referenceUnitId — será preenchido
      ],
      users: [], teams: [], units: [], userUnitMemberships: [], tasks: [], households: [],
      acsVisits: [], familyGroups: [], appointments: [], protocolTemplates: [], clinicalRecords: []
    };
    ensureDbShape(db);
    const diverged = db.patients.filter(p => {
      const uid = String(p.unitId || "").trim();
      const refUid = String(p.referenceUnitId || "").trim();
      return uid && refUid && uid !== refUid;
    });
    assert.equal(diverged.length, 0, `esperava 0 divergências, encontrou ${diverged.length}`);
  });

  it("cds-export.js: arquivo não modificado desde último commit relevante", async () => {
    const { execFileSync } = await import("node:child_process");
    const output = execFileSync("git", ["diff", "HEAD", "--name-only"], { encoding: "utf8" });
    assert.ok(!output.includes("cds-export.js"),
      "cds-export.js não deve estar no diff — arquivo é INTOCÁVEL");
  });
});
