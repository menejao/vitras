import express from "express";
import { ADMIN_SEED_KEY, ENABLE_ADMIN_SEED } from "../config.js";
import { seedDemoTeamRosa } from "../services/seed-demo.js";
import { withDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { backfillFamilyGroups } from "../utils/family-groups.js";
import { hasRole } from "../utils/helpers.js";
import { logInfo, logError } from "../utils/logger.js";

const router = express.Router();

// Shared guard: requireAuth must already have run (router mounted after requireAuth in app.js)
function requireSeedAdminRole(req, res, next) {
  if (!hasRole(req.user, ["gestor", "break_glass_admin"])) {
    return res.status(403).json({ error: "Apenas gestor ou administrador pode executar esta ação" });
  }
  return next();
}

router.post("/admin/run-demo-seed", requireSeedAdminRole, async (req, res) => {
  if (!ENABLE_ADMIN_SEED) {
    return res.status(403).json({ error: "Rotina administrativa desabilitada neste ambiente" });
  }

  const sentKey = String(req.headers["x-admin-seed-key"] || "").trim();
  if (!sentKey || !ADMIN_SEED_KEY || sentKey !== ADMIN_SEED_KEY) {
    return res.status(401).json({ error: "x-admin-seed-key inválido ou ausente" });
  }

  logInfo("seed_admin_start", { event: "seed_admin_start" });
  try {
    const result = await seedDemoTeamRosa();
    logInfo("seed_admin_persisted", { event: "seed_admin_persisted" });

    if (result?.skipped) {
      return res.status(400).json({ error: "SEED_DEMO_DATA não está habilitado no servidor" });
    }

    logInfo("seed_admin_done", { event: "seed_admin_done", totalPatients: result.totalPatients, createdPatients: result.createdPatients });
    return res.json({
      ok: true,
      totalPatients:    result.totalPatients,
      createdPatients:  result.createdPatients,
      removedPatients:  result.removedPatients,
      countsByCategory: result.countsByCategory,
    });
  } catch (err) {
    logError("seed_admin_error", { event: "seed_admin_error", message: err.message });
    return res.status(500).json({ error: `Seed falhou: ${err.message}` });
  }
});

router.post("/admin/backfill-family-groups", requireSeedAdminRole, async (req, res) => {
  if (!ENABLE_ADMIN_SEED) {
    return res.status(403).json({ error: "Rotina administrativa desabilitada neste ambiente" });
  }
  const sentKey = String(req.headers["x-admin-seed-key"] || "").trim();
  if (!sentKey || !ADMIN_SEED_KEY || sentKey !== ADMIN_SEED_KEY) {
    return res.status(401).json({ error: "x-admin-seed-key inválido ou ausente" });
  }
  try {
    const result = await withDb((db) => {
      ensureDbShape(db);
      return backfillFamilyGroups(db, { id: "system", name: "Sistema (backfill)" });
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    logError("backfill_error", { event: "backfill_error", message: err.message });
    return res.status(500).json({ error: `Backfill falhou: ${err.message}` });
  }
});

export default router;
