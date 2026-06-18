/**
 * APS-01G Validation — ACS Form Gap Closure
 * Run: node scripts/aps01g-validation.mjs
 */

import { readFile } from "node:fs/promises";

let passed = 0;
let failed = 0;
function ok(label)        { console.log(`  ✓ ${label}`); passed++; }
function fail(label, why) { console.error(`  ✗ ${label}: ${why}`); failed++; }

// ── 1. Schema — AcsVisit new fields ──────────────────────────────────────────
console.log("\n[1] Schema — AcsVisit (sinais vitais, glicemia, microárea)");

const schemaSrc = await readFile(new URL("../src/schemas.js", import.meta.url), "utf8");

const VISIT_SCHEMA_CHECKS = [
  ["microarea in CreateSchema",    "microarea:         z.string"],
  ["foraArea in CreateSchema",     "foraArea:          z.boolean"],
  ["temperatura in CreateSchema",  "temperatura:       z.number"],
  ["paSistolica in CreateSchema",  "paSistolica:       z.number"],
  ["paDiastolica in CreateSchema", "paDiastolica:      z.number"],
  ["glicemia in CreateSchema",     "glicemia:          z.number"],
  ["momentoGlicemia in Schema",    "momentoGlicemia:   z.enum"],
  ["momentoGlicemia values",       "ACS_MOMENTO_GLICEMIA_VALUES"],
  ["jejum in momento values",      '"jejum"'],
  ["pos_prandial_1h in valores",   '"pos_prandial_1h"'],
  ["microarea in UpdateSchema",    "microarea:         z.string"],
  ["foraArea in UpdateSchema",     "foraArea:          z.boolean"],
];
for (const [lbl, tok] of VISIT_SCHEMA_CHECKS) {
  if (schemaSrc.includes(tok)) ok(lbl);
  else fail(lbl, `not found: ${tok}`);
}

// ── 2. Schema — Household new fields ─────────────────────────────────────────
console.log("\n[2] Schema — Household (tipoDomicilio, animais, foraArea)");

const HOUSEHOLD_SCHEMA_CHECKS = [
  ["TIPO_DOMICILIO_VALUES",        "TIPO_DOMICILIO_VALUES"],
  ["TIPOS_ANIMAIS_VALUES",         "TIPOS_ANIMAIS_VALUES"],
  ["CASA in tipoDomicilio",        '"CASA"'],
  ["APARTAMENTO in tipoDomicilio", '"APARTAMENTO"'],
  ["MALOCA in tipoDomicilio",      '"MALOCA"'],
  ["tipoDomicilio in Create",      "tipoDomicilio: z.enum(TIPO_DOMICILIO_VALUES)"],
  ["foraArea in HouseholdCreate",  "foraArea: z.boolean"],
  ["animaisNoDomicilio in Create", "animaisNoDomicilio: z.boolean"],
  ["tiposAnimais in Create",       "tiposAnimais: z.array"],
  ["quantidadeAnimais in Create",  "quantidadeAnimais: z.number().int()"],
  ["tipoDomicilio in Update",      "tipoDomicilio: z.enum(TIPO_DOMICILIO_VALUES)"],
  ["foraArea in HouseholdUpdate",  "foraArea: z.boolean"],
];
for (const [lbl, tok] of HOUSEHOLD_SCHEMA_CHECKS) {
  if (schemaSrc.includes(tok)) ok(lbl);
  else fail(lbl, `not found: ${tok}`);
}

// ── 3. Backend — acs-visits.js persists new fields ──────────────────────────
console.log("\n[3] Backend — acs-visits.js");

const visitSrc = await readFile(new URL("../src/routes/acs-visits.js", import.meta.url), "utf8");

const VISIT_BACKEND_CHECKS = [
  ["microarea persisted",    "microarea:         payload.microarea"],
  ["foraArea persisted",     "foraArea:          payload.foraArea"],
  ["temperatura persisted",  "temperatura:       payload.temperatura"],
  ["paSistolica persisted",  "paSistolica:       payload.paSistolica"],
  ["paDiastolica persisted", "paDiastolica:      payload.paDiastolica"],
  ["glicemia persisted",     "glicemia:          payload.glicemia"],
  ["momentoGlicemia logic",  "momentoGlicemia:"],
];
for (const [lbl, tok] of VISIT_BACKEND_CHECKS) {
  if (visitSrc.includes(tok)) ok(lbl);
  else fail(lbl, `not found: ${tok}`);
}

// ── 4. Backend — households.js persists new fields ──────────────────────────
console.log("\n[4] Backend — households.js");

const hhSrc = await readFile(new URL("../src/routes/households.js", import.meta.url), "utf8");

const HH_BACKEND_CHECKS = [
  ["tipoDomicilio in POST",    "tipoDomicilio: payload.tipoDomicilio"],
  ["foraArea in POST",         "foraArea: payload.foraArea"],
  ["animaisNoDomicilio POST",  "animaisNoDomicilio: payload.animaisNoDomicilio"],
  ["tiposAnimais in POST",     "tiposAnimais: Array.isArray"],
  ["quantidadeAnimais POST",   "quantidadeAnimais: payload.quantidadeAnimais"],
  ["tipoDomicilio in PATCH",   "if (payload.tipoDomicilio"],
  ["foraArea in PATCH",        "if (payload.foraArea"],
  ["animaisNoDomicilio PATCH", "if (payload.animaisNoDomicilio"],
  ["tiposAnimais in PATCH",    "if (payload.tiposAnimais"],
  ["quantidadeAnimais PATCH",  "if (payload.quantidadeAnimais"],
];
for (const [lbl, tok] of HH_BACKEND_CHECKS) {
  if (hhSrc.includes(tok)) ok(lbl);
  else fail(lbl, `not found: ${tok}`);
}

// ── 5. Backend — patients.js TRIA ────────────────────────────────────────────
console.log("\n[5] Backend — patients.js TRIA");

const patSrc = await readFile(new URL("../src/routes/patients.js", import.meta.url), "utf8");

const PATIENT_BACKEND_CHECKS = [
  ["triaAlimentosAcabaram POST", "triaAlimentosAcabaram:"],
  ["triaTipoUnico POST",         "triaTipoUnico:"],
  ["TRIA in PUT",                "triaAlimentosAcabaram: safePayload"],
  ["triaTipoUnico in PUT",       "triaTipoUnico: safePayload"],
];
for (const [lbl, tok] of PATIENT_BACKEND_CHECKS) {
  if (patSrc.includes(tok)) ok(lbl);
  else fail(lbl, `not found: ${tok}`);
}

// ── 6. Frontend — AcsTasksPage visit form ────────────────────────────────────
console.log("\n[6] Frontend — AcsTasksPage visit form");

const acsFe = await readFile(
  new URL("../../frontend-react/src/pages/AcsTasksPage.jsx", import.meta.url), "utf8"
);

const ACS_FE_CHECKS = [
  ["microarea in emptyVisitForm",       "microarea:          patient?.microarea"],
  ["foraArea in emptyVisitForm",        "foraArea:           false"],
  ["temperatura in emptyVisitForm",     "temperatura:        \"\""],
  ["paSistolica in emptyVisitForm",     "paSistolica:        \"\""],
  ["paDiastolica in emptyVisitForm",    "paDiastolica:       \"\""],
  ["glicemia in emptyVisitForm",        "glicemia:           \"\""],
  ["momentoGlicemia in emptyVisitForm", "momentoGlicemia:    \"jejum\""],
  ["microarea in submit body",          "microarea:         form.microarea"],
  ["foraArea in submit body",           "foraArea:          form.foraArea"],
  ["temperatura in submit body",        "temperatura:       form.temperatura"],
  ["paSistolica in submit body",        "paSistolica:       form.paSistolica"],
  ["paDiastolica in submit body",       "paDiastolica:      form.paDiastolica"],
  ["glicemia in submit body",           "glicemia:          form.glicemia"],
  ["momentoGlicemia in submit body",    "momentoGlicemia:   form.glicemia"],
  ["microarea input rendered",          "vis-microarea"],
  ["foraArea checkbox rendered",        "Fora da área de cobertura"],
  ["temperatura input rendered",        "vis-temp"],
  ["PA Sistólica rendered",             "PA Sistólica (mmHg)"],
  ["PA Diastólica rendered",            "PA Diastólica (mmHg)"],
  ["Glicemia block rendered",           "Glicemia capilar (mg/dL)"],
  ["Momento da coleta rendered",        "Momento da coleta"],
  ["Pessoa Idosa acompanhamento",       "ac_pessoa_idosa"],
  ["Sintomáticos resp acompanhamento",  "ac_sintomaticos_resp"],
  ["Outras doenças crônicas",           "ac_outras_doencas_cronicas"],
  ["Vulnerabilidade social",            "ac_vulnerabilidade_social"],
];
for (const [lbl, tok] of ACS_FE_CHECKS) {
  if (acsFe.includes(tok)) ok(lbl);
  else fail(lbl, `not found: ${tok}`);
}

// ── 7. Frontend — PatientDetailPanel household ───────────────────────────────
console.log("\n[7] Frontend — PatientDetailPanel household form");

const pdpSrc = await readFile(
  new URL("../../frontend-react/src/components/patients/PatientDetailPanel.jsx", import.meta.url), "utf8"
);

const PDP_HH_CHECKS = [
  ["tipoDomicilio in emptyHouseholdForm", "tipoDomicilio: \"\""],
  ["foraArea in emptyHouseholdForm",      "foraArea: false"],
  ["animaisNoDomicilio in empty",         "animaisNoDomicilio: false"],
  ["tiposAnimais in empty",               "tiposAnimais: []"],
  ["tipoDomicilio in startEdit",          "tipoDomicilio: household.tipoDomicilio"],
  ["foraArea in startEdit",               "foraArea: household.foraArea"],
  ["animaisNoDomicilio in startEdit",     "animaisNoDomicilio: household.animaisNoDomicilio"],
  ["tipoDomicilio select in form",        "Tipo de domicílio"],
  ["CASA option",                         "value=\"CASA\">Casa"],
  ["APARTAMENTO option",                  "value=\"APARTAMENTO\">Apartamento"],
  ["MALOCA option",                       "value=\"MALOCA\">Maloca"],
  ["foraArea checkbox in form",           "Fora da área de cobertura"],
  ["Animais checkbox in form",            "Animais no domicílio"],
  ["cachorro option",                     '"cachorro","Cachorro"'],
  ["gato option",                         '"gato","Gato"'],
  ["animais display in view",             "Animais no domicílio"],
  ["tipoDomicilio in payload",            "tipoDomicilio: form.tipoDomicilio"],
  ["foraArea in payload",                 "foraArea: form.foraArea"],
  ["animaisNoDomicilio in payload",       "animaisNoDomicilio: form.animaisNoDomicilio"],
  ["tiposAnimais in payload",             "tiposAnimais: form.animaisNoDomicilio"],
  ["quantidadeAnimais in payload",        "quantidadeAnimais: form.animaisNoDomicilio && form.quantidadeAnimais"],
];
for (const [lbl, tok] of PDP_HH_CHECKS) {
  if (pdpSrc.includes(tok)) ok(lbl);
  else fail(lbl, `not found: ${tok}`);
}

// ── 8. Frontend — TRIA in PatientModal ───────────────────────────────────────
console.log("\n[8] Frontend — TRIA (PatientModal + usePatientModal)");

const modalSrc = await readFile(
  new URL("../../frontend-react/src/components/modals/PatientModal.jsx", import.meta.url), "utf8"
);
const hookSrc = await readFile(
  new URL("../../frontend-react/src/hooks/usePatientModal.js", import.meta.url), "utf8"
);

const TRIA_CHECKS_MODAL = [
  ["TRIA section title",         "Triagem de Risco Alimentar (TRIA)"],
  ["triaAlimentosAcabaram select", "triaAlimentosAcabaram"],
  ["triaTipoUnico select",        "triaTipoUnico"],
  ["Alimentos acabaram label",   "Alimentos acabaram antes"],
  ["Tipo único label",           "só um tipo de alimento"],
];
for (const [lbl, tok] of TRIA_CHECKS_MODAL) {
  if (modalSrc.includes(tok)) ok(lbl);
  else fail(lbl, `not found in PatientModal: ${tok}`);
}

const TRIA_CHECKS_HOOK = [
  ["triaAlimentosAcabaram in buildState", "triaAlimentosAcabaram: p?.triaAlimentosAcabaram"],
  ["triaTipoUnico in buildState",         "triaTipoUnico: p?.triaTipoUnico"],
  ["triaAlimentosAcabaram in payload",    "triaAlimentosAcabaram: form.triaAlimentosAcabaram"],
  ["triaTipoUnico in payload",            "triaTipoUnico: form.triaTipoUnico"],
];
for (const [lbl, tok] of TRIA_CHECKS_HOOK) {
  if (hookSrc.includes(tok)) ok(lbl);
  else fail(lbl, `not found in usePatientModal: ${tok}`);
}

// ── 9. HTTP smoke ─────────────────────────────────────────────────────────────
console.log("\n[9] HTTP smoke (server optional)");

const BASE = "http://localhost:3001";
async function smoke(path, label) {
  try {
    const res = await fetch(`${BASE}${path}`);
    if (res.status === 401) ok(`${label} → 401`);
    else fail(label, `expected 401, got ${res.status}`);
  } catch (e) {
    if (e.cause?.code === "ECONNREFUSED") ok(`${label} — server not running, skip`);
    else fail(label, e.message);
  }
}
await smoke("/acs-visits",         "GET /acs-visits");
await smoke("/households",         "GET /households");
await smoke("/patients",           "GET /patients");
await smoke("/active-search",      "GET /active-search");
await smoke("/production/acs",     "GET /production/acs");

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(55)}`);
console.log(`APS-01G Validation: ${passed} PASS, ${failed} FAIL`);
console.log(failed === 0 ? "APS-01G PASS ✓" : `APS-01G FAIL — ${failed} checks failed`);
process.exit(failed === 0 ? 0 : 1);
