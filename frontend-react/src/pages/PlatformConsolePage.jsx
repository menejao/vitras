import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Alert from "../components/ui/Alert";
import { BrandLockup } from "../components/brand/BrandLockup";

// ── Constants ──────────────────────────────────────────────────────────────

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];
const STATUS_OPTIONS = ["onboarding","active","inactive"];
const STATUS_LABELS  = { onboarding: "Em implantação", active: "Operacional", inactive: "Inativa" };

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

// ── UI primitives ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const palette = {
    active:     { bg: "#d1fae5", color: "#065f46" },
    onboarding: { bg: "#fef3c7", color: "#92400e" },
    inactive:   { bg: "#fee2e2", color: "#991b1b" }
  };
  const p = palette[status] || palette.onboarding;
  return (
    <span style={{ padding: "0.15rem 0.5rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 700, background: p.bg, color: p.color, whiteSpace: "nowrap" }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#e5e7eb)",
      borderRadius: "8px", padding: "1rem 1.25rem", flex: "1 1 140px", minWidth: 0
    }}>
      <div style={{ fontSize: "1.75rem", fontWeight: 800, lineHeight: 1 }}>{value ?? "—"}</div>
      <div style={{ fontSize: "0.78rem", color: "var(--color-text-secondary,#6b7280)", marginTop: "0.25rem" }}>{label}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: "var(--color-text-secondary,#6b7280)" }}>{sub}</div>}
    </div>
  );
}

function SelectInput({ value, onChange, options, placeholder, style }) {
  return (
    <select value={value} onChange={onChange} style={{
      padding: "0.45rem 0.6rem", borderRadius: "6px", fontSize: "0.875rem",
      border: "1px solid var(--color-border,#d1d5db)", background: "var(--color-surface,#fff)",
      color: value ? "inherit" : "var(--color-text-secondary,#6b7280)", ...style
    }}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  );
}

function BackButton({ onClick, label = "← Voltar" }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0",
      fontSize: "0.9rem", color: "var(--color-text-secondary,#6b7280)", display: "flex", alignItems: "center", gap: "0.3rem"
    }}>
      {label}
    </button>
  );
}

// ── National Summary ───────────────────────────────────────────────────────

function NationalSummary({ token }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/platform/summary", token)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ height: 80, display: "flex", alignItems: "center", color: "var(--color-text-secondary,#6b7280)", fontSize: "0.875rem" }}>Carregando indicadores...</div>;
  if (!data) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}>
      <StatCard label="Total de UBS"       value={data.totalUnits} />
      <StatCard label="Em implantação"     value={data.onboarding} />
      <StatCard label="Operacionais"       value={data.active} />
      <StatCard label="Gestores"           value={data.totalGestors} />
      <StatCard label="Usuários ativos"    value={data.totalUsers} />
    </div>
  );
}

// ── Unit Table + Search ────────────────────────────────────────────────────

const PAGE_SIZE = 25;

function UnitTable({ token, onSelect, onNew }) {
  const [units, setUnits]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const [search, setSearch]   = useState("");
  const [filterUf, setFilterUf]     = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy]   = useState("name");
  const [sortDir, setSortDir] = useState("asc");

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

  function handleFilter(field, val) {
    if (field === "uf")     { setFilterUf(val);     load(1, search, val, filterStatus, sortBy, sortDir); }
    if (field === "status") { setFilterStatus(val); load(1, search, filterUf, val, sortBy, sortDir); }
  }

  function handleSort(col) {
    const nd = sortBy === col && sortDir === "asc" ? "desc" : "asc";
    setSortBy(col); setSortDir(nd);
    load(1, search, filterUf, filterStatus, col, nd);
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return <span style={{ opacity: 0.3, marginLeft: "0.2rem" }}>⇅</span>;
    return <span style={{ marginLeft: "0.2rem" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const thStyle = (col) => ({
    padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.78rem", fontWeight: 700,
    color: "var(--color-text-secondary,#6b7280)", textTransform: "uppercase", letterSpacing: "0.04em",
    borderBottom: "1px solid var(--color-border,#e5e7eb)", whiteSpace: "nowrap",
    cursor: "pointer", userSelect: "none", background: "var(--color-surface,#fff)"
  });

  const tdStyle = {
    padding: "0.6rem 0.75rem", fontSize: "0.875rem",
    borderBottom: "1px solid var(--color-border,#e5e7eb)", verticalAlign: "middle"
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
        <h2 style={{ fontWeight: 700, fontSize: "1.2rem", margin: 0 }}>Unidades de Saúde</h2>
        <Button onClick={onNew} style={{ whiteSpace: "nowrap" }}>+ Nova UBS</Button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <Input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nome, CNES, município ou gestor..."
          style={{ flex: "1 1 220px", minWidth: 0 }}
        />
        <SelectInput
          value={filterUf}
          onChange={(e) => handleFilter("uf", e.target.value)}
          options={UF_OPTIONS}
          placeholder="UF"
          style={{ width: 90 }}
        />
        <SelectInput
          value={filterStatus}
          onChange={(e) => handleFilter("status", e.target.value)}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          placeholder="Status"
          style={{ width: 160 }}
        />
      </div>

      {error && <Alert type="error" style={{ marginBottom: "0.75rem" }}>{error}</Alert>}

      {/* Table */}
      <div style={{ overflowX: "auto", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr>
              {[
                { col: "name",             label: "Nome da UBS" },
                { col: "cnes",             label: "CNES" },
                { col: "municipalityName", label: "Município/UF" },
                { col: "status",           label: "Status" },
                { col: null,               label: "Gestores" },
                { col: null,               label: "Usuários" },
                { col: null,               label: "Equipes" },
                { col: "createdAt",        label: "Criado em" },
              ].map(({ col, label }) => (
                <th key={label} style={thStyle(col)} onClick={col ? () => handleSort(col) : undefined}>
                  {label}{col && <SortIcon col={col} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: "var(--color-text-secondary,#6b7280)", padding: "2rem" }}>Carregando...</td></tr>
            )}
            {!loading && units.length === 0 && (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: "var(--color-text-secondary,#6b7280)", padding: "2rem" }}>
                {search || filterUf || filterStatus ? "Nenhuma UBS encontrada para os filtros aplicados." : "Nenhuma UBS cadastrada. Clique em \"+ Nova UBS\" para começar."}
              </td></tr>
            )}
            {units.map((u) => (
              <tr
                key={u.id}
                onClick={() => onSelect(u)}
                style={{ cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-bg,#f9fafb)"}
                onMouseLeave={(e) => e.currentTarget.style.background = ""}
              >
                <td style={tdStyle}><strong style={{ fontWeight: 600 }}>{u.name}</strong></td>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "0.82rem" }}>{u.cnes || "—"}</td>
                <td style={tdStyle}>
                  {u.municipalityName ? `${u.municipalityName}` : "—"}
                  {u.uf ? <span style={{ marginLeft: "0.3rem", fontWeight: 700, fontSize: "0.8rem", color: "var(--color-text-secondary,#6b7280)" }}>{u.uf}</span> : null}
                </td>
                <td style={tdStyle}><StatusBadge status={u.status} /></td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{u.gestorCount ?? 0}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{u.userCount ?? 0}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{u.teamCount ?? 0}</td>
                <td style={{ ...tdStyle, fontSize: "0.8rem", color: "var(--color-text-secondary,#6b7280)" }}>{fmtDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--color-text-secondary,#6b7280)" }}>
          <span>{total} UBS no total — página {page} de {pages}</span>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button
              type="button" disabled={page <= 1}
              onClick={() => load(page - 1)}
              style={{ padding: "0.3rem 0.7rem", borderRadius: "4px", border: "1px solid var(--color-border,#d1d5db)", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1, background: "none" }}
            >← Anterior</button>
            <button
              type="button" disabled={page >= pages}
              onClick={() => load(page + 1)}
              style={{ padding: "0.3rem 0.7rem", borderRadius: "4px", border: "1px solid var(--color-border,#d1d5db)", cursor: page >= pages ? "default" : "pointer", opacity: page >= pages ? 0.4 : 1, background: "none" }}
            >Próxima →</button>
          </div>
        </div>
      )}
      {pages <= 1 && total > 0 && (
        <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--color-text-secondary,#6b7280)" }}>
          {total} UBS
        </div>
      )}
    </div>
  );
}

// ── Unit Form (Create) ─────────────────────────────────────────────────────

function UnitForm({ token, onDone, onBack }) {
  const [form, setForm] = useState({
    name: "", cnes: "", municipalityName: "", uf: "",
    municipalityId: "", contactEmail: "", phone: "", status: "onboarding"
  });
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");

  function set(key) { return (e) => setForm((f) => ({ ...f, [key]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim())           { setError("Nome da UBS é obrigatório."); return; }
    if (!/^\d{7}$/.test(form.cnes)) { setError("CNES deve ter exatamente 7 dígitos."); return; }
    if (!form.municipalityName.trim()) { setError("Município é obrigatório."); return; }
    if (!form.uf)                    { setError("UF é obrigatória."); return; }
    setBusy(true);
    try {
      await apiFetch("/platform/units", token, { method: "POST", body: JSON.stringify(form) });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const fields = [
    { label: "Nome da UBS *",          key: "name",             placeholder: "UBS Francisca Lima de Lira" },
    { label: "CNES (7 dígitos) *",     key: "cnes",             placeholder: "1234567" },
    { label: "Município *",            key: "municipalityName", placeholder: "Recife" },
    { label: "Código IBGE (7 dígitos)", key: "municipalityId",  placeholder: "2611606" },
    { label: "E-mail institucional",   key: "contactEmail",     placeholder: "ubs@municipio.gov.br" },
    { label: "Telefone",               key: "phone",            placeholder: "(81) 3000-0000" },
  ];

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "1.5rem", gap: "0.5rem" }}>
        <BackButton onClick={onBack} />
        <h2 style={{ fontWeight: 700, fontSize: "1.2rem", margin: 0 }}>Nova UBS</h2>
      </div>

      {error && <Alert type="error" style={{ marginBottom: "1rem" }}>{error}</Alert>}

      {fields.map(({ label, key, placeholder }) => (
        <div key={key} style={{ marginBottom: "0.875rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>{label}</label>
          <Input value={form[key]} onChange={set(key)} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box" }} />
        </div>
      ))}

      <div style={{ marginBottom: "0.875rem" }}>
        <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>UF *</label>
        <SelectInput value={form.uf} onChange={set("uf")} options={UF_OPTIONS} placeholder="Selecionar UF" style={{ width: "100%", boxSizing: "border-box" }} />
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>Status</label>
        <SelectInput
          value={form.status}
          onChange={set("status")}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          placeholder="Status"
          style={{ width: "100%", boxSizing: "border-box" }}
        />
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? "Criando UBS..." : "Criar UBS"}
      </Button>
    </form>
  );
}

// ── Unit Detail ────────────────────────────────────────────────────────────

function OnboardingActions({ unit, gestors, teams, onAddTeam, onAddManager }) {
  const actions = [];
  if (!gestors || gestors.length === 0) {
    actions.push({ label: "Cadastrar gestor inicial", action: onAddManager });
  }
  if (!teams || teams.length === 0) {
    actions.push({ label: "Cadastrar equipe inicial", action: onAddTeam });
  }
  if (actions.length === 0) return null;
  return (
    <div style={{
      background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: "8px",
      padding: "0.875rem 1rem", marginBottom: "1rem"
    }}>
      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#92400e", marginBottom: "0.5rem" }}>
        Ações necessárias para concluir implantação:
      </div>
      {actions.map(({ label, action }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.4rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#78350f" }}>• {label}</span>
          <button
            type="button" onClick={action}
            style={{ fontSize: "0.78rem", background: "#f59e0b", border: "none", borderRadius: "4px", padding: "0.2rem 0.5rem", cursor: "pointer", color: "#fff", fontWeight: 700 }}
          >
            Fazer agora
          </button>
        </div>
      ))}
    </div>
  );
}

function UnitDetail({ token, unitId, onBack }) {
  const [unit, setUnit]   = useState(null);
  const [view, setView]   = useState("detail");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [teamForm, setTeamForm]       = useState({ name: "", ine: "", tipoEquipe: "" });
  const [managerForm, setManagerForm] = useState({ name: "", email: "", cpf: "", cns: "", cbo: "", phone: "" });
  const [busy, setBusy]     = useState(false);
  const [formError, setFormError] = useState("");
  const [tempPwd, setTempPwd]     = useState("");

  const loadUnit = useCallback(() => {
    setLoading(true);
    apiFetch(`/platform/units/${unitId}`, token)
      .then(setUnit)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [unitId, token]);

  useEffect(() => { loadUnit(); }, [loadUnit]);

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

  if (loading) return <div style={{ color: "var(--color-text-secondary,#6b7280)", padding: "2rem 0" }}>Carregando dados da UBS...</div>;
  if (error)   return <Alert type="error">{error}</Alert>;
  if (!unit)   return null;

  const gestors = unit.gestors || [];
  const teams   = unit.teams   || [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "1.25rem", gap: "0.5rem" }}>
        <BackButton onClick={() => { setView("detail"); onBack(); }} />
        <h2 style={{ fontWeight: 700, fontSize: "1.2rem", margin: 0 }}>{unit.name}</h2>
        <StatusBadge status={unit.status} />
      </div>

      {/* Temp password */}
      {tempPwd && (
        <Alert type="warning" style={{ marginBottom: "1rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Senha temporária do gestor — exibida uma única vez</div>
          <code style={{ display: "block", fontSize: "1.1rem", letterSpacing: "0.1em", padding: "0.5rem", background: "rgba(0,0,0,0.05)", borderRadius: "4px", marginBottom: "0.5rem", wordBreak: "break-all" }}>
            {tempPwd}
          </code>
          <small>Comunique esta senha ao gestor agora. Após sair desta tela, não será possível recuperá-la.</small>
          <br />
          <button type="button" onClick={() => setTempPwd("")} style={{ marginTop: "0.5rem", fontSize: "0.8rem", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            Confirmo que anotei — ocultar senha
          </button>
        </Alert>
      )}

      {formError && <Alert type="error" style={{ marginBottom: "1rem" }}>{formError}</Alert>}

      {/* Onboarding actions from real data */}
      {view === "detail" && (
        <OnboardingActions
          unit={unit}
          gestors={gestors}
          teams={teams}
          onAddManager={() => { setFormError(""); setTempPwd(""); setView("new-manager"); }}
          onAddTeam={() => { setFormError(""); setView("new-team"); }}
        />
      )}

      {/* Institutional data */}
      {view === "detail" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
            {/* Institutional */}
            <div style={{ background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px", padding: "0.875rem 1rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary,#6b7280)", marginBottom: "0.6rem" }}>Dados Institucionais</div>
              <div style={{ fontSize: "0.875rem", display: "grid", gap: "0.3rem" }}>
                <div><strong>CNES:</strong> <code style={{ fontFamily: "monospace" }}>{unit.cnes || "—"}</code></div>
                <div><strong>Município:</strong> {unit.municipalityName || "—"}{unit.uf ? ` / ${unit.uf}` : ""}</div>
                {unit.municipalityId && <div><strong>IBGE:</strong> <code style={{ fontFamily: "monospace" }}>{unit.municipalityId}</code></div>}
                {unit.contactEmail && <div><strong>E-mail:</strong> {unit.contactEmail}</div>}
                {unit.phone && <div><strong>Telefone:</strong> {unit.phone}</div>}
              </div>
            </div>

            {/* Operational */}
            <div style={{ background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px", padding: "0.875rem 1rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary,#6b7280)", marginBottom: "0.6rem" }}>Dados Operacionais</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {[
                  { label: "Equipes",   val: unit.teamCount    ?? 0 },
                  { label: "Gestores",  val: unit.gestorCount  ?? 0 },
                  { label: "Usuários",  val: unit.userCount    ?? 0 },
                  { label: "Pacientes", val: unit.patientCount ?? 0 },
                ].map(({ label, val }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: "1.5rem" }}>{val}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--color-text-secondary,#6b7280)" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Deployment */}
            <div style={{ background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px", padding: "0.875rem 1rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary,#6b7280)", marginBottom: "0.6rem" }}>Implantação</div>
              <div style={{ fontSize: "0.875rem", display: "grid", gap: "0.3rem" }}>
                <div><strong>Cadastro:</strong> {fmtDate(unit.createdAt)}</div>
                <div><strong>Atualização:</strong> {fmtDate(unit.updatedAt)}</div>
              </div>
            </div>
          </div>

          {/* Gestors list */}
          {gestors.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.5rem" }}>Gestores ({gestors.length})</div>
              {gestors.map((g) => (
                <div key={g.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0.75rem", background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "6px", marginBottom: "0.4rem", fontSize: "0.875rem" }}>
                  <div style={{ flex: 1 }}>
                    <strong>{g.name}</strong>
                    <span style={{ color: "var(--color-text-secondary,#6b7280)", marginLeft: "0.5rem" }}>{g.email}</span>
                  </div>
                  {g.forcePasswordChange && <span style={{ fontSize: "0.72rem", background: "#fef3c7", color: "#92400e", padding: "0.1rem 0.4rem", borderRadius: "4px", fontWeight: 700 }}>Troca pendente</span>}
                </div>
              ))}
            </div>
          )}

          {/* Teams list */}
          {teams.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.5rem" }}>Equipes ({teams.length})</div>
              {teams.map((t) => (
                <div key={t.id} style={{ padding: "0.5rem 0.75rem", background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "6px", marginBottom: "0.4rem", fontSize: "0.875rem" }}>
                  <strong>{t.name}</strong>
                  {t.ine && <span style={{ color: "var(--color-text-secondary,#6b7280)", marginLeft: "0.5rem" }}>INE {t.ine}</span>}
                  {t.tipoEquipe && <span style={{ color: "var(--color-text-secondary,#6b7280)", marginLeft: "0.5rem" }}>· {t.tipoEquipe}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            <Button onClick={() => { setFormError(""); setView("new-team"); }}>+ Equipe</Button>
            <Button onClick={() => { setFormError(""); setTempPwd(""); setView("new-manager"); }}>+ Gestor</Button>
          </div>
        </>
      )}

      {/* New team form */}
      {view === "new-team" && (
        <form onSubmit={submitTeam} style={{ marginTop: "0.5rem" }}>
          <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Nova equipe</h3>
          {[
            { label: "Nome da equipe *", key: "name", placeholder: "ESF Francisca" },
            { label: "INE",              key: "ine",  placeholder: "0000000000" },
            { label: "Tipo de equipe",   key: "tipoEquipe", placeholder: "ESF" },
          ].map(({ label, key, placeholder }) => (
            <div key={key} style={{ marginBottom: "0.875rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>{label}</label>
              <Input value={teamForm[key]} onChange={setTF(key)} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button type="submit" disabled={busy}>{busy ? "Criando..." : "Criar equipe"}</Button>
            <Button type="button" onClick={() => { setFormError(""); setView("detail"); }} style={{ background: "none", border: "1px solid var(--color-border)", color: "inherit" }}>Cancelar</Button>
          </div>
        </form>
      )}

      {/* New manager form */}
      {view === "new-manager" && (
        <form onSubmit={submitManager} style={{ marginTop: "0.5rem" }}>
          <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Gestor inicial</h3>
          {[
            { label: "Nome completo *", key: "name",  placeholder: "Maria da Silva" },
            { label: "E-mail *",        key: "email", placeholder: "gestora@ubs.gov.br" },
            { label: "CPF",             key: "cpf",   placeholder: "000.000.000-00" },
            { label: "CNS",             key: "cns",   placeholder: "000 0000 0000 0000" },
            { label: "CBO",             key: "cbo",   placeholder: "2232" },
            { label: "Telefone",        key: "phone", placeholder: "(81) 99999-0000" },
          ].map(({ label, key, placeholder }) => (
            <div key={key} style={{ marginBottom: "0.875rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>{label}</label>
              <Input value={managerForm[key]} onChange={setMF(key)} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button type="submit" disabled={busy}>{busy ? "Criando..." : "Criar gestor"}</Button>
            <Button type="button" onClick={() => { setFormError(""); setView("detail"); }} style={{ background: "none", border: "1px solid var(--color-border)", color: "inherit" }}>Cancelar</Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Main Console ───────────────────────────────────────────────────────────

export default function PlatformConsolePage({ token, user, onLogout }) {
  const [view, setView]               = useState("list");
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [listKey, setListKey]         = useState(0); // bump to force table reload after new unit

  function goToDetail(unit) {
    setSelectedUnitId(unit.id);
    setView("unit-detail");
  }

  function goToList() {
    setSelectedUnitId(null);
    setView("list");
  }

  function afterNewUnit() {
    setListKey((k) => k + 1);
    setView("list");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--color-bg,#f9fafb)" }}>
      {/* Header */}
      <header style={{
        padding: "0.7rem 1.25rem", borderBottom: "1px solid var(--color-border,#e5e7eb)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--color-surface,#fff)", position: "sticky", top: 0, zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <BrandLockup variant="compact-light" />
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-secondary,#6b7280)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Console Nacional
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary,#6b7280)" }}>{user?.name}</span>
          <button type="button" onClick={onLogout} style={{
            fontSize: "0.8rem", color: "var(--color-text-secondary,#6b7280)",
            background: "none", border: "1px solid var(--color-border,#d1d5db)",
            borderRadius: "4px", padding: "0.25rem 0.6rem", cursor: "pointer"
          }}>Sair</button>
        </div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, padding: "1.5rem 1.25rem", maxWidth: 1100, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {view === "list" && (
          <>
            <NationalSummary token={token} key={listKey} />
            <UnitTable
              key={listKey}
              token={token}
              onSelect={goToDetail}
              onNew={() => setView("new-unit")}
            />
          </>
        )}
        {view === "new-unit" && (
          <UnitForm token={token} onDone={afterNewUnit} onBack={goToList} />
        )}
        {view === "unit-detail" && selectedUnitId && (
          <UnitDetail token={token} unitId={selectedUnitId} onBack={goToList} />
        )}
      </main>
    </div>
  );
}
