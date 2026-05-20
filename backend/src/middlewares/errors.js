import { IS_PROD } from "../config.js";

function globalErrorHandler(err, req, res, _next) {
  if (String(err?.message || "").includes("CORS")) {
    return res.status(403).json({ error: "Origem bloqueada por política de segurança" });
  }
  const requestId = req.requestId || "-";
  if (IS_PROD) {
    console.error(`[error:${requestId}] ${err?.name || "Error"}: ${err?.message || "unknown"}`);
  } else {
    console.error(`[error:${requestId}]`, err);
  }
  return res.status(500).json({ error: "Erro interno do servidor" });
}

export { globalErrorHandler };
