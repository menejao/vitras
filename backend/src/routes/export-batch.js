// CDS Batch Export — Exportação em lote por competência
// Requires capability: cds.export
// Endpoints:
//   GET  /export/cds/batch/validate  — pre-validation summary (CNES, INE, patients, professionals)
//   POST /export/cds/batch           — generate lote ZIP + record history
//   GET  /export/cds/batch/history   — list export history

import express from "express";
import { ZipArchive } from "archiver";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middlewares/auth.js";
import { hasCapability } from "../utils/helpers.js";
import { readDb, withDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { addAuditLog } from "../services/audit.js";
import { exportCadastroIndividual } from "../services/cds-export/index.js";
import { isValidCns, isValidCpf, resolveSexField } from "../utils/cds-validators.js";

const router = express.Router();

const LAYOUT_VERSION = "3.2.3";
const LAYOUT_VIGENCIA = "jan/2024";

// ── shared validation logic ────────────────────────────────────────────────

function parseCompetencia(query) {
  const month = parseInt(query.month || new Date().getMonth() + 1, 10);
  const year  = parseInt(query.year  || new Date().getFullYear(), 10);
  if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2000 || year > 2100) {
    return null;
  }
  return { month, year, label: `${String(month).padStart(2, "0")}/${year}` };
}

function validatePatientForExport(p) {
  const blockers = [];
  const warnings = [];
  if (!p.name || !String(p.name).trim())                blockers.push({ field: "Nome",              msg: "Nome obrigatório no e-SUS" });
  if (!p.birthDate)                                     blockers.push({ field: "Data de nascimento", msg: "Data de nascimento obrigatória" });
  // resolveSexField checks sexAtBirth, sex, gender in order — same as cds-structs serializer
  if (!resolveSexField(p))                              blockers.push({ field: "Sexo",              msg: "Sexo biológico obrigatório no CDS (campo sexAtBirth)" });
  if (p.cns   && !isValidCns(p.cns))                   blockers.push({ field: "CNS",               msg: `CNS do paciente inválido: "${p.cns}"` });
  if (p.cpf   && !isValidCpf(p.cpf))                   blockers.push({ field: "CPF",               msg: `CPF do paciente inválido: "${p.cpf}"` });
  if (!p.cns && !p.cpf && !p.document)                 warnings.push({ field: "Identificação",     msg: "CNS ou CPF recomendados para evitar rejeição" });
  if (!p.address && !p.street && !p.microarea && !p.microArea) warnings.push({ field: "Endereço/Microárea", msg: "Endereço ou microárea ausente" });
  return { blockers, warnings };
}

function buildSummary(db, professional, unit, team, competencia) {
  const cnes    = unit?.cnes;
  const ine     = team?.ine;
  const cnsProf = professional?.cnsProfissional || professional?.cns;
  const cbo     = professional?.cboCodigo;

  const blockers = [];
  // CNES/INE/CBO/CNS profissional: deployment checklist items — system blocks correctly and guides configuration
  if (!cnes || cnes === "0000000")     blockers.push("CNES da unidade ausente ou inválido — configure em Configurações > Unidade antes de exportar");
  if (!ine  || ine  === "0000000000") blockers.push("INE da equipe ausente ou inválido — configure em Configurações > Equipe antes de exportar");
  if (!cnsProf)                        blockers.push("CNS do profissional exportador ausente — configure em Meu Perfil antes de exportar");
  else if (!isValidCns(cnsProf))       blockers.push(`CNS do profissional inválido: "${cnsProf}" — deve ter 15 dígitos numéricos (algoritmo oficial)`);
  if (!cbo)                            blockers.push("Código CBO do profissional exportador ausente — configure em Meu Perfil antes de exportar");

  const patients = (db.patients || []).filter(p => !p.inactive);
  const patientResults = patients.map(p => {
    const { blockers: pb, warnings: pw } = validatePatientForExport(p);
    return { id: p.id, name: p.name || "(sem nome)", blockers: pb, warnings: pw };
  });

  const apt     = patientResults.filter(p => p.blockers.length === 0).length;
  const blocked = patientResults.filter(p => p.blockers.length > 0).length;
  const warned  = patientResults.filter(p => p.blockers.length === 0 && p.warnings.length > 0).length;

  const profUsers = (db.users || []).filter(u => !u.inactive);
  const profIssues = profUsers.filter(u => {
    const cns = u.cnsProfissional || u.cns;
    return !cns || !u.cboCodigo;
  }).map(u => ({ id: u.id, name: u.name, missing: [!( u.cnsProfissional || u.cns) && "CNS", !u.cboCodigo && "CBO"].filter(Boolean) }));

  const conformidade = patients.length > 0 ? Math.round(apt / patients.length * 100) : 100;

  return {
    competencia: competencia.label,
    unit:  { id: unit?.id, name: unit?.name, cnes, cnesValid: Boolean(cnes && cnes !== "0000000") },
    team:  { id: team?.id, name: team?.name, ine,  ineValid:  Boolean(ine  && ine  !== "0000000000") },
    professional: { id: professional?.id, name: professional?.name, cnsValid: Boolean(cnsProf), cboValid: Boolean(cbo) },
    patients: { total: patients.length, apt, blocked, warned, issues: patientResults.filter(p => p.blockers.length || p.warnings.length) },
    professionals: { total: profUsers.length, apt: profUsers.length - profIssues.length, issues: profIssues },
    conformidade,
    canExport: blockers.length === 0,
    blockers,
  };
}

// ── GET /export/cds/batch/validate ─────────────────────────────────────────

router.get("/export/cds/batch/validate", requireAuth, async (req, res) => {
  if (!hasCapability(req.user, "cds.export")) {
    return res.status(403).json({ error: "Sem permissão para exportar dados CDS." });
  }

  const competencia = parseCompetencia(req.query);
  if (!competencia) return res.status(400).json({ error: "Competência inválida. Informe month e year." });

  let db;
  try { db = await readDb(); } catch { return res.status(503).json({ error: "Banco de dados indisponível." }); }
  ensureDbShape(db);

  const professional = db.users.find(u => u.id === req.user.id) || req.user;
  const unit         = (db.units || []).find(u => u.id === (professional.unitId || req.user.unitId)) || null;
  const team         = (db.teams || []).find(t => t.id === (professional.teamId || req.user.teamId)) || null;

  return res.json(buildSummary(db, professional, unit, team, competencia));
});

// ── POST /export/cds/batch ─────────────────────────────────────────────────

router.post("/export/cds/batch", requireAuth, async (req, res) => {
  if (!hasCapability(req.user, "cds.export")) {
    return res.status(403).json({ error: "Sem permissão para exportar dados CDS." });
  }

  const competencia = parseCompetencia(req.body);
  if (!competencia) return res.status(400).json({ error: "Competência inválida. Informe month e year." });

  let db;
  try { db = await readDb(); } catch { return res.status(503).json({ error: "Banco de dados indisponível." }); }
  ensureDbShape(db);

  const professional = db.users.find(u => u.id === req.user.id) || req.user;
  const unit         = (db.units || []).find(u => u.id === (professional.unitId || req.user.unitId)) || null;
  const team         = (db.teams || []).find(t => t.id === (professional.teamId || req.user.teamId)) || null;

  const summary = buildSummary(db, professional, unit, team, competencia);

  if (!summary.canExport) {
    return res.status(422).json({
      error: "Exportação bloqueada por inconsistências.",
      blockers: summary.blockers,
      summary,
    });
  }

  // Build archive
  const batchId  = uuidv4();
  const filename = `lote-${competencia.year}${String(competencia.month).padStart(2, "0")}-${batchId.slice(0, 8)}.zip`;

  const exported   = [];
  const skipped    = [];
  const patients   = (db.patients || []).filter(p => !p.inactive);

  let zipBuffer;
  try {
    zipBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      const archive = new ZipArchive({ store: true });
      archive.on("data",   c => chunks.push(c));
      archive.on("end",    () => resolve(Buffer.concat(chunks)));
      archive.on("error",  reject);

      for (const patient of patients) {
        const { blockers: pb } = validatePatientForExport(patient);
        if (pb.length > 0) {
          skipped.push({ id: patient.id, name: patient.name, reasons: pb.map(b => b.msg) });
          continue;
        }
        try {
          const result = exportCadastroIndividual(patient, professional, unit, team, { isUpdate: false });
          archive.append(result.buffer, { name: result.filename });
          exported.push({ id: patient.id, fichaUuid: result.fichaUuid });
        } catch (err) {
          skipped.push({ id: patient.id, name: patient.name, reasons: [`Erro na geração: ${err.message}`] });
        }
      }

      archive.finalize();
    });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao gerar arquivo ZIP.", detail: err.message });
  }

  // Persist history entry
  const historyEntry = {
    id:               batchId,
    ts:               new Date().toISOString(),
    competencia:      competencia.label,
    month:            competencia.month,
    year:             competencia.year,
    exportedBy:       { id: req.user.id, name: req.user.name, role: req.user.role },
    unitId:           unit?.id || null,
    unitName:         unit?.name || null,
    cnes:             unit?.cnes || null,
    teamId:           team?.id || null,
    teamName:         team?.name || null,
    ine:              team?.ine || null,
    patientsTotal:    patients.length,
    patientsExported: exported.length,
    patientsSkipped:  skipped.length,
    skippedReasons:   skipped,
    layoutVersion:    LAYOUT_VERSION,
    layoutVigencia:   LAYOUT_VIGENCIA,
    status:           skipped.length > 0 ? "partial" : "success",
    filename,
    sizeBytes:        zipBuffer.length,
  };

  await withDb(async (db2) => {
    ensureDbShape(db2);
    db2.exportHistory.push(historyEntry);
  }).catch(() => {});  // history failure must not block the download

  addAuditLog(db, { ...req.user, requestMeta: { ip: req.ip, method: "POST", path: req.originalUrl } },
    "cds.export.batch", "batch", batchId, {
      competencia: competencia.label,
      patientsExported: exported.length,
      patientsSkipped: skipped.length,
      status: historyEntry.status,
      layoutVersion: LAYOUT_VERSION,
    }
  ).catch(() => {});

  // Inform about skipped records
  if (skipped.length > 0) {
    res.setHeader("X-Batch-Exported", String(exported.length));
    res.setHeader("X-Batch-Skipped",  String(skipped.length));
  }

  // FUTURE: PEC_AUTO_INTEGRATION
  // When the municipality activates the official PEC integration:
  //   1. Replace res.send(zipBuffer) with a POST to the PEC API endpoint
  //   2. Store the PEC transmission response in historyEntry.pecTransmission
  //   3. Update historyEntry.status to "transmitted" on success
  // All validation, generation, and audit logic above remains unchanged.
  // Only this final delivery step changes — architecture is ready.

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Batch-Id",          batchId);
  res.setHeader("X-Layout-Version",    LAYOUT_VERSION);
  res.setHeader("X-Competencia",       competencia.label);

  return res.send(zipBuffer);
});

// ── GET /export/cds/batch/history ─────────────────────────────────────────

router.get("/export/cds/batch/history", requireAuth, async (req, res) => {
  if (!hasCapability(req.user, "cds.export")) {
    return res.status(403).json({ error: "Sem permissão." });
  }

  let db;
  try { db = await readDb(); } catch { return res.status(503).json({ error: "Banco de dados indisponível." }); }
  ensureDbShape(db);

  const limit   = Math.min(parseInt(req.query.limit || "50", 10), 200);
  const history = [...(db.exportHistory || [])].reverse().slice(0, limit);

  return res.json({ history, total: (db.exportHistory || []).length });
});

export default router;
