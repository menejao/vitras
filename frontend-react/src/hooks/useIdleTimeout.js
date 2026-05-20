import { useCallback, useEffect, useRef, useState } from "react";
import { IDLE_ACTIVITY_KEY, IDLE_LOGOUT_KEY } from "../config/constants";

const THROTTLE_MS    = 5_000;
const CHECK_INTERVAL = 20_000;

export const IDLE_WARN_MS = 13 * 60 * 1000;
export const IDLE_OUT_MS  = 15 * 60 * 1000;

const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart", "pointerdown"];

function getIdleMs() {
  const last = parseInt(localStorage.getItem(IDLE_ACTIVITY_KEY) || "0", 10);
  return last ? Date.now() - last : 0;
}

export function useIdleTimeout({ onLogout, warnMs = IDLE_WARN_MS, outMs = IDLE_OUT_MS, enabled = true }) {
  const [showWarning, setShowWarning] = useState(false);
  const [remaining, setRemaining]     = useState(120);

  const lastWriteRef = useRef(0);
  const isActiveRef  = useRef(enabled);
  const runCheckRef  = useRef(null);

  const doLogout = useCallback(() => {
    if (!isActiveRef.current) return;
    isActiveRef.current = false;
    setShowWarning(false);
    try { localStorage.setItem(IDLE_LOGOUT_KEY, Date.now().toString()); } catch {}
    onLogout?.();
  }, [onLogout]);

  const stayActive = useCallback(() => {
    setShowWarning(false);
    const now = Date.now();
    lastWriteRef.current = now;
    try { localStorage.setItem(IDLE_ACTIVITY_KEY, now.toString()); } catch {}
  }, []);

  const stampActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastWriteRef.current < THROTTLE_MS) return;
    lastWriteRef.current = now;
    try { localStorage.setItem(IDLE_ACTIVITY_KEY, now.toString()); } catch {}
  }, []);

  const runCheck = useCallback(() => {
    if (!enabled || !isActiveRef.current) return;
    const idle = getIdleMs();
    if (idle === 0) return;
    if (idle >= outMs) {
      doLogout();
    } else if (idle >= warnMs) {
      setRemaining(Math.max(1, Math.ceil((outMs - idle) / 1000)));
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  }, [enabled, warnMs, outMs, doLogout]);

  runCheckRef.current = runCheck;

  useEffect(() => { isActiveRef.current = enabled; }, [enabled]);

  // Main effect: register events, intervals, cross-tab sync
  useEffect(() => {
    if (!enabled) { setShowWarning(false); return; }

    isActiveRef.current = true;
    const now = Date.now();
    lastWriteRef.current = now;
    try { localStorage.setItem(IDLE_ACTIVITY_KEY, now.toString()); } catch {}

    const onActivity = () => {
      stampActivity();
      if (showWarning) setShowWarning(false);
    };
    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));

    const checkInterval = setInterval(() => runCheckRef.current?.(), CHECK_INTERVAL);

    const onVisibility = () => {
      if (document.visibilityState === "visible") runCheckRef.current?.();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Cross-tab: another tab set IDLE_LOGOUT_KEY → log out here too
    const onStorage = (e) => {
      if (e.key === IDLE_LOGOUT_KEY && e.newValue && isActiveRef.current) {
        isActiveRef.current = false;
        setShowWarning(false);
        onLogout?.();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, onActivity));
      clearInterval(checkInterval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Countdown tick while warning is visible
  useEffect(() => {
    if (!showWarning) return;
    const tick = setInterval(() => {
      const idle = getIdleMs();
      const sec = Math.max(0, Math.ceil((outMs - idle) / 1000));
      if (sec <= 0) { doLogout(); } else { setRemaining(sec); }
    }, 1000);
    return () => clearInterval(tick);
  }, [showWarning, outMs, doLogout]);

  return { showWarning, remaining, stayActive, doLogout };
}
