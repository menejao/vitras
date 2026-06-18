// Copyright (c) 2026 Vitras. Todos os direitos reservados.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Pool } from "pg";
import { canonicalRole, getRoleCapabilities } from "./utils/helpers.js";
import { logInfo, logWarn, logError } from "./utils/logger.js";
import { PATIENT_LOOKUP_HASH_KEY, DATA_ENCRYPTION_KEY, DATA_ENCRYPTION_KEY_REGISTRY, DATA_ENCRYPTION_ACTIVE_KID } from "./config.js";
import { recordMetric } from "./services/metrics.js";

const DB_PATH = process.env.TEST_DB_PATH
  ? path.resolve(process.env.TEST_DB_PATH)
  : path.resolve(process.cwd(), "data", "db.json");
const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const DB_DRIVER = DATABASE_URL ? "postgres" : "file";
const ENC_PREFIX = "enc1:";
const SENSITIVE_PATIENT_FIELDS = ["cpf", "cns", "cnsCpf"];
const SENSITIVE_USER_FIELDS = ["twoFactorSecret", "twoFactorPendingSecret"];

// Strip SSL-related query params from connection string so runtime config
// stays explicit and aligned with official Aurora/RDS setup.
function stripSslParams(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    ["sslmode", "sslcert", "sslkey", "sslrootcert", "sslpassword"].forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return url;
  }
}

const DATABASE_URL_CLEAN = stripSslParams(DATABASE_URL);

const pool = DATABASE_URL_CLEAN
  ? new Pool({
      connectionString: DATABASE_URL_CLEAN,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

if (pool) {
  logInfo("db_pool_created", { event: "db_pool_created", message: "SSL enabled — rejectUnauthorized=false (RDS/Neon compatible)" });
  pool.on("error", (err) => {
    logError("db_pool_idle_error", { event: "db_pool_idle_error", message: err.message, code: err.code });
  });
}

let _dbCache = null;
let _dbCacheAt = 0;
const DB_CACHE_TTL_MS = 1500;

// serialize file writes to prevent concurrent overwrites
let _fileLockChain = Promise.resolve();

let initialized = false;

function isPostgresMode() {
  return DB_DRIVER === "postgres";
}

function _deriveKey(raw) {
  if (!raw) return null;
  return crypto.createHash("sha256").update(String(raw)).digest();
}

function _getKeyById(kid) {
  if (!kid) return null;
  const raw = DATA_ENCRYPTION_KEY_REGISTRY[kid];
  if (!raw) return null;
  return _deriveKey(raw);
}

function _getActiveKid() {
  return DATA_ENCRYPTION_ACTIVE_KID || null;
}

function isEncryptedText(value) {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

function encryptText(value) {
  const raw = String(value || "");
  if (!raw) return "";
  if (isEncryptedText(raw)) return raw;

  const kid = _getActiveKid();
  const key = kid ? _getKeyById(kid) : null;
  if (!key) return raw;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${kid}:${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

function decryptText(value) {
  const raw = String(value || "");
  if (!raw) return "";
  if (!isEncryptedText(raw)) return raw;

  const [, payload] = raw.split(ENC_PREFIX);
  const parts = String(payload || "").split(":");

  let kid, ivB64, encB64, tagB64;
  if (parts.length === 4) {
    // New format: kid:iv:enc:tag
    [kid, ivB64, encB64, tagB64] = parts;
  } else if (parts.length === 3) {
    // Legacy format: iv:enc:tag — route to legacy key
    kid = "legacy";
    [ivB64, encB64, tagB64] = parts;
  } else {
    throw new Error("Formato inválido de dado criptografado");
  }

  const key = _getKeyById(kid);
  if (!key) throw new Error("Chave de descriptografia ausente ou inválida");

  if (!ivB64 || !encB64 || !tagB64) throw new Error("Formato inválido de dado criptografado");
  const iv = Buffer.from(ivB64, "base64");
  const encrypted = Buffer.from(encB64, "base64");
  const tag = Buffer.from(tagB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

// Deterministic HMAC-SHA256 hash of plaintext CPF/CNS for unique-index lookup.
// Uses PATIENT_LOOKUP_HASH_KEY (falls back to DATA_ENCRYPTION_KEY at startup).
// Returns null when value or key is empty so partial indexes exclude missing data.
function computeLookupHash(value, key) {
  if (!value || !key) return null;
  const normalised = String(value).trim();
  if (!normalised) return null;
  return crypto.createHmac("sha256", key).update(normalised).digest("hex");
}

function cloneState(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function transformSensitiveState(state, mode) {
  const data = cloneState(state || {});
  const transform = mode === "encrypt"
    ? (value) => encryptText(value)
    : (value) => decryptText(value);

  if (Array.isArray(data.patients)) {
    data.patients = data.patients.map((patient) => {
      const next = { ...patient };
      for (const field of SENSITIVE_PATIENT_FIELDS) {
        next[field] = transform(next[field]);
      }
      return next;
    });
  }

  if (Array.isArray(data.users)) {
    data.users = data.users.map((user) => {
      const next = { ...user };
      for (const field of SENSITIVE_USER_FIELDS) {
        next[field] = transform(next[field]);
      }
      return next;
    });
  }

  return data;
}

function serializeStateForStorage(state) {
  return transformSensitiveState(state, "encrypt");
}

function deserializeStateFromStorage(state) {
  return transformSensitiveState(state, "decrypt");
}

function hashDefaultPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return `s1$${salt}$${key}`;
}

function buildDefaultState() {
  const now = new Date().toISOString();
  const protocolTemplates = [
    { category: "general", label: "Geral", targets: { visits: 2, consultations: 2, vaccines: 1 }, vaccines: ["Influenza"], authority: "Ministerio da Saude", reference: "https://bvsms.saude.gov.br/bvs/publicacoes/politica_nacional_atencao_basica_2017.pdf", version: "PNAB-2017" },
    { category: "pregnant", label: "Gestante", targets: { visits: 6, consultations: 7, vaccines: 3 }, vaccines: ["dTpa", "Hepatite B", "Influenza"], authority: "Ministerio da Saude", reference: "https://bvsms.saude.gov.br/bvs/saudelegis/gm/2011/prt1459_24_06_2011.html", version: "Rede Cegonha" },
    { category: "puerperal", label: "Puerpera", targets: { visits: 2, consultations: 2, vaccines: 1 }, vaccines: ["dTpa"], authority: "Ministerio da Saude", reference: "https://bvsms.saude.gov.br/bvs/saudelegis/gm/2011/prt1459_24_06_2011.html", version: "Rede Cegonha" },
    { category: "child_followup", label: "Puericultura", targets: { visits: 4, consultations: 6, vaccines: 6 }, vaccines: ["BCG", "Pentavalente", "Polio", "Rotavirus", "Pneumococica", "Meningococica"], authority: "Ministerio da Saude", reference: "https://www.gov.br/saude/pt-br/vacinacao/calendario", version: "Calendario PNI" },
    { category: "chronic", label: "Condicao Cronica", targets: { visits: 3, consultations: 3, vaccines: 2 }, vaccines: ["Influenza", "COVID-19"], authority: "Ministerio da Saude", reference: "https://bvsms.saude.gov.br/bvs/publicacoes/plano_acoes_estrategicas_enfrentamento_dc_nt_2021_2030.pdf", version: "DCNT 2021-2030" }
  ];

  return {
    protocolTemplates,
    units: [
      {
        id: "unit-default",
        name: "Unidade Padrão",
        createdAt: now
      }
    ],
    teams: [
      {
        id: "team-ana",
        name: "Equipe Enfermeira Ana",
        managerUserId: "u1",
        unitId: "unit-default",
        createdAt: now
      }
    ],
    users: (function buildDefaultUsers() {
      const isProd = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
      const enableDefaultUsers = String(process.env.ENABLE_DEFAULT_USERS || "").trim().toLowerCase() === "true";
      if (isProd || !enableDefaultUsers) return [];
      return [
        {
          id: "u1",
          name: "Enfermeira Ana",
          role: "nurse_manager",
          email: "ana@clinica.local",
          password: hashDefaultPassword("123456"),
          teamId: "team-ana",
          unitId: "unit-default",
          councilType: "COREN",
          councilNumber: "123456",
          councilUf: "SP",
          createdAt: now
        },
        {
          id: "u2",
          name: "ACS Carlos",
          role: "acs",
          email: "carlos@clinica.local",
          password: hashDefaultPassword("123456"),
          teamId: "team-ana",
          unitId: "unit-default",
          createdAt: now
        }
      ];
    }()),
    patients: [],
    queueEntries: [],
    agendaEntries: [],
    referrals: [],
    pharmacyStock: [],
    pharmacyLogs: [],
    suppliesStock: [],
    suppliesLogs: [],
    suppliesContinuous: [],
    exams: [],
    appointments: [],
    tasks: [],
    messages: [],
    privacyRequests: [],
    accessRequests: [],
    auditLogs: [],
    clinicalRecords: []
  };
}

async function readDbFromFile() {
  const raw = (await fs.readFile(DB_PATH, "utf-8")).replace(/^\uFEFF/, "");
  return deserializeStateFromStorage(JSON.parse(raw));
}

async function readDbSnapshotFromFileStorage() {
  const raw = (await fs.readFile(DB_PATH, "utf-8")).replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

async function writeDbToFile(data) {
  const safeData = serializeStateForStorage(data);
  await fs.writeFile(DB_PATH, JSON.stringify(safeData, null, 2), "utf-8");
}

async function ensurePostgresState(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(
    `
      INSERT INTO app_state (id, data)
      VALUES (1, $1::jsonb)
      ON CONFLICT (id) DO NOTHING
    `,
    [JSON.stringify(buildDefaultState())]
  );
}

function buildPermissionMap() {
  const roles = [
    "nurse_manager",
    "doctor",
    "dentist",
    "gestor",
    "acs",
    "nursing_tech",
    "pharmacist",
    "pharmacy_tech",
    "receptionist",
    "developer_readonly",
    "support_operator",
    "qa_operator",
    "security_auditor",
    "break_glass_admin"
  ];
  return Object.fromEntries(roles.map((role) => [role, getRoleCapabilities(role)]));
}

function batchInsert(cols, rows) {
  if (!rows.length) return null;
  const stride = cols.length;
  const placeholders = rows.map((_, i) =>
    `(${cols.map((_, j) => `$${i * stride + j + 1}`).join(",")})`
  ).join(",");
  return { text: placeholders, values: rows.flat() };
}

async function syncShadowTables(client, state) {
  const users = Array.isArray(state?.users) ? state.users : [];
  const units = Array.isArray(state?.units) ? state.units : [];
  const refreshTokens = Array.isArray(state?.refreshTokens) ? state.refreshTokens : [];
  const auditLogs = Array.isArray(state?.auditLogs) ? state.auditLogs : [];
  const patients = Array.isArray(state?.patients) ? state.patients : [];
  const appointments = Array.isArray(state?.appointments) ? state.appointments : [];
  const roleCapabilities = buildPermissionMap();

  await client.query("DELETE FROM app_users");
  const userRows = users.map((user) => [
    String(user?.id || ""),
    String(user?.teamId || ""),
    String(user?.unitId || ""),
    String(user?.role || ""),
    String(user?.email || ""),
    String(user?.name || ""),
    Boolean(user?.inactive),
    Boolean(user?.twoFactorEnabled),
    user?.createdAt || null,
    user?.updatedAt || user?.createdAt || null,
    JSON.stringify(user || {}),
    String(user?.municipalityId || "")
  ]);
  const userColsFull = ["id","team_id","unit_id","role","email","name","inactive","two_factor_enabled","created_at","updated_at","payload","municipality_id"];
  const userColsBase = ["id","team_id","unit_id","role","email","name","inactive","two_factor_enabled","created_at","updated_at","payload"];
  try {
    const userBatch = batchInsert(userColsFull, userRows);
    if (userBatch) {
      await client.query(
        `INSERT INTO app_users (${userColsFull.join(",")}) VALUES ${userBatch.text}`,
        userBatch.values
      );
    }
  } catch {
    // Fall back to base columns if municipality_id column doesn't exist yet (migration 010 not applied)
    const baseRows = userRows.map((r) => r.slice(0, userColsBase.length));
    const userBatch = batchInsert(userColsBase, baseRows);
    if (userBatch) {
      await client.query(
        `INSERT INTO app_users (${userColsBase.join(",")}) VALUES ${userBatch.text}`,
        userBatch.values
      );
    }
  }

  // Units shadow table (added in migration 004)
  try {
    await client.query("DELETE FROM app_units");
    const unitRows = units.map((unit) => [
      String(unit?.id || ""),
      String(unit?.name || ""),
      Boolean(unit?.inactive || false),
      unit?.createdAt || null,
      unit?.updatedAt || unit?.createdAt || null,
      JSON.stringify(unit || {}),
      String(unit?.municipalityId || "")
    ]);
    const unitColsFull = ["id","name","inactive","created_at","updated_at","payload","municipality_id"];
    const unitColsBase = ["id","name","inactive","created_at","updated_at","payload"];
    try {
      const unitBatch = batchInsert(unitColsFull, unitRows);
      if (unitBatch) {
        await client.query(
          `INSERT INTO app_units (${unitColsFull.join(",")}) VALUES ${unitBatch.text}`,
          unitBatch.values
        );
      }
    } catch {
      // Fall back to base columns if municipality_id column doesn't exist yet (migration 010 not applied)
      const baseRows = unitRows.map((r) => r.slice(0, unitColsBase.length));
      const unitBatch = batchInsert(unitColsBase, baseRows);
      if (unitBatch) {
        await client.query(
          `INSERT INTO app_units (${unitColsBase.join(",")}) VALUES ${unitBatch.text}`,
          unitBatch.values
        );
      }
    }
  } catch {
    // table may not exist if migration 004 hasn't run yet — safe to ignore
  }

  await client.query("DELETE FROM app_refresh_tokens");
  const tokenRows = refreshTokens.map((token) => [
    String(token?.id || ""),
    String(token?.userId || ""),
    String(token?.tokenHash || ""),
    String(token?.sessionContext?.scopeTeamId || ""),
    token?.revokedAt || null,
    token?.expiresAt || null,
    token?.createdAt || null,
    JSON.stringify(token || {})
  ]);
  const tokenBatch = batchInsert(["id","user_id","token_hash","scope_team_id","revoked_at","expires_at","created_at","payload"], tokenRows);
  if (tokenBatch) {
    await client.query(
      `INSERT INTO app_refresh_tokens (id,user_id,token_hash,scope_team_id,revoked_at,expires_at,created_at,payload) VALUES ${tokenBatch.text}`,
      tokenBatch.values
    );
  }

  await client.query("DELETE FROM app_patients");
  const patientRows = patients.map((patient) => {
    const cpfHash = computeLookupHash(patient?.cpf, PATIENT_LOOKUP_HASH_KEY);
    const cnsHash = computeLookupHash(patient?.cns, PATIENT_LOOKUP_HASH_KEY);
    return [
      String(patient?.id || ""),
      String(patient?.teamId || ""),
      String(patient?.assignedAcsId || ""),
      String(patient?.careCategory || ""),
      Boolean(patient?.inactive),
      Boolean(patient?.incompleteProfile),
      String(patient?.name || ""),
      String(patient?.microArea || ""),
      patient?.createdAt || null,
      patient?.updatedAt || patient?.createdAt || null,
      JSON.stringify(patient || {}),
      cpfHash || null,
      cnsHash || null,
      String(patient?.unitId || ""),
      String(patient?.municipalityId || "")
    ];
  });
  // cpf_hash / cns_hash columns are added by migration 006; unit_id by 009; municipality_id by 010.
  // Use a cascade of try/catch so syncShadowTables stays backwards-compatible when migrations haven't run yet.
  const patientColsFull = ["id","team_id","assigned_acs_id","care_category","inactive","incomplete_profile","name","micro_area","created_at","updated_at","payload","cpf_hash","cns_hash","unit_id","municipality_id"];
  const patientColsNoMunicipality = ["id","team_id","assigned_acs_id","care_category","inactive","incomplete_profile","name","micro_area","created_at","updated_at","payload","cpf_hash","cns_hash","unit_id"];
  const patientColsNoUnitId = ["id","team_id","assigned_acs_id","care_category","inactive","incomplete_profile","name","micro_area","created_at","updated_at","payload","cpf_hash","cns_hash"];
  const patientColsBase = ["id","team_id","assigned_acs_id","care_category","inactive","incomplete_profile","name","micro_area","created_at","updated_at","payload"];
  try {
    const patientBatch = batchInsert(patientColsFull, patientRows);
    if (patientBatch) {
      await client.query(
        `INSERT INTO app_patients (${patientColsFull.join(",")}) VALUES ${patientBatch.text}`,
        patientBatch.values
      );
    }
  } catch (fullColErr) {
    // Try without municipality_id (migration 010 not yet applied)
    try {
      const rows = patientRows.map((r) => r.slice(0, patientColsNoMunicipality.length));
      const patientBatch = batchInsert(patientColsNoMunicipality, rows);
      if (patientBatch) {
        await client.query(
          `INSERT INTO app_patients (${patientColsNoMunicipality.join(",")}) VALUES ${patientBatch.text}`,
          patientBatch.values
        );
      }
      logWarn("sync_shadow_patients_municipality_col_missing", {
        event: "sync_shadow_patients_municipality_col_missing",
        message: "municipality_id column not yet present — migration 010 required",
        error: fullColErr.message
      });
    } catch (noMunicipalityErr) {
      // Try without unit_id + municipality_id (migration 009 not yet applied)
      try {
        const rows = patientRows.map((r) => r.slice(0, patientColsNoUnitId.length));
        const patientBatch = batchInsert(patientColsNoUnitId, rows);
        if (patientBatch) {
          await client.query(
            `INSERT INTO app_patients (${patientColsNoUnitId.join(",")}) VALUES ${patientBatch.text}`,
            patientBatch.values
          );
        }
        logWarn("sync_shadow_patients_unit_id_col_missing", {
          event: "sync_shadow_patients_unit_id_col_missing",
          message: "unit_id/municipality_id columns not yet present — migrations 009/010 required",
          error: noMunicipalityErr.message
        });
      } catch (hashColErr) {
        // Fall back to base columns if cpf_hash/cns_hash columns don't exist yet
        const baseRows = patientRows.map((r) => r.slice(0, patientColsBase.length));
        const patientBatch = batchInsert(patientColsBase, baseRows);
        if (patientBatch) {
          await client.query(
            `INSERT INTO app_patients (${patientColsBase.join(",")}) VALUES ${patientBatch.text}`,
            patientBatch.values
          );
        }
        logWarn("sync_shadow_patients_hash_col_missing", {
          event: "sync_shadow_patients_hash_col_missing",
          message: "cpf_hash/cns_hash columns not yet present — migration 006 required",
          error: hashColErr.message
        });
      }
    }
  }

  await client.query("DELETE FROM app_appointments");
  const apptRows = appointments.map((appointment) => [
    String(appointment?.id || ""),
    String(appointment?.patientId || ""),
    String(appointment?.createdBy || ""),
    String(appointment?.demandType || ""),
    String(appointment?.title || appointment?.summary || ""),
    String(appointment?.date || ""),
    appointment?.createdAt || null,
    JSON.stringify(appointment || {}),
    String(appointment?.executingTeamId || ""),
    String(appointment?.executingUnitId || "")
  ]);
  const apptColsFull = ["id","patient_id","created_by","demand_type","title","date","created_at","payload","executing_team_id","executing_unit_id"];
  const apptColsBase = ["id","patient_id","created_by","demand_type","title","date","created_at","payload"];
  try {
    const apptBatch = batchInsert(apptColsFull, apptRows);
    if (apptBatch) {
      await client.query(
        `INSERT INTO app_appointments (${apptColsFull.join(",")}) VALUES ${apptBatch.text}`,
        apptBatch.values
      );
    }
  } catch {
    // Fall back to base columns if executing_team_id/executing_unit_id don't exist yet (migration 011 not applied)
    const baseRows = apptRows.map((r) => r.slice(0, apptColsBase.length));
    const apptBatch = batchInsert(apptColsBase, baseRows);
    if (apptBatch) {
      await client.query(
        `INSERT INTO app_appointments (${apptColsBase.join(",")}) VALUES ${apptBatch.text}`,
        apptBatch.values
      );
    }
  }

  await client.query("DELETE FROM app_audit_logs");
  const auditRows = auditLogs.map((log) => [
    String(log?.id || ""),
    String(log?.action || ""),
    String(log?.category || ""),
    String(log?.severity || ""),
    String(log?.entity || ""),
    String(log?.entityId || ""),
    String(log?.teamId || ""),
    String(log?.userId || ""),
    String(log?.outcome || ""),
    log?.createdAt || null,
    JSON.stringify(log || {}),
    String(log?.municipalityId || "")
  ]);
  const auditColsFull = ["id","action","category","severity","entity","entity_id","team_id","user_id","outcome","created_at","payload","municipality_id"];
  const auditColsBase = ["id","action","category","severity","entity","entity_id","team_id","user_id","outcome","created_at","payload"];
  try {
    const auditBatch = batchInsert(auditColsFull, auditRows);
    if (auditBatch) {
      await client.query(
        `INSERT INTO app_audit_logs (${auditColsFull.join(",")}) VALUES ${auditBatch.text}`,
        auditBatch.values
      );
    }
  } catch {
    // Fall back to base columns if municipality_id column doesn't exist yet (migration 010 not applied)
    const baseRows = auditRows.map((r) => r.slice(0, auditColsBase.length));
    const auditBatch = batchInsert(auditColsBase, baseRows);
    if (auditBatch) {
      await client.query(
        `INSERT INTO app_audit_logs (${auditColsBase.join(",")}) VALUES ${auditBatch.text}`,
        auditBatch.values
      );
    }
  }

  await client.query("DELETE FROM app_role_permissions");
  const permRows = [];
  for (const [role, capabilities] of Object.entries(roleCapabilities)) {
    for (const capability of capabilities) {
      permRows.push([role, capability]);
    }
  }
  const permBatch = batchInsert(["role","capability"], permRows);
  if (permBatch) {
    await client.query(
      `INSERT INTO app_role_permissions (role,capability) VALUES ${permBatch.text}`,
      permBatch.values
    );
  }
}

function parseShadowPayload(row) {
  return row?.payload && typeof row.payload === "object" ? row.payload : null;
}

async function initialize() {
  if (initialized) return;

  if (DB_DRIVER === "postgres") {
    logInfo("db_init_connect_start", { event: "db_init_connect_start" });
    const client = await pool.connect();
    logInfo("db_init_connect_ok", { event: "db_init_connect_ok" });
    try {
      logInfo("db_init_ensure_state_start", { event: "db_init_ensure_state_start" });
      await ensurePostgresState(client);
      logInfo("db_init_ensure_state_ok", { event: "db_init_ensure_state_ok" });

      logInfo("db_init_select_state_start", { event: "db_init_select_state_start" });
      const result = await client.query("SELECT data FROM app_state WHERE id = 1");
      logInfo("db_init_select_state_ok", { event: "db_init_select_state_ok" });

      logInfo("db_init_deserialize_start", { event: "db_init_deserialize_start" });
      const snapshot = deserializeStateFromStorage(result.rows[0]?.data || {});
      const userCount = Array.isArray(snapshot?.users) ? snapshot.users.length : 0;
      const patientCount = Array.isArray(snapshot?.patients) ? snapshot.patients.length : 0;
      logInfo("db_init_deserialize_ok", { event: "db_init_deserialize_ok", userCount, patientCount });

      logInfo("db_init_sync_shadow_start", { event: "db_init_sync_shadow_start" });
      await syncShadowTables(client, snapshot);
      logInfo("db_init_sync_shadow_ok", { event: "db_init_sync_shadow_ok" });
    } finally {
      client.release();
      logInfo("db_init_client_released", { event: "db_init_client_released" });
    }
  }

  initialized = true;
  logInfo("db_initialized", { event: "db_initialized", driver: DB_DRIVER });
}

async function readDbFromPostgres() {
  await initialize();
  const now = Date.now();
  if (_dbCache && (now - _dbCacheAt) < DB_CACHE_TTL_MS) {
    return _dbCache;
  }
  const result = await pool.query("SELECT data FROM app_state WHERE id = 1");
  const data = deserializeStateFromStorage(result.rows[0]?.data || {});

  const usersEmpty = !Array.isArray(data.users) || data.users.length === 0;
  const patientsEmpty = !Array.isArray(data.patients) || data.patients.length === 0;
  if (usersEmpty || patientsEmpty) {
    logInfo("db_seed_start", { event: "db_seed_start", usersEmpty, patientsEmpty });
    let seeded = buildDefaultState();
    try {
      logInfo("db_seed_read_file_start", { event: "db_seed_read_file_start" });
      const fileSnapshot = await readDbFromFile();
      const hasUsersInFile = Array.isArray(fileSnapshot?.users) && fileSnapshot.users.length > 0;
      const hasPatientsInFile = Array.isArray(fileSnapshot?.patients) && fileSnapshot.patients.length > 0;
      logInfo("db_seed_read_file_ok", { event: "db_seed_read_file_ok", hasUsersInFile, hasPatientsInFile });
      if (hasUsersInFile || hasPatientsInFile) {
        seeded = fileSnapshot;
      }
    } catch (e) {
      logWarn("db_seed_read_file_failed", { event: "db_seed_read_file_failed", message: e?.message });
    }
    logInfo("db_seed_writing", { event: "db_seed_writing", userCount: seeded.users?.length, patientCount: seeded.patients?.length });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1",
        [JSON.stringify(seeded)]
      );
      logInfo("db_seed_sync_shadow_start", { event: "db_seed_sync_shadow_start" });
      await syncShadowTables(client, seeded);
      logInfo("db_seed_sync_shadow_ok", { event: "db_seed_sync_shadow_ok" });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    logInfo("db_seed_completed", { event: "db_seed_completed" });
    _dbCache = seeded;
    _dbCacheAt = Date.now();
    return seeded;
  }

  _dbCache = data;
  _dbCacheAt = Date.now();
  return data;
}

async function readDb() {
  if (DB_DRIVER === "postgres") {
    return readDbFromPostgres();
  }
  return readDbFromFile();
}

async function readDbForBackup() {
  if (DB_DRIVER === "postgres") {
    await initialize();
    const result = await pool.query("SELECT data FROM app_state WHERE id = 1");
    return result.rows[0]?.data || {};
  }
  return readDbSnapshotFromFileStorage();
}

// RACE-01: Transient Postgres error codes eligible for retry
const TRANSIENT_PG_CODES = new Set(["40P01", "40001", "55P03"]);
const WITHDB_MAX_RETRIES = 3;

async function _withDbPostgresAttempt(mutator, attempt) {
  await initialize();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT data FROM app_state WHERE id = 1 FOR UPDATE");
    const db = deserializeStateFromStorage(result.rows[0]?.data || {});

    const mutatorResult = await mutator(db);

    await client.query(
      "UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1",
      [JSON.stringify(serializeStateForStorage(db))]
    );
    await syncShadowTables(client, db);

    await client.query("COMMIT");
    _dbCache = db;
    _dbCacheAt = Date.now();
    return mutatorResult;
  } catch (error) {
    await client.query("ROLLBACK");
    _dbCache = null;
    if (attempt < WITHDB_MAX_RETRIES && TRANSIENT_PG_CODES.has(error.code)) {
      const delay = 50 + Math.floor(Math.random() * 100);
      logWarn("db_deadlock_retry", { event: "db_deadlock_retry", attempt, code: error.code, message: error.message, delayMs: delay });
      recordMetric("deadlock_retry", 1, { attempt, code: error.code });
      await new Promise((r) => setTimeout(r, delay));
      return _withDbPostgresAttempt(mutator, attempt + 1);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function withDb(mutator) {
  const _dbWriteStart = Date.now();
  if (DB_DRIVER === "postgres") {
    const result = await _withDbPostgresAttempt(mutator, 1);
    recordMetric("db_write_duration_ms", Date.now() - _dbWriteStart, { driver: "postgres" });
    return result;
  }

  return new Promise((resolve, reject) => {
    _fileLockChain = _fileLockChain.then(async () => {
      try {
        const db = await readDbFromFile();
        const result = await mutator(db);
        await writeDbToFile(db);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }).catch(() => {}); // evita quebrar a cadeia em caso de erro anterior
  });
}

async function listUsersSnapshot(options = {}) {
  if (!isPostgresMode()) {
    const db = await readDb();
    const list = Array.isArray(db.users) ? db.users : [];
    return list.filter((user) => {
      if (options.email && String(user?.email || "").toLowerCase() !== String(options.email || "").toLowerCase()) return false;
      if (options.id && String(user?.id || "") !== String(options.id || "")) return false;
      return true;
    });
  }
  await initialize();
  const values = [];
  const clauses = [];
  if (options.teamId) {
    values.push(String(options.teamId));
    clauses.push(`team_id = $${values.length}`);
  }
  if (options.email) {
    values.push(String(options.email).trim().toLowerCase());
    clauses.push(`LOWER(email) = $${values.length}`);
  }
  if (options.id) {
    values.push(String(options.id));
    clauses.push(`id = $${values.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await pool.query(
    `SELECT payload FROM app_users ${where} ORDER BY created_at ASC NULLS LAST, name ASC`,
    values
  );
  return result.rows.map(parseShadowPayload).filter(Boolean);
}

async function findUserByEmail(email) {
  const list = await listUsersSnapshot({ email });
  return list[0] || null;
}

async function findUserById(id) {
  const list = await listUsersSnapshot({ id });
  return list[0] || null;
}

async function findRefreshTokenByHash(tokenHash) {
  if (!isPostgresMode()) {
    const db = await readDb();
    return (Array.isArray(db.refreshTokens) ? db.refreshTokens : []).find((item) => item.tokenHash === tokenHash) || null;
  }
  await initialize();
  const result = await pool.query(
    "SELECT payload FROM app_refresh_tokens WHERE token_hash = $1 ORDER BY created_at DESC NULLS LAST LIMIT 1",
    [String(tokenHash || "")]
  );
  return parseShadowPayload(result.rows[0]) || null;
}

async function listPatientsSnapshot(options = {}) {
  if (!isPostgresMode()) {
    const db = await readDb();
    const list = Array.isArray(db.patients) ? db.patients : [];
    return list.filter((patient) => {
      if (options.teamId && String(patient?.teamId || "") !== String(options.teamId || "")) return false;
      if (options.assignedAcsId && String(patient?.assignedAcsId || "") !== String(options.assignedAcsId || "")) return false;
      if (options.careCategory && String(patient?.careCategory || "") !== String(options.careCategory || "")) return false;
      if (options.microArea && String(patient?.microArea || "") !== String(options.microArea || "")) return false;
      if (options.id && String(patient?.id || "") !== String(options.id || "")) return false;
      return true;
    });
  }
  await initialize();
  const values = [];
  const clauses = [];
  if (options.teamId) {
    values.push(String(options.teamId));
    clauses.push(`team_id = $${values.length}`);
  }
  if (options.assignedAcsId) {
    values.push(String(options.assignedAcsId));
    clauses.push(`assigned_acs_id = $${values.length}`);
  }
  if (options.careCategory) {
    values.push(String(options.careCategory));
    clauses.push(`care_category = $${values.length}`);
  }
  if (options.microArea) {
    values.push(String(options.microArea));
    clauses.push(`micro_area = $${values.length}`);
  }
  if (options.id) {
    values.push(String(options.id));
    clauses.push(`id = $${values.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await pool.query(
    `SELECT payload FROM app_patients ${where} ORDER BY inactive ASC, name ASC`,
    values
  );
  return result.rows.map(parseShadowPayload).filter(Boolean);
}

async function findPatientByIdSnapshot(id) {
  const list = await listPatientsSnapshot({ id });
  return list[0] || null;
}

async function listAppointmentsByPatientId(patientId) {
  if (!isPostgresMode()) {
    const db = await readDb();
    return (Array.isArray(db.appointments) ? db.appointments : []).filter((item) => item.patientId === patientId);
  }
  await initialize();
  const result = await pool.query(
    "SELECT payload FROM app_appointments WHERE patient_id = $1 ORDER BY date DESC, created_at DESC NULLS LAST",
    [String(patientId || "")]
  );
  return result.rows.map(parseShadowPayload).filter(Boolean);
}

async function listAuditLogsSnapshot(filters = {}, options = {}) {
  if (!isPostgresMode()) {
    const db = await readDb();
    let list = Array.isArray(db.auditLogs) ? db.auditLogs : [];
    if (filters.teamId) list = list.filter((l) => String(l.teamId || "") === String(filters.teamId));
    if (filters.category) list = list.filter((l) => String(l.category || "") === filters.category);
    if (filters.action) list = list.filter((l) => String(l.action || "") === filters.action);
    if (filters.from) list = list.filter((l) => String(l.createdAt || "") >= filters.from);
    if (filters.to) list = list.filter((l) => String(l.createdAt || "") <= filters.to);
    if (filters.patientId) {
      const pid = String(filters.patientId);
      list = list.filter((l) => (
        (l.entity === "patient" && String(l.entityId || "") === pid) ||
        String((l.details && l.details.patientId) || "") === pid ||
        String((l.after && l.after.patientId) || "") === pid ||
        String((l.before && l.before.patientId) || "") === pid
      ));
    }
    if (filters.severity) list = list.filter((l) => String(l.severity || "") === String(filters.severity));
    if (filters.entity) list = list.filter((l) => String(l.entity || "") === String(filters.entity));
    if (filters.outcome) list = list.filter((l) => String(l.outcome || "") === String(filters.outcome));
    // Sort most-recent first (mirrors Postgres ORDER BY created_at DESC) before cursor/limit
    list = list.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    // cursor: skip entries with createdAt >= cursor (same semantics as Postgres created_at < $cursor)
    if (filters.cursor) {
      list = list.filter((l) => String(l.createdAt || "") < filters.cursor);
    }
    return options.limit ? list.slice(0, options.limit) : list;
  }
  await initialize();
  const values = [];
  const clauses = [];
  if (filters.patientId) {
    values.push(String(filters.patientId));
    clauses.push(`(
      (entity = 'patient' AND entity_id = $${values.length})
      OR (payload->'details'->>'patientId') = $${values.length}
      OR (payload->'after'->>'patientId') = $${values.length}
      OR (payload->'before'->>'patientId') = $${values.length}
    )`);
  }
  if (filters.category) {
    values.push(String(filters.category));
    clauses.push(`category = $${values.length}`);
  }
  if (filters.severity) {
    values.push(String(filters.severity));
    clauses.push(`severity = $${values.length}`);
  }
  if (filters.action) {
    values.push(String(filters.action));
    clauses.push(`action = $${values.length}`);
  }
  if (filters.entity) {
    values.push(String(filters.entity));
    clauses.push(`entity = $${values.length}`);
  }
  if (filters.outcome) {
    values.push(String(filters.outcome));
    clauses.push(`outcome = $${values.length}`);
  }
  if (filters.teamId) {
    values.push(String(filters.teamId));
    clauses.push(`team_id = $${values.length}`);
  }
  if (filters.from) {
    values.push(String(filters.from));
    clauses.push(`created_at >= $${values.length}::timestamptz`);
  }
  if (filters.to) {
    values.push(String(filters.to));
    clauses.push(`created_at <= $${values.length}::timestamptz`);
  }
  if (filters.cursor) {
    values.push(String(filters.cursor));
    clauses.push(`created_at < $${values.length}::timestamptz`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limitClause = options.limit ? `LIMIT ${Number(options.limit)}` : "";
  const result = await pool.query(
    `SELECT payload FROM app_audit_logs ${where} ORDER BY created_at DESC NULLS LAST ${limitClause}`,
    values
  );
  return result.rows.map(parseShadowPayload).filter(Boolean);
}

async function listRolePermissionsSnapshot(role = "") {
  if (!isPostgresMode()) {
    return getRoleCapabilities(role);
  }
  await initialize();
  const result = await pool.query(
    "SELECT capability FROM app_role_permissions WHERE role = $1 ORDER BY capability ASC",
    [canonicalRole(role)]
  );
  return result.rows.map((row) => String(row.capability || "")).filter(Boolean);
}

async function checkDbHealth() {
  if (!isPostgresMode()) {
    try {
      await fs.access(DB_PATH);
      return { ok: true, driver: DB_DRIVER };
    } catch (error) {
      return { ok: false, driver: DB_DRIVER, error: error.message };
    }
  }

  try {
    const result = await pool.query("SELECT 1 AS ok");
    return { ok: result.rows?.[0]?.ok === 1, driver: DB_DRIVER };
  } catch (error) {
    return { ok: false, driver: DB_DRIVER, error: error.message };
  }
}

async function closeDbPool() {
  if (!pool) return;
  await pool.end();
}

const _testExports = { encryptText, decryptText };

export {
  pool,
  isPostgresMode,
  computeLookupHash,
  readDb,
  readDbForBackup,
  withDb,
  listUsersSnapshot,
  findUserByEmail,
  findUserById,
  findRefreshTokenByHash,
  listPatientsSnapshot,
  findPatientByIdSnapshot,
  listAppointmentsByPatientId,
  listAuditLogsSnapshot,
  listRolePermissionsSnapshot,
  checkDbHealth,
  closeDbPool,
  _testExports
};
