import { useState, useEffect, useCallback } from "react";
import { API_URL } from "../api";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Alert from "../components/ui/Alert";
import { BrandLockup } from "../components/brand/BrandLockup";

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const STATUS_OPTIONS = ["onboarding", "active", "inactive"];

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    },
    credentials: "include"
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data;
}

function StatusBadge({ status }) {
  const colors = {
    active:     { bg: "#d1fae5", color: "#065f46" },
    onboarding: { bg: "#fef3c7", color: "#92400e" },
    inactive:   { bg: "#fee2e2", color: "#991b1b" }
  };
  const c = colors[status] || colors.onboarding;
  return (
    <span style={{
      padding: "0.2rem 0.6rem", borderRadius: "999px",
      fontSize: "0.75rem", background: c.bg, color: c.color, fontWeight: 600
    }}>
      {status}
    </span>
  );
}

function BackButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer",
      fontSize: "1.1rem", color: "var(--color-text-secondary)", marginRight: "0.5rem"
    }}>
      &larr; Voltar
    </button>
  );
}

// Unit List

function UnitList({ token, onSelect, onNew }) {
  const [units, setUnits]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/platform/units", token)
      .then(setUnits)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h2 style={{ fontWeight: 700, fontSize: "1.25rem", margin: 0 }}>Unidades de Saude</h2>
        <Button onClick={onNew}>+ Nova UBS</Button>
      </div>
      {error && <Alert type="error" style={{ marginBottom: "1rem" }}>{error}</Alert>}
      {loading && <p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>}
      {!loading && units.length === 0 && (
        <Card style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>
            Nenhuma UBS cadastrada. Clique em &quot;+ Nova UBS&quot; para comecar.
          </p>
        </Card>
      )}
      {units.map((u) => (
        <Card
          key={u.id}
          style={{ marginBottom: "0.75rem", cursor: "pointer" }}
          onClick={() => onSelect(u)}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{u.name}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
                CNES {u.cnes} &middot; {u.municipalityName}/{u.uf} &middot; IBGE {u.municipalityId}
              </div>
              {u.contactEmail && (
                <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{u.contactEmail}</div>
              )}
            </div>
            <StatusBadge status={u.status} />
          </div>
        </Card>
      ))}
    </div>
  );
}

// Unit Form (Create)

function UnitForm({ token, onDone, onBack }) {
  const [form, setForm] = useState({
    name: "", cnes: "", municipalityName: "", uf: "SP",
    municipalityId: "", contactEmail: "", phone: "", status: "onboarding"
  });
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");

  function set(key) { return (e) => setForm((f) => ({ ...f, [key]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
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
    { label: "Nome da UBS *", key: "name", placeholder: "UBS Francisca Lima de Lira" },
    { label: "CNES (7 digitos) *", key: "cnes", placeholder: "0000000" },
    { label: "Municipio *", key: "municipalityName", placeholder: "Recife" },
    { label: "Codigo IBGE (7 digitos) *", key: "municipalityId", placeholder: "2611606" },
    { label: "E-mail institucional", key: "contactEmail", placeholder: "ubs@municipio.gov.br" },
    { label: "Telefone", key: "phone", placeholder: "(81) 3000-0000" },
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
        <select value={form.uf} onChange={set("uf")} style={{
          width: "100%", padding: "0.5rem", borderRadius: "6px",
          border: "1px solid var(--color-border, #d1d5db)",
          fontSize: "0.875rem", boxSizing: "border-box"
        }}>
          {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>Status</label>
        <select value={form.status} onChange={set("status")} style={{
          width: "100%", padding: "0.5rem", borderRadius: "6px",
          border: "1px solid var(--color-border, #d1d5db)", fontSize: "0.875rem", boxSizing: "border-box"
        }}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? "Criando UBS..." : "Criar UBS"}
      </Button>
    </form>
  );
}

// Unit Detail

function UnitDetail({ token, unit, onBack }) {
  const [view, setView]               = useState("detail"); // detail | new-team | new-manager
  const [teamForm, setTeamForm]       = useState({ name: "", ine: "", tipoEquipe: "" });
  const [managerForm, setManagerForm] = useState({ name: "", email: "", cpf: "", cns: "", cbo: "", phone: "" });
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [tempPwd, setTempPwd] = useState("");

  function setTF(key) { return (e) => setTeamForm((f) => ({ ...f, [key]: e.target.value })); }
  function setMF(key) { return (e) => setManagerForm((f) => ({ ...f, [key]: e.target.value })); }

  async function submitTeam(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await apiFetch(`/platform/units/${unit.id}/teams`, token, {
        method: "POST", body: JSON.stringify(teamForm)
      });
      setSuccess("Equipe criada com sucesso.");
      setTeamForm({ name: "", ine: "", tipoEquipe: "" });
      setView("detail");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function submitManager(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const data = await apiFetch(`/platform/units/${unit.id}/initial-manager`, token, {
        method: "POST", body: JSON.stringify(managerForm)
      });
      setTempPwd(data.temporaryPassword || "");
      setSuccess("Gestor inicial criado.");
      setManagerForm({ name: "", email: "", cpf: "", cns: "", cbo: "", phone: "" });
      setView("detail");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "1.25rem", gap: "0.5rem" }}>
        <BackButton onClick={() => { setView("detail"); onBack(); }} />
        <h2 style={{ fontWeight: 700, fontSize: "1.2rem", margin: 0 }}>{unit.name}</h2>
      </div>

      {/* One-time temp password alert */}
      {tempPwd && (
        <Alert type="warning" style={{ marginBottom: "1rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>
            Senha temporaria do gestor &mdash; exibida uma unica vez
          </div>
          <code style={{
            display: "block", fontSize: "1.15rem", letterSpacing: "0.12em",
            padding: "0.5rem", background: "rgba(0,0,0,0.05)", borderRadius: "4px",
            marginBottom: "0.5rem", wordBreak: "break-all"
          }}>
            {tempPwd}
          </code>
          <small style={{ color: "inherit" }}>
            Comunique esta senha ao gestor agora. Apos sair desta tela, nao sera possivel recupera-la.
          </small>
          <br />
          <button
            type="button"
            onClick={() => setTempPwd("")}
            style={{ marginTop: "0.5rem", fontSize: "0.8rem", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Confirmo que anotei &mdash; ocultar senha
          </button>
        </Alert>
      )}

      {error   && <Alert type="error"   style={{ marginBottom: "1rem" }}>{error}</Alert>}
      {success && !tempPwd && <Alert type="success" style={{ marginBottom: "1rem" }}>{success}</Alert>}

      {/* Unit info */}
      <Card style={{ marginBottom: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 1rem", fontSize: "0.875rem" }}>
          <div><strong>CNES:</strong> {unit.cnes}</div>
          <div><strong>IBGE:</strong> {unit.municipalityId}</div>
          <div><strong>Municipio:</strong> {unit.municipalityName}/{unit.uf}</div>
          <div><strong>Status:</strong> <StatusBadge status={unit.status} /></div>
          {unit.contactEmail && <div style={{ gridColumn: "1/-1" }}><strong>E-mail:</strong> {unit.contactEmail}</div>}
          {unit.phone && <div style={{ gridColumn: "1/-1" }}><strong>Telefone:</strong> {unit.phone}</div>}
        </div>
      </Card>

      {/* Detail view actions */}
      {view === "detail" && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Button onClick={() => { setError(""); setSuccess(""); setView("new-team"); }}>
            + Equipe inicial
          </Button>
          <Button onClick={() => { setError(""); setSuccess(""); setTempPwd(""); setView("new-manager"); }}>
            + Gestor inicial
          </Button>
        </div>
      )}

      {/* New team form */}
      {view === "new-team" && (
        <form onSubmit={submitTeam} style={{ marginTop: "1rem" }}>
          <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Nova equipe</h3>
          {[
            { label: "Nome da equipe *", key: "name", placeholder: "ESF Francisca" },
            { label: "INE", key: "ine", placeholder: "0000000000" },
            { label: "Tipo de equipe", key: "tipoEquipe", placeholder: "ESF" },
          ].map(({ label, key, placeholder }) => (
            <div key={key} style={{ marginBottom: "0.875rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>{label}</label>
              <Input value={teamForm[key]} onChange={setTF(key)} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button type="submit" disabled={busy}>{busy ? "Criando..." : "Criar equipe"}</Button>
            <Button type="button" onClick={() => setView("detail")} style={{ background: "none", border: "1px solid var(--color-border)", color: "inherit" }}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {/* New manager form */}
      {view === "new-manager" && (
        <form onSubmit={submitManager} style={{ marginTop: "1rem" }}>
          <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Gestor inicial</h3>
          {[
            { label: "Nome completo *", key: "name", placeholder: "Maria da Silva" },
            { label: "E-mail *", key: "email", placeholder: "gestora@ubs.gov.br" },
            { label: "CPF", key: "cpf", placeholder: "000.000.000-00" },
            { label: "CNS", key: "cns", placeholder: "000 0000 0000 0000" },
            { label: "CBO", key: "cbo", placeholder: "2232" },
            { label: "Telefone", key: "phone", placeholder: "(81) 99999-0000" },
          ].map(({ label, key, placeholder }) => (
            <div key={key} style={{ marginBottom: "0.875rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>{label}</label>
              <Input value={managerForm[key]} onChange={setMF(key)} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button type="submit" disabled={busy}>{busy ? "Criando..." : "Criar gestor"}</Button>
            <Button type="button" onClick={() => setView("detail")} style={{ background: "none", border: "1px solid var(--color-border)", color: "inherit" }}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// Main Console

export default function PlatformConsolePage({ token, user, onLogout }) {
  const [view, setView]                 = useState("list"); // list | new-unit | unit-detail
  const [selectedUnit, setSelectedUnit] = useState(null);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        padding: "0.75rem 1rem",
        borderBottom: "1px solid var(--color-border, #e5e7eb)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--color-surface, #fff)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <BrandLockup variant="compact-light" />
          <span style={{
            fontSize: "0.75rem", fontWeight: 700,
            color: "var(--color-text-secondary, #6b7280)",
            textTransform: "uppercase", letterSpacing: "0.06em"
          }}>
            Console Nacional
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary, #6b7280)" }}>
            {user?.name}
          </span>
          <button
            type="button"
            onClick={onLogout}
            style={{
              fontSize: "0.8rem", color: "var(--color-text-secondary, #6b7280)",
              background: "none", border: "1px solid var(--color-border, #d1d5db)",
              borderRadius: "4px", padding: "0.25rem 0.6rem", cursor: "pointer"
            }}
          >
            Sair
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: "1.25rem 1rem", maxWidth: 720, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {view === "list" && (
          <UnitList
            token={token}
            onSelect={(u) => { setSelectedUnit(u); setView("unit-detail"); }}
            onNew={() => setView("new-unit")}
          />
        )}
        {view === "new-unit" && (
          <UnitForm
            token={token}
            onDone={() => setView("list")}
            onBack={() => setView("list")}
          />
        )}
        {view === "unit-detail" && selectedUnit && (
          <UnitDetail
            token={token}
            unit={selectedUnit}
            onBack={() => { setSelectedUnit(null); setView("list"); }}
          />
        )}
      </main>
    </div>
  );
}
