/**
 * Production routes — APS-01F
 *
 * GET /production/acs         — ACS own production metrics
 * GET /production/nurse       — team-level metrics (nurse_manager, gestor)
 * GET /production/manager     — territory-level metrics (gestor, nurse_manager)
 * GET /production/microareas  — per-microarea metrics
 */

import express from "express";
import { readDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { isAcs, canonicalRole } from "../utils/helpers.js";
import {
  getAcsMetrics,
  getNurseMetrics,
  getManagerMetrics,
  getMicroareaMetrics,
  periodBounds,
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

export default router;
