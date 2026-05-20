import crypto from "node:crypto";
import { COOKIE_ACCESS_NAME, COOKIE_REFRESH_NAME, COOKIE_CSRF_NAME, COOKIE_DOMAIN, COOKIE_SAME_SITE, COOKIE_SECURE, REFRESH_EXPIRES_MS } from "../config.js";

function parseCookies(req) {
  const header = String(req.headers.cookie || "");
  const pairs = header.split(";").map((part) => part.trim()).filter(Boolean);
  const cookies = {};
  for (const pair of pairs) {
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function baseCookieOptions(overrides = {}) {
  const options = {
    path: "/",
    sameSite: COOKIE_SAME_SITE,
    secure: COOKIE_SECURE,
    ...overrides
  };
  if (COOKIE_DOMAIN) options.domain = COOKIE_DOMAIN;
  return options;
}

function issueSessionCookies(res, { accessToken, refreshToken, csrfToken }) {
  res.cookie(COOKIE_ACCESS_NAME, accessToken, baseCookieOptions({
    httpOnly: true,
    maxAge: 12 * 60 * 60 * 1000
  }));
  res.cookie(COOKIE_REFRESH_NAME, refreshToken, baseCookieOptions({
    httpOnly: true,
    maxAge: REFRESH_EXPIRES_MS
  }));
  res.cookie(COOKIE_CSRF_NAME, csrfToken, baseCookieOptions({
    httpOnly: false,
    maxAge: REFRESH_EXPIRES_MS
  }));
}

function clearSessionCookies(res) {
  const options = baseCookieOptions({ maxAge: 0, expires: new Date(0) });
  res.clearCookie(COOKIE_ACCESS_NAME, options);
  res.clearCookie(COOKIE_REFRESH_NAME, options);
  res.clearCookie(COOKIE_CSRF_NAME, options);
}

function createCsrfToken() {
  return crypto.randomBytes(24).toString("hex");
}

export {
  parseCookies,
  issueSessionCookies,
  clearSessionCookies,
  createCsrfToken
};
