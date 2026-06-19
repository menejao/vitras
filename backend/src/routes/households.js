import express from "express";
import { v4 as uuidv4 } from "uuid";
import { withDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { requireAuth } from "../middlewares/auth.js";
import { hasCapability } from "../utils/helpers.js";
import { validate, HouseholdCreateSchema, HouseholdUpdateSchema } from "../schemas.js";
import { addAuditLog } from "../services/audit.js";
import { buildAddressKey } from "../utils/family-groups.js";

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

    // Find by direct patientId link OR by patient.householdId pointing to the household
    const householdId = patient.householdId || null;
    const households = db.households.filter(
      (h) => h.patientId === patientId ||
             (householdId && h.id === householdId) ||
             (Array.isArray(h.patientIds) && h.patientIds.includes(patientId))
    );
    return res.json(households);
  }
);

// SEC-API-01A: GET /households/:id — single household detail, team-scoped
router.get(
  "/households/:id",
  requireAuth,
  async (req, res) => {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "id obrigatório" });

    const { readDb } = await import("../db.js");
    const db = await readDb();
    ensureDbShape(db);

    const household = db.households.find((h) => h.id === id);
    if (!household) return res.status(404).json({ error: "Domicílio não encontrado" });

    if (req.user.role !== "break_glass_admin" && household.teamId !== req.user.teamId) {
      return res.status(403).json({ error: "Sem permissão para visualizar este domicílio" });
    }

    return res.json(household);
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
      const teamId = String(patient.teamId || req.user.teamId || "");

      // APS-01J-E: compute addressKey from payload structured fields or patient's own address
      const addrSource = {
        logradouro: payload.logradouro || patient.logradouro || "",
        numero: payload.numero || patient.numero || "",
        bairro: payload.bairro || patient.bairro || "",
        cep: payload.cep || patient.cep || "",
      };
      const addressKey = buildAddressKey(addrSource);

      // Dedup: look for existing household in same team with same non-empty address
      let existingIdx = -1;
      if (addressKey) {
        existingIdx = db.households.findIndex(
          (h) => h.teamId === teamId && h.addressKey === addressKey
        );
      }

      if (existingIdx >= 0) {
        // Reuse existing household — link this patient to it
        const existing = db.households[existingIdx];
        if (!Array.isArray(existing.patientIds)) existing.patientIds = [existing.patientId].filter(Boolean);
        if (!existing.patientIds.includes(payload.patientId)) {
          existing.patientIds.push(payload.patientId);
          existing.updatedAt = now;
        }
        // Update patient.householdId
        const patientIdx = db.patients.findIndex((p) => p.id === payload.patientId);
        if (patientIdx >= 0) db.patients[patientIdx].householdId = existing.id;

        addAuditLog(db, buildHouseholdActor(req), "household.patientLinked", "household", existing.id, {
          patientId: payload.patientId, teamId, addressKey, outcome: "reused_existing",
        });

        return { household: existing, reused: true };
      }

      const household = {
        id: uuidv4(),
        patientId: String(payload.patientId || "").trim(),
        patientIds: [String(payload.patientId || "").trim()],
        teamId,
        addressKey: addressKey || "",
        logradouro: addrSource.logradouro,
        numero: addrSource.numero,
        bairro: addrSource.bairro,
        cep: addrSource.cep,
        municipioIbge: payload.municipioIbge || patient.municipioIbge || "",
        uf: payload.uf || patient.uf || "",
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
        tipoDomicilio: payload.tipoDomicilio || "",
        foraArea: payload.foraArea === true,
        animaisNoDomicilio: payload.animaisNoDomicilio === true,
        tiposAnimais: Array.isArray(payload.tiposAnimais) ? payload.tiposAnimais : [],
        quantidadeAnimais: payload.quantidadeAnimais ?? null,
        createdAt: now,
        updatedAt: now
      };

      db.households.push(household);

      // Link patient to this household
      const patientIdx = db.patients.findIndex((p) => p.id === payload.patientId);
      if (patientIdx >= 0) db.patients[patientIdx].householdId = household.id;

      addAuditLog(db, buildHouseholdActor(req), "household.created", "household", household.id, {
        patientId: household.patientId,
        teamId: household.teamId,
        addressKey: household.addressKey,
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

      // APS-01J-E: address fields on household
      let addrChanged = false;
      if (payload.logradouro !== undefined) { next.logradouro = payload.logradouro; addrChanged = true; }
      if (payload.numero !== undefined) { next.numero = payload.numero; addrChanged = true; }
      if (payload.bairro !== undefined) { next.bairro = payload.bairro; addrChanged = true; }
      if (payload.cep !== undefined) { next.cep = payload.cep; addrChanged = true; }
      if (payload.municipioIbge !== undefined) next.municipioIbge = payload.municipioIbge;
      if (payload.uf !== undefined) next.uf = payload.uf;
      if (addrChanged) {
        next.addressKey = buildAddressKey({ logradouro: next.logradouro, numero: next.numero, bairro: next.bairro, cep: next.cep });
      }

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
      if (payload.tipoDomicilio !== undefined) next.tipoDomicilio = payload.tipoDomicilio;
      if (payload.foraArea !== undefined) next.foraArea = Boolean(payload.foraArea);
      if (payload.animaisNoDomicilio !== undefined) next.animaisNoDomicilio = Boolean(payload.animaisNoDomicilio);
      if (payload.tiposAnimais !== undefined) next.tiposAnimais = Array.isArray(payload.tiposAnimais) ? payload.tiposAnimais : [];
      if (payload.quantidadeAnimais !== undefined) next.quantidadeAnimais = payload.quantidadeAnimais ?? null;

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
