/**
 * Express middleware: emits request_completed metric for each response.
 * Excludes /health and /readyz (too noisy).
 * Uses route pattern (req.route?.path) not full URL to avoid cardinality explosion.
 */
import { recordMetric } from "../services/metrics.js";

const EXCLUDED_PATHS = new Set(["/health", "/readyz"]);

function requestMetricsMiddleware(req, res, next) {
  const startMs = Date.now();

  res.on("finish", () => {
    const routePath = req.route?.path || req.path;

    // Exclude health/readyz polling
    if (EXCLUDED_PATHS.has(routePath) || EXCLUDED_PATHS.has(req.path)) {
      return;
    }

    const durationMs = Date.now() - startMs;
    recordMetric("request_completed", durationMs, {
      method: req.method,
      path: routePath,
      status_code: res.statusCode,
      duration_ms: durationMs
    });
  });

  next();
}

export { requestMetricsMiddleware };
