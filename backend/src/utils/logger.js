const LOG_FORMAT = String(process.env.LOG_FORMAT || "text").trim().toLowerCase();

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
    clean[key] = value;
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
