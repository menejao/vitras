/**
 * ActiveUnitContext — Sprint C
 *
 * Fonte única de verdade do contexto operacional ativo no frontend.
 * Consumido por qualquer componente que precise saber qual UBS está ativa.
 *
 * Compatibilidade: lê de user.unitId (JWT). Quando Sprint D remover user.unitId,
 * apenas este contexto precisa mudar — os consumidores permanecem intactos.
 */
import { createContext, useContext, useMemo } from "react";

const ActiveUnitContext = createContext(null);

export function ActiveUnitProvider({ user, unitName: unitNameProp, children }) {
  const value = useMemo(() => {
    const unitId = String(user?.unitId || "");
    return {
      unitId,
      unitName: unitNameProp || String(user?.unitName || ""),
      teamId: String(user?.teamId || ""),
      teamName: String(user?.teamName || ""),
      role: String(user?.role || ""),
    };
  }, [user, unitNameProp]);

  return (
    <ActiveUnitContext.Provider value={value}>
      {children}
    </ActiveUnitContext.Provider>
  );
}

export function useActiveUnit() {
  const ctx = useContext(ActiveUnitContext);
  if (!ctx) {
    // Graceful fallback — consumers outside provider get empty context.
    return { unitId: "", unitName: "", teamId: "", teamName: "", role: "", unit: null };
  }
  return ctx;
}

export default ActiveUnitContext;
