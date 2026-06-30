/**
 * citizen-portal-appointments.js — Jornada de Agendamento do Portal do Cidadão
 *
 * O Portal NUNCA cria vagas, calcula capacidade ou define horários.
 * Toda regra de agenda pertence ao VITRAS Clínico.
 * Estes endpoints abstraem o motor de agenda e entregam apenas o que o Portal precisa.
 *
 * Rotas (todas requerem token de cidadão):
 *   GET  /citizen-portal/appointments/services
 *   GET  /citizen-portal/appointments/units?serviceId=x
 *   GET  /citizen-portal/appointments/professionals?serviceId=x&unitId=y
 *   GET  /citizen-portal/appointments/availability?serviceId=x&unitId=y&professionalId=z
 *   GET  /citizen-portal/appointments/slots?serviceId=x&unitId=y&professionalId=z&date=YYYY-MM-DD
 *   POST /citizen-portal/appointments
 *   GET  /citizen-portal/my-appointments
 *   DELETE /citizen-portal/my-appointments/:id
 */

import express    from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { addAuditLog }    from "../services/audit.js";
import { requireCitizenAuth } from "./citizen-portal-auth.js";

const router = express.Router();

// Todos os endpoints requerem token de cidadão
router.use("/citizen-portal/appointments", requireCitizenAuth);
router.use("/citizen-portal/my-appointments", requireCitizenAuth);

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureAppointmentsShape(db) {
  if (!Array.isArray(db.citizenAppointments)) db.citizenAppointments = [];
}

/**
 * Retorna configurações do Portal para a UBS do cidadão.
 * Abstraí a hierarquia municipal → UBS.
 */
function getPortalConfig(db, unitId) {
  return db.citizenPortalConfig || {};
}

// Serviços habilitados — em produção, virão do módulo de Agenda do Clínico.
// O Portal apenas exibe o que o Clínico liberar.
const SERVICOS_BASE = [
  { id: "consulta-medica",   nome: "Consulta Médica",    icone: "🩺", descricao: "Consulta com clínico geral ou especialista" },
  { id: "enfermagem",        nome: "Enfermagem",          icone: "💉", descricao: "Curativos, verificação de sinais vitais, orientações" },
  { id: "odontologia",       nome: "Odontologia",         icone: "🦷", descricao: "Consulta e procedimentos odontológicos" },
  { id: "vacinacao",         nome: "Vacinação",           icone: "💊", descricao: "Aplicação de vacinas do calendário e campanhas" },
  { id: "coleta",            nome: "Coleta de Exames",    icone: "🔬", descricao: "Coleta de sangue, urina e outros materiais" },
];

// ── GET /citizen-portal/appointments/services ─────────────────────────────────
router.get("/citizen-portal/appointments/services", async (req, res) => {
  const { sub: citizenUserId, unitId } = req.citizen;
  const db = await readDb();

  // Em produção: filtrar serviços habilitados para a UBS do cidadão via Clínico.
  // Por ora: retornar serviços base disponíveis.
  const portalConfig = getPortalConfig(db, unitId);
  const agendamentosAtivos = portalConfig?.agendamentos?.onlineAtivo !== false;

  if (!agendamentosAtivos) {
    return res.json({ services: [], message: "Agendamento online não está disponível neste momento." });
  }

  return res.json({ services: SERVICOS_BASE });
});

// ── GET /citizen-portal/appointments/units ────────────────────────────────────
router.get("/citizen-portal/appointments/units", async (req, res) => {
  const { unitId } = req.citizen;
  const { serviceId } = req.query;
  const db = await readDb();

  const portalConfig      = getPortalConfig(db, unitId);
  const compartilhamento  = portalConfig?.compartilhamento || {};
  const permitirOutrasUbs = compartilhamento.vagas === true;

  // UBS do próprio cidadão
  const minhaUbs = (db.units || []).find(u => u.id === unitId && !u.deletedAt);
  const unidades = [];

  if (minhaUbs) {
    unidades.push({
      id:        minhaUbs.id,
      nome:      minhaUbs.nome || minhaUbs.name,
      endereco:  minhaUbs.street ? `${minhaUbs.street}, ${minhaUbs.streetNumber || ""}` : null,
      bairro:    minhaUbs.neighborhood || null,
      municipio: minhaUbs.municipalityName || null,
      telefone:  minhaUbs.phone || null,
      isMinhaUbs: true,
    });
  } else {
    // Fallback se UBS não encontrada no cadastro
    unidades.push({ id: unitId || "default", nome: "Minha UBS", isMinhaUbs: true });
  }

  // Outras UBS quando permitido pelo município
  if (permitirOutrasUbs && Array.isArray(db.units)) {
    const outras = db.units
      .filter(u => u.id !== unitId && !u.deletedAt)
      .slice(0, 5)
      .map(u => ({
        id: u.id, nome: u.nome || u.name,
        endereco: u.street ? `${u.street}, ${u.streetNumber || ""}` : null,
        bairro: u.neighborhood || null, municipio: u.municipalityName || null,
        telefone: u.phone || null, isMinhaUbs: false,
      }));
    unidades.push(...outras);
  }

  return res.json({ units: unidades, permitirOutrasUbs });
});

// ── GET /citizen-portal/appointments/professionals ────────────────────────────
router.get("/citizen-portal/appointments/professionals", async (req, res) => {
  const { unitId } = req.citizen;
  const { serviceId, unitId: queryUnitId } = req.query;
  const targetUnitId = queryUnitId || unitId;

  // Em produção: consultar profissionais disponíveis no Clínico para este serviço/UBS.
  // Por ora: retornar mock — a UI já está preparada para lista real.
  const professionals = [
    { id: "qualquer", nome: "Qualquer profissional disponível", especialidade: null, generico: true },
  ];

  return res.json({
    professionals,
    selecaoPermitida: false, // por padrão, cidadão não escolhe profissional — regra do Clínico
    message: "Você será atendido pelo profissional disponível da sua equipe.",
  });
});

// ── GET /citizen-portal/appointments/availability ─────────────────────────────
// Retorna dias com vagas disponíveis (formato: array de YYYY-MM-DD)
router.get("/citizen-portal/appointments/availability", async (req, res) => {
  const { serviceId, unitId: queryUnitId, professionalId } = req.query;
  const { unitId } = req.citizen;

  // Em produção: consultar motor de agenda do Clínico para slots digitais disponíveis.
  // O Portal NUNCA calcula disponibilidade. Apenas consome o que o Clínico libera.
  // Mock: próximos 14 dias úteis com disponibilidade simulada.
  const hoje    = new Date();
  const diasUt  = [];
  let cursor    = new Date(hoje);
  cursor.setDate(cursor.getDate() + 1); // amanhã

  while (diasUt.length < 10) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) { // segunda a sexta
      const iso = cursor.toISOString().split("T")[0];
      // Simular alguns dias sem disponibilidade
      const skip = cursor.getDate() % 7 === 3;
      if (!skip) diasUt.push(iso);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return res.json({ availableDates: diasUt });
});

// ── GET /citizen-portal/appointments/slots ────────────────────────────────────
// Retorna horários disponíveis para um dia específico
router.get("/citizen-portal/appointments/slots", async (req, res) => {
  const { serviceId, unitId: queryUnitId, professionalId, date } = req.query;
  if (!date) return res.status(400).json({ error: "Data obrigatória" });

  // Em produção: consultar motor de agenda do Clínico para horários digitais do dia.
  // O Portal apenas exibe horários liberados — nunca horários internos ou bloqueados.
  const slots = [
    { id: "s1", hora: "08:00", disponivel: true },
    { id: "s2", hora: "08:30", disponivel: true },
    { id: "s3", hora: "09:00", disponivel: false },
    { id: "s4", hora: "09:30", disponivel: true },
    { id: "s5", hora: "10:00", disponivel: true },
    { id: "s6", hora: "10:30", disponivel: false },
    { id: "s7", hora: "14:00", disponivel: true },
    { id: "s8", hora: "14:30", disponivel: true },
    { id: "s9", hora: "15:00", disponivel: true },
  ].filter(s => s.disponivel);

  return res.json({ slots, date });
});

// ── POST /citizen-portal/appointments ────────────────────────────────────────
router.post("/citizen-portal/appointments", async (req, res) => {
  const { sub: citizenUserId, nome: cidadaoNome } = req.citizen;
  const { serviceId, serviceName, unitId: bookingUnitId, professionalId, date, slotId, hora } = req.body || {};

  if (!serviceId || !date || !hora) {
    return res.status(400).json({ error: "Serviço, data e horário são obrigatórios" });
  }

  const result = await withDb(db => {
    ensureAppointmentsShape(db);
    ensurePortalCitizenShape(db);

    const citizenUser = db.citizenUsers?.find(u => u.id === citizenUserId);
    if (!citizenUser) return { error: { status: 401, message: "Conta não encontrada" } };

    const unit = (db.units || []).find(u => u.id === (bookingUnitId || citizenUser.unitId));
    const now  = new Date().toISOString();

    // Protocolo único: VITRAS + ano + 6 dígitos aleatórios
    const protocolo = `VIT${new Date().getFullYear()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const appointment = {
      id:              uuidv4(),
      protocolo,
      citizenUserId,
      patientId:       citizenUser.patientId,
      serviceId,
      serviceName:     serviceName || serviceId,
      unitId:          unit?.id || bookingUnitId,
      unitName:        unit?.nome || unit?.name || "UBS",
      professionalId:  professionalId || null,
      professionalName: null, // será preenchido pelo Clínico
      date,
      hora,
      slotId:          slotId || null,
      status:          "agendado",
      canal:           "portal",
      motivoCancelamento: null,
      createdAt:       now,
      updatedAt:       now,
      canceladoAt:     null,
    };
    db.citizenAppointments.push(appointment);

    const actor = { id: citizenUserId, name: cidadaoNome || "Cidadão", role: "citizen", teamId: null,
      requestMeta: { ip: "", userAgent: "", method: "POST", path: "/citizen-portal/appointments", authTransport: "bearer" } };
    addAuditLog(db, actor, "CITIZEN_APPOINTMENT_CREATED", "citizen_appointment", appointment.id, {
      outcome: "success", serviceId, date, hora, unitId: appointment.unitId,
    });

    return { appointment };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });

  const { appointment } = result;
  return res.status(201).json({
    protocolo:   appointment.protocolo,
    id:          appointment.id,
    serviceName: appointment.serviceName,
    unitName:    appointment.unitName,
    date:        appointment.date,
    hora:        appointment.hora,
    status:      appointment.status,
    orientacoes: [
      "Chegue com 15 minutos de antecedência.",
      "Leve um documento de identificação com foto.",
      "Informe se estiver tomando algum medicamento.",
    ],
  });
});

// ── GET /citizen-portal/my-appointments ──────────────────────────────────────
router.get("/citizen-portal/my-appointments", async (req, res) => {
  const { sub: citizenUserId } = req.citizen;
  const db = await readDb();
  ensureAppointmentsShape(db);

  const all = (db.citizenAppointments || []).filter(a => a.citizenUserId === citizenUserId);
  const now = new Date();

  const proximos  = all.filter(a => a.status === "agendado" && new Date(`${a.date}T${a.hora}`) >= now)
                        .sort((a, b) => new Date(`${a.date}T${a.hora}`) - new Date(`${b.date}T${b.hora}`));
  const concluidos = all.filter(a => a.status === "concluido" || (a.status === "agendado" && new Date(`${a.date}T${a.hora}`) < now))
                        .sort((a, b) => new Date(`${b.date}T${b.hora}`) - new Date(`${a.date}T${a.hora}`));
  const cancelados = all.filter(a => a.status === "cancelado")
                        .sort((a, b) => new Date(b.canceladoAt || b.updatedAt) - new Date(a.canceladoAt || a.updatedAt));

  return res.json({ proximos, concluidos, cancelados });
});

// ── DELETE /citizen-portal/my-appointments/:id ────────────────────────────────
router.delete("/citizen-portal/my-appointments/:id", async (req, res) => {
  const { sub: citizenUserId, nome: cidadaoNome } = req.citizen;
  const { id } = req.params;
  const { motivo } = req.body || {};

  const result = await withDb(db => {
    ensureAppointmentsShape(db);
    const idx = db.citizenAppointments.findIndex(a => a.id === id && a.citizenUserId === citizenUserId);
    if (idx < 0) return { error: { status: 404, message: "Agendamento não encontrado" } };
    if (db.citizenAppointments[idx].status === "cancelado") {
      return { error: { status: 409, message: "Agendamento já cancelado" } };
    }
    const now = new Date().toISOString();
    db.citizenAppointments[idx] = {
      ...db.citizenAppointments[idx],
      status: "cancelado",
      motivoCancelamento: motivo || null,
      canceladoAt: now,
      updatedAt:   now,
    };

    const actor = { id: citizenUserId, name: cidadaoNome || "Cidadão", role: "citizen", teamId: null,
      requestMeta: { ip: "", userAgent: "", method: "DELETE", path: req.path, authTransport: "bearer" } };
    addAuditLog(db, actor, "CITIZEN_APPOINTMENT_CANCELLED", "citizen_appointment", id, {
      outcome: "success", motivo: motivo || null,
    });

    return { ok: true };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json({ ok: true, message: "Agendamento cancelado. A vaga foi devolvida ao sistema." });
});

function ensurePortalCitizenShape(db) {
  if (!Array.isArray(db.citizenUsers)) db.citizenUsers = [];
}

export default router;
