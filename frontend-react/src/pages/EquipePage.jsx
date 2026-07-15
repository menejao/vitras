import { useMemo, useState, useEffect } from "react";
import { useActiveUnit } from "../contexts/ActiveUnitContext";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import { roleLabel } from "../utils/roles";
import { initials } from "../utils/formatting";

const PAGE_SIZE = 20;
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

const APS_CARGO_CATALOG = [
  { id: "receptionist",       label: "Recepcionista",               teamRequired: false },
  { id: "acs",                label: "Agente Comunitário de Saúde",  teamRequired: true  },
  { id: "nursing_tech",       label: "Técnico de Enfermagem",        teamRequired: true  },
  { id: "nurse_manager",      label: "Enfermeiro(a)",                teamRequired: true  },
  { id: "doctor",             label: "Médico(a)",                    teamRequired: true  },
  { id: "dentist",            label: "Dentista",                     teamRequired: true  },
  { id: "oral_health_aux",    label: "Auxiliar de Saúde Bucal",      teamRequired: true  },
  { id: "oral_health_tech",   label: "Técnico de Saúde Bucal",       teamRequired: true  },
  { id: "pharmacist",         label: "Farmacêutico(a)",              teamRequired: false },
  { id: "psychologist",       label: "Psicólogo(a)",                 teamRequired: false },
  { id: "physical_therapist", label: "Fisioterapeuta",               teamRequired: false },
  { id: "social_worker",      label: "Assistente Social",            teamRequired: false },
  { id: "nutritionist",       label: "Nutricionista",                teamRequired: false },
  { id: "physical_educator",  label: "Educador(a) Físico(a)",        teamRequired: false },
  { id: "gestor",             label: "Gestor(a) UBS",                teamRequired: false },
  { id: "local_admin",        label: "Administrador(a) Local",       teamRequired: false },
  { id: "aps_coordinator",    label: "Coordenador(a) APS",           teamRequired: false },
];

function cargoLabel(id) {
  return APS_CARGO_CATALOG.find(c => c.id === id)?.label || id;
}

async function apiFetch(path, options = {}, token) {
  const { body, ...rest } = options;
  const res = await fetch(path, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers || {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data;
}

function CredentialsModal({ vitrasId, password, onClose }) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleCopy() {
    const text = `ID VITRAS: ${vitrasId}\nSenha temporária: ${password}`;
    try { await navigator.clipboard.writeText(text); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div className="modal-box card" style={{ maxWidth: 420, width: "100%", padding: "var(--s-6)" }}>
        <h3 style={{ marginBottom: "var(--s-3)" }}>Credenciais geradas</h3>
        <p className="muted small" style={{ marginBottom: "var(--s-4)" }}>
          Estas credenciais serão exibidas <strong>apenas uma vez</strong>. Copie agora.
        </p>
        <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius)", padding: "var(--s-3)", marginBottom: "var(--s-4)", fontFamily: "var(--font-mono)", fontSize: "var(--t-sm)" }}>
          <div><span className="muted">ID VITRAS:</span> <strong>{vitrasId}</strong></div>
          <div style={{ marginTop: "var(--s-2)" }}><span className="muted">Senha temporária:</span> <strong>{password}</strong></div>
        </div>
        <Button variant={copied ? "success" : "primary"} size="sm" full style={{ marginBottom: "var(--s-3)" }} onClick={handleCopy}>
          {copied ? "Copiado!" : "Copiar credenciais"}
        </Button>
        <label style={{ display: "flex", gap: "var(--s-2)", alignItems: "center", marginBottom: "var(--s-4)", fontSize: "var(--t-sm)", cursor: "pointer" }}>
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
          Confirmo que copiei as credenciais.
        </label>
        <Button variant="ghost" size="sm" full disabled={!confirmed} onClick={onClose}>
          Concluir
        </Button>
      </div>
    </div>
  );
}

function CreateUserModal({ token, teams, unitId, onDone, onClose }) {
  const [form, setForm] = useState({ name: "", cargo: "", teamId: "", status: "active" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const selectedCargo = APS_CARGO_CATALOG.find(c => c.id === form.cargo);
  const teamRequired = selectedCargo?.teamRequired === true;

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!form.name.trim()) return setErr("Nome é obrigatório.");
    if (!form.cargo) return setErr("Selecione cargo/função.");
    if (teamRequired && !form.teamId) return setErr("Equipe obrigatória para este cargo.");
    setBusy(true);
    try {
      const result = await apiFetch("/users", {
        method: "POST",
        body: {
          name: form.name.trim(),
          role: form.cargo,
          cargo: form.cargo,
          teamId: form.teamId || "",
          unitId,
        },
      }, token);
      onDone(result);
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 }}>
      <div className="modal-box card" style={{ maxWidth: 440, width: "100%", padding: "var(--s-6)" }}>
        <h3 style={{ marginBottom: "var(--s-4)" }}>Cadastrar usuário</h3>
        <form onSubmit={handleSubmit}>
          <Input label="Nome completo" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome e sobrenome" autoFocus style={{ marginBottom: "var(--s-3)" }} />
          <div style={{ marginBottom: "var(--s-3)" }}>
            <label style={{ fontSize: "var(--t-sm)", fontWeight: 600, display: "block", marginBottom: "var(--s-1)" }}>Cargo / Função APS</label>
            <Select value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value, teamId: "" }))}>
              <option value="">Selecionar cargo...</option>
              {APS_CARGO_CATALOG.map(c => (
                <option key={c.id} value={c.id}>{c.label}{c.teamRequired ? " *" : ""}</option>
              ))}
            </Select>
            <span className="muted" style={{ fontSize: "var(--t-xs)" }}>* Equipe obrigatória</span>
          </div>
          {form.cargo && (
            <div style={{ marginBottom: "var(--s-3)" }}>
              <label style={{ fontSize: "var(--t-sm)", fontWeight: 600, display: "block", marginBottom: "var(--s-1)" }}>
                Equipe{teamRequired ? " (obrigatória)" : " (opcional)"}
              </label>
              <Select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}>
                <option value="">Sem equipe</option>
                {(teams || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
          )}
          {err && <div style={{ marginBottom: "var(--s-3)", padding: "var(--s-2)", borderRadius: "var(--radius)", background: "var(--danger-bg, #fee)", color: "var(--danger)", fontSize: "var(--t-sm)" }}>{err}</div>}
          <div style={{ display: "flex", gap: "var(--s-2)" }}>
            <Button type="submit" variant="primary" size="sm" disabled={busy} style={{ flex: 1 }}>
              {busy ? "Criando..." : "Criar usuário"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EquipePage({ users = [], user, onOpenProfile, token, canManageUser }) {
  const { unitId } = useActiveUnit();
  const [search, setSearch]       = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage]           = useState(1);

  const [showCreateUser, setShowCreateUser]   = useState(false);
  const [newCredentials, setNewCredentials]   = useState(null);
  const [resettingId, setResettingId]         = useState(null);
  const [deactivatingId, setDeactivatingId]   = useState(null);
  const [actionError, setActionError]         = useState("");
  const [teams, setTeams]                     = useState([]);

  useEffect(() => {
    if (!token) return;
    fetch("/teams/public", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => setTeams(Array.isArray(data) ? data : [])).catch(() => {});
  }, [token]);

  async function handleResetPassword(userId) {
    setActionError("");
    setResettingId(userId);
    try {
      const result = await apiFetch(`/users/${userId}/reset-password`, { method: "POST" }, token);
      if (result.vitrasId && result.temporaryPassword) {
        setNewCredentials({ vitrasId: result.vitrasId, temporaryPassword: result.temporaryPassword });
      } else if (result.temporaryPassword) {
        setNewCredentials({ vitrasId: "", temporaryPassword: result.temporaryPassword });
      }
    } catch (error) {
      setActionError(error.message);
    } finally {
      setResettingId(null);
    }
  }

  async function handleDeactivate(userId, userName) {
    if (!window.confirm(`Desativar "${userName}"? O histórico será preservado.`)) return;
    setActionError("");
    setDeactivatingId(userId);
    try {
      await apiFetch(`/users/${userId}/deactivate`, { method: "POST" }, token);
      window.alert(`Usuário "${userName}" desativado. Recarregue a página para atualizar a lista.`);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setDeactivatingId(null);
    }
  }

  const userPresence = useMemo(() => [...users].map(u => {
    const lastSeenAt = String(u?.lastSeenAt || u?.lastLoginAt || "");
    const lastSeenTs = Date.parse(lastSeenAt);
    const online = Number.isFinite(lastSeenTs) ? (Date.now() - lastSeenTs <= ONLINE_WINDOW_MS) : false;
    return { ...u, online };
  }).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")), [users]);

  const roleOptions = useMemo(() => [...new Set(userPresence.map(u => String(u.role || "")).filter(Boolean))], [userPresence]);
  const teamOptions = useMemo(() => [...new Set(userPresence.map(u => String(u.teamName || "")).filter(Boolean))], [userPresence]);

  function applyFilter(fn) { fn(); setPage(1); }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return userPresence.filter(u => {
      if (q) {
        const matchName  = String(u.name  || "").toLowerCase().includes(q);
        const matchRole  = roleLabel(u.role).toLowerCase().includes(q);
        const matchId    = String(u.vitrasId || u.id || "").toLowerCase().includes(q);
        if (!matchName && !matchRole && !matchId) return false;
      }
      if (roleFilter !== "all" && String(u.role || "") !== roleFilter) return false;
      if (teamFilter !== "all" && String(u.teamName || "") !== teamFilter) return false;
      if (statusFilter === "online"   && !u.online)   return false;
      if (statusFilter === "offline"  && u.online)    return false;
      if (statusFilter === "inactive" && !u.inactive) return false;
      if (statusFilter === "active"   && u.inactive)  return false;
      return true;
    });
  }, [userPresence, search, roleFilter, teamFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const isSelf = (m) => m.id === user?.id;
  const total  = filtered.length;

  return (
    <>
      {showCreateUser && (
        <CreateUserModal
          token={token}
          teams={teams}
          unitId={unitId}
          onDone={(result) => {
            setShowCreateUser(false);
            if (result.vitrasId && result.temporaryPassword) {
              setNewCredentials({ vitrasId: result.vitrasId, temporaryPassword: result.temporaryPassword });
            }
          }}
          onClose={() => setShowCreateUser(false)}
        />
      )}
      {newCredentials && (
        <CredentialsModal
          vitrasId={newCredentials.vitrasId}
          password={newCredentials.temporaryPassword}
          onClose={() => setNewCredentials(null)}
        />
      )}

      <div className="equipe-page">
        <PageHeader
          eyebrow="EQUIPE"
          title="Profissionais da Unidade"
          subtitle="Listagem e administração dos profissionais cadastrados nesta UBS."
          actions={canManageUser && (
            <Button variant="primary" size="sm" onClick={() => setShowCreateUser(true)}>
              + Cadastrar usuário
            </Button>
          )}
        />

        <div className="equipe-toolbar">
          <div style={{ flex: "1 1 220px" }}>
            <Input
              value={search}
              onChange={(e) => applyFilter(() => setSearch(e.target.value))}
              placeholder="Buscar por nome, cargo ou ID..."
            />
          </div>
          <Select
            style={{ flex: "0 0 180px" }}
            value={roleFilter}
            onChange={(e) => applyFilter(() => setRoleFilter(e.target.value))}
          >
            <option value="all">Todos os cargos</option>
            {roleOptions.map(r => <option key={r} value={r}>{cargoLabel(r)}</option>)}
          </Select>
          <Select
            style={{ flex: "0 0 160px" }}
            value={teamFilter}
            onChange={(e) => applyFilter(() => setTeamFilter(e.target.value))}
          >
            <option value="all">Todas as equipes</option>
            {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select
            style={{ flex: "0 0 140px" }}
            value={statusFilter}
            onChange={(e) => applyFilter(() => setStatusFilter(e.target.value))}
          >
            <option value="all">Todos os status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </Select>
          <span className="equipe-count">
            {total} profissional{total !== 1 ? "s" : ""}
          </span>
        </div>

        {actionError && (
          <div style={{ margin: "0 var(--s-6) var(--s-2)", padding: "var(--s-2) var(--s-3)", borderRadius: "var(--radius)", background: "var(--danger-bg, #fee)", color: "var(--danger)", fontSize: "var(--t-sm)" }}>
            Erro: {actionError}
          </div>
        )}

        <div className="equipe-body">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__title">Nenhum profissional encontrado</div>
              <div className="empty-state__body">Tente ajustar os filtros de busca.</div>
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table className="equipe-table">
                  <thead>
                    <tr>
                      <th>Profissional</th>
                      <th>Cargo</th>
                      <th>Equipe</th>
                      <th>ID</th>
                      <th>Registro</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((m) => {
                      const self = isSelf(m);
                      return (
                        <tr key={m.id} className={self ? "equipe-table__row--self" : ""}>
                          <td>
                            <div className="equipe-table__name-cell">
                              <div className="equipe-table__avatar">
                                {initials(m.name)}
                              </div>
                              <div>
                                <div className="equipe-table__name">
                                  {m.name}
                                  {self && <span className="equipe-card__you" style={{ marginLeft: "var(--s-2)" }}>Você</span>}
                                  {m.inactive && <span className="badge badge--muted" style={{ marginLeft: "var(--s-2)", fontSize: "var(--t-xs)" }}>Inativo</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="equipe-table__role">{roleLabel(m.role)}</td>
                          <td className="muted small">{m.teamName || "—"}</td>
                          <td className="equipe-table__id">{String(m.vitrasId || m.id || "").slice(0, 8)}</td>
                          <td className="muted small">
                            {m.councilNumber
                              ? `${m.councilType || "CRM"} ${m.councilNumber}/${m.councilUf || ""}`
                              : "—"}
                          </td>
                          <td>
                            <span className={`badge${m.online ? " badge--success" : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: "var(--s-1)" }}>
                              <span className="dot" />
                              {m.online ? "Online" : "Offline"}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "var(--s-1)", flexWrap: "wrap" }}>
                              {self && onOpenProfile && (
                                <Button variant="ghost" size="sm" onClick={onOpenProfile}>
                                  Editar
                                </Button>
                              )}
                              {canManageUser && !m.inactive && (
                                <>
                                  <Button variant="ghost" size="sm" disabled={!!resettingId} onClick={() => handleResetPassword(m.id)}>
                                    {resettingId === m.id ? "..." : "Redefinir senha"}
                                  </Button>
                                  <Button variant="ghost" size="sm" style={{ color: "var(--danger)" }} disabled={!!deactivatingId} onClick={() => handleDeactivate(m.id, m.name)}>
                                    {deactivatingId === m.id ? "..." : "Desativar"}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="table-pagination">
                  <span>{total} profissionais — página {safePage} de {totalPages}</span>
                  <div style={{ display: "flex", gap: "var(--s-2)" }}>
                    <Button variant="secondary" size="sm" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>
                      ← Anterior
                    </Button>
                    <Button variant="secondary" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>
                      Próxima →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
