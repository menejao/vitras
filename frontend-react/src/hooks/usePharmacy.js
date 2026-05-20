import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adjustPharmacyStockItem,
  createPharmacyStockItem,
  dispensePharmacyItem,
  listPharmacyLogs,
  listPharmacyStock,
  updatePharmacyStockItem,
} from "../api";

function sortStock(entries = []) {
  return [...entries].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
}

function sortLogs(entries = []) {
  return [...entries].sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));
}

export function usePharmacy(token, options = {}) {
  const { enabled = true, pollMs = 15000, onError } = options;
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; });

  const [stock, setStock] = useState([]);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!enabled || !token) return { stock: [], log: [] };
    try {
      setLoading(true);
      setError("");
      const [nextStock, nextLog] = await Promise.all([
        listPharmacyStock(token),
        listPharmacyLogs(token),
      ]);
      setStock(sortStock(nextStock));
      setLog(sortLogs(nextLog));
      return { stock: nextStock, log: nextLog };
    } catch (err) {
      const message = err?.message || "Erro ao carregar farmacia.";
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

  const createItem = useCallback(async (payload) => {
    const created = await createPharmacyStockItem(token, payload);
    await refresh();
    return created;
  }, [token, refresh]);

  const updateItem = useCallback(async (id, payload) => {
    const updated = await updatePharmacyStockItem(token, id, payload);
    await refresh();
    return updated;
  }, [token, refresh]);

  const adjustItem = useCallback(async (id, payload) => {
    const updated = await adjustPharmacyStockItem(token, id, payload);
    await refresh();
    return updated;
  }, [token, refresh]);

  const dispenseItem = useCallback(async (payload) => {
    const result = await dispensePharmacyItem(token, payload);
    await refresh();
    return result;
  }, [token, refresh]);

  const derived = useMemo(() => {
    const lowStock = stock.filter((item) => Number(item.qty || 0) <= Number(item.minQty || 0));
    const outStock = stock.filter((item) => Number(item.qty || 0) === 0);
    const today = new Date().toISOString().slice(0, 10);
    const dispensasHoje = log.filter((item) => item.type === "dispensa" && String(item.ts || "").slice(0, 10) === today).length;
    return { lowStock, outStock, dispensasHoje };
  }, [stock, log]);

  return {
    stock,
    log,
    loading,
    error,
    setError,
    refresh,
    createItem,
    updateItem,
    adjustItem,
    dispenseItem,
    ...derived,
  };
}
