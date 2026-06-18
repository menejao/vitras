#!/usr/bin/env node
/**
 * Idempotent demo seed — Equipe Rosa
 *
 * Usage:
 *   SEED_DEMO_DATA=true node backend/scripts/seed-demo-team-rosa.mjs
 *
 * With Postgres:
 *   DATABASE_URL=<url> DATA_ENCRYPTION_KEY=<key> SEED_DEMO_DATA=true node backend/scripts/seed-demo-team-rosa.mjs
 */

import { seedDemoTeamRosa } from "../src/services/seed-demo.js";

if (process.env.SEED_DEMO_DATA !== "true") {
  console.error("[seed-demo] Set SEED_DEMO_DATA=true to run.");
  process.exit(1);
}

try {
  const result = await seedDemoTeamRosa();
  if (result?.skipped) {
    console.log("[seed-demo] Skipped (SEED_DEMO_DATA not set).");
  } else {
    console.log("[seed-demo] Seed complete.");
  }
  process.exit(0);
} catch (err) {
  console.error("[seed-demo] Failed:", err);
  process.exit(1);
}
