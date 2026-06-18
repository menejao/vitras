/**
 * D-PRE-07 v2: Auditoria de cnsCpf legado em app_patients.payload (PostgreSQL direto)
 *
 * Usa pg diretamente — não depende de readDb() nem de DATA_ENCRYPTION_KEY.
 * cnsCpf é texto legado (não criptografado na maioria dos registros antigos).
 *
 * Execução via SSM (EB):
 *   cd /var/app/current && node scripts/dpre07-cnscpf-audit.mjs
 *
 * Requer: DATABASE_URL no ambiente (já disponível em instâncias EB)
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL ausente"); process.exit(1); }

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

// Totais gerais
const totals = (await client.query(`
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE COALESCE(inactive, FALSE) = FALSE) AS ativos,
    COUNT(*) FILTER (WHERE COALESCE(inactive, FALSE) = TRUE) AS inativos
  FROM app_patients
`)).rows[0];

// Distribuição de cnsCpf
const cnsCpfStats = (await client.query(`
  SELECT
    COUNT(*) AS total_com_cnscpf,
    COUNT(*) FILTER (WHERE COALESCE(inactive, FALSE) = FALSE) AS ativos_com_cnscpf,
    COUNT(*) FILTER (
      WHERE payload->>'cnsCpf' IS NOT NULL
        AND payload->>'cnsCpf' != ''
        AND payload->>'cpf' IS NOT NULL
        AND payload->>'cpf' != ''
        AND REGEXP_REPLACE(payload->>'cnsCpf', '[^0-9]', '', 'g') =
            REGEXP_REPLACE(payload->>'cpf',    '[^0-9]', '', 'g')
    ) AS redundant,
    COUNT(*) FILTER (
      WHERE payload->>'cnsCpf' IS NOT NULL
        AND payload->>'cnsCpf' != ''
        AND (payload->>'cpf' IS NULL OR payload->>'cpf' = '')
        AND LENGTH(REGEXP_REPLACE(payload->>'cnsCpf', '[^0-9]', '', 'g')) = 11
    ) AS cpf_candidate,
    COUNT(*) FILTER (
      WHERE payload->>'cnsCpf' IS NOT NULL
        AND payload->>'cnsCpf' != ''
        AND (payload->>'cns' IS NULL OR payload->>'cns' = '')
        AND LENGTH(REGEXP_REPLACE(payload->>'cnsCpf', '[^0-9]', '', 'g')) = 15
    ) AS cns_candidate,
    COUNT(*) FILTER (
      WHERE payload->>'cnsCpf' IS NOT NULL
        AND payload->>'cnsCpf' != ''
        AND payload->>'cpf' IS NOT NULL
        AND payload->>'cpf' != ''
        AND REGEXP_REPLACE(payload->>'cnsCpf', '[^0-9]', '', 'g') !=
            REGEXP_REPLACE(payload->>'cpf',    '[^0-9]', '', 'g')
    ) AS conflict_cpf,
    COUNT(*) FILTER (
      WHERE payload->>'cnsCpf' IS NOT NULL
        AND payload->>'cnsCpf' != ''
        AND STARTS_WITH(payload->>'cnsCpf', 'enc1:')
    ) AS encrypted,
    COUNT(*) FILTER (
      WHERE payload->>'cnsCpf' IS NOT NULL
        AND payload->>'cnsCpf' != ''
        AND NOT STARTS_WITH(payload->>'cnsCpf', 'enc1:')
        AND LENGTH(REGEXP_REPLACE(payload->>'cnsCpf', '[^0-9]', '', 'g')) NOT IN (11, 15)
    ) AS invalid
  FROM app_patients
  WHERE payload->>'cnsCpf' IS NOT NULL
    AND payload->>'cnsCpf' != ''
`)).rows[0];

// Amostragem de conflitos (se existirem)
const conflicts = (await client.query(`
  SELECT id, payload->>'cnsCpf' AS cns_cpf, payload->>'cpf' AS cpf, payload->>'name' AS name
  FROM app_patients
  WHERE payload->>'cnsCpf' IS NOT NULL
    AND payload->>'cnsCpf' != ''
    AND payload->>'cpf' IS NOT NULL
    AND payload->>'cpf' != ''
    AND REGEXP_REPLACE(payload->>'cnsCpf', '[^0-9]', '', 'g') !=
        REGEXP_REPLACE(payload->>'cpf',    '[^0-9]', '', 'g')
  LIMIT 10
`)).rows;

await client.end();

console.log("=== D-PRE-07 v2: Auditoria cnsCpf legado (PostgreSQL direto) ===");
// output is ASCII-only for AWS CLI compatibility
console.log("");
console.log(`Total pacientes:  ${totals.total}`);
console.log(`  Ativos:         ${totals.ativos}`);
console.log(`  Inativos:       ${totals.inativos}`);
console.log("");
console.log(`Com cnsCpf preenchido (total):  ${cnsCpfStats.total_com_cnscpf}`);
console.log(`Com cnsCpf preenchido (ativos): ${cnsCpfStats.ativos_com_cnscpf}`);
console.log("");
console.log(`  REDUNDANT      (cnsCpf == cpf):          ${cnsCpfStats.redundant}`);
console.log(`  CPF_CANDIDATE  (11 digitos, cpf vazio): ${cnsCpfStats.cpf_candidate}`);
console.log(`  CNS_CANDIDATE  (15 digitos, cns vazio): ${cnsCpfStats.cns_candidate}`);
console.log(`  CONFLICT_CPF   (cnsCpf != cpf existente):${cnsCpfStats.conflict_cpf}`);
console.log(`  ENCRYPTED      (enc1: prefix):           ${cnsCpfStats.encrypted}`);
console.log(`  INVALID        (nao 11 nem 15 digitos):  ${cnsCpfStats.invalid}`);
console.log("");

const needsReview = Number(cnsCpfStats.conflict_cpf) + Number(cnsCpfStats.invalid);
const safeBackfill = Number(cnsCpfStats.cpf_candidate) + Number(cnsCpfStats.cns_candidate);

if (conflicts.length > 0) {
  console.log("--- CONFLITOS (amostra) ---");
  for (const c of conflicts) {
    console.log(`  [CONFLICT] ${c.id} - ${c.name}: cnsCpf=${c.cns_cpf} cpf=${c.cpf}`);
  }
  console.log("");
}

if (Number(cnsCpfStats.total_com_cnscpf) === 0) {
  console.log("STATUS: D-PRE-07 PASS — nenhum cnsCpf preenchido");
  console.log("AÇÃO: F7-02 pode prosseguir sem backfill");
} else if (needsReview > 0) {
  console.log("STATUS: D-PRE-07 NEEDS_MANUAL_REVIEW");
  console.log(`AÇÃO: ${needsReview} registros requerem resolução antes de migration 018`);
} else if (Number(cnsCpfStats.redundant) === Number(cnsCpfStats.total_com_cnscpf)) {
  console.log("STATUS: D-PRE-07 REDUNDANT_ONLY");
  console.log("AÇÃO: todos os cnsCpf são redundantes com cpf — migration 018 limpa sem risco");
} else if (safeBackfill > 0) {
  console.log("STATUS: D-PRE-07 READY_FOR_BACKFILL");
  console.log(`AÇÃO: migration 018 pode rodar — ${safeBackfill} registros serão backfilled`);
} else {
  console.log("STATUS: D-PRE-07 NO_ACTION_NEEDED");
  console.log("AÇÃO: cnsCpf presente mas nenhum backfill necessário");
}
