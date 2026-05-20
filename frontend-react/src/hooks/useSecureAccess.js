import { useState } from "react";
import { activateBreakGlass, deactivateBreakGlass, startImpersonation, stopImpersonation } from "../api";
import { isImpersonating, isBreakGlassActive } from "../utils/roles";

export function useSecureAccess({ token, user, applySessionFromPayload, loadAll, setError }) {
  const [secureAccessMode, setSecureAccessMode] = useState("");
  const [secureAccessBusy, setSecureAccessBusy] = useState(false);
  const [secureAccessError, setSecureAccessError] = useState("");

  function openSecureAccess(mode) {
    setSecureAccessError("");
    setSecureAccessMode(mode || "");
  }

  async function submitSecureAccess(payload) {
    if (!token) return;
    setSecureAccessBusy(true);
    setSecureAccessError("");
    try {
      const next = secureAccessMode === "break-glass"
        ? await activateBreakGlass(token, { reason: payload.reason })
        : await startImpersonation(token, payload);
      applySessionFromPayload(next);
      setSecureAccessMode("");
      await loadAll();
    } catch (err) {
      setSecureAccessError(err.message || "Falha ao trocar contexto de acesso.");
    } finally {
      setSecureAccessBusy(false);
    }
  }

  async function stopSecureImpersonation() {
    if (!token || !isImpersonating(user)) return;
    setSecureAccessBusy(true);
    setSecureAccessError("");
    try {
      const next = await stopImpersonation(token);
      applySessionFromPayload(next);
      await loadAll();
    } catch (err) {
      setError(err.message || "Falha ao encerrar contexto assumido.");
    } finally {
      setSecureAccessBusy(false);
    }
  }

  async function stopBreakGlass() {
    if (!token || !isBreakGlassActive(user)) return;
    setSecureAccessBusy(true);
    setSecureAccessError("");
    try {
      const next = await deactivateBreakGlass(token);
      applySessionFromPayload(next);
      await loadAll();
    } catch (err) {
      setError(err.message || "Falha ao encerrar break-glass.");
    } finally {
      setSecureAccessBusy(false);
    }
  }

  return {
    secureAccessMode, setSecureAccessMode,
    secureAccessBusy,
    secureAccessError, setSecureAccessError,
    openSecureAccess, submitSecureAccess,
    stopSecureImpersonation, stopBreakGlass,
  };
}
