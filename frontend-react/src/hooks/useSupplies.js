import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adjustSuppliesStockItem,
  closeSuppliesContinuous,
  dispenseSupplies,
  listSuppliesContinuous,
  listSuppliesLogs,
  listSuppliesStock,
} from "../api";

function sortStock(entries = []) {
  return [...entries].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
}

function sortLogs(entries = []) {
  return [...entries].sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));
}

function sortContinuous(entries = []) {
  return [...entries].sort((a, b) => String(b.dtInicio || "").localeCompare(String(a.dtInicio || "")));
}

export function useSupplies(token, options = {}) {
  const { enabled = true, pollMs = 15000, onError } = options;
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; });

  const [stock, setStock] = useState([]);
  const [log, setLog] = useState([]);
  const [continuous, setContinuous] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!enabled || !token) return { stock: [], log: [], continuous: [] };
    try {
      setLoading(true);
      setError("");
      const [nextStock, nextLog, nextContinuous] = await Promise.all([
        listSuppliesStock(token),
        listSuppliesLogs(token),
        listSuppliesContinuous(token),
      ]);
      setStock(sortStock(nextStock));
      setLog(sortLogs(nextLog));
      setContinuous(sortContinuous(nextContinuous));
      return { stock: nextStock, log: nextLog, continuous: nextContinuous };
    } catch (err) {
      const message = err?.message || "Erro ao carregar insumos.";
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

  const adjustStock = useCallback(async (id, payload) => {
    const updated = await adjustSuppliesStockItem(token, id, payload);
    await refresh();
    return updated;
  }, [token, refresh]);

  const dispense = useCallback(async (payload) => {
    const result = await dispenseSupplies(token, payload);
    await refresh();
    return result;
  }, [token, refresh]);

  const closeContinuous = useCallback(async (id, payload) => {
    const result = await closeSuppliesContinuous(token, id, payload);
    await refresh();
    return result;
  }, [token, refresh]);

  const derived = useMemo(() => {
    const continuousActive = continuous.filter((entry) => entry.ativo);
    const outStock = stock.filter((item) => Number(item.qty || 0) === 0);
    const today = new Date().toISOString().slice(0, 10);
    const dispensasHoje = log.filter((item) => item.type === "dispensa" && String(item.date || item.ts || "").slice(0, 10) === today).length;
    return { continuousActive, outStock, dispensasHoje };
  }, [continuous, log, stock]);

  return {
    stock,
    log,
    continuous,
    loading,
    error,
    refresh,
    adjustStock,
    dispense,
    closeContinuous,
    ...derived,
  };
}
