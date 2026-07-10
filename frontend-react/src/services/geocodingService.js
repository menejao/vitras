/**
 * geocodingService.js — Geocodificação de endereços via Nominatim (OpenStreetMap).
 *
 * Nominatim é público, sem API key, sem secret.
 * Chamada direta do frontend é permitida conforme política do serviço.
 *
 * Política de uso:
 *   - Máx. 1 req/segundo por IP (rate-limit Nominatim)
 *   - User-Agent obrigatório (definido no header)
 *   - Nunca inventar coordenadas
 *   - Falha de geocodificação não bloqueia salvamento
 */

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 8000;
const USER_AGENT = "VITRAS/1.0 (Sistema de Saúde Primária; contato@vitras.app)";

/**
 * Geocodifica um endereço completo.
 *
 * @param {object} addr
 * @param {string} addr.street
 * @param {string} [addr.streetNumber]
 * @param {string} addr.neighborhood
 * @param {string} addr.municipalityName
 * @param {string} addr.uf
 * @param {string} [addr.cep]
 * @returns {Promise<{lat: number, lng: number, approximate: boolean}>}
 * @throws {Error} com mensagem legível em caso de falha
 */
export async function geocodeAddress({ street, streetNumber, neighborhood, municipalityName, uf, cep }) {
  if (!municipalityName || !uf) throw new Error("Município e UF são necessários para geocodificar");

  // Montar query progressiva: com número > sem número > só município
  const queries = [];

  if (street && streetNumber) {
    queries.push({
      q: [street, streetNumber, neighborhood, municipalityName, uf, cep, "Brasil"].filter(Boolean).join(", "),
      approximate: false,
    });
  }
  if (street) {
    queries.push({
      q: [street, neighborhood, municipalityName, uf, "Brasil"].filter(Boolean).join(", "),
      approximate: !streetNumber,
    });
  }
  queries.push({
    q: [municipalityName, uf, "Brasil"].join(", "),
    approximate: true,
  });

  for (const { q, approximate } of queries) {
    const result = await _nominatimSearch(q);
    if (result) return { ...result, approximate };
  }

  throw new Error("Endereço não encontrado pelo serviço de geocodificação");
}

async function _nominatimSearch(q) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = new URL(NOMINATIM_BASE);
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "br");

    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const hit = data[0];
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Timeout ao buscar coordenadas");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
