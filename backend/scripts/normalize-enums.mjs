/**
 * normalize-enums.mjs — Pre-condition script for Deploy 2B
 *
 * PRÉ-CONDIÇÃO OBRIGATÓRIA antes de ativar enums F2-02/F2-03 em staging/prod:
 *   1. Snapshot RDS antes de executar
 *   2. Este script (ou as queries SQL abaixo) devem ser executados
 *   3. Verificar queries de validação retornando 0 registros fora do enum
 *
 * Para Postgres staging/prod: execute as queries SQL documentadas abaixo.
 * Para ambiente de teste (JSON DB): chame normalizeJsonDb(dbPath).
 *
 * ============================
 * QUERIES SQL — STAGING / PROD
 * ============================
 *
 * -- 1. Normalizar sexAtBirth
 * UPDATE patients SET sex_at_birth = 'F' WHERE sex_at_birth IN ('feminino', 'female', 'f');
 * UPDATE patients SET sex_at_birth = 'M' WHERE sex_at_birth IN ('masculino', 'male', 'm');
 * UPDATE patients SET sex_at_birth = 'I' WHERE sex_at_birth IN ('intersexual', 'i', 'indeterminado');
 * UPDATE patients SET sex_at_birth = NULL WHERE sex_at_birth NOT IN ('M', 'F', 'I') AND sex_at_birth IS NOT NULL AND sex_at_birth != '';
 *
 * -- 2. Normalizar maritalStatus
 * UPDATE patients SET marital_status = 'SOLTEIRO' WHERE marital_status IN ('solteiro', 'solteira', 'single');
 * UPDATE patients SET marital_status = 'CASADO' WHERE marital_status IN ('casado', 'casada', 'married');
 * UPDATE patients SET marital_status = 'DIVORCIADO' WHERE marital_status IN ('divorciado', 'divorciada', 'divorced');
 * UPDATE patients SET marital_status = 'VIUVO' WHERE marital_status IN ('viuvo', 'viuva', 'widowed');
 * UPDATE patients SET marital_status = 'UNIAO_ESTAVEL' WHERE marital_status IN ('uniao_estavel', 'união estável', 'common_law');
 * UPDATE patients SET marital_status = 'SEPARADO' WHERE marital_status IN ('separado', 'separada', 'separated');
 * UPDATE patients SET marital_status = 'NAO_INFORMADO' WHERE marital_status IN ('nao_informado', 'não informado', 'unknown');
 * UPDATE patients SET marital_status = NULL WHERE marital_status NOT IN ('SOLTEIRO','CASADO','DIVORCIADO','VIUVO','UNIAO_ESTAVEL','SEPARADO','NAO_INFORMADO') AND marital_status IS NOT NULL AND marital_status != '';
 *
 * -- 3. Normalizar racaCor
 * UPDATE patients SET raca_cor = 'BRANCA' WHERE raca_cor IN ('branca', 'white');
 * UPDATE patients SET raca_cor = 'PRETA' WHERE raca_cor IN ('preta', 'black');
 * UPDATE patients SET raca_cor = 'PARDA' WHERE raca_cor IN ('parda', 'mixed');
 * UPDATE patients SET raca_cor = 'AMARELA' WHERE raca_cor IN ('amarela', 'asian');
 * UPDATE patients SET raca_cor = 'INDIGENA' WHERE raca_cor IN ('indigena', 'indígena', 'indigenous');
 * UPDATE patients SET raca_cor = NULL WHERE raca_cor IN ('nao_informado', 'não informado');
 * UPDATE patients SET raca_cor = NULL WHERE raca_cor NOT IN ('BRANCA','PRETA','PARDA','AMARELA','INDIGENA') AND raca_cor IS NOT NULL AND raca_cor != '';
 *
 * ============================
 * QUERIES DE VALIDAÇÃO PÓS-SCRIPT (devem retornar 0)
 * ============================
 *
 * SELECT COUNT(*) FROM patients WHERE sex_at_birth NOT IN ('M','F','I') AND sex_at_birth IS NOT NULL AND sex_at_birth != '';
 * SELECT COUNT(*) FROM patients WHERE marital_status NOT IN ('SOLTEIRO','CASADO','DIVORCIADO','VIUVO','UNIAO_ESTAVEL','SEPARADO','NAO_INFORMADO') AND marital_status IS NOT NULL AND marital_status != '';
 * SELECT COUNT(*) FROM patients WHERE raca_cor NOT IN ('BRANCA','PRETA','PARDA','AMARELA','INDIGENA') AND raca_cor IS NOT NULL AND raca_cor != '';
 */

import { readFileSync, writeFileSync } from "node:fs";

const SEX_MAP = {
  feminino: "F", female: "F", f: "F",
  masculino: "M", male: "M", m: "M",
  intersexual: "I", indeterminado: "I", i: "I",
};
const VALID_SEX = new Set(["M", "F", "I"]);

const MARITAL_MAP = {
  solteiro: "SOLTEIRO", solteira: "SOLTEIRO", single: "SOLTEIRO",
  casado: "CASADO", casada: "CASADO", married: "CASADO",
  divorciado: "DIVORCIADO", divorciada: "DIVORCIADO", divorced: "DIVORCIADO",
  viuvo: "VIUVO", viuva: "VIUVO", widowed: "VIUVO",
  uniao_estavel: "UNIAO_ESTAVEL", common_law: "UNIAO_ESTAVEL",
  separado: "SEPARADO", separada: "SEPARADO", separated: "SEPARADO",
  nao_informado: "NAO_INFORMADO", unknown: "NAO_INFORMADO",
};
const VALID_MARITAL = new Set(["SOLTEIRO", "CASADO", "DIVORCIADO", "VIUVO", "UNIAO_ESTAVEL", "SEPARADO", "NAO_INFORMADO"]);

const RACA_MAP = {
  branca: "BRANCA", white: "BRANCA",
  preta: "PRETA", black: "PRETA",
  parda: "PARDA", mixed: "PARDA",
  amarela: "AMARELA", asian: "AMARELA",
  indigena: "INDIGENA", indigenous: "INDIGENA",
};
const VALID_RACA = new Set(["BRANCA", "PRETA", "PARDA", "AMARELA", "INDIGENA"]);

function normalizeField(val, map, validSet) {
  if (!val || val === "nao_informado" || val === "não informado") return "";
  if (validSet.has(val)) return val;
  return map[val.toLowerCase()] || "";
}

export function normalizeJsonDb(dbPath) {
  const raw = JSON.parse(readFileSync(dbPath, "utf8"));
  if (!Array.isArray(raw.patients)) return { changed: 0, stats: {} };

  let changed = 0;
  const stats = { sexAtBirth: 0, maritalStatus: 0, racaCor: 0 };

  for (const p of raw.patients) {
    const origSex = p.sexAtBirth;
    const origMarital = p.maritalStatus;
    const origRaca = p.racaCor;

    p.sexAtBirth = normalizeField(p.sexAtBirth, SEX_MAP, VALID_SEX);
    p.maritalStatus = normalizeField(p.maritalStatus, MARITAL_MAP, VALID_MARITAL);
    p.racaCor = normalizeField(p.racaCor, RACA_MAP, VALID_RACA);

    if (p.sexAtBirth !== origSex) stats.sexAtBirth++;
    if (p.maritalStatus !== origMarital) stats.maritalStatus++;
    if (p.racaCor !== origRaca) stats.racaCor++;
    if (p.sexAtBirth !== origSex || p.maritalStatus !== origMarital || p.racaCor !== origRaca) changed++;
  }

  writeFileSync(dbPath, JSON.stringify(raw), "utf8");
  return { changed, stats };
}

export function validateEnums(patients) {
  const issues = [];
  for (const p of patients) {
    if (p.sexAtBirth && !VALID_SEX.has(p.sexAtBirth)) {
      issues.push({ id: p.id, field: "sexAtBirth", value: p.sexAtBirth });
    }
    if (p.maritalStatus && !VALID_MARITAL.has(p.maritalStatus)) {
      issues.push({ id: p.id, field: "maritalStatus", value: p.maritalStatus });
    }
    if (p.racaCor && !VALID_RACA.has(p.racaCor)) {
      issues.push({ id: p.id, field: "racaCor", value: p.racaCor });
    }
  }
  return issues;
}

// CLI: node normalize-enums.mjs <db-path>
if (process.argv[2]) {
  const result = normalizeJsonDb(process.argv[2]);
  console.log("Normalization complete:", JSON.stringify(result, null, 2));

  const db = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const issues = validateEnums(db.patients || []);
  if (issues.length === 0) {
    console.log("Validation PASS: 0 values outside enum");
  } else {
    console.error("Validation FAIL:", issues);
    process.exit(1);
  }
}
