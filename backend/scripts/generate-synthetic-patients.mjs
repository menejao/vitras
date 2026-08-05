/**
 * VITRAS Synthetic Patient Data Generator — VITRAS-PERFORMANCE-SCALE-01
 *
 * Generates N patients via POST /patients for load/scale testing.
 * Requires a valid TOKEN with patient.create capability.
 *
 * Usage:
 *   BASE_URL=https://vitras-xxx.onrender.com TOKEN=eyJ... COUNT=500 node scripts/generate-synthetic-patients.mjs
 *
 * Options (env vars):
 *   BASE_URL   — API base URL (default: http://localhost:3001)
 *   TOKEN      — JWT access token
 *   COUNT      — Number of patients to generate (default: 100)
 *   CONCURRENCY— Concurrent requests (default: 5)
 *   DRY_RUN    — "true" to print payload without sending (default: false)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const TOKEN = process.env.TOKEN || "";
const COUNT = parseInt(process.env.COUNT || "100");
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "5");
const DRY_RUN = process.env.DRY_RUN === "true";

if (!TOKEN && !DRY_RUN) {
  console.error("TOKEN env var required");
  process.exit(1);
}

const FIRST_NAMES = ["Ana", "Carlos", "Maria", "João", "Fernanda", "Pedro", "Lucia", "Roberto", "Sandra", "Paulo"];
const LAST_NAMES = ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Costa", "Pereira", "Ferreira", "Alves", "Rodrigues"];
const CARE_CATEGORIES = ["general", "chronic", "urgent", "preventive"];
const MICRO_AREAS = ["001", "002", "003", "004", "005"];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(startYear = 1940, endYear = 2005) {
  const year = startYear + Math.floor(Math.random() * (endYear - startYear));
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function randomPhone() {
  const ddd = String(10 + Math.floor(Math.random() * 80));
  const num = String(Math.floor(Math.random() * 900000000) + 100000000);
  return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
}

function randomCpf() {
  // Synthetic CPF — not a real CPF, for testing only
  return Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("");
}

function generatePatient(index) {
  const firstName = randomFrom(FIRST_NAMES);
  const lastName = randomFrom(LAST_NAMES);
  return {
    name: `${firstName} ${lastName} ${index}`,
    phone: randomPhone(),
    birthDate: randomDate(),
    careCategory: randomFrom(CARE_CATEGORIES),
    microArea: randomFrom(MICRO_AREAS),
    address: `Rua Sintética, ${100 + index}`,
    neighborhood: "Centro",
    city: "Município Teste",
    uf: "SP",
    // CPF not sent by default — add only if system requires for deduplication tests
    // cpf: randomCpf(),
  };
}

async function createPatient(patient) {
  const resp = await fetch(`${BASE_URL}/patients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(patient),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  return await resp.json();
}

async function runBatch(patients) {
  const results = await Promise.allSettled(patients.map(createPatient));
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const err = results.filter((r) => r.status === "rejected");
  if (err.length > 0) {
    console.warn(`  ${err.length} errors in batch:`, err[0].reason?.message);
  }
  return ok;
}

async function main() {
  console.log(`\n=== VITRAS Synthetic Data Generator ===`);
  console.log(`Generating ${COUNT} patients (concurrency=${CONCURRENCY})`);
  if (DRY_RUN) {
    console.log("DRY_RUN=true — printing sample payload only\n");
    console.log(JSON.stringify(generatePatient(1), null, 2));
    return;
  }

  let created = 0;
  const startMs = Date.now();

  for (let i = 0; i < COUNT; i += CONCURRENCY) {
    const batch = [];
    for (let j = i; j < Math.min(i + CONCURRENCY, COUNT); j++) {
      batch.push(generatePatient(j + 1));
    }
    const ok = await runBatch(batch);
    created += ok;
    process.stdout.write(`\r  Created: ${created}/${COUNT}`);
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\n\nDone: ${created}/${COUNT} patients created in ${elapsed}s`);
  console.log(`Rate: ${(created / parseFloat(elapsed)).toFixed(1)} patients/s`);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
