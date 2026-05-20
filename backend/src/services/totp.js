import { generateSecret as otpGenerateSecret, verifySync as otpVerifySync } from "otplib";
import { TWOFA_ISSUER } from "../config.js";

function normalizeTotpSecret(secret) {
  return String(secret || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
}

function generateTotpSecret() {
  return otpGenerateSecret();
}

function verifyTotpCode(secret, code) {
  const normalizedSecret = normalizeTotpSecret(secret);
  const normalizedCode = String(code || "").replace(/\D+/g, "");
  if (normalizedSecret.length < 16 || normalizedCode.length !== 6) return false;
  try {
    const result = otpVerifySync({ type: "totp", token: normalizedCode, secret: normalizedSecret, options: { window: 1 } });
    return result?.valid === true;
  } catch {
    return false;
  }
}

function buildOtpAuthUrl(user, secret) {
  const label = encodeURIComponent(`${TWOFA_ISSUER}:${String(user.email || user.name || "usuario")}`);
  const issuer = encodeURIComponent(TWOFA_ISSUER);
  const sec = encodeURIComponent(normalizeTotpSecret(secret));
  return `otpauth://totp/${label}?secret=${sec}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export { normalizeTotpSecret, generateTotpSecret, verifyTotpCode, buildOtpAuthUrl };
