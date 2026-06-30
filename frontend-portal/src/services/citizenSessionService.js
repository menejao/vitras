/**
 * citizenSessionService.js — Gerenciamento de sessão do cidadão no Portal
 * Persiste dados mínimos em sessionStorage (limpo ao fechar aba).
 */

const SESSION_KEY = "portal_cidadao";

/** Salva sessão do cidadão */
export function saveSession(data) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch { /* storage full — ignore */ }
}

/** Lê sessão atual */
export function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

/** Remove sessão (logout) */
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

/** Retorna token da sessão atual, ou null */
export function getToken() {
  const s = loadSession();
  return s?.token || null;
}
