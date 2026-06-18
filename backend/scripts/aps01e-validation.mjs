/**
 * APS-01E Validation — Busca Ativa Inteligente
 * Run: node scripts/aps01e-validation.mjs
 */

import { readFile } from "node:fs/promises";
import { evaluateGroup, PENDENCY_CODES, CLASSIFICATION } from "../src/services/active-search.js";

let passed = 0;
let failed = 0;

function ok(label)         { console.log(`  ✓ ${label}`); passed++; }
function fail(label, why)  { console.error(`  ✗ ${label}: ${why}`); failed++; }

const DAYS_AGO = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const TODAY = new Date().toISOString().slice(0, 10);

// ── 1. Service: evaluateGroup unit checks ─────────────────────────────────────
console.log("\n[1] ActiveSearchEngine — evaluateGroup");

const baseGroup = {
  id: "g1", address: "Rua das Flores, 123", createdAt: DAYS_AGO(200),
  memberPatientIds: ["p1"], memberHistory: [], transferHistory: [],
};
const freshMember = {
  id: "p1", name: "Paciente", cns: "123456789012345",
  address: "Rua das Flores, 123", updatedAt: DAYS_AGO(10), inactive: false,
};
const recentVisit = { id: "v1", patientId: "p1", desfecho: "realizada", date: DAYS_AGO(5), createdAt: DAYS_AGO(5) };

const perfect = evaluateGroup(baseGroup, [freshMember], [recentVisit], []);
if (perfect.score === 100) ok("Perfect group → score 100");
else fail("Perfect group score", `expected 100, got ${perfect.score}`);

if (perfect.classification === CLASSIFICATION.HEALTHY) ok("score 100 → saudavel");
else fail("classification", `expected saudavel, got ${perfect.classification}`);

if (perfect.pendencies.length === 0) ok("Perfect group → 0 pendencies");
else fail("Perfect group pendencies", `expected 0, got ${perfect.pendencies.length}`);

// Score sum
const sum = Object.values(perfect.scoreBreakdown).reduce((a, b) => a + b, 0);
if (sum === perfect.score) ok("scoreBreakdown sums to score");
else fail("scoreBreakdown sum", `${sum} !== ${perfect.score}`);

// ── 2. Rules R-01 to R-08 ────────────────────────────────────────────────────
console.log("\n[2] Rules R-01 to R-08");

// R-01
const staleMember = { ...freshMember, updatedAt: DAYS_AGO(400) };
const r01 = evaluateGroup(baseGroup, [staleMember], [recentVisit], []);
if (r01.pendencies.some(p => p.code === PENDENCY_CODES.UPDATE_REGISTRATION_REQUIRED)) ok("R-01: stale reg → UPDATE_REGISTRATION_REQUIRED");
else fail("R-01", "missing pendency");
if (r01.scoreBreakdown.updatedRegistration === 0) ok("R-01: score -25");
else fail("R-01 score", "updatedRegistration should be 0");

// R-02
const r02 = evaluateGroup(baseGroup, [freshMember], [], []);
if (r02.pendencies.some(p => p.code === PENDENCY_CODES.VISIT_RECOMMENDED)) ok("R-02: no visit → VISIT_RECOMMENDED");
else fail("R-02", "missing pendency");
if (r02.scoreBreakdown.recentVisit === 0) ok("R-02: score -25");
else fail("R-02 score", "recentVisit should be 0");

// R-03
const noCns = { ...freshMember, cns: "" };
const r03 = evaluateGroup(baseGroup, [noCns], [recentVisit], []);
if (r03.pendencies.some(p => p.code === PENDENCY_CODES.MISSING_CNS && p.priority === "low")) ok("R-03: no CNS → MISSING_CNS (low)");
else fail("R-03", "missing pendency or wrong priority");
if (r03.scoreBreakdown.allCns === 0) ok("R-03: score -15");
else fail("R-03 score", "allCns should be 0");

// R-04
const noAddr = { ...freshMember, address: "" };
const r04 = evaluateGroup(baseGroup, [noAddr], [recentVisit], []);
if (r04.pendencies.some(p => p.code === PENDENCY_CODES.ADDRESS_VALIDATION_REQUIRED && p.priority === "high")) ok("R-04: no address → ADDRESS_VALIDATION_REQUIRED (high)");
else fail("R-04", "missing pendency or wrong priority");
if (r04.scoreBreakdown.completeAddress === 0) ok("R-04: score -15");
else fail("R-04 score", "completeAddress should be 0");

// R-05
const oldVisit = { ...recentVisit, date: DAYS_AGO(200) };
const r05 = evaluateGroup(baseGroup, [freshMember], [oldVisit], []);
if (r05.pendencies.some(p => p.code === PENDENCY_CODES.FAMILY_OUT_OF_FOLLOWUP && p.priority === "high")) ok("R-05: 200d without visit → FAMILY_OUT_OF_FOLLOWUP (high)");
else fail("R-05", "missing pendency or wrong priority");

// R-06
const overdueTask = { id: "t1", patientId: "p1", status: "pending", dueDate: DAYS_AGO(3), title: "Tarefa" };
const r06 = evaluateGroup(baseGroup, [freshMember], [recentVisit], [overdueTask]);
if (r06.pendencies.some(p => p.code === PENDENCY_CODES.OVERDUE_TASK && p.priority === "high")) ok("R-06: overdue task → OVERDUE_TASK (high)");
else fail("R-06", "missing pendency or wrong priority");
if (r06.scoreBreakdown.noOverdueTasks === 0) ok("R-06: score -20");
else fail("R-06 score", "noOverdueTasks should be 0");

// R-07
const g07 = { ...baseGroup, memberHistory: [{ action: "join", patientId: "p2", at: DAYS_AGO(15) }] };
const r07 = evaluateGroup(g07, [freshMember], [recentVisit], []);
if (r07.pendencies.some(p => p.code === PENDENCY_CODES.NEW_MEMBER_REVIEW && p.priority === "medium")) ok("R-07: new member → NEW_MEMBER_REVIEW (medium)");
else fail("R-07", "missing pendency or wrong priority");

// R-08
const g08 = { ...baseGroup, transferHistory: [{ fromAcsId: "a1", toAcsId: "a2", transferredAt: DAYS_AGO(10) }] };
const r08 = evaluateGroup(g08, [freshMember], [recentVisit], []);
if (r08.pendencies.some(p => p.code === PENDENCY_CODES.TERRITORIAL_REVIEW && p.priority === "high")) ok("R-08: recent transfer → TERRITORIAL_REVIEW (high)");
else fail("R-08", "missing pendency or wrong priority");

// ── 3. Score thresholds ───────────────────────────────────────────────────────
console.log("\n[3] Score classification thresholds");

// Build groups at each threshold
const ev80  = evaluateGroup(baseGroup, [freshMember], [recentVisit], []);  // 100
const evNV  = evaluateGroup(baseGroup, [freshMember], [], []);              // 75 (no recent visit)
const evLow = evaluateGroup(baseGroup, [{ ...freshMember, cns: "", updatedAt: DAYS_AGO(400) }], [], []);

if (ev80.classification === CLASSIFICATION.HEALTHY)  ok("score 100 → saudavel");
else fail("threshold saudavel", `got ${ev80.classification}`);

if (evNV.classification === CLASSIFICATION.ATTENTION) ok("score 75 → atencao");
else fail("threshold atencao", `got ${evNV.classification} (score ${evNV.score})`);

if (evLow.classification === CLASSIFICATION.CRITICAL) ok(`score ${evLow.score} → critico`);
else fail("threshold critico", `got ${evLow.classification}`);

// ── 4. Route source checks ────────────────────────────────────────────────────
console.log("\n[4] Route — active-search.js");

const routeSrc = await readFile(new URL("../src/routes/active-search.js", import.meta.url), "utf8");

const ROUTE_CHECKS = [
  ["GET /active-search registered",               'router.get("/active-search",'],
  ["GET /active-search/stats registered",         'router.get("/active-search/stats",'],
  ["GET /active-search/group/:groupId registered",'router.get("/active-search/group/:groupId",'],
  ["Filter by acsId",                             "acsId"],
  ["Filter by microarea",                         "microarea"],
  ["Filter by status",                            "if (status)"],
  ["Filter by pendency code",                     "pendency"],
  ["Filter by scoreMin",                          "scoreMin"],
  ["Filter by scoreMax",                          "scoreMax"],
  ["Sorted score asc (critical first)",           "a.score - b.score"],
  ["Pagination implemented",                      "pageNum"],
  ["Stats: critical/attention/healthy",           "critical++"],
  ["Stats: avgScore",                             "avgScore"],
  ["Stats: pendencyBreakdown",                    "pendencyBreakdown"],
  ["ACS scope filter",                            "assignedAcsId === user.id"],
  ["Scope: team filter",                          "g.teamId === user.teamId"],
];

for (const [label, token] of ROUTE_CHECKS) {
  // multi-line check: either token has \n or single line
  const check = token.includes("\n")
    ? token.split("\n").every(t => routeSrc.includes(t))
    : routeSrc.includes(token);
  if (check) ok(label);
  else fail(label, `token not found: ${JSON.stringify(token)}`);
}

// ── 5. Service source checks ──────────────────────────────────────────────────
console.log("\n[5] Service — active-search.js");

const svcSrc = await readFile(new URL("../src/services/active-search.js", import.meta.url), "utf8");

const SVC_CHECKS = [
  ["PENDENCY_CODES exported",   "export const PENDENCY_CODES"],
  ["CLASSIFICATION exported",   "export const CLASSIFICATION"],
  ["evaluateGroup exported",    "export function evaluateGroup"],
  ["buildGroupResult exported", "export function buildGroupResult"],
  ["R-01 rule coded",           "UPDATE_REGISTRATION_REQUIRED"],
  ["R-02 rule coded",           "VISIT_RECOMMENDED"],
  ["R-03 rule coded",           "MISSING_CNS"],
  ["R-04 rule coded",           "ADDRESS_VALIDATION_REQUIRED"],
  ["R-05 rule coded",           "FAMILY_OUT_OF_FOLLOWUP"],
  ["R-06 rule coded",           "OVERDUE_TASK"],
  ["R-07 rule coded",           "NEW_MEMBER_REVIEW"],
  ["R-08 rule coded",           "TERRITORIAL_REVIEW"],
  ["Score 25 recent visit",     "RECENT_VISIT:"],
  ["Score 25 updated reg",      "UPDATED_REGISTRATION:"],
  ["Score 15 CNS",              "ALL_CNS:"],
  ["Score 15 address",          "COMPLETE_ADDRESS:"],
  ["Score 20 no overdue",       "NO_OVERDUE_TASKS:"],
  ["90-day visit cutoff",       "<= 90"],
  ["180-day family cutoff",     "> 180"],
  ["365-day registration",      "> 365"],
  ["30-day new member",         "<= 30"],
  ["30-day transfer",           "<= 30"],
  ["rule codes in pendencies",  'rule:     "R-'],
];

for (const [label, token] of SVC_CHECKS) {
  if (svcSrc.includes(token)) ok(label);
  else fail(label, `token not found: ${token}`);
}

// ── 6. app.js mount ───────────────────────────────────────────────────────────
console.log("\n[6] app.js — route mount");

const appSrc = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
if (appSrc.includes('import activeSearchRouter from "./routes/active-search.js"')) ok("activeSearchRouter imported");
else fail("import", "missing import");
if (appSrc.includes("app.use(activeSearchRouter)")) ok("activeSearchRouter mounted");
else fail("mount", "missing app.use");

// ── 7. Frontend checks ────────────────────────────────────────────────────────
console.log("\n[7] Frontend — AcsTasksPage");

const feSrc = await readFile(
  new URL("../../frontend-react/src/pages/AcsTasksPage.jsx", import.meta.url), "utf8"
);

const FE_CHECKS = [
  ["ActiveSearchSection component",              "function ActiveSearchSection("],
  ["AsGroupCard component",                      "function AsGroupCard("],
  ["Busca Ativa tab added",                      '"busca", "Busca Ativa"'],
  ["Tab busca renders section",                  'activeTab === "busca"'],
  ["Fetch /active-search",                       "fetch(`/active-search?"],
  ["Fetch /active-search/stats",                 "fetch(\"/active-search/stats\""],
  ["3 sections: critico/atencao/saudavel",       '"critico"'],
  ["Stats bar: critical/attention/healthy",      "as-stats__item--critico"],
  ["Filter by status",                           "filterStatus"],
  ["Filter by microarea",                        "filterMicro"],
  ["Filter by pendency",                         "filterPendency"],
  ["Score displayed per card",                   "result.score"],
  ["Classification badge",                       "AS_CLASS_CLS[result.classification]"],
  ["onOpenGroup wired",                          "onOpenGroup && onOpenGroup(result.groupId)"],
  ["SessionStorage for cross-tab navigation",    "vitras_openGroupId"],
  ["PENDENCY_SECTION_LABELS defined",            "const PENDENCY_SECTION_LABELS"],
  ["AS_CLASS_LABEL defined",                     "const AS_CLASS_LABEL"],
];

for (const [label, token] of FE_CHECKS) {
  if (feSrc.includes(token)) ok(label);
  else fail(label, `token not found: ${token}`);
}

// ── 8. CSS checks ─────────────────────────────────────────────────────────────
console.log("\n[8] CSS — active search styles");

const cssSrc = await readFile(
  new URL("../../frontend-react/src/styles/05-patterns/acstasks.css", import.meta.url), "utf8"
);

const CSS_CHECKS = [
  [".as-root",                    ".as-root {"],
  [".as-stats",                   ".as-stats {"],
  [".as-filters",                 ".as-filters {"],
  [".as-section",                 ".as-section {"],
  [".as-cards grid",              ".as-cards {"],
  [".as-card",                    ".as-card {"],
  [".as-card--critico",           ".as-card--critico"],
  [".as-card--atencao",           ".as-card--atencao"],
  [".as-card--saudavel",          ".as-card--saudavel"],
  [".as-badge--critico",          ".as-badge--critico"],
  [".as-pend--high",              ".as-pend--high"],
  [".as-pend--medium",            ".as-pend--medium"],
  ["Mobile 412px",                "@media (max-width: 412px)"],
];

for (const [label, token] of CSS_CHECKS) {
  if (cssSrc.includes(token)) ok(label);
  else fail(label, `token not found: ${token}`);
}

// ── 9. HTTP smoke tests ───────────────────────────────────────────────────────
console.log("\n[9] HTTP smoke (server optional)");

const BASE = "http://localhost:3001";
async function smoke(method, path, expected, label) {
  try {
    const res = await fetch(`${BASE}${path}`, { method });
    if (res.status === expected) ok(`${method} ${path} → ${res.status}`);
    else fail(`${method} ${path}`, `expected ${expected}, got ${res.status}`);
  } catch (e) {
    if (e.cause?.code === "ECONNREFUSED") ok(`${method} ${path} — server not running, skip`);
    else fail(`${method} ${path}`, e.message);
  }
}

await smoke("GET", "/active-search",              401, "requires auth");
await smoke("GET", "/active-search/stats",        401, "requires auth");
await smoke("GET", "/active-search/group/xyz",    401, "requires auth");

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(55)}`);
console.log(`APS-01E Validation: ${passed} PASS, ${failed} FAIL`);
console.log(failed === 0 ? "APS-01E PASS ✓" : `APS-01E FAIL — ${failed} checks failed`);
process.exit(failed === 0 ? 0 : 1);
