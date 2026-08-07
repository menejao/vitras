import { useMemo, useState } from "react";
import { login, verifyLogin2fa, register, refreshSession, logoutApi, setOnAuthRefreshed, selectUnit, switchUnit } from "../api";
import { readSession } from "../utils/storage";
import { SESSION_KEY, UI_STATE_KEY, RECEPTION_KEY, IDLE_ACTIVITY_KEY, IDLE_LOGOUT_KEY } from "../config/constants";
import { onlyDigits } from "../utils/formatting";

export const COOKIE_SESSION_SENTINEL = "__cookie_session__";

function readInitialToken(session) {
  try {
    if (session?.mode === "cookie" && session?.user) return COOKIE_SESSION_SENTINEL;
    const t = String(session?.token || "");
    if (t && !/\s/.test(t)) return t;
    return "";
  } catch {
    return "";
  }
}

export function useAuth({ onSessionExpired, onLoginSuccess } = {}) {
  const session = useMemo(() => {
    try { return readSession(); } catch { return null; }
  }, []);

  const [token, setToken] = useState(() => readInitialToken(session));
  const [user, setUser] = useState(() => {
    const t = readInitialToken(session);
    return t ? (session?.user || null) : null;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loginChallenge, setLoginChallenge] = useState(null);
  // Sprint B: unit selection state
  const [pendingUnitSelection, setPendingUnitSelection] = useState(() => {
    // If session has requiresUnitSelection persisted (e.g. after page reload mid-selection)
    try { return readSession()?.requiresUnitSelection || false; } catch { return false; }
  });
  const [availableUnitsForSelection, setAvailableUnitsForSelection] = useState(() => {
    try { return readSession()?.availableUnits || null; } catch { return null; }
  });

  function persistCookieSession(nextUser, csrfToken = "", extra = {}) {
    const previous = readSession();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      mode: "cookie",
      user: nextUser,
      csrfToken: String(csrfToken || previous?.csrfToken || "").trim(),
      ...extra,
    }));
  }

  function persistBearerSession(nextUser, nextToken, nextRefreshToken = "", extra = {}) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      token: String(nextToken || "").trim(),
      refreshToken: String(nextRefreshToken || "").trim(),
      user: nextUser,
      ...extra,
    }));
  }

  function applyCookieSession(nextUser, csrfToken = "", extra = {}) {
    setToken(COOKIE_SESSION_SENTINEL);
    setUser(nextUser);
    persistCookieSession(nextUser, csrfToken, extra);
  }

  function applyBearerSession(nextUser, nextToken, nextRefreshToken = "", extra = {}) {
    setToken(String(nextToken || "").trim());
    setUser(nextUser);
    persistBearerSession(nextUser, nextToken, nextRefreshToken, extra);
  }

  function applySessionFromPayload(payload, extra = {}) {
    const nextUser = payload?.user || null;
    const csrfToken = String(payload?.csrfToken || "").trim();
    const nextToken = String(payload?.token || "").trim();
    const nextRefreshToken = String(payload?.refreshToken || "").trim();
    if (csrfToken) {
      applyCookieSession(nextUser, csrfToken, extra);
      return;
    }
    if (nextToken) {
      applyBearerSession(nextUser, nextToken, nextRefreshToken, extra);
      return;
    }
    applyCookieSession(nextUser, "", extra);
  }

  // Register the refresh callback so api() can update React state after a background refresh.
  // setOnAuthRefreshed is idempotent — safe to call on every render since the function is stable.
  setOnAuthRefreshed(applySessionFromPayload);

  async function handleLogin(identifier, password) {
    setError(""); setBusy(true);
    try {
      const payload = await login(identifier.trim(), password);
      if (payload?.twoFactorRequired) {
        setLoginChallenge({
          email: identifier.trim().toLowerCase(),
          challengeId: payload.challengeId,
          challengeExpiresAt: payload.challengeExpiresAt,
        });
        return;
      }
      setLoginChallenge(null);
      if (payload?.requiresUnitSelection && Array.isArray(payload.availableUnits)) {
        // Store session (token included for select-unit requireAuth) but hold dashboard open
        applySessionFromPayload(payload, {
          requiresUnitSelection: true,
          availableUnits: payload.availableUnits,
        });
        setPendingUnitSelection(true);
        setAvailableUnitsForSelection(payload.availableUnits);
        return;
      }
      applySessionFromPayload(payload);
      onLoginSuccess?.(payload.user);
    } catch {
      setLoginChallenge(null);
      setError("ID ou senha incorretos.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyLoginTwoFactor(code) {
    if (!loginChallenge?.challengeId) {
      setError("Desafio 2FA inválido.");
      return;
    }
    setError(""); setBusy(true);
    try {
      const payload = await verifyLogin2fa(loginChallenge.challengeId, code);
      setLoginChallenge(null);
      applySessionFromPayload(payload);
      onLoginSuccess?.(payload.user);
    } catch (backendErr) {
      setError(backendErr?.message || "Código 2FA inválido.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(reg) {
    setError(""); setBusy(true);
    try {
      const payload = await register({
        name: reg.name.trim(),
        email: reg.email.trim(),
        password: reg.password,
        role: reg.role,
        teamId: reg.teamId,
        councilNumber: onlyDigits(reg.councilNumber),
        councilUf: String(reg.councilUf || "").toUpperCase(),
      });
      applySessionFromPayload(payload);
    } catch (e) {
      if (!(await handleApiError(e))) setError(e.message || "Falha no cadastro");
    } finally {
      setBusy(false);
    }
  }

  async function handleApiError(e) {
    // api() intercepts 401s, refreshes, and retries automatically.
    // If we arrive here with _refreshFailed, the refresh token itself expired → logout.
    // If we arrive here with a raw 401 (no interceptor active yet, or non-session 401), attempt
    // a fallback refresh to handle edge cases during app bootstrap.
    if (e?._refreshFailed) {
      setToken(""); setUser(null);
      sessionStorage.removeItem(SESSION_KEY);
      setError("Sessão expirada. Faça login novamente.");
      onSessionExpired?.();
      return true;
    }
    const msg = String(e?.message || e || "").toLowerCase();
    const is401 = e?.status === 401 || msg.includes("token ausente") || msg.includes("token inválido") ||
                  msg.includes("expirad") || msg.includes("não autorizado");
    if (is401) {
      const sess = readSession();
      if (sess?.mode === "cookie" || sess?.refreshToken) {
        try {
          const payload = await refreshSession(sess?.refreshToken || "");
          applySessionFromPayload(payload);
          return true;
        } catch {}
      }
      setToken(""); setUser(null);
      sessionStorage.removeItem(SESSION_KEY);
      setError("Sessão expirada. Faça login novamente.");
      onSessionExpired?.();
      return true;
    }
    return false;
  }

  function refreshUserFromBoot(bootUser, csrfToken) {
    setUser(bootUser);
    const sess = readSession();
    if (sess?.mode === "cookie" || token === COOKIE_SESSION_SENTINEL) {
      persistCookieSession(bootUser, csrfToken || "");
    } else {
      persistBearerSession(bootUser, token, sess?.refreshToken || "");
    }
  }

  async function handleSelectUnit(unitId) {
    setError(""); setBusy(true);
    try {
      const payload = await selectUnit(token, unitId);
      applySessionFromPayload(payload);
      setPendingUnitSelection(false);
      // keep availableUnitsForSelection so Topbar can offer unit switcher
      onLoginSuccess?.(payload.user);
    } catch (e) {
      setError(e?.message || "Erro ao selecionar unidade.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSwitchUnit(unitId, { resetBootstrap } = {}) {
    setError(""); setBusy(true);
    try {
      const payload = await switchUnit(token, unitId);
      localStorage.removeItem(UI_STATE_KEY);
      localStorage.removeItem(RECEPTION_KEY);
      applySessionFromPayload(payload);
      setPendingUnitSelection(false);
      // keep availableUnitsForSelection so Topbar can offer unit switcher again
      if (resetBootstrap) resetBootstrap();
    } catch (e) {
      setError(e?.message || "Erro ao trocar de unidade.");
    } finally {
      setBusy(false);
    }
  }

  function openUnitSwitcher(units) {
    setAvailableUnitsForSelection(units || availableUnitsForSelection);
    setPendingUnitSelection(true);
  }

  function cancelTwoFactor() {
    setLoginChallenge(null);
    setError("");
  }

  function logout() {
    const sess = readSession();
    if (token) logoutApi(token, sess?.refreshToken || "").catch(() => {});
    setToken(""); setUser(null); setError("");
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(UI_STATE_KEY);
    localStorage.removeItem(RECEPTION_KEY);
    localStorage.removeItem(IDLE_ACTIVITY_KEY);
    try { localStorage.setItem(IDLE_LOGOUT_KEY, Date.now().toString()); } catch {}
    onSessionExpired?.();
  }

  return {
    token,
    user,
    setUser,
    busy,
    setBusy,
    error,
    setError,
    loginChallenge,
    cancelTwoFactor,
    handleLogin,
    handleVerifyLoginTwoFactor,
    handleRegister,
    handleApiError,
    applySessionFromPayload,
    refreshUserFromBoot,
    persistCookieSession,
    logout,
    // Sprint B: multi-unit
    pendingUnitSelection,
    availableUnitsForSelection,
    handleSelectUnit,
    handleSwitchUnit,
    openUnitSwitcher,
  };
}
