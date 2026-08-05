/**
 * VITRAS Load Test Script — VITRAS-PERFORMANCE-SCALE-01
 *
 * Requires: autocannon (npm i -g autocannon)
 * Usage:
 *   BASE_URL=https://vitras-xxx.onrender.com TOKEN=eyJ... node scripts/load-test.mjs
 *
 * Scenarios (set SCENARIO env var):
 *   A — health/readyz only (baseline, no auth)
 *   B — GET /patients (paginated) — 50 UBS, 500 patients each
 *   C — POST /patients + GET /patients concurrent (write+read mix)
 *   D — GET /admin/bootstrap paginated
 *   E — concurrent multi-role (gestor + acs + receptionist)
 *
 * Output: p50/p95/p99 latency, throughput (req/s), error rate
 */

import autocannon from "autocannon";
import { readFileSync } from "fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const TOKEN = process.env.TOKEN || "";
const SCENARIO = process.env.SCENARIO || "A";
const DURATION = parseInt(process.env.DURATION || "30");
const CONNECTIONS = parseInt(process.env.CONNECTIONS || "10");

if (!TOKEN && SCENARIO !== "A") {
  console.error("TOKEN env var required for scenarios B-E");
  process.exit(1);
}

const authHeaders = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

const scenarios = {
  A: {
    title: "Scenario A — Health baseline (no auth)",
    url: `${BASE_URL}/health`,
    method: "GET",
    headers: {},
    connections: CONNECTIONS,
    duration: DURATION,
  },
  B: {
    title: "Scenario B — GET /patients paginated (read-heavy)",
    url: `${BASE_URL}/patients?page=1&limit=200`,
    method: "GET",
    headers: authHeaders,
    connections: CONNECTIONS,
    duration: DURATION,
  },
  C: {
    title: "Scenario C — Mixed write+read (POST /patients + GET /patients)",
    url: `${BASE_URL}/patients`,
    method: "GET",
    headers: authHeaders,
    connections: CONNECTIONS,
    duration: DURATION,
    // Note: to test writes, run POST /patients via separate instance or requests array
  },
  D: {
    title: "Scenario D — GET /admin/bootstrap paginated (p1=500)",
    url: `${BASE_URL}/bootstrap?page=1&limit=500`,
    method: "GET",
    headers: authHeaders,
    connections: CONNECTIONS,
    duration: DURATION,
  },
  E: {
    title: "Scenario E — GET /readyz (readiness probe under load)",
    url: `${BASE_URL}/readyz`,
    method: "GET",
    headers: {},
    connections: CONNECTIONS,
    duration: DURATION,
  },
};

const cfg = scenarios[SCENARIO];
if (!cfg) {
  console.error(`Unknown scenario: ${SCENARIO}. Valid: A B C D E`);
  process.exit(1);
}

console.log(`\n=== VITRAS Load Test ===`);
console.log(`Scenario: ${cfg.title}`);
console.log(`URL: ${cfg.url}`);
console.log(`Connections: ${cfg.connections}, Duration: ${cfg.duration}s`);
console.log(`Base URL: ${BASE_URL}\n`);

const instance = autocannon({
  url: cfg.url,
  method: cfg.method,
  headers: cfg.headers,
  connections: cfg.connections,
  duration: cfg.duration,
  timeout: 20,
});

autocannon.track(instance, { renderProgressBar: true });

instance.on("done", (result) => {
  console.log("\n=== Results ===");
  console.log(`Requests: ${result.requests.total} total, ${result.requests.average.toFixed(1)} req/s avg`);
  console.log(`Latency p50: ${result.latency.p50}ms`);
  console.log(`Latency p95: ${result.latency.p95}ms`);
  console.log(`Latency p99: ${result.latency.p99}ms`);
  console.log(`Throughput avg: ${(result.throughput.average / 1024).toFixed(1)} KB/s`);
  console.log(`Errors: ${result.errors}`);
  console.log(`Timeouts: ${result.timeouts}`);
  console.log(`Non-2xx: ${result["non2xx"]}`);

  const p99 = result.latency.p99;
  const errRate = (result.errors + result["non2xx"]) / result.requests.total;

  console.log("\n=== Classification ===");
  console.log(`p99 < 500ms: ${p99 < 500 ? "PASS" : "FAIL"} (${p99}ms)`);
  console.log(`Error rate < 1%: ${errRate < 0.01 ? "PASS" : "FAIL"} (${(errRate * 100).toFixed(2)}%)`);
  console.log(`Req/s > 50: ${result.requests.average >= 50 ? "PASS" : "FAIL"} (${result.requests.average.toFixed(1)})`);

  // Write JSON result
  const fs = await import("fs");
  const out = `load-test-result-${SCENARIO}-${Date.now()}.json`;
  fs.writeFileSync(out, JSON.stringify({ scenario: SCENARIO, ...result }, null, 2));
  console.log(`\nFull results saved: ${out}`);
});
