import crypto from "node:crypto";
import { REQUEST_LOG_ENABLED } from "../config.js";
import { getClientIp } from "../utils/helpers.js";

// In-process counters — read via GET /metrics/internal (admin only) or inspect in logs
const _metrics = {
  requests: 0,
  errors5xx: 0,
  loginAttempts: 0,
  loginFailures: 0,
  startedAt: new Date().toISOString()
};

const LOG_FORMAT = String(process.env.LOG_FORMAT || "text").trim().toLowerCase();

function logLine(data) {
  if (LOG_FORMAT === "json") {
    console.log(JSON.stringify(data));
  } else {
    const { requestId, method, path, status, durationMs, userId, ip } = data;
    console.log(`[req:${requestId}] ${method} ${path} ${status} ${durationMs}ms user=${userId} ip=${ip}`);
  }
}

function trackLoginAttempt(success) {
  _metrics.loginAttempts++;
  if (!success) _metrics.loginFailures++;
}

function getMetrics() {
  return { ..._metrics, uptimeSeconds: Math.floor((Date.now() - new Date(_metrics.startedAt).getTime()) / 1000) };
}

function requestLoggingMiddleware(req, res, next) {
  req.requestId = crypto.randomUUID();
  req.requestStartedAt = Date.now();
  res.setHeader("X-Request-Id", req.requestId);
  _metrics.requests++;

  res.on("finish", () => {
    if (res.statusCode >= 500) _metrics.errors5xx++;

    if (!REQUEST_LOG_ENABLED) return;
    const durationMs = Date.now() - req.requestStartedAt;
    logLine({
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      userId: req.user?.id || "-",
      ip: getClientIp(req)
    });
  });

  next();
}

export { requestLoggingMiddleware, trackLoginAttempt, getMetrics };
