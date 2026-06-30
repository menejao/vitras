/**
 * citizen-portal-auth.js — Identidade e autenticação do Portal do Cidadão
 *
 * Endpoints públicos (sem requireAuth):
 *   POST /citizen-portal/auth/first-access/check-cpf   — CPF existe?
 *   POST /citizen-portal/auth/first-access/verify       — dados conferem com cadastro UBS?
 *   POST /citizen-portal/auth/first-access/create       — cria conta vinculada ao paciente
 *   POST /citizen-portal/auth/login                     — login com CPF + senha
 *
 * Endpoints autenticados (token de cidadão, audience :citizen):
 *   POST /citizen-portal/auth/logout
 *   GET  /citizen-portal/me
 *
 * Token de cidadão usa audience separada (`${JWT_AUDIENCE}:citizen`) —
 * tokens profissionais NÃO passam nessa audience e vice-versa.
 */

import express        from "express";
import jwt            from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb, computeLookupHash } from "../db.js";
import { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE, PATIENT_LOOKUP_HASH_KEY } from "../config.js";
import { hashPassword, verifyPassword }      from "../services/crypto.js";
import { addAuditLog }                        from "../services/audit.js";

const router = express.Router();
const CITIZEN_AUDIENCE   = `${JWT_AUDIENCE}:citizen`;
const CITIZEN_EXPIRES    = "8h";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureCitizenShape(db) {
  if (!Array.isArray(db.citizenUsers)) db.citizenUsers = [];
}

/** Brazilian CPF digit-verification algorithm */
function isValidCpf(cpf) {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = 11 - (sum % 11); if (r >= 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = 11 - (sum % 11); if (r >= 10) r = 0;
  return r === parseInt(d[10]);
}

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDate(s) {
  const str = String(s || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return str;
}

function normalizePhone(s) {
  return String(s || "").replace(/\D/g, "");
}

/** Minimal actor for public endpoints (no req.user available) */
function buildPublicActor(req) {
  return {
    id:     null,
    name:   "citizen-portal-public",
    role:   "citizen",
    teamId: null,
    requestMeta: {
      ip:            req.ip || req.socket?.remoteAddress || "",
      userAgent:     req.get("user-agent") || "",
      method:        req.method,
      path:          req.path,
      authTransport: "none",
    }
  };
}

function createCitizenToken(citizenUser) {
  return jwt.sign(
    {
      jti:       uuidv4(),
      sub:       citizenUser.id,
      patientId: citizenUser.patientId,
      role:      "citizen",
      unitId:    citizenUser.unitId || null,
      nome:      citizenUser.nome   || "",
    },
    JWT_SECRET,
    { expiresIn: CITIZEN_EXPIRES, issuer: JWT_ISSUER, audience: CITIZEN_AUDIENCE, algorithm: "HS256" }
  );
}

function requireCitizenAuth(req, res, next) {
  const raw = req.headers.authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Não autenticado" });
  try {
    req.citizen = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER, audience: CITIZEN_AUDIENCE, algorithms: ["HS256"]
    });
    next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Faça login novamente." });
  }
}

// ── POST /citizen-portal/auth/first-access/check-cpf ─────────────────────────
// Verifica se CPF existe no cadastro VITRAS e se já tem conta no Portal.
router.post("/citizen-portal/auth/first-access/check-cpf", async (req, res) => {
  const { cpf: rawCpf } = req.body || {};
  const cpf = String(rawCpf || "").replace(/\D/g, "");

  if (!isValidCpf(cpf)) {
    return res.status(400).json({ error: "CPF inválido" });
  }

  const db = await readDb();
  ensureCitizenShape(db);

  const cpfHash = computeLookupHash(cpf, PATIENT_LOOKUP_HASH_KEY);

  // Já tem conta ativa no Portal?
  const hasPortalAccount = db.citizenUsers.some(u => u.cpfHash === cpfHash && u.status === "ACTIVE");
  if (hasPortalAccount) {
    return res.json({ exists: true, hasPortalAccount: true });
  }

  // Existe paciente com este CPF no VITRAS?
  // Após readDb(), patient.cpf está descriptografado em memória.
  const patient = (db.patients || []).find(p => p.cpf === cpf && !p.deletedAt);
  if (!patient) {
    const actor = buildPublicActor(req);
    withDb(dbw => {
      ensureCitizenShape(dbw);
      addAuditLog(dbw, actor, "CITIZEN_FIRST_ACCESS_CPF_NOT_FOUND", "citizen_auth", "none", {
        outcome: "not_found",
        cpfSuffix: cpf.slice(-4),
      });
    }).catch(() => {});
    return res.json({ exists: false, hasPortalAccount: false });
  }

  return res.json({ exists: true, hasPortalAccount: false });
});

// ── POST /citizen-portal/auth/first-access/verify ────────────────────────────
// Verifica identidade comparando com cadastro UBS.
// Retorna verifyToken (10 min) se compatível.
router.post("/citizen-portal/auth/first-access/verify", async (req, res) => {
  const { cpf: rawCpf, birthDate, name, motherName, phone } = req.body || {};
  const cpf = String(rawCpf || "").replace(/\D/g, "");

  if (!isValidCpf(cpf))   return res.status(400).json({ error: "CPF inválido" });
  if (!birthDate || !name) return res.status(400).json({ error: "Data de nascimento e nome são obrigatórios" });

  const db      = await readDb();
  const patient = (db.patients || []).find(p => p.cpf === cpf && !p.deletedAt);
  const actor   = buildPublicActor(req);

  if (!patient) {
    withDb(dbw => {
      ensureCitizenShape(dbw);
      addAuditLog(dbw, actor, "CITIZEN_FIRST_ACCESS_VERIFY_NO_PATIENT", "citizen_auth", "none", {
        outcome: "not_found", cpfSuffix: cpf.slice(-4),
      });
    }).catch(() => {});
    return res.json({ compatible: false, reason: "not_found" });
  }

  const inBirthDate  = normalizeDate(birthDate);
  const dbBirthDate  = normalizeDate(patient.birthDate);
  const inName       = normalizeName(name);
  const dbName       = normalizeName(patient.name);

  const birthDateMatch = !!(inBirthDate && dbBirthDate && inBirthDate === dbBirthDate);
  const nameMatch      = !!(inName && dbName && inName === dbName);
  const compatible     = birthDateMatch && nameMatch;

  withDb(dbw => {
    ensureCitizenShape(dbw);
    addAuditLog(dbw, actor,
      compatible ? "CITIZEN_FIRST_ACCESS_VERIFY_OK" : "CITIZEN_FIRST_ACCESS_VERIFY_DIVERGENCE",
      "citizen_auth", patient.id,
      { outcome: compatible ? "success" : "divergence", cpfSuffix: cpf.slice(-4), birthDateMatch, nameMatch }
    );
  }).catch(() => {});

  if (!compatible) {
    return res.json({ compatible: false, reason: "divergence" });
  }

  const cpfHash    = computeLookupHash(cpf, PATIENT_LOOKUP_HASH_KEY);
  const verifyToken = jwt.sign(
    { sub: patient.id, cpfHash, purpose: "first-access" },
    JWT_SECRET,
    { expiresIn: "10m", issuer: JWT_ISSUER, audience: CITIZEN_AUDIENCE, algorithm: "HS256" }
  );

  return res.json({
    compatible: true,
    verifyToken,
    hint: {
      nomeExibicao: (patient.name || "").split(" ")[0],
      unitId:       patient.unitId || null,
    }
  });
});

// ── POST /citizen-portal/auth/first-access/create ────────────────────────────
// Cria conta no Portal vinculada ao paciente validado.
router.post("/citizen-portal/auth/first-access/create", async (req, res) => {
  const { verifyToken, senha, confirmSenha, aceitaTermos, aceitaPrivacidade } = req.body || {};

  if (!verifyToken)                  return res.status(400).json({ error: "Token de verificação obrigatório" });
  if (!aceitaTermos)                 return res.status(400).json({ error: "Aceite dos termos de uso é obrigatório" });
  if (!aceitaPrivacidade)            return res.status(400).json({ error: "Aceite da política de privacidade é obrigatório" });
  if (!senha || senha.length < 8)    return res.status(400).json({ error: "Senha deve ter pelo menos 8 caracteres" });
  if (senha !== confirmSenha)        return res.status(400).json({ error: "Confirmação de senha não confere" });

  let verifyPayload;
  try {
    verifyPayload = jwt.verify(verifyToken, JWT_SECRET, {
      issuer: JWT_ISSUER, audience: CITIZEN_AUDIENCE, algorithms: ["HS256"]
    });
    if (verifyPayload.purpose !== "first-access") throw new Error("invalid");
  } catch {
    return res.status(400).json({ error: "Token de verificação inválido ou expirado. Reinicie o processo de primeiro acesso." });
  }

  const { sub: patientId, cpfHash } = verifyPayload;

  const result = await withDb((db) => {
    ensureCitizenShape(db);

    const patient = (db.patients || []).find(p => p.id === patientId && !p.deletedAt);
    if (!patient) return { error: { status: 404, message: "Paciente não encontrado no sistema" } };

    const alreadyExists = db.citizenUsers.find(u => u.cpfHash === cpfHash && u.status === "ACTIVE");
    if (alreadyExists) return { error: { status: 409, message: "Já existe uma conta ativa para este CPF" } };

    const now         = new Date().toISOString();
    const citizenUser = {
      id:                  uuidv4(),
      patientId,
      cpfHash,
      passwordHash:        hashPassword(senha),
      status:              "ACTIVE",
      unitId:              patient.unitId || null,
      nome:                patient.name   || "",
      email:               patient.email  || null,
      telefone:            patient.phone  || null,
      aceitaTermosAt:      now,
      aceitaPrivacidadeAt: now,
      createdAt:           now,
      updatedAt:           now,
      lastLoginAt:         null,
    };
    db.citizenUsers.push(citizenUser);

    const actor = { id: citizenUser.id, name: patient.name || "Cidadão", role: "citizen", teamId: null,
      requestMeta: { ip: "", userAgent: "", method: "POST", path: "/citizen-portal/auth/first-access/create", authTransport: "none" } };
    addAuditLog(db, actor, "CITIZEN_ACCOUNT_CREATED", "citizen_user", citizenUser.id, {
      outcome: "success", patientId, cpfSuffix: "****",
    });

    return { citizenUser };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });

  const { citizenUser } = result;
  const token = createCitizenToken(citizenUser);

  return res.status(201).json({
    token,
    cidadao: { id: citizenUser.id, nome: citizenUser.nome, unitId: citizenUser.unitId }
  });
});

// ── POST /citizen-portal/auth/login ──────────────────────────────────────────
router.post("/citizen-portal/auth/login", async (req, res) => {
  const { cpf: rawCpf, senha } = req.body || {};
  const cpf = String(rawCpf || "").replace(/\D/g, "");

  if (!isValidCpf(cpf)) return res.status(400).json({ error: "CPF inválido" });
  if (!senha)            return res.status(400).json({ error: "Senha obrigatória" });

  const cpfHash = computeLookupHash(cpf, PATIENT_LOOKUP_HASH_KEY);
  const db      = await readDb();
  ensureCitizenShape(db);

  const citizenUser = db.citizenUsers.find(u => u.cpfHash === cpfHash && u.status === "ACTIVE");
  const actor       = buildPublicActor(req);

  // Run password check unconditionally to avoid timing attacks
  const testHash = citizenUser ? citizenUser.passwordHash : hashPassword("dummy-no-match");
  const passwordOk = verifyPassword(senha, testHash) && !!citizenUser;

  if (!passwordOk) {
    withDb(dbw => {
      ensureCitizenShape(dbw);
      addAuditLog(dbw, actor, "CITIZEN_LOGIN_FAILED", "citizen_auth", citizenUser?.id || "none", {
        outcome: "failure",
        reason:  !citizenUser ? "account_not_found" : "wrong_password",
        cpfSuffix: cpf.slice(-4),
      });
    }).catch(() => {});
    return res.status(401).json({ error: "CPF ou senha incorretos" });
  }

  await withDb(dbw => {
    ensureCitizenShape(dbw);
    const idx = dbw.citizenUsers.findIndex(u => u.id === citizenUser.id);
    if (idx >= 0) {
      dbw.citizenUsers[idx] = { ...dbw.citizenUsers[idx], lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }
    const loginActor = { ...actor, id: citizenUser.id, name: citizenUser.nome, requestMeta: { ...actor.requestMeta, authTransport: "bearer" } };
    addAuditLog(dbw, loginActor, "CITIZEN_LOGIN_SUCCESS", "citizen_auth", citizenUser.id, { outcome: "success" });
  });

  const db2   = await readDb();
  const unit  = (db2.units || []).find(u => u.id === citizenUser.unitId);
  const token = createCitizenToken(citizenUser);

  return res.json({
    token,
    cidadao: {
      id:       citizenUser.id,
      nome:     citizenUser.nome,
      unitId:   citizenUser.unitId,
      unitName: unit?.name || null,
    }
  });
});

// ── POST /citizen-portal/auth/logout ─────────────────────────────────────────
router.post("/citizen-portal/auth/logout", requireCitizenAuth, async (req, res) => {
  const { sub: citizenUserId, nome = "" } = req.citizen;
  withDb(dbw => {
    ensureCitizenShape(dbw);
    const logoutActor = {
      id: citizenUserId, name: nome, role: "citizen", teamId: null,
      requestMeta: { ip: req.ip || "", userAgent: req.get("user-agent") || "", method: req.method, path: req.path, authTransport: "bearer" }
    };
    addAuditLog(dbw, logoutActor, "CITIZEN_LOGOUT", "citizen_auth", citizenUserId, { outcome: "success" });
  }).catch(() => {});
  return res.json({ ok: true });
});

// ── GET /citizen-portal/me ────────────────────────────────────────────────────
// Retorna apenas dados necessários ao Portal — sem dados clínicos.
router.get("/citizen-portal/me", requireCitizenAuth, async (req, res) => {
  const { sub: citizenUserId, patientId, unitId } = req.citizen;

  const db          = await readDb();
  ensureCitizenShape(db);

  const citizenUser = db.citizenUsers.find(u => u.id === citizenUserId && u.status === "ACTIVE");
  if (!citizenUser) return res.status(401).json({ error: "Conta não encontrada ou inativa" });

  const patient = (db.patients || []).find(p => p.id === patientId);
  const unit    = (db.units   || []).find(u => u.id === (citizenUser.unitId || unitId));
  const team    = patient?.teamId ? (db.teams || []).find(t => t.id === patient.teamId) : null;

  return res.json({
    id:             citizenUser.id,
    nome:           citizenUser.nome,
    email:          citizenUser.email   || null,
    telefone:       citizenUser.telefone || null,
    unitId:         citizenUser.unitId  || null,
    unitName:       unit?.name          || null,
    municipalityId: patient?.municipalityId || null,
    teamId:         patient?.teamId     || null,
    teamName:       team?.name          || null,
    assignedAcsId:  patient?.assignedAcsId || null,
    lastLoginAt:    citizenUser.lastLoginAt,
    createdAt:      citizenUser.createdAt,
  });
});

export { requireCitizenAuth };
export default router;
