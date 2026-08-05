import { IS_PROD } from "../config.js";
import { logError } from "../utils/logger.js";
import { recordMetric } from "../services/metrics.js";

function globalErrorHandler(err, req, res, _next) {
  if (String(err?.message || "").includes("CORS")) {
    return res.status(403).json({ error: "Origem bloqueada por política de segurança" });
  }
  const requestId = req.requestId || "-";
  const httpStatus = err?.statusCode || err?.status || 500;
  logError("http.request.failed", {
    requestId,
    correlationId: req.correlationId || requestId,
    method: req.method,
    path: req.originalUrl,
    status: httpStatus,
    userId: req.user?.id || "-",
    activeUnitId: req.user?.unitId || "-",
    role: req.user?.role || "-",
    error: IS_PROD
      ? { name: err?.name || "Error", message: err?.message || "unknown" }
      : err
  });
  recordMetric(httpStatus >= 500 ? "error.5xx" : "error.4xx", 1, {
    path: req.route?.path || req.path,
    status_code: httpStatus
  });
  return res.status(httpStatus).json({ error: httpStatus >= 500 ? "Erro interno do servidor" : (err?.message || "Erro") });
}

export { globalErrorHandler };
