/**
 * citizenIdentityService.js — Validação e formatação de documentos do cidadão
 * Lógica client-side para CPF e campos de identidade.
 */

/** Valida CPF com algoritmo de dígitos verificadores */
export function isValidCpf(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = 11 - (sum % 11); if (r >= 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = 11 - (sum % 11); if (r >= 10) r = 0;
  return r === parseInt(d[10]);
}

/** Formata CPF para exibição: 000.000.000-00 */
export function formatCpf(raw) {
  const d = String(raw || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Retorna apenas dígitos do CPF */
export function rawCpf(formatted) {
  return String(formatted || "").replace(/\D/g, "");
}

/** Formata data para exibição DD/MM/AAAA enquanto usuário digita */
export function formatDateInput(raw) {
  const d = String(raw || "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Converte DD/MM/AAAA para YYYY-MM-DD (para envio ao backend) */
export function dateToIso(ddmmyyyy) {
  const m = String(ddmmyyyy || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return ddmmyyyy;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Valida senha mínima */
export function isStrongPassword(senha) {
  return String(senha || "").length >= 8;
}
