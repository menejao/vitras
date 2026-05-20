// Copyright (c) 2026 Vitras. Todos os direitos reservados.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Pool } from "pg";
import { canonicalRole, getRoleCapabilities } from "./utils/helpers.js";

const DB_PATH = process.env.TEST_DB_PATH
  ? path.resolve(process.env.TEST_DB_PATH)
  : path.resolve(process.cwd(), "data", "db.json");
const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const DB_DRIVER = DATABASE_URL ? "postgres" : "file";
const DATA_ENCRYPTION_KEY = String(process.env.DATA_ENCRYPTION_KEY || "").trim();
const ENC_PREFIX = "enc1:";
const SENSITIVE_PATIENT_FIELDS = ["cpf", "cns", "cnsCpf"];
const SENSITIVE_USER_FIELDS = ["twoFactorSecret", "twoFactorPendingSecret"];

// Strip SSL-related query params from the connection string so they cannot
// override the explicit ssl:{rejectUnauthorized:false} config below.
// AWS RDS / Neon / Supabase append sslmode=require or sslmode=verify-full
// which causes SELF_SIGNED_CERT_IN_CHAIN in Node when the AWS CA bundle
// is not in the system trust store.
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
  console.log("[db] SSL enabled — rejectUnauthorized=false (RDS/Neon compatible)");
  pool.on("error", (err) => {
    console.error("[db:pool] idle client error:", err.message, err.code);
  });
}

let _dbCache = null;
let _dbCacheAt = 0;
const DB_CACHE_TTL_MS = 1500;

let initialized = false;

function isPostgresMode() {
  return DB_DRIVER === "postgres";
}

function getEncryptionKey() {
  if (!DATA_ENCRYPTION_KEY) return null;
  return crypto.createHash("sha256").update(DATA_ENCRYPTION_KEY).digest();
}

function isEncryptedText(value) {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

function encryptText(value, key) {
  const raw = String(value || "");
  if (!raw) return "";
  if (!key) return raw;
  if (isEncryptedText(raw)) return raw;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

function decryptText(value, key) {
  const raw = String(value || "");
  if (!raw) return "";
  if (!isEncryptedText(raw)) return raw;
  if (!key) throw new Error("DATA_ENCRYPTION_KEY ausente para descriptografar dados sensíveis");

  const [, payload] = raw.split(ENC_PREFIX);
  const [ivB64, encB64, tagB64] = String(payload || "").split(":");
  if (!ivB64 || !encB64 || !tagB64) throw new Error("Formato inválido de dado criptografado");
  const iv = Buffer.from(ivB64, "base64");
  const encrypted = Buffer.from(encB64, "base64");
  const tag = Buffer.from(tagB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

function cloneState(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function transformSensitiveState(state, mode) {
  const key = getEncryptionKey();
  const data = cloneState(state || {});
  const transform = mode === "encrypt"
    ? (value) => encryptText(value, key)
    : (value) => decryptText(value, key);

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
    teams: [
      {
        id: "team-ana",
        name: "Equipe Enfermeira Ana",
        managerUserId: "u1",
        createdAt: now
      }
    ],
    users: [
      {
        id: "u1",
        name: "Enfermeira Ana",
        role: "nurse_manager",
        email: "ana@clinica.local",
        password: hashDefaultPassword("123456"),
        teamId: "team-ana",
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
        createdAt: now
      }
    ],
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
  const refreshTokens = Array.isArray(state?.refreshTokens) ? state.refreshTokens : [];
  const auditLogs = Array.isArray(state?.auditLogs) ? state.auditLogs : [];
  const patients = Array.isArray(state?.patients) ? state.patients : [];
  const appointments = Array.isArray(state?.appointments) ? state.appointments : [];
  const roleCapabilities = buildPermissionMap();

  await client.query("DELETE FROM app_users");
  const userRows = users.map((user) => [
    String(user?.id || ""),
    String(user?.teamId || ""),
    String(user?.role || ""),
    String(user?.email || ""),
    String(user?.name || ""),
    Boolean(user?.inactive),
    Boolean(user?.twoFactorEnabled),
    user?.createdAt || null,
    user?.updatedAt || user?.createdAt || null,
    JSON.stringify(user || {})
  ]);
  const userBatch = batchInsert(["id","team_id","role","email","name","inactive","two_factor_enabled","created_at","updated_at","payload"], userRows);
  if (userBatch) {
    await client.query(
      `INSERT INTO app_users (id,team_id,role,email,name,inactive,two_factor_enabled,created_at,updated_at,payload) VALUES ${userBatch.text}`,
      userBatch.values
    );
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
  const patientRows = patients.map((patient) => [
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
    JSON.stringify(patient || {})
  ]);
  const patientBatch = batchInsert(["id","team_id","assigned_acs_id","care_category","inactive","incomplete_profile","name","micro_area","created_at","updated_at","payload"], patientRows);
  if (patientBatch) {
    await client.query(
      `INSERT INTO app_patients (id,team_id,assigned_acs_id,care_category,inactive,incomplete_profile,name,micro_area,created_at,updated_at,payload) VALUES ${patientBatch.text}`,
      patientBatch.values
    );
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
    JSON.stringify(appointment || {})
  ]);
  const apptBatch = batchInsert(["id","patient_id","created_by","demand_type","title","date","created_at","payload"], apptRows);
  if (apptBatch) {
    await client.query(
      `INSERT INTO app_appointments (id,patient_id,created_by,demand_type,title,date,created_at,payload) VALUES ${apptBatch.text}`,
      apptBatch.values
    );
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
    JSON.stringify(log || {})
  ]);
  const auditBatch = batchInsert(["id","action","category","severity","entity","entity_id","team_id","user_id","outcome","created_at","payload"], auditRows);
  if (auditBatch) {
    await client.query(
      `INSERT INTO app_audit_logs (id,action,category,severity,entity,entity_id,team_id,user_id,outcome,created_at,payload) VALUES ${auditBatch.text}`,
      auditBatch.values
    );
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
    console.log("[db:init] pool.connect — início");
    const client = await pool.connect();
    console.log("[db:init] pool.connect — OK");
    try {
      console.log("[db:init] ensurePostgresState — início");
      await ensurePostgresState(client);
      console.log("[db:init] ensurePostgresState — OK");

      console.log("[db:init] SELECT app_state — início");
      const result = await client.query("SELECT data FROM app_state WHERE id = 1");
      console.log("[db:init] SELECT app_state — OK");

      console.log("[db:init] deserializeStateFromStorage — início");
      const snapshot = deserializeStateFromStorage(result.rows[0]?.data || {});
      const userCount = Array.isArray(snapshot?.users) ? snapshot.users.length : 0;
      const patientCount = Array.isArray(snapshot?.patients) ? snapshot.patients.length : 0;
      console.log(`[db:init] deserialize — OK users=${userCount} patients=${patientCount}`);

      console.log("[db:init] syncShadowTables — início");
      await syncShadowTables(client, snapshot);
      console.log("[db:init] syncShadowTables — OK");
    } finally {
      client.release();
      console.log("[db:init] client.release — OK");
    }
  }

  initialized = true;
  console.log(`[db:init] initialized — driver=${DB_DRIVER}`);
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
    console.log(`[db:seed] app_state vazio (users=${usersEmpty} patients=${patientsEmpty}) — seeding`);
    let seeded = buildDefaultState();
    try {
      console.log("[db:seed] readDbFromFile — início");
      const fileSnapshot = await readDbFromFile();
      const hasUsersInFile = Array.isArray(fileSnapshot?.users) && fileSnapshot.users.length > 0;
      const hasPatientsInFile = Array.isArray(fileSnapshot?.patients) && fileSnapshot.patients.length > 0;
      console.log(`[db:seed] readDbFromFile — OK usersInFile=${hasUsersInFile} patientsInFile=${hasPatientsInFile}`);
      if (hasUsersInFile || hasPatientsInFile) {
        seeded = fileSnapshot;
      }
    } catch (e) {
      console.log(`[db:seed] readDbFromFile — falhou (${e?.message}) — usando buildDefaultState`);
    }
    console.log(`[db:seed] gravando no Postgres users=${seeded.users?.length} patients=${seeded.patients?.length}`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE app_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1",
        [JSON.stringify(seeded)]
      );
      console.log("[db:seed] syncShadowTables — início");
      await syncShadowTables(client, seeded);
      console.log("[db:seed] syncShadowTables — OK");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    console.log("[db:seed] seed concluído");
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

async function withDb(mutator) {
  if (DB_DRIVER === "postgres") {
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
      throw error;
    } finally {
      client.release();
    }
  }

  const db = await readDbFromFile();
  const result = await mutator(db);
  await writeDbToFile(db);
  return result;
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
    const list = Array.isArray(db.auditLogs) ? db.auditLogs : [];
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

export {
  isPostgresMode,
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
  listRolePermissionsSnapshot
};
