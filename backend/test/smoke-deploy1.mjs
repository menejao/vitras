/**
 * Smoke tests Deploy 1 — F1-01 through F1-08 + NG-02
 * Isolated temp DB, no permanent side effects.
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// --- Isolated env setup BEFORE any app import ---
const tmpDir = mkdtempSync(join(tmpdir(), "vitras-smoke-d1-"));
const tmpDb = join(tmpDir, "db.json");
writeFileSync(tmpDb, JSON.stringify({}), "utf8");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "smoke-jwt-secret-deploy1-not-for-prod";
process.env.DATA_ENCRYPTION_KEY = "smoke-data-enc-key-32-bytes-pads";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "smoke-backup-key-deploy1";
process.env.TEST_DB_PATH = tmpDb;

process.on("exit", () => { try { rmSync(tmpDir, { recursive: true }); } catch {} });

const { default: app } = await import("../src/app.js");

const server = createServer(app);
await new Promise((resolve, reject) => {
  server.listen(0, "127.0.0.1", (err) => (err ? reject(err) : resolve()));
});
const { port } = server.address();
const BASE = `http://127.0.0.1:${port}`;

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

const get = (path, token) => req("GET", path, null, token);
const post = (path, body, token) => req("POST", path, body, token);
const put = (path, body, token) => req("PUT", path, body, token);

// GET /patients returns a list; find patient by id
async function getPatientById(id, token) {
  const { status, json } = await get("/patients", token);
  if (status !== 200 || !Array.isArray(json)) return { status, patient: null };
  const patient = json.find((p) => p.id === id) || null;
  return { status, patient };
}

// --- Seed: login as demo manager ---
const loginRes = await post("/auth/login", { email: "ana@clinica.local", password: "123456" });
const token = loginRes.json?.token || loginRes.json?.accessToken;
if (!token) {
  console.error("FATAL: Login failed", loginRes.status, JSON.stringify(loginRes.json));
  process.exit(1);
}

const results = [];
function record(smoke, pass, evidence, risco) {
  results.push({ smoke, pass, evidence, risco });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${smoke}`);
  if (!pass) console.error("  EVIDENCE:", JSON.stringify(evidence, null, 2));
}

// ============================================================
// Smoke 1 — POST /patients com payload completo F1-01
// ============================================================
const postPayload = {
  name: "Paciente Smoke D1",
  phone: "(11)98000-0001",
  careCategory: "general",
  motherName: "Maria das Graças",
  motherUnknown: false,
  guardianName: "",
  cpf: "000.000.001-01",
  cns: "700000000000001",
  birthDate: "1985-06-15",
  birthCity: "São Paulo",
  birthState: "SP",
  // F2-02/F2-03/F2-04: canonical enum values required after Deploy 2C
  sexAtBirth: "F",
  genderIdentity: "MULHER_CISSGENERO",
  maritalStatus: "SOLTEIRO",
  racaCor: "PARDA",
  escolaridade: "ensino_medio",
  occupation: "auxiliar_administrativo",
  familySituation: "nao_se_aplica",
  familySupport: "bom",
  socialVulnerability: "baixa",
  socialBenefit: "nenhum",
  substanceDependency: "nao",
  domesticViolence: "nao",
  microArea: "MA-01",
  assignedAcsId: "",
  familyCode: "FC-001",
  homeVisitFreq: "mensal",
  addressLegacy: "Rua das Flores, 42",
  logradouro: "Rua das Flores",
  numero: "42",
  complemento: "Apto 3",
  bairro: "Jardim Primavera",
  cep: "01310-100",
  municipioIbge: "3550308",
  uf: "SP",
  tipoLogradouroCnes: "RUA",
  housingType: "casa",
  waterSupply: "rede_publica",
  sewage: "rede_publica",
  garbage: "coletado",
  electricity: "sim",
  allergies: "penicilina",
  comorbidities: "hipertensao",
  medications: "enalapril 5mg",
  responsible: {
    name: "José da Silva",
    cpf: "000.000.002-02",
    phone: "(11)97000-0002",
    relationship: "conjuge"
  }
};

const s1 = await post("/patients", postPayload, token);
const smoke1Pass = s1.status === 201 || s1.status === 200;
record("Smoke 1 — POST /patients payload F1-01", smoke1Pass,
  { status: s1.status, id: s1.json?.id, error: s1.json?.error }, "CRITICAL");
const createdId = s1.json?.id;

// ============================================================
// Smoke 2 — GET paciente (via list), verificar campos canônicos
// NOTE: GET /patients/:id route does not exist; use GET /patients list
// ============================================================
let smoke2Pass = false;
let smoke2Evidence = {};
if (createdId) {
  const { status, patient: p } = await getPatientById(createdId, token);
  if (!p) {
    smoke2Evidence = { status, error: `Patient ${createdId} not found in list` };
  } else {
    const checks = {
      motherUnknown: p?.motherUnknown === false,
      addressLegacy: p?.addressLegacy === "Rua das Flores, 42",
      birthCity: p?.birthCity === "São Paulo",
      birthState: p?.birthState === "SP",
      logradouro: p?.logradouro === "Rua das Flores",
      numero: p?.numero === "42",
      complemento: p?.complemento === "Apto 3",
      bairro: p?.bairro === "Jardim Primavera",
      // F2-06: CEP normalized to 8 digits by schema
      cep: p?.cep === "01310100",
      municipioIbge: p?.municipioIbge === "3550308",
      uf: p?.uf === "SP",
      escolaridade: p?.escolaridade === "ensino_medio",
      racaCor: p?.racaCor === "PARDA",
      responsible_name: p?.responsible?.name === "José da Silva",
      responsible_relationship: p?.responsible?.relationship === "conjuge",
    };
    const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    smoke2Pass = failed.length === 0;
    smoke2Evidence = {
      status,
      failed,
      racaCor: p?.racaCor,
      escolaridade: p?.escolaridade,
      cep: p?.cep,
      uf: p?.uf,
      responsible: p?.responsible,
      addressLegacy: p?.addressLegacy,
      motherUnknown: p?.motherUnknown,
    };
  }
} else {
  smoke2Evidence = { error: "No patient ID from Smoke 1" };
}
record("Smoke 2 — GET paciente via list, campos canônicos F1-01", smoke2Pass, smoke2Evidence, "CRITICAL");

// ============================================================
// Smoke 3 — PUT com aliases (raceColor, educationLevel, etc.)
// ============================================================
let smoke3Pass = false;
let smoke3Evidence = {};
if (createdId) {
  const aliasPayload = {
    raceColor: "BRANCA",
    educationLevel: "superior_completo",
    address: "Av. Paulista, 1000",
    zipCode: "01310-200",
    number: "1000",
    complement: "Sala 5",
    neighborhood: "Bela Vista",
    city: "3550308",
    state: "SP",
  };
  const s3 = await put(`/patients/${createdId}`, aliasPayload, token);
  smoke3Pass = s3.status === 200;
  smoke3Evidence = { status: s3.status, error: s3.json?.error };
} else {
  smoke3Evidence = { error: "No patient ID from Smoke 1" };
}
record("Smoke 3 — PUT aceita aliases (200)", smoke3Pass, smoke3Evidence, "CRITICAL");

// ============================================================
// Smoke 4 — GET após PUT via list, verificar canônicos atualizados + aliases ausentes
// ============================================================
let smoke4Pass = false;
let smoke4Evidence = {};
if (createdId) {
  const { status, patient: p } = await getPatientById(createdId, token);
  if (!p) {
    smoke4Evidence = { status, error: `Patient ${createdId} not found in list after PUT` };
  } else {
    const checks = {
      racaCor_updated: p?.racaCor === "BRANCA",
      escolaridade_updated: p?.escolaridade === "superior_completo",
      addressLegacy_updated: p?.addressLegacy === "Av. Paulista, 1000",
      // F2-06: CEP normalized
      cep_updated: p?.cep === "01310200",
      numero_updated: p?.numero === "1000",
      complemento_updated: p?.complemento === "Sala 5",
      bairro_updated: p?.bairro === "Bela Vista",
      municipioIbge_updated: p?.municipioIbge === "3550308",
      uf_updated: p?.uf === "SP",
      // aliases must NOT carry alias values (canonical takes precedence)
      no_raceColor_as_alias: !p?.raceColor || p?.raceColor === p?.racaCor,
      no_educationLevel_as_alias: !p?.educationLevel || p?.educationLevel === p?.escolaridade,
      no_zipCode_persisted: !p?.zipCode,
      no_number_persisted: !p?.number,
      no_complement_persisted: !p?.complement,
      no_neighborhood_persisted: !p?.neighborhood,
      no_city_persisted: !p?.city,
    };
    const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    smoke4Pass = failed.length === 0;
    smoke4Evidence = {
      status,
      failed,
      racaCor: p?.racaCor,
      escolaridade: p?.escolaridade,
      addressLegacy: p?.addressLegacy,
      cep: p?.cep,
      numero: p?.numero,
      // aliases that should be absent:
      raceColor: p?.raceColor,
      educationLevel: p?.educationLevel,
      zipCode: p?.zipCode,
      number: p?.number,
    };
  }
} else {
  smoke4Evidence = { error: "No patient ID from Smoke 1" };
}
record("Smoke 4 — GET após PUT, canônicos atualizados, aliases ausentes", smoke4Pass, smoke4Evidence, "CRITICAL");

// ============================================================
// Smoke 5 — .strict() rejeita campo desconhecido no PUT
// ============================================================
let smoke5Pass = false;
let smoke5Evidence = {};
if (createdId) {
  const s5 = await put(`/patients/${createdId}`, { campoInexistente: true }, token);
  smoke5Pass = s5.status === 400;
  smoke5Evidence = { status: s5.status, error: s5.json?.error, details: s5.json?.details };
} else {
  smoke5Evidence = { error: "No patient ID from Smoke 1" };
}
record("Smoke 5 — .strict() rejeita campo desconhecido (400)", smoke5Pass, smoke5Evidence, "CRITICAL");

// ============================================================
// Smoke 6 — NG-02: cnsResponsavel NÃO persiste no banco
// Note: Zod strips unknown sub-fields silently (responsible schema lacks .strict()).
// Test: send cnsResponsavel, verify it does NOT appear in the stored patient.
// A 400 would also satisfy NG-02; 200 with field absent is also safe.
// ============================================================
let smoke6Pass = false;
let smoke6Evidence = {};
if (createdId) {
  const s6 = await put(`/patients/${createdId}`, {
    responsible: { cnsResponsavel: "123456789012345" }
  }, token);
  // Read patient back and verify cnsResponsavel is absent
  const { patient: pAfter } = await getPatientById(createdId, token);
  // NG-02 post-F2-05: cnsResponsavel is now a valid top-level field (F2-05).
  // Security check: value from nested responsible.cnsResponsavel must NOT be stored as top-level cnsResponsavel.
  // The top-level field defaults to "" on creation; it should still be "" after this PUT.
  const cnsNotLeaked = pAfter?.cnsResponsavel === "" || pAfter?.cnsResponsavel === undefined;
  const cnsNotInResponsible = !pAfter?.responsible?.cnsResponsavel;
  const cnsAbsent = cnsNotLeaked && cnsNotInResponsible;
  smoke6Pass = s6.status === 400 || (s6.status === 200 && cnsAbsent);
  smoke6Evidence = {
    status: s6.status,
    topLevel_cnsResponsavel: pAfter?.cnsResponsavel,
    responsible_cnsResponsavel: pAfter?.responsible?.cnsResponsavel,
    cnsNotLeaked,
    cnsAbsent,
    note: "F2-05: cnsResponsavel is now a valid top-level field; verify nested path does not leak value to top-level"
  };
} else {
  smoke6Evidence = { error: "No patient ID from Smoke 1" };
}
record("Smoke 6 — NG-02: cnsResponsavel ausente do banco", smoke6Pass, smoke6Evidence, "CRITICAL");

// ============================================================
// Summary
// ============================================================
if (typeof server.closeAllConnections === "function") server.closeAllConnections();
await new Promise((resolve) => server.close(resolve));

console.log("\n=== SMOKE DEPLOY 1 — SUMMARY ===");
const total = results.length;
const passed = results.filter((r) => r.pass).length;
console.log(`${passed}/${total} PASS`);
results.forEach((r) => {
  const tag = r.pass ? "✓" : "✗";
  console.log(`  ${tag} ${r.smoke}`);
});

const allPass = passed === total;
console.log(`\nVeredito: ${allPass ? "APPROVED FOR DEPLOY" : "REJECTED"}`);
process.exit(allPass ? 0 : 1);
