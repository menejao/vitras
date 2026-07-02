import { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
function FaceSelector({ faces, selectedFace, onFaceClick }) {
  function fc(face) { const c = CONDITION_COLOR[faces[face]]; return c && c !== "transparent" ? c : "transparent"; }
  const S = 80, t = 20;
  const faceProps = (face) => ({
    fill: selectedFace === face ? "#ccfbf1" : (fc(face) || "#f8fafc"),
    stroke: selectedFace === face ? "#0d9488" : "#cbd5e1",
    strokeWidth: selectedFace === face ? 1.5 : 0.8,
    onClick: () => onFaceClick(face),
    style: { cursor: "pointer" },
  });
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ cursor: "pointer", flexShrink: 0 }} aria-label="Selecionar face">
      <polygon points={`0,0 ${S},0 ${S-t},${t} ${t},${t}`} {...faceProps("vestibular")} />
      <polygon points={`0,${S} ${S},${S} ${S-t},${S-t} ${t},${S-t}`} {...faceProps("lingual")} />
      <polygon points={`0,0 0,${S} ${t},${S-t} ${t},${t}`} {...faceProps("mesial")} />
      <polygon points={`${S},0 ${S},${S} ${S-t},${S-t} ${S-t},${t}`} {...faceProps("distal")} />
      <rect x={t} y={t} width={S-2*t} height={S-2*t} {...faceProps("oclusal")} />
      <text x={S/2} y={10} textAnchor="middle" fontSize="7" fill="#64748b">V</text>
      <text x={S/2} y={S-3} textAnchor="middle" fontSize="7" fill="#64748b">L</text>
      <text x={6} y={S/2+3} textAnchor="middle" fontSize="7" fill="#64748b">M</text>
      <text x={S-6} y={S/2+3} textAnchor="middle" fontSize="7" fill="#64748b">D</text>
      <text x={S/2} y={S/2+3} textAnchor="middle" fontSize="7" fill="#64748b">O</text>
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

// ── ToothPanel (painel lateral) ───────────────────────────────────────────────
function ToothPanel({ fdi, toothData, procedures, patientId, token, canWrite, onClose, onUpdate }) {
  const [tab, setTab] = useState("condicao");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedFace, setSelectedFace] = useState(null);
  const [condition, setCondition] = useState(toothData?.condition || "higido");
  const [faceConditions, setFaceConditions] = useState(toothData?.faces || {});
  const [notes, setNotes] = useState(toothData?.notes || "");
  const [condSaved, setCondSaved] = useState(false);
  const [procForm, setProcForm] = useState({ type: "restauracao", face: "", date: new Date().toISOString().slice(0,10), status: "planejado", notes: "" });
  const [procBusy, setProcBusy] = useState(false);
  const [procOk, setProcOk] = useState(false);

  useEffect(() => {
    setCondition(toothData?.condition || "higido");
    setFaceConditions(toothData?.faces || {});
    setNotes(toothData?.notes || "");
    setCondSaved(false); setError("");
  }, [fdi, toothData]);

  async function saveCondition() {
    setSaving(true); setError(""); setCondSaved(false);
    try {
      await patchOdontogramTooth(token, patientId, fdi, { condition, faces: faceConditions, notes });
      setCondSaved(true); onUpdate?.();
    } catch (e) { setError(e.message || "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  async function saveProcLocal(e) {
    e.preventDefault(); setProcBusy(true); setError("");
    try {
      await createOdontoProcedure(token, { patientId, toothFdi: fdi, face: procForm.face || null, type: procForm.type, date: procForm.date, status: procForm.status, notes: procForm.notes || null });
      setProcOk(true);
      setProcForm({ type: "restauracao", face: "", date: new Date().toISOString().slice(0,10), status: "planejado", notes: "" });
      onUpdate?.();
    } catch (e) { setError(e.message || "Erro"); }
    finally { setProcBusy(false); }
  }

  async function changeStatus(id, s) {
    try { await patchOdontoProcedure(token, id, { status: s }); onUpdate?.(); }
    catch (e) { setError(e.message || "Erro"); }
  }

  async function removeProc(id) {
    try { await deleteOdontoProcedure(token, id); onUpdate?.(); }
    catch (e) { setError(e.message || "Erro"); }
  }

  const toothProcs = procedures.filter(p => p.toothFdi === fdi);

  return (
    <div className="odonto-panel">
      <div className="odonto-panel__header">
        <div>
          <div className="odonto-panel__fdi">Dente {fdi}</div>
          <div className="odonto-panel__name">{getToothName(fdi)}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Fechar">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </Button>
      </div>
      <div className="odonto-panel__tabs">
        {[["condicao","Condição"],["procedimento","Procedimento"],["historico","Histórico"]].map(([id, label]) => (
          <button key={id} type="button" className={`odonto-panel__tab${tab === id ? " odonto-panel__tab--active" : ""}`} onClick={() => { setTab(id); setError(""); }}>
            {label}
          </button>
        ))}
      </div>
      <div className="odonto-panel__body">
        <ErrorMsg msg={error} />

        {tab === "condicao" && (
          <div className="odonto-panel__section">
            {condSaved && <SuccessBanner msg="Condição salva." onNew={() => setCondSaved(false)} newLabel="Editar" />}
            <div style={{ marginBottom: "var(--s-3)" }}>
              <label className="field__label">Condição geral do dente</label>
              <div className="odonto-cond-grid">
                {CONDITIONS.map(c => (
                  <button key={c.value} type="button"
                    className={`odonto-cond-btn${condition === c.value ? " odonto-cond-btn--active" : ""}`}
                    style={{ "--cond-color": c.color !== "transparent" ? c.color : "#e2e8f0" }}
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
                  <div style={{ fontSize: ".78rem", color: "var(--text-3)", alignSelf: "center" }}>Clique numa face para selecionar.</div>
                )}
              </div>
            </div>
            <div className="field" style={{ marginBottom: "var(--s-3)" }}>
              <label className="field__label">Observações</label>
              <AutoTextarea value={notes} onChange={e => { setNotes(e.target.value); setCondSaved(false); }} placeholder="Observações clínicas..." disabled={!canWrite} />
            </div>
            {canWrite && <Button type="button" variant="primary" size="sm" loading={saving} onClick={saveCondition}>Salvar condição</Button>}
          </div>
        )}

        {tab === "procedimento" && (
          <div className="odonto-panel__section">
            {canWrite && (
              <>
                {procOk && <SuccessBanner msg="Procedimento registrado." onNew={() => setProcOk(false)} />}
                {!procOk && (
                  <form onSubmit={saveProcLocal} className="odonto-proc-form">
                    <div className="odonto-proc-form__row">
                      <Select label="Tipo" value={procForm.type} onChange={e => setProcForm(s => ({ ...s, type: e.target.value }))}>
                        {[...new Set(ODONTO_CATALOG.map(p => p.category))].map(cat => (
                          <optgroup key={cat} label={cat}>
                            {ODONTO_CATALOG.filter(p => p.category === cat).map(p => (
                              <option key={p.code} value={p.code}>{p.name}</option>
                            ))}
                          </optgroup>
                        ))}
                        <optgroup label="Outro">
                          <option value="outro">Outro (texto livre)</option>
                        </optgroup>
                      </Select>
                    </div>
                    <div className="odonto-proc-form__row odonto-proc-form__row--3col">
                      <Input label="Data" type="date" value={procForm.date} max={new Date().toISOString().slice(0,10)} onChange={e => setProcForm(s => ({ ...s, date: e.target.value }))} />
                      <Select label="Status" value={procForm.status} onChange={e => setProcForm(s => ({ ...s, status: e.target.value }))}>
                        {PROC_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </Select>
                      <Select label="Face" value={procForm.face} onChange={e => setProcForm(s => ({ ...s, face: e.target.value }))}>
                        <option value="">Geral</option>
                        {FACES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </Select>
                    </div>
                    <div className="field">
                      <label className="field__label">Observações</label>
                      <AutoTextarea value={procForm.notes} onChange={e => setProcForm(s => ({ ...s, notes: e.target.value }))} placeholder="Observações complementares..." minRows={2} />
                    </div>
                    <Button type="submit" variant="primary" size="sm" loading={procBusy}>Registrar procedimento</Button>
                  </form>
                )}
              </>
            )}
            {toothProcs.length > 0 && (
              <div className="odonto-proc-list" style={{ marginTop: "var(--s-3)" }}>
                {toothProcs.map(p => {
                  const sc = STATUS_COLORS[p.status] || {};
                  const procName = ODONTO_CATALOG.find(c => c.code === p.type)?.name || p.type;
                  return (
                    <div key={p.id} className="odonto-proc-item">
                      <div className="odonto-proc-item__top">
                        <span className="odonto-proc-item__type">{procName}{p.face ? ` — ${FACES.find(f => f.key === p.face)?.label || p.face}` : ""}</span>
                        <span className="odonto-proc-item__status" style={{ background: sc.bg, color: sc.text }}>{PROC_STATUS.find(s => s.value === p.status)?.label}</span>
                      </div>
                      <div className="odonto-proc-item__meta">{p.date ? fmtDate(p.date) : "—"}{p.professionalName ? ` · ${p.professionalName}` : ""}</div>
                      {p.notes && <div className="odonto-proc-item__notes">{p.notes}</div>}
                      {canWrite && (
                        <div className="odonto-proc-item__actions">
                          {p.status !== "concluido" && <Button type="button" variant="ghost" size="sm" onClick={() => changeStatus(p.id, "concluido")}>Concluir</Button>}
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeProc(p.id)}>Remover</Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {toothProcs.length === 0 && !canWrite && (
              <div style={{ fontSize: ".8rem", color: "var(--text-3)", padding: "var(--s-2) 0" }}>Nenhum procedimento registrado para o dente {fdi}.</div>
            )}
          </div>
        )}

        {tab === "historico" && (
          <div className="odonto-panel__section">
            {toothProcs.length === 0 ? (
              <div style={{ fontSize: ".8rem", color: "var(--text-3)" }}>Nenhum histórico para o dente {fdi}.</div>
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
    } finally { setLoading(false); }
  }, [token, patient.id]);

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

  return (
    <div className="odonto-workspace">
      <div className="odonto-workspace__chart">
        <OdontogramChart teeth={teeth} onToothClick={fdi => setSelectedFdi(fdi === selectedFdi ? null : fdi)} selectedFdi={selectedFdi} />
      </div>
      {selectedFdi && (
        <div className="odonto-workspace__panel">
          <ToothPanel
            fdi={selectedFdi}
            toothData={teeth[selectedFdi]}
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

// ── WorkspaceResumo ───────────────────────────────────────────────────────────
function WorkspaceResumo({ patient, history, procedures }) {
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

  const Card = ({ label, value, note, accent }) => (
    <div className="odonto-resumo-card" style={accent ? { borderLeft: `3px solid ${accent}` } : {}}>
      <div className="odonto-resumo-card__label">{label}</div>
      <div className="odonto-resumo-card__value">{value}</div>
      {note && <div className="odonto-resumo-card__note">{note}</div>}
    </div>
  );

  return (
    <div style={{ padding: "var(--s-4)" }}>
      <div className="odonto-resumo-grid">
        <Card label="Idade" value={age !== null ? `${age} anos` : "—"} />
        <Card label="Última consulta odonto" value={lastVisit ? fmtDate(lastVisit.date) : "—"} note={lastVisit?.title} />
        <Card label="Total de consultas" value={totalVisits} />
        <Card label="Procedimentos realizados" value={procDone} accent="#10b981" />
        <Card label="Pendências / Planejados" value={procPending} accent={procPending > 0 ? "#f59e0b" : undefined} />
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
function WorkspaceProcedimentos({ patient, user, token, onSaved }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState([]); // array of { proc, tooth, face, obs }
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [status, setStatus] = useState("concluido");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
      return [...s, { proc, tooth: "", face: "", obs: "" }];
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
          metadata: { consultKind: "odontologia", subtype: "procedimento", procCode: proc.code, procCategory: proc.category, dente: tooth || null },
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
function WorkspaceEvolucao({ patient, user, token, onSaved }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), queixa: "", exame: "", evolucao: "", conduta: "", orientacoes: "", proximo: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  function upd(k) { return e => setForm(s => ({ ...s, [k]: e.target.value })); }
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.evolucao.trim()) { setError("Evolução obrigatória."); return; }
    setBusy(true); setError("");
    try {
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
        immutable: true, metadata: { consultKind: "odontologia", subtype: "evolucao" },
      });
      setSuccess(true); setForm({ date: new Date().toISOString().slice(0,10), queixa: "", exame: "", evolucao: "", conduta: "", orientacoes: "", proximo: "" });
      onSaved?.();
    } catch (err) { setError(err.message || "Erro."); }
    finally { setBusy(false); }
  }
  if (success) return (
    <div style={{ padding: "var(--s-4)" }}><SuccessBanner msg="Evolução registrada." onNew={() => setSuccess(false)} newLabel="+ Nova evolução" /></div>
  );
  return (
    <form onSubmit={handleSubmit} style={{ padding: "var(--s-4)", display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
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
  );
}

// ── WorkspacePlano ────────────────────────────────────────────────────────────
function WorkspacePlano({ patient, user, token, onSaved }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), prioridade: "media", objetivo: "", etapas: "", previsao: "", obs: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  function upd(k) { return e => setForm(s => ({ ...s, [k]: e.target.value })); }
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.objetivo.trim()) { setError("Objetivo obrigatório."); return; }
    setBusy(true); setError("");
    try {
      const { createRecord } = await import("../api");
      const details = [
        `Objetivo: ${form.objetivo}`,
        form.etapas ? `Etapas: ${form.etapas}` : "",
        `Prioridade: ${form.prioridade}`,
        form.previsao ? `Previsão: ${form.previsao}` : "",
        form.obs ? `Observações: ${form.obs}` : "",
      ].filter(Boolean).join("\n");
      await createRecord(token, patient.id, {
        date: form.date, time: new Date().toTimeString().slice(0,5),
        type: "consultation", title: "Plano de tratamento odontológico",
        details, professionalName: user?.name || "", professionalCouncil: "",
        immutable: true, metadata: { consultKind: "odontologia", subtype: "plano_tratamento", prioridade: form.prioridade },
      });
      setSuccess(true); setForm({ date: new Date().toISOString().slice(0,10), prioridade: "media", objetivo: "", etapas: "", previsao: "", obs: "" });
      onSaved?.();
    } catch (err) { setError(err.message || "Erro."); }
    finally { setBusy(false); }
  }
  if (success) return (
    <div style={{ padding: "var(--s-4)" }}><SuccessBanner msg="Plano de tratamento registrado." onNew={() => setSuccess(false)} newLabel="+ Novo plano" /></div>
  );
  return (
    <form onSubmit={handleSubmit} style={{ padding: "var(--s-4)", display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap" }}>
        <div style={{ width: 160 }}>
          <Input label="Data" type="date" value={form.date} max={new Date().toISOString().slice(0,10)} onChange={upd("date")} />
        </div>
        <div style={{ width: 160 }}>
          <Select label="Prioridade" value={form.prioridade} onChange={upd("prioridade")}>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </Select>
        </div>
        <div style={{ width: 160 }}>
          <Input label="Previsão de conclusão" type="date" value={form.previsao} onChange={upd("previsao")} />
        </div>
      </div>
      <div className="field">
        <label className="field__label">Objetivo *</label>
        <AutoTextarea value={form.objetivo} onChange={upd("objetivo")} placeholder="Objetivo do tratamento..." minRows={2} maxRows={5} required />
      </div>
      <div className="field">
        <label className="field__label">Etapas planejadas</label>
        <AutoTextarea value={form.etapas} onChange={upd("etapas")} placeholder="Descreva as etapas..." minRows={3} maxRows={8} />
      </div>
      <div className="field">
        <label className="field__label">Observações</label>
        <AutoTextarea value={form.obs} onChange={upd("obs")} placeholder="Observações gerais..." minRows={2} maxRows={4} />
      </div>
      <ErrorMsg msg={error} />
      <div><Button type="submit" variant="primary" loading={busy}>Salvar plano</Button></div>
    </form>
  );
}

// ── WorkspaceHistorico ────────────────────────────────────────────────────────
function WorkspaceHistorico({ history }) {
  if (history === null) return <div style={{ padding: "var(--s-4)", color: "var(--text-3)", fontSize: ".85rem" }}>Carregando...</div>;
  const dh = history.filter(r => r.metadata?.consultKind === "odontologia");
  if (!dh.length) return (
    <div className="vacc-empty" style={{ padding: "var(--s-6)" }}>
      <div className="vacc-empty__icon" style={{ opacity: .2 }}>
        <svg width="32" height="32" viewBox="0 0 16 16" fill="none"><path d="M3 2h10v12H3z" stroke="currentColor" strokeWidth="1.4"/><path d="M6 6h5M6 8.5h5M6 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
      </div>
      <p className="vacc-empty__label">Sem histórico odontológico registrado.</p>
    </div>
  );
  const SUBTYPE_LABEL = { procedimento: "Proc", evolucao: "Evol", plano_tratamento: "Plano" };
  return (
    <div style={{ padding: "var(--s-3)" }}>
      {dh.map(h => (
        <div key={h.id} className="specialty-panel__hist-item">
          <span className="specialty-panel__hist-date">{fmtDate(h.date)}</span>
          <span className="specialty-panel__hist-title">{h.title}</span>
          {h.metadata?.subtype && (
            <span style={{ fontSize: ".68rem", padding: "1px 6px", borderRadius: "var(--r-full)", background: "var(--teal-1)", color: "var(--teal-7)", fontWeight: 700, letterSpacing: ".05em" }}>
              {SUBTYPE_LABEL[h.metadata.subtype] || h.metadata.subtype}
            </span>
          )}
          {h.professionalName && <span className="specialty-panel__hist-prof">{h.professionalName}</span>}
        </div>
      ))}
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
  { id: "historico",     label: "Histórico" },
];

function DentalWorkspacePanel({ patient, user, token, onClose }) {
  const [activeTab, setActiveTab] = useState("odontograma");
  const [history, setHistory] = useState(null);
  const [procedures, setProcedures] = useState([]);
  const canWrite = hasCapability(user, "dental.write") || hasCapability(user, "dental.admin");

  const loadHistory = useCallback(() => {
    import("../api").then(({ getPatientHistory }) =>
      getPatientHistory(token, patient.id)
        .then(h => setHistory(Array.isArray(h) ? h : []))
        .catch(() => setHistory([]))
    );
  }, [token, patient.id]);

  const loadProcs = useCallback(() => {
    getOdontogramChart(token, patient.id)
      .then(r => setProcedures(r?.data?.procedures || []))
      .catch(() => {});
  }, [token, patient.id]);

  useEffect(() => { loadHistory(); loadProcs(); }, [loadHistory, loadProcs]);

  function onSaved() { loadHistory(); loadProcs(); }

  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate + "T12:00:00").getTime()) / (365.25 * 86400000))
    : null;

  const visibleTabs = WORKSPACE_TABS.filter(t => !t.requiresWrite || canWrite);

  return (
    <div className="specialty-panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="specialty-panel__header">
        <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
          <div className="specialty-panel__avatar">{initials(patient.name)}</div>
          <div>
            <div className="specialty-panel__name">{patient.name}</div>
            <div className="specialty-panel__meta">{age !== null ? `${age} anos` : ""}</div>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Fechar">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </Button>
      </div>

      <div className="odonto-workspace-tabs">
        {visibleTabs.map(t => (
          <button key={t.id} type="button"
            className={`odonto-workspace-tab${activeTab === t.id ? " odonto-workspace-tab--active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {activeTab === "resumo" && <WorkspaceResumo patient={patient} history={history} procedures={procedures} />}
        {activeTab === "odontograma" && <WorkspaceOdontograma patient={patient} token={token} canWrite={canWrite} />}
        {activeTab === "procedimentos" && canWrite && <WorkspaceProcedimentos patient={patient} user={user} token={token} onSaved={onSaved} />}
        {activeTab === "evolucao" && canWrite && <WorkspaceEvolucao patient={patient} user={user} token={token} onSaved={onSaved} />}
        {activeTab === "plano" && canWrite && <WorkspacePlano patient={patient} user={user} token={token} onSaved={onSaved} />}
        {activeTab === "historico" && <WorkspaceHistorico history={history} />}
      </div>
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

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState(null);

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
        subtitle={`${filtered.length} paciente${filtered.length !== 1 ? "s" : ""} cadastrado${filtered.length !== 1 ? "s" : ""}`}
      />
      <div className="vaccines-layout">
        <div className="vacc-panel">
          <div className="card card--noPad overflow-hidden">
            <div className="vacc-panel__search">
              <Input value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Buscar paciente..." />
            </div>
            <div className="vacc-panel__list">
              {paged.length === 0 ? (
                <p className="vacc-panel__empty">Nenhum paciente encontrado.</p>
              ) : paged.map(p => {
                const am = p.birthDate ? Math.round((Date.now() - new Date(p.birthDate + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24 * 30.44)) : null;
                const isActive = selectedPatient?.id === p.id;
                return (
                  <button key={p.id} type="button" className={`vacc-pat${isActive ? " is-active" : ""}`} onClick={() => setSelectedPatient(isActive ? null : p)}>
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
          </div>
        </div>
        <div className="vacc-main">
          {selectedPatient ? (
            <div className="card card--noPad overflow-hidden" style={{ height: "100%" }}>
              <DentalWorkspacePanel patient={selectedPatient} user={user} token={token} onClose={() => setSelectedPatient(null)} />
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
