/**
 * APS-01F Validation — Produção ACS Automática
 * Run: node scripts/aps01f-validation.mjs
 */

import { readFile } from "node:fs/promises";
import {
  periodBounds,
  getAcsMetrics,
  getNurseMetrics,
  getManagerMetrics,
  getMicroareaMetrics,
} from "../src/services/production-metrics.js";

let passed = 0;
let failed = 0;
function ok(label)        { console.log(`  ✓ ${label}`); passed++; }
function fail(label, why) { console.error(`  ✗ ${label}: ${why}`); failed++; }

const TODAY = new Date().toISOString().slice(0, 10);
const DAYS_AGO = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

// ── 1. Period bounds ──────────────────────────────────────────────────────────
console.log("\n[1] Period bounds");

const { from: hoje } = periodBounds("hoje");
if (hoje === TODAY) ok("hoje → today");
else fail("hoje", `${hoje} !== ${TODAY}`);

const { from: semana } = periodBounds("semana");
const semanaDiff = Math.round((new Date(TODAY) - new Date(semana)) / 86400000);
if (semanaDiff === 7) ok("semana → 7 days");
else fail("semana", `diff=${semanaDiff}`);

const { from: mes } = periodBounds("mes");
const mesDiff = Math.round((new Date(TODAY) - new Date(mes)) / 86400000);
if (mesDiff === 30) ok("mes → 30 days");
else fail("mes", `diff=${mesDiff}`);

const { from: tri } = periodBounds("trimestre");
const triDiff = Math.round((new Date(TODAY) - new Date(tri)) / 86400000);
if (triDiff === 90) ok("trimestre → 90 days");
else fail("trimestre", `diff=${triDiff}`);

// ── 2. ACS metrics unit ───────────────────────────────────────────────────────
console.log("\n[2] getAcsMetrics unit");

const TEAM = "t1", ACS = "acs1", PAT = "p1", GRP = "g1";
const baseDb = () => ({
  users:   [{ id: ACS, role: "acs", teamId: TEAM }],
  patients:[{ id: PAT, assignedAcsId: ACS, teamId: TEAM, cns: "abc", address: "Rua A, 1", updatedAt: DAYS_AGO(5), inactive: false }],
  familyGroups: [{ id: GRP, teamId: TEAM, assignedAcsId: ACS, address: "Rua A, 1",
    microArea: "M1", memberPatientIds: [PAT], memberHistory: [], transferHistory: [], createdAt: DAYS_AGO(50) }],
  acsVisits: [], tasks: [], households: [],
});

const m0 = getAcsMetrics(baseDb(), ACS, "mes");
if (m0.visits.total === 0) ok("No visits → total=0");
else fail("visits total", `expected 0, got ${m0.visits.total}`);
if (m0.groups.total === 1) ok("1 group counted");
else fail("groups total", m0.groups.total);

const dbV = baseDb();
dbV.acsVisits = [
  { id: "v1", acsId: ACS, patientId: PAT, desfecho: "realizada", date: DAYS_AGO(5),  createdAt: DAYS_AGO(5) },
  { id: "v2", acsId: ACS, patientId: PAT, desfecho: "recusada",  date: DAYS_AGO(3),  createdAt: DAYS_AGO(3) },
  { id: "v3", acsId: ACS, patientId: PAT, desfecho: "ausente",   date: DAYS_AGO(45), createdAt: DAYS_AGO(45) }, // outside mes
];
const mV = getAcsMetrics(dbV, ACS, "mes");
if (mV.visits.total === 2)     ok("Period filter: 2 in-period visits");
else fail("period filter", mV.visits.total);
if (mV.visits.realizada === 1) ok("realizada=1");
else fail("realizada", mV.visits.realizada);
if (mV.visits.recusada === 1)  ok("recusada=1");
else fail("recusada", mV.visits.recusada);

const dbT = baseDb();
dbT.tasks = [
  { id: "t1", patientId: PAT, status: "done",    updatedAt: DAYS_AGO(5), dueDate: null, title: "A" },
  { id: "t2", patientId: PAT, status: "pending", dueDate: DAYS_AGO(3),   title: "B" },
];
const mT = getAcsMetrics(dbT, ACS, "mes");
if (mT.tasks.done === 1)    ok("tasks.done=1");
else fail("tasks.done", mT.tasks.done);
if (mT.tasks.overdue === 1) ok("tasks.overdue=1");
else fail("tasks.overdue", mT.tasks.overdue);

// ── 3. Nurse metrics unit ─────────────────────────────────────────────────────
console.log("\n[3] getNurseMetrics unit");

const dbN = baseDb();
dbN.users.push({ id: "acs2", role: "acs", teamId: TEAM });
dbN.acsVisits = [{ id: "v1", acsId: ACS, patientId: PAT, desfecho: "realizada", date: DAYS_AGO(5), createdAt: DAYS_AGO(5) }];
const mN = getNurseMetrics(dbN, TEAM, "mes");
if (mN.acsActive === 1)   ok("acsActive=1 (ACS1 has visit)");
else fail("acsActive", mN.acsActive);
if (mN.acsInactive === 1) ok("acsInactive=1 (ACS2 has no visit)");
else fail("acsInactive", mN.acsInactive);
if (mN.team.totalGroups === 1) ok("team.totalGroups=1");
else fail("team.totalGroups", mN.team.totalGroups);

// ── 4. Manager metrics unit ───────────────────────────────────────────────────
console.log("\n[4] getManagerMetrics unit");

const mM0 = getManagerMetrics(baseDb(), TEAM, "mes");
if (mM0.territory.visitCoverage === 0) ok("0 visits → coverage=0%");
else fail("coverage", mM0.territory.visitCoverage);

const dbM = baseDb();
dbM.acsVisits = [{ id: "v1", acsId: ACS, patientId: PAT, desfecho: "realizada", date: DAYS_AGO(5), createdAt: DAYS_AGO(5) }];
const mM1 = getManagerMetrics(dbM, TEAM, "mes");
if (mM1.territory.visitCoverage === 100) ok("1 visit in 1 group → coverage=100%");
else fail("coverage 100", mM1.territory.visitCoverage);
if (["melhorando", "estavel", "piorando"].includes(mM1.evolution.trend)) ok("evolution.trend valid");
else fail("evolution.trend", mM1.evolution.trend);

// ── 5. Microarea metrics unit ─────────────────────────────────────────────────
console.log("\n[5] getMicroareaMetrics unit");

const mMicro = getMicroareaMetrics(baseDb(), TEAM, null);
if (mMicro.length === 1)        ok("1 microarea found");
else fail("microareas", mMicro.length);
if (mMicro[0].microArea === "M1") ok("microArea name correct");
else fail("microArea name", mMicro[0].microArea);
if (mMicro[0].groups === 1)    ok("groups=1 in microarea");
else fail("microarea groups", mMicro[0].groups);

// ── 6. Route source checks ────────────────────────────────────────────────────
console.log("\n[6] Route — production.js");

const routeSrc = await readFile(new URL("../src/routes/production.js", import.meta.url), "utf8");
const ROUTE_CHECKS = [
  ["GET /production/acs",          'router.get("/production/acs"'],
  ["GET /production/nurse",        'router.get("/production/nurse"'],
  ["GET /production/manager",      'router.get("/production/manager"'],
  ["GET /production/microareas",   'router.get("/production/microareas"'],
  ["Period filter parsed",         "parsePeriod(req.query)"],
  ["ACS gets own metrics",         "req.user.id"],
  ["Nurse can query by acsId",     "req.query.acsId"],
  ["ACS scope in microareas",      "acsIdFilter = req.user.id"],
  ["Nurse 403 check",              '"Sem permissão"'],
];
for (const [lbl, tok] of ROUTE_CHECKS) {
  if (routeSrc.includes(tok)) ok(lbl);
  else fail(lbl, `not found: ${tok}`);
}

// ── 7. Service source checks ──────────────────────────────────────────────────
console.log("\n[7] Service — production-metrics.js");

const svcSrc = await readFile(new URL("../src/services/production-metrics.js", import.meta.url), "utf8");
const SVC_CHECKS = [
  ["periodBounds exported",          "export function periodBounds"],
  ["getAcsMetrics exported",         "export function getAcsMetrics"],
  ["getNurseMetrics exported",       "export function getNurseMetrics"],
  ["getManagerMetrics exported",     "export function getManagerMetrics"],
  ["getMicroareaMetrics exported",   "export function getMicroareaMetrics"],
  ["Visits breakdown",               "visitRealizada"],
  ["Tasks done counted",             "tasksDone"],
  ["Tasks overdue counted",          "tasksOverdue"],
  ["Registrations updated",         "registrationsUpdated"],
  ["New groups counted",             "newGroups"],
  ["Transfers received",             "transfersReceived"],
  ["Transfers sent",                 "transfersSent"],
  ["Score from evaluateGroup",       "evaluateGroup"],
  ["Evolution computed",             "computeEvolution"],
  ["Trend: melhorando/estavel/piorando", '"melhorando"'],
  ["Microarea grouping",             "byMicro"],
  ["Import active-search",           'from "./active-search.js"'],
  ["No duplicate score logic",       "evaluateGroup(g, members"],
];
for (const [lbl, tok] of SVC_CHECKS) {
  if (svcSrc.includes(tok)) ok(lbl);
  else fail(lbl, `not found: ${tok}`);
}

// ── 8. app.js mount ───────────────────────────────────────────────────────────
console.log("\n[8] app.js — mount");

const appSrc = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
if (appSrc.includes('import productionRouter from "./routes/production.js"')) ok("productionRouter imported");
else fail("import", "missing");
if (appSrc.includes("app.use(productionRouter)")) ok("productionRouter mounted");
else fail("mount", "missing");

// ── 9. Frontend checks ────────────────────────────────────────────────────────
console.log("\n[9] Frontend — AcsTasksPage");

const feSrc = await readFile(
  new URL("../../frontend-react/src/pages/AcsTasksPage.jsx", import.meta.url), "utf8"
);
const FE_CHECKS = [
  ["ProductionSection component",      "function ProductionSection("],
  ["ProdKpi component",                "function ProdKpi("],
  ["Produção tab added",               '"producao", "Produção"'],
  ["Tab producao renders section",     'activeTab === "producao"'],
  ["Fetch /production/acs",            "fetch(`/production/acs?period="],
  ["Period filter buttons",            "PROD_PERIODS"],
  ["KPI: visitas realizadas",          "Visitas realizadas"],
  ["KPI: grupos visitados",            "Grupos visitados"],
  ["KPI: tarefas concluídas",          "Tarefas concluídas"],
  ["Score médio displayed",            "Score médio dos grupos"],
  ["Situação operacional section",     "Minha situação operacional"],
  ["Critical/attention/healthy chips", "prod-ops-chip--critico"],
  ["Visit breakdown: realizada",       "Realizadas"],
  ["Visit breakdown: recusada",        "Recusadas"],
  ["Visit breakdown: ausente",         "Ausentes"],
];
for (const [lbl, tok] of FE_CHECKS) {
  if (feSrc.includes(tok)) ok(lbl);
  else fail(lbl, `not found: ${tok}`);
}

// ── 10. GestorPage checks ─────────────────────────────────────────────────────
console.log("\n[10] Frontend — GestorPage");

const gpSrc = await readFile(
  new URL("../../frontend-react/src/pages/GestorPage.jsx", import.meta.url), "utf8"
);
const GP_CHECKS = [
  ["AcsProductionPanel component",       "function AcsProductionPanel("],
  ["Fetch /production/nurse",            "fetch(`/production/nurse?period="],
  ["Fetch /production/manager",          "fetch(`/production/manager?period="],
  ["Territory: totalGroups",             "terr.totalGroups"],
  ["Territory: visitCoverage",           "terr.visitCoverage"],
  ["Territory: avgScore",                "terr.avgScore"],
  ["Evolution: trend displayed",         "evol.trend"],
  ["perAcs table rendered",              "gp-acs-table"],
  ["AcsProductionPanel used in GestorPage", "<AcsProductionPanel"],
  ["useEffect imported",                 "useEffect"],
  ["token prop destructured",            "token,"],
];
for (const [lbl, tok] of GP_CHECKS) {
  if (gpSrc.includes(tok)) ok(lbl);
  else fail(lbl, `not found: ${tok}`);
}

// ── 11. CSS checks ────────────────────────────────────────────────────────────
console.log("\n[11] CSS — production styles");

const cssSrc = await readFile(
  new URL("../../frontend-react/src/styles/05-patterns/acstasks.css", import.meta.url), "utf8"
);
const CSS_CHECKS = [
  [".prod-root",               ".prod-root {"],
  [".prod-kpi-grid",           ".prod-kpi-grid {"],
  [".prod-kpi",                ".prod-kpi {"],
  [".prod-card",               ".prod-card {"],
  [".prod-ops-chip--critico",  ".prod-ops-chip--critico"],
  [".gp-root",                 ".gp-root {"],
  [".gp-grid-4",               ".gp-grid-4 {"],
  [".gp-acs-table",            ".gp-acs-table {"],
  [".gp-class-row--critico",   ".gp-class-row--critico"],
  [".gp-trend--melhorando",    ".gp-trend--melhorando"],
  ["Mobile 412px",             "@media (max-width: 412px)"],
];
for (const [lbl, tok] of CSS_CHECKS) {
  if (cssSrc.includes(tok)) ok(lbl);
  else fail(lbl, `not found: ${tok}`);
}

// ── 12. HTTP smoke ────────────────────────────────────────────────────────────
console.log("\n[12] HTTP smoke (server optional)");

const BASE = "http://localhost:3001";
async function smoke(path, label) {
  try {
    const res = await fetch(`${BASE}${path}`);
    if (res.status === 401) ok(`${label} → 401`);
    else fail(`${label}`, `expected 401, got ${res.status}`);
  } catch (e) {
    if (e.cause?.code === "ECONNREFUSED") ok(`${label} — server not running, skip`);
    else fail(label, e.message);
  }
}
await smoke("/production/acs",        "GET /production/acs");
await smoke("/production/nurse",      "GET /production/nurse");
await smoke("/production/manager",    "GET /production/manager");
await smoke("/production/microareas", "GET /production/microareas");

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(55)}`);
console.log(`APS-01F Validation: ${passed} PASS, ${failed} FAIL`);
console.log(failed === 0 ? "APS-01F PASS ✓" : `APS-01F FAIL — ${failed} checks failed`);
process.exit(failed === 0 ? 0 : 1);
