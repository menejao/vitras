import { rateLimit } from "express-rate-limit";
import {
  IS_PROD,
  UPSTASH_URL,
  UPSTASH_TOKEN,
  AUTH_WINDOW_MS,
  AUTH_MAX_ATTEMPTS,
  GLOBAL_RATE_LIMIT_WINDOW_MS,
  GLOBAL_RATE_LIMIT_MAX_REQUESTS,
  READ_ONLY_MODE
} from "../config.js";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
function isReadMethod(req) {
  return READ_METHODS.has(String(req.method || "").toUpperCase());
}

const READ_ONLY_RESPONSE = { error: "read_only_mode", message: "Sistema temporariamente em modo somente-leitura." };
import { getClientIp } from "../utils/helpers.js";
import { logWarn, logError } from "../utils/logger.js";
import { recordMetric } from "../services/metrics.js";

// ── Circuit breaker state for Redis/Upstash ──────────────────────────────────
// States: "CLOSED" (normal) → "OPEN" (failing) → "HALF_OPEN" (testing)
const CB_FAILURE_THRESHOLD = 5;      // consecutive failures to open
const CB_WINDOW_MS = 60 * 1000;      // 60s window for counting failures
const CB_HALF_OPEN_DELAY_MS = 30000; // wait 30s before probing

let _cbState = "CLOSED";
let _cbFailureCount = 0;
let _cbWindowStart = Date.now();
let _cbOpenedAt = 0;
// KI-05: single probe in HALF_OPEN — only one request goes through at a time
let _cbProbeInFlight = false;

function getCircuitBreakerState() {
  return _cbState;
}

function _cbRecordFailure() {
  const now = Date.now();
  if (now - _cbWindowStart > CB_WINDOW_MS) {
    _cbFailureCount = 0;
    _cbWindowStart = now;
  }
  _cbFailureCount += 1;
  // S5-01: If probe fails during HALF_OPEN, reopen immediately
  if (_cbState === "HALF_OPEN") {
    _cbState = "OPEN";
    _cbOpenedAt = Date.now();
    _cbProbeInFlight = false;
    logWarn("circuit_breaker_reopened", {
      event: "circuit_breaker_reopened",
      reason: "half_open_probe_failed",
      timestamp: new Date().toISOString()
    });
    recordMetric("circuit_breaker_reopened", 1, { subsystem: "redis", reason: "half_open_probe_failed" });
    return;
  }
  if (_cbState === "CLOSED" && _cbFailureCount >= CB_FAILURE_THRESHOLD) {
    _cbState = "OPEN";
    _cbOpenedAt = now;
    logWarn("circuit_breaker_opened", {
      event: "circuit_breaker_opened",
      failures: _cbFailureCount,
      window_ms: CB_WINDOW_MS,
      timestamp: new Date().toISOString()
    });
    recordMetric("circuit_breaker_opened", 1, { subsystem: "redis" });
  }
}

function _cbRecordSuccess() {
  if (_cbState === "HALF_OPEN") {
    _cbState = "CLOSED";
    _cbFailureCount = 0;
    _cbWindowStart = Date.now();
    _cbProbeInFlight = false;
    logWarn("circuit_breaker_closed", {
      event: "circuit_breaker_closed",
      timestamp: new Date().toISOString()
    });
    recordMetric("circuit_breaker_closed", 1, { subsystem: "redis" });
  }
}

function _cbCheckHalfOpen() {
  if (_cbState === "OPEN" && Date.now() - _cbOpenedAt >= CB_HALF_OPEN_DELAY_MS) {
    _cbState = "HALF_OPEN";
    _cbProbeInFlight = false;
    logWarn("circuit_breaker_half_open", {
      event: "circuit_breaker_half_open",
      timestamp: new Date().toISOString()
    });
    recordMetric("circuit_breaker_half_open", 1, { subsystem: "redis" });
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// REDIS-01: Emit a single critical warning at module load time when running in
// production without Upstash configured.
if (IS_PROD && (!UPSTASH_URL || !UPSTASH_TOKEN)) {
  logWarn("rate_limit_misconfigured", {
    event: "rate_limit_misconfigured",
    env: "production",
    message: "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN ausentes — usando MemoryStore em produção"
  });
}

function buildRateLimitMiddleware({ prefix, maxRequests, windowMs, message, skip, keyGenerator, bypassReadOnly = false, skipReadOnly }) {
  // Shared identifier computation used by BOTH MemoryStore and Upstash paths.
  // If a custom keyGenerator is provided it takes precedence; otherwise compose
  // prefix:ip:userId (userId omitted when absent).
  function getIdentifier(req) {
    if (keyGenerator) return keyGenerator(req);
    const ip = getClientIp(req);
    const uid = req.user?.id || "";
    return uid ? `${prefix}:${ip}:${uid}` : `${prefix}:${ip}`;
  }

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    // Dev/test permissive fallback — already warned above for production.
    const memLimiter = rateLimit({
      windowMs,
      limit: maxRequests,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: message },
      skip,
      keyGenerator: getIdentifier,
      handler: (req, res) => {
        logWarn("rate_limit_exceeded", {
          event: "rate_limit_exceeded",
          prefix,
          path: req.path,
          userId: req.user?.id ? req.user.id.slice(0, 8) : undefined,
          ip: getClientIp(req)
        });
        recordMetric("rate_limit_hit", 1, { prefix });
        res.status(429).json({ error: message });
      }
    });
    // C23A: wrap MemoryStore path with READ_ONLY_MODE check
    return (req, res, next) => {
      if (skip?.(req)) return memLimiter(req, res, next);
      if (!bypassReadOnly && !skipReadOnly?.(req) && READ_ONLY_MODE && !isReadMethod(req)) {
        logWarn("read_only_mode_write_blocked", { event: "read_only_mode_write_blocked", path: req.path, method: req.method });
        return res.status(503).json(READ_ONLY_RESPONSE);
      }
      return memLimiter(req, res, next);
    };
  }

  let limiter = null;
  let initPromise = null;

  async function initLimiter() {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${Math.ceil(windowMs / 1000)} s`),
      prefix: `rl:${prefix}`
    });
    logWarn("rate_limit_upstash_ready", { event: "rate_limit_upstash_ready", prefix });
  }

  return async (req, res, next) => {
    if (skip?.(req)) return next();

    // C23A: READ_ONLY_MODE env-var — same semantics as circuit OPEN
    if (!bypassReadOnly && !skipReadOnly?.(req) && READ_ONLY_MODE && !isReadMethod(req)) {
      logWarn("read_only_mode_write_blocked", { event: "read_only_mode_write_blocked", path: req.path, method: req.method });
      return res.status(503).json(READ_ONLY_RESPONSE);
    }

    // KI-05 / ITEM 5: Circuit breaker — OPEN blocks; HALF_OPEN allows only one probe at a time
    _cbCheckHalfOpen();
    if (_cbState === "OPEN") {
      if (IS_PROD) {
        logError("rate_limit_circuit_open", { event: "rate_limit_circuit_open", path: req.path, method: req.method });
        if (!bypassReadOnly && !skipReadOnly?.(req) && !isReadMethod(req)) {
          return res.status(503).json(READ_ONLY_RESPONSE);
        }
        return next();
      }
      logWarn("rate_limit_circuit_open_dev", { event: "rate_limit_circuit_open_dev", path: req.path });
      return next();
    }
    // KI-05: HALF_OPEN — only one probe request goes through to Upstash; all others fail-open
    if (_cbState === "HALF_OPEN") {
      if (_cbProbeInFlight) {
        logWarn("rate_limit_circuit_half_open_skip", { event: "rate_limit_circuit_half_open_skip", path: req.path });
        return next(); // fail-open: probe already in flight, skip rate limiting
      }
      _cbProbeInFlight = true;
    }

    if (!limiter) {
      if (!initPromise) {
        initPromise = initLimiter().catch((err) => {
          logError("rate_limit_upstash_init_failed", { event: "rate_limit_upstash_init_failed", prefix, message: err.message });
          initPromise = null;
          _cbRecordFailure();
        });
      }
      await initPromise;
    }

    // REDIS-01: fail-closed in production when Upstash is configured but unavailable.
    if (!limiter) {
      if (IS_PROD) {
        logError("rate_limit_store_unavailable", { event: "rate_limit_store_unavailable", path: req.path, ip: req.ip });
        if (!bypassReadOnly && !skipReadOnly?.(req) && !isReadMethod(req)) {
          return res.status(503).json(READ_ONLY_RESPONSE);
        }
        return next();
      }
      logWarn("rate_limit_fallback_active", { event: "rate_limit_fallback_active", prefix, path: req.path });
      return next();
    }

    try {
      const identifier = getIdentifier(req);
      const { success } = await limiter.limit(identifier);
      _cbRecordSuccess(); // successful Upstash call
      if (!success) {
        logWarn("rate_limit_exceeded", {
          event: "rate_limit_exceeded",
          prefix,
          path: req.path,
          userId: req.user?.id ? req.user.id.slice(0, 8) : undefined,
          ip: getClientIp(req)
        });
        recordMetric("rate_limit_hit", 1, { prefix });
        return res.status(429).json({ error: message });
      }
    } catch (err) {
      _cbRecordFailure();
      logError("rate_limit_upstash_error", { event: "rate_limit_upstash_error", prefix, message: err.message });
      // REDIS-01: fail-closed in production; permissive fallback in dev/test.
      if (IS_PROD) {
        logError("rate_limit_store_unavailable", { event: "rate_limit_store_unavailable", path: req.path, ip: req.ip });
        if (!bypassReadOnly && !skipReadOnly?.(req) && !isReadMethod(req)) {
          return res.status(503).json(READ_ONLY_RESPONSE);
        }
        return next();
      }
      logWarn("rate_limit_fallback_active", { event: "rate_limit_fallback_active", prefix, path: req.path });
    }
    next();
  };
}

const authRateLimit = buildRateLimitMiddleware({
  prefix: "auth",
  maxRequests: AUTH_MAX_ATTEMPTS,
  windowMs: AUTH_WINDOW_MS,
  message: "Muitas tentativas. Aguarde alguns minutos.",
  bypassReadOnly: true  // C23A: auth must work in read-only mode
});

const globalRateLimit = buildRateLimitMiddleware({
  prefix: "global",
  maxRequests: GLOBAL_RATE_LIMIT_MAX_REQUESTS,
  windowMs: GLOBAL_RATE_LIMIT_WINDOW_MS,
  message: "Muitas requisições. Tente novamente em instantes.",
  skip: (req) => req.path === "/health" || req.path === "/readyz",
  // C23A: auth paths must work in read-only mode (login, logout, refresh)
  skipReadOnly: (req) => String(req.path || "").startsWith("/auth")
});

// D-04: sensitiveDataRateLimit now uses getIdentifier from buildRateLimitMiddleware
// (prefix:ip:userId) instead of a custom keyGenerator. Unauthenticated requests fall back
// to IP only — consistent with auth and global rate limits.
const sensitiveDataRateLimit = buildRateLimitMiddleware({
  prefix: "sensitive",
  maxRequests: 30,
  windowMs: 60 * 1000,
  message: "Muitas requisições para dados sensíveis. Aguarde 1 minuto.",
  skip: (req) => req.path === "/health" || req.path === "/readyz"
});

// D-04: exportRateLimit now uses getIdentifier from buildRateLimitMiddleware
// instead of a custom keyGenerator — consistent key format across all rate limiters.
const exportRateLimit = buildRateLimitMiddleware({
  prefix: "export",
  maxRequests: 10,
  windowMs: 60 * 1000,
  message: "Limite de exportações atingido. Aguarde 1 minuto.",
  skip: (req) => req.path === "/health" || req.path === "/readyz"
});

export { buildRateLimitMiddleware, authRateLimit, globalRateLimit, sensitiveDataRateLimit, exportRateLimit, getCircuitBreakerState, isReadMethod };
