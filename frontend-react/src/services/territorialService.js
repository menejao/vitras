/**
 * Territorial Service — TERRITORIAL-MAP-FOUNDATION-01 + TERRITORIAL-MICROAREA-AUTO-SUGGESTION-01
 *                       + TERRITORIAL-MAP-PERSISTENCE-UBS-CENTERING-01
 *
 * Camada de abstração para dados territoriais.
 * Backend: /territorial/areas (CRUD) + /territorial/unit (localização da UBS).
 *
 * TerritorialArea shape:
 *   id, unitId, code, name, teamName, teamColor, acsId, acsName,
 *   streets[{name, numberFrom, numberTo, side}], neighborhood, notes,
 *   active, status ("draft"|"active"), polygonGeoJson (GeoJSON Geometry|null),
 *   createdAt, updatedAt
 *
 * status:
 *   draft  — rascunho — não oficial, borda tracejada
 *   active — confirmado pela equipe UBS — used in territorial queries
 *
 * Arquitetura futura (não implementar agora):
 *   Geração por lista de ruas, domicílios cadastrados, convex hull, concave hull,
 *   importação GeoJSON/KML/Shapefile, ajuste de vértices, divisão/união de
 *   microáreas, histórico de alterações, geocoding automático.
 */

import { api } from "../api";

// ── Status de microárea ────────────────────────────────────────────────────
export const STATUS_DRAFT  = "draft";
export const STATUS_ACTIVE = "active";

// ── Formulário vazio (reset) ───────────────────────────────────────────────
export const INIT_DRAFT = {
  name: "",
  code: "",
  teamName: "",
  acsName: "",
  teamColor: "",
  neighborhood: "",
  notes: "",
  streets: [],
};

// ── Paleta de cores por equipe ─────────────────────────────────────────────
export const TEAM_COLORS = [
  "#0ea5e9", // azul
  "#10b981", // verde
  "#f59e0b", // amarelo
  "#ef4444", // vermelho
  "#8b5cf6", // roxo
  "#f97316", // laranja
  "#ec4899", // rosa
  "#14b8a6", // teal
];

INIT_DRAFT.teamColor = TEAM_COLORS[0];

// ── Configuração de mapa ───────────────────────────────────────────────────

export const MAP_STYLES = {
  // Street OpenFreeMap: MIT, sem API key, vetorial, MapLibre nativo
  // Padrão: ruas (operacional para configuração territorial)
  street: "https://tiles.openfreemap.org/styles/liberty",

  // Satélite ESRI: mantido para evolução futura (arquitetura preparada)
  satellite: {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      satellite: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        attribution: "© Esri, Maxar, Earthstar Geographics",
        maxzoom: 19,
      },
    },
    layers: [{ id: "satellite-layer", type: "raster", source: "satellite" }],
  },
};

// Padrão operacional: ruas
export const DEFAULT_MAP_STYLE = MAP_STYLES.street;

// Centro do Brasil — fallback enquanto UBS não tiver localização configurada
export const DEFAULT_MAP_CENTER = [-51.9253, -14.235];
export const DEFAULT_MAP_ZOOM   = 4;

// Zoom para quando a UBS tem localização configurada
export const UBS_MAP_ZOOM = 14;

// ── API calls ──────────────────────────────────────────────────────────────

/**
 * Retorna dados de localização da UBS atual.
 * Future: quando UBS tiver lat/lng → centralizar mapa.
 */
export async function getUnitLocation(token) {
  try {
    return await api("/territorial/unit", { credentials: "include" }, token);
  } catch {
    return null;
  }
}

/**
 * Retorna todas as microáreas da UBS atual.
 * GET /territorial/areas
 */
export async function getTerritorialAreas(token) {
  const data = await api("/territorial/areas", { credentials: "include" }, token);
  return data?.areas || [];
}

/**
 * Cria nova microárea (status: draft ou active).
 * POST /territorial/areas
 */
export async function createTerritorialArea(token, payload) {
  const data = await api("/territorial/areas", {
    method: "POST",
    body: JSON.stringify(payload),
    credentials: "include",
  }, token);
  return data?.area;
}

/**
 * Atualiza microárea existente.
 * PATCH /territorial/areas/:id
 */
export async function updateTerritorialArea(token, id, payload) {
  const data = await api(`/territorial/areas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    credentials: "include",
  }, token);
  return data?.area;
}

/**
 * Soft delete de microárea.
 * DELETE /territorial/areas/:id
 */
export async function deleteTerritorialArea(token, id) {
  await api(`/territorial/areas/${id}`, {
    method: "DELETE",
    credentials: "include",
  }, token);
}

// ── Utilitários ────────────────────────────────────────────────────────────

/**
 * Busca áreas por termo (rua, equipe, ACS, nome, código, bairro).
 */
export function searchAreas(areas, query) {
  if (!query || !query.trim()) return areas;
  const q = query.toLowerCase().trim();
  return areas.filter(a =>
    a.name?.toLowerCase().includes(q) ||
    a.code?.toLowerCase().includes(q) ||
    a.acsName?.toLowerCase().includes(q) ||
    a.teamName?.toLowerCase().includes(q) ||
    a.neighborhood?.toLowerCase().includes(q) ||
    a.streets?.some(s => (s.name || s).toLowerCase?.().includes(q))
  );
}

/**
 * Converte lista de áreas em FeatureCollection GeoJSON.
 * Usado para alimentar a camada MapLibre.
 * Inclui DRAFT para visualização (com isDraft=true nas properties).
 */
export function areasToGeoJSON(areas) {
  const features = (areas || [])
    .filter(a => a.polygonGeoJson && !a.deletedAt && (a.active || a.status === STATUS_DRAFT))
    .map(area => {
      const geometry = area.polygonGeoJson?.geometry || area.polygonGeoJson;
      return {
        type: "Feature",
        geometry,
        properties: {
          id: area.id,
          name: area.name,
          code: area.code,
          teamColor: area.teamColor || TEAM_COLORS[0],
          teamName: area.teamName || "",
          acsName: area.acsName || "",
          status: area.status || STATUS_ACTIVE,
          isDraft: area.status === STATUS_DRAFT,
        },
      };
    });
  return { type: "FeatureCollection", features };
}

/**
 * Constrói GeoJSON Feature Polygon a partir de pontos clicados no mapa.
 * Fecha o anel automaticamente. Retorna null se menos de 3 pontos.
 */
export function buildPolygonGeoJSON(points, teamColor) {
  if (!points || points.length < 3) return null;
  const coords = points.map(p => [p.lng, p.lat]);
  coords.push([coords[0][0], coords[0][1]]);
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
    properties: { teamColor: teamColor || TEAM_COLORS[0] },
  };
}

/**
 * Valida formulário antes de avançar para desenho.
 */
export function validateDraftForm(form) {
  const errors = {};
  if (!form.name || !form.name.trim()) errors.name = "Nome é obrigatório";
  if (!form.teamColor) errors.teamColor = "Cor é obrigatória";
  return errors;
}

/**
 * Valida pontos do polígono antes de salvar.
 * Retorna string de erro ou null se válido.
 */
export function validateDrawingPoints(points) {
  if (!points || points.length < 3) return "Adicione pelo menos 3 pontos no mapa";
  for (const p of points) {
    if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
      return `Coordenadas inválidas: lat=${p.lat}, lng=${p.lng}`;
    }
  }
  return null;
}
