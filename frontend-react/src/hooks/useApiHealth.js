import { useCallback, useEffect, useState } from "react";
import { getApiHealth } from "../api";

const POLL_MS = 45000;

export function useApiHealth() {
  const [apiHealth, setApiHealth] = useState({
    status: "checking",
    label: "Verificando...",
    latencyMs: 0,
    checkedAt: null,
  });

  const refresh = useCallback(async () => {
    const startedAt = Date.now();
    try {
      const payload = await getApiHealth();
      setApiHealth({
        status: "ok",
        label: payload?.ok ? "Online" : "Instável",
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      });
    } catch {
      setApiHealth({
        status: "down",
        label: "Offline",
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      });
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return apiHealth;
}
