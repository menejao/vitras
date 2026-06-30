// Copyright (c) 2026 Vitras. Todos os direitos reservados.
// TERRITORIAL-MAP-FOUNDATION-01 + TERRITORIAL-MICROAREA-AUTO-SUGGESTION-01
// + TERRITORIAL-MAP-PERSISTENCE-UBS-CENTERING-01
import { useEffect, useRef, useState, useCallback } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  getTerritorialAreas,
  getUnitLocation,
  createTerritorialArea,
  updateTerritorialArea,
  deleteTerritorialArea,
  searchAreas,
  areasToGeoJSON,
  buildPolygonGeoJSON,
  validateDraftForm,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DEFAULT_MAP_STYLE,
  UBS_MAP_ZOOM,
  TEAM_COLORS,
  INIT_DRAFT,
  STATUS_DRAFT,
  STATUS_ACTIVE,
} from "../services/territorialService";

// ── Ícones ─────────────────────────────────────────────────────────────────

const IconSearch   = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.4"/><path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
const IconClose    = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const IconPin      = () => <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5S12.5 9.5 12.5 6c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>;
const IconPlus     = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
const IconUndo     = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 6H10a4 4 0 010 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M3 3L1 6l2 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconWarning  = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M8 7v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
const IconEdit     = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>;
const IconTrash    = () => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconChevron  = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconLocation = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2" fill="currentColor"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;

// ── Color Picker ────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }) {
  return (
    <div className="territorial-color-picker" role="group" aria-label="Cor da equipe">
      {TEAM_COLORS.map(c => (
        <button key={c} type="button"
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

// ── Street Row (item na lista de ruas) ─────────────────────────────────────

function StreetRow({ street, index, onChange, onRemove }) {
  const upd = (k, v) => onChange(index, { ...street, [k]: v });
  return (
    <div className="territorial-street-row">
      <div className="input territorial-street-row__name">
        <input
          placeholder="Nome da rua"
          value={street.name || ""}
          onChange={e => upd("name", e.target.value)}
        />
      </div>
      <div className="input territorial-street-row__num">
        <input type="number" placeholder="Nº início" value={street.numberFrom || ""} onChange={e => upd("numberFrom", e.target.value)} />
      </div>
      <div className="input territorial-street-row__num">
        <input type="number" placeholder="Nº fim" value={street.numberTo || ""} onChange={e => upd("numberTo", e.target.value)} />
      </div>
      <select className="input territorial-street-row__side" value={street.side || "ambos"} onChange={e => upd("side", e.target.value)}>
        <option value="ambos">Ambos</option>
        <option value="pares">Pares</option>
        <option value="impares">Ímpares</option>
        <option value="direito">Dir.</option>
        <option value="esquerdo">Esq.</option>
      </select>
      <button className="icon-btn territorial-street-row__remove" onClick={() => onRemove(index)} aria-label="Remover rua"><IconClose /></button>
    </div>
  );
}

// ── Creation/Edit Form — Step 1: Info ──────────────────────────────────────

function CreationInfoStep({ form, onChange, errors, onNext, onCancel, isEdit }) {
  const valid = form.name.trim() && form.teamColor;
  const addStreet = () => onChange("streets", [...(form.streets || []), { name: "", numberFrom: "", numberTo: "", side: "ambos" }]);
  const updateStreet = (i, val) => { const s = [...(form.streets || [])]; s[i] = val; onChange("streets", s); };
  const removeStreet = (i) => onChange("streets", (form.streets || []).filter((_, idx) => idx !== i));

  return (
    <div className="territorial-creator">
      <div className="territorial-creator__header">
        <span className="territorial-creator__step-label">{isEdit ? "Editar Microárea" : "Passo 1 de 3"}</span>
        <button className="icon-btn" onClick={onCancel} aria-label="Cancelar"><IconClose /></button>
      </div>
      <h3 className="territorial-creator__title">{isEdit ? "Editar Microárea" : "Nova Microárea"}</h3>

      <div className="territorial-creator__form">
        <div className="field">
          <label className="field__label">Nome <span aria-hidden="true">*</span></label>
          <div className="input"><input placeholder="Ex: Microárea 001" value={form.name} onChange={e => onChange("name", e.target.value)} autoFocus /></div>
          {errors.name && <span className="field__error">{errors.name}</span>}
        </div>
        <div className="field">
          <label className="field__label">Código</label>
          <div className="input"><input placeholder="Ex: MA-001" value={form.code} onChange={e => onChange("code", e.target.value)} /></div>
        </div>
        <div className="field">
          <label className="field__label">Equipe responsável</label>
          <div className="input"><input placeholder="Ex: Equipe Azul" value={form.teamName} onChange={e => onChange("teamName", e.target.value)} /></div>
        </div>
        <div className="field">
          <label className="field__label">ACS responsável</label>
          <div className="input"><input placeholder="Ex: Maria Silva" value={form.acsName} onChange={e => onChange("acsName", e.target.value)} /></div>
        </div>
        <div className="field">
          <label className="field__label">Cor da equipe <span aria-hidden="true">*</span></label>
          <ColorPicker value={form.teamColor} onChange={c => onChange("teamColor", c)} />
          {errors.teamColor && <span className="field__error">{errors.teamColor}</span>}
        </div>
        <div className="field">
          <label className="field__label">Bairro</label>
          <div className="input"><input placeholder="Ex: Centro" value={form.neighborhood || ""} onChange={e => onChange("neighborhood", e.target.value)} /></div>
        </div>

        {/* Ruas */}
        <div className="field">
          <label className="field__label">Ruas da microárea</label>
          <div className="territorial-streets-list">
            {(form.streets || []).map((s, i) => (
              <StreetRow key={i} street={s} index={i} onChange={updateStreet} onRemove={removeStreet} />
            ))}
          </div>
          <button className="btn btn--secondary btn--sm territorial-add-street" type="button" onClick={addStreet}>
            <IconPlus /> Adicionar rua
          </button>
        </div>

        <div className="field">
          <label className="field__label">Observações</label>
          <textarea className="input" rows={2} placeholder="Observações..." value={form.notes || ""} onChange={e => onChange("notes", e.target.value)} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} />
        </div>
      </div>

      <div className="territorial-creator__actions">
        <button className="btn btn--secondary btn--sm" onClick={onCancel}>Cancelar</button>
        <button className="btn btn--primary btn--sm" onClick={onNext} disabled={!valid}>
          {isEdit ? "Revisar →" : "Marcar no Mapa →"}
        </button>
      </div>
    </div>
  );
}

// ── Creation — Step 2: Drawing ──────────────────────────────────────────────

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
        <div className="territorial-creator__hint-dot" style={{ background: form.teamColor }} />
        <span>
          {points.length === 0
            ? "Clique no mapa para adicionar pontos."
            : points.length < 3
            ? `${3 - points.length} ponto(s) para fechar o polígono.`
            : `${points.length} pontos — polígono pronto.`}
        </span>
      </div>
      {points.length > 0 && (
        <div className="territorial-creator__points-list">
          {points.map((p, i) => (
            <div key={i} className="territorial-creator__point-item">
              <span className="territorial-creator__point-num" style={{ background: form.teamColor }}>{i + 1}</span>
              <span className="territorial-creator__point-coords">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="territorial-creator__draw-actions">
        <button className="btn btn--secondary btn--sm" onClick={onUndo} disabled={!points.length}><IconUndo /> Desfazer</button>
        <button className="btn btn--secondary btn--sm" onClick={onClear} disabled={!points.length}>Limpar</button>
      </div>
      <div className="territorial-creator__actions">
        <button className="btn btn--secondary btn--sm" onClick={onBack}>← Voltar</button>
        <button className="btn btn--primary btn--sm" onClick={onNext} disabled={!canNext}>Revisar ({points.length})</button>
      </div>
    </div>
  );
}

// ── Creation/Edit — Step 3: Review ─────────────────────────────────────────

function CreationReviewStep({ form, points, isEdit, onBack, onSaveDraft, onConfirm, saving }) {
  return (
    <div className="territorial-creator">
      <div className="territorial-creator__header">
        <span className="territorial-creator__step-label">{isEdit ? "Revisar Edição" : "Passo 3 de 3"}</span>
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
        {form.code && <div className="territorial-creator__review-row"><span className="territorial-creator__review-label">Código</span><span className="territorial-creator__review-value">{form.code}</span></div>}
        {form.teamName && <div className="territorial-creator__review-row"><span className="territorial-creator__review-label">Equipe</span><span className="territorial-creator__review-value" style={{ color: form.teamColor, fontWeight: 600 }}>{form.teamName}</span></div>}
        {form.acsName && <div className="territorial-creator__review-row"><span className="territorial-creator__review-label">ACS</span><span className="territorial-creator__review-value">{form.acsName}</span></div>}
        {form.neighborhood && <div className="territorial-creator__review-row"><span className="territorial-creator__review-label">Bairro</span><span className="territorial-creator__review-value">{form.neighborhood}</span></div>}
        {form.streets?.length > 0 && (
          <div className="territorial-creator__review-row territorial-creator__review-row--col">
            <span className="territorial-creator__review-label">Ruas ({form.streets.length})</span>
            <div className="territorial-creator__review-streets">
              {form.streets.filter(s => s.name).map((s, i) => (
                <span key={i} className="territorial-creator__review-street">
                  {s.name}{s.numberFrom ? ` ${s.numberFrom}–${s.numberTo || "?"}` : ""}{s.side !== "ambos" ? ` (${s.side})` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="territorial-creator__review-row">
          <span className="territorial-creator__review-label">Pontos</span>
          <span className="territorial-creator__review-value">{points.length} pontos no mapa</span>
        </div>
        <div className="territorial-creator__review-row">
          <span className="territorial-creator__review-label">Cor</span>
          <span className="territorial-creator__review-color" style={{ background: form.teamColor }} />
        </div>
      </div>
      <div className="territorial-creator__actions territorial-creator__actions--col">
        <button className="btn btn--secondary btn--sm" onClick={onBack} disabled={saving}>← Voltar e Ajustar</button>
        <button className="btn btn--secondary btn--sm" onClick={onSaveDraft} disabled={saving}>
          {saving ? "Salvando…" : "Salvar Rascunho"}
        </button>
        <button className="btn btn--primary btn--sm" onClick={onConfirm} disabled={saving}>
          {saving ? "Salvando…" : isEdit ? "Confirmar Edição" : "Confirmar Microárea"}
        </button>
      </div>
    </div>
  );
}

// ── Delete Confirmation ─────────────────────────────────────────────────────

function DeleteConfirm({ area, onCancel, onConfirm, saving }) {
  return (
    <div className="territorial-creator">
      <div className="territorial-creator__header">
        <span className="territorial-creator__step-label">Excluir Microárea</span>
        <button className="icon-btn" onClick={onCancel} aria-label="Cancelar"><IconClose /></button>
      </div>
      <div className="territorial-creator__warning">
        <IconWarning />
        <span>Esta ação não pode ser desfeita.</span>
      </div>
      <div className="territorial-creator__review-rows">
        <div className="territorial-creator__review-row">
          <span className="territorial-creator__review-label">Microárea</span>
          <span className="territorial-creator__review-value">{area.name}</span>
        </div>
        {area.teamName && <div className="territorial-creator__review-row">
          <span className="territorial-creator__review-label">Equipe</span>
          <span className="territorial-creator__review-value">{area.teamName}</span>
        </div>}
      </div>
      <div className="territorial-creator__actions">
        <button className="btn btn--secondary btn--sm" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button className="btn btn--danger btn--sm" onClick={onConfirm} disabled={saving}>
          {saving ? "Excluindo…" : "Excluir"}
        </button>
      </div>
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────────

function TerritorialEmptyState({ onNew, ubsMissing }) {
  return (
    <div className="territorial-empty">
      <div className="territorial-empty__icon"><IconPin /></div>
      <h3 className="territorial-empty__title">Nenhuma microárea configurada</h3>
      {ubsMissing && (
        <div className="territorial-creator__warning" style={{ width: "100%", boxSizing: "border-box" }}>
          <IconLocation />
          <span>Esta UBS não possui localização configurada. Configure no Console Nacional.</span>
        </div>
      )}
      <p className="territorial-empty__desc">Nenhuma microárea territorial foi configurada para esta unidade.</p>
      <button className="btn btn--primary btn--sm" onClick={onNew} style={{ marginTop: 4 }}>
        <IconPlus /> Nova Microárea
      </button>
      <div className="territorial-empty__steps">
        <p className="territorial-empty__steps-label">Para configurar:</p>
        <ol className="territorial-empty__list">
          <li>Clique em Nova Microárea</li>
          <li>Preencha nome, equipe e cor</li>
          <li>Informe ruas e numeração (opcional)</li>
          <li>Marque os limites no mapa</li>
          <li>Revise e confirme</li>
        </ol>
      </div>
    </div>
  );
}

// ── Area Detail ─────────────────────────────────────────────────────────────

function AreaDetail({ area, onClose, onEdit, onDelete }) {
  return (
    <div className="territorial-detail">
      <div className="territorial-detail__header">
        <div className="territorial-detail__badge"
          style={{ background: area.teamColor + "22", borderColor: area.teamColor, color: area.teamColor }}>
          {area.code ? `Microárea ${area.code}` : "Microárea"}
          {area.status === STATUS_DRAFT && <span className="territorial-draft-pill">RASCUNHO</span>}
        </div>
        <div className="territorial-detail__actions-row">
          <button className="btn btn--secondary btn--sm btn--icon-only" onClick={onEdit} title="Editar"><IconEdit /></button>
          <button className="btn btn--danger btn--sm btn--icon-only" onClick={onDelete} title="Excluir"><IconTrash /></button>
          <button className="icon-btn territorial-detail__close" onClick={onClose} aria-label="Fechar"><IconClose /></button>
        </div>
      </div>
      <h3 className="territorial-detail__name">{area.name}</h3>
      <div className="territorial-detail__rows">
        {area.teamName && <div className="territorial-detail__row"><span className="territorial-detail__label">Equipe</span><span className="territorial-detail__value" style={{ color: area.teamColor }}>{area.teamName}</span></div>}
        {area.acsName  && <div className="territorial-detail__row"><span className="territorial-detail__label">ACS</span><span className="territorial-detail__value">{area.acsName}</span></div>}
        {area.neighborhood && <div className="territorial-detail__row"><span className="territorial-detail__label">Bairro</span><span className="territorial-detail__value">{area.neighborhood}</span></div>}
        <div className="territorial-detail__row">
          <span className="territorial-detail__label">Status</span>
          <span className="territorial-detail__value">{area.status === STATUS_ACTIVE ? "Ativa" : "Rascunho"}</span>
        </div>
        {area.streets?.filter(s => s.name).length > 0 && (
          <div className="territorial-detail__row territorial-detail__row--col">
            <span className="territorial-detail__label">Ruas ({area.streets.filter(s => s.name).length})</span>
            <ul className="territorial-detail__streets">
              {area.streets.filter(s => s.name).map((s, i) => (
                <li key={i} className="territorial-detail__street">
                  {s.name}{s.numberFrom ? ` ${s.numberFrom}–${s.numberTo || "?"}` : ""}{s.side && s.side !== "ambos" ? ` (${s.side})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        {area.notes && <div className="territorial-detail__row territorial-detail__row--col"><span className="territorial-detail__label">Observações</span><span className="territorial-detail__value">{area.notes}</span></div>}
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
          {area.acsName  && <span>· {area.acsName}</span>}
          {area.neighborhood && <span>· {area.neighborhood}</span>}
        </span>
      </div>
      <IconChevron />
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

// ── Main Page ───────────────────────────────────────────────────────────────

export default function TerritorialMapPage({ token }) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const isDrawingRef    = useRef(false);

  const [areas,         setAreas]         = useState([]);
  const [unitLocation,  setUnitLocation]  = useState(null);
  const [selectedArea,  setSelectedArea]  = useState(null);
  const [search,        setSearch]        = useState("");
  const [mapLoaded,     setMapLoaded]     = useState(false);
  const [mapError,      setMapError]      = useState(false);
  const [loadError,     setLoadError]     = useState(null);
  const [saving,        setSaving]        = useState(false);

  // Creation/edit state machine
  // mode: null | "create" | "edit" | "delete"
  // step: "info" | "drawing" | "review"
  const [mode,         setMode]         = useState(null);
  const [editingId,    setEditingId]    = useState(null);
  const [creationStep, setCreationStep] = useState("info");
  const [draftForm,    setDraftForm]    = useState({ ...INIT_DRAFT });
  const [formErrors,   setFormErrors]   = useState({});
  const [drawingPoints,setDrawingPoints]= useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const isCreating = mode !== null;

  // ── Load areas + unit location ──────────────────────────────────────────

  const loadAreas = useCallback(async () => {
    try {
      const [data, unit] = await Promise.all([
        getTerritorialAreas(token),
        getUnitLocation(token),
      ]);
      setAreas(data || []);
      setUnitLocation(unit);
    } catch (e) {
      setLoadError(e?.message || "Erro ao carregar áreas territoriais");
    }
  }, [token]);

  useEffect(() => { loadAreas(); }, [loadAreas]);

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

        // ── Territorial area layers ───────────────────────────────────────
        map.addSource("territorial-areas", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "territorial-areas-fill", type: "fill", source: "territorial-areas", paint: { "fill-color": ["get", "teamColor"], "fill-opacity": 0.2 } });
        map.addLayer({ id: "territorial-areas-outline", type: "line", source: "territorial-areas", paint: { "line-color": ["get", "teamColor"], "line-width": 2.5, "line-opacity": 0.85 } });

        // ── Drawing layers ────────────────────────────────────────────────
        map.addSource("drawing-polygon-draft", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "drawing-polygon-fill", type: "fill", source: "drawing-polygon-draft", paint: { "fill-color": ["get", "teamColor"], "fill-opacity": 0.18 } });
        map.addLayer({ id: "drawing-polygon-outline", type: "line", source: "drawing-polygon-draft", paint: { "line-color": ["get", "teamColor"], "line-width": 2, "line-dasharray": [4, 3] } });

        map.addSource("drawing-line", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "drawing-line-layer", type: "line", source: "drawing-line", paint: { "line-color": "#64748b", "line-width": 1.5, "line-dasharray": [3, 2] } });

        map.addSource("drawing-points", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "drawing-points-circle", type: "circle", source: "drawing-points", paint: { "circle-radius": 6, "circle-color": ["get", "color"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });

        // ── Click handlers ────────────────────────────────────────────────
        map.on("click", (e) => {
          if (!isDrawingRef.current) return;
          const { lng, lat } = e.lngLat;
          setDrawingPoints(prev => [...prev, { lng, lat }]);
        });

        map.on("click", "territorial-areas-fill", (e) => {
          if (isDrawingRef.current) return;
          const id = e.features?.[0]?.properties?.id;
          if (id) setAreas(prev => { const found = prev.find(a => a.id === id); if (found) setSelectedArea(found); return prev; });
        });

        map.on("mouseenter", "territorial-areas-fill", () => { if (!isDrawingRef.current) map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "territorial-areas-fill", () => { if (!isDrawingRef.current) map.getCanvas().style.cursor = ""; });

        mapRef.current = map;
        setMapLoaded(true);
      });

      map.on("error", () => setMapError(true));
    }).catch(() => setMapError(true));

    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // ── Center map on UBS when location loads ───────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !unitLocation || unitLocation.lat == null || unitLocation.lng == null) return;
    mapRef.current?.flyTo({ center: [unitLocation.lng, unitLocation.lat], zoom: UBS_MAP_ZOOM, duration: 1200 });
  }, [unitLocation, mapLoaded]);

  // ── Sync isDrawingRef ───────────────────────────────────────────────────

  useEffect(() => {
    isDrawingRef.current = creationStep === "drawing" && mode !== null;
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = isDrawingRef.current ? "crosshair" : "";
  }, [creationStep, mode]);

  // ── Update territorial areas on map ────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.getSource("territorial-areas")?.setData(areasToGeoJSON(areas));
  }, [areas, mapLoaded]);

  // ── Update drawing layers ───────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const pts   = drawingPoints;
    const color = draftForm.teamColor || TEAM_COLORS[0];

    map.getSource("drawing-points")?.setData({
      type: "FeatureCollection",
      features: pts.map((p, i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { index: i + 1, color },
      })),
    });

    const lineCoords = pts.map(p => [p.lng, p.lat]);
    if (pts.length >= 3) lineCoords.push([pts[0].lng, pts[0].lat]);
    map.getSource("drawing-line")?.setData(
      pts.length >= 2
        ? { type: "Feature", geometry: { type: "LineString", coordinates: lineCoords }, properties: {} }
        : { type: "FeatureCollection", features: [] }
    );

    if (pts.length >= 3) {
      const coords = pts.map(p => [p.lng, p.lat]);
      coords.push([pts[0].lng, pts[0].lat]);
      map.getSource("drawing-polygon-draft")?.setData({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [coords] },
        properties: { teamColor: color },
      });
    } else {
      map.getSource("drawing-polygon-draft")?.setData({ type: "FeatureCollection", features: [] });
    }
  }, [drawingPoints, draftForm.teamColor, mapLoaded]);

  // ── Clear drawing layers on exit ────────────────────────────────────────

  useEffect(() => {
    if (mode !== null || !mapLoaded || !mapRef.current) return;
    const empty = { type: "FeatureCollection", features: [] };
    ["drawing-points", "drawing-line", "drawing-polygon-draft"].forEach(id => {
      mapRef.current.getSource(id)?.setData(empty);
    });
  }, [mode, mapLoaded]);

  // ── Zoom to selected area ───────────────────────────────────────────────

  useEffect(() => {
    if (!selectedArea || !mapLoaded || !mapRef.current) return;
    const geo = selectedArea.polygonGeoJson?.geometry || selectedArea.polygonGeoJson;
    if (!geo?.coordinates) return;
    // Compute bounds from polygon
    let minLng =  180, maxLng = -180, minLat =  90, maxLat = -90;
    const ring = geo.coordinates[0] || [];
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    if (minLng < maxLng && minLat < maxLat) {
      mapRef.current.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 800 });
    }
  }, [selectedArea, mapLoaded]);

  // ── Form handlers ───────────────────────────────────────────────────────

  const handleFormChange = (key, value) => {
    setDraftForm(prev => ({ ...prev, [key]: value }));
    setFormErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const exitCreation = () => {
    setMode(null);
    setEditingId(null);
    setCreationStep("info");
    setDraftForm({ ...INIT_DRAFT });
    setFormErrors({});
    setDrawingPoints([]);
    setDeleteTarget(null);
  };

  const startCreate = () => {
    setSelectedArea(null);
    setMode("create");
    setCreationStep("info");
    setDraftForm({ ...INIT_DRAFT });
    setFormErrors({});
    setDrawingPoints([]);
  };

  const startEdit = (area) => {
    setMode("edit");
    setEditingId(area.id);
    setCreationStep("info");
    setDraftForm({
      name: area.name || "",
      code: area.code || "",
      teamName: area.teamName || "",
      acsName: area.acsName || "",
      teamColor: area.teamColor || TEAM_COLORS[0],
      neighborhood: area.neighborhood || "",
      notes: area.notes || "",
      streets: area.streets || [],
    });
    setFormErrors({});
    // Preload existing points from polygon
    const geo = area.polygonGeoJson?.geometry || area.polygonGeoJson;
    if (geo?.coordinates?.[0]) {
      const ring = geo.coordinates[0];
      // Remove closing point
      const pts = ring.slice(0, ring.length - 1).map(([lng, lat]) => ({ lng, lat }));
      setDrawingPoints(pts);
    } else {
      setDrawingPoints([]);
    }
    setSelectedArea(null);
  };

  const startDelete = (area) => {
    setMode("delete");
    setDeleteTarget(area);
  };

  const goToDrawStep = () => {
    const errs = validateDraftForm(draftForm);
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setFormErrors({});
    setCreationStep("drawing");
  };

  // ── Persist actions ─────────────────────────────────────────────────────

  const persistArea = async (status) => {
    const polygon = buildPolygonGeoJSON(drawingPoints, draftForm.teamColor);
    const payload = {
      ...draftForm,
      polygonGeoJson: polygon?.geometry || null,
      status,
    };
    setSaving(true);
    try {
      if (mode === "edit" && editingId) {
        const updated = await updateTerritorialArea(token, editingId, payload);
        setAreas(prev => prev.map(a => a.id === editingId ? updated : a));
      } else {
        const created = await createTerritorialArea(token, payload);
        setAreas(prev => [...prev, created]);
      }
      exitCreation();
    } catch (e) {
      alert(e?.message || "Erro ao salvar microárea");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteTerritorialArea(token, deleteTarget.id);
      setAreas(prev => prev.filter(a => a.id !== deleteTarget.id));
      setSelectedArea(null);
      exitCreation();
    } catch (e) {
      alert(e?.message || "Erro ao excluir microárea");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const filteredAreas = searchAreas(areas, search);
  const hasAreas      = areas.length > 0;
  const ubsMissing    = unitLocation && unitLocation.lat == null;

  return (
    <div className="territorial-page">
      {/* Header */}
      <div className="territorial-header">
        <div className="territorial-header__title">
          <h1 className="territorial-header__h1">Mapa Territorial</h1>
          <span className="territorial-header__badge">
            {hasAreas
              ? `${areas.filter(a => a.active).length} ativa${areas.filter(a => a.active).length !== 1 ? "s" : ""}${areas.filter(a => !a.active).length ? ` · ${areas.filter(a => !a.active).length} rascunho` : ""}`
              : "Sem microáreas"}
          </span>
        </div>
        <div className="territorial-header__controls">
          {!isCreating && (
            <button className="btn btn--primary btn--sm territorial-header__new-btn" onClick={startCreate}>
              <IconPlus /> Nova Microárea
            </button>
          )}
        </div>
      </div>

      {/* Layout */}
      <div className="territorial-layout">
        {/* Map */}
        <div className="territorial-map-wrap">
          <div ref={mapContainerRef} className="territorial-map-container" />
          {isCreating && creationStep === "drawing" && (
            <div className="territorial-map-overlay-hint">Clique no mapa para marcar os limites</div>
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
          {mode === "delete" && deleteTarget && (
            <DeleteConfirm area={deleteTarget} onCancel={exitCreation} onConfirm={handleDeleteConfirm} saving={saving} />
          )}
          {(mode === "create" || mode === "edit") && creationStep === "info" && (
            <CreationInfoStep form={draftForm} onChange={handleFormChange} errors={formErrors} onNext={goToDrawStep} onCancel={exitCreation} isEdit={mode === "edit"} />
          )}
          {(mode === "create" || mode === "edit") && creationStep === "drawing" && (
            <CreationDrawStep form={draftForm} points={drawingPoints}
              onUndo={() => setDrawingPoints(prev => prev.slice(0, -1))}
              onClear={() => setDrawingPoints([])}
              onNext={() => setCreationStep("review")}
              onBack={() => setCreationStep("info")}
            />
          )}
          {(mode === "create" || mode === "edit") && creationStep === "review" && (
            <CreationReviewStep form={draftForm} points={drawingPoints} isEdit={mode === "edit"}
              onBack={() => setCreationStep("drawing")}
              onSaveDraft={() => persistArea("draft")}
              onConfirm={() => persistArea("active")}
              saving={saving}
            />
          )}

          {/* Normal view */}
          {!isCreating && (
            <>
              <div className="territorial-search">
                <div className="input territorial-search__input">
                  <IconSearch />
                  <input type="search" placeholder="Buscar microárea, rua, bairro, equipe, ACS…"
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="territorial-search__field" aria-label="Buscar território" />
                  {search && <button className="icon-btn territorial-search__clear" onClick={() => setSearch("")} aria-label="Limpar"><IconClose /></button>}
                </div>
              </div>

              {loadError && (
                <div className="territorial-creator__warning" style={{ margin: "12px" }}>
                  <IconWarning /><span>{loadError}</span>
                </div>
              )}

              <div className="territorial-sidebar__body">
                {selectedArea ? (
                  <AreaDetail area={selectedArea} onClose={() => setSelectedArea(null)}
                    onEdit={() => startEdit(selectedArea)}
                    onDelete={() => startDelete(selectedArea)}
                  />
                ) : hasAreas ? (
                  filteredAreas.length > 0
                    ? <div className="territorial-area-list">{filteredAreas.map(a => <AreaListItem key={a.id} area={a} onSelect={setSelectedArea} />)}</div>
                    : <div className="territorial-no-results"><p>Nenhum resultado para <strong>"{search}"</strong></p></div>
                ) : (
                  <TerritorialEmptyState onNew={startCreate} ubsMissing={ubsMissing} />
                )}
              </div>

              {hasAreas && <MapLegend areas={areas} />}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
