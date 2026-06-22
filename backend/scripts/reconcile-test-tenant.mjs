/**
 * Idempotent reconciliation: binds all JSON DB records to official test tenant.
 * Safe to run multiple times.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/db.json");

const TEST_UNIT = {
  id: "test-unit",
  name: "UBS Teste VITRAS",
  cnes: "0000000",
  municipalityId: "3534401",
  municipalityName: "Ambiente de Teste",
  uf: "SP",
  status: "test",
  contactEmail: null,
  phone: null,
  createdBy: "system",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const TEST_TEAM = {
  id: "test-team",
  name: "Equipe Teste VITRAS",
  unitId: "test-unit",
  ine: "0000000000",
  tipoEquipe: "ESF",
  status: "active",
  managerUserId: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const db = JSON.parse(readFileSync(DB_PATH, "utf8"));
const report = { alreadyOk: {}, reconciled: {} };

function ensureArray(col) {
  if (!Array.isArray(db[col])) db[col] = [];
}

// Ensure collections exist
["units", "teams", "users", "patients", "households", "familyGroups", "acsVisits", "tasks"].forEach(ensureArray);

// ── units ──────────────────────────────────────────────────────────────────
const existingTestUnit = db.units.find(u => u.id === "test-unit");
if (!existingTestUnit) {
  db.units.push(TEST_UNIT);
  report.reconciled.test_unit = "created";
} else {
  // Update fields if incomplete
  const needsUpdate = !existingTestUnit.cnes || !existingTestUnit.municipalityId;
  if (needsUpdate) {
    Object.assign(existingTestUnit, { ...TEST_UNIT, id: "test-unit", createdAt: existingTestUnit.createdAt });
    report.reconciled.test_unit = "updated";
  } else {
    report.alreadyOk.test_unit = true;
  }
}

// ── teams ──────────────────────────────────────────────────────────────────
const existingTestTeam = db.teams.find(t => t.id === "test-team");
if (!existingTestTeam) {
  db.teams.push(TEST_TEAM);
  report.reconciled.test_team = "created";
} else {
  report.alreadyOk.test_team = true;
}

// Reconcile teams pointing to unit-default → test-unit
let teamsReconciled = 0;
db.teams.forEach(t => {
  if (!t.unitId || t.unitId === "unit-default") {
    t.unitId = "test-unit";
    t.updatedAt = new Date().toISOString();
    teamsReconciled++;
  }
});
report.reconciled.teams_unitId = teamsReconciled;

// ── users ──────────────────────────────────────────────────────────────────
let usersReconciled = 0;
db.users.forEach(u => {
  if (!u.unitId || u.unitId === "unit-default") {
    u.unitId = "test-unit";
    u.updatedAt = new Date().toISOString();
    usersReconciled++;
  }
  if (!u.teamId || u.teamId === "team-default") {
    // Only set teamId for non-platform roles
    const platformRoles = ["support_admin", "break_glass_admin", "developer_readonly"];
    if (!platformRoles.includes(u.role)) {
      u.teamId = "test-team";
      u.updatedAt = new Date().toISOString();
    }
  }
});
report.reconciled.users = usersReconciled;

// ── clinical collections ───────────────────────────────────────────────────
["patients", "households", "familyGroups", "acsVisits", "tasks"].forEach(col => {
  let count = 0;
  db[col].forEach(rec => {
    if (!rec.unitId || rec.unitId === "unit-default") {
      rec.unitId = "test-unit";
      count++;
    }
    if ("teamId" in rec && (!rec.teamId || rec.teamId === "team-default")) {
      rec.teamId = "test-team";
      count++;
    }
  });
  if (count > 0) report.reconciled[col] = count;
  else report.alreadyOk[col] = db[col].length;
});

writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");

console.log("\n=== RECONCILIATION REPORT ===");
console.log("Already OK:", report.alreadyOk);
console.log("Reconciled:", report.reconciled);
console.log("=== DONE ===\n");
