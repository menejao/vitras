/**
 * Production routes — APS-01F + VITRAS-INDICATORS-AND-OPERATIONAL-PRODUCTION-01
 *
 * GET /production/acs          — ACS own production metrics
 * GET /production/nurse        — team-level metrics (nurse_manager, gestor)
 * GET /production/manager      — territory-level metrics (gestor, nurse_manager)
 * GET /production/microareas   — per-microarea metrics
 * GET /production/territorial  — territorial indicators for active unit (engine)
 * GET /production/operational  — operational production for active unit (engine)
 */

import express from "express";
import { readDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { isAcs, canonicalRole, resolveActiveUnit } from "../utils/helpers.js";
import {
  getAcsMetrics,
  getNurseMetrics,
  getManagerMetrics,
  getMicroareaMetrics,
  periodBounds,
  getUnitTerritorialMetrics,
  getUnitOperationalMetrics,
} from "../services/production-metrics.js";

const router = express.Router();

function parsePeriod(query) {
  const { period, from, to } = query;
  if (period === "custom" && (from || to)) {
    return periodBounds("custom", from, to);
  }
  return periodBounds(period || "mes");
}

// ── GET /production/acs ───────────────────────────────────────────────────────

router.get("/production/acs", async (req, res) => {
  try {
    const db = await readDb();
    ensureDbShape(db);

    const role = canonicalRole(req.user?.role);

    // ACS → own metrics; nurse/gestor → can query any ACS in team
    let targetAcsId;
    if (isAcs(req.user)) {
      targetAcsId = req.user.id;
    } else if (["nurse_manager", "gestor", "break_glass_admin"].includes(role)) {
      targetAcsId = req.query.acsId;
      if (!targetAcsId) {
        return res.status(400).json({ error: "acsId é obrigatório para esta função" });
      }
      // Scope: verify ACS is in same team
      const acsUser = db.users.find(u => u.id === targetAcsId);
      if (!acsUser) return res.status(404).json({ error: "ACS não encontrado" });
      if (role !== "break_glass_admin" && acsUser.teamId !== req.user.teamId) {
        return res.status(403).json({ error: "ACS não pertence à sua equipe" });
      }
    } else {
      return res.status(403).json({ error: "Sem permissão" });
    }

    const period = parsePeriod(req.query);
    const metrics = getAcsMetrics(db, targetAcsId, period);
    return res.json(metrics);
  } catch (err) {
    return res.status(500).json({ error: "Erro interno ao calcular métricas de produção" });
  }
});

// ── GET /production/nurse ─────────────────────────────────────────────────────

router.get("/production/nurse", async (req, res) => {
  try {
    const db = await readDb();
    ensureDbShape(db);

    const role = canonicalRole(req.user?.role);
    if (!["nurse_manager", "gestor", "break_glass_admin"].includes(role)) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    const teamId = req.user.teamId;
    const period = parsePeriod(req.query);
    const metrics = getNurseMetrics(db, teamId, period);
    return res.json(metrics);
  } catch (err) {
    return res.status(500).json({ error: "Erro interno ao calcular métricas de enfermagem" });
  }
});

// ── GET /production/manager ───────────────────────────────────────────────────

router.get("/production/manager", async (req, res) => {
  try {
    const db = await readDb();
    ensureDbShape(db);

    const role = canonicalRole(req.user?.role);
    if (!["nurse_manager", "gestor", "break_glass_admin"].includes(role)) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    const teamId = req.user.teamId;
    const period = parsePeriod(req.query);
    const metrics = getManagerMetrics(db, teamId, period);
    return res.json(metrics);
  } catch (err) {
    return res.status(500).json({ error: "Erro interno ao calcular métricas de gestão" });
  }
});

// ── GET /production/microareas ────────────────────────────────────────────────

router.get("/production/microareas", async (req, res) => {
  try {
    const db = await readDb();
    ensureDbShape(db);

    const role = canonicalRole(req.user?.role);
    let teamId;
    let acsIdFilter;

    if (isAcs(req.user)) {
      teamId = req.user.teamId;
      acsIdFilter = req.user.id;
    } else if (["nurse_manager", "gestor", "break_glass_admin"].includes(role)) {
      teamId = req.user.teamId;
      acsIdFilter = req.query.acsId || null;
    } else {
      return res.status(403).json({ error: "Sem permissão" });
    }

    const metrics = getMicroareaMetrics(db, teamId, acsIdFilter);
    return res.json(metrics);
  } catch (err) {
    return res.status(500).json({ error: "Erro interno ao calcular métricas por microárea" });
  }
});

// ── GET /production/territorial ───────────────────────────────────────────────
// Territorial indicators for the caller's active unit.
// Uses IndicatorAttributionEngine — all attribution via referenceUnitIdAtEvent.
// Gestor sees only their own UBS (resolveActiveUnit enforces scope).

const CLINICAL_ROLES = ["nurse_manager", "gestor", "doctor", "dentist", "break_glass_admin"];

router.get("/production/territorial", async (req, res) => {
  try {
    const db = await readDb();
    ensureDbShape(db);

    if (!CLINICAL_ROLES.includes(canonicalRole(req.user?.role))) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    const unitId = resolveActiveUnit(req);
    if (!unitId) return res.status(400).json({ error: "unitId não resolvido" });

    const period = parsePeriod(req.query);
    return res.json(getUnitTerritorialMetrics(db, unitId, period));
  } catch {
    return res.status(500).json({ error: "Erro interno ao calcular indicadores territoriais" });
  }
});

// ── GET /production/operational ───────────────────────────────────────────────
// Operational production for the caller's active unit.
// Uses IndicatorAttributionEngine — all attribution via executingUnitId.
// Gestor sees only their own UBS (resolveActiveUnit enforces scope).

router.get("/production/operational", async (req, res) => {
  try {
    const db = await readDb();
    ensureDbShape(db);

    if (!CLINICAL_ROLES.includes(canonicalRole(req.user?.role))) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    const unitId = resolveActiveUnit(req);
    if (!unitId) return res.status(400).json({ error: "unitId não resolvido" });

    const period = parsePeriod(req.query);
    return res.json(getUnitOperationalMetrics(db, unitId, period));
  } catch {
    return res.status(500).json({ error: "Erro interno ao calcular produção operacional" });
  }
});

export default router;
