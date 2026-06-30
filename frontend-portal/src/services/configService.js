/**
 * configService.js — Configurações do Portal consumidas do backend
 * Consome GET /citizen-portal/config (endpoint público)
 * O Portal NUNCA acessa rotas /platform/* ou config interna do Console.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function fetchPortalConfig(unitId) {
  const params = unitId ? `?unitId=${encodeURIComponent(unitId)}` : "";
  try {
    const res = await fetch(`${API_BASE}/citizen-portal/config${params}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Config indisponível (HTTP ${res.status})`);
    return await res.json();
  } catch (e) {
    console.warn("[configService] Falha ao carregar config do Portal:", e.message);
    return null;
  }
}

/**
 * Verifica se um módulo está ativo de acordo com a configuração retornada.
 * Fallback: retorna true se config ausente (não bloqueia por padrão em desenvolvimento).
 */
export function isModuloAtivo(config, modulo) {
  if (!config) return true;
  if (config.portal?.manutencao) return false;
  if (!config.portal?.ativo) return false;
  return config.modulos?.[modulo] !== false;
}
