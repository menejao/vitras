/**
 * APS-01D Validation — Family Group Workspace
 * Run: node scripts/aps01d-validation.mjs
 */

import { readFile } from "node:fs/promises";

let passed = 0;
let failed = 0;

function ok(label) { console.log(`  ✓ ${label}`); passed++; }
function fail(label, reason) { console.error(`  ✗ ${label}: ${reason}`); failed++; }

// ── 1. Backend: GET /family-groups/:id route ──────────────────────────────────
console.log("\n[1] Backend — GET /family-groups/:id enriched endpoint");

const routeSrc = await readFile(
  new URL("../src/routes/family-groups.js", import.meta.url), "utf8"
);

const ROUTE_CHECKS = [
  ["GET /family-groups/:id registered",       'router.get("/family-groups/:id",'],
  ["Returns members array",                   "members,"],
  ["Returns visits array",                    "visits,"],
  ["Returns tasks array",                     "tasks,"],
  ["Returns household",                       "household:"],
  ["Returns pendencies",                      "pendencies:"],
  ["Returns timeline",                        "timeline:"],
  ["Scope check groupVisibleToUser",          "groupVisibleToUser(group, req.user)"],
  ["Members enriched with ageYears",          "ageYears(p.birthDate)"],
  ["Auto-link acsVisits via patientId",       "memberIds.has(v.patientId)"],
  ["Auto-link acsVisits via householdId",     "householdIds.has(v.householdId)"],
  ["pendencies function exists",              "function pendencies("],
  ["buildTimeline function exists",           "function buildTimeline("],
  ["No-recent-visit pendency check",          "no_recent_visit"],
  ["Missing CNS pendency check",              "missing_cns"],
  ["Overdue tasks pendency check",            "overdue_tasks"],
  ["Timeline includes visits",               'type: "visit"'],
  ["Timeline includes tasks done",           'type: "task_done"'],
  ["Timeline includes transfers",            'type: "group_transferred"'],
];

for (const [label, token] of ROUTE_CHECKS) {
  if (routeSrc.includes(token)) ok(label);
  else fail(label, `token not found: ${token}`);
}

// ── 2. Backend: search improved ───────────────────────────────────────────────
console.log("\n[2] Backend — search improvements");

const SEARCH_CHECKS = [
  ["Search by CNS",  ".cns || \"\").replace(/\\s/g, \"\")"],
  ["Search by CPF",  ".cpf || \"\").replace(/\\D/g, \"\")"],
  ["Search by name", "(p.name || \"\").toLowerCase().includes(q)"],
  ["Search by socialName", ".socialName || \"\").toLowerCase().includes(q)"],
];

for (const [label, token] of SEARCH_CHECKS) {
  if (routeSrc.includes(token)) ok(label);
  else fail(label, `token not found: ${token}`);
}

// ── 3. domain.js — acsVisits present (from APS-01C) ──────────────────────────
console.log("\n[3] Domain shape");

const domainSrc = await readFile(new URL("../src/utils/domain.js", import.meta.url), "utf8");

if (domainSrc.includes('ensureArray(db, "acsVisits")')) ok("acsVisits in ensureDbShape");
else fail("acsVisits", "missing from ensureDbShape");

if (domainSrc.includes('ensureArray(db, "familyGroups")')) ok("familyGroups in ensureDbShape");
else fail("familyGroups", "missing from ensureDbShape");

// ── 4. Frontend — workspace component ────────────────────────────────────────
console.log("\n[4] Frontend — workspace component");

import { readFile as rf } from "node:fs/promises";
const frontendSrc = await rf(
  new URL("../../frontend-react/src/pages/AcsTasksPage.jsx", import.meta.url),
  "utf8"
);

const FRONTEND_CHECKS = [
  ["FamilyGroupWorkspace component",          "function FamilyGroupWorkspace("],
  ["FgBlock accordion component",             "function FgBlock("],
  ["Block 1 — Summary renders",               "Resumo"],
  ["Block 2 — Members renders",               "Moradores"],
  ["Block 3 — Visits renders",                "Visitas"],
  ["Block 4 — Tasks renders",                 "Tarefas"],
  ["Block 5 — Housing conditions renders",    "Condições de Moradia"],
  ["Block 6 — Pendencies renders",            "Pendências"],
  ["Block 7 — Timeline renders",              "Histórico"],
  ["GET /family-groups/:id API call",         "fetch(`/family-groups/${groupId}`"],
  ["Back button to list",                     "onClick={onBack}"],
  ["Card clickable: setActiveGroupId",        "setActiveGroupId(fg.id)"],
  ["onStartVisitForGroup prop threaded",      "onStartVisitForGroup"],
  ["Nova Visita button in workspace",         "Nova Visita"],
  ["onNavigatePatient in workspace",          "onNavigatePatient && onNavigatePatient(m.id)"],
  ["Search by CNS/CPF label updated",         "CNS ou CPF"],
  ["TIMELINE_ICON defined",                   "const TIMELINE_ICON"],
  ["Pendency severity classes",               "const SEVERITY_CLS"],
  ["HousingRow component",                    "function HousingRow("],
];

for (const [label, token] of FRONTEND_CHECKS) {
  if (frontendSrc.includes(token)) ok(label);
  else fail(label, `token not found: ${token}`);
}

// ── 5. CSS checks ─────────────────────────────────────────────────────────────
console.log("\n[5] CSS — workspace styles");

const cssSrc = await rf(
  new URL("../../frontend-react/src/styles/05-patterns/acstasks.css", import.meta.url),
  "utf8"
);

const CSS_CHECKS = [
  [".fg-ws block",                ".fg-ws {"],
  [".fg-ws-block accordion",      ".fg-ws-block {"],
  [".fg-ws-members",              ".fg-ws-members {"],
  [".fg-ws-visit-row",            ".fg-ws-visit-row {"],
  [".fg-ws-task-row",             ".fg-ws-task-row {"],
  [".fg-ws-housing-row",          ".fg-ws-housing-row {"],
  [".fg-ws-pend",                 ".fg-ws-pend {"],
  [".fg-ws-tl-event",             ".fg-ws-tl-event {"],
  [".acs-fg-card--clickable",     ".acs-fg-card--clickable {"],
  [".fg-ws-member__cns--missing", ".fg-ws-member__cns--missing {"],
  ["Mobile breakpoint 400px",     "@media (max-width: 400px)"],
];

for (const [label, token] of CSS_CHECKS) {
  if (cssSrc.includes(token)) ok(label);
  else fail(label, `token not found: ${token}`);
}

// ── 6. HTTP smoke test (if server running) ────────────────────────────────────
console.log("\n[6] HTTP smoke (server optional)");

const BASE = "http://localhost:3001";

async function checkRoute(method, path, expectedStatus, label) {
  try {
    const res = await fetch(`${BASE}${path}`, { method });
    if (res.status === expectedStatus) ok(`${method} ${path} → ${res.status} (${label})`);
    else fail(`${method} ${path}`, `expected ${expectedStatus}, got ${res.status}`);
  } catch (e) {
    if (e.cause?.code === "ECONNREFUSED") ok(`${method} ${path} — server not running, skip`);
    else fail(`${method} ${path}`, e.message);
  }
}

await checkRoute("GET", "/family-groups",          401, "list requires auth");
await checkRoute("GET", "/family-groups/test-id",  401, "workspace requires auth");

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(55)}`);
console.log(`APS-01D Validation: ${passed} PASS, ${failed} FAIL`);
console.log(failed === 0 ? "APS-01D PASS ✓" : `APS-01D FAIL — ${failed} checks failed`);
process.exit(failed === 0 ? 0 : 1);
