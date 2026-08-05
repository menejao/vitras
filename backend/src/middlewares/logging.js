import crypto from "node:crypto";
import { REQUEST_LOG_ENABLED, APP_VERSION } from "../config.js";
import { getClientIp } from "../utils/helpers.js";
import { logInfo } from "../utils/logger.js";

// In-process counters — read via GET /metrics/internal (admin only) or inspect in logs
const _metrics = {
  requests: 0,
  errors5xx: 0,
  loginAttempts: 0,
  loginFailures: 0,
  startedAt: new Date().toISOString()
};

function trackLoginAttempt(success) {
  _metrics.loginAttempts++;
  if (!success) _metrics.loginFailures++;
}

function getMetrics() {
  return { ..._metrics, uptimeSeconds: Math.floor((Date.now() - new Date(_metrics.startedAt).getTime()) / 1000) };
}

function requestLoggingMiddleware(req, res, next) {
  req.requestId = String(
    req.headers["x-request-id"] ||
    req.headers["x-correlation-id"] ||
    crypto.randomUUID()
  ).slice(0, 128);
  req.correlationId = String(
    req.headers["x-correlation-id"] ||
    req.headers["x-request-id"] ||
    req.requestId
  ).slice(0, 128);
  req.requestStartedAt = Date.now();
  res.setHeader("X-Request-Id", req.requestId);
  res.setHeader("X-Correlation-Id", req.correlationId);
  _metrics.requests++;

  res.on("finish", () => {
    if (res.statusCode >= 500) _metrics.errors5xx++;

    if (!REQUEST_LOG_ENABLED) return;
    const durationMs = Date.now() - req.requestStartedAt;
    logInfo("http.request.completed", {
      requestId: req.requestId,
      correlationId: req.correlationId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      userId: req.user?.id || "-",
      role: req.user?.role || "-",
      activeUnitId: req.user?.unitId || "-",
      userAgent: String(req.headers["user-agent"] || "").slice(0, 200),
      appVersion: APP_VERSION,
      ip: getClientIp(req)
    });
  });

  next();
}

export { requestLoggingMiddleware, trackLoginAttempt, getMetrics };
