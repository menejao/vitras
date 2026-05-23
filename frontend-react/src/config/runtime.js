// Copyright (c) 2026 Vitras. Todos os direitos reservados.
function parseBooleanEnv(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

export const SESSION_IDLE_TIMEOUT_ENABLED = parseBooleanEnv(
  import.meta.env.VITE_SESSION_IDLE_TIMEOUT_ENABLED,
  true,
);
