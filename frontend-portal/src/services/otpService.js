/**
 * otpService.js — Facade de OTP para o frontend
 *
 * Encapsula o estado da sessão OTP e orquestra o fluxo completo.
 * A UI usa este service em vez de chamar contactVerificationService diretamente.
 *
 * Fluxo:
 *   iniciar(tipo, valor) → requestCode → { otpId, expiraEm, mensagem }
 *   confirmar(code)      → confirmCode → { verifyToken }
 *   aplicar()            → updateContact(verifyToken) → { ok }
 *
 * Estado mantido em memória por sessão — não persiste no sessionStorage
 * (código OTP não deve sobreviver ao refresh por segurança).
 */

import {
  requestCode,
  confirmCode,
  updateContact,
} from "./contactVerificationService.js";

let _session = null; // { otpId, tipo, valor, verifyToken, expiraEm }

/** Inicia nova sessão OTP */
export async function iniciar(tipo, valor) {
  const result = await requestCode(tipo, valor);
  _session = { otpId: result.otpId, tipo, valor, verifyToken: null, expiraEm: result.expiraEm };
  return result;
}

/** Confirma código OTP digitado */
export async function confirmar(code) {
  if (!_session?.otpId) throw new Error("Sessão OTP não iniciada");
  const result = await confirmCode(_session.otpId, String(code).trim());
  _session.verifyToken = result.verifyToken;
  return result;
}

/** Aplica a alteração de contato (após OTP confirmado) */
export async function aplicar() {
  if (!_session?.verifyToken) throw new Error("OTP não confirmado");
  const result = await updateContact(_session.verifyToken);
  _session = null;
  return result;
}

/** Reinicia sessão (para reenvio) */
export async function reenviar() {
  if (!_session?.tipo || !_session?.valor) throw new Error("Sessão OTP não iniciada");
  return iniciar(_session.tipo, _session.valor);
}

/** Limpa sessão OTP atual */
export function limpar() { _session = null; }

/** Retorna dados da sessão atual (sem verifyToken) */
export function getSessao() {
  if (!_session) return null;
  return { tipo: _session.tipo, valor: _session.valor, expiraEm: _session.expiraEm };
}
