import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE, ACCESS_EXPIRES_IN, REFRESH_EXPIRES_MS } from "../config.js";
import { hashToken } from "./crypto.js";
import { buildAccessContextUser, ensureArray } from "../utils/domain.js";

function createToken(user, db, options = {}) {
  const sessionUser = buildAccessContextUser(user, db, options);
  return jwt.sign(
    {
      jti: uuidv4(),
      sessionId: String(options.sessionId || ""),
      id: sessionUser.id,
      name: sessionUser.name,
      role: sessionUser.role,
      email: sessionUser.email,
      teamId: sessionUser.teamId,
      teamName: sessionUser.teamName,
      capabilities: sessionUser.capabilities,
      impersonation: sessionUser.impersonation,
      breakGlass: sessionUser.breakGlass
    },
    JWT_SECRET,
    {
      expiresIn: ACCESS_EXPIRES_IN,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: "HS256"
    }
  );
}

function createRefreshToken(userId, ip, db, sessionContext = {}) {
  ensureArray(db, "refreshTokens");
  const raw = crypto.randomBytes(40).toString("hex");
  const record = {
    id: uuidv4(),
    userId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS).toISOString(),
    createdAt: new Date().toISOString(),
    revokedAt: null,
    ip: String(ip || ""),
    sessionContext: {
      scopeTeamId: String(sessionContext.scopeTeamId || ""),
      impersonation: sessionContext.impersonation ? { ...sessionContext.impersonation } : null,
      breakGlass: sessionContext.breakGlass ? { ...sessionContext.breakGlass } : null
    }
  };
  db.refreshTokens.push(record);
  if (db.refreshTokens.length > 500) {
    const now = Date.now();
    db.refreshTokens = db.refreshTokens
      .filter((t) => !t.revokedAt && new Date(t.expiresAt).getTime() > now)
      .slice(-400);
    if (!db.refreshTokens.find((t) => t.id === record.id)) {
      db.refreshTokens.push(record);
    }
  }
  return { raw, sessionId: record.id };
}

export { createToken, createRefreshToken };
