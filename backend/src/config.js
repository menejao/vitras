const IS_PROD = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
const PORT = process.env.PORT || 3001;
const JWT_SECRET = String(process.env.JWT_SECRET || "").trim() || "dev-only-jwt-secret-change-me";
const JWT_EXPIRES_IN = String(process.env.JWT_EXPIRES_IN || "12h").trim() || "12h";
const JWT_ISSUER = String(process.env.JWT_ISSUER || "vitras-backend").trim() || "vitras-backend";
const JWT_AUDIENCE = String(process.env.JWT_AUDIENCE || "vitras-client").trim() || "vitras-client";
const FRONTEND_ORIGINS = String(process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const CORS_ALLOW_ALL = String(process.env.CORS_ALLOW_ALL || "").trim().toLowerCase() === "true";
const AUTH_WINDOW_MS = Number(process.env.AUTH_WINDOW_MS || process.env.AUTH_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const AUTH_MAX_ATTEMPTS = Number(process.env.AUTH_MAX_ATTEMPTS || process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS || 20);
const GLOBAL_RATE_LIMIT_WINDOW_MS = Number(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const GLOBAL_RATE_LIMIT_MAX_REQUESTS = Number(
  process.env.GLOBAL_RATE_LIMIT_MAX || process.env.GLOBAL_RATE_LIMIT_MAX_REQUESTS || 600
);
const UPSTASH_URL = String(process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
const USER_ONLINE_THRESHOLD_MS = Number(process.env.USER_ONLINE_THRESHOLD_MS || 2 * 60 * 1000);
const REQUEST_LOG_ENABLED =
  String(process.env.REQUEST_LOG_ENABLED || "true").trim().toLowerCase() !== "false";
const TWOFA_ISSUER = String(process.env.TWOFA_ISSUER || "Vitras").trim() || "Vitras";
const TWOFA_CHALLENGE_TTL_MS = Number(process.env.TWOFA_CHALLENGE_TTL_MS || 5 * 60 * 1000);
const TWOFA_MAX_ATTEMPTS = Number(process.env.TWOFA_MAX_ATTEMPTS || 5);
const BACKUP_EXPORT_KEY = String(process.env.BACKUP_EXPORT_KEY || "").trim();
const ADMIN_SEED_KEY = String(process.env.ADMIN_SEED_KEY || "").trim();
const ENABLE_BACKUP_EXPORT = String(process.env.ENABLE_BACKUP_EXPORT || "true").trim().toLowerCase() !== "false";
const ENABLE_ADMIN_SEED = String(process.env.ENABLE_ADMIN_SEED || (IS_PROD ? "false" : "true")).trim().toLowerCase() === "true";
const ACCESS_EXPIRES_IN = String(process.env.ACCESS_TOKEN_EXPIRES_IN || JWT_EXPIRES_IN).trim();
const REFRESH_EXPIRES_IN = String(process.env.REFRESH_TOKEN_EXPIRES_IN || "7d").trim();
const BREAK_GLASS_TTL_MS = Number(process.env.BREAK_GLASS_TTL_MS || 15 * 60 * 1000);
const AUDIT_LOG_DEFAULT_LIMIT = Number(process.env.AUDIT_LOG_DEFAULT_LIMIT || 100);
const AUDIT_LOG_MAX_LIMIT = Number(process.env.AUDIT_LOG_MAX_LIMIT || 500);
const AUDIT_LOG_RETENTION_DAYS = Number(process.env.AUDIT_LOG_RETENTION_DAYS || 365 * 2);
const COOKIE_ACCESS_NAME = String(process.env.COOKIE_ACCESS_NAME || "vitras_access").trim() || "vitras_access";
const COOKIE_REFRESH_NAME = String(process.env.COOKIE_REFRESH_NAME || "vitras_refresh").trim() || "vitras_refresh";
const COOKIE_CSRF_NAME = String(process.env.COOKIE_CSRF_NAME || "vitras_csrf").trim() || "vitras_csrf";
const COOKIE_DOMAIN = String(process.env.COOKIE_DOMAIN || "").trim();
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || (IS_PROD ? "true" : "false")).trim().toLowerCase() === "true";
const COOKIE_SAME_SITE_RAW = String(process.env.COOKIE_SAME_SITE || "lax").trim().toLowerCase();
const COOKIE_SAME_SITE = COOKIE_SAME_SITE_RAW === "strict"
  ? "strict"
  : (COOKIE_SAME_SITE_RAW === "none" ? "none" : "lax");
const PUBLIC_SELF_REGISTER_ROLES = String(
  process.env.PUBLIC_SELF_REGISTER_ROLES || (IS_PROD ? "receptionist" : "receptionist,gestor,nurse_manager,doctor")
)
  .split(",")
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);
const REFRESH_EXPIRES_MS = (() => {
  const s = REFRESH_EXPIRES_IN;
  const n = parseInt(s, 10);
  if (s.endsWith("d")) return n * 86400_000;
  if (s.endsWith("h")) return n * 3600_000;
  if (s.endsWith("m")) return n * 60_000;
  if (s.endsWith("s")) return n * 1000;
  return n || 7 * 86400_000;
})();

if (IS_PROD && (!process.env.JWT_SECRET || JWT_SECRET === "dev-only-jwt-secret-change-me")) {
  throw new Error("JWT_SECRET obrigatório em produção");
}
if (IS_PROD && !FRONTEND_ORIGINS.length && !CORS_ALLOW_ALL) {
  throw new Error(
    "FRONTEND_ORIGINS obrigatório em produção (ou defina CORS_ALLOW_ALL=true por sua conta e risco)"
  );
}
if (IS_PROD && !process.env.DATA_ENCRYPTION_KEY) {
  throw new Error(
    "DATA_ENCRYPTION_KEY obrigatório em produção — dados sensíveis (CPF, CNS) não podem ser armazenados sem criptografia"
  );
}
if (IS_PROD && COOKIE_SAME_SITE === "none" && !COOKIE_SECURE) {
  throw new Error("COOKIE_SECURE=true obrigatório em produção quando COOKIE_SAME_SITE=none");
}
if (IS_PROD && !BACKUP_EXPORT_KEY) {
  throw new Error("BACKUP_EXPORT_KEY obrigatorio em producao");
}
if (IS_PROD && !ADMIN_SEED_KEY) {
  throw new Error("ADMIN_SEED_KEY obrigatorio em producao");
}
if (IS_PROD && (!process.env.JWT_EXPIRES_IN || JWT_EXPIRES_IN === "12h")) {
  console.warn("[aviso] JWT_EXPIRES_IN não definido — usando padrão de 12h");
}

export {
  IS_PROD,
  PORT,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_ISSUER,
  JWT_AUDIENCE,
  FRONTEND_ORIGINS,
  CORS_ALLOW_ALL,
  AUTH_WINDOW_MS,
  AUTH_MAX_ATTEMPTS,
  GLOBAL_RATE_LIMIT_WINDOW_MS,
  GLOBAL_RATE_LIMIT_MAX_REQUESTS,
  UPSTASH_URL,
  UPSTASH_TOKEN,
  USER_ONLINE_THRESHOLD_MS,
  REQUEST_LOG_ENABLED,
  TWOFA_ISSUER,
  TWOFA_CHALLENGE_TTL_MS,
  TWOFA_MAX_ATTEMPTS,
  BACKUP_EXPORT_KEY,
  ADMIN_SEED_KEY,
  ENABLE_BACKUP_EXPORT,
  ENABLE_ADMIN_SEED,
  ACCESS_EXPIRES_IN,
  REFRESH_EXPIRES_IN,
  BREAK_GLASS_TTL_MS,
  AUDIT_LOG_DEFAULT_LIMIT,
  AUDIT_LOG_MAX_LIMIT,
  AUDIT_LOG_RETENTION_DAYS,
  REFRESH_EXPIRES_MS,
  COOKIE_ACCESS_NAME,
  COOKIE_REFRESH_NAME,
  COOKIE_CSRF_NAME,
  COOKIE_DOMAIN,
  COOKIE_SECURE,
  COOKIE_SAME_SITE,
  PUBLIC_SELF_REGISTER_ROLES
};
