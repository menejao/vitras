/**
 * contactVerificationService.js — Verificação de contato via OTP
 *
 * Gerencia o fluxo de alteração de telefone/e-mail com confirmação por código OTP:
 *   1. requestCode(tipo, valor) → solicita OTP
 *   2. confirmCode(otpId, code) → verifica OTP, obtém verifyToken
 *   3. updateContact(verifyToken) → aplica alteração
 *
 * A UI nunca acessa APIs diretamente — usa este service.
 * Provider de OTP é isolado no backend (otpProvider.js).
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function getToken() {
  try { return JSON.parse(sessionStorage.getItem("portal_cidadao") || "null")?.token || null; }
  catch { return null; }
}

async function apiCall(method, path, body) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

/**
 * Solicita envio de OTP para novo telefone ou e-mail.
 * @param {"telefone"|"email"} tipo
 * @param {string} valor — novo telefone ou e-mail
 * @returns {{ otpId, expiraEm, mensagem, _devCode? }}
 */
export async function requestCode(tipo, valor) {
  return apiCall("POST", "/citizen-portal/profile/contact/request-code", { tipo, valor });
}

/**
 * Confirma OTP digitado pelo cidadão.
 * @returns {{ verifyToken, tipo, alvo }}
 */
export async function confirmCode(otpId, code) {
  return apiCall("POST", "/citizen-portal/profile/contact/confirm-code", { otpId, code });
}

/**
 * Aplica alteração de contato após OTP confirmado.
 * @param {string} verifyToken — bridge token retornado por confirmCode
 */
export async function updateContact(verifyToken) {
  return apiCall("PUT", "/citizen-portal/profile/contact", { verifyToken });
}

/** Formata telefone live: (11) 99999-9999 */
export function formatarTelefone(raw) {
  const d = String(raw || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2)  return d.length ? `(${d}` : "";
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

/** Valida e-mail básico */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

/** Valida telefone (mínimo 10 dígitos) */
export function isValidPhone(phone) {
  return String(phone || "").replace(/\D/g, "").length >= 10;
}
