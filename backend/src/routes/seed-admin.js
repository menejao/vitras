import express from "express";
import { ADMIN_SEED_KEY, ENABLE_ADMIN_SEED } from "../config.js";
import { seedDemoTeamRosa } from "../services/seed-demo.js";
import { withDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { backfillFamilyGroups } from "../utils/family-groups.js";

const router = express.Router();

router.post("/admin/run-demo-seed", async (req, res) => {
  if (!ENABLE_ADMIN_SEED) {
    return res.status(403).json({ error: "Rotina administrativa desabilitada neste ambiente" });
  }

  const sentKey = String(req.headers["x-admin-seed-key"] || "").trim();
  if (!sentKey || !ADMIN_SEED_KEY || sentKey !== ADMIN_SEED_KEY) {
    return res.status(401).json({ error: "x-admin-seed-key inválido ou ausente" });
  }

  console.log("[seed-admin] start");
  try {
    const result = await seedDemoTeamRosa();
    console.log("[seed-admin] persisted");

    if (result?.skipped) {
      return res.status(400).json({ error: "SEED_DEMO_DATA não está habilitado no servidor" });
    }

    console.log("[seed-admin] done");
    return res.json({
      ok: true,
      totalPatients:    result.totalPatients,
      createdPatients:  result.createdPatients,
      removedPatients:  result.removedPatients,
      countsByCategory: result.countsByCategory,
    });
  } catch (err) {
    console.error("[seed-admin] error:", err.message);
    return res.status(500).json({ error: `Seed falhou: ${err.message}` });
  }
});

router.post("/admin/backfill-family-groups", async (req, res) => {
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
    console.error("[backfill] error:", err.message);
    return res.status(500).json({ error: `Backfill falhou: ${err.message}` });
  }
});

export default router;
