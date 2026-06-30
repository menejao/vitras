/**
 * citizen-portal.js — Governança do Portal do Cidadão VITRAS
 *
 * Rotas administrativas:  /platform/citizen-portal/*  (support_admin somente)
 * Rota pública para Portal: GET /citizen-portal/config?unitId=xxx
 *
 * Hierarquia: Configuração Municipal → Configuração da UBS
 *   - UBS pode restringir (desabilitar) algo habilitado pelo município.
 *   - UBS NUNCA pode habilitar algo desabilitado pelo município.
 */

import express from "express";
import { readDb, withDb } from "../db.js";
import { requireAuth, requireSupportAdmin } from "../middlewares/auth.js";
import { ensureDbShape } from "../utils/domain.js";
import { hasCapability } from "../utils/helpers.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

// ── Default config schema ──────────────────────────────────────────────────

export const DEFAULT_PORTAL_CONFIG = {
  portal: {
    ativo:                  false,  // portal desativado por padrão até configuração explícita
    manutencao:             false,
    mensagemInstitucional:  "",
    bannerAtivo:            false,
    bannerTexto:            "",
  },
  modulos: {
    agendamentos:  false,
    vacinas:       true,
    medicamentos:  false,
    exames:        false,
    minhaUbs:      true,
    notificacoes:  true,
    perfil:        true,
    dependentes:   false,
    documentos:    false,
    declaracoes:   false,
  },
  agendamentos: {
    onlineAtivo:          false,
    cancelamentoAtivo:    false,
    remarcacaoAtivo:      false,
    confirmacaoAtiva:     false,
    listaEspera:          false,
    antecedenciaMinDias:  1,
    antecedenciaMaxDias:  30,
    vagasDigitaisPerc:    20,
  },
  vacinacao: {
    agendamentoOnline: false,
    campanhas:         true,
    confirmacao:       false,
    calendarioVacinal: true,
  },
  medicamentos: {
    mostrarEstoque:        false,
    mostrarDisponibilidade: true,
    mostrarOutrasUbs:      false,
    retiradaOutraUbs:      false,
    previsaoReposicao:     false,
  },
  exames: {
    mostrarPedidos:           false,
    mostrarResultados:        false,
    permitirDownload:         false,
    notificarDisponibilidade: false,
  },
  comunicacao: {
    portalAtivo:       true,
    whatsappAtivo:     false,
    emailAtivo:        false,
    smsAtivo:          false,
    campanhasMunicipais: false,
  },
  compartilhamento: {
    estoquesMedicamentos: false,
    vagas:                false,
    campanhas:            true,
    vacinas:              false,
    exames:               false,
  },
};

// Deep-merge: target values win, fallback to defaults for missing keys.
function mergeWithDefaults(defaults, stored) {
  if (!stored || typeof stored !== "object") return { ...defaults };
  const result = {};
  for (const key of Object.keys(defaults)) {
    if (typeof defaults[key] === "object" && !Array.isArray(defaults[key])) {
      result[key] = mergeWithDefaults(defaults[key], stored[key]);
    } else {
      result[key] = key in stored ? stored[key] : defaults[key];
    }
  }
  return result;
}

/**
 * Apply unit overrides on top of municipal config.
 * Rule: UBS can only restrict (set false) — cannot enable what municipality disabled.
 */
function applyUnitOverrides(municipal, unitOverrides) {
  if (!unitOverrides || typeof unitOverrides !== "object") return municipal;
  const result = JSON.parse(JSON.stringify(municipal));

  function applySection(base, override) {
    if (!override || typeof override !== "object") return;
    for (const key of Object.keys(override)) {
      if (typeof base[key] === "boolean" && typeof override[key] === "boolean") {
        // Unit can only disable (false), never re-enable if municipality disabled
        if (!base[key] && override[key]) continue; // blocked — municipality says false
        base[key] = override[key];
      } else if (typeof base[key] === "number" && typeof override[key] === "number") {
        base[key] = override[key];
      } else if (typeof base[key] === "string" && typeof override[key] === "string") {
        base[key] = override[key];
      } else if (typeof base[key] === "object") {
        applySection(base[key], override[key]);
      }
    }
  }

  for (const section of Object.keys(result)) {
    if (unitOverrides[section]) {
      applySection(result[section], unitOverrides[section]);
    }
  }
  return result;
}

function ensurePortalShape(db) {
  ensureDbShape(db);
  if (!db.citizenPortalConfig || typeof db.citizenPortalConfig !== "object") {
    db.citizenPortalConfig = {};
  }
}

// ── Admin routes (support_admin only) ─────────────────────────────────────

router.use("/platform/citizen-portal", requireAuth, requireSupportAdmin);

// GET /platform/citizen-portal/config — ler config municipal
router.get("/platform/citizen-portal/config", (req, res) => {
  if (!hasCapability(req.user, "platform.citizen_portal.read")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const db     = readDb();
  ensurePortalShape(db);
  const config = mergeWithDefaults(DEFAULT_PORTAL_CONFIG, db.citizenPortalConfig);
  return res.json({ config, isDefault: !db.citizenPortalConfig || Object.keys(db.citizenPortalConfig).length === 0 });
});

// PUT /platform/citizen-portal/config — salvar config municipal
router.put("/platform/citizen-portal/config", async (req, res) => {
  if (!hasCapability(req.user, "platform.citizen_portal.update")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const payload = req.body || {};

  const result = await withDb((db) => {
    ensurePortalShape(db);
    const prev   = mergeWithDefaults(DEFAULT_PORTAL_CONFIG, db.citizenPortalConfig);
    const merged = mergeWithDefaults(DEFAULT_PORTAL_CONFIG, { ...db.citizenPortalConfig, ...payload });
    db.citizenPortalConfig = merged;

    addAuditLog(db, req.user, "CITIZEN_PORTAL_CONFIG_UPDATED", "citizen_portal_config", "municipal", {
      changedSections: Object.keys(payload),
      outcome: "success",
    });
    return { config: merged, prev };
  });

  return res.json({ config: result.config });
});

// GET /platform/citizen-portal/units/:unitId/config — config da UBS
router.get("/platform/citizen-portal/units/:unitId/config", (req, res) => {
  if (!hasCapability(req.user, "platform.citizen_portal.read")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const { unitId } = req.params;
  const db = readDb();
  ensurePortalShape(db);
  if (!Array.isArray(db.units)) return res.status(404).json({ error: "Unidade não encontrada" });

  const unit = db.units.find(u => u.id === unitId);
  if (!unit) return res.status(404).json({ error: "Unidade não encontrada" });

  const municipal = mergeWithDefaults(DEFAULT_PORTAL_CONFIG, db.citizenPortalConfig);
  const effective = applyUnitOverrides(municipal, unit.portalConfig);

  return res.json({
    unitId,
    unitName:   unit.name,
    municipal,
    unitOverrides: unit.portalConfig || {},
    effective,
  });
});

// PUT /platform/citizen-portal/units/:unitId/config — salvar config da UBS
router.put("/platform/citizen-portal/units/:unitId/config", async (req, res) => {
  if (!hasCapability(req.user, "platform.citizen_portal.update")) {
    return res.status(403).json({ error: "Sem permissão" });
  }
  const { unitId } = req.params;
  const payload    = req.body || {};

  const result = await withDb((db) => {
    ensurePortalShape(db);
    if (!Array.isArray(db.units)) return { error: { status: 404, message: "Unidade não encontrada" } };
    const idx = db.units.findIndex(u => u.id === unitId);
    if (idx < 0) return { error: { status: 404, message: "Unidade não encontrada" } };

    const unit = db.units[idx];
    // Merge incoming into existing overrides
    const nextOverrides = { ...(unit.portalConfig || {}), ...payload };
    db.units[idx] = { ...unit, portalConfig: nextOverrides, updatedAt: new Date().toISOString() };

    const municipal = mergeWithDefaults(DEFAULT_PORTAL_CONFIG, db.citizenPortalConfig);
    const effective = applyUnitOverrides(municipal, nextOverrides);

    addAuditLog(db, req.user, "CITIZEN_PORTAL_UNIT_CONFIG_UPDATED", "citizen_portal_config", unitId, {
      changedSections: Object.keys(payload),
      outcome: "success",
    });
    return { effective, unitOverrides: nextOverrides };
  });

  if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
  return res.json(result);
});

// ── Public endpoint consumed by the Portal ─────────────────────────────────
// GET /citizen-portal/config?unitId=xxx
// Returns effective config for a unit. No sensitive internal data exposed.

router.get("/citizen-portal/config", (req, res) => {
  const { unitId } = req.query;
  const db = readDb();
  ensurePortalShape(db);

  const municipal = mergeWithDefaults(DEFAULT_PORTAL_CONFIG, db.citizenPortalConfig);

  // If unitId provided, apply unit overrides
  let effective = municipal;
  let unitName  = null;
  if (unitId && Array.isArray(db.units)) {
    const unit = db.units.find(u => u.id === unitId && !u.deletedAt);
    if (unit) {
      effective = applyUnitOverrides(municipal, unit.portalConfig);
      unitName  = unit.name;
    }
  }

  // Return only what the Portal needs — no internal config details
  return res.json({
    unitId:   unitId || null,
    unitName: unitName || null,
    portal:   effective.portal,
    modulos:  effective.modulos,
    // Feature flags only — no internal admin config
    features: {
      agendamentosOnline:    effective.agendamentos.onlineAtivo,
      cancelamentoOnline:    effective.agendamentos.cancelamentoAtivo,
      vacinacaoOnline:       effective.vacinacao.agendamentoOnline,
      campanhas:             effective.vacinacao.campanhas,
      calendarioVacinal:     effective.vacinacao.calendarioVacinal,
      medicamentosEstoque:   effective.medicamentos.mostrarDisponibilidade,
      examesPedidos:         effective.exames.mostrarPedidos,
      examesResultados:      effective.exames.mostrarResultados,
      notificacoesPortal:    effective.comunicacao.portalAtivo,
    },
    _generatedAt: new Date().toISOString(),
  });
});

export default router;
