import express from "express";
import { v4 as uuidv4 } from "uuid";
import { withDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { requireAuth } from "../middlewares/auth.js";
import { hasCapability } from "../utils/helpers.js";
import { validate, HouseholdCreateSchema, HouseholdUpdateSchema } from "../schemas.js";
import { addAuditLog } from "../services/audit.js";

const router = express.Router();

function buildHouseholdActor(req) {
  return {
    ...(req.user || {}),
    id: String(req.user?.id || "system"),
    name: String(req.user?.name || "system"),
    teamId: String(req.user?.teamId || ""),
    requestMeta: {
      requestId: req.requestId || "",
      ip: String(req.ip || req.socket?.remoteAddress || ""),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 512),
      method: String(req.method || ""),
      path: String(req.originalUrl || req.path || ""),
      authTransport: String(req.user?.authTransport || "anonymous")
    }
  };
}

// GET /households?patientId= — list households for a patient
router.get(
  "/households",
  requireAuth,
  async (req, res) => {
    const patientId = String(req.query.patientId || "").trim();
    if (!patientId) return res.status(400).json({ error: "patientId obrigatório" });

    const { readDb } = await import("../db.js");
    const db = await readDb();
    ensureDbShape(db);

    const patient = db.patients.find((p) => p.id === patientId);
    if (!patient) return res.status(404).json({ error: "Paciente não encontrado" });

    if (req.user.role !== "break_glass_admin" && patient.teamId !== req.user.teamId) {
      return res.status(403).json({ error: "Sem permissão para visualizar domicílios desta equipe" });
    }

    const households = db.households.filter((h) => h.patientId === patientId);
    return res.json(households);
  }
);

// POST /households — create household linked to a patient
router.post(
  "/households",
  requireAuth,
  validate(HouseholdCreateSchema),
  async (req, res) => {
    const payload = req.body || {};

    const result = await withDb((db) => {
      ensureDbShape(db);

      const patient = db.patients.find((p) => p.id === payload.patientId);
      if (!patient) return { error: { status: 404, message: "Paciente não encontrado" } };

      // Scope: non-break_glass users can only create household for patients in their team
      if (req.user.role !== "break_glass_admin" && patient.teamId !== req.user.teamId) {
        return { error: { status: 403, message: "Sem permissão para criar domicílio nesta equipe" } };
      }

      const now = new Date().toISOString();
      const household = {
        id: uuidv4(),
        patientId: String(payload.patientId || "").trim(),
        teamId: String(patient.teamId || req.user.teamId || ""),
        familyCode: String(payload.familyCode || "").trim(),
        housingType: payload.tipoImovel || payload.housingType || "",
        tipoImovel: payload.tipoImovel || payload.housingType || "",
        numMoradores: payload.numMoradores !== undefined ? Number(payload.numMoradores) : undefined,
        numComodos: payload.numComodos !== undefined ? Number(payload.numComodos) : undefined,
        localizacao: payload.localizacao || "",
        abastecimentoAgua: payload.abastecimentoAgua || "",
        waterSupply: String(payload.waterSupply || "").trim(),
        tratamentoAgua: payload.tratamentoAgua || "",
        esgotamento: payload.esgotamento || "",
        sewage: String(payload.sewage || "").trim(),
        destinacaoLixo: payload.destinacaoLixo || "",
        coletaLixo: payload.coletaLixo !== undefined ? Boolean(payload.coletaLixo) : undefined,
        garbage: String(payload.garbage || "").trim(),
        energiaEletrica: payload.energiaEletrica !== undefined ? Boolean(payload.energiaEletrica) : undefined,
        electricity: String(payload.electricity || "").trim(),
        materialPredominanteParedes: payload.materialPredominanteParedes || "",
        situacaoMoradiaPosseTerra: payload.situacaoMoradiaPosseTerra || "",
        tipoEndereco: payload.tipoEndereco || "",
        homeVisitFreq: String(payload.homeVisitFreq || "").trim(),
        createdAt: now,
        updatedAt: now
      };

      db.households.push(household);
      addAuditLog(db, buildHouseholdActor(req), "household.created", "household", household.id, {
        patientId: household.patientId,
        teamId: household.teamId,
        outcome: "success",
        after: { ...household }
      });

      return { household };
    });

    if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
    return res.status(201).json(result.household);
  }
);

// PATCH /households/:id — partial update of household fields
router.patch(
  "/households/:id",
  requireAuth,
  validate(HouseholdUpdateSchema),
  async (req, res) => {
    const householdId = String(req.params.id || "").trim();
    const payload = req.body || {};

    const result = await withDb((db) => {
      ensureDbShape(db);

      const idx = db.households.findIndex((h) => h.id === householdId);
      if (idx < 0) return { error: { status: 404, message: "Domicílio não encontrado" } };

      const current = db.households[idx];

      // Scope: non-break_glass users can only edit households in their team
      if (req.user.role !== "break_glass_admin" && current.teamId !== req.user.teamId) {
        return { error: { status: 403, message: "Sem permissão para editar este domicílio" } };
      }

      const now = new Date().toISOString();
      const next = { ...current, updatedAt: now };
      if (payload.familyCode !== undefined)  next.familyCode  = String(payload.familyCode  || "").trim();
      if (payload.tipoImovel !== undefined) { next.tipoImovel = payload.tipoImovel; next.housingType = payload.tipoImovel; }
      if (payload.housingType !== undefined && payload.tipoImovel === undefined) { next.housingType = payload.housingType; next.tipoImovel = payload.housingType; }
      if (payload.numMoradores !== undefined) next.numMoradores = Number(payload.numMoradores);
      if (payload.numComodos !== undefined) next.numComodos = Number(payload.numComodos);
      if (payload.localizacao !== undefined) next.localizacao = payload.localizacao;
      if (payload.abastecimentoAgua !== undefined) next.abastecimentoAgua = payload.abastecimentoAgua;
      if (payload.waterSupply !== undefined) next.waterSupply = String(payload.waterSupply || "").trim();
      if (payload.tratamentoAgua !== undefined) next.tratamentoAgua = payload.tratamentoAgua;
      if (payload.esgotamento !== undefined) next.esgotamento = payload.esgotamento;
      if (payload.sewage      !== undefined) next.sewage      = String(payload.sewage      || "").trim();
      if (payload.destinacaoLixo !== undefined) next.destinacaoLixo = payload.destinacaoLixo;
      if (payload.coletaLixo !== undefined) next.coletaLixo = Boolean(payload.coletaLixo);
      if (payload.garbage     !== undefined) next.garbage     = String(payload.garbage     || "").trim();
      if (payload.energiaEletrica !== undefined) next.energiaEletrica = Boolean(payload.energiaEletrica);
      if (payload.electricity !== undefined) next.electricity = String(payload.electricity || "").trim();
      if (payload.materialPredominanteParedes !== undefined) next.materialPredominanteParedes = payload.materialPredominanteParedes;
      if (payload.situacaoMoradiaPosseTerra !== undefined) next.situacaoMoradiaPosseTerra = payload.situacaoMoradiaPosseTerra;
      if (payload.tipoEndereco !== undefined) next.tipoEndereco = payload.tipoEndereco;
      if (payload.homeVisitFreq !== undefined) next.homeVisitFreq = String(payload.homeVisitFreq || "").trim();

      db.households[idx] = next;
      addAuditLog(db, buildHouseholdActor(req), "household.updated", "household", householdId, {
        patientId: current.patientId,
        teamId: current.teamId,
        changedFields: Object.keys(payload),
        outcome: "success",
        before: { ...current },
        after: { ...next }
      });

      return { household: next };
    });

    if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
    return res.json(result.household);
  }
);

export default router;
