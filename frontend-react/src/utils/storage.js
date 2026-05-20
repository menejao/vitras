import { SESSION_KEY, UI_STATE_KEY } from "../config/constants";

export function readLS(key, def) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : def; } catch { return def; }
}

export function writeLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export function readSession() {
  try {
    const r = sessionStorage.getItem(SESSION_KEY);
    const p = r ? JSON.parse(r) : null;
    if (p && p.mode === "cookie" && p.user) return p;
    if (p && typeof p.token === "string" && p.user) return p;
    return null;
  } catch { return null; }
}

export function readUiState() {
  try { const r = localStorage.getItem(UI_STATE_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
