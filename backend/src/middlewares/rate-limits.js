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

function buildRateLimitMiddleware({ prefix, maxRequests, windowMs, message, skip }) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    if (IS_PROD) {
      console.warn(
        `[aviso] rate-limit "${prefix}" usando MemoryStore em produção — configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN para persistência entre restarts`
      );
    }
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
    console.log(`[rate-limit] "${prefix}" usando Upstash Redis`);
  }

  return async (req, res, next) => {
    if (skip?.(req)) return next();
    if (!limiter) {
      if (!initPromise) {
        initPromise = initLimiter().catch((err) => {
          console.error(`[rate-limit] Upstash init falhou (${prefix}):`, err.message);
          initPromise = null;
        });
      }
      await initPromise;
    }
    if (!limiter) return next();
    try {
      const { success } = await limiter.limit(getClientIp(req));
      if (!success) return res.status(429).json({ error: message });
    } catch (err) {
      console.error(`[rate-limit] Upstash erro (${prefix}):`, err.message);
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
