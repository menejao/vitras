import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQueue } from "../hooks/useQueue";
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
  getDentalEncounters,
  createDentalEncounter,
  patchDentalEncounter,
  getOdontoPlanItems,
  createOdontoPlanItem,
  patchOdontoPlanItem,
  deleteOdontoPlanItem,
} from "../api";
import { matchesPatientSearch } from "../utils/clinical";
import { printPrescription } from "../utils/printDoc";
import { fmtDate, initials } from "../utils/formatting";
import { hasCapability } from "../utils/roles";

const PAGE_SIZE = 20;

// ── Auto-grow textarea ────────────────────────────────────────────────────────
function AutoTextarea({ value, onChange, minRows = 2, maxRows = 8, className = "", style = {}, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lh = parseInt(getComputedStyle(el).lineHeight) || 20;
    const pad = 16;
    const min = minRows * lh + pad;
    const max = maxRows * lh + pad;
    el.style.height = Math.min(max, Math.max(min, el.scrollHeight)) + "px";
  }, [value, minRows, maxRows]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      className={`input${className ? " " + className : ""}`}
      style={{ resize: "none", overflow: "auto", ...style }}
      {...props}
    />
  );
}

// ── Catálogo de procedimentos odontológicos (APS/SUS) ────────────────────────
export const ODONTO_CATALOG = [
  // Diagnóstico
  { code: "DIA01", name: "Consulta odontológica inicial", category: "Diagnóstico", needsTooth: false, needsFace: false, needsObs: false },
  { code: "DIA02", name: "Avaliação odontológica de retorno", category: "Diagnóstico", needsTooth: false, needsFace: false, needsObs: false },
  { code: "DIA03", name: "Levantamento epidemiológico bucal", category: "Diagnóstico", needsTooth: false, needsFace: false, needsObs: true },
  // Prevenção
  { code: "PRV01", name: "Orientação de higiene bucal", category: "Prevenção", needsTooth: false, needsFace: false, needsObs: false },
  { code: "PRV02", name: "Profilaxia (limpeza dental profissional)", category: "Prevenção", needsTooth: false, needsFace: false, needsObs: false },
  { code: "PRV03", name: "Aplicação tópica de flúor", category: "Prevenção", needsTooth: false, needsFace: false, needsObs: false },
  { code: "PRV04", name: "Selante de fóssulas e fissuras", category: "Prevenção", needsTooth: true, needsFace: false, needsObs: false },
  { code: "PRV05", name: "Evidenciação de placa bacteriana", category: "Prevenção", needsTooth: false, needsFace: false, needsObs: false },
  // Periodontia
  { code: "PER01", name: "Raspagem supragengival (por arcada)", category: "Periodontia", needsTooth: false, needsFace: false, needsObs: false },
  { code: "PER02", name: "Raspagem subgengival (por sextante)", category: "Periodontia", needsTooth: false, needsFace: false, needsObs: true },
  { code: "PER03", name: "Polimento coronário", category: "Periodontia", needsTooth: false, needsFace: false, needsObs: false },
  { code: "PER04", name: "Orientação de controle de placa", category: "Periodontia", needsTooth: false, needsFace: false, needsObs: false },
  // Dentística / Restauração
  { code: "RST01", name: "Restauração (resina composta)", category: "Dentística", needsTooth: true, needsFace: true, needsObs: false },
  { code: "RST02", name: "Restauração (amálgama)", category: "Dentística", needsTooth: true, needsFace: true, needsObs: false },
  { code: "RST03", name: "Restauração (cimento ionômero)", category: "Dentística", needsTooth: true, needsFace: false, needsObs: false },
  { code: "RST04", name: "Tratamento restaurador atraumático (ART)", category: "Dentística", needsTooth: true, needsFace: true, needsObs: false },
  { code: "RST05", name: "Remoção de restauração", category: "Dentística", needsTooth: true, needsFace: false, needsObs: false },
  // Endodontia
  { code: "END01", name: "Pulpotomia", category: "Endodontia", needsTooth: true, needsFace: false, needsObs: false },
  { code: "END02", name: "Tratamento de canal — 1 raiz", category: "Endodontia", needsTooth: true, needsFace: false, needsObs: false },
  { code: "END03", name: "Tratamento de canal — 2 raízes", category: "Endodontia", needsTooth: true, needsFace: false, needsObs: false },
  { code: "END04", name: "Tratamento de canal — 3+ raízes", category: "Endodontia", needsTooth: true, needsFace: false, needsObs: false },
  { code: "END05", name: "Curativo de demora em endodontia", category: "Endodontia", needsTooth: true, needsFace: false, needsObs: true },
  { code: "END06", name: "Obturação de canal radicular", category: "Endodontia", needsTooth: true, needsFace: false, needsObs: false },
  // Cirurgia
  { code: "CIR01", name: "Exodontia de dente permanente", category: "Cirurgia", needsTooth: true, needsFace: false, needsObs: false },
  { code: "CIR02", name: "Exodontia de dente decíduo", category: "Cirurgia", needsTooth: true, needsFace: false, needsObs: false },
  { code: "CIR03", name: "Drenagem de abscesso", category: "Cirurgia", needsTooth: false, needsFace: false, needsObs: true },
  { code: "CIR04", name: "Remoção de sutura", category: "Cirurgia", needsTooth: false, needsFace: false, needsObs: false },
  { code: "CIR05", name: "Biopsia de lesão bucal", category: "Cirurgia", needsTooth: false, needsFace: false, needsObs: true },
  // Urgência
  { code: "URG01", name: "Atendimento de urgência odontológica", category: "Urgência", needsTooth: false, needsFace: false, needsObs: true },
  { code: "URG02", name: "Curativo odontológico pós-cirúrgico", category: "Urgência", needsTooth: true, needsFace: false, needsObs: true },
  { code: "URG03", name: "Cimentação de restauração / coroa provisória", category: "Urgência", needsTooth: true, needsFace: false, needsObs: false },
  // Radiologia
  { code: "RAD01", name: "Radiografia periapical", category: "Radiologia", needsTooth: true, needsFace: false, needsObs: false },
  { code: "RAD02", name: "Radiografia interproximal (bitewing)", category: "Radiologia", needsTooth: false, needsFace: false, needsObs: false },
  { code: "RAD03", name: "Radiografia panorâmica", category: "Radiologia", needsTooth: false, needsFace: false, needsObs: false },
];

const CATALOG_CATEGORIES = [...new Set(ODONTO_CATALOG.map(p => p.category))];

// ── FDI layout ────────────────────────────────────────────────────────────────
const UPPER_RIGHT = ["18","17","16","15","14","13","12","11"];
const UPPER_LEFT  = ["21","22","23","24","25","26","27","28"];
const LOWER_RIGHT = ["48","47","46","45","44","43","42","41"];
const LOWER_LEFT  = ["31","32","33","34","35","36","37","38"];
const DEC_UPPER_R = ["55","54","53","52","51"];
const DEC_UPPER_L = ["61","62","63","64","65"];
const DEC_LOWER_R = ["85","84","83","82","81"];
const DEC_LOWER_L = ["71","72","73","74","75"];

// ── Condições ─────────────────────────────────────────────────────────────────
const CONDITIONS = [
  { value: "higido",      label: "Hígido",        color: "transparent" },
  { value: "carie",       label: "Cárie",          color: "#ef4444" },
  { value: "restauracao", label: "Restauração",    color: "#3b82f6" },
  { value: "fratura",     label: "Fratura",        color: "#f97316" },
  { value: "ausente",     label: "Ausente",        color: "#94a3b8" },
  { value: "extraido",    label: "Extraído",       color: "#64748b" },
  { value: "implante",    label: "Implante",       color: "#10b981" },
  { value: "coroa",       label: "Coroa",          color: "#f59e0b" },
  { value: "canal",       label: "Canal tratado",  color: "#8b5cf6" },
  { value: "protese",     label: "Prótese",        color: "#6d28d9" },
  { value: "selante",     label: "Selante",        color: "#14b8a6" },
  { value: "lesao",       label: "Lesão",          color: "#991b1b" },
];

const CONDITION_COLOR = Object.fromEntries(CONDITIONS.map(c => [c.value, c.color]));

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

// ── Helpers ───────────────────────────────────────────────────────────────────
function getToothName(fdi) {
  const n = parseInt(fdi, 10);
  const q = Math.floor(n / 10);
  const num = n % 10;
  const side = [1,4].includes(q) ? "D" : "E";
  const arch = [1,2,5,6].includes(q) ? "sup" : "inf";
  const isDec = n >= 51;
  const pt = isDec
    ? { 1:"Inc. central", 2:"Inc. lateral", 3:"Canino", 4:"1º Molar", 5:"2º Molar" }
    : { 1:"Inc. central", 2:"Inc. lateral", 3:"Canino", 4:"1º Pré-molar", 5:"2º Pré-molar", 6:"1º Molar", 7:"2º Molar", 8:"3º Molar" };
  return `${pt[num] || "Dente"} ${arch} ${side}${isDec ? " (d)" : ""}`;
}

function SuccessBanner({ msg, onNew, newLabel = "+ Novo" }) {
  return (
    <div className="odonto-success-banner">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
      {msg}
      {onNew && <Button type="button" variant="ghost" size="sm" onClick={onNew} style={{ marginLeft: "auto" }}>{newLabel}</Button>}
    </div>
  );
}

function ErrorMsg({ msg }) {
  if (!msg) return null;
  return <div className="error odonto-error-inline">{msg}</div>;
}

// ── ToothSVG ─────────────────────────────────────────────────────────────────
function ToothSVG({ fdi, toothData, isSelected, onClick }) {
  const condition = toothData?.condition || "higido";
  const faces = toothData?.faces || {};
  const isAbsent = condition === "ausente" || condition === "extraido";
  const toothColor = CONDITION_COLOR[condition];
  const borderColor = isSelected ? "var(--teal-6,#0d9488)" : isAbsent ? "#94a3b8" : toothColor !== "transparent" ? toothColor : "#e2e8f0";
  const bg = isAbsent ? "#f8fafc" : "#fff";
  function fc(face) { const c = CONDITION_COLOR[faces[face]]; return c && c !== "transparent" ? c : "transparent"; }

  return (
    <button
      type="button"
      className="odonto-tooth"
      onClick={() => onClick(fdi)}
      title={`Dente ${fdi} — ${getToothName(fdi)}`}
      aria-label={`Dente ${fdi}${condition !== "higido" ? ` (${condition})` : ""}`}
      style={{ outline: isSelected ? "2px solid var(--teal-6,#0d9488)" : "none", outlineOffset: 2 }}
    >
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" style={{ display: "block" }}>
        <rect x="0.5" y="0.5" width="39" height="39" rx="4" fill={bg} stroke={borderColor} strokeWidth={isSelected ? 2 : 1} />
        <polygon points="0,0 40,0 30,10 10,10" fill={fc("vestibular")} stroke="#e2e8f0" strokeWidth="0.5" />
        <polygon points="0,40 40,40 30,30 10,30" fill={fc("lingual")} stroke="#e2e8f0" strokeWidth="0.5" />
        <polygon points="0,0 0,40 10,30 10,10" fill={fc("mesial")} stroke="#e2e8f0" strokeWidth="0.5" />
        <polygon points="40,0 40,40 30,30 30,10" fill={fc("distal")} stroke="#e2e8f0" strokeWidth="0.5" />
        <rect x="10" y="10" width="20" height="20" fill={fc("oclusal")} stroke="#e2e8f0" strokeWidth="0.5" />
        {isAbsent && <>
          <line x1="9" y1="9" x2="31" y2="31" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="31" y1="9" x2="9" y2="31" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
        </>}
        {!isAbsent && toothColor !== "transparent" && !Object.values(faces).some(Boolean) &&
          <rect x="10" y="10" width="20" height="20" fill={toothColor} opacity="0.35" />}
        {condition === "implante" && <text x="20" y="24" textAnchor="middle" fontSize="10" fill="#10b981" fontWeight="700">I</text>}
        {condition === "coroa" && <text x="20" y="24" textAnchor="middle" fontSize="9" fill="#f59e0b" fontWeight="700">C</text>}
        {condition === "canal" && <text x="20" y="24" textAnchor="middle" fontSize="9" fill="#8b5cf6" fontWeight="700">E</text>}
      </svg>
      <div className="odonto-tooth__fdi">{fdi}</div>
    </button>
  );
}

// ── FaceSelector ──────────────────────────────────────────────────────────────
function FaceSelector({ faces, selectedFace, onFaceClick, readOnly = false }) {
  function fc(face) { const c = CONDITION_COLOR[faces[face]]; return c && c !== "transparent" ? c : "transparent"; }
  const S = 120, t = 30;
  const faceProps = (face) => ({
    fill: selectedFace === face ? "#ccfbf1" : (fc(face) || "#f8fafc"),
    stroke: selectedFace === face ? "#0d9488" : "#cbd5e1",
    strokeWidth: selectedFace === face ? 2 : 1,
    onClick: readOnly ? undefined : () => onFaceClick(face),
    style: { cursor: readOnly ? "default" : "pointer" },
  });
  const labelStyle = { fontSize: "10", fill: "#64748b", fontWeight: "600", pointerEvents: "none" };
  return (
    <svg
      width={S} height={S} viewBox={`0 0 ${S} ${S}`}
      style={{ cursor: readOnly ? "default" : "pointer", flexShrink: 0, display: "block" }}
      role="img"
      aria-label={`Seletor de faces. Face selecionada: ${selectedFace || "nenhuma"}`}
    >
      {/* Outer tooth boundary */}
      <rect x="0.5" y="0.5" width={S-1} height={S-1} rx="14" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
      {/* Faces */}
      <polygon points={`0,0 ${S},0 ${S-t},${t} ${t},${t}`} {...faceProps("vestibular")} />
      <polygon points={`0,${S} ${S},${S} ${S-t},${S-t} ${t},${S-t}`} {...faceProps("lingual")} />
      <polygon points={`0,0 0,${S} ${t},${S-t} ${t},${t}`} {...faceProps("mesial")} />
      <polygon points={`${S},0 ${S},${S} ${S-t},${S-t} ${S-t},${t}`} {...faceProps("distal")} />
      <rect x={t} y={t} width={S-2*t} height={S-2*t} rx="6" {...faceProps("oclusal")} />
      {/* Labels */}
      <text x={S/2} y={16} textAnchor="middle" {...labelStyle}>V</text>
      <text x={S/2} y={S-6} textAnchor="middle" {...labelStyle}>L</text>
      <text x={11} y={S/2+4} textAnchor="middle" {...labelStyle}>M</text>
      <text x={S-11} y={S/2+4} textAnchor="middle" {...labelStyle}>D</text>
      <text x={S/2} y={S/2+4} textAnchor="middle" {...labelStyle}>O</text>
    </svg>
  );
}

// ── OdontogramChart ───────────────────────────────────────────────────────────
function OdontogramChart({ teeth, onToothClick, selectedFdi }) {
  const [showDec, setShowDec] = useState(false);
  function row(fdis) {
    return fdis.map(fdi => (
      <ToothSVG key={fdi} fdi={fdi} toothData={teeth[fdi]} isSelected={selectedFdi === fdi} onClick={onToothClick} />
    ));
  }
  return (
    <div className="odonto-chart">
      <div className="odonto-chart__dentition-toggle">
        <button type="button" className={`odonto-toggle-btn${!showDec ? " odonto-toggle-btn--active" : ""}`} onClick={() => setShowDec(false)}>Permanente</button>
        <button type="button" className={`odonto-toggle-btn${showDec ? " odonto-toggle-btn--active" : ""}`} onClick={() => setShowDec(true)}>Decídua</button>
      </div>
      <div className="odonto-chart__label">Superior</div>
      <div className="odonto-chart__arch">
        <div className="odonto-chart__half">{row(showDec ? DEC_UPPER_R : UPPER_RIGHT)}</div>
        <div className="odonto-chart__midline" aria-hidden="true" />
        <div className="odonto-chart__half">{row(showDec ? DEC_UPPER_L : UPPER_LEFT)}</div>
      </div>
      <div className="odonto-chart__gap" aria-hidden="true" />
      <div className="odonto-chart__arch">
        <div className="odonto-chart__half">{row(showDec ? DEC_LOWER_R : LOWER_RIGHT)}</div>
        <div className="odonto-chart__midline" aria-hidden="true" />
        <div className="odonto-chart__half">{row(showDec ? DEC_LOWER_L : LOWER_LEFT)}</div>
      </div>
      <div className="odonto-chart__label">Inferior</div>
      <div className="odonto-legend">
        {CONDITIONS.map(c => (
          <div key={c.value} className="odonto-legend__item">
            <span className="odonto-legend__swatch" style={{ background: c.color !== "transparent" ? c.color : "#f8fafc", border: c.color === "transparent" ? "1px solid #e2e8f0" : "none" }} />
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ToothPanel ────────────────────────────────────────────────────────────────
// Responsabilidade: estado clínico do dente.
// NÃO registra procedimentos — apenas condição + histórico local.
function ToothPanel({ fdi, toothData, procedures, patientId, token, canWrite, onClose, onUpdate, onRegisterProc }) {
  const [view, setView] = useState("condicao");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedFace, setSelectedFace] = useState(null);
  const [condition, setCondition] = useState(toothData?.condition || "higido");
  const [faceConditions, setFaceConditions] = useState(toothData?.faces || {});
  const [notes, setNotes] = useState(toothData?.notes || "");
  const [condSaved, setCondSaved] = useState(false);

  useEffect(() => {
    setCondition(toothData?.condition || "higido");
    setFaceConditions(toothData?.faces || {});
    setNotes(toothData?.notes || "");
    setCondSaved(false); setError(""); setView("condicao"); setSelectedFace(null);
  }, [fdi]);

  async function saveCondition() {
    setSaving(true); setError(""); setCondSaved(false);
    try {
      await patchOdontogramTooth(token, patientId, fdi, { condition, faces: faceConditions, notes });
      // Criar registro histórico da alteração de condição
      const { createRecord } = await import("../api");
      const condLabel = CONDITIONS.find(c => c.value === condition)?.label || condition;
      const faceDetails = Object.entries(faceConditions)
        .filter(([_, v]) => v && v !== "higido")
        .map(([k, v]) => `${FACES.find(f => f.key === k)?.label || k}: ${CONDITIONS.find(c => c.value === v)?.label || v}`)
        .join(", ");
      await createRecord(token, patientId, {
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toTimeString().slice(0, 5),
        type: "consultation",
        title: `Dente ${fdi} — ${condLabel}${faceDetails ? ` (${faceDetails})` : ""}`,
        details: notes || "",
        professionalName: "",
        professionalCouncil: "",
        immutable: true,
        metadata: { consultKind: "odontologia", subtype: "condicao", fdi, condition },
      });
      setCondSaved(true);
      onUpdate?.();
    } catch (e) { setError(e.message || "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  const toothProcs = procedures.filter(p => p.toothFdi === fdi);
  const currentCondColor = CONDITION_COLOR[condition];
  const currentCondLabel = CONDITIONS.find(c => c.value === condition)?.label || condition;

  return (
    <div className="odonto-panel">
      <div className="odonto-panel__header">
        <div style={{ flex: 1 }}>
          <div className="odonto-panel__fdi">Dente {fdi}</div>
          <div className="odonto-panel__name">{getToothName(fdi)}</div>
          {condition !== "higido" && (
            <span style={{
              display: "inline-block", marginTop: 4,
              fontSize: ".68rem", fontWeight: 700, padding: "2px 8px",
              borderRadius: "var(--r-full)",
              background: currentCondColor !== "transparent" ? currentCondColor + "22" : "#f8fafc",
              color: currentCondColor !== "transparent" ? currentCondColor : "var(--text-3)",
              border: `1px solid ${currentCondColor !== "transparent" ? currentCondColor + "55" : "#e2e8f0"}`,
            }}>
              {currentCondLabel}
            </span>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Fechar">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </Button>
      </div>

      <div className="odonto-panel__tabs">
        <button type="button" className={`odonto-panel__tab${view === "condicao" ? " odonto-panel__tab--active" : ""}`} onClick={() => { setView("condicao"); setError(""); }}>
          Condição
        </button>
        <button type="button" className={`odonto-panel__tab${view === "historico" ? " odonto-panel__tab--active" : ""}`} onClick={() => { setView("historico"); setError(""); }}>
          Histórico do dente{toothProcs.length > 0 ? ` (${toothProcs.length})` : ""}
        </button>
      </div>

      <div className="odonto-panel__body">
        <ErrorMsg msg={error} />

        {view === "condicao" && (
          <div className="odonto-panel__section">
            {condSaved && <SuccessBanner msg="Condição do dente atualizada." onNew={() => setCondSaved(false)} newLabel="Editar" />}

            <div style={{ marginBottom: "var(--s-3)" }}>
              <label className="field__label">Condição geral</label>
              <div className="odonto-cond-grid">
                {CONDITIONS.map(c => (
                  <button key={c.value} type="button"
                    className={`odonto-cond-btn${condition === c.value ? " odonto-cond-btn--active" : ""}`}
                    style={{ "--cond-color": c.color !== "transparent" ? c.color : "#e2e8f0" }}
                    onClick={() => { setCondition(c.value); setCondSaved(false); }}
                    disabled={!canWrite}
                  >
                    <span className="odonto-cond-btn__dot" />{c.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "var(--s-3)" }}>
              <label className="field__label" style={{ display: "block", marginBottom: "var(--s-2)" }}>Condição por face</label>
              <div className="odonto-face-section">
                <FaceSelector faces={faceConditions} selectedFace={selectedFace}
                  onFaceClick={canWrite ? (f) => setSelectedFace(selectedFace === f ? null : f) : () => {}} />
                {selectedFace ? (
                  <div className="odonto-face-cond">
                    <div className="odonto-face-cond__label">{FACES.find(f => f.key === selectedFace)?.label}</div>
                    <div className="odonto-cond-grid odonto-cond-grid--sm">
                      {CONDITIONS.map(c => (
                        <button key={c.value} type="button"
                          className={`odonto-cond-btn odonto-cond-btn--sm${faceConditions[selectedFace] === c.value ? " odonto-cond-btn--active" : ""}`}
                          style={{ "--cond-color": c.color !== "transparent" ? c.color : "#e2e8f0" }}
                          onClick={() => { setFaceConditions(s => ({ ...s, [selectedFace]: c.value })); setCondSaved(false); }}
                          disabled={!canWrite}
                        >
                          <span className="odonto-cond-btn__dot" />{c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: ".78rem", color: "var(--text-3)", alignSelf: "center" }}>Clique numa face para editar.</div>
                )}
              </div>
            </div>

            <div className="field" style={{ marginBottom: "var(--s-3)" }}>
              <label className="field__label">Observações</label>
              <AutoTextarea value={notes} onChange={e => { setNotes(e.target.value); setCondSaved(false); }} placeholder="Observações clínicas..." disabled={!canWrite} minRows={2} maxRows={4} />
            </div>

            <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
              {canWrite && (
                <Button type="button" variant="primary" size="sm" loading={saving} onClick={saveCondition}>
                  Salvar condição
                </Button>
              )}
              {canWrite && (
                <Button type="button" variant="secondary" size="sm"
                  onClick={() => onRegisterProc?.(fdi, selectedFace || "")}>
                  Registrar procedimento
                </Button>
              )}
            </div>
          </div>
        )}

        {view === "historico" && (
          <div className="odonto-panel__section">
            {toothProcs.length === 0 ? (
              <div style={{ fontSize: ".8rem", color: "var(--text-3)" }}>Nenhum procedimento registrado para o dente {fdi}.</div>
            ) : (
              <div className="odonto-proc-list">
                {[...toothProcs].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(p => {
                  const sc = STATUS_COLORS[p.status] || {};
                  const procName = ODONTO_CATALOG.find(c => c.code === p.type)?.name || p.type;
                  return (
                    <div key={p.id} className="odonto-proc-item">
                      <div className="odonto-proc-item__top">
                        <span className="odonto-proc-item__type">{procName}</span>
                        <span className="odonto-proc-item__status" style={{ background: sc.bg, color: sc.text }}>{PROC_STATUS.find(s => s.value === p.status)?.label}</span>
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

// ── WorkspaceOdontograma ──────────────────────────────────────────────────────
function WorkspaceOdontograma({ patient, token, canWrite, onChartUpdated, onRegisterProc }) {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFdi, setSelectedFdi] = useState(null);

  const loadChart = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await getOdontogramChart(token, patient.id);
      setChartData(res.data);
      onChartUpdated?.(res.data);
    } catch (e) {
      setError(e.message || "Erro ao carregar odontograma");
    } finally { setLoading(false); }
  }, [token, patient.id, onChartUpdated]);

  useEffect(() => { loadChart(); }, [loadChart]);

  if (loading) return (
    <div style={{ padding: "var(--s-6)", textAlign: "center", color: "var(--text-3)", fontSize: ".85rem" }}>
      Carregando odontograma...
    </div>
  );

  if (error) return (
    <div style={{ padding: "var(--s-4)" }}>
      <div className="error" style={{ padding: ".75rem 1rem", borderRadius: "var(--r-md)", marginBottom: "var(--s-3)" }}>{error}</div>
      <Button type="button" variant="secondary" size="sm" onClick={loadChart}>Tentar novamente</Button>
    </div>
  );

  const teeth = chartData?.odontogram?.teeth || {};
  const procedures = chartData?.procedures || [];

  function handleToothClick(fdi) {
    setSelectedFdi(prev => prev === fdi ? null : fdi);
  }

  function closeDrawer() { setSelectedFdi(null); }

  return (
    <div className="odonto-workspace-outer">
      <div className="odonto-chart-scroll">
        <OdontogramChart teeth={teeth} onToothClick={handleToothClick} selectedFdi={selectedFdi} />
      </div>

      {/* Backdrop on mobile */}
      {selectedFdi && <div className="odonto-drawer-backdrop" onClick={closeDrawer} aria-hidden="true" />}

      {/* Slide-over drawer */}
      <div className={`odonto-drawer${selectedFdi ? " odonto-drawer--open" : ""}`} aria-hidden={!selectedFdi}>
        {selectedFdi && (
          <ToothPanel
            fdi={selectedFdi}
            toothData={teeth[selectedFdi]}
            procedures={procedures}
            patientId={patient.id}
            token={token}
            canWrite={canWrite}
            onClose={closeDrawer}
            onUpdate={loadChart}
            onRegisterProc={onRegisterProc}
          />
        )}
      </div>
    </div>
  );
}

// ── WorkspaceResumo ───────────────────────────────────────────────────────────
function WorkspaceResumo({ patient, history, procedures, chartTeeth }) {
  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate + "T12:00:00").getTime()) / (365.25 * 86400000))
    : null;

  const dentalHistory = Array.isArray(history)
    ? history.filter(r => r.metadata?.consultKind === "odontologia")
    : [];

  const lastVisit = dentalHistory[0];
  const totalVisits = dentalHistory.length;
  const procDone = Array.isArray(procedures) ? procedures.filter(p => p.status === "concluido").length : 0;
  const procPending = Array.isArray(procedures) ? procedures.filter(p => p.status === "planejado" || p.status === "em_andamento").length : 0;
  const planos = dentalHistory.filter(r => r.metadata?.subtype === "plano_tratamento");
  const lastPlano = planos[0];

  // Computed from odontogram teeth
  const teeth = chartTeeth || {};
  const teethEntries = Object.entries(teeth);
  const cariesCount = teethEntries.filter(([_, t]) => t.condition === "carie").length;
  const restoredCount = teethEntries.filter(([_, t]) => t.condition === "restauracao").length;
  const absentCount = teethEntries.filter(([_, t]) => ["ausente", "extraido"].includes(t.condition)).length;
  const urgencyCount = teethEntries.filter(([_, t]) => ["carie", "fratura", "lesao"].includes(t.condition)).length;

  const Card = ({ label, value, note, accent }) => (
    <div className="odonto-resumo-card" style={accent ? { borderLeft: `3px solid ${accent}` } : {}}>
      <div className="odonto-resumo-card__label">{label}</div>
      <div className="odonto-resumo-card__value">{value}</div>
      {note && <div className="odonto-resumo-card__note">{note}</div>}
    </div>
  );

  return (
    <div style={{ padding: "var(--s-4)" }}>
      <div style={{ fontSize: ".7rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "var(--s-2)" }}>
        Situação clínica — Odontograma
      </div>
      <div className="odonto-resumo-grid" style={{ marginBottom: "var(--s-3)" }}>
        <Card label="Cáries ativas" value={cariesCount || "—"} accent={cariesCount > 0 ? "#ef4444" : undefined} />
        <Card label="Restaurações" value={restoredCount || "—"} accent={restoredCount > 0 ? "#3b82f6" : undefined} />
        <Card label="Dentes ausentes" value={absentCount || "—"} accent={absentCount > 0 ? "#94a3b8" : undefined} />
        <Card label="Necessita tratamento" value={urgencyCount || "—"} accent={urgencyCount > 0 ? "#f97316" : undefined} />
        <Card label="Procedimentos realizados" value={procDone} accent="#10b981" />
        <Card label="Pendências / Planejados" value={procPending} accent={procPending > 0 ? "#f59e0b" : undefined} />
      </div>

      <div style={{ fontSize: ".7rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "var(--s-2)", marginTop: "var(--s-4)" }}>
        Histórico de atendimento
      </div>
      <div className="odonto-resumo-grid">
        <Card label="Idade" value={age !== null ? `${age} anos` : "—"} />
        <Card label="Última consulta odonto" value={lastVisit ? fmtDate(lastVisit.date) : "—"} note={lastVisit?.title} />
        <Card label="Total de consultas" value={totalVisits} />
        <Card label="Plano de tratamento" value={lastPlano ? fmtDate(lastPlano.date) : "Sem plano ativo"} note={lastPlano ? "Último registrado" : undefined} />
      </div>

      {patient.chronicConditions?.length > 0 && (
        <div style={{ marginTop: "var(--s-4)" }}>
          <div className="field__label" style={{ marginBottom: "var(--s-2)" }}>Condições crônicas relevantes</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem" }}>
            {patient.chronicConditions.map(c => (
              <span key={c} style={{ fontSize: ".75rem", padding: "2px 10px", borderRadius: "var(--r-full)", background: "var(--teal-1)", color: "var(--teal-7)", fontWeight: 600 }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {patient.allergies?.length > 0 && (
        <div style={{ marginTop: "var(--s-3)" }}>
          <div className="field__label" style={{ marginBottom: "var(--s-2)" }}>Alergias</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem" }}>
            {patient.allergies.map(a => (
              <span key={a} style={{ fontSize: ".75rem", padding: "2px 10px", borderRadius: "var(--r-full)", background: "#fee2e2", color: "#b91c1c", fontWeight: 600 }}>{a}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── WorkspaceProcedimentos (catálogo estruturado) ─────────────────────────────
// prefill: { fdi, face } — pré-seleciona dente/face vindo do painel do odontograma
function WorkspaceProcedimentos({ patient, user, token, onSaved, prefill, onGetEncounter }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [status, setStatus] = useState("concluido");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Limpar seleção quando muda o prefill
  useEffect(() => {
    setSelected([]); setSuccess(false);
  }, [prefill?.fdi, prefill?.face]);

  const filtered = useMemo(() => ODONTO_CATALOG.filter(p => {
    const matchCat = category === "all" || p.category === category;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    return matchCat && matchSearch;
  }), [search, category]);

  function toggleProc(proc) {
    setSelected(s => {
      const exists = s.find(x => x.proc.code === proc.code);
      if (exists) return s.filter(x => x.proc.code !== proc.code);
      return [...s, { proc, tooth: prefill?.fdi || "", face: prefill?.face || "", obs: "" }];
    });
  }

  function updateSelected(code, field, value) {
    setSelected(s => s.map(x => x.proc.code === code ? { ...x, [field]: value } : x));
  }

  function reset() {
    setSelected([]); setSearch(""); setCategory("all"); setSuccess(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (selected.length === 0) { setError("Selecione ao menos um procedimento."); return; }
    setBusy(true); setError("");
    try {
      const enc = await onGetEncounter?.();
      const { createRecord } = await import("../api");
      // Register each selected procedure
      for (const item of selected) {
        const { proc, tooth, face, obs } = item;
        const details = [
          `Procedimento: ${proc.name} (${proc.code})`,
          tooth ? `Dente/região: ${tooth}` : "",
          face ? `Face: ${FACES.find(f => f.key === face)?.label || face}` : "",
          obs ? `Obs: ${obs}` : "",
        ].filter(Boolean).join("\n");

        await createRecord(token, patient.id, {
          date, time: new Date().toTimeString().slice(0,5),
          type: "consultation",
          title: proc.name,
          details,
          professionalName: user?.name || "",
          professionalCouncil: "",
          immutable: true,
          metadata: { consultKind: "odontologia", subtype: "procedimento", procCode: proc.code, procCategory: proc.category, dente: tooth || null, encounterId: enc?.id || null },
        });

        // If proc has a tooth, also create odontoProcedure
        if (tooth && tooth.match(/^\d{2}$/)) {
          try {
            await createOdontoProcedure(token, {
              patientId: patient.id, toothFdi: tooth,
              face: face || null, type: proc.code,
              date, status, notes: obs || null,
            });
          } catch (_) { /* non-blocking */ }
        }
      }
      setSuccess(true); onSaved?.();
    } catch (err) { setError(err.message || "Erro ao registrar."); }
    finally { setBusy(false); }
  }

  if (success) return (
    <div style={{ padding: "var(--s-4)" }}>
      <SuccessBanner msg={`${selected.length} procedimento${selected.length !== 1 ? "s" : ""} registrado${selected.length !== 1 ? "s" : ""}.`} onNew={reset} />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ padding: "var(--s-3)", display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      {prefill?.fdi && (
        <div className="odonto-prefill-banner">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3v4m0 2v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Procedimento para: <strong>Dente {prefill.fdi}</strong>
          {prefill.face ? ` — ${FACES.find(f => f.key === prefill.face)?.label || prefill.face}` : ""}
          {" "}· Selecione o procedimento abaixo
        </div>
      )}
      <div className="odonto-proc-toolbar">
        <div className="odonto-proc-search">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ color: "var(--text-3)" }}>
            <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="search" className="odonto-proc-search__input" placeholder="Buscar procedimento..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="odonto-proc-cats">
          <button type="button" className={`odonto-cat-chip${category === "all" ? " odonto-cat-chip--active" : ""}`} onClick={() => setCategory("all")}>Todos</button>
          {CATALOG_CATEGORIES.map(cat => (
            <button key={cat} type="button" className={`odonto-cat-chip${category === cat ? " odonto-cat-chip--active" : ""}`} onClick={() => setCategory(cat)}>{cat}</button>
          ))}
        </div>
      </div>

      <div className="odonto-proc-catalog">
        {filtered.length === 0 && <div style={{ fontSize: ".8rem", color: "var(--text-3)", padding: "var(--s-3)" }}>Nenhum procedimento encontrado.</div>}
        {filtered.map(proc => {
          const isChecked = !!selected.find(x => x.proc.code === proc.code);
          return (
            <label key={proc.code} className={`odonto-proc-catalog__item${isChecked ? " odonto-proc-catalog__item--selected" : ""}`}>
              <input type="checkbox" checked={isChecked} onChange={() => toggleProc(proc)} className="odonto-proc-catalog__check" />
              <div className="odonto-proc-catalog__info">
                <div className="odonto-proc-catalog__name">{proc.name}</div>
                <div className="odonto-proc-catalog__meta">
                  <span className="odonto-cat-badge">{proc.category}</span>
                  {proc.needsTooth && <span className="odonto-attr-badge">dente</span>}
                  {proc.needsFace && <span className="odonto-attr-badge">face</span>}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="odonto-proc-selected">
          <div className="field__label" style={{ marginBottom: "var(--s-2)" }}>
            Selecionados ({selected.length})
          </div>
          {selected.map(item => (
            <div key={item.proc.code} className="odonto-proc-selected-item">
              <div className="odonto-proc-selected-item__name">
                <button type="button" className="odonto-proc-remove" onClick={() => toggleProc(item.proc)} aria-label="Remover">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
                {item.proc.name}
              </div>
              <div className="odonto-proc-selected-item__fields">
                {item.proc.needsTooth && (
                  <Input label="Dente (FDI)" value={item.tooth} onChange={e => updateSelected(item.proc.code, "tooth", e.target.value)} placeholder="ex: 16" style={{ maxWidth: 90 }} />
                )}
                {item.proc.needsFace && (
                  <Select label="Face" value={item.face} onChange={e => updateSelected(item.proc.code, "face", e.target.value)}>
                    <option value="">Geral</option>
                    {FACES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </Select>
                )}
                {item.proc.needsObs && (
                  <div className="field" style={{ flex: 1 }}>
                    <label className="field__label">Observação</label>
                    <AutoTextarea value={item.obs} onChange={e => updateSelected(item.proc.code, "obs", e.target.value)} minRows={1} maxRows={3} />
                  </div>
                )}
              </div>
            </div>
          ))}
          <div className="odonto-proc-selected-footer">
            <Input label="Data" type="date" value={date} max={new Date().toISOString().slice(0,10)} onChange={e => setDate(e.target.value)} style={{ maxWidth: 160 }} />
            <Select label="Status" value={status} onChange={e => setStatus(e.target.value)} style={{ maxWidth: 160 }}>
              {PROC_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
        </div>
      )}

      <ErrorMsg msg={error} />
      <div><Button type="submit" variant="primary" loading={busy} disabled={selected.length === 0}>
        Registrar {selected.length > 0 ? `${selected.length} procedimento${selected.length !== 1 ? "s" : ""}` : "procedimentos"}
      </Button></div>
    </form>
  );
}

// ── WorkspaceEvolucao ─────────────────────────────────────────────────────────
function WorkspaceEvolucao({ patient, user, token, onSaved, history, encounter, onGetEncounter }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), queixa: "", exame: "", evolucao: "", conduta: "", orientacoes: "", proximo: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  function upd(k) { return e => setForm(s => ({ ...s, [k]: e.target.value })); }

  const evols = (history || [])
    .filter(r => r.metadata?.consultKind === "odontologia" && r.metadata?.subtype === "evolucao")
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.evolucao.trim()) { setError("Evolução obrigatória."); return; }
    setBusy(true); setError("");
    try {
      const enc = await onGetEncounter?.();
      const { createRecord } = await import("../api");
      const details = [
        form.queixa ? `Queixa principal: ${form.queixa}` : "",
        form.exame ? `Exame clínico: ${form.exame}` : "",
        `Evolução: ${form.evolucao}`,
        form.conduta ? `Conduta: ${form.conduta}` : "",
        form.orientacoes ? `Orientações: ${form.orientacoes}` : "",
        form.proximo ? `Próximo passo: ${form.proximo}` : "",
      ].filter(Boolean).join("\n");
      await createRecord(token, patient.id, {
        date: form.date, time: new Date().toTimeString().slice(0,5),
        type: "consultation", title: "Evolução odontológica",
        details, professionalName: user?.name || "", professionalCouncil: "",
        immutable: true, metadata: { consultKind: "odontologia", subtype: "evolucao", encounterId: enc?.id || null },
      });
      setForm({ date: new Date().toISOString().slice(0,10), queixa: "", exame: "", evolucao: "", conduta: "", orientacoes: "", proximo: "" });
      setSaved(true);
      onSaved?.();
    } catch (err) { setError(err.message || "Erro."); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ padding: "var(--s-4)", display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      {saved && <SuccessBanner msg="Evolução salva." onNew={() => setSaved(false)} newLabel="+ Nova evolução" />}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
        <div style={{ maxWidth: 180 }}>
          <Input label="Data" type="date" value={form.date} max={new Date().toISOString().slice(0,10)} onChange={upd("date")} />
        </div>
        <div className="field">
          <label className="field__label">Queixa principal</label>
          <AutoTextarea value={form.queixa} onChange={upd("queixa")} placeholder="Motivo da consulta..." minRows={2} maxRows={4} />
        </div>
        <div className="field">
          <label className="field__label">Exame clínico</label>
          <AutoTextarea value={form.exame} onChange={upd("exame")} placeholder="Achados clínicos..." minRows={2} maxRows={5} />
        </div>
        <div className="field">
          <label className="field__label">Evolução *</label>
          <AutoTextarea value={form.evolucao} onChange={upd("evolucao")} placeholder="Evolução do caso..." minRows={3} maxRows={8} required />
        </div>
        <div className="field">
          <label className="field__label">Conduta</label>
          <AutoTextarea value={form.conduta} onChange={upd("conduta")} placeholder="Conduta adotada..." minRows={2} maxRows={5} />
        </div>
        <div className="field">
          <label className="field__label">Orientações ao paciente</label>
          <AutoTextarea value={form.orientacoes} onChange={upd("orientacoes")} placeholder="Orientações dadas..." minRows={2} maxRows={4} />
        </div>
        <div className="field">
          <label className="field__label">Próximo passo</label>
          <AutoTextarea value={form.proximo} onChange={upd("proximo")} placeholder="Próximo atendimento ou encaminhamento..." minRows={1} maxRows={3} />
        </div>
        <ErrorMsg msg={error} />
        <div><Button type="submit" variant="primary" loading={busy}>Salvar evolução</Button></div>
      </form>

      {evols.length > 0 && (
        <div style={{ marginTop: "var(--s-4)", borderTop: "1px solid var(--border)", paddingTop: "var(--s-3)" }}>
          <div style={{ fontSize: ".7rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "var(--s-2)" }}>Evoluções anteriores</div>
          {evols.map(r => (
            <div key={r.id} className="odonto-evol-card">
              <div className="odonto-evol-card__header">
                <span className="odonto-evol-card__date">{fmtDate(r.date)}</span>
                {r.professionalName && <span className="odonto-evol-card__prof">· {r.professionalName}</span>}
              </div>
              <div className="odonto-evol-card__body odonto-evol-card__body--pre">{r.details}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── WorkspacePlano (checklist) ────────────────────────────────────────────────
function WorkspacePlano({ patient, user, token, onSaved, planItems, onPlanUpdated, encounter, onGetEncounter }) {
  const [items, setItems] = useState(planItems || []);
  const [form, setForm] = useState({ descricao: "", dente: "", prioridade: "media", previsao: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setItems(planItems || []); }, [planItems]);

  const PRIO_CFG = {
    alta:  { bg: "#fee2e2", color: "#b91c1c" },
    media: { bg: "#fef9c3", color: "#854d0e" },
    baixa: { bg: "#f0fdf4", color: "#166534" },
  };

  async function addItem(e) {
    e.preventDefault();
    if (!form.descricao.trim()) { setError("Descrição obrigatória."); return; }
    setBusy(true); setError("");
    try {
      const enc = await onGetEncounter?.();
      const res = await createOdontoPlanItem(token, {
        patientId: patient.id,
        encounterId: enc?.id || encounter?.id || null,
        descricao: form.descricao,
        dente: form.dente || null,
        prioridade: form.prioridade,
        previsao: form.previsao || null,
      });
      setItems(s => [...s, res.data]);
      setForm({ descricao: "", dente: "", prioridade: "media", previsao: "" });
      onPlanUpdated?.();
    } catch (err) { setError(err.message || "Erro."); }
    finally { setBusy(false); }
  }

  async function toggleDone(item) {
    const next = item.status === "concluido" ? "pendente" : "concluido";
    setError("");
    try {
      const res = await patchOdontoPlanItem(token, item.id, { status: next });
      setItems(s => s.map(i => i.id === item.id ? res.data : i));
      onPlanUpdated?.();
    } catch (err) { setError(err.message || "Erro."); }
  }

  async function removeItem(id) {
    setError("");
    try {
      await deleteOdontoPlanItem(token, id);
      setItems(s => s.filter(i => i.id !== id));
      onPlanUpdated?.();
    } catch (err) { setError(err.message || "Erro."); }
  }

  const pending = items.filter(i => i.status !== "concluido" && i.status !== "cancelado");
  const done    = items.filter(i => i.status === "concluido");

  return (
    <div style={{ padding: "var(--s-4)" }}>
      <form onSubmit={addItem} className="odonto-plan-form" style={{ marginBottom: "var(--s-4)" }}>
        <div className="field">
          <label className="field__label">Nova etapa *</label>
          <input type="text" className="input" value={form.descricao}
            onChange={e => setForm(s => ({ ...s, descricao: e.target.value }))}
            placeholder="Ex: Restaurar dente 16 (face mesial)..." />
        </div>
        <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 90px" }}>
            <Input label="Dente (FDI)" value={form.dente} onChange={e => setForm(s => ({ ...s, dente: e.target.value }))} placeholder="ex: 16" />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <Select label="Prioridade" value={form.prioridade} onChange={e => setForm(s => ({ ...s, prioridade: e.target.value }))}>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </Select>
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <Input label="Previsão" type="date" value={form.previsao} onChange={e => setForm(s => ({ ...s, previsao: e.target.value }))} />
          </div>
        </div>
        <ErrorMsg msg={error} />
        <div><Button type="submit" variant="primary" size="sm" loading={busy}>Adicionar ao plano</Button></div>
      </form>

      {pending.length > 0 && (
        <div style={{ marginBottom: "var(--s-4)" }}>
          <div className="odonto-plan-section-label">Pendências ({pending.length})</div>
          <div className="odonto-plan-list">
            {pending.map(item => {
              const pc = PRIO_CFG[item.prioridade] || PRIO_CFG.media;
              return (
                <div key={item.id} className="odonto-plan-item">
                  <button type="button" className="odonto-plan-check" onClick={() => toggleDone(item)} aria-label="Marcar concluído">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="3" stroke="#cbd5e1" strokeWidth="1.5"/></svg>
                  </button>
                  <div className="odonto-plan-item__body">
                    <div className="odonto-plan-item__desc">{item.descricao}</div>
                    <div className="odonto-plan-item__meta">
                      {item.dente && <span>Dente {item.dente}</span>}
                      {item.previsao && <span>{item.dente ? " · " : ""}{fmtDate(item.previsao)}</span>}
                      <span className="odonto-plan-prio" style={{ background: pc.bg, color: pc.color }}>{item.prioridade}</span>
                    </div>
                  </div>
                  <button type="button" className="odonto-proc-remove" onClick={() => removeItem(item.id)} aria-label="Remover">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div style={{ marginBottom: "var(--s-4)" }}>
          <div className="odonto-plan-section-label">Concluídos ({done.length})</div>
          <div className="odonto-plan-list">
            {done.map(item => (
              <div key={item.id} className="odonto-plan-item odonto-plan-item--done">
                <button type="button" className="odonto-plan-check" onClick={() => toggleDone(item)} aria-label="Desfazer conclusão">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="1" width="14" height="14" rx="3" fill="#10b981" stroke="#10b981" strokeWidth="1.5"/>
                    <path d="M4 8l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className="odonto-plan-item__body" style={{ opacity: 0.55 }}>
                  <div className="odonto-plan-item__desc" style={{ textDecoration: "line-through" }}>{item.descricao}</div>
                  {item.concluidoEm && <div className="odonto-plan-item__meta">{fmtDate(item.concluidoEm.slice(0,10))} · {item.responsavel}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div style={{ fontSize: ".82rem", color: "var(--text-3)", marginBottom: "var(--s-3)" }}>Nenhuma etapa no plano de tratamento.</div>
      )}
    </div>
  );
}

// ── WorkspaceTimeline ─────────────────────────────────────────────────────────
function WorkspaceTimeline({ history, procedures }) {
  const events = [];

  (history || []).filter(r => r.metadata?.consultKind === "odontologia").forEach(r => {
    events.push({
      id: "h-" + r.id,
      date: r.date,
      type: r.metadata?.subtype || "consulta",
      title: r.title,
      tooth: r.metadata?.dente,
      prof: r.professionalName,
    });
  });

  (procedures || []).forEach(p => {
    const procName = ODONTO_CATALOG.find(c => c.code === p.type)?.name || p.type;
    events.push({
      id: "p-" + p.id,
      date: p.date,
      type: "proc_dente",
      title: procName,
      tooth: p.toothFdi,
      face: p.face,
      status: p.status,
      prof: p.professionalName,
    });
  });

  events.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (!events.length) return (
    <div className="vacc-empty" style={{ padding: "var(--s-6)" }}>
      <div className="vacc-empty__icon" style={{ opacity: .2 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
        </svg>
      </div>
      <p className="vacc-empty__label">Sem eventos odontológicos registrados.</p>
    </div>
  );

  const TYPE_CFG = {
    evolucao:       { bg: "#f0f9ff", color: "#0369a1", label: "Evolução" },
    plano_tratamento: { bg: "#fef3c7", color: "#92400e", label: "Plano" },
    procedimento:   { bg: "#f0fdf4", color: "#166534", label: "Proc." },
    proc_dente:     { bg: "#f0fdf4", color: "#166534", label: "Proc. Dente" },
    consulta:       { bg: "#f5f3ff", color: "#6d28d9", label: "Consulta" },
  };

  return (
    <div className="odonto-timeline">
      {events.map(ev => {
        const cfg = TYPE_CFG[ev.type] || TYPE_CFG.consulta;
        const sc = ev.status ? STATUS_COLORS[ev.status] : null;
        return (
          <div key={ev.id} className="odonto-timeline__item">
            <div className="odonto-timeline__dot" style={{ background: cfg.color }} />
            <div className="odonto-timeline__body">
              <div className="odonto-timeline__top">
                <span className="odonto-timeline__title">{ev.title}</span>
                <span className="odonto-timeline__badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                {sc && <span className="odonto-timeline__badge" style={{ background: sc.bg, color: sc.text }}>{PROC_STATUS.find(s => s.value === ev.status)?.label}</span>}
              </div>
              <div className="odonto-timeline__meta">
                {ev.date ? fmtDate(ev.date) : "—"}
                {ev.tooth ? ` · Dente ${ev.tooth}` : ""}
                {ev.face ? ` — ${FACES.find(f => f.key === ev.face)?.label || ev.face}` : ""}
                {ev.prof ? ` · ${ev.prof}` : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── WorkspaceHistorico ─────────────────────────────────────────────────────────
// Linha do tempo unificada: condições + procedimentos + planos + evoluções.
// Substitui a aba Timeline (removida).
function WorkspaceHistorico({ history, procedures }) {
  const [filter, setFilter] = useState("todos");

  const HIST_FILTERS = [
    { id: "todos",         label: "Todos" },
    { id: "condicoes",     label: "Condições" },
    { id: "procedimentos", label: "Procedimentos" },
    { id: "planos",        label: "Planos" },
    { id: "documentos",    label: "Documentos" },
  ];

  const TYPE_CFG = {
    condicao:         { bg: "#fef3c7", color: "#92400e",  label: "Cond." },
    evolucao:         { bg: "#f0f9ff", color: "#0369a1",  label: "Evol." },
    plano_tratamento: { bg: "#f5f3ff", color: "#6d28d9",  label: "Plano" },
    procedimento:     { bg: "#f0fdf4", color: "#166534",  label: "Proc." },
    proc_dente:       { bg: "#f0fdf4", color: "#166534",  label: "Proc." },
    consulta:         { bg: "#f8fafc", color: "#475569",  label: "Cons." },
  };

  const events = [];

  (history || []).filter(r => r.metadata?.consultKind === "odontologia").forEach(r => {
    events.push({
      id: "h-" + r.id,
      date: r.date,
      histType: r.metadata?.subtype || "consulta",
      title: r.title,
      tooth: r.metadata?.fdi || r.metadata?.dente,
      prof: r.professionalName,
    });
  });

  (procedures || []).forEach(p => {
    const procName = ODONTO_CATALOG.find(c => c.code === p.type)?.name || p.type;
    events.push({
      id: "p-" + p.id,
      date: p.date,
      histType: "proc_dente",
      title: procName,
      tooth: p.toothFdi,
      face: p.face,
      status: p.status,
      prof: p.professionalName,
    });
  });

  events.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  function filterFn(ev) {
    switch (filter) {
      case "condicoes":     return ev.histType === "condicao";
      case "procedimentos": return ev.histType === "procedimento" || ev.histType === "proc_dente";
      case "planos":        return ev.histType === "plano_tratamento";
      case "documentos":    return ev.histType === "evolucao";
      default:              return true;
    }
  }

  const visible = events.filter(filterFn);

  if (history === null) return <div style={{ padding: "var(--s-4)", color: "var(--text-3)", fontSize: ".85rem" }}>Carregando...</div>;

  return (
    <div style={{ padding: "var(--s-3)" }}>
      <div className="odonto-proc-cats" style={{ marginBottom: "var(--s-3)" }}>
        {HIST_FILTERS.map(f => (
          <button key={f.id} type="button"
            className={`odonto-cat-chip${filter === f.id ? " odonto-cat-chip--active" : ""}`}
            onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="vacc-empty" style={{ padding: "var(--s-5)" }}>
          <div className="vacc-empty__icon" style={{ opacity: .2 }}>
            <svg width="28" height="28" viewBox="0 0 16 16" fill="none"><path d="M3 2h10v12H3z" stroke="currentColor" strokeWidth="1.4"/><path d="M6 6h5M6 8.5h5M6 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </div>
          <p className="vacc-empty__label">Nenhum registro encontrado.</p>
        </div>
      ) : (
        <div className="odonto-timeline">
          {visible.map(ev => {
            const cfg = TYPE_CFG[ev.histType] || TYPE_CFG.consulta;
            const sc = ev.status ? STATUS_COLORS[ev.status] : null;
            return (
              <div key={ev.id} className="odonto-timeline__item">
                <div className="odonto-timeline__dot" style={{ background: cfg.color }} />
                <div className="odonto-timeline__body">
                  <div className="odonto-timeline__top">
                    <span className="odonto-timeline__title">{ev.title}</span>
                    <span className="odonto-timeline__badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    {sc && <span className="odonto-timeline__badge" style={{ background: sc.bg, color: sc.text }}>{PROC_STATUS.find(s => s.value === ev.status)?.label}</span>}
                  </div>
                  <div className="odonto-timeline__meta">
                    {ev.date ? fmtDate(ev.date) : "—"}
                    {ev.tooth ? ` · Dente ${ev.tooth}` : ""}
                    {ev.face ? ` — ${FACES.find(f => f.key === ev.face)?.label || ev.face}` : ""}
                    {ev.prof ? ` · ${ev.prof}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ElapsedTimer ─────────────────────────────────────────────────────────────
function ElapsedTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startedAt]);
  const m = Math.floor(Math.max(0, elapsed) / 60);
  const s = Math.max(0, elapsed) % 60;
  return <>{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</>;
}

// ── EncounterHeader ───────────────────────────────────────────────────────────
function EncounterHeader({ encounter, queueEntry }) {
  const TIPO_LABEL = {
    programado: "Consulta programada", demanda_espontanea: "Demanda espontânea",
    urgencia: "Urgência", retorno: "Retorno", encaixe: "Encaixe",
  };
  // Priority: queue entry type > encounter tipo > hidden
  const label = queueEntry?.demandType
    || (encounter && encounter.tipo !== "avulso" ? (TIPO_LABEL[encounter.tipo] || encounter.tipo) : null);

  if (!label && !encounter?.startedAt) return null;

  return (
    <div className="odonto-encounter-header">
      <div className="odonto-encounter-header__info">
        {label && (
          <span className="odonto-encounter-header__badge" style={{ background: "#dcfce7", color: "#166534" }}>
            {label}
          </span>
        )}
        {queueEntry?.horario && (
          <span className="odonto-encounter-header__time">Chegada {queueEntry.horario}</span>
        )}
        {encounter?.status === "em_atendimento" && encounter?.startedAt && (
          <span className="odonto-encounter-header__elapsed">
            <ElapsedTimer startedAt={encounter.startedAt} />
          </span>
        )}
        {encounter?.professionalName && (
          <span className="odonto-encounter-header__tipo">{encounter.professionalName}</span>
        )}
      </div>
    </div>
  );
}


// ── Catálogo de medicamentos odontológicos ────────────────────────────────────
const DENTAL_MEDS = [
  { nome: "Amoxicilina 500mg",                  dosagem: "500mg",            posologia: "1 cápsula de 8/8h por 7 dias",                                   qtdPrescrita: 21, categoria: "Antibiótico" },
  { nome: "Amoxicilina + Clavulanato 875/125mg", dosagem: "875mg/125mg",      posologia: "1 comprimido de 12/12h por 7 dias",                               qtdPrescrita: 14, categoria: "Antibiótico" },
  { nome: "Azitromicina 500mg",                  dosagem: "500mg",            posologia: "1 comprimido 1×/dia por 3 dias",                                  qtdPrescrita: 3,  categoria: "Antibiótico" },
  { nome: "Clindamicina 300mg",                  dosagem: "300mg",            posologia: "1 cápsula de 8/8h por 7 dias (alérgico à penicilina)",            qtdPrescrita: 21, categoria: "Antibiótico" },
  { nome: "Metronidazol 400mg",                  dosagem: "400mg",            posologia: "1 comprimido de 8/8h por 7 dias",                                 qtdPrescrita: 21, categoria: "Antibiótico" },
  { nome: "Ibuprofeno 600mg",                    dosagem: "600mg",            posologia: "1 comprimido de 8/8h por 5 dias",                                 qtdPrescrita: 15, categoria: "Anti-inflamatório" },
  { nome: "Nimesulida 100mg",                    dosagem: "100mg",            posologia: "1 comprimido de 12/12h por 5 dias",                               qtdPrescrita: 10, categoria: "Anti-inflamatório" },
  { nome: "Prednisolona 20mg",                   dosagem: "20mg",             posologia: "1 comprimido 1×/dia por 5 dias",                                  qtdPrescrita: 5,  categoria: "Corticoide" },
  { nome: "Dipirona 500mg",                      dosagem: "500mg",            posologia: "1 comprimido de 6/6h se dor",                                     qtdPrescrita: 20, categoria: "Analgésico" },
  { nome: "Paracetamol 750mg",                   dosagem: "750mg",            posologia: "1 comprimido de 6/6h se dor",                                     qtdPrescrita: 20, categoria: "Analgésico" },
  { nome: "Clorexidina 0,12% (bochechos)",       dosagem: "0,12% 250mL",      posologia: "Bochecho de 15 mL por 30s, 2×/dia por 14 dias",                  qtdPrescrita: 1,  categoria: "Antisséptico" },
  { nome: "Nistatina 100.000 UI/mL (suspensão)", dosagem: "100.000 UI/mL",    posologia: "1 mL em bochecho por 2 min, 4×/dia por 14 dias",                 qtdPrescrita: 1,  categoria: "Antifúngico" },
];

const DENTAL_MED_CATS = [...new Set(DENTAL_MEDS.map(m => m.categoria))];

// ── WorkspacePrescricao ───────────────────────────────────────────────────────
function WorkspacePrescricao({ patient, user, token, encounter, onGetEncounter }) {
  const [itens, setItens] = useState([]);
  const [medSearch, setMedSearch] = useState("");
  const [medCat, setMedCat] = useState("all");
  const [cro, setCro] = useState(user?.cro || "");
  const [validade, setValidade] = useState("30 dias");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(null);
  const [prescricoes, setPrescricoes] = useState(null);

  useEffect(() => {
    import("../api").then(({ getOdontoPrescricoes }) =>
      getOdontoPrescricoes(token, patient.id)
        .then(r => setPrescricoes(r.data || []))
        .catch(() => setPrescricoes([]))
    );
  }, [token, patient.id, saved]);

  const filteredMeds = useMemo(() => DENTAL_MEDS.filter(m => {
    const matchCat = medCat === "all" || m.categoria === medCat;
    const q = medSearch.trim().toLowerCase();
    return matchCat && (!q || m.nome.toLowerCase().includes(q));
  }), [medSearch, medCat]);

  function addMed(med) {
    if (itens.find(i => i.nome === med.nome)) return;
    setItens(s => [...s, { nome: med.nome, dosagem: med.dosagem, posologia: med.posologia, qtdPrescrita: med.qtdPrescrita }]);
  }

  function removeMed(nome) { setItens(s => s.filter(i => i.nome !== nome)); }

  function updateItem(nome, field, val) {
    setItens(s => s.map(i => i.nome === nome ? { ...i, [field]: val } : i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (itens.length === 0) { setError("Adicione ao menos um medicamento."); return; }
    setBusy(true); setError("");
    try {
      const enc = await onGetEncounter?.();
      const { createOdontoPrescricao } = await import("../api");
      const now = new Date();
      const result = await createOdontoPrescricao(token, {
        patientId: patient.id,
        dtReceita: now.toISOString().slice(0, 10),
        validade,
        itens,
        obs: obs || null,
        cro: cro || null,
        encounterId: enc?.id || encounter?.id || null,
      });
      setSaved(result.data);
      printPrescription({
        patient,
        medications: itens.map(it => ({ name: it.nome, dosage: it.dosagem, instructions: it.posologia })),
        validity: validade,
        professional: { ...user, councilType: "CRO", councilNumber: cro || user?.cro || "", councilUf: "" },
      });
      setItens([]); setObs(""); setMedSearch("");
    } catch (err) { setError(err.message || "Erro ao emitir receita."); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ padding: "var(--s-4)", display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
      {saved && (
        <SuccessBanner
          msg={`Receita emitida — aparece na Farmácia.`}
          onNew={() => setSaved(null)}
          newLabel="+ Nova receita"
        />
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
        {/* CRO + validade */}
        <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 160px" }}>
            <Input label="CRO do prescritor" value={cro} onChange={e => setCro(e.target.value)} placeholder="CRO-SP 00000" />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <Input label="Validade" value={validade} onChange={e => setValidade(e.target.value)} placeholder="30 dias" />
          </div>
        </div>

        {/* Catálogo */}
        <div>
          <div className="field__label" style={{ marginBottom: "var(--s-1)" }}>Adicionar medicamento</div>
          <div style={{ display: "flex", gap: "var(--s-2)", marginBottom: "var(--s-2)", flexWrap: "wrap" }}>
            <div className="odonto-proc-search" style={{ flex: "1 1 180px" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ color: "var(--text-3)" }}>
                <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input type="search" className="odonto-proc-search__input" placeholder="Buscar medicamento..."
                value={medSearch} onChange={e => setMedSearch(e.target.value)} />
            </div>
            <div className="odonto-proc-cats" style={{ flex: "0 0 auto" }}>
              <button type="button" className={`odonto-cat-chip${medCat === "all" ? " odonto-cat-chip--active" : ""}`} onClick={() => setMedCat("all")}>Todos</button>
              {DENTAL_MED_CATS.map(c => (
                <button key={c} type="button" className={`odonto-cat-chip${medCat === c ? " odonto-cat-chip--active" : ""}`} onClick={() => setMedCat(c)}>{c}</button>
              ))}
            </div>
          </div>
          <div className="odonto-proc-catalog" style={{ maxHeight: 200 }}>
            {filteredMeds.map(med => {
              const added = !!itens.find(i => i.nome === med.nome);
              return (
                <button key={med.nome} type="button"
                  className={`odonto-proc-catalog__item${added ? " odonto-proc-catalog__item--selected" : ""}`}
                  onClick={() => added ? removeMed(med.nome) : addMed(med)}
                  style={{ textAlign: "left" }}>
                  <div className="odonto-proc-catalog__info">
                    <div className="odonto-proc-catalog__name">{med.nome}</div>
                    <div className="odonto-proc-catalog__meta">
                      <span className="odonto-cat-badge">{med.categoria}</span>
                      <span style={{ fontSize: ".72rem", color: "var(--text-3)" }}>{med.posologia}</span>
                    </div>
                  </div>
                  {added
                    ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  }
                </button>
              );
            })}
          </div>
        </div>

        {/* Itens selecionados */}
        {itens.length > 0 && (
          <div>
            <div className="field__label" style={{ marginBottom: "var(--s-2)" }}>Itens da receita ({itens.length})</div>
            {itens.map(item => (
              <div key={item.nome} className="odonto-proc-selected-item">
                <div className="odonto-proc-selected-item__name">
                  <button type="button" className="odonto-proc-remove" onClick={() => removeMed(item.nome)} aria-label="Remover">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  </button>
                  {item.nome}
                </div>
                <div className="odonto-proc-selected-item__fields">
                  <Input label="Dosagem" value={item.dosagem} onChange={e => updateItem(item.nome, "dosagem", e.target.value)} style={{ maxWidth: 160 }} />
                  <div className="field" style={{ flex: 1 }}>
                    <label className="field__label">Posologia</label>
                    <AutoTextarea value={item.posologia} onChange={e => updateItem(item.nome, "posologia", e.target.value)} minRows={1} maxRows={3} />
                  </div>
                  <Input label="Qtd." value={String(item.qtdPrescrita)} onChange={e => updateItem(item.nome, "qtdPrescrita", Number(e.target.value) || 1)} type="number" min="1" style={{ maxWidth: 70 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="field">
          <label className="field__label">Observações</label>
          <AutoTextarea value={obs} onChange={e => setObs(e.target.value)} minRows={2} maxRows={4} placeholder="Orientações adicionais ao paciente..." />
        </div>

        <ErrorMsg msg={error} />
        <div><Button type="submit" variant="primary" loading={busy} disabled={itens.length === 0}>Emitir receita</Button></div>
      </form>

      {/* Receitas anteriores */}
      {prescricoes !== null && prescricoes.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--s-3)" }}>
          <div style={{ fontSize: ".7rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "var(--s-2)" }}>Receitas odontológicas anteriores</div>
          {prescricoes.map(r => (
            <div key={r.id} className="odonto-evol-card" style={{ marginBottom: "var(--s-2)" }}>
              <div className="odonto-evol-card__header">
                <span className="odonto-evol-card__date">{fmtDate(r.dtReceita)}</span>
                {r.prescritorNome && <span className="odonto-evol-card__prof">· {r.prescritorNome}</span>}
                {r.cro && <span className="odonto-evol-card__prof">· CRO {r.cro}</span>}
                <span style={{ marginLeft: "auto", fontSize: ".72rem", color: "#166534", background: "#dcfce7", padding: "1px 8px", borderRadius: "var(--r-full)", fontWeight: 600 }}>{r.status}</span>
              </div>
              <div className="odonto-evol-card__body">
                {(r.itens || []).map((it, idx) => (
                  <div key={idx} style={{ fontSize: ".8rem", marginBottom: ".2rem" }}>
                    <strong>{it.nome}</strong> — {it.posologia} — Qtd: {it.qtdPrescrita}
                  </div>
                ))}
                {r.obs && <div style={{ fontSize: ".78rem", color: "var(--text-3)", marginTop: ".4rem" }}>{r.obs}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── WorkspaceDocumentos ───────────────────────────────────────────────────────
function WorkspaceDocumentos({ patient, user, token, encounter, onSaved, onGetEncounter }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tipo: "radiografia", nome: "", descricao: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [docSaved, setDocSaved] = useState(false);

  const DOC_TIPOS = [
    { value: "radiografia",   label: "Radiografia" },
    { value: "fotografia",    label: "Fotografia" },
    { value: "laudo",         label: "Laudo" },
    { value: "consentimento", label: "Consentimento" },
    { value: "pdf",           label: "PDF / Documento" },
    { value: "outro",         label: "Outro" },
  ];

  async function handleSave(e) {
    e.preventDefault();
    if (!form.nome.trim()) { setError("Nome obrigatório."); return; }
    setBusy(true); setError("");
    try {
      const enc = await onGetEncounter?.();
      const { createRecord } = await import("../api");
      await createRecord(token, patient.id, {
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toTimeString().slice(0, 5),
        type: "consultation",
        title: `Documento: ${form.nome}`,
        details: form.descricao,
        professionalName: user?.name || "",
        immutable: true,
        metadata: {
          consultKind: "odontologia", subtype: "documento",
          encounterId: enc?.id || encounter?.id || null, docTipo: form.tipo,
        },
      });
      setShowForm(false);
      setForm({ tipo: "radiografia", nome: "", descricao: "" });
      setDocSaved(true);
      onSaved?.();
    } catch (err) { setError(err.message || "Erro."); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ padding: "var(--s-4)" }}>
      <div style={{ fontSize: ".78rem", color: "var(--text-3)", background: "var(--surface-2,#f8fafc)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "var(--s-3)", marginBottom: "var(--s-4)" }}>
        Upload de arquivos será habilitado em versão futura. Registre apenas metadados (tipo, nome, descrição) do documento.
      </div>

      {docSaved && <SuccessBanner msg="Documento registrado." onNew={() => setDocSaved(false)} newLabel="+ Registrar outro" />}

      {!docSaved && showForm ? (
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
          <ErrorMsg msg={error} />
          <Select label="Tipo de documento" value={form.tipo} onChange={e => setForm(s => ({ ...s, tipo: e.target.value }))}>
            {DOC_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Input label="Nome / Identificação *" value={form.nome}
            onChange={e => setForm(s => ({ ...s, nome: e.target.value }))}
            placeholder="Ex: Rx periapical dente 16, Carta de encaminhamento..." />
          <div className="field">
            <label className="field__label">Descrição / observações</label>
            <AutoTextarea value={form.descricao}
              onChange={e => setForm(s => ({ ...s, descricao: e.target.value }))}
              minRows={2} maxRows={5}
              placeholder="Achados, conclusões ou referências..." />
          </div>
          <div style={{ display: "flex", gap: "var(--s-2)" }}>
            <Button type="submit" variant="primary" size="sm" loading={busy}>Registrar documento</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setError(""); }}>Cancelar</Button>
          </div>
        </form>
      ) : !docSaved ? (
        <Button type="button" variant="secondary" onClick={() => setShowForm(true)}>+ Registrar documento</Button>
      ) : null}
    </div>
  );
}

// ── DentalWorkspacePanel ──────────────────────────────────────────────────────
const WORKSPACE_TABS = [
  { id: "resumo",        label: "Resumo" },
  { id: "odontograma",   label: "Odontograma" },
  { id: "procedimentos", label: "Procedimentos", requiresWrite: true },
  { id: "evolucao",      label: "Evolução",      requiresWrite: true },
  { id: "plano",         label: "Plano",         requiresWrite: true },
  { id: "prescricao",    label: "Prescrição",    requiresWrite: true },
  { id: "documentos",    label: "Documentos" },
  { id: "historico",     label: "Histórico" },
];

function DentalWorkspacePanel({ patient, user, token, onClose, queueEntry, onRegistrar }) {
  const [activeTab, setActiveTab] = useState("resumo");
  const [history, setHistory] = useState(null);
  const [procedures, setProcedures] = useState([]);
  const [chartTeeth, setChartTeeth] = useState({});
  const [procPrefill, setProcPrefill] = useState(null);
  const [encounter, setEncounter] = useState(null);
  const [planItems, setPlanItems] = useState([]);
  const [registrarError, setRegistrarError] = useState("");

  const encounterRef = useRef(null);
  const encounterCreatingRef = useRef(false);

  const canWrite = hasCapability(user, "dental.write") || hasCapability(user, "dental.admin");

  // Sync state → ref so getOrCreateEncounter always sees current value
  function setEncounterSync(e) {
    encounterRef.current = e;
    setEncounter(e);
  }

  const loadHistory = useCallback(() => {
    import("../api").then(({ getPatientHistory }) =>
      getPatientHistory(token, patient.id)
        .then(h => setHistory(Array.isArray(h) ? h : []))
        .catch(() => setHistory([]))
    );
  }, [token, patient.id]);

  const loadProcs = useCallback(() => {
    getOdontogramChart(token, patient.id)
      .then(r => {
        setProcedures(r?.data?.procedures || []);
        setChartTeeth(r?.data?.odontogram?.teeth || {});
      })
      .catch(() => {});
  }, [token, patient.id]);

  const loadPlanItems = useCallback(async () => {
    try {
      const res = await getOdontoPlanItems(token, patient.id);
      setPlanItems(res.data || []);
    } catch {}
  }, [token, patient.id]);

  // Load existing open encounter on mount (silent, non-blocking)
  const loadEncounter = useCallback(async () => {
    if (!canWrite) return;
    try {
      const res = await getDentalEncounters(token, patient.id);
      const open = (res.data || []).find(e => ["aberto", "em_atendimento"].includes(e.status));
      if (open) setEncounterSync(open);
    } catch {}
  }, [token, patient.id, canWrite]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadHistory(); loadProcs(); loadPlanItems(); loadEncounter();
  }, [loadHistory, loadProcs, loadPlanItems, loadEncounter]);

  function onSaved() { loadHistory(); loadProcs(); }

  // Creates encounter silently on first save if none exists
  const getOrCreateEncounter = useCallback(async () => {
    if (encounterRef.current) return encounterRef.current;
    if (encounterCreatingRef.current) return null;
    encounterCreatingRef.current = true;
    try {
      const res = await getDentalEncounters(token, patient.id);
      const open = (res.data || []).find(e => ["aberto", "em_atendimento"].includes(e.status));
      if (open) { setEncounterSync(open); return open; }
      const created = await createDentalEncounter(token, { patientId: patient.id, tipo: "avulso", motivo: "" });
      setEncounterSync(created.data);
      return created.data;
    } catch { return null; }
    finally { encounterCreatingRef.current = false; }
  }, [token, patient.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChartUpdated = useCallback((chartData) => {
    setProcedures(chartData?.procedures || []);
    setChartTeeth(chartData?.odontogram?.teeth || {});
  }, []);

  const handleRegisterProc = useCallback((fdi, face) => {
    setProcPrefill({ fdi, face: face || "" });
    setActiveTab("procedimentos");
  }, []);

  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate + "T12:00:00").getTime()) / (365.25 * 86400000))
    : null;

  const visibleTabs = WORKSPACE_TABS.filter(t => !t.requiresWrite || canWrite);

  const hasClinicalRecord = (
    (Array.isArray(procedures) && procedures.length > 0) ||
    (Array.isArray(history) && history.length > 0) ||
    Object.keys(chartTeeth || {}).length > 0 ||
    (Array.isArray(planItems) && planItems.length > 0)
  );

  function handleRegistrar() {
    setRegistrarError("");
    if (!hasClinicalRecord) {
      setRegistrarError("Registre ao menos um dado clínico antes de encerrar o atendimento.");
      return;
    }
    if (onRegistrar) onRegistrar(() => {});
  }

  const isAtendido = String(queueEntry?.status || "") === "atendido";

  return (
    <div className="specialty-panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="specialty-panel__header">
        <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
          <div className="specialty-panel__avatar">{initials(patient.name)}</div>
          <div>
            <div className="specialty-panel__name">{patient.name}</div>
            <div className="specialty-panel__meta" style={{ display: "flex", alignItems: "center", gap: ".4rem", flexWrap: "wrap" }}>
              {age !== null ? `${age} anos` : ""}
              {queueEntry && (
                <span style={{
                  fontSize: ".65rem", fontWeight: 700, padding: "1px 7px",
                  borderRadius: "var(--r-full)",
                  background: isAtendido ? "#f0fdf4" : "#dcfce7",
                  color: isAtendido ? "#166534" : "#14532d",
                  border: `1px solid ${isAtendido ? "#bbf7d0" : "#86efac"}`
                }}>
                  {isAtendido ? "Atendido" : "Em atendimento"}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Fechar">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </Button>
      </div>

      <EncounterHeader encounter={encounter} queueEntry={queueEntry} />

      <div className="odonto-workspace-tabs">
        {visibleTabs.map(t => (
          <button key={t.id} type="button"
            className={`odonto-workspace-tab${activeTab === t.id ? " odonto-workspace-tab--active" : ""}`}
            onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: activeTab === "odontograma" ? "hidden" : "auto", minHeight: 0 }}>
        {activeTab === "resumo" && <WorkspaceResumo patient={patient} history={history} procedures={procedures} chartTeeth={chartTeeth} />}
        {activeTab === "odontograma" && <WorkspaceOdontograma patient={patient} token={token} canWrite={canWrite} onChartUpdated={handleChartUpdated} onRegisterProc={handleRegisterProc} />}
        {activeTab === "procedimentos" && canWrite && <WorkspaceProcedimentos patient={patient} user={user} token={token} onSaved={onSaved} prefill={procPrefill} onGetEncounter={getOrCreateEncounter} />}
        {activeTab === "evolucao" && canWrite && <WorkspaceEvolucao patient={patient} user={user} token={token} onSaved={onSaved} history={history} encounter={encounter} onGetEncounter={getOrCreateEncounter} />}
        {activeTab === "plano" && canWrite && <WorkspacePlano patient={patient} user={user} token={token} onSaved={onSaved} planItems={planItems} onPlanUpdated={loadPlanItems} encounter={encounter} onGetEncounter={getOrCreateEncounter} />}
        {activeTab === "prescricao" && canWrite && <WorkspacePrescricao patient={patient} user={user} token={token} encounter={encounter} onGetEncounter={getOrCreateEncounter} />}
        {activeTab === "documentos" && <WorkspaceDocumentos patient={patient} user={user} token={token} encounter={encounter} onSaved={onSaved} onGetEncounter={getOrCreateEncounter} />}
        {activeTab === "historico" && <WorkspaceHistorico history={history} procedures={procedures} />}
      </div>

      {canWrite && !isAtendido && onRegistrar && (
        <div style={{ padding: "var(--s-2) var(--s-3)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "var(--s-2)", flexWrap: "wrap" }}>
          {registrarError && (
            <p style={{ fontSize: ".75rem", color: "var(--danger)", margin: 0, flex: 1 }}>{registrarError}</p>
          )}
          <Button type="button" variant="primary" size="sm" onClick={handleRegistrar}>
            Registrar atendimento odontológico
          </Button>
        </div>
      )}
    </div>
  );
}

// ── DentalQueueView ───────────────────────────────────────────────────────────
const DEMAND_TYPE_PT = {
  scheduled: "Agendado", spontaneous: "Espontâneo",
  return: "Retorno", consultation: "Consulta",
  urgency: "Urgência", encaixe: "Encaixe",
  programado: "Programado", demanda_espontanea: "Espontâneo",
};
const QUEUE_STATUS_CFG = {
  aguardando_triagem: { label: "Aguardando triagem", bg: "#fef9c3", color: "#854d0e" },
  liberado:           { label: "Liberado",            bg: "#dbeafe", color: "#1d4ed8" },
  em_atendimento:     { label: "Em atendimento",      bg: "#dcfce7", color: "#166534" },
  atendido:           { label: "Atendido",            bg: "#f0fdf4", color: "#166534" },
  faltou:             { label: "Faltou",              bg: "#f1f5f9", color: "#94a3b8" },
  cancelado:          { label: "Cancelado",           bg: "#fee2e2", color: "#b91c1c" },
};

function DentalQueueView({ entries, loading, selectedId, onSelect, today }) {
  const [filter, setFilter] = useState("aguardando");

  const STATUS_GROUPS = {
    aguardando:      ["aguardando_triagem", "liberado"],
    em_atendimento:  ["em_atendimento"],
    atendidos:       ["atendido", "faltou", "cancelado"],
  };

  const counts = {
    aguardando:     (entries || []).filter(e => STATUS_GROUPS.aguardando.includes(e.status)).length,
    em_atendimento: (entries || []).filter(e => STATUS_GROUPS.em_atendimento.includes(e.status)).length,
    atendidos:      (entries || []).filter(e => STATUS_GROUPS.atendidos.includes(e.status)).length,
  };

  const visible = (entries || []).filter(e =>
    filter === "todos" ? true : STATUS_GROUPS[filter]?.includes(e.status)
  );

  const PRIORITY_CFG = {
    urgent:   { label: "URGENTE", bg: "#fee2e2", color: "#b91c1c" },
    elderly:  { label: "Idoso",   bg: "#fef9c3", color: "#854d0e" },
    pregnant: { label: "Gestante", bg: "#fce7f3", color: "#9d174d" },
    child:    { label: "Criança", bg: "#dbeafe", color: "#1e40af" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "var(--s-2) var(--s-3)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: ".68rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: "var(--s-1)" }}>
          Fila — {today}
        </div>
        <div style={{ display: "flex", gap: "var(--s-1)" }}>
          {[
            { key: "aguardando", label: `Aguardando (${counts.aguardando})` },
            { key: "em_atendimento", label: `Atendendo (${counts.em_atendimento})` },
            { key: "atendidos", label: `Prontos (${counts.atendidos})` },
          ].map(f => (
            <button key={f.key} type="button"
              className={`odonto-cat-chip${filter === f.key ? " odonto-cat-chip--active" : ""}`}
              style={{ fontSize: ".7rem" }}
              onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="vacc-panel__list" style={{ flex: 1, overflowY: "auto" }}>
        {loading && entries.length === 0 && <p className="vacc-panel__empty">Carregando fila...</p>}
        {!loading && visible.length === 0 && (
          <p className="vacc-panel__empty">
            {filter === "aguardando" ? "Nenhum paciente aguardando." : "Nenhum registro."}
          </p>
        )}
        {visible.map(entry => {
          const sc = QUEUE_STATUS_CFG[entry.status] || { label: entry.status, bg: "#f1f5f9", color: "#64748b" };
          const prioCfg = PRIORITY_CFG[entry.priority];
          return (
            <button key={entry.id} type="button"
              className={`vacc-pat${selectedId === entry.patientId ? " is-active" : ""}`}
              onClick={() => onSelect(entry)}>
              <Avatar name={entry.patientName} size="sm" />
              <div className="vacc-pat__copy" style={{ flex: 1, minWidth: 0 }}>
                <div className="vacc-pat__name">{entry.patientName}</div>
                <div className="vacc-pat__meta" style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                  {entry.patientAge != null && <span className="vacc-pat__age">{entry.patientAge}a</span>}
                  {entry.horario && <span style={{ fontSize: ".7rem", color: "var(--text-3)" }}>{entry.horario}</span>}
                  {entry.demandType && (
                    <span style={{ fontSize: ".67rem", fontWeight: 600, padding: "1px 6px", borderRadius: "var(--r-full)", background: "#eff6ff", color: "#1d4ed8" }}>
                      {DEMAND_TYPE_PT[entry.demandType] || entry.demandType}
                    </span>
                  )}
                  {prioCfg && (
                    <span style={{ fontSize: ".67rem", fontWeight: 700, padding: "1px 6px", borderRadius: "var(--r-full)", background: prioCfg.bg, color: prioCfg.color }}>
                      {prioCfg.label}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: ".68rem", fontWeight: 600, padding: "2px 7px", borderRadius: "var(--r-full)", background: sc.bg, color: sc.color, flexShrink: 0 }}>
                {sc.label}
              </span>
              <svg className="vacc-pat__chevron" width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OdontoDateNav({ date, onChange }) {
  function shift(days) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + days);
    onChange(d.toISOString().slice(0, 10));
  }
  const isToday = date === new Date().toISOString().slice(0, 10);
  const btn = { background: "none", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "2px 6px", cursor: "pointer", fontSize: ".75rem", color: "var(--text-2)", lineHeight: 1.4 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: ".25rem" }}>
      <button type="button" style={btn} onClick={() => shift(-1)}>‹</button>
      <input type="date" value={date} onChange={e => onChange(e.target.value)} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "2px 5px", fontSize: ".75rem", color: "var(--text)", background: "var(--surface)", cursor: "pointer" }} />
      <button type="button" style={btn} onClick={() => shift(1)}>›</button>
      {!isToday && <button type="button" onClick={() => onChange(new Date().toISOString().slice(0, 10))} style={{ ...btn, background: "var(--color-primary)", color: "#fff", border: "none", fontWeight: 600 }}>Hoje</button>}
    </div>
  );
}

// ── OdontologiaPage ───────────────────────────────────────────────────────────
const DENTAL_ICON = (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5.5c-1.5-2-4-2.5-5.5-1C4.5 6 4 8 5 10.5c.7 1.8 1.5 5.5 2.5 7 .5 1 1.5 1 2 0 .3-.6.5-1.5.5-3 0-1.5 1-2 2-2s2 .5 2 2c0 1.5.2 2.4.5 3 .5 1 1.5 1 2 0 1-1.5 1.8-5.2 2.5-7 1-2.5.5-4.5-1.5-6-1.5-1.5-4-1-5.5 1z"/>
  </svg>
);

export default function OdontologiaPage({ patients, user, token }) {
  const canRead = hasCapability(user, "dental.read") || hasCapability(user, "dental.write") || hasCapability(user, "dental.admin");

  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedQueueEntry, setSelectedQueueEntry] = useState(null);

  const [queueDate, setQueueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const { entries: allQueueEntries, loading: queueLoading, patchEntry } = useQueue(token, {
    enabled: canRead,
    date: queueDate,
    onError: () => {}
  });

  const queueEntries = useMemo(() => allQueueEntries.filter(e => {
    const sk = String(e.specialtyKey || e.specialty || "").toLowerCase();
    return sk === "odontologia" || sk.includes("odonto");
  }), [allQueueEntries]);

  async function handleQueueSelect(entry) {
    const patient = patients.find(p => p.id === entry.patientId);
    if (!patient) return;
    const now = new Date().toISOString();
    const patch = { status: "em_atendimento" };
    if (!entry.startedAt) patch.startedAt = now;
    setSelectedPatient(patient);
    setSelectedQueueEntry({ ...entry, ...patch });
    setShowSearch(false);
    patchEntry(entry.id, patch).catch(() => {});
  }

  function handleClose() {
    setSelectedPatient(null);
    setSelectedQueueEntry(null);
  }

  async function handleRegistrarAtendimento(queueEntry, onDone) {
    const now = new Date().toISOString();
    const patch = { status: "atendido", endedAt: now };
    setSelectedQueueEntry(prev => prev ? { ...prev, ...patch } : prev);
    if (onDone) onDone();
    setSelectedPatient(null);
    setSelectedQueueEntry(null);
    patchEntry(queueEntry.id, patch).catch(() => {});
  }

  const filtered = useMemo(() => {
    const base = !query.trim() ? patients : patients.filter(p => matchesPatientSearch(p, query));
    return [...base].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  }, [patients, query]);

  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (!canRead) return (
    <div style={{ padding: "3rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
      <div style={{ opacity: 0.2, marginBottom: "1rem" }}>{DENTAL_ICON}</div>
      <p style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text)", marginBottom: ".5rem" }}>Acesso restrito</p>
      <p style={{ fontSize: ".9rem" }}>Apenas dentistas e perfis autorizados podem acessar o módulo odontológico.</p>
    </div>
  );

  return (
    <div className="vaccines-page">
      <PageHeader
        eyebrow="ATENDIMENTO ODONTOLÓGICO"
        title="Odontologia"
        subtitle={today}
        actions={
          <Button type="button" variant="secondary" size="sm"
            onClick={() => { setShowSearch(s => !s); setQuery(""); setPage(0); }}>
            {showSearch ? "← Fila" : "Consultar paciente"}
          </Button>
        }
      />
      <div className="vaccines-layout">
        <div className="vacc-panel">
          <div className="card card--noPad overflow-hidden" style={{ height: "100%" }}>
            {showSearch ? (
              <>
                <div className="vacc-panel__search">
                  <Input value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Buscar paciente..." autoFocus />
                </div>
                <div className="vacc-panel__list">
                  {paged.length === 0 ? (
                    <p className="vacc-panel__empty">Nenhum paciente encontrado.</p>
                  ) : paged.map(p => {
                    const am = p.birthDate ? Math.round((Date.now() - new Date(p.birthDate + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24 * 30.44)) : null;
                    const isActive = selectedPatient?.id === p.id && !selectedQueueEntry;
                    return (
                      <button key={p.id} type="button" className={`vacc-pat${isActive ? " is-active" : ""}`}
                        onClick={() => { setSelectedPatient(p); setSelectedQueueEntry(null); }}>
                        <Avatar name={p.name} size="sm" />
                        <div className="vacc-pat__copy">
                          <div className="vacc-pat__name">{p.name}</div>
                          {am !== null && <div className="vacc-pat__meta"><span className="vacc-pat__age">{am < 24 ? `${am}m` : `${Math.floor(am/12)}a`}</span></div>}
                        </div>
                        <svg className="vacc-pat__chevron" width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
              </>
            ) : (
              <>
                <div style={{ padding: "var(--s-2) var(--s-3)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem" }}>
                  <span style={{ fontSize: ".7rem", fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Fila</span>
                  <OdontoDateNav date={queueDate} onChange={setQueueDate} />
                </div>
                <DentalQueueView
                  entries={queueEntries}
                  loading={queueLoading}
                  selectedId={selectedPatient?.id}
                  onSelect={handleQueueSelect}
                  today={today}
                />
              </>
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
                onClose={handleClose}
                queueEntry={selectedQueueEntry}
                onRegistrar={(onDone) => handleRegistrarAtendimento(selectedQueueEntry, onDone)}
              />
            </div>
          ) : (
            <div className="vacc-empty">
              <div className="vacc-empty__icon" style={{ opacity: .2 }}>{DENTAL_ICON}</div>
              <p className="vacc-empty__label">
                {showSearch
                  ? "Selecione um paciente para abrir o prontuário."
                  : queueLoading
                    ? "Carregando fila do dia..."
                    : queueEntries.length === 0
                      ? "Nenhum paciente na fila hoje. Use 'Consultar paciente' para buscar."
                      : "Selecione um paciente da fila para iniciar o atendimento."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
