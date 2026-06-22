import crypto from "node:crypto";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return `s1$${salt}$${key}`;
}

function isHashedPassword(value) {
  return /^s1\$[a-f0-9]{32}\$[a-f0-9]{128}$/i.test(String(value || ""));
}

function verifyPassword(password, stored) {
  const candidate = String(password || "");
  const value = String(stored || "");
  if (!value) return false;
  if (!isHashedPassword(value)) return candidate === value;
  const [, salt, key] = value.split("$");
  const derived = crypto.scryptSync(candidate, salt, 64).toString("hex");
  const left = Buffer.from(derived, "hex");
  const right = Buffer.from(key, "hex");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function hashToken(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

function generateTempPassword() {
  // 14+ chars, mixed: upper + lower + digits + symbols, crypto-secure
  const upper  = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower  = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const syms   = "!@#$%^&*";
  const all    = upper + lower + digits + syms;
  const bytes  = crypto.randomBytes(18);
  let password = [
    upper[bytes[0]  % upper.length],
    upper[bytes[1]  % upper.length],
    lower[bytes[2]  % lower.length],
    lower[bytes[3]  % lower.length],
    digits[bytes[4] % digits.length],
    digits[bytes[5] % digits.length],
    syms[bytes[6]   % syms.length],
    syms[bytes[7]   % syms.length],
  ];
  // fill up to 14 chars from full alphabet
  for (let i = 8; i < 14; i++) {
    password.push(all[bytes[i] % all.length]);
  }
  // Fisher-Yates shuffle using remaining bytes
  for (let i = password.length - 1; i > 0; i--) {
    const j = bytes[14 + (i % 4)] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }
  return password.join("");
}

export { hashPassword, isHashedPassword, verifyPassword, hashToken, generateTempPassword };
