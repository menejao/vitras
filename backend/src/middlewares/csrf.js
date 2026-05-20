import { COOKIE_CSRF_NAME } from "../config.js";
import { parseCookies } from "../utils/session-cookies.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function requireCsrfForCookieAuth(req, res, next) {
  if (SAFE_METHODS.has(String(req.method || "").toUpperCase())) return next();
  if (req.authTransport !== "cookie") return next();

  const cookies = parseCookies(req);
  const cookieToken = String(cookies[COOKIE_CSRF_NAME] || "").trim();
  const headerToken = String(req.headers["x-csrf-token"] || "").trim();
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "Falha de validação CSRF" });
  }
  return next();
}

export { requireCsrfForCookieAuth };
