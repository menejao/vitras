// C04A/C04B/C04C: CDS Export endpoints — Cadastro Individual + Cadastro Domiciliar + Atendimento Individual
// Capability required: cds.export (gestor, break_glass_admin only)
// Audit: cds.export.{individual,domiciliar,atendimento} on every successful export
import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import { hasCapability } from "../utils/helpers.js";
import { readDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { addAuditLog } from "../services/audit.js";
import { exportCadastroIndividual, exportCadastroDomiciliar, exportAtendimentoIndividual, exportVisitaDomiciliar } from "../services/cds-export/index.js";

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

/**
 * GET /export/cds/atendimento/:patientId/:recordId
 *
 * Returns a .esus file for a clinical record's Atendimento Individual.
 * Only exports record types eligible for AtendimentoIndividual CDS:
 *   consultation, nursing, procedure (excludes visit, note, prescription, etc.)
 *
 * Requires capability: cds.export
 * Audit: cds.export.atendimento (recordId + patientId logged; CID/CIAP NOT in audit details)
 */
router.get("/export/cds/atendimento/:patientId/:recordId", requireAuth, async (req, res) => {
  if (!hasCapability(req.user, "cds.export")) {
    return res.status(403).json({ error: "Sem permissão para exportar dados CDS." });
  }

  const patientId = String(req.params.patientId || "").trim();
  const recordId = String(req.params.recordId || "").trim();
  if (!patientId || !recordId) {
    return res.status(400).json({ error: "patientId e recordId obrigatórios" });
  }

  let db;
  try {
    db = await readDb();
  } catch (err) {
    return res.status(503).json({ error: "Banco de dados indisponível." });
  }

  ensureDbShape(db);

  const patient = db.patients.find(p => p.id === patientId);
  if (!patient) return res.status(404).json({ error: "Paciente não encontrado." });

  const record = Array.isArray(patient.records)
    ? patient.records.find(r => r.id === recordId)
    : null;
  if (!record) return res.status(404).json({ error: "Registro clínico não encontrado." });

  // Only clinical encounter types map to AtendimentoIndividual CDS
  const ELIGIBLE_TYPES = new Set(["consultation", "nursing", "procedure"]);
  if (!ELIGIBLE_TYPES.has(record.type)) {
    return res.status(422).json({
      error: "Tipo de registro não elegível para exportação como Atendimento Individual.",
      type: record.type,
      eligible: [...ELIGIBLE_TYPES],
    });
  }

  const professional = db.users.find(u => u.id === req.user.id) || req.user;
  const unit = db.units?.find(u => u.id === (professional.unitId || req.user.unitId)) || null;
  const teams = Array.isArray(db.teams) ? db.teams : [];
  const team = teams.find(t => t.id === (professional.teamId || req.user.teamId)) || null;

  const warnings = [];
  if (!(professional.cnsProfissional || professional.cns)) warnings.push("cnsProfissional ausente no profissional exportador");
  if (!professional.cboCodigo) warnings.push("cboCodigo ausente no profissional exportador");
  if (!unit?.cnes) warnings.push("cnes ausente na unidade");

  let result;
  try {
    result = exportAtendimentoIndividual(record, patient, professional, unit, team);
  } catch (err) {
    return res.status(500).json({ error: "Erro ao gerar arquivo CDS.", detail: err.message });
  }

  // Audit: CID/CIAP in SPECIAL_CATEGORY_FIELDS — NOT included in audit details
  addAuditLog(db, buildCdsActor(req), "cds.export.atendimento", "patient", patientId, {
    recordId,
    patientId,
    recordType: record.type,
    recordDate: record.date,
    fichaUuid: result.fichaUuid,
    warnings: warnings.length > 0 ? warnings : undefined,
    outcome: "success",
    exportedBy: { id: req.user.id, name: req.user.name, role: req.user.role },
  }).catch(() => {});

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.setHeader("X-Ficha-UUID", result.fichaUuid);
  if (warnings.length > 0) {
    res.setHeader("X-CDS-Warnings", warnings.join("; "));
  }

  return res.send(result.buffer);
});

/**
 * GET /export/cds/visita/:visitId
 *
 * Returns a .esus file for an ACS visit's Ficha de Visita Domiciliar e Territorial.
 *
 * Requires capability: cds.export
 * Audit: cds.export.visita
 */
router.get("/export/cds/visita/:visitId", requireAuth, async (req, res) => {
  if (!hasCapability(req.user, "cds.export")) {
    return res.status(403).json({ error: "Sem permissão para exportar dados CDS." });
  }

  const visitId = String(req.params.visitId || "").trim();
  if (!visitId) return res.status(400).json({ error: "visitId obrigatório" });

  let db;
  try {
    db = await readDb();
  } catch (err) {
    return res.status(503).json({ error: "Banco de dados indisponível." });
  }

  ensureDbShape(db);

  const visit = db.acsVisits?.find(v => v.id === visitId);
  if (!visit) return res.status(404).json({ error: "Visita não encontrada." });

  const patient = db.patients.find(p => p.id === visit.patientId) || null;

  // Resolve ACS professional who performed the visit (not necessarily the requester)
  const professional = db.users.find(u => u.id === visit.acsId) || db.users.find(u => u.id === req.user.id) || req.user;

  const unit = db.units?.find(u => u.id === (professional.unitId || req.user.unitId)) || null;
  const teams = Array.isArray(db.teams) ? db.teams : [];
  const team = teams.find(t => t.id === (professional.teamId || req.user.teamId)) || null;

  const warnings = [];
  if (!(professional.cnsProfissional || professional.cns)) warnings.push("cnsProfissional ausente no ACS");
  if (!professional.cboCodigo) warnings.push("cboCodigo ausente no ACS");
  if (!unit?.cnes) warnings.push("cnes ausente na unidade");
  if (!patient) warnings.push("paciente não encontrado — exportando sem dados do cidadão");
  if (!visit.desfecho) warnings.push("desfecho ausente na visita");

  let result;
  try {
    result = exportVisitaDomiciliar(visit, patient, professional, unit, team);
  } catch (err) {
    return res.status(500).json({ error: "Erro ao gerar arquivo CDS.", detail: err.message });
  }

  addAuditLog(db, buildCdsActor(req), "cds.export.visita", "acs_visit", visitId, {
    visitId,
    patientId: visit.patientId,
    acsId: visit.acsId,
    visitDate: visit.date,
    desfecho: visit.desfecho,
    fichaUuid: result.fichaUuid,
    warnings: warnings.length > 0 ? warnings : undefined,
    outcome: "success",
    exportedBy: { id: req.user.id, name: req.user.name, role: req.user.role }
  }).catch(() => {});

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.setHeader("X-Ficha-UUID", result.fichaUuid);
  if (warnings.length > 0) {
    res.setHeader("X-CDS-Warnings", warnings.join("; "));
  }

  return res.send(result.buffer);
});

export default router;
