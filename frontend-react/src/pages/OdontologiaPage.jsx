import { useState, useMemo, useEffect, useCallback } from "react";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Avatar from "../components/ui/Avatar";
import {
  getOdontogramChart,
  patchOdontogramTooth,
  createOdontoProcedure,
  patchOdontoProcedure,
  deleteOdontoProcedure,
} from "../api";
import { matchesPatientSearch } from "../utils/clinical";
import { fmtDate, initials } from "../utils/formatting";
import { hasCapability } from "../utils/roles";

const PAGE_SIZE = 20;

// ── FDI layout ────────────────────────────────────────────────────────────────
const UPPER_RIGHT  = ["18","17","16","15","14","13","12","11"];
const UPPER_LEFT   = ["21","22","23","24","25","26","27","28"];
const LOWER_RIGHT  = ["48","47","46","45","44","43","42","41"];
const LOWER_LEFT   = ["31","32","33","34","35","36","37","38"];
const DEC_UPPER_R  = ["55","54","53","52","51"];
const DEC_UPPER_L  = ["61","62","63","64","65"];
const DEC_LOWER_R  = ["85","84","83","82","81"];
const DEC_LOWER_L  = ["71","72","73","74","75"];

// ── Conditions ────────────────────────────────────────────────────────────────
const CONDITIONS = [
  { value: "higido",    label: "Hígido",          color: "transparent" },
  { value: "carie",     label: "Cárie",            color: "#ef4444" },
  { value: "restauracao",label:"Restauração",      color: "#3b82f6" },
  { value: "fratura",   label: "Fratura",          color: "#f97316" },
  { value: "ausente",   label: "Ausente",          color: "#94a3b8" },
  { value: "extraido",  label: "Extraído",         color: "#64748b" },
  { value: "implante",  label: "Implante",         color: "#10b981" },
  { value: "coroa",     label: "Coroa",            color: "#f59e0b" },
  { value: "canal",     label: "Canal tratado",    color: "#8b5cf6" },
  { value: "protese",   label: "Prótese",          color: "#6d28d9" },
  { value: "selante",   label: "Selante",          color: "#14b8a6" },
  { value: "lesao",     label: "Lesão",            color: "#991b1b" },
];

const CONDITION_COLOR = Object.fromEntries(CONDITIONS.map(c => [c.value, c.color]));

const PROC_TYPES = [
  { value: "restauracao",  label: "Restauração" },
  { value: "exodontia",    label: "Exodontia" },
  { value: "profilaxia",   label: "Profilaxia" },
  { value: "fluor",        label: "Aplicação de flúor" },
  { value: "endodontia",   label: "Endodontia (canal)" },
  { value: "raspagem",     label: "Raspagem" },
  { value: "protese",      label: "Prótese" },
  { value: "cimentacao",   label: "Cimentação" },
  { value: "implante",     label: "Implante" },
  { value: "selante",      label: "Selante" },
  { value: "outro",        label: "Outro" },
];

const PROC_STATUS = [
  { value: "planejado",    label: "Planejado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido",    label: "Concluído" },
  { value: "cancelado",    label: "Cancelado" },
];

const FACES = [
  { key: "vestibular", label: "Vestibular" },
  { key: "lingual",    label: "Lingual/Palatina" },
  { key: "mesial",     label: "Mesial" },
  { key: "distal",     label: "Distal" },
  { key: "oclusal",    label: "Oclusal/Incisal" },
];

const STATUS_COLORS = {
  planejado:    { bg: "#eff6ff", text: "#1d4ed8" },
  em_andamento: { bg: "#fef9c3", text: "#854d0e" },
  concluido:    { bg: "#f0fdf4", text: "#166534" },
  cancelado:    { bg: "#f1f5f9", text: "#64748b" },
};

// ── Tooth SVG component ───────────────────────────────────────────────────────
function ToothSVG({ fdi, toothData, isSelected, onClick }) {
  const condition = toothData?.condition || "higido";
  const faces = toothData?.faces || {};
  const isAbsent = condition === "ausente" || condition === "extraido";

  const toothColor = CONDITION_COLOR[condition];
  const borderColor = isSelected
    ? "var(--teal-6, #0d9488)"
    : isAbsent
    ? "#94a3b8"
    : toothColor !== "transparent"
    ? toothColor
    : "#e2e8f0";

  const bg = isAbsent ? "#f8fafc" : "#fff";

  function fc(face) {
    const c = CONDITION_COLOR[faces[face]];
    return c && c !== "transparent" ? c : "transparent";
  }

  return (
    <button
      type="button"
      className="odonto-tooth"
      onClick={() => onClick(fdi)}
      title={`Dente ${fdi}`}
      aria-label={`Dente ${fdi}${condition !== "higido" ? ` — ${condition}` : ""}`}
      style={{ outline: isSelected ? `2px solid var(--teal-6, #0d9488)` : "none", outlineOffset: 2 }}
    >
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" style={{ display: "block" }}>
        <rect x="0.5" y="0.5" width="39" height="39" rx="4" fill={bg} stroke={borderColor} strokeWidth={isSelected ? 2 : 1} />
        {/* Vestibular — top triangle */}
        <polygon points="0,0 40,0 30,10 10,10" fill={fc("vestibular")} stroke="#e2e8f0" strokeWidth="0.5" />
        {/* Lingual — bottom triangle */}
        <polygon points="0,40 40,40 30,30 10,30" fill={fc("lingual")} stroke="#e2e8f0" strokeWidth="0.5" />
        {/* Mesial — left triangle */}
        <polygon points="0,0 0,40 10,30 10,10" fill={fc("mesial")} stroke="#e2e8f0" strokeWidth="0.5" />
        {/* Distal — right triangle */}
        <polygon points="40,0 40,40 30,30 30,10" fill={fc("distal")} stroke="#e2e8f0" strokeWidth="0.5" />
        {/* Oclusal — center square */}
        <rect x="10" y="10" width="20" height="20" fill={fc("oclusal")} stroke="#e2e8f0" strokeWidth="0.5" />
        {/* Absent/extracted X */}
        {isAbsent && (
          <>
            <line x1="9" y1="9" x2="31" y2="31" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="31" y1="9" x2="9" y2="31" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
        {/* Tooth-level condition fill overlay (center square) when no face data but has condition */}
        {!isAbsent && toothColor !== "transparent" && !Object.values(faces).some(Boolean) && (
          <rect x="10" y="10" width="20" height="20" fill={toothColor} opacity="0.35" />
        )}
        {/* Implant / crown symbol */}
        {condition === "implante" && (
          <text x="20" y="24" textAnchor="middle" fontSize="10" fill="#10b981" fontWeight="700">I</text>
        )}
        {condition === "coroa" && (
          <text x="20" y="24" textAnchor="middle" fontSize="9" fill="#f59e0b" fontWeight="700">C</text>
        )}
        {condition === "canal" && (
          <text x="20" y="24" textAnchor="middle" fontSize="9" fill="#8b5cf6" fontWeight="700">E</text>
        )}
      </svg>
      <div className="odonto-tooth__fdi">{fdi}</div>
    </button>
  );
}

// ── Face selector visual ──────────────────────────────────────────────────────
function FaceSelector({ faces, selectedFace, onFaceClick }) {
  function fc(face) {
    const c = CONDITION_COLOR[faces[face]];
    return c && c !== "transparent" ? c : "transparent";
  }
  const size = 80;
  const t = 20; // triangle depth

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ cursor: "pointer", flexShrink: 0 }}
      aria-label="Selecionar face"
    >
      {/* Vestibular */}
      <polygon
        points={`0,0 ${size},0 ${size-t},${t} ${t},${t}`}
        fill={selectedFace === "vestibular" ? "#ccfbf1" : (fc("vestibular") || "#f8fafc")}
        stroke={selectedFace === "vestibular" ? "#0d9488" : "#cbd5e1"}
        strokeWidth={selectedFace === "vestibular" ? 1.5 : 0.8}
        onClick={() => onFaceClick("vestibular")}
        style={{ cursor: "pointer" }}
      />
      {/* Lingual */}
      <polygon
        points={`0,${size} ${size},${size} ${size-t},${size-t} ${t},${size-t}`}
        fill={selectedFace === "lingual" ? "#ccfbf1" : (fc("lingual") || "#f8fafc")}
        stroke={selectedFace === "lingual" ? "#0d9488" : "#cbd5e1"}
        strokeWidth={selectedFace === "lingual" ? 1.5 : 0.8}
        onClick={() => onFaceClick("lingual")}
        style={{ cursor: "pointer" }}
      />
      {/* Mesial */}
      <polygon
        points={`0,0 0,${size} ${t},${size-t} ${t},${t}`}
        fill={selectedFace === "mesial" ? "#ccfbf1" : (fc("mesial") || "#f8fafc")}
        stroke={selectedFace === "mesial" ? "#0d9488" : "#cbd5e1"}
        strokeWidth={selectedFace === "mesial" ? 1.5 : 0.8}
        onClick={() => onFaceClick("mesial")}
        style={{ cursor: "pointer" }}
      />
      {/* Distal */}
      <polygon
        points={`${size},0 ${size},${size} ${size-t},${size-t} ${size-t},${t}`}
        fill={selectedFace === "distal" ? "#ccfbf1" : (fc("distal") || "#f8fafc")}
        stroke={selectedFace === "distal" ? "#0d9488" : "#cbd5e1"}
        strokeWidth={selectedFace === "distal" ? 1.5 : 0.8}
        onClick={() => onFaceClick("distal")}
        style={{ cursor: "pointer" }}
      />
      {/* Oclusal/center */}
      <rect
        x={t} y={t} width={size - 2*t} height={size - 2*t}
        fill={selectedFace === "oclusal" ? "#ccfbf1" : (fc("oclusal") || "#f8fafc")}
        stroke={selectedFace === "oclusal" ? "#0d9488" : "#cbd5e1"}
        strokeWidth={selectedFace === "oclusal" ? 1.5 : 0.8}
        onClick={() => onFaceClick("oclusal")}
        style={{ cursor: "pointer" }}
      />
      {/* Labels */}
      <text x={size/2} y={10} textAnchor="middle" fontSize="7" fill="#64748b">V</text>
      <text x={size/2} y={size-3} textAnchor="middle" fontSize="7" fill="#64748b">L</text>
      <text x={6} y={size/2+3} textAnchor="middle" fontSize="7" fill="#64748b">M</text>
      <text x={size-6} y={size/2+3} textAnchor="middle" fontSize="7" fill="#64748b">D</text>
      <text x={size/2} y={size/2+3} textAnchor="middle" fontSize="7" fill="#64748b">O</text>
    </svg>
  );
}

// ── Odontogram chart ──────────────────────────────────────────────────────────
function OdontogramChart({ teeth, onToothClick, selectedFdi }) {
  const [showDeciduous, setShowDeciduous] = useState(false);

  function renderRow(fdis) {
    return fdis.map(fdi => (
      <ToothSVG
        key={fdi}
        fdi={fdi}
        toothData={teeth[fdi]}
        isSelected={selectedFdi === fdi}
        onClick={onToothClick}
      />
    ));
  }

  return (
    <div className="odonto-chart">
      <div className="odonto-chart__dentition-toggle">
        <button
          type="button"
          className={`odonto-toggle-btn${!showDeciduous ? " odonto-toggle-btn--active" : ""}`}
          onClick={() => setShowDeciduous(false)}
        >
          Permanente
        </button>
        <button
          type="button"
          className={`odonto-toggle-btn${showDeciduous ? " odonto-toggle-btn--active" : ""}`}
          onClick={() => setShowDeciduous(true)}
        >
          Decídua
        </button>
      </div>

      <div className="odonto-chart__label">Superior</div>
      <div className="odonto-chart__arch">
        <div className="odonto-chart__half">
          {renderRow(showDeciduous ? DEC_UPPER_R : UPPER_RIGHT)}
        </div>
        <div className="odonto-chart__midline" aria-hidden="true" />
        <div className="odonto-chart__half odonto-chart__half--mirror">
          {renderRow(showDeciduous ? DEC_UPPER_L : UPPER_LEFT)}
        </div>
      </div>

      <div className="odonto-chart__gap" aria-hidden="true" />

      <div className="odonto-chart__arch">
        <div className="odonto-chart__half">
          {renderRow(showDeciduous ? DEC_LOWER_R : LOWER_RIGHT)}
        </div>
        <div className="odonto-chart__midline" aria-hidden="true" />
        <div className="odonto-chart__half odonto-chart__half--mirror">
          {renderRow(showDeciduous ? DEC_LOWER_L : LOWER_LEFT)}
        </div>
      </div>
      <div className="odonto-chart__label">Inferior</div>

      <div className="odonto-legend">
        {CONDITIONS.map(c => (
          <div key={c.value} className="odonto-legend__item">
            <span
              className="odonto-legend__swatch"
              style={{
                background: c.color !== "transparent" ? c.color : "#f8fafc",
                border: c.color === "transparent" ? "1px solid #e2e8f0" : "none",
              }}
            />
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tooth detail panel ────────────────────────────────────────────────────────
function ToothPanel({ fdi, toothData, procedures, patientId, token, canWrite, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState("condicao");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedFace, setSelectedFace] = useState(null);

  // Condition state — mirrors current toothData
  const [condition, setCondition] = useState(toothData?.condition || "higido");
  const [faceConditions, setFaceConditions] = useState(toothData?.faces || {});
  const [notes, setNotes] = useState(toothData?.notes || "");
  const [condSaved, setCondSaved] = useState(false);

  // Procedure form
  const [procForm, setProcForm] = useState({
    type: "restauracao", face: "", date: new Date().toISOString().slice(0, 10),
    status: "planejado", notes: "",
  });
  const [procBusy, setProcBusy] = useState(false);
  const [procSuccess, setProcSuccess] = useState(false);

  // Sync when tooth changes
  useEffect(() => {
    setCondition(toothData?.condition || "higido");
    setFaceConditions(toothData?.faces || {});
    setNotes(toothData?.notes || "");
    setCondSaved(false);
    setError("");
  }, [fdi, toothData]);

  async function saveCondition() {
    setSaving(true); setError(""); setCondSaved(false);
    try {
      await patchOdontogramTooth(token, patientId, fdi, {
        condition,
        faces: faceConditions,
        notes,
      });
      setCondSaved(true);
      onUpdate?.();
    } catch (e) {
      setError(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function saveProcedure(e) {
    e.preventDefault();
    setProcBusy(true); setError("");
    try {
      await createOdontoProcedure(token, {
        patientId,
        toothFdi: fdi,
        face: procForm.face || null,
        type: procForm.type,
        date: procForm.date,
        status: procForm.status,
        notes: procForm.notes || null,
      });
      setProcSuccess(true);
      setProcForm({ type: "restauracao", face: "", date: new Date().toISOString().slice(0, 10), status: "planejado", notes: "" });
      onUpdate?.();
    } catch (e) {
      setError(e.message || "Erro ao salvar");
    } finally {
      setProcBusy(false);
    }
  }

  async function changeStatus(procId, newStatus) {
    try {
      await patchOdontoProcedure(token, procId, { status: newStatus });
      onUpdate?.();
    } catch (e) {
      setError(e.message || "Erro ao atualizar");
    }
  }

  async function removeProc(procId) {
    try {
      await deleteOdontoProcedure(token, procId);
      onUpdate?.();
    } catch (e) {
      setError(e.message || "Erro ao remover");
    }
  }

  const toothProcs = procedures.filter(p => p.toothFdi === fdi);
  const toothName = getToothName(fdi);

  function setFaceCondition(face, cond) {
    setFaceConditions(s => ({ ...s, [face]: cond }));
    setCondSaved(false);
  }

  return (
    <div className="odonto-panel">
      <div className="odonto-panel__header">
        <div>
          <div className="odonto-panel__fdi">Dente {fdi}</div>
          <div className="odonto-panel__name">{toothName}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Fechar">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </Button>
      </div>

      <div className="odonto-panel__tabs">
        {["condicao","procedimento","historico"].map(t => (
          <button
            key={t}
            type="button"
            className={`odonto-panel__tab${activeTab === t ? " odonto-panel__tab--active" : ""}`}
            onClick={() => { setActiveTab(t); setError(""); }}
          >
            {t === "condicao" ? "Condição" : t === "procedimento" ? "Procedimento" : "Histórico"}
          </button>
        ))}
      </div>

      <div className="odonto-panel__body">
        {error && (
          <div className="error" style={{ padding: ".5rem .75rem", borderRadius: "var(--r-md)", marginBottom: "var(--s-3)", fontSize: ".8rem" }}>
            {error}
          </div>
        )}

        {/* Condição tab */}
        {activeTab === "condicao" && (
          <div className="odonto-panel__section">
            {condSaved && (
              <div style={{ padding: ".5rem .75rem", borderRadius: "var(--r-md)", background: "#f0fdf4", color: "#166534", fontSize: ".8rem", marginBottom: "var(--s-3)", display: "flex", alignItems: "center", gap: ".5rem" }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Condição salva.
              </div>
            )}

            <div style={{ marginBottom: "var(--s-3)" }}>
              <label className="field__label">Condição geral do dente</label>
              <div className="odonto-cond-grid">
                {CONDITIONS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    className={`odonto-cond-btn${condition === c.value ? " odonto-cond-btn--active" : ""}`}
                    style={{
                      "--cond-color": c.color !== "transparent" ? c.color : "#e2e8f0",
                    }}
                    onClick={() => { setCondition(c.value); setCondSaved(false); }}
                    disabled={!canWrite}
                  >
                    <span className="odonto-cond-btn__dot" />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "var(--s-3)" }}>
              <label className="field__label" style={{ marginBottom: "var(--s-2)", display: "block" }}>Condição por face</label>
              <div className="odonto-face-section">
                <FaceSelector
                  faces={faceConditions}
                  selectedFace={selectedFace}
                  onFaceClick={canWrite ? (face) => setSelectedFace(selectedFace === face ? null : face) : () => {}}
                />
                {selectedFace && (
                  <div className="odonto-face-cond">
                    <div style={{ fontSize: ".75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "var(--s-1)" }}>
                      {FACES.find(f => f.key === selectedFace)?.label}
                    </div>
                    <div className="odonto-cond-grid odonto-cond-grid--sm">
                      {CONDITIONS.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          className={`odonto-cond-btn odonto-cond-btn--sm${faceConditions[selectedFace] === c.value ? " odonto-cond-btn--active" : ""}`}
                          style={{ "--cond-color": c.color !== "transparent" ? c.color : "#e2e8f0" }}
                          onClick={() => setFaceCondition(selectedFace, c.value)}
                        >
                          <span className="odonto-cond-btn__dot" />
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!selectedFace && (
                  <div style={{ fontSize: ".78rem", color: "var(--text-3)", alignSelf: "center" }}>
                    Clique numa face para selecionar.
                  </div>
                )}
              </div>
            </div>

            <div className="field" style={{ marginBottom: "var(--s-3)" }}>
              <label className="field__label">Observações</label>
              <textarea
                className="input"
                rows={2}
                value={notes}
                onChange={e => { setNotes(e.target.value); setCondSaved(false); }}
                placeholder="Observações clínicas..."
                disabled={!canWrite}
                style={{ resize: "vertical" }}
              />
            </div>

            {canWrite && (
              <Button type="button" variant="primary" size="sm" loading={saving} onClick={saveCondition}>
                Salvar condição
              </Button>
            )}
          </div>
        )}

        {/* Procedimento tab */}
        {activeTab === "procedimento" && (
          <div className="odonto-panel__section">
            {canWrite && (
              <>
                {procSuccess && (
                  <div style={{ padding: ".5rem .75rem", borderRadius: "var(--r-md)", background: "#f0fdf4", color: "#166534", fontSize: ".8rem", marginBottom: "var(--s-3)", display: "flex", alignItems: "center", gap: ".5rem" }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Procedimento registrado.
                    <Button type="button" variant="ghost" size="sm" onClick={() => setProcSuccess(false)} style={{ marginLeft: "auto", padding: "0 4px" }}>+ Novo</Button>
                  </div>
                )}
                {!procSuccess && (
                  <form onSubmit={saveProcedure} className="field-grid" style={{ marginBottom: "var(--s-4)" }}>
                    <Select label="Tipo" value={procForm.type} onChange={e => setProcForm(s => ({ ...s, type: e.target.value }))}>
                      {PROC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </Select>
                    <Select label="Face" value={procForm.face} onChange={e => setProcForm(s => ({ ...s, face: e.target.value }))}>
                      <option value="">Geral</option>
                      {FACES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </Select>
                    <Input label="Data" type="date" value={procForm.date} max={new Date().toISOString().slice(0, 10)} onChange={e => setProcForm(s => ({ ...s, date: e.target.value }))} />
                    <Select label="Status" value={procForm.status} onChange={e => setProcForm(s => ({ ...s, status: e.target.value }))}>
                      {PROC_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </Select>
                    <div className="field" style={{ gridColumn: "span 2" }}>
                      <label className="field__label">Observações</label>
                      <textarea className="input" rows={2} value={procForm.notes} onChange={e => setProcForm(s => ({ ...s, notes: e.target.value }))} style={{ resize: "vertical" }} />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <Button type="submit" variant="primary" size="sm" loading={procBusy}>Registrar procedimento</Button>
                    </div>
                  </form>
                )}
              </>
            )}

            {toothProcs.length === 0 ? (
              <div style={{ fontSize: ".8rem", color: "var(--text-3)", padding: "var(--s-2) 0" }}>
                Nenhum procedimento registrado para o dente {fdi}.
              </div>
            ) : (
              <div className="odonto-proc-list">
                {toothProcs.map(p => {
                  const sc = STATUS_COLORS[p.status] || {};
                  return (
                    <div key={p.id} className="odonto-proc-item">
                      <div className="odonto-proc-item__top">
                        <span className="odonto-proc-item__type">
                          {PROC_TYPES.find(t => t.value === p.type)?.label || p.type}
                          {p.face && ` — ${FACES.find(f => f.key === p.face)?.label || p.face}`}
                        </span>
                        <span className="odonto-proc-item__status" style={{ background: sc.bg, color: sc.text }}>
                          {PROC_STATUS.find(s => s.value === p.status)?.label || p.status}
                        </span>
                      </div>
                      <div className="odonto-proc-item__meta">
                        {p.date ? fmtDate(p.date) : "—"}
                        {p.professionalName ? ` · ${p.professionalName}` : ""}
                      </div>
                      {p.notes && <div className="odonto-proc-item__notes">{p.notes}</div>}
                      {canWrite && (
                        <div className="odonto-proc-item__actions">
                          {p.status !== "concluido" && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => changeStatus(p.id, "concluido")}>
                              Concluir
                            </Button>
                          )}
                          {p.status !== "cancelado" && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeProc(p.id)}>
                              Remover
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Histórico tab */}
        {activeTab === "historico" && (
          <div className="odonto-panel__section">
            {toothProcs.length === 0 ? (
              <div style={{ fontSize: ".8rem", color: "var(--text-3)" }}>
                Nenhum histórico para o dente {fdi}.
              </div>
            ) : (
              <div className="odonto-proc-list">
                {[...toothProcs].sort((a, b) => b.date?.localeCompare(a.date || "") || 0).map(p => {
                  const sc = STATUS_COLORS[p.status] || {};
                  return (
                    <div key={p.id} className="odonto-proc-item">
                      <div className="odonto-proc-item__top">
                        <span className="odonto-proc-item__type">
                          {PROC_TYPES.find(t => t.value === p.type)?.label || p.type}
                        </span>
                        <span className="odonto-proc-item__status" style={{ background: sc.bg, color: sc.text }}>
                          {PROC_STATUS.find(s => s.value === p.status)?.label || p.status}
                        </span>
                      </div>
                      <div className="odonto-proc-item__meta">
                        {p.date ? fmtDate(p.date) : "—"}
                        {p.face ? ` — ${FACES.find(f => f.key === p.face)?.label || p.face}` : ""}
                        {p.professionalName ? ` · ${p.professionalName}` : ""}
                      </div>
                      {p.notes && <div className="odonto-proc-item__notes">{p.notes}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// FDI tooth name lookup
function getToothName(fdi) {
  const n = parseInt(fdi, 10);
  const quadrant = Math.floor(n / 10);
  const num = n % 10;
  const side = [1,4].includes(quadrant) ? "direito" : "esquerdo";
  const arch = [1,2,5,6].includes(quadrant) ? "superior" : "inferior";
  const isPerm = n >= 11 && n <= 48;
  const isDec = (n >= 51 && n <= 55) || (n >= 61 && n <= 65) || (n >= 71 && n <= 75) || (n >= 81 && n <= 85);

  const toothTypes = {
    1: "Incisivo central", 2: "Incisivo lateral", 3: "Canino",
    4: "1º Pré-molar", 5: "2º Pré-molar",
    6: "1º Molar", 7: "2º Molar", 8: "3º Molar (siso)",
  };
  const decTypes = {
    1: "Incisivo central", 2: "Incisivo lateral", 3: "Canino",
    4: "1º Molar", 5: "2º Molar",
  };

  const type = isDec ? decTypes[num] : toothTypes[num];
  const dentition = isDec ? " (decíduo)" : "";
  return type ? `${type} ${arch} ${side}${dentition}` : `Dente ${fdi}`;
}

// ── Workspace odontograma tab ─────────────────────────────────────────────────
function WorkspaceOdontograma({ patient, token, canWrite }) {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFdi, setSelectedFdi] = useState(null);

  const loadChart = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await getOdontogramChart(token, patient.id);
      setChartData(res.data);
    } catch (e) {
      setError(e.message || "Erro ao carregar odontograma");
    } finally {
      setLoading(false);
    }
  }, [token, patient.id]);

  useEffect(() => { loadChart(); }, [loadChart]);

  const teeth = chartData?.odontogram?.teeth || {};
  const procedures = chartData?.procedures || [];

  const selectedToothData = selectedFdi ? teeth[selectedFdi] : null;
  const selectedToothProcs = selectedFdi ? procedures.filter(p => p.toothFdi === selectedFdi) : [];

  if (loading) {
    return (
      <div style={{ padding: "var(--s-6)", textAlign: "center", color: "var(--text-3)", fontSize: ".85rem" }}>
        Carregando odontograma...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "var(--s-4)" }}>
        <div className="error" style={{ padding: ".75rem 1rem", borderRadius: "var(--r-md)", marginBottom: "var(--s-3)" }}>{error}</div>
        <Button type="button" variant="secondary" size="sm" onClick={loadChart}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="odonto-workspace">
      <div className="odonto-workspace__chart">
        <OdontogramChart
          teeth={teeth}
          onToothClick={fdi => setSelectedFdi(fdi === selectedFdi ? null : fdi)}
          selectedFdi={selectedFdi}
        />
      </div>

      {selectedFdi && (
        <div className="odonto-workspace__panel">
          <ToothPanel
            fdi={selectedFdi}
            toothData={selectedToothData}
            procedures={procedures}
            patientId={patient.id}
            token={token}
            canWrite={canWrite}
            onClose={() => setSelectedFdi(null)}
            onUpdate={loadChart}
          />
        </div>
      )}
    </div>
  );
}

// ── Resume tab ────────────────────────────────────────────────────────────────
function WorkspaceResumo({ patient, history }) {
  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate + "T12:00:00").getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;
  const dentalHistory = Array.isArray(history)
    ? history.filter(r => r.metadata?.consultKind === "odontologia")
    : null;
  const lastVisit = dentalHistory?.[0];

  return (
    <div className="specialty-panel__form" style={{ display: "block" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)", marginBottom: "var(--s-4)" }}>
        <div className="card" style={{ padding: "var(--s-3)" }}>
          <div style={{ fontSize: ".7rem", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "var(--s-1)" }}>Idade</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{age !== null ? `${age} anos` : "—"}</div>
        </div>
        <div className="card" style={{ padding: "var(--s-3)" }}>
          <div style={{ fontSize: ".7rem", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "var(--s-1)" }}>Última consulta odonto</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{lastVisit ? fmtDate(lastVisit.date) : "—"}</div>
        </div>
        <div className="card" style={{ padding: "var(--s-3)", gridColumn: "span 2" }}>
          <div style={{ fontSize: ".7rem", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "var(--s-1)" }}>Total de atendimentos odontológicos</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{dentalHistory !== null ? dentalHistory.length : "—"}</div>
        </div>
      </div>
      {patient.chronicConditions?.length > 0 && (
        <div>
          <div style={{ fontSize: ".7rem", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "var(--s-1)" }}>Condições crônicas</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem" }}>
            {patient.chronicConditions.map(c => (
              <span key={c} style={{ fontSize: ".75rem", padding: "2px 8px", borderRadius: "var(--r-full)", background: "var(--teal-1)", color: "var(--teal-7)", fontWeight: 600 }}>{c}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Procedimentos tab ─────────────────────────────────────────────────────────
function WorkspaceProcedimentos({ patient, user, token, onSaved }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), dente: "", procedimento: "", material: "", observacoes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  function upd(k) { return v => setForm(s => ({ ...s, [k]: v })); }
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.procedimento) { setError("Procedimento obrigatório."); return; }
    setBusy(true); setError("");
    try {
      const { createRecord } = await import("../api");
      const details = [
        form.dente ? `Dente/região: ${form.dente}` : "",
        `Procedimento: ${form.procedimento}`,
        form.material ? `Material: ${form.material}` : "",
        form.observacoes ? `Obs: ${form.observacoes}` : "",
      ].filter(Boolean).join("\n");
      await createRecord(token, patient.id, {
        date: form.date, time: new Date().toTimeString().slice(0, 5),
        type: "consultation", title: `Procedimento odontológico${form.dente ? ` — Dente ${form.dente}` : ""}`,
        details, professionalName: user?.name || "", professionalCouncil: "",
        immutable: true, metadata: { consultKind: "odontologia", subtype: "procedimento", dente: form.dente || null },
      });
      setSuccess(true);
      setForm({ date: new Date().toISOString().slice(0, 10), dente: "", procedimento: "", material: "", observacoes: "" });
      onSaved?.();
    } catch (err) { setError(err.message || "Erro ao registrar procedimento."); }
    finally { setBusy(false); }
  }
  if (success) return (
    <div style={{ padding: "var(--s-4)" }}>
      <div className="specialty-panel__success">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Procedimento registrado.
        <Button type="button" variant="ghost" size="sm" onClick={() => setSuccess(false)} style={{ marginLeft: "auto" }}>+ Novo</Button>
      </div>
    </div>
  );
  return (
    <form className="specialty-panel__form field-grid" style={{ padding: "var(--s-4)" }} onSubmit={handleSubmit}>
      <Input label="Data" type="date" value={form.date} max={new Date().toISOString().slice(0, 10)} onChange={e => upd("date")(e.target.value)} />
      <Input label="Dente / região" value={form.dente} onChange={e => upd("dente")(e.target.value)} placeholder="ex: 16, 21–22..." />
      <div className="field" style={{ gridColumn: "span 2" }}>
        <label className="field__label">Procedimento *</label>
        <textarea className="input" rows={2} value={form.procedimento} onChange={e => upd("procedimento")(e.target.value)} style={{ resize: "vertical" }} required />
      </div>
      <Input label="Material utilizado" value={form.material} onChange={e => upd("material")(e.target.value)} placeholder="Resina, amálgama..." />
      <div className="field"><label className="field__label">Observações</label><textarea className="input" rows={2} value={form.observacoes} onChange={e => upd("observacoes")(e.target.value)} style={{ resize: "vertical" }} /></div>
      {error && <div className="error" style={{ gridColumn: "span 2", padding: ".5rem .75rem", borderRadius: "var(--r-md)" }}>{error}</div>}
      <div style={{ gridColumn: "span 2" }}><Button type="submit" variant="primary" loading={busy}>Registrar procedimento</Button></div>
    </form>
  );
}

// ── Evolução tab ──────────────────────────────────────────────────────────────
function WorkspaceEvolucao({ patient, user, token, onSaved }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), evolucao: "", conduta: "", proximo: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  function upd(k) { return v => setForm(s => ({ ...s, [k]: v })); }
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.evolucao) { setError("Evolução obrigatória."); return; }
    setBusy(true); setError("");
    try {
      const { createRecord } = await import("../api");
      const details = [`Evolução: ${form.evolucao}`, form.conduta ? `Conduta: ${form.conduta}` : "", form.proximo ? `Próximo passo: ${form.proximo}` : ""].filter(Boolean).join("\n");
      await createRecord(token, patient.id, {
        date: form.date, time: new Date().toTimeString().slice(0, 5),
        type: "consultation", title: "Evolução odontológica",
        details, professionalName: user?.name || "", professionalCouncil: "",
        immutable: true, metadata: { consultKind: "odontologia", subtype: "evolucao" },
      });
      setSuccess(true);
      setForm({ date: new Date().toISOString().slice(0, 10), evolucao: "", conduta: "", proximo: "" });
      onSaved?.();
    } catch (err) { setError(err.message || "Erro."); }
    finally { setBusy(false); }
  }
  if (success) return (
    <div style={{ padding: "var(--s-4)" }}>
      <div className="specialty-panel__success">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Evolução registrada.
        <Button type="button" variant="ghost" size="sm" onClick={() => setSuccess(false)} style={{ marginLeft: "auto" }}>+ Nova</Button>
      </div>
    </div>
  );
  return (
    <form className="specialty-panel__form field-grid" style={{ padding: "var(--s-4)" }} onSubmit={handleSubmit}>
      <Input label="Data" type="date" value={form.date} max={new Date().toISOString().slice(0, 10)} onChange={e => upd("date")(e.target.value)} />
      <div />
      <div className="field" style={{ gridColumn: "span 2" }}><label className="field__label">Evolução *</label><textarea className="input" rows={3} value={form.evolucao} onChange={e => upd("evolucao")(e.target.value)} style={{ resize: "vertical" }} required /></div>
      <div className="field" style={{ gridColumn: "span 2" }}><label className="field__label">Conduta</label><textarea className="input" rows={2} value={form.conduta} onChange={e => upd("conduta")(e.target.value)} style={{ resize: "vertical" }} /></div>
      <div className="field" style={{ gridColumn: "span 2" }}><label className="field__label">Próximo passo</label><textarea className="input" rows={2} value={form.proximo} onChange={e => upd("proximo")(e.target.value)} style={{ resize: "vertical" }} /></div>
      {error && <div className="error" style={{ gridColumn: "span 2", padding: ".5rem .75rem", borderRadius: "var(--r-md)" }}>{error}</div>}
      <div style={{ gridColumn: "span 2" }}><Button type="submit" variant="primary" loading={busy}>Registrar evolução</Button></div>
    </form>
  );
}

// ── Plano de Tratamento tab ───────────────────────────────────────────────────
function WorkspacePlano({ patient, user, token, onSaved }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), objetivo: "", etapas: "", prioridade: "media", previsao: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  function upd(k) { return v => setForm(s => ({ ...s, [k]: v })); }
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.objetivo) { setError("Objetivo obrigatório."); return; }
    setBusy(true); setError("");
    try {
      const { createRecord } = await import("../api");
      const details = [`Objetivo: ${form.objetivo}`, form.etapas ? `Etapas: ${form.etapas}` : "", `Prioridade: ${form.prioridade}`, form.previsao ? `Previsão: ${form.previsao}` : ""].filter(Boolean).join("\n");
      await createRecord(token, patient.id, {
        date: form.date, time: new Date().toTimeString().slice(0, 5),
        type: "consultation", title: "Plano de tratamento odontológico",
        details, professionalName: user?.name || "", professionalCouncil: "",
        immutable: true, metadata: { consultKind: "odontologia", subtype: "plano_tratamento" },
      });
      setSuccess(true);
      setForm({ date: new Date().toISOString().slice(0, 10), objetivo: "", etapas: "", prioridade: "media", previsao: "" });
      onSaved?.();
    } catch (err) { setError(err.message || "Erro."); }
    finally { setBusy(false); }
  }
  if (success) return (
    <div style={{ padding: "var(--s-4)" }}>
      <div className="specialty-panel__success">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Plano registrado.
        <Button type="button" variant="ghost" size="sm" onClick={() => setSuccess(false)} style={{ marginLeft: "auto" }}>+ Novo</Button>
      </div>
    </div>
  );
  return (
    <form className="specialty-panel__form field-grid" style={{ padding: "var(--s-4)" }} onSubmit={handleSubmit}>
      <Input label="Data" type="date" value={form.date} max={new Date().toISOString().slice(0, 10)} onChange={e => upd("date")(e.target.value)} />
      <Select label="Prioridade" value={form.prioridade} onChange={e => upd("prioridade")(e.target.value)}>
        <option value="alta">Alta</option>
        <option value="media">Média</option>
        <option value="baixa">Baixa</option>
      </Select>
      <div className="field" style={{ gridColumn: "span 2" }}><label className="field__label">Objetivo *</label><textarea className="input" rows={2} value={form.objetivo} onChange={e => upd("objetivo")(e.target.value)} style={{ resize: "vertical" }} required /></div>
      <div className="field" style={{ gridColumn: "span 2" }}><label className="field__label">Etapas planejadas</label><textarea className="input" rows={3} value={form.etapas} onChange={e => upd("etapas")(e.target.value)} style={{ resize: "vertical" }} /></div>
      <Input label="Previsão de conclusão" type="date" value={form.previsao} onChange={e => upd("previsao")(e.target.value)} />
      {error && <div className="error" style={{ gridColumn: "span 2", padding: ".5rem .75rem", borderRadius: "var(--r-md)" }}>{error}</div>}
      <div style={{ gridColumn: "span 2" }}><Button type="submit" variant="primary" loading={busy}>Salvar plano</Button></div>
    </form>
  );
}

// ── Histórico tab ─────────────────────────────────────────────────────────────
function WorkspaceHistorico({ history }) {
  if (history === null) return <div style={{ padding: "var(--s-4)", color: "var(--text-3)", fontSize: ".85rem" }}>Carregando...</div>;
  const dh = history.filter(r => r.metadata?.consultKind === "odontologia");
  if (!dh.length) return (
    <div className="empty" style={{ padding: "var(--s-6)" }}>
      <div className="empty__icon" style={{ opacity: 0.2 }}>
        <svg width="32" height="32" viewBox="0 0 16 16" fill="none"><path d="M3 2h10v12H3z" stroke="currentColor" strokeWidth="1.4"/><path d="M6 6h5M6 8.5h5M6 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
      </div>
      <div className="empty__title">Sem histórico odontológico</div>
      <div className="empty__desc">Registros de procedimentos, evoluções e planos aparecerão aqui.</div>
    </div>
  );
  return (
    <div style={{ padding: "var(--s-3)" }}>
      {dh.map(h => (
        <div key={h.id} className="specialty-panel__hist-item">
          <span className="specialty-panel__hist-date">{fmtDate(h.date)}</span>
          <span className="specialty-panel__hist-title">{h.title}</span>
          {h.metadata?.subtype && (
            <span style={{ fontSize: ".7rem", padding: "1px 7px", borderRadius: "var(--r-full)", background: "var(--teal-1)", color: "var(--teal-7)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>
              {h.metadata.subtype === "procedimento" ? "Proc" : h.metadata.subtype === "evolucao" ? "Evol" : h.metadata.subtype === "plano_tratamento" ? "Plano" : h.metadata.subtype}
            </span>
          )}
          {h.professionalName && <span className="specialty-panel__hist-prof">{h.professionalName}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Workspace tabs ────────────────────────────────────────────────────────────
const WORKSPACE_TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "odontograma", label: "Odontograma" },
  { id: "procedimentos", label: "Procedimentos" },
  { id: "evolucao", label: "Evolução" },
  { id: "plano", label: "Plano de Tratamento" },
  { id: "historico", label: "Histórico" },
];

function DentalWorkspacePanel({ patient, user, token, onClose }) {
  const [activeTab, setActiveTab] = useState("odontograma");
  const [history, setHistory] = useState(null);
  const canWrite = hasCapability(user, "dental.write") || hasCapability(user, "dental.admin");

  useEffect(() => {
    import("../api").then(({ getPatientHistory }) =>
      getPatientHistory(token, patient.id)
        .then(h => setHistory(Array.isArray(h) ? h : []))
        .catch(() => setHistory([]))
    );
  }, [patient.id, token]);

  function onSaved() { setHistory(null); import("../api").then(({ getPatientHistory }) => getPatientHistory(token, patient.id).then(h => setHistory(Array.isArray(h) ? h : [])).catch(() => setHistory([]))); }

  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate + "T12:00:00").getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <div className="specialty-panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="specialty-panel__header">
        <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
          <div className="specialty-panel__avatar">{initials(patient.name)}</div>
          <div>
            <div className="specialty-panel__name">{patient.name}</div>
            <div className="specialty-panel__meta">
              {age !== null ? `${age} anos` : ""}
              {patient.cpf ? " · CPF ***" : ""}
            </div>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Fechar">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </Button>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 var(--s-3)", gap: ".25rem", flexShrink: 0, overflowX: "auto" }}>
        {WORKSPACE_TABS.map(t => {
          const blocked = !canWrite && ["procedimentos","evolucao","plano"].includes(t.id);
          if (blocked) return null;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "var(--s-2) var(--s-2)",
                fontSize: ".78rem", fontWeight: activeTab === t.id ? 700 : 500,
                color: activeTab === t.id ? "var(--teal-6)" : "var(--text-2)",
                borderBottom: activeTab === t.id ? "2px solid var(--teal-6)" : "2px solid transparent",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === "resumo" && <WorkspaceResumo patient={patient} history={history} />}
        {activeTab === "odontograma" && <WorkspaceOdontograma patient={patient} token={token} canWrite={canWrite} />}
        {activeTab === "procedimentos" && canWrite && <WorkspaceProcedimentos patient={patient} user={user} token={token} onSaved={onSaved} />}
        {activeTab === "evolucao" && canWrite && <WorkspaceEvolucao patient={patient} user={user} token={token} onSaved={onSaved} />}
        {activeTab === "plano" && canWrite && <WorkspacePlano patient={patient} user={user} token={token} onSaved={onSaved} />}
        {activeTab === "historico" && <WorkspaceHistorico history={history} />}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const DENTAL_ICON = (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5.5c-1.5-2-4-2.5-5.5-1C4.5 6 4 8 5 10.5c.7 1.8 1.5 5.5 2.5 7 .5 1 1.5 1 2 0 .3-.6.5-1.5.5-3 0-1.5 1-2 2-2s2 .5 2 2c0 1.5.2 2.4.5 3 .5 1 1.5 1 2 0 1-1.5 1.8-5.2 2.5-7 1-2.5.5-4.5-1.5-6-1.5-1.5-4-1-5.5 1z"/>
  </svg>
);

export default function OdontologiaPage({ patients, user, token }) {
  const canRead = hasCapability(user, "dental.read") || hasCapability(user, "dental.write") || hasCapability(user, "dental.admin");

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const filtered = useMemo(() => {
    const base = !query.trim() ? patients : patients.filter(p => matchesPatientSearch(p, query));
    return [...base].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  }, [patients, query]);

  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (!canRead) {
    return (
      <div style={{ padding: "3rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
        <div style={{ opacity: 0.2, marginBottom: "1rem" }}>{DENTAL_ICON}</div>
        <p style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text)", marginBottom: ".5rem" }}>Acesso restrito</p>
        <p style={{ fontSize: ".9rem" }}>Apenas dentistas e perfis autorizados podem acessar o módulo odontológico.</p>
      </div>
    );
  }

  return (
    <div className="vaccines-page">
      <PageHeader
        eyebrow="ATENDIMENTO ODONTOLÓGICO"
        title="Odontologia"
        subtitle={`${filtered.length} paciente${filtered.length !== 1 ? "s" : ""} cadastrado${filtered.length !== 1 ? "s" : ""}`}
      />

      <div className="vaccines-layout">
        <div className="vacc-panel">
          <div className="card card--noPad overflow-hidden">
            <div className="vacc-panel__search">
              <Input
                value={query}
                onChange={e => { setQuery(e.target.value); setPage(0); }}
                placeholder="Buscar paciente..."
              />
            </div>
            <div className="vacc-panel__list">
              {paged.length === 0 ? (
                <p className="vacc-panel__empty">Nenhum paciente encontrado.</p>
              ) : paged.map(p => {
                const am = p.birthDate
                  ? Math.round((Date.now() - new Date(p.birthDate + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24 * 30.44))
                  : null;
                const isActive = selectedPatient?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`vacc-pat${isActive ? " is-active" : ""}`}
                    onClick={() => setSelectedPatient(isActive ? null : p)}
                  >
                    <Avatar name={p.name} size="sm" />
                    <div className="vacc-pat__copy">
                      <div className="vacc-pat__name">{p.name}</div>
                      <div className="vacc-pat__meta">
                        {am !== null && (
                          <span className="vacc-pat__age">{am < 24 ? `${am}m` : `${Math.floor(am / 12)}a`}</span>
                        )}
                      </div>
                    </div>
                    <svg className="vacc-pat__chevron" width="11" height="11" viewBox="0 0 16 16" fill="none">
                      <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: ".5rem", padding: "var(--s-2) var(--s-3)", borderTop: "1px solid var(--border)" }}>
                <Button type="button" variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</Button>
                <span style={{ fontSize: ".75rem", color: "var(--text-dim)" }}>{page + 1} / {totalPages}</span>
                <Button type="button" variant="secondary" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</Button>
              </div>
            )}
          </div>
        </div>

        <div className="vacc-main">
          {selectedPatient ? (
            <div className="card card--noPad overflow-hidden" style={{ height: "100%" }}>
              <DentalWorkspacePanel
                patient={selectedPatient}
                user={user}
                token={token}
                onClose={() => setSelectedPatient(null)}
              />
            </div>
          ) : (
            <div className="vacc-empty">
              <div className="vacc-empty__icon" style={{ opacity: .2 }}>{DENTAL_ICON}</div>
              <p className="vacc-empty__label">Selecione um paciente para iniciar o atendimento odontológico.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
