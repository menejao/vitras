/**
 * Lightweight structured metrics emitter.
 * Does NOT depend on external libraries (no Prometheus, no StatsD).
 * Emits structured log events queryable in CloudWatch Insights.
 */
import { logInfo } from "../utils/logger.js";

/**
 * Emit a structured metrics event.
 * @param {string} name - Metric name (e.g. "request_completed", "deadlock_retry")
 * @param {number} value - Metric value
 * @param {object} tags - Optional tags/dimensions (no PII)
 */
function recordMetric(name, value, tags = {}) {
  logInfo("metric", {
    event: "metric",
    metric: name,
    value,
    ...tags,
    timestamp: new Date().toISOString()
  });
}

export { recordMetric };
