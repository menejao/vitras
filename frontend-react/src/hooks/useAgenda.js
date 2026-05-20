import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAgendaEntry,
  deleteAgendaEntry,
  listAgendaEntries,
  updateAgendaEntry,
} from "../api";

function sortAgendaEntries(entries = []) {
  return [...entries].sort((a, b) => {
    const dateCmp = String(a.date || "").localeCompare(String(b.date || ""));
    if (dateCmp !== 0) return dateCmp;
    const timeCmp = String(a.time || "").localeCompare(String(b.time || ""));
    if (timeCmp !== 0) return timeCmp;
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  });
}

export function useAgenda(token, options = {}) {
  const { enabled = true, pollMs = 15000, filters = {}, onError } = options;
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; });

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");

  const queryKey = JSON.stringify(filters || {});

  const refresh = useCallback(async () => {
    if (!enabled || !token) return [];
    try {
      setLoading(true);
      setError("");
      const next = await listAgendaEntries(token, filters);
      setEntries(sortAgendaEntries(next));
      return next;
    } catch (err) {
      const message = err?.message || "Erro ao carregar agenda.";
      setError(message);
      if (typeof onErrorRef.current === "function") onErrorRef.current(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [enabled, token, queryKey]);

  useEffect(() => {
    if (!enabled || !token) return undefined;
    refresh().catch(() => {});
    const intervalId = window.setInterval(() => {
      refresh().catch(() => {});
    }, pollMs);
    return () => window.clearInterval(intervalId);
  }, [enabled, token, pollMs, refresh]);

  const createEntry = useCallback(async (payload) => {
    const created = await createAgendaEntry(token, payload);
    await refresh();
    return created;
  }, [token, refresh]);

  const patchEntry = useCallback(async (id, payload) => {
    const updated = await updateAgendaEntry(token, id, payload);
    await refresh();
    return updated;
  }, [token, refresh]);

  const removeEntry = useCallback(async (id) => {
    await deleteAgendaEntry(token, id);
    await refresh();
  }, [token, refresh]);

  const derived = useMemo(() => {
    const scheduled = entries.filter((item) => item.status === "scheduled").length;
    const arrived = entries.filter((item) => item.status === "arrived").length;
    const attending = entries.filter((item) => item.status === "attending").length;
    const done = entries.filter((item) => item.status === "done").length;
    const absent = entries.filter((item) => item.status === "absent").length;
    return { scheduled, arrived, attending, done, absent };
  }, [entries]);

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
