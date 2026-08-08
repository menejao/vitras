import React, { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
import UnitDetailTabbed from "./platform/UnitDetail";
import { lookupCep, formatCep } from "../services/cepService";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Alert from "../components/ui/Alert";
import { BrandLockup } from "../components/brand/BrandLockup";
import ImportConsole from "../components/import/ImportConsole";

// ── Constants ──────────────────────────────────────────────────────────────

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];
const STATUS_OPTIONS = ["draft","onboarding","homologation","active","suspended"];
const STATUS_LABELS  = {
  draft:        "Rascunho",
  onboarding:   "Em implantação",
  homologation: "Homologação",
  active:       "Operacional",
  suspended:    "Suspensa"
};

const STATUS_TRANSITIONS = {
  draft:        [{ to: "onboarding",   label: "Iniciar Implantação" }],
  onboarding:   [{ to: "homologation", label: "Iniciar Homologação" }],
  homologation: [{ to: "active",       label: "Ativar UBS" }, { to: "onboarding", label: "Voltar a Implantação" }],
  active:       [{ to: "suspended",    label: "Suspender" }],
  suspended:    [{ to: "active",       label: "Reativar" }]
};

const STATUS_BADGE = {
  draft:        "badge",
  onboarding:   "badge badge--warning",
  homologation: "badge badge--info",
  active:       "badge badge--success",
  suspended:    "badge badge--danger",
};

const TRANSITION_VARIANT = {
  active:    "primary",
  suspended: "danger",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function apiFetch(path, token, options = {}) {
  const { body, ...rest } = options;
  return api(path, { ...rest, body, credentials: "include" }, token);
}

// ── Cache administrativo leve (TTL 45s, invalidação por prefixo) ──────────
const _cache = new Map();
function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > 45_000) { _cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data) { _cache.set(key, { data, ts: Date.now() }); }
function cacheInvalidate(prefix) {
  for (const k of _cache.keys()) { if (k.startsWith(prefix)) _cache.delete(k); }
}
async function cachedFetch(path, token) {
  const hit = cacheGet(path);
  if (hit !== null) return hit;
  const data = await apiFetch(path, token);
  cacheSet(path, data);
  return data;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
  } catch { return iso.slice(0, 10); }
}

// ── Icons ──────────────────────────────────────────────────────────────────

const IcoOverview = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);

const IcoBuilding = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M2 14V5l6-3 6 3v9" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <rect x="6" y="10" width="4" height="4" rx=".5" stroke="currentColor" strokeWidth="1.2"/>
    <rect x="4" y="7" width="2" height="2" rx=".5" fill="currentColor"/>
    <rect x="10" y="7" width="2" height="2" rx=".5" fill="currentColor"/>
  </svg>
);

const IcoImport = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M8 1v9M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M1 12h14v2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-2z" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);

const IcoPortal = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M5.5 5.5C6.5 6.5 6.5 9.5 5.5 10.5M10.5 5.5C9.5 6.5 9.5 9.5 10.5 10.5" stroke="currentColor" strokeWidth="1.1"/>
  </svg>
);

const IcoCheck = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IcoWarning = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M8 7v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="8" cy="12" r=".7" fill="currentColor"/>
  </svg>
);

const IcoCity = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M3 21V9l7-5 7 5v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 21V6l-4-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 21h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <rect x="8" y="15" width="4" height="6" rx=".5" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="5" y="11" width="2" height="2" rx=".5" fill="currentColor" opacity=".6"/>
    <rect x="13" y="11" width="2" height="2" rx=".5" fill="currentColor" opacity=".6"/>
  </svg>
);

const IcoHospital = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M1 21h22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9 21v-5h6v5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M12 8v4M10 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IcoUsers = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IcoBell = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IcoClipboard = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IcoDatabase = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3 5v5c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3 10v5c0 1.66 4.03 3 9 3s9-1.34 9-3v-5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const IcoScale = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 3v18M4 21h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M5 9h4l-2 5H5l2-5zM15 9h4l-2 5h-4l2-5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M5 9L12 4l7 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IcoMonitor = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M6 9l3 3 3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IcoDeploy = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 2C8 2 4 6 4 10c0 5 8 12 8 12s8-7 8-12c0-4-4-8-8-8z" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);

const IcoBackup = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IcoFlag = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M4 21V4M4 4h12l-3 5 3 5H4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IcoInbox = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);

const IcoCheckCircle = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IcoFire = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 12c0 2-1.5 3-1.5 4.5a1.5 1.5 0 0 0 3 0C13.5 15 12 14 12 12z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

// ── StatusBadge ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  return (
    <span className={STATUS_BADGE[status] || "badge"}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// ── ErrorBoundary ──────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error("[Console]", e, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="console-error-block">
          <div style={{ color: "var(--warning, #f59e0b)", opacity: .7 }}><IcoWarning size={32} /></div>
          <p className="console-error-block__msg">
            Erro ao carregar este módulo. Tente novamente ou contate o suporte.
          </p>
          <Button onClick={() => this.setState({ error: null })}>Tentar novamente</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function Skeleton({ type = "row", count = 3 }) {
  return (
    <div style={{ padding: "var(--s-2) 0" }}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className={`console-skeleton console-skeleton--${type}`} style={{ marginBottom: "var(--s-2)", opacity: 1 - i * 0.2 }} />
      ))}
    </div>
  );
}

function KpiSkeleton({ count = 5 }) {
  return (
    <div className="noc-kpi-grid" style={{ marginBottom: "var(--s-4)" }}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="console-skeleton console-skeleton--kpi" />
      ))}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────

function EmptyState({ icon, title, text, cta, onCta }) {
  const defaultIcon = <IcoInbox size={36} />;
  const rendered = icon ?? defaultIcon;
  return (
    <div className="console-empty">
      <div className="console-empty__icon">{rendered}</div>
      {title && <p className="console-empty__title">{title}</p>}
      {text  && <p className="console-empty__text">{text}</p>}
      {cta   && <Button onClick={onCta}>{cta}</Button>}
    </div>
  );
}

// ── ErrorBlock ─────────────────────────────────────────────────────────────

function ErrorBlock({ message = "Erro ao carregar dados.", onRetry }) {
  return (
    <div className="console-error-block">
      <div style={{ color: "var(--warning, #f59e0b)", opacity: .7 }}><IcoWarning size={28} /></div>
      <p className="console-error-block__msg">{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}

// ── SVG Charts ─────────────────────────────────────────────────────────────

function DonutChart({ segments = [], size = 80, strokeWidth = 10 }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="console-donut">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={strokeWidth} />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ;
        const gap  = circ - dash;
        const rotation = (offset / total) * 360 - 90;
        offset += seg.value;
        if (!seg.value) return null;
        return (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={seg.color || "var(--accent)"}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={0}
            transform={`rotate(${rotation} ${size/2} ${size/2})`}
          />
        );
      })}
    </svg>
  );
}

function MiniBar({ value = 0, max = 100, color = "var(--accent)", height = 6 }) {
  const pct = Math.min(100, Math.max(0, (value / (max || 1)) * 100));
  return (
    <div style={{ background: "var(--surface-3)", borderRadius: 3, height, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .5s ease" }} />
    </div>
  );
}

function Sparkline({ values = [], color = "var(--accent)", width = 80, height = 30 }) {
  if (values.length < 2) return null;
  const max = Math.max(...values) || 1;
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── ModuleBanner ───────────────────────────────────────────────────────────

function ModuleBanner({ icon, title, subtitle, color = "var(--accent)", kpis = [], children }) {
  return (
    <div className="console-module-banner" style={{ "--module-color": color }}>
      <div className="console-module-banner__icon">{icon}</div>
      <div className="console-module-banner__body">
        <h1 className="console-module-banner__title">{title}</h1>
        {subtitle && <p className="console-module-banner__sub">{subtitle}</p>}
        {children}
      </div>
      {kpis.length > 0 && (
        <div className="console-module-banner__kpis">
          {kpis.map((k, i) => (
            <div key={i} className="console-module-banner__kpi">
              <div className="console-module-banner__kpi-value">{k.value ?? "—"}</div>
              <div className="console-module-banner__kpi-label">{k.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TempPasswordModal ──────────────────────────────────────────────────────

function TempPasswordModal({ password, onClose }) {
  const [copied, setCopied]     = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleCopy() {
    try { await navigator.clipboard.writeText(password); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="console-modal-overlay">
      <div className="console-modal">
        <h2 className="console-modal__title">Senha Temporária — Exibição Única</h2>
        <div className="console-pwd-box">
          <div className="console-pwd-box__warn">Esta senha será exibida uma única vez. Anote ou copie agora.</div>
          <code className="console-pwd-box__code">{password}</code>
        </div>
        <Button full variant={copied ? "secondary" : "primary"} onClick={handleCopy} style={{ marginBottom: "var(--s-3)" }}>
          {copied ? "✓ Senha copiada com sucesso!" : "Copiar Senha"}
        </Button>
        <label style={{ display: "flex", alignItems: "flex-start", gap: "var(--s-2)", cursor: "pointer", marginBottom: "var(--s-4)", fontSize: "var(--t-sm)" }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, accentColor: "var(--accent)" }}
          />
          <span>Confirmo que anotei ou copiei esta senha.</span>
        </label>
        <Button full variant="secondary" disabled={!confirmed} onClick={onClose}>Fechar</Button>
      </div>
    </div>
  );
}

// ── NationalSummary ────────────────────────────────────────────────────────

function NationalSummary({ token }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/platform/summary", token)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="console-kpi-strip">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="console-kpi" style={{ opacity: .4, minHeight: 80 }} />
      ))}
    </div>
  );
  if (!data) return null;

  return (
    <div className="console-kpi-strip">
      <div className="console-kpi console-kpi--accent">
        <div className="console-kpi__value">{data.totalUnits ?? "—"}</div>
        <div className="console-kpi__label">Total de UBS</div>
      </div>
      <div className="console-kpi console-kpi--warning">
        <div className="console-kpi__value">{data.onboarding ?? "—"}</div>
        <div className="console-kpi__label">Em implantação</div>
      </div>
      <div className="console-kpi console-kpi--success">
        <div className="console-kpi__value">{data.active ?? "—"}</div>
        <div className="console-kpi__label">Operacionais</div>
      </div>
      <div className="console-kpi">
        <div className="console-kpi__value">{data.totalGestors ?? "—"}</div>
        <div className="console-kpi__label">Gestores</div>
      </div>
      <div className="console-kpi">
        <div className="console-kpi__value">{data.totalUsers ?? "—"}</div>
        <div className="console-kpi__label">Usuários ativos</div>
      </div>
    </div>
  );
}

// ── NocDashboard ───────────────────────────────────────────────────────────

function NocDashboard({ token, onGoTo }) {
  const [summary,    setSummary]    = useState(null);
  const [incidents,  setIncidents]  = useState([]);
  const [deployments,setDeployments]= useState([]);
  const [backupDash, setBackupDash] = useState(null);
  const [health,     setHealth]     = useState(null);
  const [govDash,    setGovDash]    = useState(null);
  // loading por seção — não bloqueia a página inteira
  const [kpiLoading,     setKpiLoading]     = useState(true);
  const [incLoading,     setIncLoading]     = useState(true);
  const [depLoading,     setDepLoading]     = useState(true);
  const [healthLoading,  setHealthLoading]  = useState(true);

  const loadAll = useCallback(() => {
    setKpiLoading(true); setIncLoading(true); setDepLoading(true); setHealthLoading(true);

    // Bloco 1: summary (KPIs)
    cachedFetch("/platform/summary", token)
      .then(d => setSummary(d))
      .catch(() => {})
      .finally(() => setKpiLoading(false));

    // Bloco 2: incidentes abertos
    cachedFetch("/platform/incidents?status=OPEN&limit=5", token)
      .then(d => setIncidents(d?.incidents || []))
      .catch(() => {})
      .finally(() => setIncLoading(false));

    // Bloco 3: deployments em andamento
    cachedFetch("/platform/deployments?status=IN_PROGRESS&limit=5", token)
      .then(d => setDeployments(d?.deployments || []))
      .catch(() => {})
      .finally(() => setDepLoading(false));

    // Bloco 4: health + backup + governance
    Promise.all([
      apiFetch("/readyz", token).catch(() => null),
      cachedFetch("/platform/backup-dashboard", token).catch(() => null),
      cachedFetch("/platform/governance-dashboard", token).catch(() => null),
    ]).then(([hlth, bkp, gov]) => {
      setHealth(hlth);
      setBackupDash(bkp);
      setGovDash(gov);
    }).finally(() => setHealthLoading(false));
  }, [token]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openIncidents  = incidents.filter(i => i.status !== "CLOSED").length;
  const critIncidents  = incidents.filter(i => i.severity === "CRITICAL").length;
  const inProgressDeps = deployments.length;

  const services = [
    { name: "API Backend",      ok: health !== null },
    { name: "Auth / JWT",       ok: health !== null },
    { name: "CDS Export",       ok: true },
    { name: "Indicator Engine", ok: true },
    { name: "Break Glass",      ok: true },
    { name: "Backup",           ok: !!backupDash },
  ];

  return (
    <>
      {/* KPI strip — carrega independente das seções abaixo */}
      {kpiLoading ? <KpiSkeleton count={6} /> : (
        <div className="noc-kpi-grid">
          {[
            { label: "Municípios",         value: summary?.totalMunicipalities ?? "—", icon: <IcoCity size={16} />,        color: "#3b82f6", onClick: () => onGoTo("municipalities") },
            { label: "UBS cadastradas",    value: summary?.totalUnits ?? "—",          icon: <IcoHospital size={16} />,    color: "#8b5cf6", onClick: () => onGoTo("municipalities") },
            { label: "Operacionais",       value: summary?.active ?? "—",              icon: <IcoCheckCircle size={16} />, color: "#10b981" },
            { label: "Em implantação",     value: inProgressDeps,                      icon: <IcoDeploy size={16} />,      color: "#f59e0b", onClick: () => onGoTo("deployments") },
            { label: "Incidentes abertos", value: openIncidents,                       icon: <IcoFire size={16} />,        color: critIncidents > 0 ? "#ef4444" : "#f59e0b", onClick: () => onGoTo("incidents") },
            { label: "Usuários ativos",    value: summary?.totalUsers ?? "—",          icon: <IcoUsers size={16} />,       color: "#6366f1" },
          ].map((k) => (
            <button key={k.label} type="button" className="noc-kpi" style={{ "--kpi-color": k.color, cursor: k.onClick ? "pointer" : "default", textAlign: "left", border: "1px solid var(--border)", background: "var(--surface)" }} onClick={k.onClick}>
              <div className="noc-kpi__accent" />
              <div className="noc-kpi__icon" style={{ color: k.color, display: "flex" }}>{k.icon}</div>
              <div className="noc-kpi__value" style={{ color: k.color }}>{k.value}</div>
              <div className="noc-kpi__label">{k.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Main grid: Health + Incidents + Deployments */}
      <div className="noc-grid" style={{ marginBottom: "var(--s-4)" }}>

        {/* Health — loading independente */}
        <div className="console-section">
          <div className="console-section__header">
            <span>Saúde da Plataforma</span>
            {!healthLoading && <span style={{ fontSize: "var(--t-xs)", color: "var(--success)", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>OPERACIONAL</span>}
          </div>
          <div className="console-section__body">
            {healthLoading ? <Skeleton count={3} /> : (
              <div className="noc-health-grid">
                {services.map(svc => (
                  <div key={svc.name} className="noc-health-item">
                    <div className={`noc-health-dot${!svc.ok ? " noc-health-dot--err" : ""}`} />
                    <span className="noc-health-label">{svc.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Incidentes abertos — loading independente */}
        <div className="console-section">
          <div className="console-section__header">
            <span>Incidentes Abertos</span>
            <button type="button" className="console-breadcrumb-link" style={{ fontSize: "var(--t-xs)" }} onClick={() => onGoTo("incidents")}>Ver todos →</button>
          </div>
          <div className="console-section__body">
            {incLoading ? <Skeleton count={2} /> : incidents.length === 0 ? (
              <EmptyState icon={<IcoCheckCircle size={36} />} title="Nenhum incidente aberto" text="Todos os serviços estão operando normalmente." />
            ) : (
              <div className="console-timeline">
                {incidents.map(inc => (
                  <div key={inc.id} className="console-timeline__item">
                    <div className={`console-timeline__dot${inc.severity === "CRITICAL" ? " console-timeline__dot--err" : inc.severity === "HIGH" ? " console-timeline__dot--warn" : ""}`} />
                    <div className="console-timeline__body">
                      <div className="console-timeline__title">{inc.title}</div>
                      <div className="console-timeline__meta">
                        <span className={`badge${inc.severity === "CRITICAL" ? " badge--danger" : inc.severity === "HIGH" ? " badge--warning" : ""}`} style={{ fontSize: "0.7em" }}>{inc.severity}</span>
                        {" · "}{fmtDate(inc.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Deployments em andamento */}
        <div className="console-section">
          <div className="console-section__header">
            <span>Implantações em Andamento</span>
            <button type="button" className="console-breadcrumb-link" style={{ fontSize: "var(--t-xs)" }} onClick={() => onGoTo("deployments")}>Ver todas →</button>
          </div>
          <div className="console-section__body">
            {depLoading ? <Skeleton count={2} /> : deployments.length === 0 ? (
              <EmptyState icon={<IcoFlag size={36} />} title="Nenhuma implantação ativa" text="Todas as implantações estão concluídas." />
            ) : (
              <div className="console-timeline">
                {deployments.map(dep => (
                  <div key={dep.id} className="console-timeline__item">
                    <div className="console-timeline__dot console-timeline__dot--warn" />
                    <div className="console-timeline__body">
                      <div className="console-timeline__title">{dep.municipalityName || dep.unitName || "—"}</div>
                      <div className="console-timeline__meta">
                        {dep.type === "MUNICIPAL" ? "Municipal" : "UBS"}
                        {dep.progress != null && ` · ${dep.progress}%`}
                      </div>
                      {dep.progress != null && <MiniBar value={dep.progress} max={100} color="var(--warning)" height={3} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Second row: Backup + Governance + UBS Distribution */}
      <div className="noc-grid--wide noc-grid" style={{ marginBottom: "var(--s-4)" }}>

        {/* Backup health */}
        <div className="console-section">
          <div className="console-section__header">
            <span>Backup & Continuidade</span>
            <button type="button" className="console-breadcrumb-link" style={{ fontSize: "var(--t-xs)" }} onClick={() => onGoTo("backup")}>Ver detalhes →</button>
          </div>
          <div className="console-section__body">
            {healthLoading ? <Skeleton count={2} /> : !backupDash ? (
              <EmptyState icon={<IcoBackup size={36} />} title="Sem dados de backup" text="Configure políticas de backup para monitorar aqui." />
            ) : (
              <div style={{ display: "flex", gap: "var(--s-5)", alignItems: "center", flexWrap: "wrap" }}>
                <DonutChart size={80} strokeWidth={10} segments={[
                  { value: backupDash.completed || 0,  color: "var(--success)" },
                  { value: backupDash.failed    || 0,  color: "var(--danger)"  },
                  { value: backupDash.scheduled || 0,  color: "var(--surface-3)" },
                ]} />
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
                  {[
                    { label: "Completos",  value: backupDash.completed || 0,     color: "var(--success)" },
                    { label: "Falharam",   value: backupDash.failed    || 0,     color: "var(--danger)"  },
                    { label: "Agendados",  value: backupDash.scheduled || 0,     color: "var(--text-dim)" },
                    { label: "Políticas",  value: backupDash.totalPolicies || 0, color: "var(--accent)" },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", gap: "var(--s-2)", alignItems: "center", fontSize: "var(--t-sm)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0, display: "inline-block" }} />
                      <span style={{ color: "var(--text-muted)" }}>{r.label}</span>
                      <span style={{ fontWeight: 600, marginLeft: "auto" }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Governance compliance */}
        <div className="console-section">
          <div className="console-section__header">
            <span>Governança & Compliance</span>
            <button type="button" className="console-breadcrumb-link" style={{ fontSize: "var(--t-xs)" }} onClick={() => onGoTo("governance")}>Ver detalhes →</button>
          </div>
          <div className="console-section__body">
            {!govDash ? (
              <EmptyState icon={<IcoScale size={36} />} title="Sem dados de governança" text="Crie baselines e políticas para monitorar compliance aqui." />
            ) : (
              <div style={{ display: "flex", gap: "var(--s-5)", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <DonutChart size={80} strokeWidth={10} segments={[
                    { value: govDash.complianceScore || 0,            color: govDash.complianceScore >= 80 ? "var(--success)" : govDash.complianceScore >= 60 ? "var(--warning)" : "var(--danger)" },
                    { value: 100 - (govDash.complianceScore || 0),    color: "var(--surface-3)" },
                  ]} />
                  <div style={{ position: "absolute", fontWeight: 800, fontSize: "1rem", color: "var(--text)" }}>
                    {govDash.complianceScore ?? "—"}%
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
                  {[
                    { label: "Baselines",   value: govDash.totalBaselines   || 0 },
                    { label: "Políticas",   value: govDash.totalPolicies     || 0 },
                    { label: "ADRs",        value: govDash.totalAdrs         || 0 },
                    { label: "Exceções",    value: govDash.pendingExceptions || 0, warn: true },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", gap: "var(--s-2)", alignItems: "center", fontSize: "var(--t-sm)" }}>
                      <span style={{ color: "var(--text-muted)" }}>{r.label}</span>
                      <span style={{ fontWeight: 600, marginLeft: "auto", color: r.warn && r.value > 0 ? "var(--warning)" : "var(--text)" }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Próximas ações */}
      {(() => {
        const actions = [];
        if (deployments.length > 0)
          actions.push({ priority: 1, icon: "🚀", label: `Finalizar implantação`, detail: `${deployments.length} em andamento`, onClick: () => onGoTo("deployments") });
        if (govDash?.compliance?.counts?.FAIL > 0)
          actions.push({ priority: 1, icon: "⚠️", label: "Resolver falhas de compliance", detail: `${govDash.compliance.counts.FAIL} FAIL(s) no Compliance Engine`, onClick: () => onGoTo("governance") });
        if (!backupDash || (backupDash?.restoreTests?.success === 0 && (backupDash?.policies?.total ?? 0) > 0))
          actions.push({ priority: 2, icon: "🔄", label: "Executar teste de restore", detail: "GOV-C08 em WARNING — nenhum restore nos últimos 30 dias", onClick: () => onGoTo("backup") });
        if ((govDash?.baselines?.review ?? 0) > 0)
          actions.push({ priority: 2, icon: "✅", label: "Aprovar baseline pendente", detail: `${govDash.baselines.review} baseline(s) em revisão`, onClick: () => onGoTo("governance") });
        if ((backupDash?.policies?.total ?? 0) === 0)
          actions.push({ priority: 2, icon: "🗄️", label: "Configurar política de backup", detail: "Nenhuma política de backup ativa", onClick: () => onGoTo("backup") });
        if (incidents.filter(i => i.severity === "CRITICAL" && i.status !== "RESOLVED").length > 0)
          actions.push({ priority: 1, icon: "🔴", label: "Responder incidente crítico", detail: `${incidents.filter(i => i.severity === "CRITICAL" && i.status !== "RESOLVED").length} incidente(s) crítico(s) aberto(s)`, onClick: () => onGoTo("incidents") });
        if (actions.length === 0) return null;
        actions.sort((a, b) => a.priority - b.priority);
        return (
          <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
            <div className="console-section__header">Próximas ações</div>
            <div className="console-section__body" style={{ padding: 0 }}>
              {actions.map((act, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={act.onClick}
                  style={{ display: "flex", gap: "var(--s-3)", alignItems: "center", padding: "var(--s-3) var(--s-4)", borderBottom: i < actions.length - 1 ? "1px solid var(--border-subtle)" : "none", background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
                >
                  <span style={{ fontSize: "1.2rem", width: 28, textAlign: "center", flexShrink: 0 }}>{act.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "var(--t-base)", color: "var(--text)" }}>{act.label}</div>
                    <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>{act.detail}</div>
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>→</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* UBS Status distribution */}
      {summary && (
        <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
          <div className="console-section__header">Distribuição de Status — UBS</div>
          <div className="console-section__body">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {[
                { label: STATUS_LABELS.active,       value: summary.active       || 0, color: "var(--success)", total: summary.totalUnits || 1 },
                { label: STATUS_LABELS.onboarding,   value: summary.onboarding   || 0, color: "var(--warning)", total: summary.totalUnits || 1 },
                { label: STATUS_LABELS.homologation, value: summary.homologation || 0, color: "var(--accent)",  total: summary.totalUnits || 1 },
                { label: STATUS_LABELS.suspended,    value: summary.suspended    || 0, color: "var(--danger)",  total: summary.totalUnits || 1 },
                { label: STATUS_LABELS.draft,        value: summary.draft        || 0, color: "var(--text-dim)",total: summary.totalUnits || 1 },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", fontSize: "var(--t-sm)" }}>
                  <span style={{ width: 110, color: "var(--text-muted)", flexShrink: 0 }}>{s.label}</span>
                  <div style={{ flex: 1 }}>
                    <MiniBar value={s.value} max={s.total} color={s.color} height={8} />
                  </div>
                  <span style={{ fontWeight: 700, width: 32, textAlign: "right", color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Municipality Picker ────────────────────────────────────────────────────
// Replaces free-text Município + Código IBGE fields with a search-driven selector.
// Queries GET /platform/municipalities?search=... and lets admin pick from list.

function MunicipalityPicker({ token, value, onSelect }) {
  // value: { ibgeCode, name, uf } | null
  const [query,    setQuery]    = useState(value?.name || "");
  const [results,  setResults]  = useState([]);
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const timerRef = useRef(null);

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);
    clearTimeout(timerRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(() => search(q.trim()), 280);
  }

  async function search(q) {
    setLoading(true);
    try {
      const data = await apiFetch(`/platform/municipalities?search=${encodeURIComponent(q)}&limit=10`, token);
      setResults(data?.municipalities || []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }

  function pick(m) {
    setQuery(m.name + " — " + m.uf);
    setOpen(false);
    setResults([]);
    onSelect(m);
  }

  function handleBlur() {
    setTimeout(() => setOpen(false), 180);
  }

  return (
    <div className="field" style={{ position: "relative" }}>
      <label className="field__label">Município * <span style={{ fontSize: "0.8em", fontWeight: 400, opacity: 0.6 }}>(busque pelo nome ou código IBGE)</span></label>
      <div className="input">
        <input
          value={query}
          onChange={handleInput}
          onFocus={() => { if (results.length) setOpen(true); }}
          onBlur={handleBlur}
          placeholder="Ex: Recife, São Paulo, 3534401..."
          autoComplete="off"
        />
      </div>
      {value?.ibgeCode && (
        <span style={{ fontSize: "var(--t-xs)", color: "var(--text-dim)", marginTop: 2, display: "block" }}>
          IBGE: {value.ibgeCode} · UF: {value.uf}
        </span>
      )}
      {open && (loading || results.length > 0) && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,.15)",
          maxHeight: 260, overflowY: "auto",
        }}>
          {loading && <div style={{ padding: "var(--s-3)", fontSize: "var(--t-sm)", color: "var(--text-dim)" }}>Buscando...</div>}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div style={{ padding: "var(--s-3)", fontSize: "var(--t-sm)", color: "var(--text-dim)" }}>Nenhum município encontrado.</div>
          )}
          {results.map((m) => (
            <button
              key={m.id || m.ibgeCode}
              type="button"
              onMouseDown={() => pick(m)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "var(--s-2) var(--s-3)", background: "transparent",
                border: "none", cursor: "pointer", fontSize: "var(--t-sm)",
                color: "var(--text)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <strong>{m.name}</strong>
              <span style={{ marginLeft: 8, color: "var(--text-dim)" }}>{m.uf} · {m.ibgeCode}</span>
              {m.isCapital && <span style={{ marginLeft: 8, fontSize: "0.75em", color: "var(--accent)" }}>capital</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Municipality Status helpers ────────────────────────────────────────────

const MUN_STATUS_LABEL = {
  IMPLANTACAO: "Implantação",
  OPERACIONAL: "Operacional",
  SUSPENSO:    "Suspenso",
  ARQUIVADO:   "Arquivado",
};
const MUN_STATUS_BADGE = {
  IMPLANTACAO: "badge badge--warning",
  OPERACIONAL: "badge badge--success",
  SUSPENSO:    "badge badge--danger",
  ARQUIVADO:   "badge",
};

// ── Novo Município Modal (IBGE search → select → create) ───────────────────

function NovoMunicipioModal({ token, onClose, onCreate }) {
  const [query,      setQuery]    = useState("");
  const [results,    setResults]  = useState([]);
  const [searching,  setSearching]= useState(false);
  const [selected,   setSelected] = useState(null);
  const [status,     setStatus]   = useState("IMPLANTACAO");
  const [licType,    setLicType]  = useState("");
  const [notes,      setNotes]    = useState("");
  const [busy,       setBusy]     = useState(false);
  const [error,      setError]    = useState("");
  const timerRef = useRef(null);

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    setSelected(null);
    clearTimeout(timerRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(() => doSearch(q.trim()), 300);
  }

  async function doSearch(q) {
    setSearching(true);
    try {
      const data = await apiFetch(`/platform/municipalities?search=${encodeURIComponent(q)}&limit=10`, token);
      setResults(data?.municipalities || []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }

  function pick(m) {
    setSelected(m);
    setQuery(m.name + " — " + m.uf);
    setResults([]);
  }

  async function handleCreate() {
    if (!selected) { setError("Selecione um município da lista."); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/platform/municipalities", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ibgeCode:    selected.ibgeCode,
          name:        selected.name,
          uf:          selected.uf,
          region:      selected.region || null,
          isCapital:   selected.isCapital || false,
          status,
          licenseType: licType || null,
          notes,
        }),
      });
      const b = await r.json();
      if (!r.ok) { setError(b.error || "Erro ao cadastrar município."); return; }
      onCreate(b);
    } catch { setError("Erro de rede."); }
    finally { setBusy(false); }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "var(--surface)", borderRadius: 10, padding: "var(--s-5)",
        width: "min(520px, 95vw)", boxShadow: "0 8px 40px rgba(0,0,0,.25)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--s-4)" }}>
          <h2 style={{ margin: 0, fontSize: "var(--t-lg)", fontWeight: 600 }}>Cadastrar Município</h2>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer", color: "var(--text-dim)" }}>×</button>
        </div>

        {/* Step 1: Search IBGE */}
        <div style={{ marginBottom: "var(--s-4)" }}>
          <label className="field__label">Pesquisar município (IBGE)</label>
          <div style={{ position: "relative" }}>
            <div className="input">
              <input
                autoFocus
                value={query}
                onChange={handleInput}
                placeholder="Ex: Recife, São Paulo, 3534401..."
                autoComplete="off"
              />
            </div>
            {(searching || results.length > 0) && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,.15)",
                maxHeight: 220, overflowY: "auto",
              }}>
                {searching && <div style={{ padding: "var(--s-3)", color: "var(--text-dim)", fontSize: "var(--t-sm)" }}>Buscando...</div>}
                {!searching && results.map(m => (
                  <button key={m.ibgeCode} type="button" onMouseDown={() => pick(m)} style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "var(--s-2) var(--s-3)", background: "transparent",
                    border: "none", cursor: "pointer", fontSize: "var(--t-sm)", color: "var(--text)",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--hover)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <strong>{m.name}</strong>
                    <span style={{ marginLeft: 8, color: "var(--text-dim)" }}>{m.uf} · IBGE {m.ibgeCode}</span>
                    {m.isCapital && <span style={{ marginLeft: 6, fontSize: "0.75em", color: "var(--accent)" }}>capital</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selected && (
            <div style={{ marginTop: "var(--s-2)", padding: "var(--s-2) var(--s-3)", background: "var(--surface-raised)", borderRadius: 6, fontSize: "var(--t-sm)", color: "var(--text-dim)" }}>
              ✓ {selected.name} — {selected.uf} · IBGE {selected.ibgeCode}
            </div>
          )}
        </div>

        {/* Step 2: Status */}
        <div style={{ display: "flex", gap: "var(--s-3)", marginBottom: "var(--s-3)", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <label className="field__label">Status inicial</label>
            <select className="input" style={{ width: "100%" }} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="IMPLANTACAO">Implantação</option>
              <option value="OPERACIONAL">Operacional</option>
              <option value="SUSPENSO">Suspenso</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="field__label">Tipo de licença (opcional)</label>
            <input className="input" style={{ width: "100%" }} value={licType} onChange={e => setLicType(e.target.value)} placeholder="Starter, Professional, Enterprise..." />
          </div>
        </div>

        <div style={{ marginBottom: "var(--s-4)" }}>
          <label className="field__label">Notas (opcional)</label>
          <textarea className="input" rows={2} style={{ width: "100%", resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações sobre o contrato ou implantação..." />
        </div>

        {error && <div className="alert alert--danger" style={{ marginBottom: "var(--s-3)" }}>{error}</div>}

        <div style={{ display: "flex", gap: "var(--s-2)", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!selected || busy} loading={busy}>
            Cadastrar Município
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Municipality List View ─────────────────────────────────────────────────

function MunicipalityListView({ token, onSelect }) {
  const [search,    setSearch]  = useState("");
  const [uf,        setUf]      = useState("");
  const [status,    setStatus]  = useState("");
  const [items,     setItems]   = useState([]);
  const [total,     setTotal]   = useState(0);
  const [pages,     setPages]   = useState(1);
  const [page,      setPage]    = useState(1);
  const [loading,   setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => { load(1); }, [uf, status]); // eslint-disable-line

  function handleSearchChange(e) {
    const q = e.target.value;
    setSearch(q);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => load(1, q), 300);
  }

  async function load(p = 1, q = search) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 25, registered: "true" });
      if (q.trim()) params.set("search", q.trim());
      if (uf)       params.set("uf", uf);
      if (status)   params.set("status", status);
      const data = await apiFetch(`/platform/municipalities?${params}`, token);
      setItems(data?.municipalities || []);
      setTotal(data?.total || 0);
      setPages(data?.pages || 1);
      setPage(p);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }

  function handleCreated(mun) {
    setShowModal(false);
    load(1);
    onSelect(mun);
  }

  return (
    <>
      {showModal && (
        <NovoMunicipioModal token={token} onClose={() => setShowModal(false)} onCreate={handleCreated} />
      )}

      <ModuleBanner
        icon={<IcoCity />}
        title="Municípios"
        subtitle="Clientes municipais ativos na plataforma VITRAS"
        color="#3b82f6"
        kpis={[{ label: "Cadastrados", value: total }]}
      >
        <div style={{ marginTop: "var(--s-2)" }}>
          <Button onClick={() => setShowModal(true)}>+ Novo Município</Button>
        </div>
      </ModuleBanner>

      {/* Filters */}

      <div style={{ display: "flex", gap: "var(--s-3)", marginBottom: "var(--s-4)", flexWrap: "wrap" }}>
        <div className="input" style={{ flex: "1 1 220px" }}>
          <input value={search} onChange={handleSearchChange} placeholder="Buscar por nome, IBGE..." />
        </div>
        <select className="console-filter-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={{ minWidth: 140 }}>
          <option value="">Todos os status</option>
          <option value="IMPLANTACAO">Implantação</option>
          <option value="OPERACIONAL">Operacional</option>
          <option value="SUSPENSO">Suspenso</option>
          <option value="ARQUIVADO">Arquivado</option>
        </select>
        <select className="console-filter-select" value={uf} onChange={e => { setUf(e.target.value); setPage(1); }} style={{ minWidth: 80 }}>
          <option value="">Todas as UFs</option>
          {UF_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {loading && (
        <div style={{ padding: "var(--s-6)", color: "var(--text-dim)", textAlign: "center" }}>Carregando municípios...</div>
      )}

      {!loading && items.length === 0 && (
        <div className="console-section">
          <EmptyState
            icon={<IcoCity size={36} />}
            title={search || uf || status ? "Nenhum município encontrado" : "Nenhum município cadastrado"}
            text={search || uf || status ? "Tente ajustar os filtros de busca." : "Cadastre o primeiro município VITRAS para começar."}
            cta={!search && !uf && !status ? "Cadastrar primeiro município" : undefined}
            onCta={() => setShowModal(true)}
          />
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div style={{ display: "grid", gap: "var(--s-3)", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", marginBottom: "var(--s-4)" }}>
            {items.map(m => (
              <button key={m.id} type="button" onClick={() => onSelect(m)} style={{
                textAlign: "left", background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "var(--s-4)", cursor: "pointer",
                transition: "box-shadow .15s", outline: "none",
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--s-2)" }}>
                  <strong style={{ fontSize: "var(--t-base)", color: "var(--text)" }}>{m.name}</strong>
                  <span className={MUN_STATUS_BADGE[m.status] || "badge"}>{MUN_STATUS_LABEL[m.status] || m.status}</span>
                </div>
                <div style={{ fontSize: "var(--t-sm)", color: "var(--text-dim)", marginBottom: "var(--s-2)" }}>
                  {m.uf} · IBGE {m.ibgeCode}
                  {m.licenseType && <span style={{ marginLeft: 8 }}>· {m.licenseType}</span>}
                </div>
                <div style={{ display: "flex", gap: "var(--s-4)", fontSize: "var(--t-sm)" }}>
                  <span><strong>{m.unitsCount ?? 0}</strong> <span style={{ color: "var(--text-dim)" }}>UBS</span></span>
                  <span><strong>{m.activeUnitsCount ?? 0}</strong> <span style={{ color: "var(--text-dim)" }}>operacionais</span></span>
                </div>
              </button>
            ))}
          </div>
          <div className="table-pagination">
            <span>{total} município{total !== 1 ? "s" : ""}{pages > 1 ? ` — página ${page} de ${pages}` : ""}</span>
            {pages > 1 && (
              <div style={{ display: "flex", gap: "var(--s-2)" }}>
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>← Anterior</Button>
                <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => load(page + 1)}>Próxima →</Button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ── Municipality Detail View ───────────────────────────────────────────────

function MunicipalityDetailView({ token, municipality, onBack, onGoToUnit, onGoToNewUnit }) {
  const [munDetail, setMunDetail] = useState(null);
  const [units,     setUnits]     = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [deploys,   setDeploys]   = useState([]);
  const [licenses,  setLicenses]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [munTab,    setMunTab]     = useState("overview");
  const [statusEdit, setStatusEdit] = useState(false);
  const [newStatus,  setNewStatus]  = useState(municipality?.status || "IMPLANTACAO");
  const [savingStatus, setSavingStatus] = useState(false);

  const m = municipality;

  useEffect(() => {
    if (!m?.ibgeCode) return;
    setLoading(true);
    Promise.all([
      apiFetch(`/platform/units?municipalityId=${m.ibgeCode}&limit=100`, token).catch(() => ({})),
      apiFetch(`/platform/incidents?municipalityId=${m.ibgeCode}&limit=20`, token).catch(() => ({})),
      apiFetch(`/platform/deployments?municipalityId=${m.ibgeCode}&limit=20`, token).catch(() => ({})),
      apiFetch(`/platform/licenses?municipalityId=${m.ibgeCode}&limit=10`, token).catch(() => ({})),
    ]).then(([u, inc, dep, lic]) => {
      setUnits(u?.units || []);
      setIncidents(inc?.incidents || []);
      setDeploys(dep?.deployments || []);
      setLicenses(lic?.licenses || []);
      setMunDetail(m);
    }).finally(() => setLoading(false));
  }, [m, token]);

  async function saveStatus() {
    setSavingStatus(true);
    try {
      await fetch(`/api/platform/municipalities/${m.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      setStatusEdit(false);
    } catch { /* ignore */ }
    finally { setSavingStatus(false); }
  }

  const tabs = [
    { key: "overview",     label: "Visão Geral" },
    { key: "units",        label: `UBSs (${units.length})` },
    { key: "deployments",  label: "Implantação" },
    { key: "licenses",     label: "Licença" },
    { key: "incidents",    label: `Incidentes (${incidents.length})` },
  ];

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", marginBottom: "var(--s-3)", fontSize: "var(--t-sm)", color: "var(--text-dim)" }}>
        <button type="button" className="console-breadcrumb-link" onClick={onBack}>Municípios</button>
        <span>›</span>
        <span style={{ color: "var(--text)" }}>{m?.name}</span>
      </div>

      <div className="console-page-header" style={{ marginBottom: "var(--s-3)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", flexWrap: "wrap" }}>
            <h1 className="console-page-header__title" style={{ margin: 0 }}>{m?.name}</h1>
            {statusEdit ? (
              <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center" }}>
                <select className="input" value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{ fontSize: "var(--t-sm)" }}>
                  <option value="IMPLANTACAO">Implantação</option>
                  <option value="OPERACIONAL">Operacional</option>
                  <option value="SUSPENSO">Suspenso</option>
                  <option value="ARQUIVADO">Arquivado</option>
                </select>
                <Button size="sm" onClick={saveStatus} disabled={savingStatus}>Salvar</Button>
                <Button size="sm" variant="secondary" onClick={() => setStatusEdit(false)}>Cancelar</Button>
              </div>
            ) : (
              <button type="button" className={MUN_STATUS_BADGE[m?.status] || "badge"} onClick={() => setStatusEdit(true)} title="Clique para alterar status">
                {MUN_STATUS_LABEL[m?.status] || m?.status}
              </button>
            )}
          </div>
          <p className="console-page-header__sub" style={{ marginTop: "var(--s-1)" }}>
            {m?.uf} · IBGE {m?.ibgeCode}
            {m?.licenseType && <span> · {m.licenseType}</span>}
            {m?.isCapital && <span className="badge badge--info" style={{ marginLeft: 8, fontSize: "0.75em" }}>capital</span>}
          </p>
        </div>
        <Button variant="secondary" onClick={onBack}>← Municípios</Button>
      </div>

      {/* KPI strip */}
      <div className="console-kpi-strip" style={{ marginBottom: "var(--s-4)" }}>
        {[
          { label: "UBS cadastradas",  value: units.length,                                              cls: "console-kpi--accent" },
          { label: "Operacionais",     value: units.filter(u => u.status === "active").length,           cls: "console-kpi--success" },
          { label: "Implantações",     value: deploys.length,                                            cls: "" },
          { label: "Licenças",         value: licenses.length,                                           cls: "" },
          { label: "Incidentes",       value: incidents.filter(i => i.status !== "CLOSED").length,       cls: incidents.some(i => i.severity === "CRITICAL" && i.status !== "CLOSED") ? "console-kpi--danger" : "" },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`console-kpi ${cls}`}>
            <div className="console-kpi__value">{loading ? "—" : value}</div>
            <div className="console-kpi__label">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "var(--s-2)", marginBottom: "var(--s-4)", borderBottom: "1px solid var(--border)", paddingBottom: "var(--s-2)", flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.key} type="button"
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "var(--s-2) var(--s-3)",
              fontSize: "var(--t-sm)", fontWeight: munTab === t.key ? 600 : 400,
              color: munTab === t.key ? "var(--accent)" : "var(--text-dim)",
              borderBottom: munTab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
            }}
            onClick={() => setMunTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: "var(--s-5)", color: "var(--text-dim)" }}>Carregando...</div>}

      {/* ── Tab: Visão Geral ───────────────────────────────────────────────── */}
      {!loading && munTab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)", marginBottom: "var(--s-4)" }}>
            <div className="card" style={{ padding: "var(--s-4)" }}>
              <h3 style={{ margin: "0 0 var(--s-3)", fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".05em" }}>Identificação</h3>
              {[
                ["Nome",      m?.name],
                ["UF",        m?.uf],
                ["IBGE",      m?.ibgeCode],
                ["Região",    m?.region || "—"],
                ["Capital",   m?.isCapital ? "Sim" : "Não"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--s-1)", fontSize: "var(--t-sm)" }}>
                  <span style={{ color: "var(--text-dim)" }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: "var(--s-4)" }}>
              <h3 style={{ margin: "0 0 var(--s-3)", fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".05em" }}>Contrato</h3>
              {[
                ["Status",    MUN_STATUS_LABEL[m?.status] || m?.status],
                ["Licença",   m?.licenseType || "—"],
                ["Cadastrado", m?.createdAt ? new Date(m.createdAt).toLocaleDateString("pt-BR") : "—"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--s-1)", fontSize: "var(--t-sm)" }}>
                  <span style={{ color: "var(--text-dim)" }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
              {m?.notes && (
                <div style={{ marginTop: "var(--s-3)", padding: "var(--s-2)", background: "var(--surface-raised)", borderRadius: 4, fontSize: "var(--t-sm)", color: "var(--text-dim)" }}>
                  {m.notes}
                </div>
              )}
            </div>
          </div>
          {/* Recent incidents summary */}
          {incidents.filter(i => i.status !== "CLOSED").length > 0 && (
            <div className="alert alert--warning" style={{ marginBottom: "var(--s-3)" }}>
              <strong>{incidents.filter(i => i.status !== "CLOSED").length}</strong> incidente(s) aberto(s) neste município.
            </div>
          )}
        </div>
      )}

      {/* ── Tab: UBSs ─────────────────────────────────────────────────────── */}
      {!loading && munTab === "units" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--s-3)" }}>
            <Button onClick={() => onGoToNewUnit && onGoToNewUnit(m)}>+ Nova UBS</Button>
          </div>
          {units.length === 0 ? (
            <div style={{ padding: "var(--s-6)", textAlign: "center", color: "var(--text-dim)" }}>
              <p>Nenhuma UBS cadastrada neste município.</p>
              <Button onClick={() => onGoToNewUnit && onGoToNewUnit(m)}>Cadastrar primeira UBS</Button>
            </div>
          ) : (
            <div className="console-table-wrap">
              <table className="console-table">
                <thead>
                  <tr><th>Nome</th><th>CNES</th><th>Status</th><th>Equipes</th><th></th></tr>
                </thead>
                <tbody>
                  {units.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong></td>
                      <td style={{ color: "var(--text-dim)", fontSize: "var(--t-sm)" }}>{u.cnes || "—"}</td>
                      <td><span className={STATUS_BADGE[u.status] || "badge"}>{STATUS_LABELS[u.status] || u.status}</span></td>
                      <td>{u.teamIds?.length ?? 0}</td>
                      <td style={{ textAlign: "right" }}>
                        <Button size="sm" variant="secondary" onClick={() => onGoToUnit(u)}>Abrir →</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Implantação ──────────────────────────────────────────────── */}
      {!loading && munTab === "deployments" && (
        <div>
          {deploys.length === 0 ? (
            <div style={{ padding: "var(--s-6)", textAlign: "center", color: "var(--text-dim)" }}>Nenhuma implantação registrada.</div>
          ) : (
            <div className="console-table-wrap">
              <table className="console-table">
                <thead><tr><th>Código</th><th>Tipo</th><th>Status</th><th>Responsável</th><th>Início</th></tr></thead>
                <tbody>
                  {deploys.map(d => (
                    <tr key={d.id}>
                      <td><code style={{ fontSize: "var(--t-xs)" }}>{d.code || d.id.slice(0, 8)}</code></td>
                      <td><span className="badge">{d.type === "MUNICIPAL" ? "Municipal" : "UBS"}</span></td>
                      <td><span className={DEPLOYMENT_STATUS_CLASS[d.status] || "badge"}>{DEPLOYMENT_STATUS_LABELS[d.status] || d.status}</span></td>
                      <td style={{ color: "var(--text-dim)", fontSize: "var(--t-sm)" }}>{d.responsibleName || "—"}</td>
                      <td style={{ color: "var(--text-dim)", fontSize: "var(--t-sm)" }}>{d.startDate ? new Date(d.startDate).toLocaleDateString("pt-BR") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Licença ──────────────────────────────────────────────────── */}
      {!loading && munTab === "licenses" && (
        <div>
          {licenses.length === 0 ? (
            <div style={{ padding: "var(--s-6)", textAlign: "center", color: "var(--text-dim)" }}>Nenhuma licença registrada.</div>
          ) : licenses.map(l => (
            <div key={l.id} className="card" style={{ padding: "var(--s-4)", marginBottom: "var(--s-3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--s-2)" }}>
                <strong>{l.planId || l.planName || "—"}</strong>
                <span className={l.licenseStatus === "ACTIVE" ? "badge badge--success" : "badge"}>{l.licenseStatus || "—"}</span>
              </div>
              <div style={{ fontSize: "var(--t-sm)", color: "var(--text-dim)" }}>
                Código: {l.licenseCode || "—"} · Validade: {l.expiresAt ? new Date(l.expiresAt).toLocaleDateString("pt-BR") : "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Incidentes ───────────────────────────────────────────────── */}
      {!loading && munTab === "incidents" && (
        <div>
          {incidents.length === 0 ? (
            <div style={{ padding: "var(--s-6)", textAlign: "center", color: "var(--text-dim)" }}>Nenhum incidente registrado.</div>
          ) : (
            <div className="console-table-wrap">
              <table className="console-table">
                <thead><tr><th>Código</th><th>Título</th><th>Severidade</th><th>Status</th><th>Abertura</th></tr></thead>
                <tbody>
                  {incidents.map(i => (
                    <tr key={i.id}>
                      <td><code style={{ fontSize: "var(--t-xs)" }}>{i.code || i.id.slice(0, 8)}</code></td>
                      <td>{i.title}</td>
                      <td><span className={`badge${i.severity === "CRITICAL" ? " badge--danger" : i.severity === "HIGH" ? " badge--warning" : ""}`}>{i.severity || "—"}</span></td>
                      <td><span className={`badge${i.status === "OPEN" ? " badge--danger" : i.status === "RESOLVED" ? " badge--success" : ""}`}>{i.status || "—"}</span></td>
                      <td style={{ color: "var(--text-dim)", fontSize: "var(--t-sm)" }}>{i.createdAt ? new Date(i.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Municipality Ico ───────────────────────────────────────────────────────

const IcoNoc = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <rect x="1" y="2" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M5 14h6M8 11v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M4 8l2-2 2 2 2-3 2 2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IcoIncident = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M8 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
  </svg>
);

const IcoGovernance = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M8 1L2 4v3c0 3.3 2.5 6.4 6 7 3.5-.6 6-3.7 6-7V4L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IcoCmdb = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="5.5" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 7v1.5c0 .3.2.5.5.5h6c.3 0 .5-.2.5-.5V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="8" y1="7" x2="8" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);


const IcoRelease = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
    <polyline points="5,8 7,10 11,6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IcoLicense = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="1.1"/>
    <path d="M13.4 12.4l1.2 1.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);

const IcoMunicipality = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M8 1l7 4v9H1V5l7-4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <rect x="5" y="9" width="2" height="3" rx=".5" fill="currentColor"/>
    <rect x="9" y="9" width="2" height="3" rx=".5" fill="currentColor"/>
    <rect x="6" y="5" width="4" height="2.5" rx=".5" stroke="currentColor" strokeWidth="1.1"/>
  </svg>
);

// ── Deployment Icons & Helpers ─────────────────────────────────────────────

const IcoDeployment = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DEPLOYMENT_STATUS_LABELS = {
  PLANNED:           "Planejado",
  CONFIGURING:       "Em Configuração",
  MIGRATING:         "Em Migração",
  VALIDATING:        "Em Validação",
  TRAINING:          "Em Treinamento",
  READY_FOR_GO_LIVE: "Pronto para Go Live",
  GO_LIVE:           "Go Live",
  OPERATIONAL:       "Operacional",
  PAUSED:            "Pausado",
  SUSPENDED:         "Suspenso",
  CANCELLED:         "Cancelado",
};

const DEPLOYMENT_STATUS_CLASS = {
  PLANNED:           "badge",
  CONFIGURING:       "badge badge--warning",
  MIGRATING:         "badge badge--warning",
  VALIDATING:        "badge badge--info",
  TRAINING:          "badge badge--info",
  READY_FOR_GO_LIVE: "badge badge--info",
  GO_LIVE:           "badge badge--success",
  OPERATIONAL:       "badge badge--success",
  PAUSED:            "badge",
  SUSPENDED:         "badge badge--danger",
  CANCELLED:         "badge badge--danger",
};

const DEPLOYMENT_ADVANCES = {
  PLANNED:           [{ to: "CONFIGURING", label: "Iniciar Configuração" }],
  CONFIGURING:       [{ to: "MIGRATING", label: "Iniciar Migração" }],
  MIGRATING:         [{ to: "VALIDATING", label: "Iniciar Validação" }],
  VALIDATING:        [{ to: "TRAINING", label: "Iniciar Treinamento" }],
  TRAINING:          [{ to: "READY_FOR_GO_LIVE", label: "Marcar Pronto" }],
  READY_FOR_GO_LIVE: [{ to: "GO_LIVE", label: "Executar Go Live" }],
  GO_LIVE:           [{ to: "OPERATIONAL", label: "Marcar Operacional" }],
  OPERATIONAL:       [],
  PAUSED:            [],
  SUSPENDED:         [],
  CANCELLED:         [],
};

// ── DeploymentListView ─────────────────────────────────────────────────────

function DeploymentListView({ token, onSelect }) {
  const [deployments, setDeployments] = useState([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [typeFilter, setTypeFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage]               = useState(1);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (typeFilter)   params.set("type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch(`/platform/deployments?${params}`, token);
      setDeployments(data.deployments || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token, page, typeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const pages = Math.ceil(total / LIMIT) || 1;

  return (
    <>
      <ModuleBanner
        icon={<IcoDeploy />}
        title="Implantações"
        subtitle="Ciclo de vida de implantação por município e UBS"
        color="#f59e0b"
        kpis={[
          { label: "Total", value: total },
        ]}
      />

      <div style={{ display: "flex", gap: "var(--s-3)", marginBottom: "var(--s-4)", flexWrap: "wrap" }}>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          style={{ padding: "var(--s-2) var(--s-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "var(--t-sm)" }}>
          <option value="">Todos os tipos</option>
          <option value="MUNICIPAL">Municipal</option>
          <option value="UBS">UBS</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ padding: "var(--s-2) var(--s-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "var(--t-sm)" }}>
          <option value="">Todos os status</option>
          {Object.entries(DEPLOYMENT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>Carregando...</p>
      ) : deployments.length === 0 ? (
        <div className="console-section">
          <p className="console-section-empty">Nenhuma implantação encontrada. Crie a primeira implantação a partir de um município.</p>
        </div>
      ) : (
        <div className="console-section">
          <div className="console-section__body" style={{ padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--t-sm)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Código","Tipo","Município","Status","Checklist","Go Live Previsto","Engenheiro"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "var(--s-2) var(--s-3)", color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {deployments.map(d => (
                  <tr key={d.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "var(--s-2) var(--s-3)", fontFamily: "monospace", fontSize: "var(--t-xs)" }}>{d.deploymentCode}</td>
                    <td style={{ padding: "var(--s-2) var(--s-3)" }}>
                      <span className="badge">{d.type === "MUNICIPAL" ? "Municipal" : "UBS"}</span>
                    </td>
                    <td style={{ padding: "var(--s-2) var(--s-3)" }}>{d.municipalityId}</td>
                    <td style={{ padding: "var(--s-2) var(--s-3)" }}>
                      <span className={DEPLOYMENT_STATUS_CLASS[d.status] || "badge"}>{DEPLOYMENT_STATUS_LABELS[d.status] || d.status}</span>
                    </td>
                    <td style={{ padding: "var(--s-2) var(--s-3)" }}>
                      {d.checklistSummary
                        ? `${d.checklistSummary.requiredDone}/${d.checklistSummary.required}`
                        : "—"}
                    </td>
                    <td style={{ padding: "var(--s-2) var(--s-3)" }}>{fmtDate(d.plannedGoLive)}</td>
                    <td style={{ padding: "var(--s-2) var(--s-3)", color: "var(--text-muted)" }}>{d.assignedEngineer?.name || "—"}</td>
                    <td style={{ padding: "var(--s-2) var(--s-3)" }}>
                      <Button size="sm" variant="secondary" onClick={() => onSelect(d)}>Abrir →</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div style={{ display: "flex", gap: "var(--s-2)", padding: "var(--s-3)", justifyContent: "flex-end" }}>
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Anterior</Button>
              <span style={{ padding: "var(--s-2)", fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>{page}/{pages}</span>
              <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Próximo ›</Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── DeploymentDetailView ───────────────────────────────────────────────────

function DeploymentDetailView({ token, deployment: initialDep, onBack }) {
  const [dep, setDep]       = useState(initialDep);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [reason, setReason]   = useState("");
  const [showReason, setShowReason] = useState(null); // action key

  async function reload() {
    try {
      const data = await apiFetch(`/platform/deployments/${dep.id}`, token);
      setDep(data);
    } catch { /* ignore */ }
  }

  async function doAction(action, body = {}) {
    setLoading(true); setErr("");
    try {
      const data = await apiFetch(`/platform/deployments/${dep.id}/${action}`, token, {
        method: "POST", body,
      });
      setDep(data);
      setShowReason(null); setReason("");
    } catch (e) {
      setErr(e?.message || "Erro ao executar ação");
    } finally { setLoading(false); }
  }

  async function doAdvance(toStatus) {
    setLoading(true); setErr("");
    try {
      const data = await apiFetch(`/platform/deployments/${dep.id}/advance`, token, {
        method: "POST", body: { toStatus, reason: reason || null },
      });
      setDep(data);
      setShowReason(null); setReason("");
    } catch (e) {
      setErr(e?.message || "Erro ao avançar status");
    } finally { setLoading(false); }
  }

  async function toggleChecklistItem(item) {
    setLoading(true); setErr("");
    try {
      const data = await apiFetch(`/platform/deployments/${dep.id}/checklist/${item.id}`, token, {
        method: "PATCH", body: { done: !item.done },
      });
      setDep(data);
    } catch (e) {
      setErr(e?.message || "Erro ao atualizar checklist");
    } finally { setLoading(false); }
  }

  const summary = dep.checklistSummary || {};
  const advances = DEPLOYMENT_ADVANCES[dep.status] || [];
  const isPaused = dep.status === "PAUSED";
  const canPause = ["CONFIGURING","MIGRATING","VALIDATING","TRAINING","READY_FOR_GO_LIVE","GO_LIVE","OPERATIONAL"].includes(dep.status);
  const canCancel = ["PLANNED","CONFIGURING","MIGRATING","VALIDATING","TRAINING","READY_FOR_GO_LIVE","PAUSED","SUSPENDED"].includes(dep.status);

  const byCategory = dep.checklist?.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {}) || {};

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", marginBottom: "var(--s-4)", fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: "var(--t-sm)", padding: 0 }}>
          Implantações
        </button>
        <span>›</span>
        <span style={{ color: "var(--text)" }}>{dep.deploymentCode}</span>
      </div>

      <div className="console-page-header">
        <div>
          <h1 className="console-page-header__title" style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
            {dep.deploymentCode}
            <span className={DEPLOYMENT_STATUS_CLASS[dep.status] || "badge"} style={{ fontSize: "var(--t-sm)", fontWeight: 500 }}>
              {DEPLOYMENT_STATUS_LABELS[dep.status] || dep.status}
            </span>
          </h1>
          <p className="console-page-header__sub">
            {dep.type === "MUNICIPAL" ? "Implantação Municipal" : "Implantação UBS"} · Município {dep.municipalityId}
            {dep.plannedGoLive && ` · Go Live previsto: ${fmtDate(dep.plannedGoLive)}`}
          </p>
        </div>
      </div>

      {err && <Alert type="error" style={{ marginBottom: "var(--s-3)" }}>{err}</Alert>}

      {/* Actions */}
      {dep.status !== "CANCELLED" && dep.status !== "OPERATIONAL" && (
        <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap", marginBottom: "var(--s-4)" }}>
          {advances.map(adv => (
            <Button key={adv.to} loading={loading} onClick={() => doAdvance(adv.to)}>
              {adv.label}
            </Button>
          ))}
          {canPause && !isPaused && (
            <Button variant="secondary" loading={loading} onClick={() => doAction("pause", { reason: "Pausado manualmente" })}>
              Pausar
            </Button>
          )}
          {isPaused && (
            <Button loading={loading} onClick={() => doAction("resume", {})}>Retomar</Button>
          )}
          {canCancel && (
            <Button variant="danger" loading={loading} onClick={() => doAction("cancel", { reason: "Cancelado manualmente" })}>
              Cancelar
            </Button>
          )}
        </div>
      )}

      {/* Checklist progress */}
      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header">
          <h2 className="console-section__title">
            Checklist
            <span style={{ marginLeft: "var(--s-2)", color: "var(--text-muted)", fontWeight: 400, fontSize: "var(--t-sm)" }}>
              {summary.requiredDone}/{summary.required} obrigatórios concluídos
              {summary.readyForGoLive && <span style={{ color: "var(--success)", marginLeft: "var(--s-2)" }}>✓ Pronto para Go Live</span>}
            </span>
          </h2>
        </div>
        <div className="console-section__body">
          {/* Progress bar */}
          <div style={{ height: 6, background: "var(--border)", borderRadius: 3, marginBottom: "var(--s-4)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3,
              background: summary.readyForGoLive ? "var(--success)" : "var(--accent)",
              width: `${summary.required > 0 ? Math.round((summary.requiredDone / summary.required) * 100) : 0}%`,
              transition: "width .3s ease",
            }} />
          </div>

          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: "var(--s-4)" }}>
              <div style={{ fontSize: "var(--t-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-muted)", marginBottom: "var(--s-2)" }}>
                {cat}
              </div>
              {items.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", padding: "var(--s-2) 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleChecklistItem(item)}
                    disabled={loading || dep.status === "CANCELLED"}
                    style={{ cursor: "pointer", width: 16, height: 16, flexShrink: 0 }}
                  />
                  <span style={{
                    fontSize: "var(--t-sm)",
                    color: item.done ? "var(--text-muted)" : "var(--text)",
                    textDecoration: item.done ? "line-through" : "none",
                    flex: 1,
                  }}>
                    {item.description}
                    {item.required && !item.done && (
                      <span style={{ color: "var(--danger)", marginLeft: "var(--s-1)", fontSize: "var(--t-xs)" }}>*</span>
                    )}
                  </span>
                  {item.done && item.doneBy && (
                    <span style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>
                      {item.doneBy.name} · {fmtDate(item.doneAt)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="console-section">
        <div className="console-section__header">
          <h2 className="console-section__title">Timeline</h2>
        </div>
        <div className="console-section__body">
          {(dep.timeline || []).length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>Nenhum evento registrado.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {[...(dep.timeline || [])].reverse().map(ev => (
                <div key={ev.id} style={{ display: "flex", gap: "var(--s-3)", fontSize: "var(--t-sm)", padding: "var(--s-2) 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <span style={{ color: "var(--text-muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums", fontSize: "var(--t-xs)" }}>
                    {fmtDate(ev.at)}
                  </span>
                  <span style={{ flex: 1 }}>
                    <strong style={{ color: "var(--text)", marginRight: "var(--s-2)" }}>{ev.event}</strong>
                    {ev.from && ev.to && (
                      <span style={{ color: "var(--text-muted)" }}>{ev.from} → {ev.to}</span>
                    )}
                    {ev.reason && <span style={{ color: "var(--text-muted)", marginLeft: "var(--s-2)" }}>· {ev.reason}</span>}
                  </span>
                  <span style={{ color: "var(--text-muted)", flexShrink: 0, fontSize: "var(--t-xs)" }}>{ev.by?.name || ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Unit Table ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

function UnitTable({ token, onSelect }) {
  const [units, setUnits]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const [search, setSearch]             = useState("");
  const [filterUf, setFilterUf]         = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy]             = useState("name");
  const [sortDir, setSortDir]           = useState("asc");

  const debounceRef = useRef(null);

  const load = useCallback((p = 1, s = search, uf = filterUf, st = filterStatus, sb = sortBy, sd = sortDir) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(p), limit: String(PAGE_SIZE),
      sortBy: sb, sortDir: sd,
      ...(s  ? { search: s } : {}),
      ...(uf ? { uf }       : {}),
      ...(st ? { status: st } : {})
    });
    apiFetch(`/platform/units?${params}`, token)
      .then((res) => {
        setUnits(res.units || []);
        setTotal(res.total || 0);
        setPages(res.pages || 1);
        setPage(p);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, search, filterUf, filterStatus, sortBy, sortDir]);

  useEffect(() => { load(1); }, [load]);

  function handleSearch(val) {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(1, val, filterUf, filterStatus, sortBy, sortDir), 300);
  }

  function handleSort(col) {
    const nd = sortBy === col && sortDir === "asc" ? "desc" : "asc";
    setSortBy(col); setSortDir(nd);
    load(1, search, filterUf, filterStatus, col, nd);
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return <span style={{ opacity: .3, marginLeft: 3, fontSize: 11 }}>⇅</span>;
    return <span style={{ marginLeft: 3, fontSize: 11 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="console-toolbar">
        <div className="console-toolbar__search">
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nome, CNES, município ou gestor..."
          />
        </div>
        <div className="console-toolbar__filters">
          <select
            className="console-filter-select"
            value={filterUf}
            onChange={(e) => { setFilterUf(e.target.value); load(1, search, e.target.value, filterStatus, sortBy, sortDir); }}
          >
            <option value="">UF</option>
            {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
          <select
            className="console-filter-select"
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); load(1, search, filterUf, e.target.value, sortBy, sortDir); }}
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      {error && <Alert type="error" style={{ marginBottom: "var(--s-3)" }}>{error}</Alert>}

      {/* Table */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {[
                { col: "name",             label: "Unidade de Saúde" },
                { col: "cnes",             label: "CNES" },
                { col: "municipalityName", label: "Município / UF" },
                { col: "status",           label: "Status" },
                { col: null,               label: "Equipes" },
                { col: null,               label: "Gestores" },
                { col: null,               label: "Usuários" },
                { col: "createdAt",        label: "Cadastro" },
              ].map(({ col, label }) => (
                <th key={label} onClick={col ? () => handleSort(col) : undefined} style={{ cursor: col ? "pointer" : "default" }}>
                  {label}{col && <SortIcon col={col} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "var(--s-8)", color: "var(--text-muted)" }}>Carregando...</td></tr>
            )}
            {!loading && units.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "var(--s-8)", color: "var(--text-muted)" }}>
                {search || filterUf || filterStatus
                  ? "Nenhuma UBS encontrada para os filtros aplicados."
                  : "Nenhuma UBS cadastrada."}
              </td></tr>
            )}
            {units.map((u) => (
              <tr key={u.id} onClick={() => onSelect(u)}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td><span className="num">{u.cnes || "—"}</span></td>
                <td>
                  {u.municipalityName || "—"}
                  {u.uf && <span style={{ marginLeft: "var(--s-2)", fontWeight: 700, fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>{u.uf}</span>}
                </td>
                <td><StatusBadge status={u.status} /></td>
                <td style={{ textAlign: "center" }}>{u.teamCount ?? 0}</td>
                <td style={{ textAlign: "center" }}>{u.gestorCount ?? 0}</td>
                <td style={{ textAlign: "center" }}>{u.userCount ?? 0}</td>
                <td style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>{fmtDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(pages > 1 || total > 0) && (
          <div className="table-pagination">
            <span>{total} UBS no total{pages > 1 ? ` — página ${page} de ${pages}` : ""}</span>
            {pages > 1 && (
              <div style={{ display: "flex", gap: "var(--s-2)" }}>
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>← Anterior</Button>
                <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => load(page + 1)}>Próxima →</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CEP field with autocomplete ────────────────────────────────────────────

function CepField({ value, onChange, onAutoFill }) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError,   setCepError]   = useState("");
  const [autoFilled, setAutoFilled] = useState(false);

  async function handleCepChange(e) {
    const raw = e.target.value;
    setCepError(""); setAutoFilled(false);
    onChange(raw);
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const addr = await lookupCep(digits);
      onAutoFill(addr);
      setAutoFilled(true);
    } catch (err) {
      setCepError(err.message);
    } finally {
      setCepLoading(false);
    }
  }

  return (
    <div className="field">
      <label className="field__label">
        CEP *
        {cepLoading && <span className="console-cep-loading"> consultando...</span>}
        {autoFilled && !cepLoading && <span className="console-cep-ok"> ✓ preenchido</span>}
      </label>
      <div className="input">
        <input
          value={formatCep(value)}
          onChange={handleCepChange}
          placeholder="00000-000"
          maxLength={9}
        />
      </div>
      {cepError && <span className="field__error">{cepError} — preencha manualmente.</span>}
    </div>
  );
}

// ── Shared unit form fields ─────────────────────────────────────────────────

function UnitFormFields({ token, form, setField, autoFilledFields, showStatus, hideMunicipality }) {
  function set(key) { return (e) => setField(key, e.target.value); }

  function handleAutoFill(addr) {
    setField("street",           addr.street);
    setField("neighborhood",     addr.neighborhood);
    setField("municipalityName", addr.municipalityName);
    setField("uf",               addr.uf);
    if (addr.municipalityId) setField("municipalityId", addr.municipalityId);
  }

  function handleMunicipalitySelect(m) {
    setField("municipalityId",   m.ibgeCode);
    setField("municipalityName", m.name);
    setField("uf",               m.uf);
  }

  const hl = (k) => autoFilledFields?.includes(k) ? { background: "var(--success-soft, #f0fdf4)" } : {};

  return (
    <>
      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header">Dados Institucionais</div>
        <div className="field-grid">
          <Input label="Nome da UBS *" value={form.name} onChange={set("name")} placeholder="UBS Francisca Lima de Lira" />
          <Input label="CNES (7 dígitos) *" value={form.cnes} onChange={set("cnes")} placeholder="1234567" />
          <Input label="E-mail institucional" value={form.contactEmail} onChange={set("contactEmail")} placeholder="ubs@municipio.gov.br" />
          <Input label="Telefone" value={form.phone} onChange={set("phone")} placeholder="(81) 3000-0000" />
        </div>
      </div>

      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header">Endereço</div>
        <div className="field-grid">
          <CepField value={form.cep} onChange={(v) => setField("cep", v)} onAutoFill={handleAutoFill} />
          <div style={hl("street")}>
            <Input label="Logradouro *" value={form.street} onChange={set("street")} placeholder="Rua das Flores" />
          </div>
          <Input label="Número *" value={form.streetNumber} onChange={set("streetNumber")} placeholder="123" />
          <div style={hl("neighborhood")}>
            <Input label="Bairro *" value={form.neighborhood} onChange={set("neighborhood")} placeholder="Centro" />
          </div>
          {!hideMunicipality && (
            <div style={{ gridColumn: "1 / -1", ...hl("municipalityName") }}>
              <MunicipalityPicker
                token={token}
                value={form.municipalityId ? { ibgeCode: form.municipalityId, name: form.municipalityName, uf: form.uf } : null}
                onSelect={handleMunicipalitySelect}
              />
            </div>
          )}
          <Input label="Complemento" value={form.complement || ""} onChange={set("complement")} placeholder="Ap. 10, Bloco B" />
          <Input label="Referência" value={form.reference || ""} onChange={set("reference")} placeholder="Próximo à Praça Central" />
        </div>
      </div>

      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header">
          Coordenadas Geográficas
          <span style={{ fontWeight: 400, fontSize: "0.8em", opacity: 0.7, marginLeft: 6 }}>(opcional)</span>
        </div>
        <div className="field-grid">
          <Input label="Latitude" value={form.lat} onChange={set("lat")} placeholder="-8.0476" type="number" step="any" />
          <Input label="Longitude" value={form.lng} onChange={set("lng")} placeholder="-34.8770" type="number" step="any" />
        </div>
        <p style={{ margin: "var(--s-2) 0 0", fontSize: "var(--t-xs)", color: "var(--text-dim)" }}>
          Informe as coordenadas para centralizar o Mapa Territorial nesta UBS. Use Google Maps ou similar — formato decimal (ex: -8.0476, -34.8770).
        </p>
      </div>

      {showStatus && (
        <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
          <div className="console-section__header">Status</div>
          <div className="field-grid">
            <div className="field">
              <label className="field__label">Status inicial</label>
              <select className="console-filter-select" style={{ height: 34, width: "100%" }} value={form.status} onChange={set("status")}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function validateUnitForm(form) {
  if (!form.name?.trim())             return "Nome da UBS é obrigatório.";
  if (!/^\d{7}$/.test(form.cnes))    return "CNES deve ter exatamente 7 dígitos.";
  if (!form.cep?.replace(/\D/g,""))  return "CEP é obrigatório.";
  if (!form.street?.trim())          return "Logradouro é obrigatório.";
  if (!form.streetNumber?.trim())    return "Número é obrigatório.";
  if (!form.neighborhood?.trim())    return "Bairro é obrigatório.";
  if (!form.municipalityName?.trim())return "Município é obrigatório.";
  if (!form.uf)                      return "UF é obrigatória.";
  return null;
}

// ── Unit Form (Create) ─────────────────────────────────────────────────────

const EMPTY_UNIT_FORM = {
  name: "", cnes: "", municipalityName: "", uf: "",
  municipalityId: "", address: "", contactEmail: "", phone: "", status: "draft",
  street: "", streetNumber: "", neighborhood: "", cep: "",
  complement: "", reference: "", lat: "", lng: "",
};

function UnitForm({ token, onDone, onBack, prefillMunicipality }) {
  const [form, setForm] = useState(() => prefillMunicipality
    ? { ...EMPTY_UNIT_FORM, municipalityId: prefillMunicipality.ibgeCode, municipalityName: prefillMunicipality.name, uf: prefillMunicipality.uf }
    : { ...EMPTY_UNIT_FORM });
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");

  function setField(key, value) { setForm(f => ({ ...f, [key]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const err = validateUnitForm(form);
    if (err) { setError(err); return; }
    setBusy(true);
    try {
      const payload = {
        ...form,
        cep: form.cep.replace(/\D/g, ""),
        lat: form.lat !== "" ? parseFloat(form.lat) : null,
        lng: form.lng !== "" ? parseFloat(form.lng) : null,
      };
      await apiFetch("/platform/units", token, { method: "POST", body: JSON.stringify(payload) });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="console-breadcrumb">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>← Unidades</Button>
        <span className="console-breadcrumb__sep">/</span>
        <span className="console-breadcrumb__current">Nova UBS</span>
      </div>
      {prefillMunicipality && (
        <div style={{ marginBottom: "var(--s-3)", padding: "var(--s-2) var(--s-3)", background: "var(--surface-raised)", borderRadius: 4, fontSize: "var(--t-sm)", color: "var(--text-dim)" }}>
          Município: <strong>{prefillMunicipality.name} — {prefillMunicipality.uf}</strong>
        </div>
      )}
      {error && <Alert type="error" style={{ marginBottom: "var(--s-4)" }}>{error}</Alert>}
      <UnitFormFields token={token} form={form} setField={setField} showStatus hideMunicipality={!!prefillMunicipality} />
      <div style={{ display: "flex", gap: "var(--s-3)" }}>
        <Button type="submit" loading={busy}>Criar UBS</Button>
        <Button type="button" variant="ghost" onClick={onBack}>Cancelar</Button>
      </div>
    </form>
  );
}

// ── Unit Edit Form ──────────────────────────────────────────────────────────

function UnitEditForm({ token, unit, onDone, onBack }) {
  const [form, setForm] = useState({
    name:             unit.name             || "",
    cnes:             unit.cnes             || "",
    municipalityName: unit.municipalityName || "",
    uf:               unit.uf               || "",
    municipalityId:   unit.municipalityId   || "",
    address:          unit.address          || "",
    contactEmail:     unit.contactEmail     || "",
    phone:            unit.phone            || "",
    street:           unit.street           || "",
    streetNumber:     unit.streetNumber     || "",
    neighborhood:     unit.neighborhood     || "",
    cep:              unit.cep              || "",
    complement:       unit.complement       || "",
    reference:        unit.reference        || "",
    lat:              unit.lat != null ? String(unit.lat) : "",
    lng:              unit.lng != null ? String(unit.lng) : "",
  });
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");

  function setField(key, value) { setForm(f => ({ ...f, [key]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const err = validateUnitForm(form);
    if (err) { setError(err); return; }
    setBusy(true);
    try {
      const payload = {
        ...form,
        cep: form.cep.replace(/\D/g, ""),
        lat: form.lat !== "" ? parseFloat(form.lat) : null,
        lng: form.lng !== "" ? parseFloat(form.lng) : null,
      };
      await apiFetch(`/platform/units/${unit.id}`, token, { method: "PATCH", body: JSON.stringify(payload) });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="console-breadcrumb">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>← {unit.name}</Button>
        <span className="console-breadcrumb__sep">/</span>
        <span className="console-breadcrumb__current">Editar UBS</span>
      </div>
      {error && <Alert type="error" style={{ marginBottom: "var(--s-4)" }}>{error}</Alert>}
      <UnitFormFields token={token} form={form} setField={setField} showStatus={false} />
      <div style={{ display: "flex", gap: "var(--s-3)" }}>
        <Button type="submit" loading={busy}>Salvar Alterações</Button>
        <Button type="button" variant="ghost" onClick={onBack}>Cancelar</Button>
      </div>
    </form>
  );
}

// ── Unit Modules Section ────────────────────────────────────────────────────

const ALL_MODULES = [
  { id: "nutricao",            label: "Nutrição" },
  { id: "psicologia",          label: "Psicologia" },
  { id: "fisioterapia",        label: "Fisioterapia" },
  { id: "servico_social",      label: "Serviço Social" },
  { id: "terapia_ocupacional", label: "Terapia Ocupacional" },
  { id: "fonoaudiologia",      label: "Fonoaudiologia" },
];

function UnitModulesSection({ unit, token, onUpdated }) {
  const [saving, setSaving]         = useState(false);
  const [moduleError, setModuleError] = useState("");
  const [localModules, setLocalModules] = useState(unit.enabledModules || []);

  function toggleModule(id) {
    setLocalModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function saveModules() {
    setSaving(true); setModuleError("");
    try {
      await apiFetch(`/platform/units/${unit.id}/modules`, token, {
        method: "PATCH",
        body: JSON.stringify({ enabledModules: localModules })
      });
      onUpdated();
    } catch (err) { setModuleError(err.message); }
    finally { setSaving(false); }
  }

  const changed = JSON.stringify([...localModules].sort()) !== JSON.stringify([...(unit.enabledModules || [])].sort());

  return (
    <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
      <div className="console-section__header">Módulos e Especialidades</div>
      <div className="console-section__body">
        <div className="console-modules-grid">
          {ALL_MODULES.map(({ id, label }) => {
            const active = localModules.includes(id);
            return (
              <label key={id} className={`console-module-item${active ? " is-active" : ""}`}>
                <input type="checkbox" checked={active} onChange={() => toggleModule(id)} style={{ display: "none" }} />
                <div className="console-module-item__check">{active && <IcoCheck />}</div>
                <span>{label}</span>
              </label>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
          <Button variant="primary" size="sm" loading={saving} disabled={!changed || saving} onClick={saveModules}>
            Salvar módulos
          </Button>
          {!changed && <span style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>Sem alterações pendentes</span>}
          {moduleError && <span style={{ color: "var(--danger)", fontSize: "var(--t-sm)" }}>{moduleError}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Onboarding Actions ─────────────────────────────────────────────────────

function OnboardingActions({ gestors, teams, onAddTeam, onAddManager }) {
  const actions = [];
  if (!gestors || gestors.length === 0) {
    actions.push({ label: "Cadastrar gestor inicial", action: onAddManager });
  }
  if (!teams || teams.length === 0) {
    actions.push({ label: "Cadastrar equipe inicial", action: onAddTeam });
  }
  if (actions.length === 0) return null;
  return (
    <div className="console-onboarding-alert">
      <div className="console-onboarding-alert__title">
        <IcoWarning /> Ações necessárias para concluir implantação
      </div>
      <div className="console-onboarding-alert__rows">
        {actions.map(({ label, action }) => (
          <div key={label} className="console-onboarding-alert__row">
            <span style={{ flex: 1 }}>• {label}</span>
            <Button variant="warn" size="sm" onClick={action}>Fazer agora</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Address display helper ─────────────────────────────────────────────────

function AddressRows({ unit }) {
  const line1Parts = [unit.street, unit.streetNumber].filter(Boolean).join(", ");
  const line2Parts = [unit.complement, unit.reference].filter(Boolean).join(" — ");
  const cityLine   = [unit.neighborhood, unit.municipalityName, unit.uf].filter(Boolean).join(" · ");

  return (
    <div className="console-address-rows">
      {unit.cep && (
        <div className="console-data-row">
          <span className="console-data-row__label">CEP</span>
          <span className="num">{formatCep(unit.cep)}</span>
        </div>
      )}
      {line1Parts && (
        <div className="console-data-row">
          <span className="console-data-row__label">Logradouro</span>
          <span>{line1Parts}</span>
        </div>
      )}
      {line2Parts && (
        <div className="console-data-row">
          <span className="console-data-row__label">Complemento</span>
          <span>{line2Parts}</span>
        </div>
      )}
      {cityLine && (
        <div className="console-data-row">
          <span className="console-data-row__label">Cidade</span>
          <span>{cityLine}</span>
        </div>
      )}
      {unit.lat != null && unit.lng != null && (
        <div className="console-data-row">
          <span className="console-data-row__label">Coordenadas</span>
          <span className="num" style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>
            {unit.lat.toFixed(6)}, {unit.lng.toFixed(6)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Unit Detail ────────────────────────────────────────────────────────────

function UnitDetail(props) {
  return <UnitDetailTabbed {...props} />;
}

// ── UnitDetail (legacy inline — removida, substituída por ./platform/UnitDetail.jsx)
function _UnitDetailLegacyStub({ token, unitId, onBack }) {
  const [unit, setUnit]     = useState(null);
  const [view, setView]     = useState("detail");
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  const [teamForm, setTeamForm]       = useState({ name: "", ine: "", tipoEquipe: "" });
  const [managerForm, setManagerForm] = useState({ name: "", email: "", cpf: "", cns: "", cbo: "", phone: "" });
  const [busy, setBusy]       = useState(false);
  const [formError, setFormError] = useState("");
  const [tempPwd, setTempPwd]   = useState("");

  const [transitioning, setTransitioning] = useState(false);
  const [checklist, setChecklist] = useState(null);

  async function loadChecklist(id) {
    try {
      const data = await apiFetch(`/platform/units/${id}/checklist`, token);
      setChecklist(data);
    } catch { setChecklist(null); }
  }

  async function handleTransition(toStatus) {
    if (!window.confirm(`Confirmar transição: ${STATUS_LABELS[unit?.status]} → ${STATUS_LABELS[toStatus]}?`)) return;
    setTransitioning(true);
    setFormError("");
    try {
      await apiFetch(`/platform/units/${unitId}`, token, { method: "PATCH", body: JSON.stringify({ status: toStatus }) });
      await loadUnit();
    } catch (err) {
      let msg = err.message;
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.blocked?.length) {
          msg = `Critérios pendentes:\n• ${parsed.blocked.map((b) => b.label).join("\n• ")}`;
        }
      } catch { /* not JSON */ }
      setFormError(msg);
    } finally {
      setTransitioning(false);
    }
  }

  async function handleChecklistItem(itemId, value) {
    try {
      const data = await apiFetch(`/platform/units/${unitId}/homologation-checklist`, token, {
        method: "PATCH",
        body: JSON.stringify({ [itemId]: value })
      });
      setChecklist((prev) => prev ? {
        ...prev,
        criteria: prev.criteria.map((c) => c.id === itemId ? { ...c, pass: value } : c),
        ok: data.allChecked
      } : prev);
      if (data.allChecked) await loadUnit();
    } catch (err) { setFormError(err.message); }
  }

  const loadUnit = useCallback(() => {
    setLoading(true);
    apiFetch(`/platform/units/${unitId}`, token)
      .then(setUnit)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [unitId, token]);

  useEffect(() => { loadUnit(); }, [loadUnit]);
  useEffect(() => { if (unitId && token) loadChecklist(unitId); }, [unitId, token]); // eslint-disable-line

  function setTF(key) { return (e) => setTeamForm((f) => ({ ...f, [key]: e.target.value })); }
  function setMF(key) { return (e) => setManagerForm((f) => ({ ...f, [key]: e.target.value })); }

  async function submitTeam(e) {
    e.preventDefault();
    setFormError(""); setBusy(true);
    try {
      await apiFetch(`/platform/units/${unitId}/teams`, token, { method: "POST", body: JSON.stringify(teamForm) });
      setTeamForm({ name: "", ine: "", tipoEquipe: "" });
      setView("detail");
      loadUnit();
    } catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  }

  async function submitManager(e) {
    e.preventDefault();
    setFormError(""); setBusy(true);
    try {
      const data = await apiFetch(`/platform/units/${unitId}/initial-manager`, token, { method: "POST", body: JSON.stringify(managerForm) });
      setTempPwd(data.temporaryPassword || "");
      setManagerForm({ name: "", email: "", cpf: "", cns: "", cbo: "", phone: "" });
      setView("detail");
      loadUnit();
    } catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="console-loading">Carregando dados da UBS...</div>;
  if (error)   return <Alert type="error">{error}</Alert>;
  if (!unit)   return null;

  const gestors = unit.gestors || [];
  const teams   = unit.teams   || [];
  const transitions = STATUS_TRANSITIONS[unit.status] || [];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="console-breadcrumb">
        <Button type="button" variant="ghost" size="sm" onClick={() => { setView("detail"); onBack(); }}>← Unidades</Button>
        <span className="console-breadcrumb__sep">/</span>
        <span className="console-breadcrumb__current">{unit.name}</span>
      </div>

      {/* Page title row */}
      <div className="console-page-header" style={{ marginBottom: "var(--s-4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", flexWrap: "wrap" }}>
          <h1 className="console-page-header__title" style={{ fontSize: "var(--t-xl)" }}>{unit.name}</h1>
          <StatusBadge status={unit.status} />
        </div>
        {view === "detail" && (
          <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
            <Button variant="secondary" size="sm" onClick={() => { setFormError(""); setView("edit-unit"); }}>Editar Unidade</Button>
            <Button variant="secondary" size="sm" onClick={() => { setFormError(""); setView("new-team"); }}>+ Equipe</Button>
            <Button variant="secondary" size="sm" onClick={() => { setFormError(""); setTempPwd(""); setView("new-manager"); }}>+ Gestor</Button>
          </div>
        )}
      </div>

      {tempPwd && <TempPasswordModal password={tempPwd} onClose={() => setTempPwd("")} />}
      {formError && <Alert type="error" style={{ marginBottom: "var(--s-4)" }}>{formError}</Alert>}

      {/* Detail view */}
      {view === "detail" && (
        <>
          {/* Onboarding actions */}
          <OnboardingActions
            gestors={gestors}
            teams={teams}
            onAddManager={() => { setFormError(""); setTempPwd(""); setView("new-manager"); }}
            onAddTeam={() => { setFormError(""); setView("new-team"); }}
          />

          {/* Address card */}
          {(() => {
            const addressComplete = unit.street && unit.streetNumber && unit.neighborhood && unit.municipalityName && unit.uf;
            const addressPresent  = unit.street || unit.neighborhood || unit.cep;
            return (
              <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
                <div className="console-section__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Endereço</span>
                  <Button variant="ghost" size="sm" onClick={() => { setFormError(""); setView("edit-unit"); }}>Editar</Button>
                </div>
                <div className="console-section__body">
                  {!addressPresent ? (
                    <div className="console-address-alert">
                      Endereço não cadastrado. Cadastre o endereço da UBS para habilitar o Mapa Territorial.
                      <Button variant="warn" size="sm" style={{ marginLeft: "var(--s-3)" }} onClick={() => { setFormError(""); setView("edit-unit"); }}>Cadastrar agora</Button>
                    </div>
                  ) : !addressComplete ? (
                    <>
                      <div className="console-address-alert" style={{ marginBottom: "var(--s-3)" }}>
                        Endereço incompleto — campos obrigatórios faltando (logradouro, número, bairro, município ou UF).
                        <Button variant="warn" size="sm" style={{ marginLeft: "var(--s-3)" }} onClick={() => { setFormError(""); setView("edit-unit"); }}>Completar</Button>
                      </div>
                      <AddressRows unit={unit} />
                    </>
                  ) : (
                    <AddressRows unit={unit} />
                  )}
                </div>
              </div>
            );
          })()}

          {/* Info cards grid */}
          <div className="console-detail-grid">
            {/* Dados Institucionais */}
            <div className="console-section">
              <div className="console-section__header">Dados Institucionais</div>
              <div className="console-section__body">
                <div className="console-data-row">
                  <span className="console-data-row__label">CNES</span>
                  <span className="num">{unit.cnes || "—"}</span>
                </div>
                <div className="console-data-row">
                  <span className="console-data-row__label">Município</span>
                  <span>{unit.municipalityName || "—"}{unit.uf ? ` / ${unit.uf}` : ""}</span>
                </div>
                {unit.municipalityId && (
                  <div className="console-data-row">
                    <span className="console-data-row__label">IBGE</span>
                    <span className="num">{unit.municipalityId}</span>
                  </div>
                )}
                {unit.contactEmail && (
                  <div className="console-data-row">
                    <span className="console-data-row__label">E-mail</span>
                    <span>{unit.contactEmail}</span>
                  </div>
                )}
                {unit.phone && (
                  <div className="console-data-row">
                    <span className="console-data-row__label">Telefone</span>
                    <span>{unit.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Operacional */}
            <div className="console-section">
              <div className="console-section__header">Operacional</div>
              <div className="console-section__body">
                <div className="console-metric-grid">
                  {[
                    { label: "Equipes",   val: unit.teamCount    ?? 0 },
                    { label: "Gestores",  val: unit.gestorCount  ?? 0 },
                    { label: "Usuários",  val: unit.userCount    ?? 0 },
                    { label: "Pacientes", val: unit.patientCount ?? 0 },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div className="console-metric__value">{val}</div>
                      <div className="console-metric__label">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Implantação */}
            <div className="console-section">
              <div className="console-section__header">Implantação</div>
              <div className="console-section__body">
                <div className="console-data-row">
                  <span className="console-data-row__label">Cadastro</span>
                  <span>{fmtDate(unit.createdAt)}</span>
                </div>
                {unit.activatedAt && (
                  <div className="console-data-row">
                    <span className="console-data-row__label">Ativação</span>
                    <span>{fmtDate(unit.activatedAt)}</span>
                  </div>
                )}
                {unit.suspendedAt && (
                  <div className="console-data-row">
                    <span className="console-data-row__label">Suspensão</span>
                    <span>{fmtDate(unit.suspendedAt)}</span>
                  </div>
                )}
                <div className="console-data-row">
                  <span className="console-data-row__label">Atualização</span>
                  <span>{fmtDate(unit.updatedAt)}</span>
                </div>
                {unit.createdByName && (
                  <div className="console-data-row">
                    <span className="console-data-row__label">Responsável</span>
                    <span style={{ color: "var(--text-muted)" }}>{unit.createdByName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lifecycle / Status Transitions */}
          {transitions.length > 0 && (
            <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
              <div className="console-section__header">
                Ciclo de Vida
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
                  Status atual: <strong style={{ color: "var(--text)" }}>{STATUS_LABELS[unit.status] || unit.status}</strong>
                </span>
              </div>
              <div className="console-section__body">
                {/* Checklist */}
                {checklist?.criteria?.length > 0 && (
                  <>
                    <p style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)", marginBottom: "var(--s-3)" }}>
                      Critérios para avançar para {STATUS_LABELS[transitions[0]?.to] || "próximo estado"}:
                    </p>
                    <div className="console-checklist">
                      {checklist.criteria.map((c) => {
                        const isInteractive = ["auth_","rbac_","team_configured","user_created","patient_","household_","individual_","audit_"]
                          .some(pfx => c.id.startsWith(pfx));
                        if (isInteractive) {
                          return (
                            <label key={c.id} className="console-checklist__item" style={{ cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={!!c.pass}
                                onChange={(e) => handleChecklistItem(c.id, e.target.checked)}
                                style={{ width: 14, height: 14, flexShrink: 0, accentColor: "var(--success)" }}
                              />
                              <span style={{ color: c.pass ? "var(--success)" : "var(--text)" }}>{c.label}</span>
                              {c.pass && <span className="chip ok">✓</span>}
                            </label>
                          );
                        }
                        return (
                          <div key={c.id} className="console-checklist__item">
                            <div className={`console-checklist__dot ${c.pass ? "pass" : "pending"}`} />
                            <span style={{ color: c.pass ? "var(--success)" : "var(--text)" }}>{c.label}</span>
                            {c.pass
                              ? <span className="chip ok">✓</span>
                              : <span className="chip warn">pendente</span>
                            }
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Transition buttons */}
                <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
                  {transitions.map(({ to, label }) => {
                    const isForward = ["onboarding","homologation","active"].includes(to);
                    const blocked   = isForward && checklist && !checklist.ok;
                    return (
                      <Button
                        key={to}
                        variant={TRANSITION_VARIANT[to] || "secondary"}
                        size="sm"
                        disabled={transitioning || blocked}
                        loading={transitioning}
                        onClick={() => handleTransition(to)}
                        title={blocked ? `Critérios pendentes: ${(checklist?.criteria || []).filter(c => !c.pass).map(c => c.label).join(", ")}` : undefined}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Gestors */}
          {gestors.length > 0 && (
            <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
              <div className="console-section__header">Gestores ({gestors.length})</div>
              <div className="console-section__body">
                <div className="console-people-list">
                  {gestors.map((g) => (
                    <div key={g.id} className="console-person">
                      <span className="console-person__name">{g.name}</span>
                      <span className="console-person__email">{g.email}</span>
                      {g.forcePasswordChange && <span className="chip warn">Troca pendente</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Teams */}
          {teams.length > 0 && (
            <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
              <div className="console-section__header">Equipes ({teams.length})</div>
              <div className="console-section__body">
                <div className="console-people-list">
                  {teams.map((t) => (
                    <div key={t.id} className="console-person">
                      <span className="console-person__name">{t.name}</span>
                      <span className="console-person__email">
                        {t.ine ? `INE ${t.ine}` : ""}
                        {t.tipoEquipe ? ` · ${t.tipoEquipe}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Modules */}
          <UnitModulesSection unit={unit} token={token} onUpdated={loadUnit} />
        </>
      )}

      {/* New team form */}
      {view === "new-team" && (
        <div className="console-section">
          <div className="console-section__header">Nova Equipe</div>
          <form onSubmit={submitTeam}>
            <div className="field-grid">
              <Input label="Nome da equipe *" value={teamForm.name} onChange={setTF("name")} placeholder="ESF Francisca" />
              <Input label="INE" value={teamForm.ine} onChange={setTF("ine")} placeholder="0000000000" />
              <Input label="Tipo de equipe" value={teamForm.tipoEquipe} onChange={setTF("tipoEquipe")} placeholder="ESF" />
            </div>
            <div style={{ display: "flex", gap: "var(--s-3)", padding: "0 var(--s-5) var(--s-5)" }}>
              <Button type="submit" loading={busy}>Criar equipe</Button>
              <Button type="button" variant="ghost" onClick={() => { setFormError(""); setView("detail"); }}>Cancelar</Button>
            </div>
          </form>
        </div>
      )}

      {/* Edit unit form */}
      {view === "edit-unit" && (
        <UnitEditForm
          token={token}
          unit={unit}
          onDone={() => { setView("detail"); loadUnit(); }}
          onBack={() => setView("detail")}
        />
      )}

      {/* New manager form */}
      {view === "new-manager" && (
        <div className="console-section">
          <div className="console-section__header">Gestor Inicial</div>
          <form onSubmit={submitManager}>
            <div className="field-grid">
              <Input label="Nome completo *" value={managerForm.name} onChange={setMF("name")} placeholder="Maria da Silva" />
              <Input label="E-mail *" value={managerForm.email} onChange={setMF("email")} placeholder="gestora@ubs.gov.br" />
              <Input label="CPF" value={managerForm.cpf} onChange={setMF("cpf")} placeholder="000.000.000-00" />
              <Input label="CNS" value={managerForm.cns} onChange={setMF("cns")} placeholder="000 0000 0000 0000" />
              <Input label="CBO" value={managerForm.cbo} onChange={setMF("cbo")} placeholder="2232" />
              <Input label="Telefone" value={managerForm.phone} onChange={setMF("phone")} placeholder="(81) 99999-0000" />
            </div>
            <div style={{ display: "flex", gap: "var(--s-3)", padding: "0 var(--s-5) var(--s-5)" }}>
              <Button type="submit" loading={busy}>Criar gestor</Button>
              <Button type="button" variant="ghost" onClick={() => { setFormError(""); setView("detail"); }}>Cancelar</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Citizen Portal Governance ──────────────────────────────────────────────

const PORTAL_SECTIONS = [
  {
    id: "portal",
    label: "Status do Portal",
    desc: "Controle de disponibilidade e mensagens institucionais",
    fields: [
      { key: "ativo",                 label: "Portal ativo",                   desc: "Libera o acesso dos cidadãos ao Portal",                    type: "toggle" },
      { key: "manutencao",            label: "Modo manutenção",                desc: "Exibe aviso de manutenção, bloqueia acesso",                 type: "toggle" },
      { key: "bannerAtivo",           label: "Banner institucional",           desc: "Exibe banner informativo na tela inicial",                   type: "toggle" },
      { key: "mensagemInstitucional", label: "Mensagem institucional",         desc: "Texto exibido no Portal (máx. 300 caracteres)",              type: "text"   },
      { key: "bannerTexto",           label: "Texto do banner",                desc: "Mensagem exibida no banner (máx. 200 caracteres)",           type: "text"   },
    ]
  },
  {
    id: "modulos",
    label: "Módulos do Portal",
    desc: "Ative ou desative seções disponíveis ao cidadão",
    fields: [
      { key: "agendamentos",  label: "Agendamentos",  desc: "Seção de consultas e agendamentos online",   type: "toggle" },
      { key: "vacinas",       label: "Vacinas",       desc: "Calendário vacinal e vacinas pendentes",      type: "toggle" },
      { key: "medicamentos",  label: "Medicamentos",  desc: "Receitas e medicamentos disponíveis",         type: "toggle" },
      { key: "exames",        label: "Exames",        desc: "Pedidos e resultados de exames",              type: "toggle" },
      { key: "minhaUbs",      label: "Minha UBS",     desc: "Dados e informações da UBS de referência",   type: "toggle" },
      { key: "notificacoes",  label: "Notificações",  desc: "Avisos e comunicados da UBS",                 type: "toggle" },
      { key: "perfil",        label: "Perfil",        desc: "Dados pessoais do cidadão",                   type: "toggle" },
      { key: "dependentes",   label: "Dependentes",   desc: "Gerenciamento de dependentes (futuro)",       type: "toggle" },
      { key: "documentos",    label: "Documentos",    desc: "Documentos e declarações (futuro)",           type: "toggle" },
    ]
  },
  {
    id: "agendamentos",
    label: "Agendamentos Online",
    desc: "Regras para agendamento digital de consultas",
    fields: [
      { key: "onlineAtivo",         label: "Agendamento online",      desc: "Permite que o cidadão agende consultas pelo Portal",       type: "toggle" },
      { key: "cancelamentoAtivo",   label: "Cancelamento online",     desc: "Permite cancelamento de consultas pelo Portal",            type: "toggle" },
      { key: "remarcacaoAtivo",     label: "Remarcação online",       desc: "Permite remarcar consultas sem precisar ir à UBS",         type: "toggle" },
      { key: "confirmacaoAtiva",    label: "Confirmação de presença", desc: "Cidadão confirma presença pelo Portal antes da consulta",  type: "toggle" },
      { key: "listaEspera",         label: "Lista de espera",         desc: "Cidadão pode entrar em lista de espera por desistência",   type: "toggle" },
      { key: "antecedenciaMinDias", label: "Antecedência mínima (dias)", desc: "Mínimo de dias de antecedência para agendamento",      type: "number", min: 0, max: 30  },
      { key: "antecedenciaMaxDias", label: "Antecedência máxima (dias)", desc: "Máximo de dias futuros para agendamento",              type: "number", min: 1, max: 365 },
      { key: "vagasDigitaisPerc",   label: "% vagas digitais",         desc: "Percentual máximo de vagas liberadas para o Portal",     type: "number", min: 0, max: 100 },
    ]
  },
  {
    id: "vacinacao",
    label: "Vacinação",
    desc: "Configurações de vacinação disponíveis no Portal",
    fields: [
      { key: "agendamentoOnline", label: "Agendamento de vacina",  desc: "Permite agendar vacinas pelo Portal",                    type: "toggle" },
      { key: "campanhas",         label: "Campanhas de vacinação", desc: "Exibe campanhas ativas no Portal",                       type: "toggle" },
      { key: "confirmacao",       label: "Confirmação de vacina",  desc: "Cidadão confirma presença antes da vacinação",           type: "toggle" },
      { key: "calendarioVacinal", label: "Calendário vacinal",     desc: "Exibe o calendário de vacinas recomendadas por faixa",   type: "toggle" },
    ]
  },
  {
    id: "medicamentos",
    label: "Medicamentos",
    desc: "Dados de medicamentos exibidos ao cidadão",
    fields: [
      { key: "mostrarEstoque",         label: "Mostrar estoque",          desc: "Exibe quantidade em estoque na UBS",                    type: "toggle" },
      { key: "mostrarDisponibilidade", label: "Mostrar disponibilidade",  desc: "Informa se o medicamento está disponível",             type: "toggle" },
      { key: "mostrarOutrasUbs",       label: "Mostrar outras UBS",       desc: "Indica disponibilidade em outras unidades do município", type: "toggle" },
      { key: "retiradaOutraUbs",       label: "Retirada em outra UBS",    desc: "Permite solicitar retirada em UBS diferente",           type: "toggle" },
      { key: "previsaoReposicao",      label: "Previsão de reposição",    desc: "Informa data prevista de reposição do estoque",         type: "toggle" },
    ]
  },
  {
    id: "exames",
    label: "Exames",
    desc: "Acesso a pedidos e resultados de exames",
    fields: [
      { key: "mostrarPedidos",           label: "Mostrar pedidos",            desc: "Exibe pedidos de exame solicitados",                    type: "toggle" },
      { key: "mostrarResultados",        label: "Mostrar resultados",          desc: "Exibe resultados disponíveis no Portal",                type: "toggle" },
      { key: "permitirDownload",         label: "Permitir download",           desc: "Permite que o cidadão baixe resultados em PDF",         type: "toggle" },
      { key: "notificarDisponibilidade", label: "Notificar disponibilidade",   desc: "Avisa o cidadão quando resultado estiver disponível",   type: "toggle" },
    ]
  },
  {
    id: "comunicacao",
    label: "Comunicação",
    desc: "Canais de comunicação com o cidadão",
    fields: [
      { key: "portalAtivo",        label: "Notificações no Portal",   desc: "Avisos e comunicados exibidos no Portal",          type: "toggle" },
      { key: "whatsappAtivo",      label: "WhatsApp",                  desc: "Envio de mensagens via WhatsApp (futuro)",         type: "toggle" },
      { key: "emailAtivo",         label: "E-mail",                    desc: "Envio de notificações por e-mail",                 type: "toggle" },
      { key: "smsAtivo",           label: "SMS",                       desc: "Envio de SMS para o cidadão",                     type: "toggle" },
      { key: "campanhasMunicipais", label: "Campanhas municipais",     desc: "Permite envio de campanhas para toda a rede",      type: "toggle" },
    ]
  },
  {
    id: "compartilhamento",
    label: "Compartilhamento entre UBS",
    desc: "Regras de compartilhamento de recursos entre unidades do município",
    fields: [
      { key: "estoquesMedicamentos", label: "Compartilhar estoque",     desc: "Estoques de medicamentos visíveis entre UBS",       type: "toggle" },
      { key: "vagas",                label: "Compartilhar vagas",        desc: "Vagas disponíveis em qualquer UBS do município",    type: "toggle" },
      { key: "campanhas",            label: "Compartilhar campanhas",    desc: "Campanhas ativas em todas as UBS do município",     type: "toggle" },
      { key: "vacinas",              label: "Compartilhar vacinas",      desc: "Disponibilidade de vacinas entre UBS",              type: "toggle" },
      { key: "exames",               label: "Compartilhar exames",       desc: "Resultados acessíveis em qualquer UBS do município", type: "toggle" },
    ]
  },
];

function PortalToggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? "var(--accent)" : "var(--border-strong)",
        border: "none", cursor: disabled ? "not-allowed" : "pointer",
        position: "relative", flexShrink: 0,
        transition: "background var(--d-fast)",
        opacity: disabled ? .5 : 1,
      }}
    >
      <span style={{
        position: "absolute",
        top: 2, left: checked ? 20 : 2,
        width: 18, height: 18, borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,.25)",
        transition: "left 150ms",
      }} />
    </button>
  );
}

function PortalConfigSection({ section, config, onChange, unitMode, municipalConfig }) {
  return (
    <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
      <div className="console-section__header">
        <span>{section.label}</span>
        <span style={{ fontWeight: 400, fontSize: "var(--t-sm)", color: "var(--text-muted)", textTransform: "none", letterSpacing: 0 }}>
          {section.desc}
        </span>
      </div>
      <div className="console-section__body">
        {section.fields.map(field => {
          const sectionConfig = config?.[section.id] || {};
          const muniSectionConfig = municipalConfig?.[section.id] || {};
          const value = sectionConfig[field.key];
          const muniValue = muniSectionConfig[field.key];

          // In unit mode: if municipality disabled a boolean, unit cannot enable it
          const blocked = unitMode && field.type === "toggle" && muniValue === false;

          return (
            <div key={field.key} style={{
              display: "flex", alignItems: "flex-start", gap: "var(--s-4)",
              padding: "var(--s-3) 0",
              borderBottom: "1px solid var(--border-subtle)",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
                  <span style={{ fontSize: "var(--t-md)", fontWeight: 500, color: "var(--text)" }}>
                    {field.label}
                  </span>
                  {blocked && (
                    <span className="chip" style={{ fontSize: 10, background: "var(--surface-3)", color: "var(--text-muted)" }}>
                      bloqueado pelo município
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginTop: 2 }}>
                  {field.desc}
                </div>
              </div>
              {field.type === "toggle" && (
                <PortalToggle
                  checked={!!value}
                  onChange={v => onChange(section.id, field.key, v)}
                  disabled={blocked}
                />
              )}
              {field.type === "number" && (
                <input
                  type="number"
                  min={field.min ?? 0}
                  max={field.max ?? 999}
                  value={value ?? 0}
                  onChange={e => onChange(section.id, field.key, parseInt(e.target.value, 10) || 0)}
                  style={{
                    width: 72, height: 32, padding: "0 var(--s-2)",
                    border: "1px solid var(--border)", borderRadius: "var(--r-md)",
                    background: "var(--surface)", color: "var(--text)",
                    font: "var(--t-md)/1 var(--font-sans)", textAlign: "center",
                    flexShrink: 0,
                  }}
                />
              )}
              {field.type === "text" && (
                <input
                  type="text"
                  value={value || ""}
                  maxLength={300}
                  onChange={e => onChange(section.id, field.key, e.target.value)}
                  style={{
                    width: 240, height: 32, padding: "0 var(--s-3)",
                    border: "1px solid var(--border)", borderRadius: "var(--r-md)",
                    background: "var(--surface)", color: "var(--text)",
                    font: "var(--t-md)/1 var(--font-sans)", flexShrink: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CitizenPortalConfig({ token }) {
  const [municipalConfig, setMunicipalConfig]   = useState(null);
  const [unitsList, setUnitsList]               = useState([]);
  const [selectedUnitId, setSelectedUnitId]     = useState("");
  const [unitConfigData, setUnitConfigData]     = useState(null);
  const [activePanel, setActivePanel]           = useState("municipal"); // "municipal" | "unit"
  const [saving, setSaving]                     = useState(false);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState("");
  const [saved, setSaved]                       = useState(false);

  async function loadMunicipal() {
    setLoading(true); setError("");
    try {
      const data = await apiFetch("/platform/citizen-portal/config", token);
      setMunicipalConfig(data.config);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadUnits() {
    try {
      const data = await apiFetch("/platform/units", token);
      setUnitsList(Array.isArray(data) ? data : (data.units || []));
    } catch { /* silent */ }
  }

  async function loadUnitConfig(unitId) {
    if (!unitId) { setUnitConfigData(null); return; }
    try {
      const data = await apiFetch(`/platform/citizen-portal/units/${unitId}/config`, token);
      setUnitConfigData(data);
    } catch(e) { setError(e.message); }
  }

  useEffect(() => { loadMunicipal(); loadUnits(); }, []); // eslint-disable-line
  useEffect(() => { loadUnitConfig(selectedUnitId); }, [selectedUnitId]); // eslint-disable-line

  function handleMunicipalChange(sectionId, key, value) {
    setMunicipalConfig(prev => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], [key]: value },
    }));
    setSaved(false);
  }

  function handleUnitChange(sectionId, key, value) {
    setUnitConfigData(prev => {
      const overrides = { ...(prev?.unitOverrides || {}), [sectionId]: { ...(prev?.unitOverrides?.[sectionId] || {}), [key]: value } };
      return { ...prev, unitOverrides: overrides };
    });
    setSaved(false);
  }

  async function saveMunicipal() {
    setSaving(true); setError(""); setSaved(false);
    try {
      await apiFetch("/platform/citizen-portal/config", token, {
        method: "PUT",
        body: JSON.stringify(municipalConfig),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function saveUnit() {
    if (!selectedUnitId) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      await apiFetch(`/platform/citizen-portal/units/${selectedUnitId}/config`, token, {
        method: "PUT",
        body: JSON.stringify(unitConfigData?.unitOverrides || {}),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadUnitConfig(selectedUnitId);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="console-loading">Carregando configurações do Portal...</div>;

  const isUnit = activePanel === "unit";
  const displayConfig = isUnit ? (unitConfigData?.effective || municipalConfig) : municipalConfig;

  return (
    <>
      <div className="console-page-header">
        <div>
          <h1 className="console-page-header__title">Portal do Cidadão</h1>
          <p className="console-page-header__sub">Governança e configurações do Portal — toda regra é configurável</p>
        </div>
      </div>

      {error && <Alert type="error" style={{ marginBottom: "var(--s-4)" }}>{error}</Alert>}

      {/* Panel selector */}
      <div style={{ display: "flex", gap: "var(--s-2)", marginBottom: "var(--s-5)", flexWrap: "wrap", alignItems: "center" }}>
        <div className="btn-group">
          <button
            type="button"
            className={"btn btn--sm" + (activePanel === "municipal" ? " is-active" : "")}
            onClick={() => setActivePanel("municipal")}
          >
            Configuração Municipal
          </button>
          <button
            type="button"
            className={"btn btn--sm" + (activePanel === "unit" ? " is-active" : "")}
            onClick={() => setActivePanel("unit")}
          >
            Configuração por UBS
          </button>
        </div>

        {isUnit && (
          <select
            className="console-filter-select"
            value={selectedUnitId}
            onChange={e => setSelectedUnitId(e.target.value)}
            style={{ height: 34 }}
          >
            <option value="">Selecionar UBS...</option>
            {unitsList.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Info banner — unit mode */}
      {isUnit && selectedUnitId && (
        <div className="console-section" style={{ marginBottom: "var(--s-4)", background: "var(--accent-soft)", borderColor: "var(--accent-bd)" }}>
          <div className="console-section__body" style={{ color: "var(--teal-800)", fontSize: "var(--t-sm)" }}>
            Configurações da UBS complementam as regras municipais. Uma UBS <strong>nunca pode habilitar</strong> algo desabilitado pelo município. Ela pode apenas restringir mais.
            Itens bloqueados pelo município aparecem com indicador visual e são ignorados ao salvar.
          </div>
        </div>
      )}

      {isUnit && !selectedUnitId && (
        <div className="console-section" style={{ marginBottom: "var(--s-5)" }}>
          <div className="console-section__body" style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>
            Selecione uma UBS acima para configurar suas regras específicas.
          </div>
        </div>
      )}

      {/* Config sections */}
      {(!isUnit || selectedUnitId) && PORTAL_SECTIONS.map(section => (
        <PortalConfigSection
          key={section.id}
          section={section}
          config={isUnit ? (unitConfigData?.unitOverrides ? { [section.id]: { ...(unitConfigData?.municipal?.[section.id] || {}), ...(unitConfigData?.unitOverrides?.[section.id] || {}) } } : municipalConfig) : municipalConfig}
          onChange={isUnit ? handleUnitChange : handleMunicipalChange}
          unitMode={isUnit}
          municipalConfig={municipalConfig}
        />
      ))}

      {/* Save */}
      {(!isUnit || selectedUnitId) && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", marginTop: "var(--s-2)", marginBottom: "var(--s-8)" }}>
          <Button
            loading={saving}
            onClick={isUnit ? saveUnit : saveMunicipal}
            disabled={saving}
          >
            {isUnit ? "Salvar configuração da UBS" : "Salvar configuração municipal"}
          </Button>
          {saved && (
            <span style={{ fontSize: "var(--t-sm)", color: "var(--success)" }}>
              ✓ Salvo com sucesso
            </span>
          )}
        </div>
      )}
    </>
  );
}

// ── License Console ────────────────────────────────────────────────────────

const LICENSE_STATUS_LABEL = {
  DRAFT: "Rascunho", ACTIVE: "Ativa", SUSPENDED: "Suspensa",
  EXPIRED: "Expirada", TERMINATED: "Encerrada",
};
const LICENSE_STATUS_CLASS = {
  DRAFT: "badge", ACTIVE: "badge badge--success", SUSPENDED: "badge badge--warning",
  EXPIRED: "badge badge--danger", TERMINATED: "badge",
};
const CUSTOMER_STATUS_LABEL = {
  LEAD: "Lead", CONTRACT_PENDING: "Contrato Pendente", IMPLEMENTATION: "Implantação",
  TRAINING: "Treinamento", READY_FOR_GO_LIVE: "Pronto p/ Go Live", ACTIVE: "Ativo",
  SUSPENDED: "Suspenso", CANCELLED: "Cancelado", TERMINATED: "Encerrado",
};

function LicenseConsole({ token }) {
  const [view, setView]       = useState("list");
  const [selected, setSelected] = useState(null);
  const [listKey, setListKey] = useState(0);

  if (view === "detail" && selected) {
    return (
      <LicenseDetail
        token={token}
        license={selected}
        onBack={() => { setSelected(null); setView("list"); setListKey(k => k + 1); }}
      />
    );
  }
  if (view === "new") {
    return (
      <LicenseForm
        token={token}
        onDone={(lic) => { setSelected(lic); setView("detail"); }}
        onBack={() => setView("list")}
      />
    );
  }

  return (
    <LicenseListView
      key={listKey}
      token={token}
      onSelect={(lic) => { setSelected(lic); setView("detail"); }}
      onNew={() => setView("new")}
    />
  );
}

function LicenseListView({ token, onSelect, onNew }) {
  const [licenses, setLicenses] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch("/platform/licenses" + (filterStatus ? `?status=${filterStatus}` : ""), token).catch(() => null),
      apiFetch("/platform/licenses-dashboard", token).catch(() => null),
    ]).then(([d1, d2]) => {
      setLicenses(d1?.licenses || []);
      setDashboard(d2);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [token, filterStatus]);

  return (
    <>
      <ModuleBanner
        icon={<IcoClipboard />}
        title="Licenças"
        subtitle="Contratos e ciclo de vida de clientes municipais"
        color="#d97706"
        kpis={dashboard ? [
          { label: "Ativas",    value: dashboard.byStatus?.ACTIVE    ?? 0 },
          { label: "Trial",     value: dashboard.byStatus?.TRIAL     ?? 0 },
          { label: "Suspensas", value: dashboard.byStatus?.SUSPENDED ?? 0 },
        ] : []}
      >
        <div style={{ marginTop: "var(--s-2)" }}>
          <Button onClick={onNew}>+ Nova Licença</Button>
        </div>
      </ModuleBanner>

      {dashboard && (
        <div className="console-kpi-strip" style={{ marginBottom: "var(--s-4)" }}>
          {[
            { label: "Ativas",    value: dashboard.licenses?.active ?? 0,             accent: "var(--success)" },
            { label: "Rascunho",  value: dashboard.licenses?.draft ?? 0,              accent: "var(--text-dim)" },
            { label: "Suspensas", value: dashboard.licenses?.suspended ?? 0,          accent: "var(--warning)" },
            { label: "Expiradas", value: dashboard.licenses?.expired ?? 0,            accent: "var(--danger)" },
            { label: "Vcto ≤30d", value: dashboard.licenses?.expiringIn30Days ?? 0,   accent: "var(--warning)" },
          ].map(({ label, value, accent }) => (
            <div key={label} className="console-kpi" style={{ "--kpi-color": accent }}>
              <div className="console-kpi__accent" />
              <div className="console-kpi__value" style={{ color: accent }}>{value}</div>
              <div className="console-kpi__label">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: "var(--s-3)", display: "flex", gap: "var(--s-2)" }}>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
        >
          <option value="">Todos os status</option>
          {Object.entries(LICENSE_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? <p>Carregando…</p> : (
        <div className="console-table-wrapper">
          <table className="console-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Município (ID)</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Contrato</th>
                <th>Vcto</th>
                <th>UBS</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {licenses.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)" }}>Nenhuma licença encontrada</td></tr>
              ) : licenses.map(l => (
                <tr key={l.id}>
                  <td><span style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>{l.licenseCode}</span></td>
                  <td style={{ fontSize: "0.82rem" }}>{l.municipalityId}</td>
                  <td>{l.plan}</td>
                  <td><span className={LICENSE_STATUS_CLASS[l.status] || "badge"}>{LICENSE_STATUS_LABEL[l.status] || l.status}</span></td>
                  <td style={{ fontSize: "0.82rem" }}>{l.contractNumber || "—"}</td>
                  <td style={{ fontSize: "0.82rem" }}>{fmtDate(l.contractEnd)}</td>
                  <td style={{ textAlign: "center" }}>{l.currentUnits ?? "—"}{l.limits?.maxUnits != null ? `/${l.limits.maxUnits}` : ""}</td>
                  <td>
                    <Button size="sm" variant="secondary" onClick={() => onSelect(l)}>Ver</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function LicenseDetail({ token, license: initialLicense, onBack }) {
  const [license, setLicense] = useState(initialLicense);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [msg, setMsg]         = useState("");

  const reload = () => {
    apiFetch(`/platform/licenses/${license.id}`, token)
      .then(setLicense).catch(() => {});
  };

  const changeStatus = async (toStatus, reason) => {
    setLoading(true); setError(""); setMsg("");
    try {
      const d = await apiFetch(`/platform/licenses/${license.id}/status`, token, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ toStatus, reason: reason || null }),
      });
      setLicense(d); setMsg(`Status alterado para ${LICENSE_STATUS_LABEL[toStatus] || toStatus}`);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const STATUS_ACTIONS = {
    DRAFT:      [{ to: "ACTIVE", label: "Ativar", v: "primary" }],
    ACTIVE:     [{ to: "SUSPENDED", label: "Suspender", v: "danger" }, { to: "EXPIRED", label: "Marcar Expirada", v: "secondary" }, { to: "TERMINATED", label: "Encerrar", v: "danger" }],
    SUSPENDED:  [{ to: "ACTIVE", label: "Reativar", v: "primary" }, { to: "TERMINATED", label: "Encerrar", v: "danger" }],
    EXPIRED:    [{ to: "ACTIVE", label: "Reativar", v: "primary" }, { to: "TERMINATED", label: "Encerrar", v: "danger" }],
    TERMINATED: [],
  };

  const actions = STATUS_ACTIONS[license.status] || [];

  return (
    <>
      <div className="console-page-header">
        <div>
          <button type="button" onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "var(--s-1)", padding: 0 }}>
            ← Voltar
          </button>
          <h1 className="console-page-header__title">{license.licenseCode}</h1>
          <p className="console-page-header__sub">Município {license.municipalityId} · Plano {license.plan}</p>
        </div>
        <span className={LICENSE_STATUS_CLASS[license.status] || "badge"} style={{ fontSize: "0.9rem", padding: "4px 10px" }}>
          {LICENSE_STATUS_LABEL[license.status] || license.status}
        </span>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {msg   && <Alert variant="success">{msg}</Alert>}

      {/* Contract info */}
      <div className="console-section">
        <div className="console-section__header">Contrato</div>
        <div className="console-section__body">
          <table style={{ fontSize: "0.875rem", borderCollapse: "collapse", width: "100%" }}>
            <tbody>
              {[
                ["Número do contrato", license.contractNumber || "—"],
                ["Início", fmtDate(license.contractStart)],
                ["Vencimento", fmtDate(license.contractEnd)],
                ["Renovação", fmtDate(license.renewalDate)],
                ["Notas", license.notes || "—"],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ color: "var(--text-muted)", padding: "4px 16px 4px 0", width: 180 }}>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Limits & features */}
      <div className="console-section">
        <div className="console-section__header">Limites e Funcionalidades</div>
        <div className="console-section__body">
          <div style={{ display: "flex", gap: "var(--s-4)", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>Limites</div>
              {Object.keys(license.limits || {}).length === 0 ? (
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Ilimitado</span>
              ) : Object.entries(license.limits).map(([k, v]) => (
                <div key={k} style={{ fontSize: "0.85rem" }}>
                  {k}: <strong>{v}</strong>
                  {k === "maxUnits" && license.currentUnits != null && ` (atual: ${license.currentUnits})`}
                  {k === "maxUsers" && license.currentUsers != null && ` (atual: ${license.currentUsers})`}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>Módulos</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(license.features || []).map(f => (
                  <span key={f} className="badge" style={{ fontSize: "0.72rem" }}>{f}</span>
                ))}
                {(license.features || []).length === 0 && <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Nenhum</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="console-section">
          <div className="console-section__header">Ações</div>
          <div className="console-section__body" style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
            {actions.map(({ to, label, v }) => (
              <Button key={to} variant={v} disabled={loading} onClick={() => {
                const reason = window.prompt(`Motivo (opcional) — ${label}`);
                if (reason !== null) changeStatus(to, reason);
              }}>
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div className="console-section">
        <div className="console-section__header">Histórico de alterações</div>
        <div className="console-section__body">
          {(license.history || []).length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Nenhuma entrada</p>
          ) : [...(license.history || [])].reverse().map((h, i) => (
            <div key={i} style={{ display: "flex", gap: "var(--s-2)", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>
              <span style={{ color: "var(--text-muted)", minWidth: 28 }}>v{h.version}</span>
              <span style={{ color: "var(--text-muted)", minWidth: 130 }}>{fmtDate(h.at)}</span>
              <span style={{ color: "var(--text-muted)", minWidth: 120 }}>{h.operatorName || "—"}</span>
              <span>{h.reason || "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── MunicipalityAutocomplete ─────────────────────────────────────────────────
function MunicipalityAutocomplete({ token, value, onSelect, required }) {
  const [query, setQuery]   = useState(value?.name || "");
  const [results, setRes]   = useState([]);
  const [open, setOpen]     = useState(false);
  const [loading, setLoad]  = useState(false);
  const timer = useRef(null);

  const search = (q) => {
    setQuery(q);
    if (!q.trim()) { setRes([]); setOpen(false); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoad(true);
      try {
        const d = await apiFetch(`/platform/municipalities?search=${encodeURIComponent(q)}&limit=12`, token);
        setRes(d?.municipalities || []);
        setOpen(true);
      } catch { setRes([]); }
      setLoad(false);
    }, 250);
  };

  const pick = (mun) => {
    setQuery(`${mun.name} — ${mun.uf}`);
    setOpen(false);
    setRes([]);
    onSelect(mun);
  };

  return (
    <div className="mun-autocomplete">
      <label className="form-label">Município *</label>
      <Input
        value={query}
        onChange={e => { search(e.target.value); if (onSelect) onSelect(null); }}
        placeholder="Digite o nome do município…"
        required={required && !value}
        autoComplete="off"
      />
      {loading && <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", padding: "2px 0" }}>Buscando…</div>}
      {open && results.length > 0 && (
        <div className="mun-autocomplete__dropdown">
          {results.map(m => (
            <div key={m.id} className="mun-autocomplete__item" onClick={() => pick(m)}>
              <span>{m.name}</span>
              <span className="mun-autocomplete__uf">{m.uf}</span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "auto" }}>IBGE {m.ibgeCode}</span>
            </div>
          ))}
        </div>
      )}
      {open && results.length === 0 && !loading && (
        <div className="mun-autocomplete__dropdown">
          <div className="mun-autocomplete__item" style={{ color: "var(--text-muted)", cursor: "default" }}>Nenhum município encontrado</div>
        </div>
      )}
    </div>
  );
}

function LicenseForm({ token, onDone, onBack }) {
  const [form, setForm] = useState({ municipalityId: "", plan: "STARTER", contractNumber: "", contractStart: "", contractEnd: "", renewalDate: "", notes: "" });
  const [munInfo, setMunInfo]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [templates, setTemplates] = useState({});
  const [planInfo, setPlanInfo] = useState(null);

  useEffect(() => {
    apiFetch("/platform/plan-templates", token).then(d => setTemplates(d?.templates || {})).catch(() => {});
  }, [token]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleMunSelect = (mun) => {
    if (!mun) { setMunInfo(null); set("municipalityId", ""); return; }
    setMunInfo(mun);
    set("municipalityId", mun.ibgeCode || mun.id);
  };

  const handlePlanChange = (plan) => {
    set("plan", plan);
    const tpl = templates[plan];
    if (tpl) setPlanInfo(tpl);
    else setPlanInfo(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.municipalityId) { setError("Selecione um município."); return; }
    setSaving(true); setError("");
    try {
      const d = await apiFetch("/platform/licenses", token, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      onDone(d);
    } catch (ex) { setError(ex.message); }
    setSaving(false);
  };

  return (
    <>
      <div className="console-page-header">
        <div>
          <button type="button" onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "var(--s-1)", padding: 0 }}>
            ← Voltar
          </button>
          <h1 className="console-page-header__title">Nova Licença</h1>
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <form onSubmit={handleSubmit} style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
        {/* Municipality autocomplete */}
        <MunicipalityAutocomplete token={token} value={munInfo} onSelect={handleMunSelect} required />

        {/* Auto-filled municipality info */}
        {munInfo && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: "var(--s-2)", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "var(--s-3)" }}>
            {[
              ["IBGE", munInfo.ibgeCode || "—"],
              ["UF", munInfo.uf || "—"],
              ["Região", munInfo.region || "—"],
              ["Status", munInfo.status || "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>{k}</div>
                <div style={{ fontWeight: 600, fontSize: "var(--t-sm)" }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {/* Plan selector */}
        <div>
          <label className="form-label">Plano *</label>
          <select value={form.plan} onChange={e => handlePlanChange(e.target.value)} required
            style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "var(--t-base)" }}>
            {Object.keys(templates).length === 0
              ? <option value="STARTER">STARTER</option>
              : Object.entries(templates).map(([k, t]) => (
                  <option key={k} value={k}>{k} — UBS: {t.limits?.maxUnits ?? "∞"}, Usuários: {t.limits?.maxUsers ?? "∞"}</option>
                ))}
          </select>
        </div>

        {/* Plan auto-fill info */}
        {planInfo && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: "var(--s-2)", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "var(--s-3)" }}>
            {[
              ["UBS (máx.)", planInfo.limits?.maxUnits ?? "Ilimitado"],
              ["Usuários (máx.)", planInfo.limits?.maxUsers ?? "Ilimitado"],
              ["Módulos", (planInfo.features || []).join(", ") || "Padrão"],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>{k}</div>
                <div style={{ fontWeight: 600, fontSize: "var(--t-sm)" }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        <Input label="Número do contrato" value={form.contractNumber} onChange={e => set("contractNumber", e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
          <Input label="Início do contrato" type="date" value={form.contractStart} onChange={e => set("contractStart", e.target.value)} />
          <Input label="Vencimento" type="date" value={form.contractEnd} onChange={e => set("contractEnd", e.target.value)} />
        </div>
        <Input label="Data de renovação" type="date" value={form.renewalDate} onChange={e => set("renewalDate", e.target.value)} />
        <div>
          <label className="form-label">Notas</label>
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", resize: "vertical", fontFamily: "var(--font-sans)", fontSize: "var(--t-base)" }} />
        </div>
        <div style={{ display: "flex", gap: "var(--s-2)" }}>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Criar Licença"}</Button>
          <Button type="button" variant="secondary" onClick={onBack}>Cancelar</Button>
        </div>
      </form>
    </>
  );
}

// ── NOC Console ────────────────────────────────────────────────────────────

const HEALTH_COLOR = {
  HEALTHY:  "var(--success, #16a34a)",
  WARNING:  "var(--warning, #d97706)",
  CRITICAL: "var(--danger,  #dc2626)",
  OFFLINE:  "#6b7280",
  UNKNOWN:  "#9ca3af",
};
const HEALTH_BADGE = {
  HEALTHY: "badge badge--success", WARNING: "badge badge--warning",
  CRITICAL: "badge badge--danger", OFFLINE: "badge", UNKNOWN: "badge",
};

// ══════════════════════════════════════════════════════════════════════════════
// ERP-09 — Platform Governance and Compliance
// ══════════════════════════════════════════════════════════════════════════════

const COMP_STATUS_BADGE = { PASS: "badge badge--success", WARNING: "badge badge--warning", FAIL: "badge badge--danger" };
const BASELINE_STATUS_BADGE = {
  DRAFT: "badge", REVIEW: "badge badge--info", APPROVED: "badge badge--success",
  SUPERSEDED: "badge badge--warning", ARCHIVED: "badge",
};
const ADR_STATUS_BADGE = {
  PROPOSED: "badge badge--info", ACCEPTED: "badge badge--success",
  SUPERSEDED: "badge badge--warning", REJECTED: "badge badge--danger", ARCHIVED: "badge",
};
const POLICY_STATUS_BADGE = {
  DRAFT: "badge", ACTIVE: "badge badge--success", EXPIRING: "badge badge--warning",
  EXPIRED: "badge badge--danger", ARCHIVED: "badge",
};
const EXC_STATUS_BADGE = {
  PENDING: "badge badge--info", APPROVED: "badge badge--success",
  REJECTED: "badge badge--danger", EXPIRED: "badge badge--warning", REVOKED: "badge",
};

// ── CMDB constants ────────────────────────────────────────────────────────────
const CI_STATUS_BADGE = {
  PLANNED: "badge badge--info", ACTIVE: "badge badge--success",
  MAINTENANCE: "badge badge--warning", SUSPENDED: "badge badge--warning",
  RETIRED: "badge", ARCHIVED: "badge",
};
const CI_STATUS_LABEL = {
  PLANNED: "Planejado", ACTIVE: "Ativo", MAINTENANCE: "Manutenção",
  SUSPENDED: "Suspenso", RETIRED: "Descontinuado", ARCHIVED: "Arquivado",
};
const CRITICALITY_BADGE = {
  LOW: "badge badge--info", MEDIUM: "badge",
  HIGH: "badge badge--warning", CRITICAL: "badge badge--danger",
  MISSION_CRITICAL: "badge badge--danger",
};
const CRITICALITY_LABEL = {
  LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta",
  CRITICAL: "Crítica", MISSION_CRITICAL: "Missão crítica",
};
const CI_TYPE_LABEL = {
  PLATFORM: "Plataforma", MUNICIPALITY: "Município", UNIT: "Unidade", TEAM: "Equipe",
  DEPLOYMENT: "Implantação", LICENSE: "Licença", RELEASE: "Release", ROLL_OUT: "Rollout",
  BACKUP_POLICY: "Política Backup", BACKUP_EXECUTION: "Execução Backup",
  RESTORE_TEST: "Teste Restore", INCIDENT: "Incidente", POLICY: "Política",
  BASELINE: "Baseline", ADR: "ADR", MAINTENANCE_WINDOW: "Janela Manutenção",
  DATABASE: "Banco de Dados", API: "API", AUTH_SERVICE: "Auth", STORAGE: "Armazenamento",
  SCHEDULER: "Agendador", INTEGRATION: "Integração", CUSTOM: "Personalizado",
};
const REL_TYPE_LABEL = {
  DEPENDS_ON: "Depende de", USES: "Usa", HOSTED_ON: "Hospedado em",
  OWNED_BY: "Pertence a", IMPLEMENTS: "Implementa", GENERATED_BY: "Gerado por",
  PROTECTED_BY: "Protegido por", SUPERSEDES: "Substitui", RELATED_TO: "Relacionado a",
};
const COMP_STATUS_LABEL = { PASS: "Aprovado", WARNING: "Atenção", FAIL: "Falhou" };

function CmdbConsole({ token }) {
  const [tab, setTab] = React.useState("items");
  const [items, setItems] = React.useState([]);
  const [rels, setRels] = React.useState([]);
  const [dash, setDash] = React.useState(null);
  const [impact, setImpact] = React.useState(null);
  const [impactCiId, setImpactCiId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [searchResults, setSearchResults] = React.useState(null);
  const [newCi, setNewCi] = React.useState({ name: "", type: "API", criticality: "MEDIUM", environment: "PRODUCTION", description: "", tags: "" });
  const [showCiForm, setShowCiForm] = React.useState(false);
  const [newRel, setNewRel] = React.useState({ sourceId: "", targetId: "", relType: "DEPENDS_ON", description: "" });
  const [showRelForm, setShowRelForm] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [initLoading, setInitLoading] = React.useState(true);

  const loadAll = React.useCallback(async () => {
    try {
      const [rItems, rRels, rDash] = await Promise.all([
        apiFetch("/platform/cmdb/items?limit=100", token).catch(() => null),
        apiFetch("/platform/cmdb/relationships", token).catch(() => null),
        apiFetch("/platform/cmdb/dashboard", token).catch(() => null),
      ]);
      if (rItems) setItems(rItems.items || []);
      if (rRels)  setRels(rRels.relationships || []);
      if (rDash)  setDash(rDash);
    } catch { /* ignore */ }
    setInitLoading(false);
  }, [token]);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  const createCi = async () => {
    setError(""); setLoading(true);
    const tags = newCi.tags ? newCi.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    try {
      await apiFetch("/platform/cmdb/items", token, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...newCi, tags }),
      });
      setNewCi({ name: "", type: "API", criticality: "MEDIUM", environment: "PRODUCTION", description: "", tags: "" });
      setShowCiForm(false);
      cacheInvalidate("/platform/cmdb");
      await loadAll();
    } catch (ex) { setError(ex.message || "Erro ao registrar CI"); }
    setLoading(false);
  };

  const createRel = async () => {
    setError(""); setLoading(true);
    try {
      await apiFetch("/platform/cmdb/relationships", token, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(newRel),
      });
      setNewRel({ sourceId: "", targetId: "", relType: "DEPENDS_ON", description: "" });
      setShowRelForm(false);
      cacheInvalidate("/platform/cmdb");
      await loadAll();
    } catch (ex) { setError(ex.message || "Erro ao criar relacionamento"); }
    setLoading(false);
  };

  const deleteRel = async (relId) => {
    if (!confirm("Remover relacionamento?")) return;
    await apiFetch(`/platform/cmdb/relationships/${relId}`, token, { method: "DELETE" }).catch(() => {});
    cacheInvalidate("/platform/cmdb");
    await loadAll();
  };

  const runImpact = async () => {
    if (!impactCiId) return;
    const d = await apiFetch(`/platform/cmdb/impact/${impactCiId}`, token).catch(() => null);
    if (d) setImpact(d);
  };

  const runSearch = async () => {
    if (!search.trim()) return;
    const d = await apiFetch(`/platform/cmdb/search?q=${encodeURIComponent(search)}`, token).catch(() => null);
    if (d) setSearchResults(d.results || []);
  };

  const CI_TYPES = ["PLATFORM","MUNICIPALITY","UNIT","TEAM","DEPLOYMENT","LICENSE","RELEASE","ROLL_OUT","BACKUP_POLICY","BACKUP_EXECUTION","RESTORE_TEST","INCIDENT","POLICY","BASELINE","ADR","MAINTENANCE_WINDOW","DATABASE","API","AUTH_SERVICE","STORAGE","SCHEDULER","INTEGRATION","CUSTOM"];
  const REL_TYPES = ["DEPENDS_ON","USES","HOSTED_ON","OWNED_BY","IMPLEMENTS","GENERATED_BY","PROTECTED_BY","SUPERSEDES","RELATED_TO"];

  const TABS = [
    ["items",  "Itens de Configuração"],
    ["rels",   "Relacionamentos"],
    ["impact", "Análise de Impacto"],
    ["search", "Busca"],
  ];

  return (
    <div>
      <ModuleBanner
        icon={<IcoDatabase />}
        title="CMDB"
        subtitle="Base de configuração — ativos operacionais e seus relacionamentos"
        color="#6366f1"
      >
        <div style={{ marginTop: "var(--s-2)" }}>
          <Button onClick={loadAll} variant="secondary" size="sm">↺ Atualizar</Button>
        </div>
      </ModuleBanner>

      {/* KPI Cards DS */}
      <div className="console-kpi-strip" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", marginBottom: "var(--s-5)" }}>
        {[
          { label: "Total de CIs",    value: dash?.total           ?? "—" },
          { label: "Ativos",          value: dash?.active          ?? "—", cls: "console-kpi--success" },
          { label: "Em manutenção",   value: dash?.maintenance     ?? "—", cls: "console-kpi--warning" },
          { label: "Críticos",        value: dash?.critical        ?? "—", cls: "console-kpi--danger" },
          { label: "Missão crítica",  value: dash?.missionCritical ?? "—", cls: "console-kpi--danger" },
          { label: "Relacionamentos", value: dash?.totalRelationships ?? "—" },
        ].map(({ label, value, cls = "" }) => (
          <div key={label} className={`console-kpi ${cls}`}>
            <div className="console-kpi__value">{initLoading ? "—" : value}</div>
            <div className="console-kpi__label">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs DS */}
      <div className="console-tabs" style={{ display: "flex", gap: "var(--s-1)", marginBottom: "var(--s-4)", borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {TABS.map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              padding: "var(--s-2) var(--s-4)",
              border: "none",
              background: "transparent",
              color: tab === k ? "var(--accent)" : "var(--text-muted)",
              fontWeight: tab === k ? 600 : 400,
              fontSize: "var(--t-base)",
              borderBottom: tab === k ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
              transition: "color var(--d-fast), border-color var(--d-fast)",
              marginBottom: "-1px",
              whiteSpace: "nowrap",
            }}
          >{l}</button>
        ))}
      </div>

      {error && <Alert variant="danger" style={{ marginBottom: "var(--s-3)" }}>{error}</Alert>}

      {/* ── CIs ───────────────────────────────────────────────────────────── */}
      {tab === "items" && (
        <>
          {/* Formulário CI em card responsivo */}
          {showCiForm ? (
            <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
              <div className="console-section__header">
                <span>Novo Item de Configuração</span>
                <button type="button" onClick={() => setShowCiForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>Cancelar</button>
              </div>
              <div className="console-section__body">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "var(--s-3)", marginBottom: "var(--s-3)" }}>
                  <div>
                    <label className="form-label">Nome *</label>
                    <Input value={newCi.name} onChange={e => setNewCi(p => ({ ...p, name: e.target.value }))} placeholder="Nome do ativo..." />
                  </div>
                  <div>
                    <label className="form-label">Tipo</label>
                    <select className="console-filter-select" style={{ width: "100%", height: 36 }} value={newCi.type} onChange={e => setNewCi(p => ({ ...p, type: e.target.value }))}>
                      {CI_TYPES.map(t => <option key={t} value={t}>{CI_TYPE_LABEL[t] || t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Criticidade</label>
                    <select className="console-filter-select" style={{ width: "100%", height: 36 }} value={newCi.criticality} onChange={e => setNewCi(p => ({ ...p, criticality: e.target.value }))}>
                      {["LOW","MEDIUM","HIGH","CRITICAL","MISSION_CRITICAL"].map(c => <option key={c} value={c}>{CRITICALITY_LABEL[c] || c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Ambiente</label>
                    <Input value={newCi.environment} onChange={e => setNewCi(p => ({ ...p, environment: e.target.value }))} placeholder="Produção, Staging..." />
                  </div>
                  <div>
                    <label className="form-label">Tags (vírgula)</label>
                    <Input value={newCi.tags} onChange={e => setNewCi(p => ({ ...p, tags: e.target.value }))} placeholder="api, core, auth..." />
                  </div>
                </div>
                <div style={{ marginBottom: "var(--s-3)" }}>
                  <label className="form-label">Descrição</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={newCi.description}
                    onChange={e => setNewCi(p => ({ ...p, description: e.target.value }))}
                    placeholder="Descrição do ativo..."
                    style={{ width: "100%", resize: "vertical", fontFamily: "var(--font-sans)", fontSize: "var(--t-base)" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "var(--s-2)", justifyContent: "flex-end" }}>
                  <Button variant="secondary" onClick={() => setShowCiForm(false)}>Cancelar</Button>
                  <Button onClick={createCi} disabled={loading || !newCi.name}>Registrar CI</Button>
                </div>
              </div>
            </div>
          ) : (
            items.length > 0 && (
              <div style={{ marginBottom: "var(--s-3)", display: "flex", justifyContent: "flex-end" }}>
                <Button onClick={() => setShowCiForm(true)}>+ Novo CI</Button>
              </div>
            )
          )}

          <div className="console-section">
            <div className="console-section__header">
              <span>Itens de Configuração ({items.length})</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              {initLoading ? (
                <div className="console-section__body"><Skeleton count={3} /></div>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={<IcoDatabase size={36} />}
                  title="Nenhum item de configuração registrado"
                  text="Cadastre ativos da plataforma para construir o mapa de dependências da CMDB."
                  cta="Registrar primeiro CI"
                  onCta={() => setShowCiForm(true)}
                />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Código</th><th>Nome</th><th>Tipo</th><th>Status</th>
                      <th>Criticidade</th><th>Ambiente</th><th>Relacionamentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(ci => (
                      <tr key={ci.id}>
                        <td><code style={{ fontSize: "var(--t-xs)", fontFamily: "var(--font-mono)" }}>{ci.ciCode}</code></td>
                        <td style={{ fontWeight: 500 }}>{ci.name}</td>
                        <td><span className="badge">{CI_TYPE_LABEL[ci.type] || ci.type}</span></td>
                        <td><span className={CI_STATUS_BADGE[ci.status] || "badge"}>{CI_STATUS_LABEL[ci.status] || ci.status}</span></td>
                        <td><span className={CRITICALITY_BADGE[ci.criticality] || "badge"}>{CRITICALITY_LABEL[ci.criticality] || ci.criticality}</span></td>
                        <td>{ci.environment || "—"}</td>
                        <td style={{ textAlign: "center" }}>{rels.filter(r => r.sourceId === ci.id || r.targetId === ci.id).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Relationships ──────────────────────────────────────────────────── */}
      {tab === "rels" && (
        <>
          {showRelForm ? (
            <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
              <div className="console-section__header">
                <span>Novo Relacionamento</span>
                <button type="button" onClick={() => setShowRelForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>Cancelar</button>
              </div>
              <div className="console-section__body">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "var(--s-3)", marginBottom: "var(--s-3)" }}>
                  <div>
                    <label className="form-label">CI Origem *</label>
                    <select className="console-filter-select" style={{ width: "100%", height: 36 }} value={newRel.sourceId} onChange={e => setNewRel(p => ({ ...p, sourceId: e.target.value }))}>
                      <option value="">— selecionar —</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.ciCode} {i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Tipo de relação</label>
                    <select className="console-filter-select" style={{ width: "100%", height: 36 }} value={newRel.relType} onChange={e => setNewRel(p => ({ ...p, relType: e.target.value }))}>
                      {REL_TYPES.map(t => <option key={t} value={t}>{REL_TYPE_LABEL[t] || t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">CI Destino *</label>
                    <select className="console-filter-select" style={{ width: "100%", height: 36 }} value={newRel.targetId} onChange={e => setNewRel(p => ({ ...p, targetId: e.target.value }))}>
                      <option value="">— selecionar —</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.ciCode} {i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Descrição</label>
                    <Input value={newRel.description} onChange={e => setNewRel(p => ({ ...p, description: e.target.value }))} placeholder="Opcional..." />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--s-2)", justifyContent: "flex-end" }}>
                  <Button variant="secondary" onClick={() => setShowRelForm(false)}>Cancelar</Button>
                  <Button onClick={createRel} disabled={loading || !newRel.sourceId || !newRel.targetId}>Criar Relacionamento</Button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: "var(--s-3)", display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={() => setShowRelForm(true)} disabled={items.length < 2}>+ Novo Relacionamento</Button>
            </div>
          )}

          <div className="console-section">
            <div className="console-section__header">
              <span>Relacionamentos ({rels.length})</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              {rels.length === 0 ? (
                <EmptyState
                  icon={<IcoDatabase size={36} />}
                  title="Nenhum relacionamento cadastrado"
                  text="Mapeie dependências entre CIs para habilitar a análise de impacto."
                />
              ) : (
                <table className="data-table">
                  <thead><tr><th>Código</th><th>Origem</th><th>Relação</th><th>Destino</th><th>Inverso</th><th>Ação</th></tr></thead>
                  <tbody>
                    {rels.map(r => {
                      const src = items.find(i => i.id === r.sourceId);
                      const tgt = items.find(i => i.id === r.targetId);
                      return (
                        <tr key={r.id}>
                          <td><code style={{ fontSize: "var(--t-xs)", fontFamily: "var(--font-mono)" }}>{r.relCode}</code></td>
                          <td>{src ? `${src.ciCode} ${src.name}` : r.sourceId}</td>
                          <td><span className="badge">{REL_TYPE_LABEL[r.relType] || r.relType}</span></td>
                          <td>{tgt ? `${tgt.ciCode} ${tgt.name}` : r.targetId}</td>
                          <td style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>{REL_TYPE_LABEL[r.inverseType] || r.inverseType}</td>
                          <td><Button variant="danger" size="xs" onClick={() => deleteRel(r.id)}>Remover</Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Análise de Impacto ─────────────────────────────────────────────── */}
      {tab === "impact" && (
        <>
          <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
            <div className="console-section__header"><span>Análise de Impacto</span></div>
            <div className="console-section__body">
              <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginBottom: "var(--s-3)" }}>
                Selecione um CI para ver quais outros CIs seriam afetados em caso de falha.
              </p>
              <div style={{ display: "flex", gap: "var(--s-3)", alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 280px" }}>
                  <label className="form-label">Item de Configuração</label>
                  <select className="console-filter-select" style={{ width: "100%", height: 36 }} value={impactCiId} onChange={e => setImpactCiId(e.target.value)}>
                    <option value="">— selecionar CI —</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.ciCode} {i.name} ({CRITICALITY_LABEL[i.criticality] || i.criticality})</option>)}
                  </select>
                </div>
                <Button onClick={runImpact} disabled={!impactCiId}>Analisar</Button>
              </div>
            </div>
          </div>

          {impact && (
            <div className="console-section">
              <div className="console-section__header">
                <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
                  <span>{impact.name}</span>
                  <span className="badge">{CI_TYPE_LABEL[impact.type] || impact.type}</span>
                  <span className={CRITICALITY_BADGE[impact.criticality] || "badge"}>{CRITICALITY_LABEL[impact.criticality] || impact.criticality}</span>
                </div>
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
                  {impact.totalAffected} CIs afetados
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                {impact.affected.length === 0 ? (
                  <p className="console-section-empty">Nenhum CI dependente encontrado.</p>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Código</th><th>Nome</th><th>Tipo</th><th>Criticidade</th><th>Profundidade</th><th>Via</th></tr></thead>
                    <tbody>
                      {impact.affected.map((a, idx) => (
                        <tr key={idx}>
                          <td><code style={{ fontSize: "var(--t-xs)", fontFamily: "var(--font-mono)" }}>{a.ci.ciCode || "—"}</code></td>
                          <td>{a.ci.name}</td>
                          <td><span className="badge">{CI_TYPE_LABEL[a.ci.type] || a.ci.type || "—"}</span></td>
                          <td><span className={CRITICALITY_BADGE[a.ci.criticality] || "badge"}>{CRITICALITY_LABEL[a.ci.criticality] || a.ci.criticality || "—"}</span></td>
                          <td style={{ textAlign: "center" }}>{a.depth}</td>
                          <td style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>{REL_TYPE_LABEL[a.relType] || a.relType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Busca ─────────────────────────────────────────────────────────── */}
      {tab === "search" && (
        <>
          <div style={{ display: "flex", gap: "var(--s-3)", marginBottom: "var(--s-4)", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Pesquisar CIs</label>
              <Input
                placeholder="Nome, código ou tag..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runSearch()}
              />
            </div>
            <Button onClick={runSearch} disabled={!search.trim()}>Buscar</Button>
          </div>
          {searchResults !== null && (
            <div className="console-section">
              <div className="console-section__header"><span>Resultados ({searchResults.length})</span></div>
              <div style={{ overflowX: "auto" }}>
                {searchResults.length === 0 ? (
                  <p className="console-section-empty">Nenhum CI encontrado para "{search}".</p>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Código</th><th>Nome</th><th>Tipo</th><th>Status</th><th>Criticidade</th></tr></thead>
                    <tbody>
                      {searchResults.map(ci => (
                        <tr key={ci.id}>
                          <td><code style={{ fontSize: "var(--t-xs)", fontFamily: "var(--font-mono)" }}>{ci.ciCode}</code></td>
                          <td>{ci.name}</td>
                          <td><span className="badge">{CI_TYPE_LABEL[ci.type] || ci.type}</span></td>
                          <td><span className={CI_STATUS_BADGE[ci.status] || "badge"}>{CI_STATUS_LABEL[ci.status] || ci.status}</span></td>
                          <td><span className={CRITICALITY_BADGE[ci.criticality] || "badge"}>{CRITICALITY_LABEL[ci.criticality] || ci.criticality}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GovernanceConsole({ token }) {
  const [dash, setDash]         = useState(null);
  const [compliance, setComp]   = useState(null);
  const [baselines, setBase]    = useState([]);
  const [adrs, setAdrs]         = useState([]);
  const [policies, setPols]     = useState([]);
  const [exceptions, setExcs]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [compSearch, setCompSearch] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, compRes, baseRes, adrRes, polRes, excRes] = await Promise.all([
        apiFetch("/platform/governance-dashboard", token).catch(() => null),
        apiFetch("/platform/compliance", token).catch(() => null),
        apiFetch("/platform/baselines", token).catch(() => null),
        apiFetch("/platform/adrs", token).catch(() => null),
        apiFetch("/platform/policies", token).catch(() => null),
        apiFetch("/platform/exceptions", token).catch(() => null),
      ]);
      if (dashRes) setDash(dashRes);
      if (compRes) setComp(compRes);
      if (baseRes) setBase(baseRes.baselines   || []);
      if (adrRes)  setAdrs(adrRes.adrs         || []);
      if (polRes)  setPols(polRes.policies      || []);
      if (excRes)  setExcs(excRes.exceptions    || []);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredAdrs = compSearch
    ? adrs.filter(a => a.title.toLowerCase().includes(compSearch.toLowerCase()) || a.adrCode.toLowerCase().includes(compSearch.toLowerCase()))
    : adrs;

  return (
    <div>
      <ModuleBanner
        icon={<IcoScale />}
        title="Governança & Compliance"
        subtitle="Baselines, ADRs, políticas, exceções e Compliance Engine"
        color="#7c3aed"
        kpis={dash ? [
          { label: "Score", value: dash.complianceScore != null ? `${dash.complianceScore}%` : "N/D" },
          { label: "Baselines", value: dash.totalBaselines ?? 0 },
          { label: "Exceções pendentes", value: dash.pendingExceptions ?? 0 },
        ] : []}
      >
        <div style={{ marginTop: "var(--s-2)" }}>
          <Button onClick={fetchAll} variant="secondary" size="sm">↺ Atualizar</Button>
        </div>
      </ModuleBanner>

      {loading && <Skeleton count={4} />}

      {/* Compliance Engine — hierarquia melhorada */}
      {compliance && (() => {
        const statusColor = compliance.overallStatus === "PASS" ? "var(--success)" : compliance.overallStatus === "FAIL" ? "var(--danger)" : "var(--warning)";
        const passCount = compliance.counts?.PASS ?? 0;
        const warnCount = compliance.counts?.WARNING ?? 0;
        const failCount = compliance.counts?.FAIL ?? 0;
        return (
          <div className="console-section" style={{ marginBottom: "var(--s-5)", borderLeft: `3px solid ${statusColor}` }}>
            <div className="console-section__header">
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
                <span>Compliance Engine</span>
                <span className={COMP_STATUS_BADGE[compliance.overallStatus] || "badge"}>{COMP_STATUS_LABEL[compliance.overallStatus] || compliance.overallStatus}</span>
              </div>
              <div style={{ display: "flex", gap: "var(--s-3)", fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "var(--t-sm)" }}>
                <span style={{ color: "var(--success)" }}>{passCount} aprovados</span>
                {warnCount > 0 && <span style={{ color: "var(--warning)" }}>{warnCount} atenção</span>}
                {failCount > 0 && <span style={{ color: "var(--danger)" }}>{failCount} falharam</span>}
              </div>
            </div>
            <div className="console-section__body" style={{ padding: 0 }}>
              {compliance.results?.map((r, idx) => (
                <div
                  key={r.code}
                  style={{
                    display: "flex", gap: "var(--s-3)", padding: "var(--s-3) var(--s-4)",
                    borderBottom: idx < compliance.results.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    alignItems: "flex-start",
                  }}
                >
                  <span className={COMP_STATUS_BADGE[r.status] || "badge"} style={{ flexShrink: 0, minWidth: 70, textAlign: "center" }}>{r.code}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "var(--t-base)", color: "var(--text)" }}>{r.title}</div>
                    {r.detail && <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginTop: 2 }}>{r.detail}</div>}
                    {r.status !== "PASS" && r.recommendation && (
                      <div style={{ fontSize: "var(--t-sm)", color: "var(--text-dim)", marginTop: 4, paddingLeft: "var(--s-3)", borderLeft: `2px solid ${r.status === "FAIL" ? "var(--danger)" : "var(--warning)"}` }}>
                        {r.recommendation}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* KPI Cards */}
      {dash && (
        <div className="console-kpi-strip" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", marginBottom: "var(--s-5)" }}>
          {[
            { label: "Baselines aprovadas", value: dash.baselines?.approved ?? 0 },
            { label: "ADRs aceitas",        value: dash.adrs?.accepted   ?? 0, cls: "console-kpi--success" },
            { label: "ADRs em revisão",     value: dash.adrs?.proposed   ?? 0 },
            { label: "Políticas ativas",    value: dash.policies?.active ?? 0, cls: "console-kpi--success" },
            { label: "Políticas expirando", value: dash.policies?.expiring ?? 0, cls: "console-kpi--warning" },
            { label: "Exceções abertas",    value: dash.exceptions?.approved ?? 0, cls: (dash.exceptions?.approved ?? 0) > 0 ? "console-kpi--warning" : "" },
          ].map(({ label, value, cls = "" }) => (
            <div key={label} className={`console-kpi ${cls}`}>
              <div className="console-kpi__value">{value}</div>
              <div className="console-kpi__label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Baselines */}
      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header"><span>Baselines ({baselines.length})</span></div>
        <div style={{ overflowX: "auto" }}>
          {baselines.length === 0 ? (
            <p className="console-section-empty">Nenhuma baseline registrada.</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>Código</th><th>Nome</th><th>Versão</th><th>Escopo</th><th>Status</th><th>Aprovado em</th></tr></thead>
              <tbody>
                {baselines.map(b => (
                  <tr key={b.id}>
                    <td><code style={{ fontSize: "var(--t-xs)", fontFamily: "var(--font-mono)" }}>{b.baselineCode}</code></td>
                    <td style={{ fontWeight: 600 }}>{b.name}</td>
                    <td>{b.version}</td>
                    <td>{b.scope}</td>
                    <td><span className={BASELINE_STATUS_BADGE[b.status] || "badge"}>{b.status}</span></td>
                    <td>{fmtDate(b.approvedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ADRs */}
      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header">
          <span>ADRs ({adrs.length})</span>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Input
              placeholder="Buscar ADR..."
              value={compSearch}
              onChange={e => setCompSearch(e.target.value)}
              style={{ height: 28, fontSize: "var(--t-sm)" }}
            />
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          {adrs.length === 0 ? (
            <p className="console-section-empty">Nenhum ADR registrado.</p>
          ) : filteredAdrs.length === 0 ? (
            <p className="console-section-empty">Nenhum ADR encontrado para "{compSearch}".</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>Código</th><th>Título</th><th>Status</th><th>Autor</th><th>Criado</th></tr></thead>
              <tbody>
                {filteredAdrs.map(a => (
                  <tr key={a.id}>
                    <td><code style={{ fontSize: "var(--t-xs)", fontFamily: "var(--font-mono)" }}>{a.adrCode}</code></td>
                    <td>{a.title}</td>
                    <td><span className={ADR_STATUS_BADGE[a.status] || "badge"}>{a.status}</span></td>
                    <td>{a.author || "—"}</td>
                    <td>{fmtDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Políticas */}
      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header"><span>Políticas ({policies.length})</span></div>
        <div style={{ overflowX: "auto" }}>
          {policies.length === 0 ? (
            <p className="console-section-empty">Nenhuma política cadastrada.</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>Código</th><th>Nome</th><th>Categoria</th><th>Versão</th><th>Status</th><th>Vigente até</th></tr></thead>
              <tbody>
                {policies.map(p => (
                  <tr key={p.id}>
                    <td><code style={{ fontSize: "var(--t-xs)", fontFamily: "var(--font-mono)" }}>{p.policyCode}</code></td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td><span className="badge badge--info">{p.category}</span></td>
                    <td>{p.version}</td>
                    <td><span className={POLICY_STATUS_BADGE[p.status] || "badge"}>{p.status}</span></td>
                    <td>{fmtDate(p.effectiveUntil)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Exceções */}
      <div className="console-section">
        <div className="console-section__header"><span>Exceções ({exceptions.length})</span></div>
        <div style={{ overflowX: "auto" }}>
          {exceptions.length === 0 ? (
            <p className="console-section-empty">Nenhuma exceção registrada.</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>Código</th><th>Motivo</th><th>Risco</th><th>Status</th><th>Expira</th><th>Aprovado por</th></tr></thead>
              <tbody>
                {exceptions.map(e => (
                  <tr key={e.id}>
                    <td><code style={{ fontSize: "var(--t-xs)", fontFamily: "var(--font-mono)" }}>{e.exceptionCode}</code></td>
                    <td>{e.reason}</td>
                    <td><span className={e.riskLevel === "CRITICAL" || e.riskLevel === "HIGH" ? "badge badge--danger" : "badge badge--warning"}>{CRITICALITY_LABEL[e.riskLevel] || e.riskLevel}</span></td>
                    <td><span className={EXC_STATUS_BADGE[e.status] || "badge"}>{e.status}</span></td>
                    <td>{fmtDate(e.expiresAt)}</td>
                    <td>{e.approvedBy?.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ERP-08 — Backup, Restore and Business Continuity
// ══════════════════════════════════════════════════════════════════════════════

const RISK_COLOR = { LOW: "#22c55e", MEDIUM: "#f59e0b", HIGH: "#ef4444", CRITICAL: "#7c2d12" };
const RISK_BADGE = { LOW: "badge badge--success", MEDIUM: "badge badge--warning", HIGH: "badge badge--danger", CRITICAL: "badge badge--danger" };
const RPO_BADGE  = { OK: "badge badge--success", BREACHED: "badge badge--danger", UNKNOWN: "badge" };
const EXEC_STATUS_BADGE = {
  SUCCESS: "badge badge--success", FAILED: "badge badge--danger",
  RUNNING: "badge badge--warning", PARTIAL: "badge badge--warning",
  CANCELLED: "badge", PENDING: "badge badge--info",
};
const RESTORE_STATUS_BADGE = {
  SUCCESS: "badge badge--success", FAILED: "badge badge--danger",
  RUNNING: "badge badge--warning", PLANNED: "badge badge--info", CANCELLED: "badge",
};

function BackupConsole({ token }) {
  const [view, setView]         = useState("dashboard");
  const [dash, setDash]         = useState(null);
  const [bcp, setBcp]           = useState(null);
  const [policies, setPolicies] = useState([]);
  const [executions, setExecs]  = useState([]);
  const [tests, setTests]       = useState([]);
  const [loading, setLoading]   = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, bcpRes, polRes, exRes, tstRes] = await Promise.all([
        apiFetch("/platform/backup-dashboard", token).catch(() => null),
        apiFetch("/platform/business-continuity", token).catch(() => null),
        apiFetch("/platform/backup-policies", token).catch(() => null),
        apiFetch("/platform/backups", token).catch(() => null),
        apiFetch("/platform/restore-tests", token).catch(() => null),
      ]);
      if (dashRes) setDash(dashRes);
      if (bcpRes)  setBcp(bcpRes);
      if (polRes)  setPolicies(polRes.policies   || []);
      if (exRes)   setExecs(exRes.executions    || []);
      if (tstRes)  setTests(tstRes.restoreTests  || []);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div>
      <ModuleBanner
        icon={<IcoBackup />}
        title="Backup & Continuidade de Negócio"
        subtitle="Políticas, execuções, testes de restore e perfil de continuidade"
        color="#0891b2"
        kpis={dash ? [
          { label: "Políticas", value: dash.totalPolicies ?? 0 },
          { label: "Completos", value: dash.completed ?? 0 },
          { label: "Falharam",  value: dash.failed ?? 0 },
        ] : []}
      >
        <div style={{ marginTop: "var(--s-2)" }}>
          <Button onClick={fetchAll} variant="secondary" size="sm">↺ Atualizar</Button>
        </div>
      </ModuleBanner>

      {loading && <Skeleton count={4} />}

      {/* KPIs — console-kpi-strip padronizado */}
      {dash && (
        <div className="console-kpi-strip" style={{ marginBottom: "var(--s-4)" }}>
          {[
            { label: "Políticas ativas", value: `${dash.policies?.enabled ?? "—"}/${dash.policies?.total ?? "—"}`, accent: "var(--accent)" },
            { label: "RPO alvo",         value: dash.rpoTargetMinutes != null ? `${dash.rpoTargetMinutes} min` : "—", accent: "var(--text-muted)" },
            { label: "RPO atual",        value: dash.rpoActualMinutes != null ? `${dash.rpoActualMinutes} min` : "—", accent: dash.rpoStatus === "OK" ? "var(--success)" : "var(--warning)" },
            { label: "RTO alvo",         value: dash.rtoTargetMinutes != null ? `${dash.rtoTargetMinutes} min` : "—", accent: "var(--text-muted)" },
            { label: "Backups OK",       value: dash.executions?.success ?? "—",    accent: "var(--success)" },
            { label: "Restores OK",      value: dash.restoreTests?.success ?? "—",  accent: "var(--success)" },
          ].map(({ label, value, accent }) => (
            <div key={label} className="console-kpi" style={{ "--kpi-color": accent }}>
              <div className="console-kpi__accent" />
              <div className="console-kpi__value" style={{ color: accent }}>{value}</div>
              <div className="console-kpi__label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Alertas — semântica: não alertar sobre restore se nem política existe */}
      {(() => {
        if (!dash) return null;
        const hasPolicies = (dash.policies?.total ?? 0) > 0;
        const hasBackups  = (dash.executions?.total ?? 0) > 0;
        // Prioridade: sem política > sem backup > alertas temporais
        if (!hasPolicies) return (
          <div className="console-section" style={{ marginBottom: "var(--s-4)", borderLeft: "3px solid var(--warning)" }}>
            <div className="console-section__header" style={{ color: "var(--warning)" }}><span>Continuidade de negócio — configuração necessária</span></div>
            <div className="console-section__body">
              <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
                Nenhuma política de backup configurada. Configure ao menos uma política antes de monitorar execuções e testes de restore.
              </p>
            </div>
          </div>
        );
        if (!hasBackups) return (
          <div className="console-section" style={{ marginBottom: "var(--s-4)", borderLeft: "3px solid var(--warning)" }}>
            <div className="console-section__header" style={{ color: "var(--warning)" }}><span>Nenhum backup executado</span></div>
            <div className="console-section__body">
              <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
                Política configurada, mas nenhuma execução registrada. Execute o primeiro backup para validar a política.
              </p>
            </div>
          </div>
        );
        const alerts = dash.alerts || [];
        if (alerts.length === 0) return null;
        return (
          <div className="console-section" style={{ marginBottom: "var(--s-4)", borderLeft: "3px solid var(--danger)" }}>
            <div className="console-section__header"><span>Alertas de continuidade ({alerts.length})</span></div>
            <div className="console-section__body" style={{ padding: 0 }}>
              {alerts.map((al, idx) => (
                <div key={al.code} style={{ display: "flex", gap: "var(--s-3)", padding: "var(--s-3) var(--s-4)", alignItems: "flex-start", borderBottom: idx < alerts.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                  <span className={al.severity === "CRITICAL" || al.severity === "HIGH" ? "badge badge--danger" : "badge badge--warning"} style={{ flexShrink: 0 }}>{al.code}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--t-base)" }}>{al.title}</div>
                    {al.recommendation && <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginTop: 2 }}>{al.recommendation}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Last backup + restore */}
      {dash && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="card" style={{ padding: "1rem" }}>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Último backup válido</p>
            {dash.lastBackup ? (
              <><span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{dash.lastBackup.executionCode}</span><br />
              <span style={{ opacity: 0.7, fontSize: "0.85rem" }}>{fmtDate(dash.lastBackup.startedAt)}</span><br />
              <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>{dash.lastBackup.provider || "—"}</span></>
            ) : <span style={{ opacity: 0.5 }}>Nenhum backup registrado</span>}
          </div>
          <div className="card" style={{ padding: "1rem" }}>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Último restore validado</p>
            {dash.lastRestoreTest ? (
              <><span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{dash.lastRestoreTest.restoreCode}</span><br />
              <span style={{ opacity: 0.7, fontSize: "0.85rem" }}>{fmtDate(dash.lastRestoreTest.startedAt)}</span><br />
              <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>{dash.lastRestoreTest.environment}</span></>
            ) : <span style={{ opacity: 0.5 }}>Nenhum restore registrado</span>}
          </div>
        </div>
      )}

      {/* Backup by environment */}
      {dash?.executions?.byEnvironment?.length > 0 && (
        <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
          <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Backups por ambiente</h3>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {dash.executions.byEnvironment.map(env => (
              <div key={env.environment} style={{ flex: "1 1 120px", textAlign: "center", padding: "0.75rem", background: "var(--bg-secondary, rgba(0,0,0,.04))", borderRadius: 8 }}>
                <p style={{ fontWeight: 600, fontSize: "0.85rem" }}>{env.environment}</p>
                <p style={{ fontSize: "1.2rem", fontWeight: 700 }}>{env.success}<span style={{ fontSize: "0.7rem", fontWeight: 400, opacity: 0.6 }}>/{env.total}</span></p>
                {env.failed > 0 && <span className="badge badge--danger">{env.failed} falha(s)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Políticas de Backup */}
      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header"><span>Políticas de Backup ({policies.length})</span></div>
        <div style={{ overflowX: "auto" }}>
          {policies.length === 0 ? (
            <p className="console-section-empty">Nenhuma política de backup configurada.</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>Código</th><th>Nome</th><th>Escopo</th><th>Tipo</th><th>Frequência</th><th>Retenção</th><th>RPO alvo</th><th>Status</th></tr></thead>
              <tbody>
                {policies.map(p => (
                  <tr key={p.id}>
                    <td><code style={{ fontSize: "var(--t-xs)", fontFamily: "var(--font-mono)" }}>{p.policyCode}</code></td>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td><span className="badge badge--info">{p.scope}</span></td>
                    <td>{p.backupType}</td>
                    <td>{p.frequency}</td>
                    <td>{p.retentionDays}d</td>
                    <td>{p.rpoTargetMinutes != null ? `${p.rpoTargetMinutes} min` : "—"}</td>
                    <td><span className={p.enabled ? "badge badge--success" : "badge badge--danger"}>{p.enabled ? "Ativa" : "Desabilitada"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Execuções de Backup */}
      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header"><span>Execuções de Backup ({executions.length})</span></div>
        <div style={{ overflowX: "auto" }}>
          {executions.length === 0 ? (
            <p className="console-section-empty">Nenhuma execução registrada.</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>Código</th><th>Iniciado</th><th>Duração</th><th>Status</th><th>Provedor</th><th>Ambiente</th><th>Verificado</th></tr></thead>
              <tbody>
                {executions.map(e => (
                  <tr key={e.id}>
                    <td><code style={{ fontSize: "var(--t-xs)", fontFamily: "var(--font-mono)" }}>{e.executionCode}</code></td>
                    <td>{fmtDate(e.startedAt)}</td>
                    <td>{e.durationSeconds != null ? `${e.durationSeconds}s` : "—"}</td>
                    <td><span className={EXEC_STATUS_BADGE[e.status] || "badge"}>{e.status}</span></td>
                    <td>{e.backupProvider || "—"}</td>
                    <td>{e.environment}</td>
                    <td style={{ textAlign: "center" }}>{e.verified ? <span className="badge badge--success">Sim</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Testes de Restore */}
      <div className="console-section">
        <div className="console-section__header"><span>Testes de Restore ({tests.length})</span></div>
        <div style={{ overflowX: "auto" }}>
          {tests.length === 0 ? (
            <p className="console-section-empty">Nenhum teste de restore registrado.</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>Código</th><th>Ambiente</th><th>Status</th><th>RPO</th><th>RTO</th><th>Verificado por</th><th>Data</th><th>Evidências</th></tr></thead>
              <tbody>
                {tests.map(t => (
                  <tr key={t.id}>
                    <td><code style={{ fontSize: "var(--t-xs)", fontFamily: "var(--font-mono)" }}>{t.restoreCode}</code></td>
                    <td>{t.environment}</td>
                    <td><span className={RESTORE_STATUS_BADGE[t.status] || "badge"}>{t.status}</span></td>
                    <td>{t.rpoAchievedMinutes != null ? `${t.rpoAchievedMinutes} min` : "—"}</td>
                    <td>{t.rtoAchievedMinutes != null ? `${t.rtoAchievedMinutes} min` : "—"}</td>
                    <td>{t.verifiedBy || "—"}</td>
                    <td>{fmtDate(t.startedAt)}</td>
                    <td style={{ textAlign: "center" }}>{t.evidence?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ERP-07 — Release Management and Change Control
// ══════════════════════════════════════════════════════════════════════════════

const RELEASE_STATUS_LABEL = {
  DRAFT: "Rascunho", APPROVED: "Aprovado", ACTIVE: "Ativo",
  STABLE: "Estável", DEPRECATED: "Depreciado", ROLLED_BACK: "Revertido",
};
const RELEASE_STATUS_BADGE = {
  DRAFT: "badge", APPROVED: "badge badge--info", ACTIVE: "badge badge--warning",
  STABLE: "badge badge--success", DEPRECATED: "badge", ROLLED_BACK: "badge badge--danger",
};
const ROLLOUT_STATUS_LABEL = {
  PLANNED: "Planejado", IN_PROGRESS: "Em andamento", COMPLETED: "Concluído",
  FAILED: "Falhou", ROLLED_BACK: "Revertido", CANCELLED: "Cancelado",
};
const ROLLOUT_STATUS_BADGE = {
  PLANNED: "badge badge--info", IN_PROGRESS: "badge badge--warning",
  COMPLETED: "badge badge--success", FAILED: "badge badge--danger",
  ROLLED_BACK: "badge badge--danger", CANCELLED: "badge",
};
const MW_STATUS_BADGE = {
  PLANNED: "badge badge--info", ACTIVE: "badge badge--warning",
  COMPLETED: "badge badge--success", CANCELLED: "badge",
};

function ReleaseConsole({ token }) {
  const [view, setView]         = useState("dashboard");
  const [dashboard, setDash]    = useState(null);
  const [releases, setReleases] = useState([]);
  const [rollouts, setRollouts] = useState([]);
  const [migrations, setMigs]   = useState([]);
  const [maintenance, setMaint] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, relRes, rollRes, migRes, mwRes] = await Promise.all([
        apiFetch("/platform/releases-dashboard", token).catch(() => null),
        apiFetch("/platform/releases", token).catch(() => null),
        apiFetch("/platform/rollouts", token).catch(() => null),
        apiFetch("/platform/migrations", token).catch(() => null),
        apiFetch("/platform/maintenance", token).catch(() => null),
      ]);
      if (dashRes) setDash(dashRes);
      if (relRes)  setReleases(relRes.releases || []);
      if (rollRes) setRollouts(rollRes.rollouts || []);
      if (migRes)  setMigs(migRes.migrations || []);
      if (mwRes)   setMaint(mwRes.maintenanceWindows || []);
    } finally { setLoading(false); }
  }, [token]);

  const fetchDetail = useCallback(async (id) => {
    const res = await apiFetch(`/platform/releases/${id}`, token).catch(() => null);
    if (res) setDetail(res);
  }, [token]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (view === "detail" && detail) {
    const myRollouts = rollouts.filter(ro => ro.releaseId === detail.id);
    return (
      <div>
        <div className="console-page-header">
          <div>
            <h1 className="console-page-header__title">{detail.releaseCode} — {detail.version}</h1>
            <p className="console-page-header__sub">{detail.title}</p>
          </div>
          <Button variant="ghost" onClick={() => { setView("dashboard"); setDetail(null); }}>← Voltar</Button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="card" style={{ padding: "1rem" }}>
            <p className="card__label">Status</p>
            <span className={RELEASE_STATUS_BADGE[detail.status] || "badge"}>{RELEASE_STATUS_LABEL[detail.status] || detail.status}</span>
          </div>
          <div className="card" style={{ padding: "1rem" }}>
            <p className="card__label">Tipo</p>
            <span className="badge badge--info">{detail.releaseType}</span>
          </div>
          <div className="card" style={{ padding: "1rem" }}>
            <p className="card__label">Data prevista</p>
            <strong>{fmtDate(detail.plannedReleaseDate)}</strong>
          </div>
          <div className="card" style={{ padding: "1rem" }}>
            <p className="card__label">Data de release</p>
            <strong>{fmtDate(detail.releaseDate)}</strong>
          </div>
        </div>

        <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
          <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Changelog ({detail.changelog?.length || 0} itens)</h3>
          {!detail.changelog?.length && <p style={{ opacity: 0.5 }}>Nenhum item no changelog.</p>}
          {detail.changelog?.map(item => (
            <div key={item.id} style={{ borderBottom: "1px solid var(--border-color)", padding: "0.5rem 0" }}>
              <span className="badge">{item.category}</span>
              {item.riskLevel && item.riskLevel !== "LOW" && <span className={`badge badge--${item.riskLevel === "CRITICAL" ? "danger" : "warning"}`} style={{ marginLeft: 6 }}>{item.riskLevel}</span>}
              {item.breakingChange && <span className="badge badge--danger" style={{ marginLeft: 6 }}>Breaking</span>}
              <span style={{ marginLeft: 8 }}>{item.description}</span>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
          <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Rollouts ({myRollouts.length})</h3>
          {!myRollouts.length && <p style={{ opacity: 0.5 }}>Nenhum rollout registrado.</p>}
          <table style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "2px solid var(--border-color)" }}>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Tipo</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Município</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Status</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Versão instalada</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Criado</th>
            </tr></thead>
            <tbody>
              {myRollouts.map(ro => (
                <tr key={ro.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "0.4rem" }}>{ro.targetType}</td>
                  <td style={{ padding: "0.4rem" }}>{ro.municipalityId}</td>
                  <td style={{ padding: "0.4rem" }}><span className={ROLLOUT_STATUS_BADGE[ro.status] || "badge"}>{ROLLOUT_STATUS_LABEL[ro.status] || ro.status}</span></td>
                  <td style={{ padding: "0.4rem" }}>{ro.installedVersion || "—"}</td>
                  <td style={{ padding: "0.4rem" }}>{fmtDate(ro.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ padding: "1rem" }}>
          <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Linha do tempo</h3>
          {detail.timeline?.map(ev => (
            <div key={ev.id} style={{ fontSize: "0.8rem", padding: "0.3rem 0", borderBottom: "1px solid var(--border-color)", opacity: 0.85 }}>
              <strong>{ev.event}</strong>
              {ev.from && <> · {ev.from} → {ev.to}</>}
              {ev.reason && <> · {ev.reason}</>}
              <span style={{ float: "right" }}>{fmtDate(ev.at)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <ModuleBanner
        icon={<IcoDeploy />}
        title="Release Management"
        subtitle="Controle de versões, rollouts e janelas de manutenção"
        color="#059669"
        kpis={dashboard ? [
          { label: "Releases",  value: dashboard.totalReleases  ?? releases.length },
          { label: "Rollouts",  value: dashboard.totalRollouts  ?? rollouts.length },
          { label: "Ativos",    value: dashboard.activeReleases ?? 0 },
        ] : []}
      >
        <div style={{ marginTop: "var(--s-2)" }}>
          <Button onClick={fetchDashboard} variant="secondary" size="sm">↺ Atualizar</Button>
        </div>
      </ModuleBanner>

      {err && <Alert type="error">{err}</Alert>}
      {loading && <Skeleton count={4} />}

      {/* Dashboard cards */}
      {dashboard && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{dashboard.currentVersion || "—"}</p>
            <p className="card__label">Versão atual</p>
          </div>
          <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{dashboard.releases?.total || 0}</p>
            <p className="card__label">Total releases</p>
          </div>
          <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{dashboard.rollouts?.completed || 0}</p>
            <p className="card__label">Rollouts concluídos</p>
          </div>
          <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{dashboard.migrations?.applied || 0}</p>
            <p className="card__label">Migrations aplicadas</p>
          </div>
          <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{dashboard.maintenanceWindows?.active || 0}</p>
            <p className="card__label">Janelas ativas</p>
          </div>
        </div>
      )}

      {/* Upcoming maintenance windows */}
      {dashboard?.maintenanceWindows?.upcoming?.length > 0 && (
        <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem", borderLeft: "3px solid var(--color-warning, #f59e0b)" }}>
          <h3 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Próximas janelas de manutenção</h3>
          {dashboard.maintenanceWindows.upcoming.map(w => (
            <div key={w.id} style={{ fontSize: "0.85rem", padding: "0.25rem 0" }}>
              <strong>{w.title}</strong> · {fmtDate(w.startAt)} → {fmtDate(w.endAt)}
            </div>
          ))}
        </div>
      )}

      {/* Releases table */}
      <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Releases ({releases.length})</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "2px solid var(--border-color)" }}>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Código</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Versão</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Tipo</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Título</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Status</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Release</th>
            </tr></thead>
            <tbody>
              {!releases.length && <tr><td colSpan={6} className="console-section-empty">Nenhuma release registrada.</td></tr>}
              {releases.map(r => (
                <tr
                  key={r.id}
                  style={{ borderBottom: "1px solid var(--border-color)", cursor: "pointer" }}
                  onClick={async () => { await fetchDetail(r.id); setView("detail"); }}
                >
                  <td style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.8rem" }}>{r.releaseCode}</td>
                  <td style={{ padding: "0.4rem", fontWeight: 600 }}>{r.version}</td>
                  <td style={{ padding: "0.4rem" }}><span className="badge badge--info">{r.releaseType}</span></td>
                  <td style={{ padding: "0.4rem" }}>{r.title}</td>
                  <td style={{ padding: "0.4rem" }}><span className={RELEASE_STATUS_BADGE[r.status] || "badge"}>{RELEASE_STATUS_LABEL[r.status] || r.status}</span></td>
                  <td style={{ padding: "0.4rem" }}>{fmtDate(r.releaseDate) || fmtDate(r.plannedReleaseDate) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rollouts table */}
      <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Rollouts ({rollouts.length})</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "2px solid var(--border-color)" }}>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Tipo</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Município</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Versão</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Status</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Instalado</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Criado</th>
            </tr></thead>
            <tbody>
              {!rollouts.length && <tr><td colSpan={6} className="console-section-empty">Nenhum rollout registrado.</td></tr>}
              {rollouts.map(ro => (
                <tr key={ro.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "0.4rem" }}>{ro.targetType}</td>
                  <td style={{ padding: "0.4rem" }}>{ro.municipalityId}</td>
                  <td style={{ padding: "0.4rem" }}>{ro.releaseVersion || "—"}</td>
                  <td style={{ padding: "0.4rem" }}><span className={ROLLOUT_STATUS_BADGE[ro.status] || "badge"}>{ROLLOUT_STATUS_LABEL[ro.status] || ro.status}</span></td>
                  <td style={{ padding: "0.4rem" }}>{ro.installedVersion || "—"}</td>
                  <td style={{ padding: "0.4rem" }}>{fmtDate(ro.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Migrations table */}
      <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Migration Log ({migrations.length})</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "2px solid var(--border-color)" }}>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Código</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Descrição</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Status</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Executado em</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Tempo (ms)</th>
            </tr></thead>
            <tbody>
              {!migrations.length && <tr><td colSpan={5} className="console-section-empty">Nenhuma migration registrada.</td></tr>}
              {migrations.map(m => (
                <tr key={m.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.8rem" }}>{m.migrationCode}</td>
                  <td style={{ padding: "0.4rem" }}>{m.description || "—"}</td>
                  <td style={{ padding: "0.4rem" }}><span className={m.status === "APPLIED" ? "badge badge--success" : m.status === "FAILED" ? "badge badge--danger" : "badge badge--info"}>{m.status}</span></td>
                  <td style={{ padding: "0.4rem" }}>{fmtDate(m.executedAt)}</td>
                  <td style={{ padding: "0.4rem" }}>{m.executionTimeMs ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Maintenance windows */}
      <div className="card" style={{ padding: "1rem" }}>
        <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Janelas de Manutenção ({maintenance.length})</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "2px solid var(--border-color)" }}>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Título</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Início</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Fim</th>
              <th style={{ textAlign: "left", padding: "0.4rem" }}>Status</th>
            </tr></thead>
            <tbody>
              {!maintenance.length && <tr><td colSpan={4} className="console-section-empty">Nenhuma janela de manutenção registrada.</td></tr>}
              {maintenance.map(w => (
                <tr key={w.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "0.4rem" }}>{w.title}</td>
                  <td style={{ padding: "0.4rem" }}>{fmtDate(w.startAt)}</td>
                  <td style={{ padding: "0.4rem" }}>{fmtDate(w.endAt)}</td>
                  <td style={{ padding: "0.4rem" }}><span className={MW_STATUS_BADGE[w.status] || "badge"}>{w.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HealthDot({ status, size = 10 }) {
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: HEALTH_COLOR[status] || "#9ca3af", marginRight: 6, verticalAlign: "middle" }} />;
}

function NocConsole({ token }) {
  const [view, setView]     = useState("dashboard");
  const [health, setHealth] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [diags, setDiags]   = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [msg, setMsg]       = useState("");
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError("");
    Promise.all([
      apiFetch("/platform/health", token).catch(() => null),
      apiFetch("/platform/dashboard", token).catch(() => null),
      apiFetch("/platform/diagnostics", token).catch(() => null),
      apiFetch("/platform/alerts?status=OPEN", token).catch(() => null),
    ]).then(([h, d, diag, alt]) => {
      setHealth(h); setDashboard(d);
      setDiags(diag?.diagnostics || []);
      setAlerts(alt?.alerts || []);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const runDiag = async () => {
    setRunning(true); setMsg(""); setError("");
    try {
      const d = await apiFetch("/platform/diagnostics/run", token, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      setDiags(d.results || []);
      setMsg(`Diagnóstico executado: ${d.findings} ocorrência(s) em ${d.durationMs}ms`);
    } catch (e) { setError(e.message); }
    setRunning(false);
  };

  const ackAlert = async (alertId) => {
    try {
      await apiFetch(`/platform/alerts/${alertId}/ack`, token, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      setMsg("Alerta confirmado"); load();
    } catch (e) { setError(e.message); }
  };

  if (loading) return <><ModuleBanner icon={<IcoMonitor />} title="NOC — Centro de Operações" subtitle="Observabilidade e diagnóstico" color="#1d4ed8" /><Skeleton count={5} /></>;

  return (
    <>
      <ModuleBanner
        icon={<IcoMonitor />}
        title="NOC — Centro de Operações"
        subtitle="Observabilidade e diagnóstico operacional da plataforma VITRAS"
        color="#1d4ed8"
        kpis={dashboard ? [
          { label: "UBS Ativas",       value: dashboard.units?.active ?? "—" },
          { label: "Alertas abertos",  value: dashboard.alerts?.open ?? 0 },
          { label: "Incidentes abertos", value: dashboard.incidents?.open ?? 0 },
        ] : []}
      >
        <div style={{ marginTop: "var(--s-2)", display: "flex", gap: "var(--s-2)" }}>
          <Button variant="secondary" size="sm" onClick={load}>↻ Atualizar</Button>
          <Button size="sm" onClick={runDiag} disabled={running}>{running ? "Executando…" : "Rodar Diagnóstico"}</Button>
        </div>
      </ModuleBanner>

      {error && <Alert variant="danger">{error}</Alert>}
      {msg   && <Alert variant="success">{msg}</Alert>}

      {/* Overall health bar */}
      {health && (
        <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-md)", padding: "var(--s-3) var(--s-4)", marginBottom: "var(--s-4)", display: "flex", alignItems: "center", gap: "var(--s-3)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flex: 1 }}>
            <HealthDot status={health.overall} size={16} />
            <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>Plataforma {health.overall}</span>
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Verificado: {fmtDate(health.checkedAt)}</span>
        </div>
      )}

      {/* Service cards — Datadog/Azure Monitor style */}
      {health?.components && (
        <div className="noc-service-grid">
          {Object.entries(health.components).map(([key, comp]) => {
            const iconMap = {
              database:   { icon: "🗄️", bg: "#dbeafe", color: "#1d4ed8", desc: "Banco de dados principal (Neon PostgreSQL)" },
              filesystem: { icon: "📁", bg: "#dcfce7", color: "#15803d", desc: "Armazenamento de arquivos e db.json" },
              auth:       { icon: "🔐", bg: "#fef3c7", color: "#b45309", desc: "Autenticação JWT e sessões CSRF" },
              api:        { icon: "⚡", bg: "#f3e8ff", color: "#7e22ce", desc: "API REST — endpoints clínicos e ERP" },
              cache:      { icon: "⚙️", bg: "#fce7f3", color: "#be185d", desc: "Cache em memória e invalidação TTL" },
            };
            const meta = iconMap[key] || { icon: "🔧", bg: "var(--surface-3)", color: "var(--text-muted)", desc: comp.detail || "Componente da plataforma" };
            const dotClass = comp.status === "HEALTHY" || comp.status === "OK" ? ""
              : comp.status === "DEGRADED" ? " noc-service-card__status-dot--warn"
              : comp.status === "UNHEALTHY" || comp.status === "ERROR" ? " noc-service-card__status-dot--error"
              : " noc-service-card__status-dot--unknown";
            const statusLabel = comp.status === "HEALTHY" ? "Operacional" : comp.status === "DEGRADED" ? "Degradado" : comp.status === "UNHEALTHY" ? "Falha" : comp.status || "—";
            return (
              <div key={key} className="noc-service-card">
                <div className="noc-service-card__header">
                  <div className="noc-service-card__icon" style={{ background: meta.bg, color: meta.color }}>{meta.icon}</div>
                  <div className="noc-service-card__name">{comp.label}</div>
                  <div className={`noc-service-card__status-dot${dotClass}`} title={statusLabel} />
                </div>
                <div className="noc-service-card__desc">{meta.desc}</div>
                <div className="noc-service-card__meta">
                  <div className="noc-service-card__meta-item">
                    <span className="noc-service-card__meta-label">Status</span>
                    <span className="noc-service-card__meta-value" style={{ color: comp.status === "HEALTHY" || comp.status === "OK" ? "var(--success)" : comp.status === "DEGRADED" ? "var(--warning)" : comp.status === "UNHEALTHY" ? "var(--danger)" : "var(--text-muted)" }}>{statusLabel}</span>
                  </div>
                  {comp.detail && (
                    <div className="noc-service-card__meta-item">
                      <span className="noc-service-card__meta-label">Detalhe</span>
                      <span className="noc-service-card__meta-value" style={{ fontWeight: 400, fontSize: "0.75rem", color: "var(--text-muted)" }}>{comp.detail}</span>
                    </div>
                  )}
                  <div className="noc-service-card__meta-item">
                    <span className="noc-service-card__meta-label">Verificado</span>
                    <span className="noc-service-card__meta-value" style={{ fontWeight: 400, fontSize: "0.75rem", color: "var(--text-muted)" }}>{fmtDate(health.checkedAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* KPIs NOC — console-kpi-strip padronizado */}
      {dashboard && (
        <div className="console-kpi-strip" style={{ marginBottom: "var(--s-4)" }}>
          {[
            { label: "Implantações",        value: `${dashboard.deployments?.operational ?? "—"}/${dashboard.deployments?.total ?? "—"}`, accent: "var(--accent)" },
            { label: "Licenças Ativas",     value: dashboard.licenses?.active ?? "—", accent: "var(--success)" },
            { label: "UBS Ativas",          value: dashboard.units?.active ?? "—",    accent: "var(--success)" },
            { label: "Municípios",          value: dashboard.municipalities?.total ?? "—", accent: "#3b82f6" },
            { label: "Incidentes Abertos",  value: dashboard.incidents?.open ?? 0,    accent: dashboard.incidents?.critical > 0 ? "var(--danger)" : "var(--warning)" },
            { label: "Alertas Abertos",     value: dashboard.alerts?.open ?? 0,       accent: "var(--warning)" },
          ].map(({ label, value, accent }) => (
            <div key={label} className="console-kpi" style={{ "--kpi-color": accent }}>
              <div className="console-kpi__accent" />
              <div className="console-kpi__value" style={{ color: accent }}>{value}</div>
              <div className="console-kpi__label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Open Alerts */}
      {alerts.length > 0 && (
        <div className="console-section">
          <div className="console-section__header">Alertas Abertos ({alerts.length})</div>
          <div className="console-section__body">
            <table className="console-table">
              <thead><tr><th>Código</th><th>Título</th><th>Categoria</th><th>Severidade</th><th>Criado em</th><th></th></tr></thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{a.alertCode}</td>
                    <td>{a.title}</td>
                    <td style={{ fontSize: "0.8rem" }}>{a.category}</td>
                    <td><span className={HEALTH_BADGE[a.severity === "CRITICAL" ? "CRITICAL" : a.severity === "HIGH" ? "WARNING" : "HEALTHY"] || "badge"}>{a.severity}</span></td>
                    <td style={{ fontSize: "0.8rem" }}>{fmtDate(a.createdAt)}</td>
                    <td><Button size="sm" variant="secondary" onClick={() => ackAlert(a.id)}>Confirmar</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Diagnostics */}
      <div className="console-section">
        <div className="console-section__header">Diagnósticos ({diags.length} ocorrência(s))</div>
        <div className="console-section__body">
          {diags.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Nenhuma ocorrência encontrada — plataforma saudável</p>
          ) : diags.map(d => (
            <div key={d.id} style={{ display: "flex", gap: "var(--s-3)", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "0.85rem", alignItems: "flex-start" }}>
              <span style={{ fontFamily: "monospace", fontSize: "0.75rem", minWidth: 80, color: "var(--text-muted)" }}>{d.code}</span>
              <span className={d.severity === "CRITICAL" ? "badge badge--danger" : d.severity === "HIGH" ? "badge badge--warning" : "badge badge--info"} style={{ fontSize: "0.7rem", minWidth: 60, textAlign: "center" }}>{d.severity}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{d.title}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{d.description}</div>
                {d.recommendation && <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: 2 }}>→ {d.recommendation}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Incident Console ───────────────────────────────────────────────────────

const INCIDENT_STATUS_LABEL = {
  NEW: "Novo", TRIAGED: "Triado", IN_PROGRESS: "Em andamento", WAITING: "Aguardando",
  RESOLVED: "Resolvido", CLOSED: "Fechado", CANCELLED: "Cancelado", REOPENED: "Reaberto",
};
const INCIDENT_STATUS_CLASS = {
  NEW: "badge badge--warning", TRIAGED: "badge badge--info", IN_PROGRESS: "badge badge--warning",
  WAITING: "badge", RESOLVED: "badge badge--success", CLOSED: "badge",
  CANCELLED: "badge", REOPENED: "badge badge--danger",
};
const SEVERITY_CLASS = {
  CRITICAL: "badge badge--danger", HIGH: "badge badge--warning",
  MEDIUM: "badge badge--info", LOW: "badge",
};

function IncidentConsole({ token }) {
  const [view, setView]       = useState("list");
  const [selected, setSelected] = useState(null);
  const [listKey, setListKey] = useState(0);

  if (view === "detail" && selected) {
    return <IncidentDetail token={token} incidentId={selected} onBack={() => { setSelected(null); setView("list"); setListKey(k => k + 1); }} />;
  }
  if (view === "new") {
    return <IncidentForm token={token} onDone={(inc) => { setSelected(inc.id); setView("detail"); }} onBack={() => setView("list")} />;
  }
  return <IncidentListView key={listKey} token={token} onSelect={id => { setSelected(id); setView("detail"); }} onNew={() => setView("new")} />;
}

function IncidentListView({ token, onSelect, onNew }) {
  const [incidents, setIncidents] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [filterStatus, setFilterStatus]     = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [search, setSearch]                 = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filterStatus)   params.set("status",   filterStatus);
    if (filterSeverity) params.set("severity",  filterSeverity);
    if (search)         params.set("search",    search);
    Promise.all([
      apiFetch(`/platform/incidents?${params}`, token).catch(() => null),
      apiFetch("/platform/incidents-dashboard", token).catch(() => null),
    ]).then(([d1, d2]) => {
      setIncidents(d1?.incidents || []);
      setDashboard(d2);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [token, filterStatus, filterSeverity, search]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <><ModuleBanner icon={<IcoBell />} title="Incidentes" subtitle="Operações de suporte e gerenciamento de incidentes técnicos" color="#ef4444" /><KpiSkeleton count={6} /></>;
  if (error)   return <><ModuleBanner icon={<IcoBell />} title="Incidentes" subtitle="Operações de suporte" color="#ef4444" /><ErrorBlock message={error} onRetry={load} /></>;

  return (
    <>
      <ModuleBanner
        icon={<IcoBell />}
        title="Incidentes"
        subtitle="Operações de suporte e gerenciamento de incidentes técnicos"
        color="#ef4444"
        kpis={dashboard ? [
          { label: "Abertos",   value: (dashboard.summary.new || 0) + (dashboard.summary.inProgress || 0) },
          { label: "Críticos",  value: dashboard.summary.critical || 0 },
          { label: "Municípios afetados", value: dashboard.affectedMunicipalities || 0 },
        ] : []}
      >
        <div style={{ marginTop: "var(--s-2)" }}>
          <Button onClick={onNew}>+ Novo Incidente</Button>
        </div>
      </ModuleBanner>

      {dashboard && (
        <div className="noc-kpi-grid" style={{ marginBottom: "var(--s-4)" }}>
          {[
            { label: "Novos",        value: dashboard.summary.new         || 0, color: "#f59e0b" },
            { label: "Em andamento", value: dashboard.summary.inProgress   || 0, color: "#f59e0b" },
            { label: "Críticos",     value: dashboard.summary.critical     || 0, color: "#ef4444" },
            { label: "Aguardando",   value: dashboard.summary.waiting      || 0, color: "#6b7280" },
            { label: "Resolvidos",   value: dashboard.summary.resolvedToday|| 0, color: "#10b981" },
            { label: "Municípios",   value: dashboard.affectedMunicipalities|| 0, color: "#3b82f6" },
          ].map(k => (
            <div key={k.label} className="noc-kpi" style={{ "--kpi-color": k.color, border: "1px solid var(--border)", background: "var(--surface)", textAlign: "left" }}>
              <div className="noc-kpi__accent" />
              <div className="noc-kpi__value" style={{ color: k.color }}>{k.value}</div>
              <div className="noc-kpi__label">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: "var(--s-3)", display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por código, título, tag…"
          style={{ padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", minWidth: 220 }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
          <option value="">Todos os status</option>
          {Object.entries(INCIDENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
          style={{ padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
          <option value="">Todas severidades</option>
          {["CRITICAL","HIGH","MEDIUM","LOW"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="console-section">
        <div className="console-table-wrap">
          <table className="console-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Título</th>
                <th>Severidade</th>
                <th>Status</th>
                <th>Responsável</th>
                <th>Aberto em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr><td colSpan={7}>
                  <EmptyState icon={<IcoCheckCircle size={36} />} title="Nenhum incidente encontrado" text="Nenhum incidente corresponde aos filtros selecionados." />
                </td></tr>
              ) : incidents.map(inc => (
                <tr key={inc.id} className="is-clickable" onClick={() => onSelect(inc.id)}>
                  <td><code style={{ fontSize: "var(--t-xs)" }}>{inc.incidentCode}</code></td>
                  <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{inc.title}</td>
                  <td><span className={SEVERITY_CLASS[inc.severity] || "badge"}>{inc.severity}</span></td>
                  <td><span className={INCIDENT_STATUS_CLASS[inc.status] || "badge"}>{INCIDENT_STATUS_LABEL[inc.status] || inc.status}</span></td>
                  <td style={{ color: "var(--text-muted)" }}>{inc.assignedTo?.name || "—"}</td>
                  <td style={{ color: "var(--text-muted)" }}>{fmtDate(inc.createdAt)}</td>
                  <td style={{ textAlign: "right" }}>
                    <Button size="sm" variant="secondary" onClick={e => { e.stopPropagation(); onSelect(inc.id); }}>Ver →</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function IncidentDetail({ token, incidentId, onBack }) {
  const [incident, setIncident] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [msg, setMsg]           = useState("");
  const [comment, setComment]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(() => {
    apiFetch(`/platform/incidents/${incidentId}`, token)
      .then(d => { setIncident(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [token, incidentId]);

  useEffect(() => { reload(); }, [reload]);

  const doAction = async (path, body, method = "PATCH") => {
    setSubmitting(true); setError(""); setMsg("");
    try {
      const d = await apiFetch(path, token, {
        method, headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setIncident(d); setMsg("Atualizado com sucesso");
    } catch (e) { setError(e.message); }
    setSubmitting(false);
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    await doAction(`/platform/incidents/${incidentId}/comment`, { text: comment }, "POST");
    setComment("");
  };

  if (loading) return <p>Carregando…</p>;
  if (!incident) return <Alert variant="danger">Incidente não encontrado</Alert>;

  const inc = incident;
  const STATUS_NEXTS = {
    NEW:         ["TRIAGED","CANCELLED"],
    TRIAGED:     ["IN_PROGRESS","WAITING","CANCELLED"],
    IN_PROGRESS: ["WAITING","RESOLVED","CANCELLED"],
    WAITING:     ["IN_PROGRESS","RESOLVED","CANCELLED"],
    RESOLVED:    ["CLOSED","REOPENED"],
    CLOSED:      ["REOPENED"],
    CANCELLED:   [],
    REOPENED:    ["IN_PROGRESS","WAITING","CANCELLED"],
  };
  const nexts = STATUS_NEXTS[inc.status] || [];

  return (
    <>
      <div className="console-page-header">
        <div>
          <button type="button" onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "var(--s-1)", padding: 0 }}>
            ← Console Nacional &rsaquo; Incidentes
          </button>
          <h1 className="console-page-header__title">{inc.incidentCode} — {inc.title}</h1>
          <p className="console-page-header__sub">{inc.category} · Município {inc.municipalityId || "—"}</p>
        </div>
        <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center" }}>
          <span className={SEVERITY_CLASS[inc.severity] || "badge"} style={{ fontSize: "0.85rem" }}>{inc.severity}</span>
          <span className={INCIDENT_STATUS_CLASS[inc.status] || "badge"} style={{ fontSize: "0.85rem" }}>{INCIDENT_STATUS_LABEL[inc.status] || inc.status}</span>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {msg   && <Alert variant="success">{msg}</Alert>}

      {/* Info */}
      <div className="console-section">
        <div className="console-section__header">Detalhes</div>
        <div className="console-section__body">
          <p style={{ fontSize: "0.875rem", marginBottom: "var(--s-3)" }}>{inc.description || "—"}</p>
          <table style={{ fontSize: "0.875rem", borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["Responsável",     inc.assignedTo?.name || "Não atribuído"],
                ["Criado por",      inc.reportedBy?.name || "—"],
                ["Criado em",       fmtDate(inc.createdAt)],
                ["1ª resposta",     fmtDate(inc.firstResponseAt)],
                ["Resolvido em",    fmtDate(inc.resolvedAt)],
                ["Fechado em",      fmtDate(inc.closedAt)],
                ["Deployment",      inc.deploymentId || "—"],
                ["Licença",         inc.licenseId || "—"],
                ["Break Glass",     inc.breakGlassSessionId || "—"],
                ["Tags",            (inc.tags || []).join(", ") || "—"],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ color: "var(--text-muted)", padding: "3px 16px 3px 0", width: 160 }}>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(inc.rootCause || inc.resolution) && (
            <div style={{ marginTop: "var(--s-3)" }}>
              {inc.rootCause  && <div style={{ fontSize: "0.85rem", marginBottom: "var(--s-1)" }}><strong>Causa raiz:</strong> {inc.rootCause}</div>}
              {inc.resolution && <div style={{ fontSize: "0.85rem" }}><strong>Resolução:</strong> {inc.resolution}</div>}
            </div>
          )}
        </div>
      </div>

      {/* SLA */}
      {inc.sla && (
        <div className="console-section">
          <div className="console-section__header">SLA</div>
          <div className="console-section__body" style={{ display: "flex", gap: "var(--s-4)", flexWrap: "wrap", fontSize: "0.85rem" }}>
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>1ª resposta deadline</div>
              <div style={{ color: inc.slaStatus?.firstResponseBreached ? "var(--danger)" : "inherit" }}>
                {fmtDate(inc.sla.firstResponseDeadline)}
                {inc.slaStatus?.firstResponseBreached && " ⚠ Breached"}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>Resolução deadline</div>
              <div style={{ color: inc.slaStatus?.resolutionBreached ? "var(--danger)" : "inherit" }}>
                {fmtDate(inc.sla.resolutionDeadline)}
                {inc.slaStatus?.resolutionBreached && " ⚠ Breached"}
              </div>
            </div>
            {inc.slaStatus?.responseAgeMinutes != null && (
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginBottom: 2 }}>Tempo de resposta</div>
                <div>{inc.slaStatus.responseAgeMinutes} min</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {nexts.length > 0 && (
        <div className="console-section">
          <div className="console-section__header">Ações de status</div>
          <div className="console-section__body" style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
            {nexts.map(toStatus => (
              <Button key={toStatus} variant={toStatus === "CANCELLED" ? "danger" : "secondary"} disabled={submitting}
                onClick={() => {
                  const reason = window.prompt(`Motivo (opcional) — ${INCIDENT_STATUS_LABEL[toStatus] || toStatus}`);
                  if (reason === null) return;
                  const body = { toStatus, reason: reason || null };
                  if (toStatus === "RESOLVED") {
                    const rc = window.prompt("Causa raiz:");
                    const res = window.prompt("Resolução aplicada:");
                    body.rootCause = rc || null; body.resolution = res || null;
                  }
                  doAction(`/platform/incidents/${incidentId}/status`, body);
                }}>
                → {INCIDENT_STATUS_LABEL[toStatus] || toStatus}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Assign */}
      <div className="console-section">
        <div className="console-section__header">Atribuição</div>
        <div className="console-section__body" style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem" }}>Atual: <strong>{inc.assignedTo?.name || "Não atribuído"}</strong></span>
          <Button size="sm" variant="secondary" disabled={submitting}
            onClick={() => {
              const id = window.prompt("ID do responsável:");
              if (!id) return;
              const name = window.prompt("Nome:");
              doAction(`/platform/incidents/${incidentId}/assign`, { assigneeId: id, assigneeName: name || id });
            }}>Atribuir</Button>
        </div>
      </div>

      {/* Comments */}
      <div className="console-section">
        <div className="console-section__header">Comentário interno</div>
        <div className="console-section__body">
          <form onSubmit={submitComment} style={{ display: "flex", gap: "var(--s-2)", alignItems: "flex-end" }}>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Adicionar comentário interno…"
              style={{ flex: 1, padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", resize: "vertical" }} />
            <Button type="submit" disabled={submitting || !comment.trim()}>Enviar</Button>
          </form>
        </div>
      </div>

      {/* Timeline */}
      <div className="console-section">
        <div className="console-section__header">Timeline</div>
        <div className="console-section__body">
          {[...(inc.timeline || [])].reverse().map((e, i) => (
            <div key={i} style={{ display: "flex", gap: "var(--s-2)", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>
              <span style={{ color: "var(--text-muted)", minWidth: 130 }}>{fmtDate(e.at)}</span>
              <span style={{ fontWeight: 600, minWidth: 160 }}>{e.event}</span>
              <span style={{ color: "var(--text-muted)", minWidth: 120 }}>{e.by?.name || "—"}</span>
              <span>{e.reason || (e.meta?.text ? `"${e.meta.text}"` : "") || (e.from && e.to ? `${e.from} → ${e.to}` : "")}</span>
            </div>
          ))}
          {(inc.timeline || []).length === 0 && <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Nenhum evento</p>}
        </div>
      </div>
    </>
  );
}

function IncidentForm({ token, onDone, onBack }) {
  const [form, setForm] = useState({ title: "", description: "", category: "", severity: "MEDIUM", municipalityId: "", unitId: "", deploymentId: "", licenseId: "", breakGlassSessionId: "", tags: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    apiFetch("/platform/incident-categories", token).then(d => setCategories(d?.categories || [])).catch(() => {});
  }, [token]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
      const d = await apiFetch("/platform/incidents", token, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, tags, unitId: form.unitId || null, deploymentId: form.deploymentId || null, licenseId: form.licenseId || null, breakGlassSessionId: form.breakGlassSessionId || null }),
      });
      onDone(d);
    } catch (ex) { setError(ex.message); }
    setSaving(false);
  };

  const selectStyle = { width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };

  return (
    <>
      <div className="console-page-header">
        <div>
          <button type="button" onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "var(--s-1)", padding: 0 }}>← Voltar</button>
          <h1 className="console-page-header__title">Novo Incidente</h1>
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <form onSubmit={handleSubmit} style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
        <Input label="Título *" value={form.title} onChange={e => set("title", e.target.value)} required />
        <div>
          <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Categoria *</label>
          <select value={form.category} onChange={e => set("category", e.target.value)} required style={selectStyle}>
            <option value="">Selecione…</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Severidade *</label>
          <select value={form.severity} onChange={e => set("severity", e.target.value)} required style={selectStyle}>
            {["CRITICAL","HIGH","MEDIUM","LOW"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Descrição</label>
          <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} style={{ ...selectStyle, resize: "vertical" }} />
        </div>
        <Input label="IBGE do Município" value={form.municipalityId} onChange={e => set("municipalityId", e.target.value)} />
        <Input label="ID da UBS (opcional)" value={form.unitId} onChange={e => set("unitId", e.target.value)} />
        <Input label="ID do Deployment (opcional)" value={form.deploymentId} onChange={e => set("deploymentId", e.target.value)} />
        <Input label="ID da Licença (opcional)" value={form.licenseId} onChange={e => set("licenseId", e.target.value)} />
        <Input label="ID da Sessão Break Glass (opcional)" value={form.breakGlassSessionId} onChange={e => set("breakGlassSessionId", e.target.value)} />
        <Input label="Tags (separadas por vírgula)" value={form.tags} onChange={e => set("tags", e.target.value)} placeholder="auth, migration, jwt" />
        <div style={{ display: "flex", gap: "var(--s-2)" }}>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Criar Incidente"}</Button>
          <Button type="button" variant="secondary" onClick={onBack}>Cancelar</Button>
        </div>
      </form>
    </>
  );
}

// ── Main Console ───────────────────────────────────────────────────────────

export default function PlatformConsolePage({ token, user, onLogout }) {
  const [tab, setTab]                               = useState("overview");
  const [visitedTabs, setVisitedTabs]               = useState(new Set(["overview"]));
  const [view, setView]                             = useState("list");
  const [selectedUnitId, setSelectedUnitId]         = useState(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [newUnitMunicipality, setNewUnitMunicipality]   = useState(null);
  const [selectedDeployment, setSelectedDeployment] = useState(null);
  const [listKey, setListKey]                       = useState(0);

  function goToDetail(unit) {
    setSelectedUnitId(unit.id);
    setView("unit-detail");
    setTab("units");
  }

  function goToList() {
    setSelectedUnitId(null);
    setView("list");
  }

  function afterNewUnit() {
    setListKey((k) => k + 1);
    setView("list");
  }

  function switchTab(t) {
    setTab(t);
    setVisitedTabs(prev => new Set([...prev, t]));
    setView("list");
    setSelectedUnitId(null);
    setSelectedMunicipality(null);
    setSelectedDeployment(null);
  }

  function goToDeploymentDetail(dep) {
    setSelectedDeployment(dep);
    setView("deployment-detail");
  }

  function backToDeploymentList() {
    setSelectedDeployment(null);
    setView("list");
  }

  function goToMunicipalityDetail(m) {
    setSelectedMunicipality(m);
    setView("municipality-detail");
  }

  function backToMunicipalityList() {
    setSelectedMunicipality(null);
    setView("list");
  }

  function goToNewUnitFromMunicipality(mun) {
    setNewUnitMunicipality(mun);
    setView("new-unit-from-mun");
  }

  function goToUnitFromMunicipality(unit) {
    setSelectedUnitId(unit.id);
    setTab("units");
    setView("unit-detail");
    setSelectedMunicipality(null);
  }

  return (
    <div className="console-shell">
      {/* Header */}
      <header className="console-header">
        <div className="console-header__brand">
          <BrandLockup variant="compact-light" />
          <span className="console-header__badge">Console Nacional</span>
        </div>
        <div className="console-header__user">
          <span className="console-header__username">{user?.name}</span>
          <Button variant="secondary" size="sm" onClick={onLogout}>Sair</Button>
        </div>
      </header>

      <div className="console-body">
        {/* Sidenav */}
        <nav className="console-sidenav" aria-label="Navegação do console">
          <span className="console-nav__section">Painel</span>
          <button
            type="button"
            className={`console-nav__item${tab === "overview" ? " is-active" : ""}`}
            onClick={() => switchTab("overview")}
          >
            <IcoOverview /> Visão Geral
          </button>

          <span className="console-nav__section">Gestão</span>
          <button
            type="button"
            className={`console-nav__item${tab === "municipalities" ? " is-active" : ""}`}
            onClick={() => switchTab("municipalities")}
          >
            <IcoMunicipality /> Municípios
          </button>
          <button
            type="button"
            className={`console-nav__item${tab === "deployments" ? " is-active" : ""}`}
            onClick={() => switchTab("deployments")}
          >
            <IcoDeployment /> Implantações
          </button>

          <button
            type="button"
            className={`console-nav__item${tab === "licenses" ? " is-active" : ""}`}
            onClick={() => switchTab("licenses")}
          >
            <IcoLicense /> Licenças
          </button>
          <button
            type="button"
            className={`console-nav__item${tab === "incidents" ? " is-active" : ""}`}
            onClick={() => switchTab("incidents")}
          >
            <IcoIncident /> Incidentes
          </button>
          <button
            type="button"
            className={`console-nav__item${tab === "noc" ? " is-active" : ""}`}
            onClick={() => switchTab("noc")}
          >
            <IcoNoc /> NOC / Observabilidade
          </button>

          <button
            type="button"
            className={`console-nav__item${tab === "releases" ? " is-active" : ""}`}
            onClick={() => switchTab("releases")}
          >
            <IcoRelease /> Releases
          </button>
          <button
            type="button"
            className={`console-nav__item${tab === "backup" ? " is-active" : ""}`}
            onClick={() => switchTab("backup")}
          >
            <IcoBackup /> Backup & Continuidade
          </button>
          <button
            type="button"
            className={`console-nav__item${tab === "governance" ? " is-active" : ""}`}
            onClick={() => switchTab("governance")}
          >
            <IcoGovernance /> Governança & Compliance
          </button>
          <button
            type="button"
            className={`console-nav__item${tab === "cmdb" ? " is-active" : ""}`}
            onClick={() => switchTab("cmdb")}
          >
            <IcoCmdb /> CMDB
          </button>

          <span className="console-nav__section">Portal</span>
          <button
            type="button"
            className={`console-nav__item${tab === "portal" ? " is-active" : ""}`}
            onClick={() => switchTab("portal")}
          >
            <IcoPortal /> Portal do Cidadão
          </button>

          <span className="console-nav__section">Sistema</span>
          <button
            type="button"
            className={`console-nav__item${tab === "migrations" ? " is-active" : ""}`}
            onClick={() => switchTab("migrations")}
          >
            <IcoImport /> Migrações
          </button>
        </nav>

        {/* Content */}
        <main className="console-content">
          {/* NOC Dashboard */}
          {tab === "overview" && (
            <>
              <div className="console-module-banner" style={{ "--module-color": "#3b82f6" }}>
                <div className="console-module-banner__icon"><IcoMonitor /></div>
                <div className="console-module-banner__body">
                  <h1 className="console-module-banner__title">Centro Nacional de Operações</h1>
                  <p className="console-module-banner__sub">Plataforma VITRAS APS — visão em tempo real</p>
                </div>
                <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", textAlign: "right" }}>
                  <div style={{ fontWeight: 600, color: "var(--success)" }}>● OPERACIONAL</div>
                  <div style={{ marginTop: 2 }}>Atualizado agora</div>
                </div>
              </div>
              <ErrorBoundary>
                <NocDashboard token={token} key={listKey} onGoTo={switchTab} />
              </ErrorBoundary>
            </>
          )}

          {/* Municípios */}
          {tab === "municipalities" && (
            <>
              {view === "list" && (
                <MunicipalityListView token={token} onSelect={goToMunicipalityDetail} />
              )}
              {view === "municipality-detail" && selectedMunicipality && (
                <MunicipalityDetailView
                  token={token}
                  municipality={selectedMunicipality}
                  onBack={backToMunicipalityList}
                  onGoToUnit={goToUnitFromMunicipality}
                  onGoToNewUnit={goToNewUnitFromMunicipality}
                />
              )}
              {view === "new-unit-from-mun" && newUnitMunicipality && (
                <UnitForm
                  token={token}
                  prefillMunicipality={newUnitMunicipality}
                  onDone={() => {
                    setNewUnitMunicipality(null);
                    setView("municipality-detail");
                    setListKey(k => k + 1);
                  }}
                  onBack={() => setView("municipality-detail")}
                />
              )}
            </>
          )}

          {/* Implantações */}
          {tab === "deployments" && (
            <>
              {view === "list" && (
                <DeploymentListView token={token} onSelect={goToDeploymentDetail} />
              )}
              {view === "deployment-detail" && selectedDeployment && (
                <DeploymentDetailView
                  token={token}
                  deployment={selectedDeployment}
                  onBack={backToDeploymentList}
                />
              )}
            </>
          )}

          {/* Licenças */}
          {tab === "licenses" && (
            <ErrorBoundary><LicenseConsole token={token} /></ErrorBoundary>
          )}

          {/* Incidentes */}
          {tab === "incidents" && (
            <ErrorBoundary><IncidentConsole token={token} /></ErrorBoundary>
          )}

          {/* NOC / Observabilidade */}
          {tab === "noc" && (
            <ErrorBoundary><NocConsole token={token} /></ErrorBoundary>
          )}

          {/* Releases — lazy mount */}
          <div style={{ display: tab === "releases" ? "block" : "none" }}>
            {visitedTabs.has("releases") && <ErrorBoundary><ReleaseConsole token={token} /></ErrorBoundary>}
          </div>

          {/* Backup & Business Continuity — lazy mount */}
          <div style={{ display: tab === "backup" ? "block" : "none" }}>
            {visitedTabs.has("backup") && <ErrorBoundary><BackupConsole token={token} /></ErrorBoundary>}
          </div>

          {/* Governance & Compliance — lazy mount */}
          <div style={{ display: tab === "governance" ? "block" : "none" }}>
            {visitedTabs.has("governance") && <ErrorBoundary><GovernanceConsole token={token} /></ErrorBoundary>}
          </div>

          {/* CMDB — lazy mount */}
          <div style={{ display: tab === "cmdb" ? "block" : "none" }}>
            {visitedTabs.has("cmdb") && <ErrorBoundary><CmdbConsole token={token} /></ErrorBoundary>}
          </div>

          {/* Unidades de Saúde */}
          {tab === "units" && (
            <>
              {view === "list" && (
                <>
                  <div className="console-page-header">
                    <div>
                      <h1 className="console-page-header__title">Unidades de Saúde</h1>
                      <p className="console-page-header__sub">Gerencie as UBS cadastradas na plataforma</p>
                    </div>
                    <Button onClick={() => setView("new-unit")}>+ Nova UBS</Button>
                  </div>
                  <NationalSummary token={token} key={listKey} />
                  <UnitTable key={listKey} token={token} onSelect={goToDetail} />
                </>
              )}
              {view === "new-unit" && (
                <UnitForm token={token} onDone={afterNewUnit} onBack={goToList} />
              )}
              {view === "unit-detail" && selectedUnitId && (
                <UnitDetail token={token} unitId={selectedUnitId} onBack={goToList} />
              )}
            </>
          )}

          {/* Portal do Cidadão */}
          {tab === "portal" && (
            <CitizenPortalConfig token={token} />
          )}

          {/* Migrações */}
          {tab === "migrations" && (
            <>
              <div className="console-page-header">
                <div>
                  <h1 className="console-page-header__title">Migrações</h1>
                  <p className="console-page-header__sub">Importação de dados e migrações de sistema</p>
                </div>
              </div>
              <ImportConsole token={token} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
