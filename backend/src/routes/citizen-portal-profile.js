/**
 * citizen-portal-profile.js — Meu Cadastro do Portal do Cidadão
 *
 * Endpoints (todos requerem token de cidadão):
 *   GET  /citizen-portal/profile                         — dados do perfil (leitura)
 *   PUT  /citizen-portal/profile/contact                 — atualizar telefone ou e-mail (exige verifyToken OTP)
 *   POST /citizen-portal/profile/contact/request-code    — solicitar OTP para contato
 *   POST /citizen-portal/profile/contact/confirm-code    — confirmar OTP → retorna verifyToken
 *   PUT  /citizen-portal/profile/password                — alterar senha (exige senha atual)
 *   GET  /citizen-portal/profile/preferences             — preferências de comunicação
 *   PUT  /citizen-portal/profile/preferences             — atualizar preferências
 *
 * Regras:
 *   - CPF, CNS, nome, dataNasc, nomeMae, endereço, UBS, equipe, ACS: SOMENTE LEITURA
 *   - Alterações em telefone e e-mail exigem confirmação por OTP
 *   - Códigos OTP são hasheados no DB — NUNCA armazenados em plaintext
 *   - Auditoria de todas as ações (sem registrar OTP, senha ou CPF completo)
 */

import express       from "express";
import jwt           from "jsonwebtoken";
import crypto        from "crypto";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { addAuditLog }    from "../services/audit.js";
import { hashPassword, verifyPassword } from "../services/crypto.js";
import { sendPhoneOtp, sendEmailOtp }   from "../services/otpProvider.js";
import { requireCitizenAuth }           from "./citizen-portal-auth.js";

const router = express.Router();

const JWT_SECRET       = process.env.JWT_SECRET       || "dev-secret";
const JWT_AUDIENCE     = process.env.JWT_AUDIENCE     || "vitras";
const CITIZEN_AUDIENCE = `${JWT_AUDIENCE}:citizen`;

// OTP config
const OTP_TTL_MINUTES   = 10;
const OTP_MAX_ATTEMPTS  = 3;
const OTP_COOLDOWN_SEC  = 60;   // mínimo entre reenvios
const VERIFY_TOKEN_TTL  = "8m"; // bridge token após OTP confirmado

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashOtp(code) {
  return crypto.createHmac("sha256", JWT_SECRET).update(code).digest("hex");
}

function generateOtpCode() {
  // 6 dígitos numéricos criptograficamente aleatórios
  return String(Math.floor(100000 + (crypto.randomInt(900000)))).padStart(6, "0");
}

function maskPhone(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length < 8) return "****";
  return d.slice(0, 2) + "*".repeat(d.length - 4) + d.slice(-2);
}

function maskEmail(email) {
  if (!email || !email.includes("@")) return "****";
  const [user, domain] = email.split("@");
  const visible = user.length > 2 ? user.slice(0, 2) : user[0] || "*";
  return `${visible}***@${domain}`;
}

function maskCpf(cpf) {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return "***.***.***-**";
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`.replace(/\d/g, (c, i) => i < 10 ? "*" : c);
}

function maskCns(cns) {
  const d = String(cns || "").replace(/\D/g, "");
  if (!d) return null;
  return "*".repeat(Math.max(0, d.length - 4)) + d.slice(-4);
}

function ensureOtpShape(db) {
  if (!Array.isArray(db.citizenPortalOtpCodes)) db.citizenPortalOtpCodes = [];
}

function ensureCitizenShape(db) {
  if (!Array.isArray(db.citizenUsers)) db.citizenUsers = [];
}

function actorFromReq(req, citizenUser) {
  return {
    id: citizenUser.id, name: citizenUser.nome || "Cidadão",
    role: "citizen", teamId: null,
    requestMeta: {
      ip: req.ip || "", userAgent: req.headers["user-agent"] || "",
      method: req.method, path: req.path, authTransport: "bearer",
    },
  };
}

/** Avalia qualidade do cadastro do cidadão */
function avaliarQualidade(citizenUser, patient) {
  const problemas = [];
  if (!citizenUser.email)    problemas.push("e-mail não cadastrado");
  if (!citizenUser.telefone) problemas.push("telefone não cadastrado");
  if (!patient?.birthDate)   problemas.push("data de nascimento ausente");
  if (!patient?.address)     problemas.push("endereço não cadastrado");

  if (problemas.length === 0) return { nivel: "verde",    texto: "Cadastro atualizado", problemas: [] };
  if (problemas.length <= 2)  return { nivel: "amarelo",  texto: "Cadastro incompleto", problemas };
  return { nivel: "vermelho", texto: "Cadastro necessita atualização", problemas: [] }; // omitir detalhes quando muitos
}

// ── GET /citizen-portal/profile ───────────────────────────────────────────────
router.get("/citizen-portal/profile", requireCitizenAuth, async (req, res) => {
  const { sub: citizenUserId, patientId } = req.citizen;
  const db = await readDb();
  ensureCitizenShape(db);

  const citizenUser = db.citizenUsers.find(u => u.id === citizenUserId);
  if (!citizenUser) return res.status(401).json({ error: "Conta não encontrada" });

  const patient = (db.patients || []).find(p => p.id === patientId);
  const unit    = (db.units   || []).find(u => u.id === citizenUser.unitId);
  const team    = patient?.teamId ? (db.teams || []).find(t => t.id === patient.teamId) : null;
  const acs     = patient?.assignedAcsId ? (db.users || []).find(u => u.id === patient.assignedAcsId) : null;

  return res.json({
    // Dados editáveis — do citizenUser
    editavel: {
      telefone:  citizenUser.telefone  || null,
      email:     citizenUser.email     || null,
      preferencias: citizenUser.preferencias || {
        notificacoes: true, whatsapp: false, emailAtivo: false, sms: false,
      },
    },
    // Dados oficiais — somente leitura, do patient APS
    oficial: {
      nome:       citizenUser.nome      || patient?.name   || null,
      cpf:        maskCpf(patient?.cpf),
      cns:        maskCns(patient?.cns),
      dataNasc:   patient?.birthDate    || null,
      nomeMae:    patient?.motherName   || null,
      // Endereço
      endereco:   patient?.address?.street    || null,
      numero:     patient?.address?.number    || null,
      bairro:     patient?.address?.neighborhood || null,
      municipio:  patient?.address?.city      || null,
      cep:        patient?.address?.cep       || null,
      uf:         patient?.address?.state     || null,
      // APS
      ubsNome:    unit?.name   || unit?.nome  || null,
      equipeNome: team?.name   || null,
      acsNome:    acs?.name    || null,
    },
    // Qualidade cadastral
    qualidade: avaliarQualidade(citizenUser, patient),
    // Metadados
    meta: {
      createdAt:   citizenUser.createdAt,
      lastLoginAt: citizenUser.lastLoginAt,
    },
  });
});

// ── POST /citizen-portal/profile/contact/request-code ────────────────────────
router.post("/citizen-portal/profile/contact/request-code", requireCitizenAuth, async (req, res) => {
  const { sub: citizenUserId } = req.citizen;
  const { tipo, valor } = req.body || {};  // tipo: "telefone" | "email"

  if (!["telefone", "email"].includes(tipo)) {
    return res.status(400).json({ error: "Tipo inválido. Use 'telefone' ou 'email'" });
  }
  if (!valor || typeof valor !== "string" || valor.trim().length < 5) {
    return res.status(400).json({ error: "Valor inválido" });
  }

  // Validação básica por tipo
  if (tipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())) {
    return res.status(400).json({ error: "E-mail inválido" });
  }
  if (tipo === "telefone" && valor.replace(/\D/g, "").length < 10) {
    return res.status(400).json({ error: "Telefone inválido (mínimo 10 dígitos)" });
  }

  const result = await withDb(db => {
    ensureCitizenShape(db);
    ensureOtpShape(db);

    const citizenUser = db.citizenUsers.find(u => u.id === citizenUserId);
    if (!citizenUser) return { error: { status: 401, message: "Conta não encontrada" } };

    const now = new Date();

    // Verificar cooldown — evitar spam
    const recente = db.citizenPortalOtpCodes.find(o =>
      o.citizenUserId === citizenUserId &&
      o.tipo === tipo &&
      !o.usedAt &&
      new Date(o.createdAt) > new Date(now - OTP_COOLDOWN_SEC * 1000)
    );
    if (recente) {
      const restaSec = Math.ceil((new Date(recente.createdAt).getTime() + OTP_COOLDOWN_SEC * 1000 - now.getTime()) / 1000);
      return { error: { status: 429, message: `Aguarde ${restaSec}s antes de reenviar` } };
    }

    // Invalidar OTPs anteriores do mesmo tipo
    db.citizenPortalOtpCodes = db.citizenPortalOtpCodes.map(o =>
      o.citizenUserId === citizenUserId && o.tipo === tipo && !o.usedAt
        ? { ...o, usedAt: now.toISOString(), invalidadoAt: now.toISOString() }
        : o
    );

    const code    = generateOtpCode();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60_000).toISOString();

    const otp = {
      id: uuidv4(),
      citizenUserId,
      tipo,
      alvo: valor.trim(),        // telefone ou e-mail alvo (plaintext ok — não é segredo)
      codeHash,                  // NUNCA armazenar plaintext
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt,
      usedAt:      null,
      createdAt:   now.toISOString(),
    };
    db.citizenPortalOtpCodes.push(otp);

    return { otp, code, citizenUser };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });

  const { otp, code, citizenUser } = result;

  // Enviar via provider — isolado do fluxo principal
  let devCode = undefined;
  try {
    const sendResult = tipo === "telefone"
      ? await sendPhoneOtp(otp.alvo, code)
      : await sendEmailOtp(otp.alvo, code);
    if (sendResult.devCode) devCode = sendResult.devCode;
  } catch (e) {
    console.error("[OTP] Falha no envio:", e.message);
    // Não falhar o fluxo — OTP já está no DB
  }

  const masked = tipo === "telefone" ? maskPhone(otp.alvo) : maskEmail(otp.alvo);

  return res.json({
    ok:        true,
    otpId:     otp.id,
    expiraEm:  otp.expiresAt,
    mensagem:  `Código enviado para ${masked}`,
    // Em dev: retornar código para facilitar testes
    ...(devCode !== undefined ? { _devCode: devCode } : {}),
  });
});

// ── POST /citizen-portal/profile/contact/confirm-code ────────────────────────
router.post("/citizen-portal/profile/contact/confirm-code", requireCitizenAuth, async (req, res) => {
  const { sub: citizenUserId } = req.citizen;
  const { otpId, code } = req.body || {};

  if (!otpId || !code) return res.status(400).json({ error: "otpId e code são obrigatórios" });

  const result = await withDb(db => {
    ensureOtpShape(db);
    ensureCitizenShape(db);

    const now = new Date();
    const idx = db.citizenPortalOtpCodes.findIndex(o => o.id === otpId && o.citizenUserId === citizenUserId);
    if (idx < 0) return { error: { status: 404, message: "Código não encontrado" } };

    const otp = db.citizenPortalOtpCodes[idx];
    if (otp.usedAt)                         return { error: { status: 409, message: "Código já utilizado" } };
    if (new Date(otp.expiresAt) < now)      return { error: { status: 410, message: "Código expirado. Solicite um novo código." } };
    if (otp.attempts >= otp.maxAttempts)    return { error: { status: 429, message: "Número máximo de tentativas atingido. Solicite um novo código." } };

    const inputHash = hashOtp(String(code).trim());
    db.citizenPortalOtpCodes[idx] = { ...otp, attempts: otp.attempts + 1 };

    if (inputHash !== otp.codeHash) {
      const restantes = otp.maxAttempts - (otp.attempts + 1);
      return { error: { status: 422, message: `Código incorreto. ${restantes} tentativa(s) restante(s).` } };
    }

    // Marcar como usado
    db.citizenPortalOtpCodes[idx] = { ...db.citizenPortalOtpCodes[idx], usedAt: now.toISOString() };
    return { otp };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });

  // Gerar verifyToken (bridge segura OTP → update-contact)
  const { otp } = result;
  const verifyToken = jwt.sign(
    { sub: citizenUserId, purpose: "contact-update", tipo: otp.tipo, alvo: otp.alvo, otpId: otp.id },
    JWT_SECRET,
    { audience: CITIZEN_AUDIENCE, expiresIn: VERIFY_TOKEN_TTL }
  );

  return res.json({ ok: true, verifyToken, tipo: otp.tipo, alvo: otp.alvo });
});

// ── PUT /citizen-portal/profile/contact ──────────────────────────────────────
router.put("/citizen-portal/profile/contact", requireCitizenAuth, async (req, res) => {
  const { sub: citizenUserId } = req.citizen;
  const { verifyToken } = req.body || {};

  if (!verifyToken) return res.status(400).json({ error: "verifyToken obrigatório" });

  // Validar verifyToken
  let payload;
  try {
    payload = jwt.verify(verifyToken, JWT_SECRET, { audience: CITIZEN_AUDIENCE });
  } catch {
    return res.status(401).json({ error: "Token de verificação inválido ou expirado" });
  }
  if (payload.sub !== citizenUserId || payload.purpose !== "contact-update") {
    return res.status(401).json({ error: "Token inválido para esta operação" });
  }

  const { tipo, alvo } = payload;

  const result = await withDb(db => {
    ensureCitizenShape(db);
    const idx = db.citizenUsers.findIndex(u => u.id === citizenUserId);
    if (idx < 0) return { error: { status: 401, message: "Conta não encontrada" } };

    const before = { telefone: db.citizenUsers[idx].telefone, email: db.citizenUsers[idx].email };
    const now = new Date().toISOString();
    db.citizenUsers[idx] = {
      ...db.citizenUsers[idx],
      [tipo]: alvo,
      updatedAt: now,
    };

    const actor = actorFromReq(req, db.citizenUsers[idx]);
    addAuditLog(db, actor, `CITIZEN_${tipo.toUpperCase()}_UPDATED`, "citizen_user", citizenUserId, {
      outcome: "success",
      campo: tipo,
      // Nunca logar valor antigo completo — mascarar
      valorAnteriorMascarado: tipo === "telefone" ? maskPhone(before[tipo]) : maskEmail(before[tipo]),
    });

    return { ok: true, tipo, alvo };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json({ ok: true, tipo: result.tipo, mensagem: `${tipo === "telefone" ? "Telefone" : "E-mail"} atualizado com sucesso.` });
});

// ── PUT /citizen-portal/profile/password ─────────────────────────────────────
router.put("/citizen-portal/profile/password", requireCitizenAuth, async (req, res) => {
  const { sub: citizenUserId } = req.citizen;
  const { senhaAtual, novaSenha, confirmSenha } = req.body || {};

  if (!senhaAtual || !novaSenha || !confirmSenha) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }
  if (novaSenha !== confirmSenha) {
    return res.status(422).json({ error: "Nova senha e confirmação não conferem" });
  }
  if (novaSenha.length < 8) {
    return res.status(422).json({ error: "Nova senha deve ter no mínimo 8 caracteres" });
  }

  const result = await withDb(async db => {
    ensureCitizenShape(db);
    const idx = db.citizenUsers.findIndex(u => u.id === citizenUserId);
    if (idx < 0) return { error: { status: 401, message: "Conta não encontrada" } };

    const ok = await verifyPassword(senhaAtual, db.citizenUsers[idx].passwordHash);
    if (!ok) {
      const actor = actorFromReq(req, db.citizenUsers[idx]);
      addAuditLog(db, actor, "CITIZEN_PASSWORD_CHANGE_FAILED", "citizen_user", citizenUserId, {
        outcome: "failure", motivo: "senha_atual_incorreta",
      });
      return { error: { status: 401, message: "Senha atual incorreta" } };
    }

    const newHash = await hashPassword(novaSenha);
    const now = new Date().toISOString();
    db.citizenUsers[idx] = { ...db.citizenUsers[idx], passwordHash: newHash, updatedAt: now };

    const actor = actorFromReq(req, db.citizenUsers[idx]);
    addAuditLog(db, actor, "CITIZEN_PASSWORD_CHANGED", "citizen_user", citizenUserId, {
      outcome: "success",
    });
    return { ok: true };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json({ ok: true, mensagem: "Senha alterada com sucesso." });
});

// ── GET /citizen-portal/profile/preferences ───────────────────────────────────
router.get("/citizen-portal/profile/preferences", requireCitizenAuth, async (req, res) => {
  const { sub: citizenUserId } = req.citizen;
  const db = await readDb();
  ensureCitizenShape(db);
  const user = db.citizenUsers.find(u => u.id === citizenUserId);
  if (!user) return res.status(401).json({ error: "Conta não encontrada" });

  return res.json({
    preferencias: user.preferencias || {
      notificacoes: true, whatsapp: false, emailAtivo: false, sms: false,
    },
  });
});

// ── PUT /citizen-portal/profile/preferences ───────────────────────────────────
router.put("/citizen-portal/profile/preferences", requireCitizenAuth, async (req, res) => {
  const { sub: citizenUserId } = req.citizen;
  const { preferencias } = req.body || {};

  if (!preferencias || typeof preferencias !== "object") {
    return res.status(400).json({ error: "preferencias obrigatório" });
  }

  // Whitelist — somente campos permitidos
  const ALLOWED = ["notificacoes", "whatsapp", "emailAtivo", "sms"];
  const sanitized = {};
  for (const k of ALLOWED) {
    if (k in preferencias) sanitized[k] = Boolean(preferencias[k]);
  }

  await withDb(db => {
    ensureCitizenShape(db);
    const idx = db.citizenUsers.findIndex(u => u.id === citizenUserId);
    if (idx < 0) return;
    db.citizenUsers[idx] = {
      ...db.citizenUsers[idx],
      preferencias: { ...(db.citizenUsers[idx].preferencias || {}), ...sanitized },
      updatedAt: new Date().toISOString(),
    };
  });

  return res.json({ ok: true, preferencias: sanitized });
});

export default router;
