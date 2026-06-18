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

export { hashPassword, isHashedPassword, verifyPassword, hashToken };
