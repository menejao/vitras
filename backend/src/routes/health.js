import express from "express";
import { checkDbHealth } from "../db.js";
import { IS_PROD } from "../config.js";
import { getRuntimeState, getStartupPhase } from "../services/runtime-state.js";
import { getMetrics } from "../middlewares/logging.js";
import { logWarn } from "../utils/logger.js";

const router = express.Router();

router.get("/health", async (_req, res) => {
  const db = await checkDbHealth();
  const runtime = getRuntimeState();
  const phase = getStartupPhase();

  // F-01: Return 503 during shutdown so EB drains the instance
  if (runtime.shuttingDown) {
    return res.status(503).json({
      ok: false,
      status: "shutting_down",
      phase: "shutting_down",
      ready: false,
      timestamp: new Date().toISOString()
    });
  }

  // F-01: Return 503 until readiness.ready=true so EB does NOT route traffic prematurely
  if (!runtime.readiness.ready) {
    return res.status(503).json({
      ok: false,
      status: "booting",
      phase: phase || "booting",
      ready: false,
      message: "Instance is starting up — not yet ready to serve traffic",
      timestamp: new Date().toISOString()
    });
  }

  // Instance is ready — return 200 as normal
  const ok = db.ok;
  res.status(ok ? 200 : 503).json({
    ok,
    status: ok ? "ok" : "degraded",
    phase: "ready",
    ready: true,
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
