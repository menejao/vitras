// C04A: CDS Export endpoint — Cadastro Individual
// Capability required: cds.export (gestor, break_glass_admin only)
// Audit: cds.export.individual on every successful export
import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import { hasCapability } from "../utils/helpers.js";
import { readDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { addAuditLog } from "../services/audit.js";
import { exportCadastroIndividual, exportCadastroDomiciliar } from "../services/cds-export/index.js";

const router = express.Router();

function buildCdsActor(req) {
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

/**
 * GET /export/cds/individual/:patientId
 *
 * Returns a .esus file (application/zip) for the patient's Cadastro Individual.
 * Query params:
 *   ?update=true  — sets fichaAtualizada=true (default: false = novo cadastro)
 *
 * Requires capability: cds.export
 * Audit: cds.export.individual
 */
router.get("/export/cds/individual/:patientId", requireAuth, async (req, res) => {
  if (!hasCapability(req.user, "cds.export")) {
    return res.status(403).json({ error: "Sem permissão para exportar dados CDS." });
  }

  const patientId = String(req.params.patientId || "").trim();
  if (!patientId) return res.status(400).json({ error: "patientId obrigatório" });

  const isUpdate = req.query.update === "true";

  let db;
  try {
    db = await readDb();
  } catch (err) {
    return res.status(503).json({ error: "Banco de dados indisponível." });
  }

  ensureDbShape(db);

  const patient = db.patients.find(p => p.id === patientId);
  if (!patient) return res.status(404).json({ error: "Paciente não encontrado." });

  // Territoriality: break_glass_admin has unrestricted access; gestor has patients.read.all
  // Both have cds.export, so no additional scope check needed.
  // (gestor can export any patient; break_glass_admin same)

  // Resolve professional = the requesting user
  const professional = db.users.find(u => u.id === req.user.id) || req.user;

  // Resolve unit from professional's unitId
  const unit = db.units?.find(u => u.id === (professional.unitId || req.user.unitId)) || null;

  // Resolve team from professional's teamId
  const teams = Array.isArray(db.teams) ? db.teams : [];
  const team = teams.find(t => t.id === (professional.teamId || req.user.teamId)) || null;

  // Validate minimum data for a valid CDS ficha
  const cnsProfissional = professional.cnsProfissional || professional.cns;
  const cbo = professional.cboCodigo;
  const cnes = unit?.cnes;

  const warnings = [];
  if (!cnsProfissional) warnings.push("cnsProfissional ausente no profissional exportador");
  if (!cbo) warnings.push("cboCodigo ausente no profissional exportador");
  if (!cnes) warnings.push("cnes ausente na unidade");

  let result;
  try {
    result = exportCadastroIndividual(patient, professional, unit, team, { isUpdate });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao gerar arquivo CDS.", detail: err.message });
  }

  // Audit: register every export event
  addAuditLog(db, buildCdsActor(req), "cds.export.individual", "patient", patientId, {
    patientId,
    fichaUuid: result.fichaUuid,
    originUuid: result.originUuid,
    isUpdate,
    warnings: warnings.length > 0 ? warnings : undefined,
    outcome: "success",
    exportedBy: { id: req.user.id, name: req.user.name, role: req.user.role }
  }).catch(() => {}); // audit failure must not block the download

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.setHeader("X-Ficha-UUID", result.fichaUuid);
  res.setHeader("X-Origin-UUID", result.originUuid);
  if (warnings.length > 0) {
    res.setHeader("X-CDS-Warnings", warnings.join("; "));
  }

  return res.send(result.buffer);
});

/**
 * GET /export/cds/domiciliar/:householdId
 *
 * Returns a .esus file for a household's Cadastro Domiciliar.
 * Query params:
 *   ?update=true  — sets fichaAtualizada=true (default: false)
 *
 * Requires capability: cds.export
 * Audit: cds.export.domiciliar
 */
router.get("/export/cds/domiciliar/:householdId", requireAuth, async (req, res) => {
  if (!hasCapability(req.user, "cds.export")) {
    return res.status(403).json({ error: "Sem permissão para exportar dados CDS." });
  }

  const householdId = String(req.params.householdId || "").trim();
  if (!householdId) return res.status(400).json({ error: "householdId obrigatório" });

  const isUpdate = req.query.update === "true";

  let db;
  try {
    db = await readDb();
  } catch (err) {
    return res.status(503).json({ error: "Banco de dados indisponível." });
  }

  ensureDbShape(db);

  const household = db.households?.find(h => h.id === householdId);
  if (!household) return res.status(404).json({ error: "Domicílio não encontrado." });

  // Resolve patient who owns the household (for audit and context)
  const patient = db.patients.find(p => p.id === household.patientId) || null;

  // Resolve professional = requesting user
  const professional = db.users.find(u => u.id === req.user.id) || req.user;

  // Resolve unit and team
  const unit = db.units?.find(u => u.id === (professional.unitId || req.user.unitId)) || null;
  const teams = Array.isArray(db.teams) ? db.teams : [];
  const team = teams.find(t => t.id === (professional.teamId || req.user.teamId)) || null;

  const cnsProfissional = professional.cnsProfissional || professional.cns;
  const cbo = professional.cboCodigo;
  const cnes = unit?.cnes;

  const warnings = [];
  if (!cnsProfissional) warnings.push("cnsProfissional ausente no profissional exportador");
  if (!cbo) warnings.push("cboCodigo ausente no profissional exportador");
  if (!cnes) warnings.push("cnes ausente na unidade");
  if (!household.tipoImovel && !household.housingType) warnings.push("tipoImovel ausente no domicílio");

  let result;
  try {
    result = exportCadastroDomiciliar(household, patient, professional, unit, team, { isUpdate });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao gerar arquivo CDS.", detail: err.message });
  }

  addAuditLog(db, buildCdsActor(req), "cds.export.domiciliar", "household", householdId, {
    householdId,
    patientId: household.patientId,
    fichaUuid: result.fichaUuid,
    originUuid: result.originUuid,
    isUpdate,
    warnings: warnings.length > 0 ? warnings : undefined,
    outcome: "success",
    exportedBy: { id: req.user.id, name: req.user.name, role: req.user.role }
  }).catch(() => {});

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.setHeader("X-Ficha-UUID", result.fichaUuid);
  res.setHeader("X-Origin-UUID", result.originUuid);
  if (warnings.length > 0) {
    res.setHeader("X-CDS-Warnings", warnings.join("; "));
  }

  return res.send(result.buffer);
});

export default router;
