/**
 * citizen-portal-unit.js — Central de Relacionamento: Minha UBS e Rede Municipal
 *
 * Endpoints (todos requerem token de cidadão):
 *   GET /citizen-portal/my-unit          — UBS + equipe + contatos + perfil estendido
 *   GET /citizen-portal/network          — outras UBS da rede (quando config permite)
 *   GET /citizen-portal/unit-services    — serviços habilitados para a UBS
 *   GET /citizen-portal/unit-notices     — avisos institucionais da UBS
 *   GET /citizen-portal/campaigns        — campanhas municipais ativas
 *
 * Dados retornados: somente informações institucionais públicas.
 * Nunca dados clínicos, nunca dados pessoais de profissionais além do nome e cargo.
 */

import express from "express";
import { readDb, withDb } from "../db.js";
import { requireCitizenAuth } from "./citizen-portal-auth.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

router.use("/citizen-portal/my-unit",       requireCitizenAuth);
router.use("/citizen-portal/network",       requireCitizenAuth);
router.use("/citizen-portal/unit-services", requireCitizenAuth);
router.use("/citizen-portal/unit-notices",  requireCitizenAuth);
router.use("/citizen-portal/campaigns",     requireCitizenAuth);

// ── DB shape helpers ──────────────────────────────────────────────────────────

function ensureUnitShape(db) {
  if (!Array.isArray(db.citizenPortalUnitProfiles)) db.citizenPortalUnitProfiles = [];
  if (!Array.isArray(db.citizenPortalNotices))      db.citizenPortalNotices = [];
  if (!Array.isArray(db.citizenPortalCampaigns))    db.citizenPortalCampaigns = [];
}

// Serviços padrão disponíveis numa UBS — em produção virão do módulo de Agenda
const DEFAULT_SERVICES = [
  { id: "consulta-medica",  nome: "Clínica Médica",     icone: "🩺", descricao: "Consultas com clínico geral" },
  { id: "enfermagem",       nome: "Enfermagem",          icone: "💉", descricao: "Curativos, sinais vitais, orientações" },
  { id: "vacinacao",        nome: "Vacinação",           icone: "💊", descricao: "Calendário vacinal e campanhas" },
  { id: "coleta",           nome: "Coleta de Exames",    icone: "🔬", descricao: "Coleta de sangue e materiais" },
  { id: "farmacia",         nome: "Farmácia Básica",     icone: "💊", descricao: "Dispensação de medicamentos" },
];

// Serviços opcionais presentes em algumas UBS
const OPTIONAL_SERVICES = [
  { id: "odontologia",      nome: "Odontologia",         icone: "🦷", descricao: "Consultas e procedimentos odontológicos" },
  { id: "saude-mulher",     nome: "Saúde da Mulher",     icone: "🌸", descricao: "Pré-natal, preventivo, planejamento familiar" },
  { id: "saude-crianca",    nome: "Saúde da Criança",    icone: "👶", descricao: "Puericultura, crescimento e desenvolvimento" },
  { id: "saude-mental",     nome: "Saúde Mental",        icone: "🧠", descricao: "Apoio e acompanhamento em saúde mental" },
];

// Mapear role → cargo exibível no Portal
const ROLE_CARGO = {
  medico:      { cargo: "Médico(a)",             icone: "🩺" },
  enfermeiro:  { cargo: "Enfermeiro(a)",          icone: "💉" },
  dentista:    { cargo: "Dentista",               icone: "🦷" },
  acs:         { cargo: "Agente Comunitário de Saúde", icone: "🏘️" },
  tecnico:     { cargo: "Técnico(a) de Enfermagem",    icone: "🩹" },
  farmaceutico:{ cargo: "Farmacêutico(a)",        icone: "💊" },
};

/**
 * Monta perfil estendido da UBS combinando:
 * 1. Dados base do DB (units)
 * 2. Perfil estendido do Portal (citizenPortalUnitProfiles)
 * 3. Defaults razoáveis quando nenhum dado existe
 */
function buildUnitProfile(unit, profiles) {
  const profile = profiles.find(p => p.unitId === unit.id) || {};
  return {
    id:           unit.id,
    nome:         profile.nome         || unit.name || unit.nome || "Unidade de Saúde",
    cnes:         unit.cnes            || profile.cnes  || null,
    endereco:     profile.endereco     || null,
    numero:       profile.numero       || null,
    complemento:  profile.complemento  || null,
    bairro:       profile.bairro       || null,
    municipio:    profile.municipio    || null,
    uf:           profile.uf           || null,
    cep:          profile.cep          || null,
    telefone:     profile.telefone     || null,
    whatsapp:     profile.whatsapp     || null,
    email:        profile.email        || null,
    horario:      profile.horario      || "Segunda a Sexta: 07h–17h",
    horarioExtra: profile.horarioExtra || null,
    foto:         profile.foto         || null,
    // Campos para integração futura (GPS/mapas)
    lat:          profile.lat          || null,
    lng:          profile.lng          || null,
  };
}

// ── GET /citizen-portal/my-unit ───────────────────────────────────────────────
router.get("/citizen-portal/my-unit", async (req, res) => {
  const { unitId, sub: citizenUserId } = req.citizen;
  const db = await readDb();
  ensureUnitShape(db);

  // UBS do cidadão
  const unit = (db.units || []).find(u => u.id === unitId);
  if (!unit) {
    // Fallback: cidadão sem UBS vinculada
    return res.json({
      ubs: null,
      equipe: null,
      profissionais: [],
      contatos: null,
    });
  }

  const ubsProfile = buildUnitProfile(unit, db.citizenPortalUnitProfiles || []);

  // Equipe vinculada — procurar a equipe do cidadão via citizenUser → patient → team
  // Como cidadão pode ter unitId mas não teamId direto, buscar equipes da UBS
  const equipesUbs = (db.teams || []).filter(t => t.unitId === unitId && !t.deletedAt);

  // Profissionais da UBS — filtrar por unitId, retornar somente nome + cargo
  const profissionaisUbs = (db.users || [])
    .filter(u => u.unitId === unitId && !u.deletedAt && ROLE_CARGO[u.role])
    .map(u => ({
      id:    u.id,
      nome:  u.name,
      cargo: ROLE_CARGO[u.role]?.cargo || u.role,
      icone: ROLE_CARGO[u.role]?.icone || "👤",
      teamId: u.teamId || null,
    }));

  // Equipe principal (primeira encontrada — em produção: equipe de referência do paciente)
  const equipe = equipesUbs.length > 0 ? {
    id:   equipesUbs[0].id,
    nome: equipesUbs[0].name,
  } : null;

  // Contatos
  const contatos = {
    telefone: ubsProfile.telefone,
    whatsapp: ubsProfile.whatsapp,
    email:    ubsProfile.email,
    endereco: [
      ubsProfile.endereco,
      ubsProfile.numero,
      ubsProfile.complemento,
    ].filter(Boolean).join(", ") || null,
    bairro:   ubsProfile.bairro,
    municipio: ubsProfile.municipio,
    uf:       ubsProfile.uf,
    cep:      ubsProfile.cep,
    // Preparado para futura integração com mapas
    lat: ubsProfile.lat,
    lng: ubsProfile.lng,
  };

  return res.json({
    ubs:           ubsProfile,
    equipe,
    profissionais: profissionaisUbs,
    contatos,
  });
});

// ── GET /citizen-portal/network ───────────────────────────────────────────────
router.get("/citizen-portal/network", async (req, res) => {
  const { unitId } = req.citizen;
  const db = await readDb();
  ensureUnitShape(db);

  // Verificar config municipal de compartilhamento
  const config = db.citizenPortalConfig || {};
  const compartilhamento = config.compartilhamento || {};
  const permitirRede = compartilhamento.vagas === true || compartilhamento.estoquesMedicamentos === true;

  if (!permitirRede) {
    return res.json({ permitido: false, unidades: [] });
  }

  const profiles = db.citizenPortalUnitProfiles || [];
  const outras = (db.units || [])
    .filter(u => u.id !== unitId && !u.deletedAt)
    .map(u => {
      const p = buildUnitProfile(u, profiles);
      return {
        id:       p.id,
        nome:     p.nome,
        bairro:   p.bairro,
        municipio: p.municipio,
        telefone: p.telefone,
        horario:  p.horario,
        // serviços — padrão para todas (em produção virá do módulo Agenda)
        servicos: DEFAULT_SERVICES.slice(0, 3).map(s => s.nome),
        // Preparado para distância futura
        distanciaKm: null,
      };
    });

  return res.json({ permitido: true, unidades: outras });
});

// ── GET /citizen-portal/unit-services ─────────────────────────────────────────
router.get("/citizen-portal/unit-services", async (req, res) => {
  const { unitId } = req.citizen;
  const db = await readDb();
  ensureUnitShape(db);

  const profiles  = db.citizenPortalUnitProfiles || [];
  const profile   = profiles.find(p => p.unitId === unitId) || {};
  const servicosIds = profile.servicosHabilitados || null;

  let servicos;
  if (servicosIds) {
    // Filtrar conforme configuração da UBS
    const todos = [...DEFAULT_SERVICES, ...OPTIONAL_SERVICES];
    servicos = todos.filter(s => servicosIds.includes(s.id));
  } else {
    // Default: serviços base sempre presentes
    servicos = DEFAULT_SERVICES;
    // Verificar se UBS tem profissional de odontologia → habilitar serviço
    const temDentista = (db.users || []).some(u => u.unitId === unitId && u.role === "dentista" && !u.deletedAt);
    if (temDentista) servicos = [...servicos, OPTIONAL_SERVICES.find(s => s.id === "odontologia")].filter(Boolean);
  }

  // Farmácia — avisar que é "em breve" consulta de estoque
  const config = db.citizenPortalConfig || {};
  const farmaciaBreve = config.medicamentos?.mostrarEstoque !== true;

  return res.json({ servicos, farmaciaBreve });
});

// ── GET /citizen-portal/unit-notices ──────────────────────────────────────────
router.get("/citizen-portal/unit-notices", async (req, res) => {
  const { unitId } = req.citizen;
  const db = await readDb();
  ensureUnitShape(db);

  const agora = new Date();
  const avisos = (db.citizenPortalNotices || [])
    .filter(n =>
      (n.unitId === unitId || n.unitId === "*") &&
      !n.deletedAt &&
      (!n.expiresAt || new Date(n.expiresAt) > agora)
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10)
    .map(n => ({
      id:        n.id,
      titulo:    n.titulo,
      texto:     n.texto,
      tipo:      n.tipo || "info",      // info | alerta | urgente
      icone:     n.icone || "📢",
      criadoAt:  n.createdAt,
      expiresAt: n.expiresAt || null,
    }));

  return res.json({ avisos });
});

// ── GET /citizen-portal/campaigns ────────────────────────────────────────────
router.get("/citizen-portal/campaigns", async (req, res) => {
  const db = await readDb();
  ensureUnitShape(db);

  const agora = new Date();
  const campanhas = (db.citizenPortalCampaigns || [])
    .filter(c =>
      !c.deletedAt &&
      c.ativa !== false &&
      (!c.expiresAt || new Date(c.expiresAt) > agora)
    )
    .sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
    .map(c => ({
      id:       c.id,
      titulo:   c.titulo,
      descricao: c.descricao,
      icone:    c.icone    || "📢",
      cor:      c.cor      || "var(--accent)",
      link:     c.link     || null,
      expiresAt: c.expiresAt || null,
    }));

  return res.json({ campanhas });
});

export default router;
