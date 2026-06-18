/**
 * normalize-tipoequipe.mjs — Pre-condition script for Deploy 4A
 *
 * F5-04: Normalizes legacy tipoEquipe values in db.teams JSONB.
 * Must run BEFORE restricting TeamPatchSchema enum to canonical values.
 *
 * Mapping:
 *   EAP   → EAPS
 *   OUTRA → OUTROS
 *
 * ============================
 * QUERIES SQL — STAGING / PROD (Postgres JSONB)
 * ============================
 *
 * -- Normalize tipoEquipe in app_state JSONB (teams array)
 * -- Run inside transaction; snapshot RDS before executing.
 *
 * -- Validation query (must return 0 before enabling new enum):
 * SELECT COUNT(*) FROM (
 *   SELECT jsonb_array_elements(data->'teams') AS team
 *   FROM app_state WHERE id = 1
 * ) t
 * WHERE (team->>'tipoEquipe') IN ('EAP', 'OUTRA');
 *
 * -- Normalization (if validation returns > 0):
 * UPDATE app_state
 * SET data = jsonb_set(
 *   data,
 *   '{teams}',
 *   (
 *     SELECT jsonb_agg(
 *       CASE
 *         WHEN team->>'tipoEquipe' = 'EAP'   THEN jsonb_set(team, '{tipoEquipe}', '"EAPS"')
 *         WHEN team->>'tipoEquipe' = 'OUTRA' THEN jsonb_set(team, '{tipoEquipe}', '"OUTROS"')
 *         ELSE team
 *       END
 *     )
 *     FROM jsonb_array_elements(data->'teams') AS team
 *   )
 * )
 * WHERE id = 1;
 *
 * ============================
 * VALIDATION QUERIES — run after normalization (must return 0)
 * ============================
 *
 * SELECT COUNT(*) FROM (
 *   SELECT jsonb_array_elements(data->'teams') AS team FROM app_state WHERE id = 1
 * ) t WHERE (team->>'tipoEquipe') = 'EAP';
 *
 * SELECT COUNT(*) FROM (
 *   SELECT jsonb_array_elements(data->'teams') AS team FROM app_state WHERE id = 1
 * ) t WHERE (team->>'tipoEquipe') = 'OUTRA';
 */

import { readFileSync, writeFileSync } from "node:fs";

const TIPO_EQUIPE_MAP = { EAP: "EAPS", OUTRA: "OUTROS" };
const VALID_TIPO_EQUIPE = new Set(["ESF", "NASF", "CEO", "EMAP", "EMAD", "EAPS", "OUTROS"]);

export function normalizeTipoEquipe(dbPath) {
  const raw = JSON.parse(readFileSync(dbPath, "utf8"));
  if (!Array.isArray(raw.teams)) return { changed: 0, stats: { tipoEquipe: 0 } };

  let changed = 0;
  const stats = { tipoEquipe: 0, invalidCleared: 0 };

  for (const t of raw.teams) {
    if (!t.tipoEquipe) continue;
    if (TIPO_EQUIPE_MAP[t.tipoEquipe]) {
      t.tipoEquipe = TIPO_EQUIPE_MAP[t.tipoEquipe];
      stats.tipoEquipe++;
      changed++;
    } else if (!VALID_TIPO_EQUIPE.has(t.tipoEquipe)) {
      // Unknown value — clear rather than keep invalid enum
      delete t.tipoEquipe;
      stats.invalidCleared++;
      changed++;
    }
  }

  writeFileSync(dbPath, JSON.stringify(raw), "utf8");
  return { changed, stats };
}

export function validateTipoEquipe(teams) {
  const issues = [];
  for (const t of (teams || [])) {
    if (t.tipoEquipe && !VALID_TIPO_EQUIPE.has(t.tipoEquipe)) {
      issues.push({ id: t.id, field: "tipoEquipe", value: t.tipoEquipe });
    }
  }
  return issues;
}

// CLI: node normalize-tipoequipe.mjs <db-path>
if (process.argv[2]) {
  const result = normalizeTipoEquipe(process.argv[2]);
  console.log("Normalization complete:", JSON.stringify(result, null, 2));

  const db = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const issues = validateTipoEquipe(db.teams || []);
  if (issues.length === 0) {
    console.log("Validation PASS: 0 tipoEquipe values outside canonical enum");
  } else {
    console.error("Validation FAIL:", issues);
    process.exit(1);
  }
}
