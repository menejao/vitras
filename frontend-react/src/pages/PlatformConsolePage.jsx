import { useState, useEffect, useCallback, useRef } from "react";
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

const IcoWarning = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M8 7v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="8" cy="12" r=".7" fill="currentColor"/>
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

// ── Municipality List View ─────────────────────────────────────────────────

function MunicipalityListView({ token, onSelect }) {
  const [search,  setSearch]  = useState("");
  const [uf,      setUf]      = useState("");
  const [items,   setItems]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    load(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uf]);

  function handleSearchChange(e) {
    const q = e.target.value;
    setSearch(q);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => load(1, q), 300);
  }

  async function load(p = 1, q = search) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 25 });
      if (q.trim()) params.set("search", q.trim());
      if (uf) params.set("uf", uf);
      const data = await apiFetch(`/platform/municipalities?${params}`, token);
      setItems(data?.municipalities || []);
      setTotal(data?.total || 0);
      setPages(data?.pages || 1);
      setPage(p);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }

  return (
    <>
      <div className="console-page-header">
        <div>
          <h1 className="console-page-header__title">Municípios</h1>
          <p className="console-page-header__sub">Base IBGE — municípios disponíveis para implantação do VITRAS</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--s-3)", marginBottom: "var(--s-4)", flexWrap: "wrap" }}>
        <div className="input" style={{ flex: "1 1 240px" }}>
          <input
            value={search}
            onChange={handleSearchChange}
            placeholder="Buscar por nome ou código IBGE..."
          />
        </div>
        <select
          className="console-filter-select"
          value={uf}
          onChange={(e) => setUf(e.target.value)}
          style={{ minWidth: 80 }}
        >
          <option value="">Todas as UFs</option>
          {UF_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {loading && (
        <div style={{ padding: "var(--s-5)", color: "var(--text-dim)", textAlign: "center" }}>Carregando municípios...</div>
      )}
      {!loading && items.length === 0 && (
        <div style={{ padding: "var(--s-5)", color: "var(--text-dim)", textAlign: "center" }}>
          {search || uf ? "Nenhum município encontrado para os filtros informados." : "Base de municípios vazia — execute seed-municipalities.mjs em produção."}
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="console-table-wrap">
          <table className="console-table">
            <thead>
              <tr>
                <th>Município</th>
                <th>UF</th>
                <th>Código IBGE</th>
                <th>Região</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id || m.ibgeCode} style={{ cursor: "pointer" }} onClick={() => onSelect(m)}>
                  <td>
                    {m.name}
                    {m.isCapital && <span className="badge badge--info" style={{ marginLeft: 6, fontSize: "0.7em" }}>capital</span>}
                  </td>
                  <td>{m.uf}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{m.ibgeCode}</td>
                  <td style={{ color: "var(--text-dim)" }}>{m.region || "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="console-table__action">Ver UBS →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-pagination">
            <span>{total} municípios{pages > 1 ? ` — página ${page} de ${pages}` : ""}</span>
            {pages > 1 && (
              <div style={{ display: "flex", gap: "var(--s-2)" }}>
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>← Anterior</Button>
                <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => load(page + 1)}>Próxima →</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Municipality Detail View ───────────────────────────────────────────────

function MunicipalityDetailView({ token, municipality, onBack, onGoToUnit }) {
  const [detail,  setDetail]  = useState(null);
  const [units,   setUnits]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!municipality?.id) return;
    Promise.all([
      apiFetch(`/platform/municipalities/${municipality.id}`, token),
      apiFetch(`/platform/units?municipalityId=${municipality.ibgeCode}&limit=100`, token),
    ])
      .then(([d, u]) => { setDetail(d); setUnits(u?.units || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [municipality, token]);

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", marginBottom: "var(--s-4)", fontSize: "var(--t-sm)", color: "var(--text-dim)" }}>
        <button type="button" className="console-breadcrumb-link" onClick={onBack}>Municípios</button>
        <span>›</span>
        <span style={{ color: "var(--text)" }}>{municipality?.name}</span>
      </div>

      <div className="console-page-header">
        <div>
          <h1 className="console-page-header__title">{municipality?.name}</h1>
          <p className="console-page-header__sub">{municipality?.uf} · IBGE {municipality?.ibgeCode}</p>
        </div>
        <Button variant="secondary" onClick={onBack}>← Municípios</Button>
      </div>

      {loading && <div style={{ padding: "var(--s-5)", color: "var(--text-dim)" }}>Carregando...</div>}

      {!loading && detail && (
        <div className="console-kpi-strip" style={{ marginBottom: "var(--s-5)" }}>
          <div className="console-kpi console-kpi--accent">
            <div className="console-kpi__value">{detail.unitsCount ?? 0}</div>
            <div className="console-kpi__label">UBS cadastradas</div>
          </div>
          <div className="console-kpi console-kpi--success">
            <div className="console-kpi__value">{detail.activeUnitsCount ?? 0}</div>
            <div className="console-kpi__label">Operacionais</div>
          </div>
          <div className="console-kpi">
            <div className="console-kpi__value">{detail.region || "—"}</div>
            <div className="console-kpi__label">Região</div>
          </div>
          {detail.isCapital && (
            <div className="console-kpi">
              <div className="console-kpi__value">Capital</div>
              <div className="console-kpi__label">Tipo</div>
            </div>
          )}
        </div>
      )}

      {!loading && (
        <div className="console-section">
          <div className="console-section__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Unidades de Saúde ({units.length})</span>
          </div>
          <div className="console-section__body">
            {units.length === 0 && (
              <p style={{ color: "var(--text-dim)", margin: 0 }}>Nenhuma UBS cadastrada neste município.</p>
            )}
            {units.map((u) => (
              <div key={u.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "var(--s-3) 0", borderBottom: "1px solid var(--border-subtle)",
              }}>
                <div>
                  <strong>{u.name}</strong>
                  <span style={{ marginLeft: 8, color: "var(--text-dim)", fontSize: "var(--t-sm)" }}>CNES {u.cnes}</span>
                  <span className={STATUS_BADGE[u.status] || "badge"} style={{ marginLeft: 8 }}>{STATUS_LABELS[u.status] || u.status}</span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => onGoToUnit(u)}>Abrir →</Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Municipality Ico ───────────────────────────────────────────────────────

const IcoIncident = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M8 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
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
      <div className="console-page-header">
        <div>
          <h1 className="console-page-header__title">Implantações</h1>
          <p className="console-page-header__sub">Ciclo de vida de implantação por município e UBS</p>
        </div>
      </div>

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
          <div className="console-section__body" style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", padding: "var(--s-6) 0" }}>
            Nenhuma implantação encontrada. Crie a primeira implantação a partir de um município.
          </div>
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

function UnitFormFields({ token, form, setField, autoFilledFields, showStatus }) {
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
          <div style={{ gridColumn: "1 / -1", ...hl("municipalityName") }}>
            <MunicipalityPicker
              token={token}
              value={form.municipalityId ? { ibgeCode: form.municipalityId, name: form.municipalityName, uf: form.uf } : null}
              onSelect={handleMunicipalitySelect}
            />
          </div>
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

function UnitForm({ token, onDone, onBack }) {
  const [form, setForm] = useState({ ...EMPTY_UNIT_FORM });
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
      {error && <Alert type="error" style={{ marginBottom: "var(--s-4)" }}>{error}</Alert>}
      <UnitFormFields token={token} form={form} setField={setField} showStatus />
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
      apiFetch("/platform/licenses" + (filterStatus ? `?status=${filterStatus}` : ""), token),
      apiFetch("/platform/licenses-dashboard", token),
    ]).then(([r1, r2]) => {
      if (!r1.ok) throw new Error("Erro ao carregar licenças");
      return Promise.all([r1.json(), r2.ok ? r2.json() : null]);
    }).then(([d1, d2]) => {
      setLicenses(d1.licenses || []);
      setDashboard(d2);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [token, filterStatus]);

  return (
    <>
      <div className="console-page-header">
        <div>
          <h1 className="console-page-header__title">Licenças</h1>
          <p className="console-page-header__sub">Contratos e ciclo de vida de clientes municipais</p>
        </div>
        <Button onClick={onNew}>+ Nova Licença</Button>
      </div>

      {dashboard && (
        <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap", marginBottom: "var(--s-4)" }}>
          {[
            { label: "Ativas",       value: dashboard.licenses.active,     cls: "badge--success" },
            { label: "Rascunho",     value: dashboard.licenses.draft,      cls: "" },
            { label: "Suspensas",    value: dashboard.licenses.suspended,  cls: "badge--warning" },
            { label: "Expiradas",    value: dashboard.licenses.expired,    cls: "badge--danger" },
            { label: "Vcto ≤30d",    value: dashboard.licenses.expiringIn30Days, cls: "badge--warning" },
          ].map(({ label, value, cls }) => (
            <div key={label} style={{ background: "var(--surface-2)", borderRadius: "var(--radius-md)", padding: "var(--s-2) var(--s-3)", minWidth: 90, textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{value ?? 0}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{label}</div>
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
      .then(r => r.json()).then(setLicense);
  };

  const changeStatus = async (toStatus, reason) => {
    setLoading(true); setError(""); setMsg("");
    try {
      const r = await apiFetch(`/platform/licenses/${license.id}/status`, token, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ toStatus, reason: reason || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erro");
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

function LicenseForm({ token, onDone, onBack }) {
  const [form, setForm] = useState({ municipalityId: "", plan: "STARTER", contractNumber: "", contractStart: "", contractEnd: "", renewalDate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [templates, setTemplates] = useState({});

  useEffect(() => {
    apiFetch("/platform/plan-templates", token).then(r => r.json()).then(d => setTemplates(d.templates || {}));
  }, [token]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const r = await apiFetch("/platform/licenses", token, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erro ao criar licença");
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
      <form onSubmit={handleSubmit} style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
        <Input label="IBGE do Município *" value={form.municipalityId} onChange={e => set("municipalityId", e.target.value)} required />
        <div>
          <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Plano *</label>
          <select value={form.plan} onChange={e => set("plan", e.target.value)} required
            style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
            {Object.keys(templates).length === 0
              ? <option value="STARTER">STARTER</option>
              : Object.entries(templates).map(([k, t]) => (
                  <option key={k} value={k}>{k} — UBS: {t.limits?.maxUnits ?? "∞"}, Usuários: {t.limits?.maxUsers ?? "∞"}</option>
                ))}
          </select>
        </div>
        <Input label="Número do contrato" value={form.contractNumber} onChange={e => set("contractNumber", e.target.value)} />
        <Input label="Início do contrato" type="date" value={form.contractStart} onChange={e => set("contractStart", e.target.value)} />
        <Input label="Vencimento" type="date" value={form.contractEnd} onChange={e => set("contractEnd", e.target.value)} />
        <Input label="Data de renovação" type="date" value={form.renewalDate} onChange={e => set("renewalDate", e.target.value)} />
        <div>
          <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Notas</label>
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", gap: "var(--s-2)" }}>
          <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Criar Licença"}</Button>
          <Button type="button" variant="secondary" onClick={onBack}>Cancelar</Button>
        </div>
      </form>
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
      apiFetch(`/platform/incidents?${params}`, token),
      apiFetch("/platform/incidents-dashboard", token),
    ]).then(([r1, r2]) => {
      if (!r1.ok) throw new Error("Erro ao carregar incidentes");
      return Promise.all([r1.json(), r2.ok ? r2.json() : null]);
    }).then(([d1, d2]) => {
      setIncidents(d1.incidents || []);
      setDashboard(d2);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [token, filterStatus, filterSeverity, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="console-page-header">
        <div>
          <h1 className="console-page-header__title">Incidentes</h1>
          <p className="console-page-header__sub">Operações de suporte e gerenciamento de incidentes técnicos</p>
        </div>
        <Button onClick={onNew}>+ Novo Incidente</Button>
      </div>

      {dashboard && (
        <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap", marginBottom: "var(--s-4)" }}>
          {[
            { label: "Novos",        value: dashboard.summary.new,         cls: "badge--warning" },
            { label: "Em andamento", value: dashboard.summary.inProgress,  cls: "badge--warning" },
            { label: "Críticos",     value: dashboard.summary.critical,    cls: "badge--danger"  },
            { label: "Aguardando",   value: dashboard.summary.waiting,     cls: ""               },
            { label: "Resolvidos hoje", value: dashboard.summary.resolvedToday, cls: "badge--success" },
            { label: "Municípios afetados", value: dashboard.affectedMunicipalities, cls: "" },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "var(--surface-2)", borderRadius: "var(--radius-md)", padding: "var(--s-2) var(--s-3)", minWidth: 90, textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{value ?? 0}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{label}</div>
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

      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? <p>Carregando…</p> : (
        <div className="console-table-wrapper">
          <table className="console-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Título</th>
                <th>Categoria</th>
                <th>Severidade</th>
                <th>Status</th>
                <th>Responsável</th>
                <th>Aberto em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)" }}>Nenhum incidente encontrado</td></tr>
              ) : incidents.map(inc => (
                <tr key={inc.id}>
                  <td><span style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>{inc.incidentCode}</span></td>
                  <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inc.title}</td>
                  <td style={{ fontSize: "0.8rem" }}>{inc.category}</td>
                  <td><span className={SEVERITY_CLASS[inc.severity] || "badge"}>{inc.severity}</span></td>
                  <td><span className={INCIDENT_STATUS_CLASS[inc.status] || "badge"}>{INCIDENT_STATUS_LABEL[inc.status] || inc.status}</span></td>
                  <td style={{ fontSize: "0.82rem" }}>{inc.assignedTo?.name || "—"}</td>
                  <td style={{ fontSize: "0.82rem" }}>{fmtDate(inc.createdAt)}</td>
                  <td><Button size="sm" variant="secondary" onClick={() => onSelect(inc.id)}>Ver</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
      .then(r => r.json()).then(d => { setIncident(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [token, incidentId]);

  useEffect(() => { reload(); }, [reload]);

  const doAction = async (path, body, method = "PATCH") => {
    setSubmitting(true); setError(""); setMsg("");
    try {
      const r = await apiFetch(path, token, {
        method, headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erro");
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
    apiFetch("/platform/incident-categories", token).then(r => r.json()).then(d => setCategories(d.categories || []));
  }, [token]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
      const r = await apiFetch("/platform/incidents", token, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, tags, unitId: form.unitId || null, deploymentId: form.deploymentId || null, licenseId: form.licenseId || null, breakGlassSessionId: form.breakGlassSessionId || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erro ao criar incidente");
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
  const [view, setView]                             = useState("list");
  const [selectedUnitId, setSelectedUnitId]         = useState(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
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
            className={`console-nav__item${tab === "units" ? " is-active" : ""}`}
            onClick={() => switchTab("units")}
          >
            <IcoBuilding /> Unidades de Saúde
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
          {/* Visão Geral */}
          {tab === "overview" && (
            <>
              <div className="console-page-header">
                <div>
                  <h1 className="console-page-header__title">Visão Geral</h1>
                  <p className="console-page-header__sub">Indicadores da plataforma VITRAS APS em tempo real</p>
                </div>
              </div>
              <NationalSummary token={token} key={listKey} />
              <div className="console-section">
                <div className="console-section__header">Ações rápidas</div>
                <div className="console-section__body" style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap" }}>
                  <Button variant="secondary" onClick={() => switchTab("units")}>
                    <IcoBuilding /> Ver Unidades de Saúde
                  </Button>
                  <Button variant="secondary" onClick={() => { switchTab("units"); setView("new-unit"); }}>
                    + Nova UBS
                  </Button>
                  <Button variant="secondary" onClick={() => switchTab("migrations")}>
                    <IcoImport /> Ir para Migrações
                  </Button>
                </div>
              </div>
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
            <LicenseConsole token={token} />
          )}

          {/* Incidentes */}
          {tab === "incidents" && (
            <IncidentConsole token={token} />
          )}

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
