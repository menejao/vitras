import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE, COOKIE_ACCESS_NAME } from "../config.js";
import { canonicalRole, hasRole, hasCapability, hasAnyCapability, getClientIp } from "../utils/helpers.js";
import { parseCookies } from "../utils/session-cookies.js";
import { logWarn } from "../utils/logger.js";

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = parseCookies(req)[COOKIE_ACCESS_NAME] || null;
  const token = bearerToken || cookieToken;

  if (!token) {
    logWarn("security.auth.token_missing", {
      requestId: req.requestId || "-",
      method: req.method,
      path: req.originalUrl,
      ip: getClientIp(req)
    });
    return res.status(401).json({ error: "Token ausente" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
    req.user = {
      ...payload,
      role: canonicalRole(payload.role),
      requestId: req.requestId || "",
      authTransport: bearerToken ? "bearer" : "cookie",
      requestMeta: {
        requestId: req.requestId || "",
        ip: getClientIp(req),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 512),
        method: String(req.method || ""),
        path: String(req.originalUrl || ""),
        authTransport: bearerToken ? "bearer" : "cookie"
      }
    };
    req.authTransport = bearerToken ? "bearer" : "cookie";
    return next();
  } catch (err) {
    logWarn("security.auth.token_invalid", {
      requestId: req.requestId || "-",
      method: req.method,
      path: req.originalUrl,
      ip: getClientIp(req),
      reason: err?.name || "unknown"
    });
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

function requireManager(req, res, next) {
  if (!hasRole(req.user, ["nurse_manager"]) && !hasCapability(req.user, "team.manage")) {
    return res.status(403).json({ error: "Somente enfermeira pode executar esta ação" });
  }
  return next();
}

function requireManagerOrDoctor(req, res, next) {
  if (!hasRole(req.user, ["nurse_manager", "doctor", "break_glass_admin"])) {
    return res.status(403).json({ error: "Apenas enfermeira ou médica podem executar esta ação" });
  }
  return next();
}

function requireRoles(allowedRoles = [], errorMessage = "Sem permissão para esta ação") {
  return (req, res, next) => {
    if (!hasRole(req.user, allowedRoles)) {
      return res.status(403).json({ error: errorMessage });
    }
    return next();
  };
}

function requireCapabilities(capabilities = [], errorMessage = "Sem permissão para esta ação") {
  return (req, res, next) => {
    if (!hasAnyCapability(req.user, capabilities)) {
      return res.status(403).json({ error: errorMessage });
    }
    return next();
  };
}

function requireSupportAdmin(req, res, next) {
  if (canonicalRole(req.user?.role) !== "support_admin") {
    return res.status(403).json({ error: "Acesso restrito ao Console Nacional" });
  }
  return next();
}

// IAM-01: block support_admin from any non-platform route (defense-in-depth).
// support_admin capabilities already deny clinical access, but this provides an
// explicit 403 so the error is unambiguous.
function blockSupportAdminFromClinical(req, res, next) {
  if (canonicalRole(req.user?.role) !== "support_admin") return next();
  const allowedPrefixes = ["/platform", "/auth/", "/health", "/readyz", "/api-docs", "/me"];
  const path = req.path || req.originalUrl || "";
  if (allowedPrefixes.some((prefix) => path.startsWith(prefix))) return next();
  logWarn("security.authz.support_admin_clinical_blocked", {
    requestId: req.requestId || "-",
    userId: req.user?.id || "-",
    method: req.method,
    path: req.originalUrl,
    ip: getClientIp(req)
  });
  return res.status(403).json({
    error: "Conta de suporte nacional não tem acesso a dados clínicos ou operacionais da UBS"
  });
}

export { requireAuth, requireManager, requireManagerOrDoctor, requireRoles, requireCapabilities, requireSupportAdmin, blockSupportAdminFromClinical };
