/**
 * otpProvider.js — Provedor de envio de OTP (desacoplado)
 *
 * Este módulo isola o mecanismo de envio do código de verificação.
 * Em desenvolvimento: loga o código e o retorna para facilitar testes.
 * Em produção: substituir pelos providers reais (SMS gateway, e-mail transacional).
 *
 * NUNCA armazenar o código plaintext — apenas o hash no DB.
 * NUNCA logar o código em produção.
 */

const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * Envia OTP por telefone (SMS / WhatsApp).
 * @returns {{ sent: boolean, devCode?: string }} devCode apenas em dev
 */
export async function sendPhoneOtp(phone, code) {
  if (IS_DEV) {
    console.log(`[OTP-DEV] Telefone ${phone} → código ${code}`);
    return { sent: true, devCode: code };
  }
  // Em produção: integrar com Twilio, AWS SNS, Infobip etc.
  // throw new Error("SMS provider não configurado");
  console.warn("[OTP] SMS provider não configurado — OTP não enviado");
  return { sent: false };
}

/**
 * Envia OTP por e-mail.
 * @returns {{ sent: boolean, devCode?: string }} devCode apenas em dev
 */
export async function sendEmailOtp(email, code) {
  if (IS_DEV) {
    console.log(`[OTP-DEV] E-mail ${email} → código ${code}`);
    return { sent: true, devCode: code };
  }
  // Em produção: integrar com AWS SES, SendGrid, Postmark etc.
  console.warn("[OTP] E-mail provider não configurado — OTP não enviado");
  return { sent: false };
}
