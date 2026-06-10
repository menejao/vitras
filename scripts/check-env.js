#!/usr/bin/env node
/**
 * check-env.js — Validates required environment variables before deploy.
 *
 * Usage:
 *   node scripts/check-env.js
 *
 * Exit 0 = all required vars present and valid
 * Exit 1 = one or more required vars missing or invalid
 *
 * Rules:
 *   - Production (NODE_ENV=production) and staging (NODE_ENV=staging): full list
 *   - Other environments: minimal list only
 *
 * No external dependencies — only Node built-ins.
 */

const NODE_ENV = String(process.env.NODE_ENV || "").trim().toLowerCase();
const IS_PROD_LIKE = NODE_ENV === "production" || NODE_ENV === "staging";

// ---------------------------------------------------------------------------
// Checks definition
// Each entry: { name, validate(value) => string|null }
//   validate returns null on success or an error message on failure.
// ---------------------------------------------------------------------------

function present(value) {
  return value && value.length > 0 ? null : "not set or empty";
}

function minLength(n) {
  return (value) =>
    value && value.length >= n ? null : `must be at least ${n} characters (got ${value ? value.length : 0})`;
}

function differentFrom(otherName) {
  return (value) => {
    const other = String(process.env[otherName] || "").trim();
    if (!other) return null; // can't compare if other is absent — separate check will catch that
    return value !== other ? null : `must be different from ${otherName}`;
  };
}

function all(...fns) {
  return (value) => {
    for (const fn of fns) {
      const result = fn(value);
      if (result !== null) return result;
    }
    return null;
  };
}

// Minimal checks — apply in all environments
const MINIMAL_CHECKS = [
  { name: "NODE_ENV", validate: present },
];

// Full checks — apply in production and staging
const PROD_CHECKS = [
  { name: "DATABASE_URL",             validate: present },
  { name: "JWT_SECRET",               validate: all(present, minLength(32)) },
  { name: "DATA_ENCRYPTION_KEY",      validate: all(present, minLength(32)) },
  {
    name: "PATIENT_LOOKUP_HASH_KEY",
    validate: all(present, minLength(32), differentFrom("DATA_ENCRYPTION_KEY")),
  },
  { name: "BACKUP_EXPORT_KEY",        validate: present },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const checks = IS_PROD_LIKE ? [...MINIMAL_CHECKS, ...PROD_CHECKS] : MINIMAL_CHECKS;

console.log(`\ncheck-env — NODE_ENV=${NODE_ENV || "(not set)"}\n`);

if (IS_PROD_LIKE) {
  console.log("Mode: production-like (full validation)\n");
} else {
  console.log("Mode: development/test (minimal validation)\n");
}

let failures = 0;

for (const check of checks) {
  const raw = process.env[check.name];
  const value = String(raw || "").trim();
  const error = check.validate(value);

  if (error === null) {
    console.log(`  OK  ${check.name}`);
  } else {
    console.error(`  FAIL  ${check.name}: ${error}`);
    failures++;
  }
}

console.log();

if (failures > 0) {
  console.error(`${failures} check(s) failed — fix before deploying.\n`);
  process.exit(1);
} else {
  console.log(`All checks passed.\n`);
  process.exit(0);
}
