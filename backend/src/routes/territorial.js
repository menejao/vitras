// territorial.js — TERRITORIAL-MAP-PERSISTENCE-UBS-CENTERING-01
// CRUD de microáreas territoriais — dados da UBS, não dados clínicos.
// Sem GPS de ACS, sem coordenada de paciente, sem dados clínicos.
import { v4 as uuidv4 } from "uuid";
import express from "express";
import { readDb, withDb } from "../db.js";
import { requireAuth } from "../middlewares/auth.js";
import { ensureDbShape } from "../utils/domain.js";
import { addAuditLog } from "../services/audit.js";
import { canonicalRole } from "../utils/helpers.js";

const router = express.Router();

router.use("/territorial", requireAuth);

function canWrite(user) {
  if (!user) return false;
  const role = canonicalRole(user.role);
  return ["gestor", "manager", "support_admin", "doctor", "nurse"].includes(role) ||
    (user.capabilities || []).includes("records.write");
}

// ── GET /territorial/unit — localização da UBS atual ──────────────────────
router.get("/territorial/unit", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const unit = (db.units || []).find(u => u.id === req.user.unitId);
  if (!unit) return res.status(404).json({ error: "Unidade não encontrada" });
  return res.json({
    id: unit.id,
    name: unit.name,
    lat: unit.lat ?? null,
    lng: unit.lng ?? null,
    street: unit.street || null,
    streetNumber: unit.streetNumber || null,
    neighborhood: unit.neighborhood || null,
    cep: unit.cep || null,
    municipalityName: unit.municipalityName || null,
    uf: unit.uf || null,
    geocodingStatus: unit.geocodingStatus || "none",
  });
});

// ── GET /territorial/areas — lista microáreas da unidade ──────────────────
router.get("/territorial/areas", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const areas = (db.microAreas || [])
    .filter(a => a.unitId === req.user.unitId && !a.deletedAt);
  return res.json({ areas });
});

// ── POST /territorial/areas — criar microárea ─────────────────────────────
router.post("/territorial/areas", async (req, res) => {
  if (!canWrite(req.user)) {
    return res.status(403).json({ error: "Sem permissão para criar microáreas" });
  }
  const p = req.body || {};
  const name = String(p.name || "").trim();
  if (!name) return res.status(400).json({ error: "nome é obrigatório" });
  if (!p.teamColor) return res.status(400).json({ error: "cor é obrigatória" });

  const now = new Date().toISOString();
  const isActive = p.status === "active";
  const area = {
    id: uuidv4(),
    unitId: req.user.unitId,
    name,
    code: String(p.code || "").trim(),
    teamName: String(p.teamName || "").trim(),
    teamColor: String(p.teamColor || "").trim(),
    acsName: String(p.acsName || "").trim(),
    status: isActive ? "active" : "draft",
    active: isActive,
    polygonGeoJson: p.polygonGeoJson || null,
    streets: Array.isArray(p.streets) ? p.streets : [],
    neighborhood: String(p.neighborhood || "").trim(),
    notes: String(p.notes || "").trim(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await withDb(db => {
    ensureDbShape(db);
    if (!Array.isArray(db.microAreas)) db.microAreas = [];
    db.microAreas.push(area);
    addAuditLog(db, req.user, "TERRITORIAL_AREA_CREATED", "micro_area", area.id, {
      name: area.name, status: area.status, unitId: area.unitId,
    });
  });

  return res.status(201).json({ area });
});

// ── PATCH /territorial/areas/:id — atualizar microárea ───────────────────
router.patch("/territorial/areas/:id", async (req, res) => {
  if (!canWrite(req.user)) {
    return res.status(403).json({ error: "Sem permissão para editar microáreas" });
  }
  const { id } = req.params;
  const p = req.body || {};
  let updated = null;

  const err = await withDb(db => {
    ensureDbShape(db);
    if (!Array.isArray(db.microAreas)) db.microAreas = [];
    const idx = db.microAreas.findIndex(
      a => a.id === id && a.unitId === req.user.unitId && !a.deletedAt
    );
    if (idx === -1) return { notFound: true };

    const area = db.microAreas[idx];
    const newStatus = p.status === "active" || p.status === "draft" ? p.status : area.status;
    const patched = {
      ...area,
      name:           p.name       !== undefined ? String(p.name).trim()       : area.name,
      code:           p.code       !== undefined ? String(p.code).trim()       : area.code,
      teamName:       p.teamName   !== undefined ? String(p.teamName).trim()   : area.teamName,
      teamColor:      p.teamColor  !== undefined ? String(p.teamColor).trim()  : area.teamColor,
      acsName:        p.acsName    !== undefined ? String(p.acsName).trim()    : area.acsName,
      notes:          p.notes      !== undefined ? String(p.notes).trim()      : area.notes,
      neighborhood:   p.neighborhood !== undefined ? String(p.neighborhood).trim() : area.neighborhood,
      streets:        p.streets    !== undefined ? (Array.isArray(p.streets) ? p.streets : area.streets) : area.streets,
      polygonGeoJson: p.polygonGeoJson !== undefined ? (p.polygonGeoJson || null) : area.polygonGeoJson,
      status: newStatus,
      active: newStatus === "active",
      updatedAt: new Date().toISOString(),
    };
    db.microAreas[idx] = patched;
    updated = patched;
    addAuditLog(db, req.user, "TERRITORIAL_AREA_UPDATED", "micro_area", id, {
      name: patched.name, status: patched.status,
    });
  });

  if (err?.notFound) return res.status(404).json({ error: "Microárea não encontrada" });
  return res.json({ area: updated });
});

// ── DELETE /territorial/areas/:id — soft delete ───────────────────────────
router.delete("/territorial/areas/:id", async (req, res) => {
  if (!canWrite(req.user)) {
    return res.status(403).json({ error: "Sem permissão para excluir microáreas" });
  }
  const { id } = req.params;

  const err = await withDb(db => {
    ensureDbShape(db);
    if (!Array.isArray(db.microAreas)) db.microAreas = [];
    const idx = db.microAreas.findIndex(
      a => a.id === id && a.unitId === req.user.unitId && !a.deletedAt
    );
    if (idx === -1) return { notFound: true };
    const name = db.microAreas[idx].name;
    db.microAreas[idx] = {
      ...db.microAreas[idx],
      deletedAt: new Date().toISOString(),
      active: false,
      status: "deleted",
    };
    addAuditLog(db, req.user, "TERRITORIAL_AREA_DELETED", "micro_area", id, { name });
  });

  if (err?.notFound) return res.status(404).json({ error: "Microárea não encontrada" });
  return res.json({ ok: true });
});

export default router;
