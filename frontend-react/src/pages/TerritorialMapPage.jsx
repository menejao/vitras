// Copyright (c) 2026 Vitras. Todos os direitos reservados.
// TERRITORIAL-MAP-FOUNDATION-01 + TERRITORIAL-MICROAREA-AUTO-SUGGESTION-01
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  getTerritorialAreas,
  searchAreas,
  areasToGeoJSON,
  buildPolygonGeoJSON,
  validateDraftForm,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DEFAULT_MAP_STYLE,
  MAP_STYLES,
  TEAM_COLORS,
  INIT_DRAFT,
  STATUS_DRAFT,
  STATUS_ACTIVE,
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
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5S12.5 9.5 12.5 6c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);
const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);
const IconUndo = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 6H10a4 4 0 010 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M3 3L1 6l2 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconWarning = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M8 7v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

// ── Color Picker ────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }) {
  return (
    <div className="territorial-color-picker" role="group" aria-label="Cor da equipe">
      {TEAM_COLORS.map(c => (
        <button
          key={c}
          type="button"
          className={`territorial-color-swatch${c === value ? " is-active" : ""}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`Cor ${c}`}
          aria-pressed={c === value}
        />
      ))}
    </div>
  );
}

// ── Creation: Step 1 — Info Form ────────────────────────────────────────────

function CreationInfoStep({ form, onChange, errors, onNext, onCancel }) {
  const valid = form.name.trim() && form.teamColor;
  return (
    <div className="territorial-creator">
      <div className="territorial-creator__header">
        <span className="territorial-creator__step-label">Passo 1 de 3</span>
        <button className="icon-btn" onClick={onCancel} aria-label="Cancelar"><IconClose /></button>
      </div>
      <h3 className="territorial-creator__title">Nova Microárea</h3>
      <p className="territorial-creator__subtitle">Informe os dados básicos da microárea.</p>

      <div className="territorial-creator__form">
        <div className="field">
          <label className="field__label">Nome <span aria-hidden="true">*</span></label>
          <div className="input">
            <input
              placeholder="Ex: Microárea 001"
              value={form.name}
              onChange={e => onChange("name", e.target.value)}
              autoFocus
            />
          </div>
          {errors.name && <span className="field__error">{errors.name}</span>}
        </div>

        <div className="field">
          <label className="field__label">Código</label>
          <div className="input">
            <input
              placeholder="Ex: MA-001"
              value={form.code}
              onChange={e => onChange("code", e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="field__label">Equipe responsável</label>
          <div className="input">
            <input
              placeholder="Ex: Equipe Azul"
              value={form.teamName}
              onChange={e => onChange("teamName", e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="field__label">ACS responsável</label>
          <div className="input">
            <input
              placeholder="Ex: Maria Silva"
              value={form.acsName}
              onChange={e => onChange("acsName", e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="field__label">Cor da equipe <span aria-hidden="true">*</span></label>
          <ColorPicker value={form.teamColor} onChange={c => onChange("teamColor", c)} />
          {errors.teamColor && <span className="field__error">{errors.teamColor}</span>}
        </div>

        <div className="field">
          <label className="field__label">Observações</label>
          <textarea
            className="input"
            rows={2}
            placeholder="Observações sobre esta microárea..."
            value={form.notes}
            onChange={e => onChange("notes", e.target.value)}
            style={{ height: "auto", padding: "8px 12px", resize: "vertical" }}
          />
        </div>
      </div>

      <div className="territorial-creator__actions">
        <button className="btn btn--secondary btn--sm" onClick={onCancel}>Cancelar</button>
        <button
          className="btn btn--primary btn--sm"
          onClick={onNext}
          disabled={!valid}
        >
          Marcar no Mapa →
        </button>
      </div>
    </div>
  );
}

// ── Creation: Step 2 — Drawing ──────────────────────────────────────────────

function CreationDrawStep({ form, points, onUndo, onClear, onNext, onBack }) {
  const canNext = points.length >= 3;
  return (
    <div className="territorial-creator">
      <div className="territorial-creator__header">
        <span className="territorial-creator__step-label">Passo 2 de 3</span>
        <button className="icon-btn" onClick={onBack} aria-label="Voltar"><IconClose /></button>
      </div>
      <h3 className="territorial-creator__title">Marcar Limites</h3>

      <div className="territorial-creator__hint">
        <div
          className="territorial-creator__hint-dot"
          style={{ background: form.teamColor }}
        />
        <span>
          {points.length === 0
            ? "Clique no mapa para adicionar pontos."
            : points.length < 3
            ? `${3 - points.length} ponto(s) para fechar o polígono.`
            : `${points.length} pontos — polígono pronto. Adicione mais ou revise.`}
        </span>
      </div>

      {points.length > 0 && (
        <div className="territorial-creator__points-list">
          {points.map((p, i) => (
            <div key={i} className="territorial-creator__point-item">
              <span
                className="territorial-creator__point-num"
                style={{ background: form.teamColor }}
              >
                {i + 1}
              </span>
              <span className="territorial-creator__point-coords">
                {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="territorial-creator__draw-actions">
        <button
          className="btn btn--secondary btn--sm"
          onClick={onUndo}
          disabled={!points.length}
          title="Desfazer último ponto"
        >
          <IconUndo /> Desfazer
        </button>
        <button
          className="btn btn--secondary btn--sm"
          onClick={onClear}
          disabled={!points.length}
        >
          Limpar
        </button>
      </div>

      <div className="territorial-creator__actions">
        <button className="btn btn--secondary btn--sm" onClick={onBack}>← Voltar</button>
        <button
          className="btn btn--primary btn--sm"
          onClick={onNext}
          disabled={!canNext}
        >
          Revisar ({points.length})
        </button>
      </div>
    </div>
  );
}

// ── Creation: Step 3 — Review ───────────────────────────────────────────────

function CreationReviewStep({ form, points, onBack, onSaveDraft, onConfirm }) {
  return (
    <div className="territorial-creator">
      <div className="territorial-creator__header">
        <span className="territorial-creator__step-label">Passo 3 de 3</span>
      </div>
      <h3 className="territorial-creator__title">Revisar Microárea</h3>

      <div className="territorial-creator__warning">
        <IconWarning />
        <span>Revise os limites no mapa antes de confirmar.</span>
      </div>

      <div className="territorial-creator__review-rows">
        <div className="territorial-creator__review-row">
          <span className="territorial-creator__review-label">Nome</span>
          <span className="territorial-creator__review-value">{form.name}</span>
        </div>
        {form.code && (
          <div className="territorial-creator__review-row">
            <span className="territorial-creator__review-label">Código</span>
            <span className="territorial-creator__review-value">{form.code}</span>
          </div>
        )}
        {form.teamName && (
          <div className="territorial-creator__review-row">
            <span className="territorial-creator__review-label">Equipe</span>
            <span
              className="territorial-creator__review-value"
              style={{ color: form.teamColor, fontWeight: 600 }}
            >
              {form.teamName}
            </span>
          </div>
        )}
        {form.acsName && (
          <div className="territorial-creator__review-row">
            <span className="territorial-creator__review-label">ACS</span>
            <span className="territorial-creator__review-value">{form.acsName}</span>
          </div>
        )}
        <div className="territorial-creator__review-row">
          <span className="territorial-creator__review-label">Pontos</span>
          <span className="territorial-creator__review-value">{points.length} pontos</span>
        </div>
        <div className="territorial-creator__review-row">
          <span className="territorial-creator__review-label">Cor</span>
          <span
            className="territorial-creator__review-color"
            style={{ background: form.teamColor }}
          />
        </div>
        {form.notes && (
          <div className="territorial-creator__review-row territorial-creator__review-row--col">
            <span className="territorial-creator__review-label">Observações</span>
            <span className="territorial-creator__review-value">{form.notes}</span>
          </div>
        )}
      </div>

      <div className="territorial-creator__actions territorial-creator__actions--col">
        <button className="btn btn--secondary btn--sm" onClick={onBack}>
          ← Voltar e Ajustar
        </button>
        <button className="btn btn--secondary btn--sm" onClick={onSaveDraft}>
          Salvar Rascunho
        </button>
        <button className="btn btn--primary btn--sm" onClick={onConfirm}>
          Confirmar Microárea
        </button>
      </div>
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────────

function TerritorialEmptyState({ onNew }) {
  return (
    <div className="territorial-empty">
      <div className="territorial-empty__icon"><IconPin /></div>
      <h3 className="territorial-empty__title">Nenhuma microárea configurada</h3>
      <p className="territorial-empty__desc">
        Nenhuma microárea territorial foi configurada para esta unidade.
      </p>
      <button className="btn btn--primary btn--sm" onClick={onNew} style={{ marginTop: 4 }}>
        <IconPlus /> Nova Microárea
      </button>
      <div className="territorial-empty__steps">
        <p className="territorial-empty__steps-label">Para configurar:</p>
        <ol className="territorial-empty__list">
          <li>Criar microáreas (clique em Nova Microárea)</li>
          <li>Marcar pontos no mapa para definir o polígono</li>
          <li>Definir equipe e ACS responsável</li>
          <li>Confirmar após revisão</li>
        </ol>
      </div>
    </div>
  );
}

// ── Area Detail ─────────────────────────────────────────────────────────────

function AreaDetail({ area, onClose }) {
  return (
    <div className="territorial-detail">
      <div className="territorial-detail__header">
        <div
          className="territorial-detail__badge"
          style={{ background: area.teamColor + "22", borderColor: area.teamColor, color: area.teamColor }}
        >
          Microárea {area.code || "—"}
          {area.status === STATUS_DRAFT && (
            <span className="territorial-draft-pill">RASCUNHO</span>
          )}
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
        <div className="territorial-detail__row">
          <span className="territorial-detail__label">Status</span>
          <span className="territorial-detail__value">
            {area.status === STATUS_ACTIVE ? "Ativa" : "Rascunho"}
          </span>
        </div>
        {area.streets?.length > 0 && (
          <div className="territorial-detail__row territorial-detail__row--col">
            <span className="territorial-detail__label">Ruas ({area.streets.length})</span>
            <ul className="territorial-detail__streets">
              {area.streets.map((s, i) => <li key={i} className="territorial-detail__street">{s}</li>)}
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

// ── Area List Item ──────────────────────────────────────────────────────────

function AreaListItem({ area, onSelect }) {
  return (
    <button
      className={`territorial-area-item${area.status === STATUS_DRAFT ? " territorial-area-item--draft" : ""}`}
      onClick={() => onSelect(area)}
    >
      <div className="territorial-area-item__color" style={{ background: area.teamColor }} />
      <div className="territorial-area-item__body">
        <span className="territorial-area-item__name">
          {area.name}
          {area.status === STATUS_DRAFT && <span className="territorial-draft-pill">rascunho</span>}
        </span>
        <span className="territorial-area-item__meta">
          {area.teamName && <span>{area.teamName}</span>}
          {area.acsName && <span>· {area.acsName}</span>}
        </span>
      </div>
      <IconChevronRight />
    </button>
  );
}

// ── Legend ──────────────────────────────────────────────────────────────────

function MapLegend({ areas }) {
  const teams = [];
  const seen = new Set();
  for (const a of areas.filter(a => a.active)) {
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

// ── Style Toggle ────────────────────────────────────────────────────────────

function MapStyleToggle({ styleMode, onToggle }) {
  return (
    <button
      className="territorial-style-toggle"
      onClick={onToggle}
      title={styleMode === "satellite" ? "Mapa de ruas" : "Satélite"}
      aria-label={styleMode === "satellite" ? "Alternar para mapa de ruas" : "Alternar para satélite"}
    >
      {styleMode === "satellite" ? <IconMap /> : <IconSatellite />}
      <span>{styleMode === "satellite" ? "Ruas" : "Satélite"}</span>
    </button>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function TerritorialMapPage({ token }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const isDrawingRef = useRef(false);

  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [search, setSearch] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [styleMode, setStyleMode] = useState("satellite");
  const [mapError, setMapError] = useState(false);

  // Creation wizard state
  const [creationStep, setCreationStep] = useState(null); // null | "info" | "drawing" | "review"
  const [draftForm, setDraftForm] = useState(INIT_DRAFT);
  const [formErrors, setFormErrors] = useState({});
  const [drawingPoints, setDrawingPoints] = useState([]);

  // Load territorial areas
  useEffect(() => {
    getTerritorialAreas(token).then(setAreas).catch(() => setAreas([]));
  }, [token]);

  // ── Initialize MapLibre ─────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !mapContainerRef.current) return;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: DEFAULT_MAP_STYLE,
        center: DEFAULT_MAP_CENTER,
        zoom: DEFAULT_MAP_ZOOM,
        attributionControl: false,
      });

      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

      map.on("load", () => {
        if (cancelled) return;

        // ── Territorial areas (existing) ──────────────────────────────────
        map.addSource("territorial-areas", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
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

        // ── Drawing layers ────────────────────────────────────────────────
        map.addSource("drawing-polygon-draft", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "drawing-polygon-fill",
          type: "fill",
          source: "drawing-polygon-draft",
          paint: { "fill-color": ["get", "teamColor"], "fill-opacity": 0.18 },
        });
        map.addLayer({
          id: "drawing-polygon-outline",
          type: "line",
          source: "drawing-polygon-draft",
          paint: {
            "line-color": ["get", "teamColor"],
            "line-width": 2,
            "line-dasharray": [4, 3],
          },
        });

        map.addSource("drawing-line", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "drawing-line-layer",
          type: "line",
          source: "drawing-line",
          paint: { "line-color": "#64748b", "line-width": 1.5, "line-dasharray": [3, 2] },
        });

        map.addSource("drawing-points", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "drawing-points-circle",
          type: "circle",
          source: "drawing-points",
          paint: {
            "circle-radius": 6,
            "circle-color": ["get", "color"],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });

        // ── Click handlers ────────────────────────────────────────────────
        // General click: drawing mode
        map.on("click", (e) => {
          if (!isDrawingRef.current) return;
          const { lng, lat } = e.lngLat;
          setDrawingPoints(prev => [...prev, { lng, lat }]);
        });

        // Layer click: select existing area (blocked in drawing mode)
        map.on("click", "territorial-areas-fill", (e) => {
          if (isDrawingRef.current) return;
          const props = e.features?.[0]?.properties;
          if (props?.id) {
            setAreas(prev => {
              const found = prev.find(a => a.id === props.id);
              if (found) setSelectedArea(found);
              return prev;
            });
          }
        });

        map.on("mouseenter", "territorial-areas-fill", () => {
          if (!isDrawingRef.current) map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "territorial-areas-fill", () => {
          if (!isDrawingRef.current) map.getCanvas().style.cursor = "";
        });

        mapRef.current = map;
        setMapLoaded(true);
      });

      map.on("error", () => setMapError(true));
    }).catch(() => setMapError(true));

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Sync isDrawingRef ───────────────────────────────────────────────────

  useEffect(() => {
    isDrawingRef.current = creationStep === "drawing";
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = creationStep === "drawing" ? "crosshair" : "";
  }, [creationStep]);

  // ── Update territorial areas on map ────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const source = map.getSource("territorial-areas");
    if (source) source.setData(areasToGeoJSON(areas));
  }, [areas, mapLoaded]);

  // ── Update drawing layers ───────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const pts = drawingPoints;
    const color = draftForm.teamColor || TEAM_COLORS[0];

    // Points circles
    const ptSrc = map.getSource("drawing-points");
    if (ptSrc) {
      ptSrc.setData({
        type: "FeatureCollection",
        features: pts.map((p, i) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
          properties: { index: i + 1, color },
        })),
      });
    }

    // Connecting line
    const lineSrc = map.getSource("drawing-line");
    if (lineSrc) {
      if (pts.length >= 2) {
        const coords = pts.map(p => [p.lng, p.lat]);
        // Close the visual line ring if ≥ 3 points
        if (pts.length >= 3) coords.push([pts[0].lng, pts[0].lat]);
        lineSrc.setData({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords },
          properties: {},
        });
      } else {
        lineSrc.setData({ type: "FeatureCollection", features: [] });
      }
    }

    // Polygon preview
    const polySrc = map.getSource("drawing-polygon-draft");
    if (polySrc) {
      if (pts.length >= 3) {
        const coords = pts.map(p => [p.lng, p.lat]);
        coords.push([pts[0].lng, pts[0].lat]);
        polySrc.setData({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [coords] },
          properties: { teamColor: color },
        });
      } else {
        polySrc.setData({ type: "FeatureCollection", features: [] });
      }
    }
  }, [drawingPoints, draftForm.teamColor, mapLoaded]);

  // ── Clear drawing layers on exit ────────────────────────────────────────

  useEffect(() => {
    if (creationStep !== null || !mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const empty = { type: "FeatureCollection", features: [] };
    map.getSource("drawing-points")?.setData(empty);
    map.getSource("drawing-line")?.setData(empty);
    map.getSource("drawing-polygon-draft")?.setData(empty);
  }, [creationStep, mapLoaded]);

  // ── Style toggle ────────────────────────────────────────────────────────

  const handleStyleToggle = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = styleMode === "satellite" ? "street" : "satellite";
    setStyleMode(next);
    setMapLoaded(false);
    map.setStyle(MAP_STYLES[next]);
    map.once("style.load", () => {
      if (!mapRef.current) return;
      const m = mapRef.current;
      const empty = { type: "FeatureCollection", features: [] };
      const re = (id, data) => { try { m.addSource(id, { type: "geojson", data }); } catch {} };
      re("territorial-areas", areasToGeoJSON(areas));
      re("drawing-polygon-draft", empty);
      re("drawing-line", empty);
      re("drawing-points", empty);
      try {
        m.addLayer({ id: "territorial-areas-fill", type: "fill", source: "territorial-areas", paint: { "fill-color": ["get", "teamColor"], "fill-opacity": 0.2 } });
        m.addLayer({ id: "territorial-areas-outline", type: "line", source: "territorial-areas", paint: { "line-color": ["get", "teamColor"], "line-width": 2.5 } });
        m.addLayer({ id: "drawing-polygon-fill", type: "fill", source: "drawing-polygon-draft", paint: { "fill-color": ["get", "teamColor"], "fill-opacity": 0.18 } });
        m.addLayer({ id: "drawing-polygon-outline", type: "line", source: "drawing-polygon-draft", paint: { "line-color": ["get", "teamColor"], "line-width": 2, "line-dasharray": [4, 3] } });
        m.addLayer({ id: "drawing-line-layer", type: "line", source: "drawing-line", paint: { "line-color": "#64748b", "line-width": 1.5, "line-dasharray": [3, 2] } });
        m.addLayer({ id: "drawing-points-circle", type: "circle", source: "drawing-points", paint: { "circle-radius": 6, "circle-color": ["get", "color"], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
      } catch {}
      setMapLoaded(true);
    });
  };

  // ── Creation actions ────────────────────────────────────────────────────

  const handleFormChange = (key, value) => {
    setDraftForm(prev => ({ ...prev, [key]: value }));
    setFormErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const goToDrawStep = () => {
    const errs = validateDraftForm(draftForm);
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setFormErrors({});
    setCreationStep("drawing");
  };

  const undoLastPoint = () => setDrawingPoints(prev => prev.slice(0, -1));
  const clearPoints = () => setDrawingPoints([]);

  const exitCreation = () => {
    setCreationStep(null);
    setDraftForm(INIT_DRAFT);
    setFormErrors({});
    setDrawingPoints([]);
    setSelectedArea(null);
  };

  const saveDraft = () => {
    const polygon = buildPolygonGeoJSON(drawingPoints, draftForm.teamColor);
    const newArea = {
      id: `ta-draft-${Date.now()}`,
      ...draftForm,
      polygonGeoJson: polygon?.geometry || null,
      status: STATUS_DRAFT,
      active: false,
      healthUnitId: "current-unit",
      streets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAreas(prev => [...prev, newArea]);
    exitCreation();
  };

  const confirmArea = () => {
    const polygon = buildPolygonGeoJSON(drawingPoints, draftForm.teamColor);
    const newArea = {
      id: `ta-${Date.now()}`,
      ...draftForm,
      polygonGeoJson: polygon?.geometry || null,
      status: STATUS_ACTIVE,
      active: true,
      healthUnitId: "current-unit",
      streets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAreas(prev => [...prev, newArea]);
    exitCreation();
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const filteredAreas = searchAreas(areas, search);
  const hasAreas = areas.length > 0;
  const isCreating = creationStep !== null;

  return (
    <div className="territorial-page">
      {/* Header */}
      <div className="territorial-header">
        <div className="territorial-header__title">
          <h1 className="territorial-header__h1">Mapa Territorial</h1>
          <span className="territorial-header__badge">
            {hasAreas
              ? `${areas.filter(a => a.active).length} ativa${areas.filter(a => a.active).length !== 1 ? "s" : ""}${areas.filter(a => !a.active).length ? ` · ${areas.filter(a => !a.active).length} rascunho` : ""}`
              : "Sem configuração"}
          </span>
        </div>
        <div className="territorial-header__controls">
          {!isCreating && (
            <button
              className="btn btn--primary btn--sm territorial-header__new-btn"
              onClick={() => { setSelectedArea(null); setCreationStep("info"); }}
            >
              <IconPlus /> Nova Microárea
            </button>
          )}
          <MapStyleToggle styleMode={styleMode} onToggle={handleStyleToggle} />
        </div>
      </div>

      {/* Layout */}
      <div className="territorial-layout">
        {/* Map */}
        <div className="territorial-map-wrap">
          <div ref={mapContainerRef} className="territorial-map-container" />
          {isCreating && creationStep === "drawing" && (
            <div className="territorial-map-overlay-hint">
              Clique no mapa para marcar os limites
            </div>
          )}
          {mapError && (
            <div className="territorial-map-error">
              <IconPin />
              <span>Não foi possível carregar o mapa. Verifique sua conexão.</span>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="territorial-sidebar">
          {/* Creation wizard */}
          {creationStep === "info" && (
            <CreationInfoStep
              form={draftForm}
              onChange={handleFormChange}
              errors={formErrors}
              onNext={goToDrawStep}
              onCancel={exitCreation}
            />
          )}
          {creationStep === "drawing" && (
            <CreationDrawStep
              form={draftForm}
              points={drawingPoints}
              onUndo={undoLastPoint}
              onClear={clearPoints}
              onNext={() => setCreationStep("review")}
              onBack={() => setCreationStep("info")}
            />
          )}
          {creationStep === "review" && (
            <CreationReviewStep
              form={draftForm}
              points={drawingPoints}
              onBack={() => setCreationStep("drawing")}
              onSaveDraft={saveDraft}
              onConfirm={confirmArea}
            />
          )}

          {/* Normal view (not creating) */}
          {!isCreating && (
            <>
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
                    <button className="icon-btn territorial-search__clear" onClick={() => setSearch("")} aria-label="Limpar">
                      <IconClose />
                    </button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="territorial-sidebar__body">
                {selectedArea ? (
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
                  <TerritorialEmptyState onNew={() => setCreationStep("info")} />
                )}
              </div>

              {/* Legend */}
              {hasAreas && <MapLegend areas={areas} />}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
