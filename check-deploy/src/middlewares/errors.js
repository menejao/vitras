import { IS_PROD } from "../config.js";
import { logError } from "../utils/logger.js";

function globalErrorHandler(err, req, res, _next) {
  if (String(err?.message || "").includes("CORS")) {
    return res.status(403).json({ error: "Origem bloqueada por política de segurança" });
  }
  const requestId = req.requestId || "-";
  logError("http.request.failed", {
    requestId,
    correlationId: req.correlationId || requestId,
    method: req.method,
    path: req.originalUrl,
    status: err?.statusCode || 500,
    userId: req.user?.id || "-",
    error: IS_PROD
      ? { name: err?.name || "Error", message: err?.message || "unknown" }
      : err
  });
  return res.status(500).json({ error: "Erro interno do servidor" });
}

export { globalErrorHandler };
