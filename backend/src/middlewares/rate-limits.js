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

// REDIS-01: Emit a single critical warning at module load time when running in
// production without Upstash configured.
if (IS_PROD && (!UPSTASH_URL || !UPSTASH_TOKEN)) {
  logWarn("rate_limit_misconfigured", {
    event: "rate_limit_misconfigured",
    env: "production",
    message: "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN ausentes — usando MemoryStore em produção"
  });
}

function buildRateLimitMiddleware({ prefix, maxRequests, windowMs, message, skip }) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    // Dev/test permissive fallback — already warned above for production.
    return rateLimit({
      windowMs,
      limit: maxRequests,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: message },
      skip,
      keyGenerator: (req) => getClientIp(req)
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
    if (!limiter) {
      if (!initPromise) {
        initPromise = initLimiter().catch((err) => {
          logError("rate_limit_upstash_init_failed", { event: "rate_limit_upstash_init_failed", prefix, message: err.message });
          initPromise = null;
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
      const { success } = await limiter.limit(getClientIp(req));
      if (!success) return res.status(429).json({ error: message });
    } catch (err) {
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

export { buildRateLimitMiddleware, authRateLimit, globalRateLimit };
