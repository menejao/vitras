import express from "express";
import { pool, checkDbHealth, isPostgresMode } from "../db.js";
import { IS_PROD, UPSTASH_URL, UPSTASH_TOKEN } from "../config.js";
import { getRuntimeState, getStartupPhase, isDegraded, getDegradedReason } from "../services/runtime-state.js";
import { getMetrics } from "../middlewares/logging.js";
import { logWarn } from "../utils/logger.js";
import { getCircuitBreakerState } from "../middlewares/rate-limits.js";

const router = express.Router();

// Registered migrations count (must stay in sync with migrations/index.js)
const REGISTERED_MIGRATION_COUNT = 11;

// Track last known auditChain state (updated by integrity endpoint calls)
let _lastAuditChainStatus = "unknown";
function setLastAuditChainStatus(status) {
  _lastAuditChainStatus = status;
}

/**
 * Check postgres reachability with a short timeout.
 * Returns "ok" | "error" | "unknown"
 */
async function checkPostgresSubsystem() {
  if (!isPostgresMode() || !pool) return "unknown";
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 2000)
    );
    const queryPromise = pool.query("SELECT 1");
    await Promise.race([queryPromise, timeoutPromise]);
    return "ok";
  } catch (_) {
    return "error";
  }
}

/**
 * Check Redis/Upstash subsystem based on configured env vars and circuit breaker state.
 * Returns "ok" | "error" | "unknown"
 */
function checkRedisSubsystem() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return "unknown";
  try {
    const state = getCircuitBreakerState();
    if (state === "OPEN") return "error";
    return "ok";
  } catch (_) {
    return "ok";
  }
}

/**
 * Check migrations subsystem.
 * Returns "ok" | "unknown" | "error"
 */
async function checkMigrationsSubsystem() {
  if (!isPostgresMode() || !pool) return "unknown";
  try {
    const result = await pool.query(
      "SELECT COUNT(*) AS cnt FROM schema_migrations"
    );
    const cnt = parseInt(result.rows[0]?.cnt || "0", 10);
    return cnt >= REGISTERED_MIGRATION_COUNT ? "ok" : "error";
  } catch (_) {
    return "unknown";
  }
}

router.get("/health", async (_req, res) => {
  const runtime = getRuntimeState();
  const phase = getStartupPhase();
  const degraded = isDegraded();
  const degradedReason = getDegradedReason();

  // F-01: Return 503 during shutdown so EB drains the instance
  if (runtime.shuttingDown) {
    return res.status(503).json({
      ok: false,
      status: "shutting_down",
      phase: "shutting_down",
      ready: false,
      degraded: false,
      timestamp: new Date().toISOString()
    });
  }

  // F-01: Return 503 until readiness.ready=true so EB does NOT route traffic prematurely
  if (!runtime.readiness.ready) {
    return res.status(503).json({
      ok: false,
      status: "starting",
      phase: phase || "booting",
      ready: false,
      degraded: false,
      message: "Instance is starting up — not yet ready to serve traffic",
      timestamp: new Date().toISOString()
    });
  }

  // Collect subsystem statuses (non-strict — errors don't block response)
  const [postgresStatus, migrationsStatus] = await Promise.all([
    checkPostgresSubsystem(),
    checkMigrationsSubsystem()
  ]);

  const redisStatus = checkRedisSubsystem();

  const subsystems = {
    postgres: postgresStatus,
    redis: redisStatus,
    migrations: migrationsStatus,
    auditChain: _lastAuditChainStatus
  };

  // Degraded mode returns 200 — instance stays in EB rotation
  const status = degraded ? "degraded" : (postgresStatus === "error" ? "degraded" : "ok");
  const ok = !runtime.shuttingDown && runtime.readiness.ready;

  res.status(200).json({
    ok,
    status,
    phase,
    ready: runtime.readiness.ready,
    degraded,
    degradedReason: degraded ? degradedReason : undefined,
    subsystems,
    timestamp: new Date().toISOString(),
    runtime: {
      startedAt: runtime.startedAt,
      bootCompletedAt: runtime.bootCompletedAt,
      shuttingDown: runtime.shuttingDown,
      ready: runtime.readiness.ready
    }
  });
});

/**
 * /readyz — strict liveness check.
 * Returns 200 only when: migrations done AND postgres reachable AND readiness.ready=true
 * Any subsystem failure → 503
 */
router.get("/readyz", async (_req, res) => {
  const runtime = getRuntimeState();

  if (runtime.shuttingDown || !runtime.readiness.ready) {
    return res.status(503).json({
      ok: false,
      reason: runtime.shuttingDown ? "shutting_down" : "not_ready",
      timestamp: new Date().toISOString()
    });
  }

  // Strict postgres check
  const postgresOk = await checkPostgresSubsystem();
  if (postgresOk === "error") {
    return res.status(503).json({
      ok: false,
      reason: "postgres_unreachable",
      timestamp: new Date().toISOString()
    });
  }

  return res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    readiness: {
      ready: runtime.readiness.ready,
      phase: getStartupPhase()
    }
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
export { setLastAuditChainStatus };
