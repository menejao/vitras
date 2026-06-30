/**
 * Territorial Service — TERRITORIAL-MAP-FOUNDATION-01 + TERRITORIAL-MICROAREA-AUTO-SUGGESTION-01
 *
 * Camada de abstração para dados territoriais.
 * Mock isolado: quando backend territorial for implementado, substituir
 * apenas getTerritorialAreas() por chamada real à API.
 *
 * TerritorialArea shape:
 *   id, code, name, healthUnitId, polygonGeoJson, teamId, teamName,
 *   teamColor, acsId, acsName, streets[], notes, active, status,
 *   createdAt, updatedAt
 *
 * status values: "draft" | "active"
 *   draft  — polígono criado mas não confirmado pela equipe (borda tracejada)
 *   active — microárea confirmada, usada em consultas territoriais
 */

// ── Status de microárea ────────────────────────────────────────────────────
export const STATUS_DRAFT = "draft";
export const STATUS_ACTIVE = "active";

// ── Formulário vazio (reset) ───────────────────────────────────────────────
export const INIT_DRAFT = {
  name: "",
  code: "",
  teamName: "",
  acsName: "",
  teamColor: "",  // populated after TEAM_COLORS is declared below
  notes: "",
};

// ── Estilos de mapa ────────────────────────────────────────────────────────
// Trocar provider = trocar estas constantes. Regras de negócio não mudam.

export const MAP_STYLES = {
  // Satélite ESRI: gratuito, sem API key, alta cobertura Brasil
  satellite: {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      satellite: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "© Esri, Maxar, Earthstar Geographics",
        maxzoom: 19,
      },
    },
    layers: [{ id: "satellite-layer", type: "raster", source: "satellite" }],
  },

  // Street OpenFreeMap: MIT, sem API key, vetorial, MapLibre nativo
  street: "https://tiles.openfreemap.org/styles/liberty",
};

// Estilo padrão: satélite (conforme especificação)
export const DEFAULT_MAP_STYLE = MAP_STYLES.satellite;

// Centro padrão do Brasil — cada UBS configurará sua área futuramente
export const DEFAULT_MAP_CENTER = [-51.9253, -14.235];
export const DEFAULT_MAP_ZOOM = 4;

// ── Paleta de cores por equipe ─────────────────────────────────────────────
// Arquitetura futura: gerar por lista de ruas, domicílios cadastrados,
// convex hull, concave hull, importação GeoJSON/KML/Shapefile, ajuste de
// vértices, divisão/união de microáreas e histórico de alterações.
// Hoje: polígono por pontos clicados no mapa + revisão humana obrigatória.

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

// Cor padrão do form inicial
INIT_DRAFT.teamColor = TEAM_COLORS[0];

// ── Mock de dados territoriais ─────────────────────────────────────────────
// Vazio por default — estado vazio profissional é o comportamento esperado.
// Para testar com dados, descomente MOCK_AREAS abaixo.

const EMPTY_AREAS = [];

/*
const MOCK_AREAS = [
  {
    id: "ta-001",
    code: "001",
    name: "Microárea 001",
    healthUnitId: "ubs-1",
    polygonGeoJson: null,
    teamId: "team-1",
    teamName: "Equipe Azul",
    teamColor: TEAM_COLORS[0],
    acsId: "acs-1",
    acsName: "Maria Silva",
    streets: ["Rua das Flores", "Av. Principal", "Beco do Laranjo"],
    notes: "",
    active: true,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
];
*/

// ── Criação de polígono ────────────────────────────────────────────────────

/**
 * Constrói GeoJSON Feature Polygon a partir de pontos clicados no mapa.
 * Fecha o anel automaticamente (primeiro ponto = último ponto).
 * Retorna null se menos de 3 pontos.
 *
 * @param {Array<{lng: number, lat: number}>} points
 * @param {string} teamColor
 * @returns {GeoJSON.Feature<Polygon>|null}
 */
export function buildPolygonGeoJSON(points, teamColor) {
  if (!points || points.length < 3) return null;
  const coords = points.map(p => [p.lng, p.lat]);
  coords.push([coords[0][0], coords[0][1]]); // fechar anel
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
    properties: { teamColor: teamColor || TEAM_COLORS[0] },
  };
}

/**
 * Valida formulário de microárea antes de avançar para desenho.
 * Retorna objeto com chaves de campos inválidos e mensagens de erro.
 */
export function validateDraftForm(form) {
  const errors = {};
  if (!form.name || !form.name.trim()) errors.name = "Nome é obrigatório";
  if (!form.teamColor) errors.teamColor = "Cor é obrigatória";
  return errors;
}

/**
 * Valida pontos do polígono antes de salvar.
 * Retorna string com mensagem de erro, ou null se válido.
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

// ── API ────────────────────────────────────────────────────────────────────

/**
 * Retorna áreas territoriais da unidade.
 * Future: GET /api/territorial/areas
 */
export async function getTerritorialAreas(_token) {
  // TODO: substituir por chamada real quando backend territorial for implementado
  // const res = await fetch(`${API_URL}/territorial/areas`, {
  //   headers: { Authorization: `Bearer ${_token}` },
  // });
  // if (!res.ok) throw new Error("Erro ao carregar áreas territoriais");
  // return res.json();
  return EMPTY_AREAS;
}

/**
 * Retorna área territorial por id.
 * Future: GET /api/territorial/areas/:id
 */
export async function getTerritorialArea(_token, _id) {
  const areas = await getTerritorialAreas(_token);
  return areas.find(a => a.id === _id) || null;
}

/**
 * Busca áreas por termo (rua, equipe, ACS, nome, código).
 */
export function searchAreas(areas, query) {
  if (!query || !query.trim()) return areas;
  const q = query.toLowerCase().trim();
  return areas.filter(a =>
    a.name?.toLowerCase().includes(q) ||
    a.code?.toLowerCase().includes(q) ||
    a.acsName?.toLowerCase().includes(q) ||
    a.teamName?.toLowerCase().includes(q) ||
    a.streets?.some(s => s.toLowerCase().includes(q))
  );
}

/**
 * Converte lista de áreas em FeatureCollection GeoJSON.
 * Usado para alimentar a camada MapLibre.
 */
export function areasToGeoJSON(areas) {
  const features = areas
    .filter(a => a.polygonGeoJson && (a.active || a.status === STATUS_DRAFT))
    .map(area => {
      const geometry =
        area.polygonGeoJson?.geometry || area.polygonGeoJson;
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
