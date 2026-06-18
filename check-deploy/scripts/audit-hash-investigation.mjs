#!/usr/bin/env node
/**
 * AUD-01 — Read-only hash reproduction investigation.
 *
 * Connects to Postgres, reads first N audit log entries from app_state.data JSONB,
 * and tries multiple serialization strategies to reproduce the stored hash.
 *
 * Usage:
 *   DATABASE_URL="<staging-db-url>" node scripts/audit-hash-investigation.mjs
 *   DATABASE_URL="<url>" node scripts/audit-hash-investigation.mjs --limit 20
 *   DATABASE_URL="<url>" node scripts/audit-hash-investigation.mjs --verbose
 *
 * Required env:
 *   DATABASE_URL — Postgres connection string (read-only query, no writes)
 *
 * Exit 0 = investigation complete
 * Exit 1 = connection error
 */

import crypto from "node:crypto";
import pg from "pg";

const { Pool } = pg;

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1];
  return fallback;
}
const LIMIT   = Number(getArg("--limit", 10));
const VERBOSE = args.includes("--verbose");

// ── DB connection ─────────────────────────────────────────────────────────────
const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
if (!DATABASE_URL) {
  console.error("ERRO: DATABASE_URL não definido.");
  process.exit(1);
}
function stripSslParams(url) {
  try {
    const u = new URL(url);
    ["sslmode","sslcert","sslkey","sslrootcert","sslpassword"].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch { return url; }
}
const pool = new pg.Pool({
  connectionString: stripSslParams(DATABASE_URL),
  ssl: { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 10000,
});

// ── Hash strategies ───────────────────────────────────────────────────────────
function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

/** Strategy A: what verifyAuditLogChain currently does — JSONB key order, direct stringify */
function strategyA(withoutHash) {
  return sha256(JSON.stringify(withoutHash));
}

/** Strategy B: canonical (recursive sort) */
function canonicalStringify(obj) {
  return JSON.stringify(obj, (_, val) => {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      return Object.fromEntries(Object.keys(val).sort().map(k => [k, val[k]]));
    }
    return val;
  });
}
function strategyB(withoutHash) {
  return sha256(canonicalStringify(withoutHash));
}

/**
 * Strategy C: reconstruct object in original addAuditLog insertion order (stable across
 * all commits from 7e8f4ef to HEAD) then JSON.stringify.
 *
 * Original key order:
 *   logEntry: id, action, entity, entityId, category, severity, teamId, teamName,
 *             userId, userName, userRole, actor{id,name,role,teamId,teamName,impersonation,breakGlass},
 *             request{id,ip,userAgent,method,path,authTransport},
 *             outcome, before, after, details, requestId, ip, userAgent, createdAt
 *   + prevHash appended via { ...logEntry, prevHash }
 */
function reconstructInInsertionOrder(entry) {
  const e = entry;
  const actor = e.actor || {};
  const request = e.request || {};

  const reconstructedActor = {
    id: actor.id,
    name: actor.name,
    role: actor.role,
    teamId: actor.teamId,
    teamName: actor.teamName,
    impersonation: actor.impersonation !== undefined ? actor.impersonation : null,
    breakGlass: actor.breakGlass !== undefined ? actor.breakGlass : null,
  };

  // If impersonation is not null, reconstruct its key order too
  if (reconstructedActor.impersonation && typeof reconstructedActor.impersonation === "object") {
    const imp = actor.impersonation;
    reconstructedActor.impersonation = {
      active: imp.active,
      targetUserId: imp.targetUserId,
      targetUserName: imp.targetUserName,
      targetUserRole: imp.targetUserRole,
      targetTeamId: imp.targetTeamId,
      targetTeamName: imp.targetTeamName,
    };
  }
  // If breakGlass is not null, reconstruct its key order
  if (reconstructedActor.breakGlass && typeof reconstructedActor.breakGlass === "object") {
    const bg = actor.breakGlass;
    reconstructedActor.breakGlass = {
      active: bg.active,
      reason: bg.reason,
      expiresAt: bg.expiresAt,
    };
  }

  const reconstructedRequest = {
    id: request.id,
    ip: request.ip,
    userAgent: request.userAgent,
    method: request.method,
    path: request.path,
    authTransport: request.authTransport,
  };

  return {
    id: e.id,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId,
    category: e.category,
    severity: e.severity,
    teamId: e.teamId,
    teamName: e.teamName,
    userId: e.userId,
    userName: e.userName,
    userRole: e.userRole,
    actor: reconstructedActor,
    request: reconstructedRequest,
    outcome: e.outcome,
    before: e.before !== undefined ? e.before : null,
    after: e.after !== undefined ? e.after : null,
    details: e.details !== undefined ? e.details : {},
    requestId: e.requestId !== undefined ? e.requestId : "",
    ip: e.ip !== undefined ? e.ip : "",
    userAgent: e.userAgent !== undefined ? e.userAgent : "",
    createdAt: e.createdAt,
    prevHash: e.prevHash,
  };
}
function strategyC(entry) {
  const reconstructed = reconstructInInsertionOrder(entry);
  return sha256(JSON.stringify(reconstructed));
}

/** Strategy D: reconstruct in insertion order + canonical stringify */
function strategyD(entry) {
  const reconstructed = reconstructInInsertionOrder(entry);
  return sha256(canonicalStringify(reconstructed));
}

// ── Investigation ─────────────────────────────────────────────────────────────
async function investigate() {
  console.log(`\nAUD-01 Hash Reproduction Investigation`);
  console.log(`Limit: ${LIMIT} entries | Verbose: ${VERBOSE}`);
  console.log(`─────────────────────────────────────────\n`);

  const client = await pool.connect();
  let appState;
  try {
    const result = await client.query("SELECT data FROM app_state WHERE id = 1");
    appState = result.rows[0]?.data;
  } finally {
    client.release();
  }

  if (!appState) {
    console.error("ERRO: app_state row not found.");
    process.exit(1);
  }

  const auditLogs = Array.isArray(appState.auditLogs) ? appState.auditLogs : [];
  console.log(`Total entries in app_state.auditLogs: ${auditLogs.length}`);

  if (auditLogs.length === 0) {
    console.log("No audit log entries to investigate.");
    return;
  }

  // Take first LIMIT entries (oldest = index 0) + last 3 (most recent)
  const sampleFirst = auditLogs.slice(0, LIMIT);
  const sampleLast  = auditLogs.slice(Math.max(0, auditLogs.length - 3));
  const samples = [
    ...sampleFirst.map((e, i) => ({ pos: i, label: `first[${i}]`, entry: e })),
    ...sampleLast
      .filter((e) => !sampleFirst.some((f) => f.id === e.id))
      .map((e, i) => ({ pos: auditLogs.length - sampleLast.length + i, label: `last[${auditLogs.length - sampleLast.length + i}]`, entry: e })),
  ];

  const results = {
    A: { match: 0, total: 0 },
    B: { match: 0, total: 0 },
    C: { match: 0, total: 0 },
    D: { match: 0, total: 0 },
  };

  console.log(`\nTesting ${samples.length} entries:\n`);

  for (const { pos, label, entry } of samples) {
    const storedHash = entry.hash;
    const { hash: _, ...withoutHash } = entry;

    const hA = strategyA(withoutHash);
    const hB = strategyB(withoutHash);
    const hC = strategyC(entry);   // takes full entry (needs prevHash)
    const hD = strategyD(entry);

    const mA = hA === storedHash;
    const mB = hB === storedHash;
    const mC = hC === storedHash;
    const mD = hD === storedHash;

    results.A.total++; if (mA) results.A.match++;
    results.B.total++; if (mB) results.B.match++;
    results.C.total++; if (mC) results.C.match++;
    results.D.total++; if (mD) results.D.match++;

    const verdict = mA ? "A✓" : mB ? "B✓" : mC ? "C✓" : mD ? "D✓" : "NONE";

    console.log(`  ${label.padEnd(12)} id=${String(entry.id || "?").slice(0,8)}  stored=${storedHash.slice(0,12)}…  A:${mA?'✓':'✗'} B:${mB?'✓':'✗'} C:${mC?'✓':'✗'} D:${mD?'✓':'✗'}  → ${verdict}`);

    if (VERBOSE && !mA && !mB && !mC && !mD) {
      console.log(`    JSONB keys (top-level): ${Object.keys(entry).join(", ")}`);
      console.log(`    actor keys: ${Object.keys(entry.actor || {}).join(", ")}`);
      console.log(`    request keys: ${Object.keys(entry.request || {}).join(", ")}`);
      console.log(`    A-computed: ${hA.slice(0,24)}…`);
      console.log(`    B-computed: ${hB.slice(0,24)}…`);
      console.log(`    C-computed: ${hC.slice(0,24)}…`);
      console.log(`    D-computed: ${hD.slice(0,24)}…`);
      console.log(`    JSON(A): ${JSON.stringify(withoutHash).slice(0,120)}…`);
      console.log(`    JSON(C): ${JSON.stringify(reconstructInInsertionOrder(entry)).slice(0,120)}…`);
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`Strategy results (${samples.length} entries):`);
  console.log(`  A (JSONB-order direct stringify):         ${results.A.match}/${results.A.total} match`);
  console.log(`  B (canonical sorted stringify):           ${results.B.match}/${results.B.total} match`);
  console.log(`  C (reconstruct insertion order + JSON):   ${results.C.match}/${results.C.total} match`);
  console.log(`  D (reconstruct insertion order + sorted): ${results.D.match}/${results.D.total} match`);
  console.log();

  const best = ["C","D","B","A"].find(s => results[s].match > 0);
  if (!best) {
    console.log(`RESULT: No strategy reproduced any hash.`);
    console.log(`→ Entries are TRULY legacy_incompatible — canonical hash path is correct.`);
    console.log(`→ Re-run with --verbose to inspect serialization differences.`);
  } else {
    const r = results[best];
    if (r.match === r.total) {
      console.log(`RESULT: Strategy ${best} reproduced ALL ${r.match} hashes.`);
      console.log(`→ Entries are VERIFIABLE using strategy ${best}.`);
      console.log(`→ Implement legacy_valid support with strategy ${best} in verifyAuditLogChain.`);
    } else {
      console.log(`RESULT: Strategy ${best} reproduced ${r.match}/${r.total} hashes (partial match).`);
      console.log(`→ Mixed: some entries verifiable, some not.`);
      console.log(`→ Implement legacy_valid for matching + legacy_incompatible for non-matching.`);
      console.log(`→ Check if non-matching entries coincide with any addAuditLog change (git log).`);
    }
  }

  // Chain continuity check (stored hash values — unaffected by JSONB reordering)
  console.log(`\nChain continuity (stored hash values):`);
  let chainOk = 0;
  let chainBroken = 0;
  for (let i = 1; i < Math.min(LIMIT, auditLogs.length); i++) {
    const cur = auditLogs[i];
    const prev = auditLogs[i - 1];
    if (cur.prevHash === prev.hash) {
      chainOk++;
    } else {
      chainBroken++;
      console.log(`  CHAIN BREAK at index ${i}: expected prevHash=${prev.hash?.slice(0,12)}, got ${cur.prevHash?.slice(0,12)}`);
    }
  }
  if (chainBroken === 0) {
    console.log(`  ✓ All ${chainOk} chain links intact (stored hash values match).`);
  }

  console.log();
}

investigate()
  .catch((err) => {
    console.error("ERRO:", err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
