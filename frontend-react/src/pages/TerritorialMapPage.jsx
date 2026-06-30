// Copyright (c) 2026 Vitras. Todos os direitos reservados.
// TERRITORIAL-MAP-FOUNDATION-01
import { useCallback, useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  getTerritorialAreas,
  searchAreas,
  areasToGeoJSON,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DEFAULT_MAP_STYLE,
  MAP_STYLES,
} from "../services/territorialService";

// ── Ícones ─────────────────────────────────────────────────────────────────

const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const IconClose = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconMap = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M1 3l4 1.5L9.5 3l5.5 2v8l-5.5-2L5 12.5 1 11V3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M5 4.5v8M9.5 3v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const IconSatellite = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M2 8h12M8 2C6 4.5 6 11.5 8 14M8 2c2 2.5 2 9.5 0 12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    <path d="M3 5.5C5 6.5 11 6.5 13 5.5M3 10.5c2-1 8-1 10 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);

const IconChevronRight = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconPin = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5S12.5 9.5 12.5 6c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);

// ── Empty State ────────────────────────────────────────────────────────────

function TerritorialEmptyState() {
  return (
    <div className="territorial-empty">
      <div className="territorial-empty__icon">
        <IconPin />
      </div>
      <h3 className="territorial-empty__title">
        Nenhuma microárea configurada
      </h3>
      <p className="territorial-empty__desc">
        Nenhuma microárea territorial foi configurada para esta unidade.
      </p>
      <div className="territorial-empty__steps">
        <p className="territorial-empty__steps-label">Para configurar:</p>
        <ol className="territorial-empty__list">
          <li>Criar microáreas</li>
          <li>Definir equipes responsáveis</li>
          <li>Vincular ACS por microárea</li>
          <li>Importar polígonos GeoJSON</li>
          <li>Cadastrar ruas e pontos de referência</li>
        </ol>
      </div>
    </div>
  );
}

// ── Area Detail ────────────────────────────────────────────────────────────

function AreaDetail({ area, onClose }) {
  return (
    <div className="territorial-detail">
      <div className="territorial-detail__header">
        <div className="territorial-detail__badge" style={{ background: area.teamColor + "22", borderColor: area.teamColor, color: area.teamColor }}>
          Microárea {area.code}
        </div>
        <button className="icon-btn territorial-detail__close" onClick={onClose} aria-label="Fechar">
          <IconClose />
        </button>
      </div>

      <h3 className="territorial-detail__name">{area.name}</h3>

      <div className="territorial-detail__rows">
        {area.teamName && (
          <div className="territorial-detail__row">
            <span className="territorial-detail__label">Equipe</span>
            <span className="territorial-detail__value" style={{ color: area.teamColor }}>{area.teamName}</span>
          </div>
        )}
        {area.acsName && (
          <div className="territorial-detail__row">
            <span className="territorial-detail__label">ACS</span>
            <span className="territorial-detail__value">{area.acsName}</span>
          </div>
        )}
        {area.streets && area.streets.length > 0 && (
          <div className="territorial-detail__row territorial-detail__row--col">
            <span className="territorial-detail__label">Ruas ({area.streets.length})</span>
            <ul className="territorial-detail__streets">
              {area.streets.map((s, i) => (
                <li key={i} className="territorial-detail__street">{s}</li>
              ))}
            </ul>
          </div>
        )}
        {area.notes && (
          <div className="territorial-detail__row territorial-detail__row--col">
            <span className="territorial-detail__label">Observações</span>
            <span className="territorial-detail__value">{area.notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Area List Item ─────────────────────────────────────────────────────────

function AreaListItem({ area, onSelect }) {
  return (
    <button className="territorial-area-item" onClick={() => onSelect(area)}>
      <div className="territorial-area-item__color" style={{ background: area.teamColor }} />
      <div className="territorial-area-item__body">
        <span className="territorial-area-item__name">{area.name}</span>
        <span className="territorial-area-item__meta">
          {area.teamName && <span>{area.teamName}</span>}
          {area.acsName && <span>· {area.acsName}</span>}
          {area.streets?.length > 0 && <span>· {area.streets.length} ruas</span>}
        </span>
      </div>
      <IconChevronRight />
    </button>
  );
}

// ── Legend ─────────────────────────────────────────────────────────────────

function MapLegend({ areas }) {
  const teams = [];
  const seen = new Set();
  for (const a of areas) {
    if (a.teamName && !seen.has(a.teamName)) {
      seen.add(a.teamName);
      teams.push({ name: a.teamName, color: a.teamColor });
    }
  }
  if (!teams.length) return null;

  return (
    <div className="territorial-legend">
      <span className="territorial-legend__label">Equipes</span>
      <div className="territorial-legend__items">
        {teams.map(t => (
          <div key={t.name} className="territorial-legend__item">
            <span className="territorial-legend__dot" style={{ background: t.color }} />
            <span className="territorial-legend__name">{t.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Style Toggle ───────────────────────────────────────────────────────────

function MapStyleToggle({ styleMode, onToggle }) {
  return (
    <button
      className="territorial-style-toggle"
      onClick={onToggle}
      title={styleMode === "satellite" ? "Alternar para mapa de ruas" : "Alternar para satélite"}
      aria-label={styleMode === "satellite" ? "Mapa de ruas" : "Satélite"}
    >
      {styleMode === "satellite" ? <IconMap /> : <IconSatellite />}
      <span>{styleMode === "satellite" ? "Ruas" : "Satélite"}</span>
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function TerritorialMapPage({ token }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [search, setSearch] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [styleMode, setStyleMode] = useState("satellite");
  const [mapError, setMapError] = useState(null);

  // Load territorial areas
  useEffect(() => {
    getTerritorialAreas(token)
      .then(setAreas)
      .catch(() => setAreas([]));
  }, [token]);

  // Initialize MapLibre
  useEffect(() => {
    let map = null;
    let cancelled = false;

    import("maplibre-gl")
      .then(({ default: maplibregl }) => {
        if (cancelled || !mapContainerRef.current) return;

        map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: DEFAULT_MAP_STYLE,
          center: DEFAULT_MAP_CENTER,
          zoom: DEFAULT_MAP_ZOOM,
          attributionControl: false,
        });

        map.addControl(
          new maplibregl.AttributionControl({ compact: true }),
          "bottom-right"
        );
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "bottom-right"
        );

        map.on("load", () => {
          if (cancelled) return;

          // Source for territorial polygons
          map.addSource("territorial-areas", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });

          // Fill layer (semi-transparent)
          map.addLayer({
            id: "territorial-areas-fill",
            type: "fill",
            source: "territorial-areas",
            paint: {
              "fill-color": ["get", "teamColor"],
              "fill-opacity": 0.2,
            },
          });

          // Outline layer
          map.addLayer({
            id: "territorial-areas-outline",
            type: "line",
            source: "territorial-areas",
            paint: {
              "line-color": ["get", "teamColor"],
              "line-width": 2.5,
              "line-opacity": 0.85,
            },
          });

          // Hover fill
          map.addLayer({
            id: "territorial-areas-hover",
            type: "fill",
            source: "territorial-areas",
            paint: {
              "fill-color": ["get", "teamColor"],
              "fill-opacity": 0,
            },
          });

          map.on("click", "territorial-areas-fill", (e) => {
            const props = e.features?.[0]?.properties;
            if (!props) return;
            // Find full area from id
            setSelectedArea(prev => {
              if (prev?.id === props.id) return prev;
              return null; // trigger re-find below
            });
            setSelectedArea(a => a?.id === props.id ? a : ({ id: props.id }));
          });

          map.on("mouseenter", "territorial-areas-fill", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "territorial-areas-fill", () => {
            map.getCanvas().style.cursor = "";
          });

          map.on("error", () => setMapError(true));

          mapRef.current = map;
          setMapLoaded(true);
        });

        map.on("error", (e) => {
          console.warn("[TerritorialMap] map error", e);
        });
      })
      .catch(() => setMapError(true));

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Resolve selectedArea id → full object
  useEffect(() => {
    if (selectedArea && !selectedArea.name && selectedArea.id) {
      const found = areas.find(a => a.id === selectedArea.id);
      if (found) setSelectedArea(found);
    }
  }, [selectedArea, areas]);

  // Update GeoJSON when areas or map load
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const source = mapRef.current.getSource("territorial-areas");
    if (!source) return;
    source.setData(areasToGeoJSON(areas));
  }, [areas, mapLoaded]);

  // Style toggle
  const handleStyleToggle = useCallback(() => {
    if (!mapRef.current) return;
    const next = styleMode === "satellite" ? "street" : "satellite";
    setStyleMode(next);
    setMapLoaded(false);
    mapRef.current.setStyle(MAP_STYLES[next]);
    mapRef.current.once("style.load", () => {
      const map = mapRef.current;
      if (!map) return;

      if (!map.getSource("territorial-areas")) {
        map.addSource("territorial-areas", {
          type: "geojson",
          data: areasToGeoJSON(areas),
        });
        map.addLayer({
          id: "territorial-areas-fill",
          type: "fill",
          source: "territorial-areas",
          paint: { "fill-color": ["get", "teamColor"], "fill-opacity": 0.2 },
        });
        map.addLayer({
          id: "territorial-areas-outline",
          type: "line",
          source: "territorial-areas",
          paint: { "line-color": ["get", "teamColor"], "line-width": 2.5, "line-opacity": 0.85 },
        });
      }
      setMapLoaded(true);
    });
  }, [styleMode, areas]);

  const filteredAreas = searchAreas(areas, search);
  const hasAreas = areas.length > 0;

  return (
    <div className="territorial-page">
      {/* Header */}
      <div className="territorial-header">
        <div className="territorial-header__title">
          <h1 className="territorial-header__h1">Mapa Territorial</h1>
          <span className="territorial-header__badge">
            {hasAreas ? `${areas.length} microárea${areas.length !== 1 ? "s" : ""}` : "Sem configuração"}
          </span>
        </div>
        <MapStyleToggle styleMode={styleMode} onToggle={handleStyleToggle} />
      </div>

      {/* Layout */}
      <div className="territorial-layout">
        {/* Map */}
        <div className="territorial-map-wrap">
          <div ref={mapContainerRef} className="territorial-map-container" />

          {mapError && (
            <div className="territorial-map-error">
              <IconPin />
              <span>Não foi possível carregar o mapa. Verifique sua conexão.</span>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="territorial-sidebar">
          {/* Search */}
          <div className="territorial-search">
            <div className="input territorial-search__input">
              <IconSearch />
              <input
                type="search"
                placeholder="Buscar microárea, rua, equipe, ACS..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="territorial-search__field"
                aria-label="Buscar território"
              />
              {search && (
                <button
                  className="icon-btn territorial-search__clear"
                  onClick={() => setSearch("")}
                  aria-label="Limpar busca"
                >
                  <IconClose />
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="territorial-sidebar__body">
            {selectedArea && selectedArea.name ? (
              <AreaDetail area={selectedArea} onClose={() => setSelectedArea(null)} />
            ) : hasAreas ? (
              filteredAreas.length > 0 ? (
                <div className="territorial-area-list">
                  {filteredAreas.map(area => (
                    <AreaListItem key={area.id} area={area} onSelect={setSelectedArea} />
                  ))}
                </div>
              ) : (
                <div className="territorial-no-results">
                  <p>Nenhum resultado para <strong>"{search}"</strong></p>
                </div>
              )
            ) : (
              <TerritorialEmptyState />
            )}
          </div>

          {/* Legend */}
          {hasAreas && <MapLegend areas={areas} />}
        </aside>
      </div>
    </div>
  );
}
