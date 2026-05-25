const IS_PROD = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
const LOG_FORMAT = String(process.env.LOG_FORMAT || (IS_PROD ? "json" : "text")).trim().toLowerCase();
const SENSITIVE_KEY_PATTERN = /(authorization|cookie|token|secret|password|cpf|cns|set-cookie)/i;

// ITEM 5: Log storm protection — deduplication for INFO level only
// If same event+message logged >10 times in 1 second, suppress and emit one log_storm_suppressed
const LOG_STORM_THRESHOLD = 10;
const LOG_STORM_WINDOW_MS = 1000;
const _stormMap = new Map(); // key: "event:message" → { count, windowStart }

let _stormResetTimer = null;

function _checkLogStorm(level, event, message) {
  // Only deduplicate INFO — errors always pass through
  if (level !== "info") return false;

  const now = Date.now();
  const key = `${event}:${String(message || "")}`;

  let entry = _stormMap.get(key);
  if (!entry || now - entry.windowStart > LOG_STORM_WINDOW_MS) {
    _stormMap.set(key, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  if (entry.count > LOG_STORM_THRESHOLD) {
    // Emit storm suppression event once per window (when threshold first exceeded)
    if (entry.count === LOG_STORM_THRESHOLD + 1) {
      const payload = {
        timestamp: new Date().toISOString(),
        level: "warn",
        event: "log_storm_suppressed",
        suppressed_event: event,
        count: entry.count,
        window_ms: LOG_STORM_WINDOW_MS
      };
      if (LOG_FORMAT === "json") {
        console.log(JSON.stringify(payload));
      } else {
        console.log(`[warn] log_storm_suppressed event=${event} count=${entry.count}`);
      }
    }
    return true; // suppress this log
  }

  return false;
}

// Reset storm map every second
if (!_stormResetTimer) {
  _stormResetTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of _stormMap.entries()) {
      if (now - entry.windowStart > LOG_STORM_WINDOW_MS) {
        _stormMap.delete(key);
      }
    }
  }, LOG_STORM_WINDOW_MS);
  // Allow process to exit without waiting for this timer
  if (_stormResetTimer.unref) _stormResetTimer.unref();
}

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
  // ITEM 5: Log storm protection (INFO only)
  const metaMessage = meta?.message || meta?.msg || "";
  if (_checkLogStorm(level, event, metaMessage)) return;

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
