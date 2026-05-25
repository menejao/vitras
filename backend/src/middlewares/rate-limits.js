import { rateLimit } from "express-rate-limit";
import {
  IS_PROD,
  UPSTASH_URL,
  UPSTASH_TOKEN,
  AUTH_WINDOW_MS,
  AUTH_MAX_ATTEMPTS,
  GLOBAL_RATE_LIMIT_WINDOW_MS,
  GLOBAL_RATE_LIMIT_MAX_REQUESTS
} from "../config.js";
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

function buildRateLimitMiddleware({ prefix, maxRequests, windowMs, message, skip, keyGenerator }) {
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
    return rateLimit({
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

    // ITEM 5: Circuit breaker — if OPEN, fail-closed immediately without calling Upstash
    _cbCheckHalfOpen();
    if (_cbState === "OPEN") {
      if (IS_PROD) {
        logError("rate_limit_circuit_open", { event: "rate_limit_circuit_open", path: req.path });
        return res.status(503).json({ error: "Serviço temporariamente indisponível" });
      }
      logWarn("rate_limit_circuit_open_dev", { event: "rate_limit_circuit_open_dev", path: req.path });
      return next();
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
        return res.status(503).json({ error: "Serviço temporariamente indisponível" });
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
        return res.status(503).json({ error: "Serviço temporariamente indisponível" });
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
  message: "Muitas tentativas. Aguarde alguns minutos."
});

const globalRateLimit = buildRateLimitMiddleware({
  prefix: "global",
  maxRequests: GLOBAL_RATE_LIMIT_MAX_REQUESTS,
  windowMs: GLOBAL_RATE_LIMIT_WINDOW_MS,
  message: "Muitas requisições. Tente novamente em instantes.",
  skip: (req) => req.path === "/health"
});

// D-04: sensitiveDataRateLimit now uses getIdentifier from buildRateLimitMiddleware
// (prefix:ip:userId) instead of a custom keyGenerator. Unauthenticated requests fall back
// to IP only — consistent with auth and global rate limits.
const sensitiveDataRateLimit = buildRateLimitMiddleware({
  prefix: "sensitive",
  maxRequests: 30,
  windowMs: 60 * 1000,
  message: "Muitas requisições para dados sensíveis. Aguarde 1 minuto.",
  skip: (req) => req.path === "/health"
});

// D-04: exportRateLimit now uses getIdentifier from buildRateLimitMiddleware
// instead of a custom keyGenerator — consistent key format across all rate limiters.
const exportRateLimit = buildRateLimitMiddleware({
  prefix: "export",
  maxRequests: 10,
  windowMs: 60 * 1000,
  message: "Limite de exportações atingido. Aguarde 1 minuto.",
  skip: (req) => req.path === "/health"
});

export { buildRateLimitMiddleware, authRateLimit, globalRateLimit, sensitiveDataRateLimit, exportRateLimit, getCircuitBreakerState };
