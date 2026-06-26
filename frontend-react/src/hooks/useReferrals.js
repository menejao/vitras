import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createReferral,
  deleteReferral,
  listReferrals,
  updateReferral,
} from "../api";

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
  const [loading, setLoading] = useState(Boolean(enabled)); // true only during initial fetch
  const [error, setError] = useState("");
  const initialized = useRef(false);

  // silent=true → skip loading spinner (post-mutation refreshes + polling)
  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!enabled || !token) return [];
    if (!silent || !initialized.current) setLoading(true);
    try {
      setError("");
      const next = await listReferrals(token);
      setEntries(sortReferrals(next));
      initialized.current = true;
      return next;
    } catch (err) {
      const message = err?.message || "Erro ao carregar encaminhamentos.";
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
      refresh({ silent: true }).catch(() => {});
    }, pollMs);
    return () => window.clearInterval(intervalId);
  }, [enabled, token, pollMs, refresh]);

  const createEntry = useCallback(async (payload) => {
    const created = await createReferral(token, payload);
    await refresh({ silent: true });
    return created;
  }, [token, refresh]);

  const patchEntry = useCallback(async (id, payload) => {
    // Optimistic: update local state immediately so UI responds without waiting
    setEntries((prev) =>
      sortReferrals(
        prev.map((e) =>
          e.id === id ? { ...e, ...payload, updatedAt: new Date().toISOString() } : e,
        ),
      ),
    );
    try {
      const updated = await updateReferral(token, id, payload);
      // Silent sync to get server state (events[], contrarreferencia, etc.)
      await refresh({ silent: true });
      return updated;
    } catch (err) {
      // Rollback: restore from server
      await refresh({ silent: true }).catch(() => {});
      throw err;
    }
  }, [token, refresh]);

  const removeEntry = useCallback(async (id) => {
    await deleteReferral(token, id);
    await refresh({ silent: true });
  }, [token, refresh]);

  const derived = useMemo(() => ({
    pending:   entries.filter((item) => item.status === "pending").length,
    scheduled: entries.filter((item) => item.status === "scheduled").length,
    done:      entries.filter((item) => item.status === "done").length,
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
    ...derived,
  };
}
