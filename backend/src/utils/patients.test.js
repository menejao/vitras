/**
 * Testes unitarios de canAccessPatient — US-204 (modo read/write)
 *
 * Framework: node:assert/strict (runner proprio, sem dependencias externas)
 * Executar: node src/utils/patients.test.js
 */
import assert from "node:assert/strict";
import { canAccessPatient } from "./patients.js";

function run(name, fn) {
  try {
    fn();
    console.log(`OK: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(`  ${err.message}`);
    process.exitCode = 1;
  }
}

const makeUser = (role, teamId, municipalityId) => ({ role, teamId, municipalityId, id: "u1" });
const makePatient = (teamId, municipalityId) => ({ teamId, municipalityId, id: "p1" });

// ── WRITE mode (comportamento original — nenhuma regressao) ───────────────────

run("write-same-team: doctor mesmo teamId retorna true", () => {
  assert.equal(
    canAccessPatient(makeUser("doctor", "team-a", "3534401"), makePatient("team-a", "3534401"), "write"),
    true
  );
});

run("write-cross-team: doctor teamId diferente retorna false (sem regressao cross-UBS)", () => {
  assert.equal(
    canAccessPatient(makeUser("doctor", "team-a", "3534401"), makePatient("team-b", "3534401"), "write"),
    false
  );
});

// ── READ mode — casos principais ──────────────────────────────────────────────

run("read-same-team: doctor mesmo teamId retorna true", () => {
  assert.equal(
    canAccessPatient(makeUser("doctor", "team-a", "3534401"), makePatient("team-a", "3534401"), "read"),
    true
  );
});

run("read-cross-UBS-same-municipality: doctor teamId diferente mesmo municipio retorna true", () => {
  assert.equal(
    canAccessPatient(makeUser("doctor", "team-a", "3534401"), makePatient("team-b", "3534401"), "read"),
    true
  );
});

run("read-cross-municipality: doctor municipio diferente retorna false", () => {
  assert.equal(
    canAccessPatient(makeUser("doctor", "team-a", "3534401"), makePatient("team-b", "9999999"), "read"),
    false
  );
});

run("read-no-municipalityId-fallback-same-team: paciente sem municipalityId mesmo teamId retorna true", () => {
  assert.equal(
    canAccessPatient(makeUser("doctor", "team-a", "3534401"), makePatient("team-a", undefined), "read"),
    true
  );
});

run("read-no-municipalityId-fallback-cross-team: paciente sem municipalityId teamId diferente retorna false", () => {
  assert.equal(
    canAccessPatient(makeUser("doctor", "team-a", "3534401"), makePatient("team-b", undefined), "read"),
    false
  );
});

// ── Caso 8: ACS cross-UBS (role nao-clinica nao pode ler cross-UBS) ───────────

run("read-acs-cross-UBS: ACS nao-clinico retorna false mesmo mesmo municipio", () => {
  assert.equal(
    canAccessPatient(makeUser("acs", "team-a", "3534401"), makePatient("team-b", "3534401"), "read"),
    false
  );
});

// ── break_glass_admin ─────────────────────────────────────────────────────────

run("break_glass-read: break_glass_admin retorna true em qualquer municipio", () => {
  assert.equal(
    canAccessPatient(makeUser("break_glass_admin", "team-z", "0000000"), makePatient("team-b", "9999999"), "read"),
    true
  );
});

run("break_glass-write: break_glass_admin retorna true em modo write", () => {
  assert.equal(
    canAccessPatient(makeUser("break_glass_admin", "team-z", "0000000"), makePatient("team-b", "9999999"), "write"),
    true
  );
});

// ── Guard de null patient (deve ser primeira verificacao) ─────────────────────

run("null-patient-write: patient null retorna false (write)", () => {
  assert.equal(
    canAccessPatient(makeUser("doctor", "team-a", "3534401"), null, "write"),
    false
  );
});

run("null-patient-read: patient null retorna false (read)", () => {
  assert.equal(
    canAccessPatient(makeUser("doctor", "team-a", "3534401"), null, "read"),
    false
  );
});

// ── Roles clinicas adicionais ─────────────────────────────────────────────────

run("read-nurse_manager-cross-UBS: nurse_manager mesmo municipio retorna true", () => {
  assert.equal(
    canAccessPatient(makeUser("nurse_manager", "team-a", "3534401"), makePatient("team-b", "3534401"), "read"),
    true
  );
});

run("read-dentist-cross-UBS: dentist mesmo municipio retorna true", () => {
  assert.equal(
    canAccessPatient(makeUser("dentist", "team-a", "3534401"), makePatient("team-b", "3534401"), "read"),
    true
  );
});

run("read-nursing_tech-cross-UBS: nursing_tech mesmo municipio retorna true", () => {
  assert.equal(
    canAccessPatient(makeUser("nursing_tech", "team-a", "3534401"), makePatient("team-b", "3534401"), "read"),
    true
  );
});

run("read-receptionist-cross-UBS: receptionist nao pode ler cross-UBS (nao esta em CLINICAL_READ_ROLES)", () => {
  assert.equal(
    canAccessPatient(makeUser("receptionist", "team-a", "3534401"), makePatient("team-b", "3534401"), "read"),
    false
  );
});

// ── default mode = "write" (chamada sem mode deve comportar como write) ───────

run("default-mode-preservado: chamada sem terceiro argumento usa write (teamId match)", () => {
  assert.equal(
    canAccessPatient(makeUser("doctor", "team-a", "3534401"), makePatient("team-a", "3534401")),
    true
  );
  assert.equal(
    canAccessPatient(makeUser("doctor", "team-a", "3534401"), makePatient("team-b", "3534401")),
    false
  );
});
