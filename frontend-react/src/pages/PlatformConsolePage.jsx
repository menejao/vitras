import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
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

// State machine: maps current status → allowed next states + button labels
const STATUS_TRANSITIONS = {
  draft:        [{ to: "onboarding",   label: "Iniciar Implantação" }],
  onboarding:   [{ to: "homologation", label: "Iniciar Homologação" }],
  homologation: [{ to: "active",       label: "Ativar UBS" }, { to: "onboarding", label: "Voltar a Implantação" }],
  active:       [{ to: "suspended",    label: "Suspender" }],
  suspended:    [{ to: "active",       label: "Reativar" }]
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

// ── UI primitives ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const palette = {
    draft:        { bg: "#f3f4f6", color: "#374151" },
    onboarding:   { bg: "#fef3c7", color: "#92400e" },
    homologation: { bg: "#dbeafe", color: "#1d4ed8" },
    active:       { bg: "#d1fae5", color: "#065f46" },
    suspended:    { bg: "#fee2e2", color: "#991b1b" }
  };
  const p = palette[status] || palette.draft;
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

// ── Temp Password Modal (FASE 1-3) ────────────────────────────────────────

function TempPasswordModal({ password, onClose }) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
    } catch {
      // fallback: do nothing — user reads manually
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: "1rem",
    }}>
      <div style={{
        background: "#fff", borderRadius: "12px", padding: "1.5rem",
        width: "100%", maxWidth: 440,
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        <h3 style={{ fontWeight: 700, fontSize: "1rem", margin: "0 0 1rem" }}>
          Senha Temporária — Exibição Única
        </h3>

        <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: "8px", padding: "0.875rem 1rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#92400e", marginBottom: "0.5rem" }}>
            Esta senha será exibida uma única vez. Anote ou copie agora.
          </div>
          <code style={{
            display: "block", fontSize: "1.15rem", letterSpacing: "0.12em",
            fontFamily: "monospace", fontWeight: 700, color: "#1f2937",
            padding: "0.5rem 0", wordBreak: "break-all",
          }}>
            {password}
          </code>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          style={{
            width: "100%", padding: "0.6rem", borderRadius: "6px", cursor: "pointer",
            background: copied ? "#d1fae5" : "#2563eb",
            color: copied ? "#065f46" : "#fff",
            border: "none", fontWeight: 700, fontSize: "0.875rem",
            marginBottom: "1rem", transition: "background 0.15s",
          }}
        >
          {copied ? "✓ Senha copiada com sucesso!" : "Copiar Senha"}
        </button>

        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", marginBottom: "1rem" }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ width: 16, height: 16, marginTop: "0.15rem", flexShrink: 0, accentColor: "#2563eb" }}
          />
          <span style={{ fontSize: "0.875rem" }}>Confirmo que anotei ou copiei esta senha.</span>
        </label>

        <button
          type="button"
          disabled={!confirmed}
          onClick={onClose}
          style={{
            width: "100%", padding: "0.55rem", borderRadius: "6px",
            background: confirmed ? "#374151" : "#e5e7eb",
            color: confirmed ? "#fff" : "#9ca3af",
            border: "none", fontWeight: 600, fontSize: "0.875rem",
            cursor: confirmed ? "pointer" : "default",
          }}
        >
          Fechar
        </button>
      </div>
    </div>
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
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>← Anterior</Button>
            <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => load(page + 1)}>Próxima →</Button>
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
    municipalityId: "", address: "", contactEmail: "", phone: "", status: "draft"
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
    { label: "Nome da UBS *",           key: "name",             placeholder: "UBS Francisca Lima de Lira" },
    { label: "CNES (7 dígitos) *",      key: "cnes",             placeholder: "1234567" },
    { label: "Município *",             key: "municipalityName", placeholder: "Recife" },
    { label: "Código IBGE (7 dígitos)", key: "municipalityId",   placeholder: "2611606" },
    { label: "Endereço",                key: "address",          placeholder: "Rua das Flores, 123 — Centro" },
    { label: "E-mail institucional",    key: "contactEmail",     placeholder: "ubs@municipio.gov.br" },
    { label: "Telefone",                key: "phone",            placeholder: "(81) 3000-0000" },
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

// ── Unit Modules Section ────────────────────────────────────────────────────

const ALL_MODULES = [
  { id: "nutricao",           label: "Nutrição" },
  { id: "psicologia",         label: "Psicologia" },
  { id: "fisioterapia",       label: "Fisioterapia" },
  { id: "servico_social",     label: "Serviço Social" },
  { id: "terapia_ocupacional",label: "Terapia Ocupacional" },
  { id: "fonoaudiologia",     label: "Fonoaudiologia" },
];

function UnitModulesSection({ unit, token, onUpdated }) {
  const [saving, setSaving] = useState(false);
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
    <div style={{ background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px", padding: "0.875rem 1rem", marginBottom: "1rem" }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary,#6b7280)", marginBottom: "0.75rem" }}>
        Módulos e Especialidades da Unidade
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.5rem", marginBottom: "0.75rem" }}>
        {ALL_MODULES.map(({ id, label }) => (
          <label key={id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", padding: "0.3rem 0" }}>
            <input
              type="checkbox"
              checked={localModules.includes(id)}
              onChange={() => toggleModule(id)}
              style={{ width: "15px", height: "15px", flexShrink: 0 }}
            />
            <span style={{ color: localModules.includes(id) ? "var(--color-text,#111)" : "var(--color-text-secondary,#6b7280)" }}>{label}</span>
          </label>
        ))}
      </div>
      {moduleError && <div style={{ color: "#ef4444", fontSize: "0.82rem", marginBottom: "0.5rem" }}>{moduleError}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button
          type="button"
          disabled={saving || !changed}
          onClick={saveModules}
          style={{
            padding: "0.35rem 0.85rem", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600,
            background: changed ? "#3b82f6" : "#e5e7eb", color: changed ? "#fff" : "#9ca3af",
            border: "none", cursor: (saving || !changed) ? "default" : "pointer",
            opacity: (saving || !changed) ? 0.6 : 1
          }}
        >
          {saving ? "Salvando..." : "Salvar Módulos"}
        </button>
        {!changed && <span style={{ fontSize: "0.78rem", color: "var(--color-text-secondary,#6b7280)" }}>Sem alterações pendentes</span>}
      </div>
    </div>
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
          <Button variant="warn" size="sm" onClick={action}>Fazer agora</Button>
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

  const [transitioning, setTransitioning] = useState(false);
  const [checklist, setChecklist] = useState(null);

  async function loadChecklist(unitId) {
    try {
      const data = await apiFetch(`/platform/units/${unitId}/checklist`, token);
      setChecklist(data);
    } catch {
      setChecklist(null);
    }
  }

  async function handleTransition(toStatus) {
    if (!window.confirm(`Confirmar transição: ${STATUS_LABELS[unit?.status]} → ${STATUS_LABELS[toStatus]}?`)) return;
    setTransitioning(true);
    setFormError("");
    try {
      await apiFetch(`/platform/units/${unitId}`, token, { method: "PATCH", body: JSON.stringify({ status: toStatus }) });
      await loadUnit();
    } catch (err) {
      // Show blocked criteria if present
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
      setChecklist((prev) => prev ? { ...prev, criteria: prev.criteria.map((c) => c.id === itemId ? { ...c, pass: value } : c), ok: data.allChecked } : prev);
      if (data.allChecked) await loadUnit();
    } catch (err) {
      setFormError(err.message);
    }
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

      {tempPwd && (
        <TempPasswordModal password={tempPwd} onClose={() => setTempPwd("")} />
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
                {unit.activatedAt && <div><strong>Ativação:</strong> {fmtDate(unit.activatedAt)}</div>}
                {unit.suspendedAt && <div><strong>Suspensão:</strong> {fmtDate(unit.suspendedAt)}</div>}
                <div><strong>Atualização:</strong> {fmtDate(unit.updatedAt)}</div>
                {unit.createdByName && <div style={{ color: "var(--color-text-secondary,#6b7280)" }}>Responsável: {unit.createdByName}</div>}
              </div>
            </div>
          </div>

          {/* Status transition panel */}
          {(STATUS_TRANSITIONS[unit.status] || []).length > 0 && (
            <div style={{ background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px", padding: "0.875rem 1rem", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary,#6b7280)", marginBottom: "0.6rem" }}>Ciclo de Vida</div>
              <div style={{ fontSize: "0.85rem", color: "var(--color-text-secondary,#6b7280)", marginBottom: "0.75rem" }}>
                Status atual: <strong style={{ color: "inherit" }}>{STATUS_LABELS[unit.status] || unit.status}</strong>
              </div>

              {/* Checklist — show criteria blocking the next forward transition */}
              {checklist && checklist.criteria && checklist.criteria.length > 0 && (
                <div style={{ marginBottom: "0.75rem", fontSize: "0.82rem" }}>
                  <div style={{ fontWeight: 600, marginBottom: "0.4rem", color: "var(--color-text,#111)" }}>
                    Critérios para avançar para {STATUS_LABELS[(STATUS_TRANSITIONS[unit.status] || [])[0]?.to] || "próximo estado"}:
                  </div>
                  {checklist.criteria.map((c) => (
                    c.id.startsWith("auth_") || c.id.startsWith("rbac_") || c.id.startsWith("team_configured") || c.id.startsWith("user_created") || c.id.startsWith("patient_") || c.id.startsWith("household_") || c.id.startsWith("individual_") || c.id.startsWith("audit_") ? (
                      // Homologation checklist items — interactive
                      <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.2rem 0", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={!!c.pass}
                          onChange={(e) => handleChecklistItem(c.id, e.target.checked)}
                          style={{ width: "14px", height: "14px", flexShrink: 0 }}
                        />
                        <span style={{ color: c.pass ? "#065f46" : "#374151" }}>{c.label}</span>
                        {c.pass && <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>}
                      </label>
                    ) : (
                      // Auto-derived criteria — read-only
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.2rem 0" }}>
                        <span style={{ width: "14px", height: "14px", borderRadius: "50%", flexShrink: 0, display: "inline-block", background: c.pass ? "#10b981" : "#e5e7eb" }} />
                        <span style={{ color: c.pass ? "#065f46" : (c.pass === false ? "#991b1b" : "#374151") }}>{c.label}</span>
                        {c.pass && <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>}
                        {!c.pass && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>pendente</span>}
                      </div>
                    )
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {(STATUS_TRANSITIONS[unit.status] || []).map(({ to, label }) => {
                  const isForward = ["onboarding","homologation","active"].includes(to);
                  const blocked = isForward && checklist && !checklist.ok;
                  return (
                    <button
                      key={to}
                      type="button"
                      disabled={transitioning || blocked}
                      onClick={() => handleTransition(to)}
                      title={blocked ? `Critérios pendentes: ${(checklist?.criteria || []).filter((c) => !c.pass).map((c) => c.label).join(", ")}` : undefined}
                      style={{
                        padding: "0.35rem 0.85rem", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600,
                        cursor: (transitioning || blocked) ? "default" : "pointer",
                        opacity: (transitioning || blocked) ? 0.45 : 1,
                        background: to === "active" ? "#10b981" : to === "suspended" ? "#ef4444" : "#3b82f6",
                        color: "#fff", border: "none"
                      }}
                    >
                      {transitioning ? "Aguarde..." : label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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

          {/* Modules */}
          <UnitModulesSection unit={unit} token={token} onUpdated={loadUnit} />

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
  const [tab, setTab]                 = useState("units");
  const [view, setView]               = useState("list");
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [listKey, setListKey]         = useState(0);

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

  const navTabStyle = (active) => ({
    padding: "0.5rem 1rem", background: "none", border: "none", cursor: "pointer",
    fontSize: "0.875rem", fontWeight: active ? 700 : 400,
    color: active ? "var(--color-primary,#2563eb)" : "var(--color-text-secondary,#6b7280)",
    borderBottom: active ? "2px solid var(--color-primary,#2563eb)" : "2px solid transparent",
    marginBottom: "-1px", whiteSpace: "nowrap",
  });

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
          <Button variant="secondary" size="sm" onClick={onLogout}>Sair</Button>
        </div>
      </header>

      {/* Tab navigation */}
      <div style={{
        borderBottom: "1px solid var(--color-border,#e5e7eb)",
        background: "var(--color-surface,#fff)",
        padding: "0 1.25rem",
        display: "flex", gap: "0.1rem",
      }}>
        <button
          type="button"
          onClick={() => { setTab("units"); setView("list"); setSelectedUnitId(null); }}
          style={navTabStyle(tab === "units")}
        >
          Unidades de Saúde
        </button>
        <button
          type="button"
          onClick={() => setTab("migrations")}
          style={navTabStyle(tab === "migrations")}
        >
          Migrações
        </button>
      </div>

      {/* Main */}
      <main style={{ flex: 1, padding: "1.5rem 1.25rem", maxWidth: 1100, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {tab === "units" && (
          <>
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
          </>
        )}
        {tab === "migrations" && (
          <ImportConsole token={token} />
        )}
      </main>
    </div>
  );
}
