/**
 * cepService.js — CEP address lookup via ViaCEP
 *
 * Isolated from UI — provider swap (ViaCEP → BrasilAPI etc.) happens here only.
 * Never call external address APIs directly from components.
 *
 * Usage:
 *   const addr = await lookupCep("01310-100");
 *   // { street, neighborhood, municipalityName, uf, municipalityId }
 */

const VIACEP_BASE = "https://viacep.com.br/ws";
const TIMEOUT_MS  = 6000;

/**
 * Lookup address by CEP.
 * @param {string} rawCep - Any format (e.g. "01310-100" or "01310100")
 * @returns {{ street, neighborhood, municipalityName, uf, municipalityId }}
 * @throws {Error} With user-readable message on any failure
 */
export async function lookupCep(rawCep) {
  const cep = String(rawCep || "").replace(/\D/g, "");
  if (cep.length !== 8) throw new Error("CEP deve ter 8 dígitos");

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${VIACEP_BASE}/${cep}/json/`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`ViaCEP indisponível (HTTP ${res.status})`);
    const data = await res.json();
    if (data.erro) throw new Error("CEP não encontrado");
    return {
      street:           data.logradouro   || "",
      neighborhood:     data.bairro       || "",
      municipalityName: data.localidade   || "",
      uf:               (data.uf || "").toUpperCase(),
      municipalityId:   data.ibge         || "",
    };
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Timeout ao consultar CEP. Preencha manualmente.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Format CEP string to "NNNNN-NNN" for display.
 */
export function formatCep(raw) {
  const d = String(raw || "").replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
