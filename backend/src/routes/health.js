import express from "express";
import { checkDbHealth } from "../db.js";
import { IS_PROD } from "../config.js";
import { getRuntimeState } from "../services/runtime-state.js";
import { getMetrics } from "../middlewares/logging.js";
import { logWarn } from "../utils/logger.js";

const router = express.Router();

router.get("/health", async (_req, res) => {
  const db = await checkDbHealth();
  const runtime = getRuntimeState();
  const ok = db.ok && !runtime.shuttingDown;
  res.status(ok ? 200 : 503).json({
    ok,
    timestamp: new Date().toISOString(),
    db,
    runtime: {
      startedAt: runtime.startedAt,
      bootCompletedAt: runtime.bootCompletedAt,
      shuttingDown: runtime.shuttingDown,
      ready: runtime.readiness.ready
    }
  });
});

router.get("/readyz", async (_req, res) => {
  const db = await checkDbHealth();
  const runtime = getRuntimeState();
  const ok = db.ok && runtime.readiness.ready && !runtime.shuttingDown;
  res.status(ok ? 200 : 503).json({
    ok,
    timestamp: new Date().toISOString(),
    db,
    readiness: runtime.readiness
  });
});

router.get("/metrics/internal", (_req, res) => {
  if (IS_PROD) {
    return res.status(404).json({ error: "Nao encontrado" });
  }
  res.json({
    ok: true,
    metrics: getMetrics()
  });
});

router.post("/csp-report", express.json({ type: ["application/json", "application/csp-report"] }), (req, res) => {
  const report = req.body?.["csp-report"] || req.body;
  if (report) {
    logWarn("security.csp_violation", {
      requestId: req.requestId || "-",
      correlationId: req.correlationId || req.requestId || "-",
      report
    });
  }
  res.status(204).end();
});

export default router;
