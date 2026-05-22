import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearDoneQueueEntries,
  createQueueEntry,
  deleteQueueEntry,
  listQueueEntries,
  updateQueueEntry,
} from "../api";
import { QUEUE_PRIORITY_ORDER } from "../utils/queue";

function sortQueueEntries(entries = []) {
  return [...entries].sort((a, b) => {
    const aDone = String(a.status || "") === "done";
    const bDone = String(b.status || "") === "done";
    if (aDone && !bDone) return 1;
    if (bDone && !aDone) return -1;
    const pa = QUEUE_PRIORITY_ORDER[String(a.priority || "normal")] ?? 4;
    const pb = QUEUE_PRIORITY_ORDER[String(b.priority || "normal")] ?? 4;
    if (pa !== pb) return pa - pb;
    return String(a.arrivedAt || "").localeCompare(String(b.arrivedAt || ""));
  });
}

export function useQueue(token, options = {}) {
  const { enabled = true, pollMs = 15000, onError } = options;
  // Use ref so inline callbacks from callers don't recreate refresh on every render
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
      const next = await listQueueEntries(token);
      setEntries(sortQueueEntries(next));
      return next;
    } catch (err) {
      const message = err?.message || "Erro ao carregar fila.";
      setError(message);
      if (typeof onErrorRef.current === "function") onErrorRef.current(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [enabled, token]); // onError intentionally excluded — handled via ref above

  useEffect(() => {
    if (!enabled || !token) return undefined;
    refresh().catch(() => {});
    const intervalId = window.setInterval(() => {
      refresh().catch(() => {});
    }, pollMs);
    return () => window.clearInterval(intervalId);
  }, [enabled, token, pollMs, refresh]);

  const createEntry = useCallback(async (payload) => {
    const created = await createQueueEntry(token, payload);
    await refresh();
    return created;
  }, [token, refresh]);

  const patchEntry = useCallback(async (id, payload) => {
    const updated = await updateQueueEntry(token, id, payload);
    await refresh();
    return updated;
  }, [token, refresh]);

  const removeEntry = useCallback(async (id) => {
    await deleteQueueEntry(token, id);
    await refresh();
  }, [token, refresh]);

  const clearDone = useCallback(async () => {
    await clearDoneQueueEntries(token);
    await refresh();
  }, [token, refresh]);

  const derived = useMemo(() => {
    const waiting = entries.filter((item) => item.status === "waiting").length;
    const attending = entries.filter((item) => item.status === "attending").length;
    const pendingTriage = entries.filter((item) => item.status === "waiting" || item.status === "triage");
    const ready = entries.filter((item) => item.status === "ready");
    return { waiting, attending, pendingTriage, ready };
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
    clearDone,
    ...derived
  };
}
