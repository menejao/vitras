import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createReferral,
  deleteReferral,
  listReferrals,
  updateReferral,
} from "../api";

function buildReferralErrorMessage(err) {
  const status = Number(err?.status || 0);
  if (status === 401) return "Sessão expirada. Faça login novamente.";
  if (status === 403) return "Você não tem permissão para acessar encaminhamentos.";
  if (status === 404) return "Endpoint de encaminhamentos não encontrado.";
  if (status >= 500) return "Erro ao carregar encaminhamentos.";

  const backendMessage = String(err?.message || "").trim();
  if (!backendMessage || backendMessage === "Erro na API") {
    return "Não foi possível carregar os encaminhamentos agora.";
  }
  return backendMessage;
}

function sortReferrals(entries = []) {
  return [...entries].sort((a, b) => {
    const dateCmp = String(b.date || "").localeCompare(String(a.date || ""));
    if (dateCmp !== 0) return dateCmp;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

export function useReferrals(token, options = {}) {
  const { enabled = true, pollMs = 15000, onError } = options;
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; });

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!enabled || !token) return [];
    try {
      setLoading(true);
      setError("");
      const next = await listReferrals(token);
      setEntries(sortReferrals(next));
      return next;
    } catch (err) {
      const message = buildReferralErrorMessage(err);
      setError(message);
      if (typeof onErrorRef.current === "function") onErrorRef.current(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [enabled, token]);

  useEffect(() => {
    if (!enabled || !token) return undefined;
    refresh().catch(() => {});
    const intervalId = window.setInterval(() => {
      refresh().catch(() => {});
    }, pollMs);
    return () => window.clearInterval(intervalId);
  }, [enabled, token, pollMs, refresh]);

  const createEntry = useCallback(async (payload) => {
    const created = await createReferral(token, payload);
    await refresh();
    return created;
  }, [token, refresh]);

  const patchEntry = useCallback(async (id, payload) => {
    const updated = await updateReferral(token, id, payload);
    await refresh();
    return updated;
  }, [token, refresh]);

  const removeEntry = useCallback(async (id) => {
    await deleteReferral(token, id);
    await refresh();
  }, [token, refresh]);

  const derived = useMemo(() => ({
    pending: entries.filter((item) => item.status === "pending").length,
    scheduled: entries.filter((item) => item.status === "scheduled").length,
    done: entries.filter((item) => item.status === "done").length,
    cancelled: entries.filter((item) => item.status === "cancelled").length,
  }), [entries]);

  return {
    entries,
    loading,
    error,
    setError,
    refresh,
    createEntry,
    patchEntry,
    removeEntry,
    ...derived
  };
}
