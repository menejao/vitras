const IS_PROD = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
const LOG_FORMAT = String(process.env.LOG_FORMAT || (IS_PROD ? "json" : "text")).trim().toLowerCase();
const SENSITIVE_KEY_PATTERN = /(authorization|cookie|token|secret|password|cpf|cns|set-cookie)/i;

function redactValue(key, value) {
  if (SENSITIVE_KEY_PATTERN.test(String(key || ""))) {
    return "[REDACTED]";
  }
  return value;
}

function sanitizeValue(value, key = "") {
  const direct = redactValue(key, value);
  if (direct !== value) return direct;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key));
  }

  if (value && typeof value === "object" && !(value instanceof Error)) {
    const next = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      next[childKey] = sanitizeValue(childValue, childKey);
    }
    return next;
  }

  return value;
}

function normalizeMeta(meta = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(meta || {})) {
    if (value === undefined) continue;
    if (value instanceof Error) {
      clean[key] = {
        name: value.name,
        message: value.message,
        code: value.code,
        stack: value.stack
      };
      continue;
    }
    clean[key] = sanitizeValue(value, key);
  }
  return clean;
}

function writeLog(level, event, meta = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...normalizeMeta(meta)
  };

  if (LOG_FORMAT === "json") {
    console.log(JSON.stringify(payload));
    return;
  }

  const { requestId, method, path, status, durationMs, message } = payload;
  const suffix = message ? ` ${message}` : "";
  const summary = [method, path, status, durationMs != null ? `${durationMs}ms` : null]
    .filter(Boolean)
    .join(" ");
  console.log(`[${level}] ${event}${requestId ? ` req=${requestId}` : ""}${summary ? ` ${summary}` : ""}${suffix}`);
}

const logInfo = (event, meta) => writeLog("info", event, meta);
const logWarn = (event, meta) => writeLog("warn", event, meta);
const logError = (event, meta) => writeLog("error", event, meta);

export { logInfo, logWarn, logError };
