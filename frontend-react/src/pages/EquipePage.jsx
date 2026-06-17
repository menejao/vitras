import { useMemo, useState, useEffect } from "react";
import PageHeader from "../components/layout/PageHeader";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { roleLabel, hasCapability } from "../utils/roles";
import { getTeam, patchTeam } from "../api";

const ROLE_GROUPS = [
  { id: "medicos",    label: "Médicos",                    roles: ["doctor"] },
  { id: "dentistas",  label: "Dentistas",                  roles: ["dentist"] },
  { id: "enfermagem", label: "Enfermagem",                  roles: ["nurse_manager", "nursing_tech"] },
  { id: "acs",        label: "Agentes Comunitários (ACS)",  roles: ["acs"] },
  { id: "farmacia",   label: "Farmácia",                   roles: ["pharmacist", "pharmacy_tech"] },
  { id: "recepcao",   label: "Recepção",                   roles: ["receptionist"] },
  { id: "gestao",     label: "Gestão",                     roles: ["gestor"] },
  { id: "suporte",    label: "Suporte & TI",               roles: ["developer_readonly", "support_operator", "qa_operator", "security_auditor", "break_glass_admin"] },
];

const ALL_KNOWN_ROLES = new Set(ROLE_GROUPS.flatMap((g) => g.roles));

function groupIdFor(role) {
  const r = String(role || "").toLowerCase();
  return ROLE_GROUPS.find((g) => g.roles.includes(r))?.id || "outros";
}

function MemberCard({ member, isSelf, onOpenProfile }) {
  return (
    <div className={`equipe-card${isSelf ? " equipe-card--self" : ""}`}>
      <div className="equipe-card__top">
        <Avatar name={member.name} size="md" />
        {isSelf && <span className="equipe-card__you">Você</span>}
      </div>
      <div className="equipe-card__body">
        <div className="equipe-card__name">{member.name}</div>
        <div className="equipe-card__role">{roleLabel(member.role)}</div>
        {member.teamName && <div className="equipe-card__meta">{member.teamName}</div>}
        {member.email && <div className="equipe-card__email">{member.email}</div>}
        {member.councilNumber && (
          <div className="equipe-card__meta">
            {member.councilType || "Conselho"} {member.councilNumber}/{member.councilUf}
          </div>
        )}
      </div>
      {isSelf && onOpenProfile && (
        <div className="equipe-card__footer">
          <Button variant="ghost" size="sm" onClick={onOpenProfile}>
            Editar meus dados
          </Button>
        </div>
      )}
    </div>
  );
}

const TIPO_EQUIPE_OPTIONS = [
  { value: "", label: "Selecionar..." },
  { value: "ESF",    label: "ESF — Estratégia Saúde da Família" },
  { value: "NASF",   label: "NASF — Núcleo Ampliado de Saúde da Família" },
  { value: "CEO",    label: "CEO — Centro de Especialidades Odontológicas" },
  { value: "EMAP",   label: "EMAP — Equipe Multiprofissional de Atenção Primária" },
  { value: "EMAD",   label: "EMAD — Equipe Multiprofissional de Atenção Domiciliar" },
  { value: "EAPS",   label: "EAPS — Equipe de Atenção Primária à Saúde" },
  { value: "OUTROS", label: "Outros" },
];

function TeamMetaPanel({ user, token }) {
  const canManage = hasCapability(user, "team.manage");
  const teamId = user?.teamId;

  const [teamData, setTeamData] = useState(null);
  const [editing, setEditing]   = useState(false);
  const [ine, setIne]           = useState("");
  const [tipoEquipe, setTipoEquipe] = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  useEffect(() => {
    if (!teamId || !token) return;
    getTeam(teamId, token).then((data) => {
      if (data && !data.error) {
        setTeamData(data);
        setIne(data.ine || "");
        setTipoEquipe(data.tipoEquipe || "");
      }
    }).catch(() => {});
  }, [teamId, token]);

  if (!teamId || !teamData) return null;

  async function handleSave() {
    setError("");
    setSuccess("");
    if (ine && !/^\d{10}$/.test(ine)) {
      setError("INE deve ter exatamente 10 dígitos numéricos.");
      return;
    }
    setSaving(true);
    try {
      const payload = {};
      if (ine !== (teamData.ine || "")) payload.ine = ine;
      if (tipoEquipe !== (teamData.tipoEquipe || "")) payload.tipoEquipe = tipoEquipe || undefined;
      if (!Object.keys(payload).length) { setEditing(false); setSaving(false); return; }
      const result = await patchTeam(teamId, payload, token);
      if (result?.error) { setError(result.error); }
      else {
        setTeamData(result);
        setIne(result.ine || "");
        setTipoEquipe(result.tipoEquipe || "");
        setEditing(false);
        setSuccess("Dados da equipe atualizados.");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (e) {
      setError("Erro ao salvar: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: "var(--sp-6)" }}>
      <div className="card__header">
        <span className="card__title">Identificação da Equipe</span>
        {canManage && !editing && (
          <Button variant="ghost" size="sm" onClick={() => { setEditing(true); setError(""); setSuccess(""); }}>
            Editar
          </Button>
        )}
      </div>
      <div className="card__body">
        {success && <p style={{ color: "var(--c-success)", marginBottom: "var(--sp-3)", fontSize: "var(--t-sm)" }}>{success}</p>}
        {error && <p style={{ color: "var(--c-danger)", marginBottom: "var(--sp-3)", fontSize: "var(--t-sm)" }}>{error}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-4)" }}>
          <div>
            <div className="label" style={{ marginBottom: "var(--sp-1)" }}>Nome da Equipe</div>
            <div style={{ fontSize: "var(--t-sm)" }}>{teamData.name || "—"}</div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: "var(--sp-1)" }}>INE</div>
            {editing ? (
              <Input
                value={ine}
                onChange={(e) => setIne(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10 dígitos numéricos"
                maxLength={10}
                inputMode="numeric"
              />
            ) : (
              <div style={{ fontSize: "var(--t-sm)", fontFamily: "var(--font-mono)" }}>
                {teamData.ine || <span className="muted">Não informado</span>}
              </div>
            )}
          </div>
          <div>
            <div className="label" style={{ marginBottom: "var(--sp-1)" }}>Tipo de Equipe</div>
            {editing ? (
              <select
                className="input"
                value={tipoEquipe}
                onChange={(e) => setTipoEquipe(e.target.value)}
              >
                {TIPO_EQUIPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: "var(--t-sm)" }}>
                {teamData.tipoEquipe ? (TIPO_EQUIPE_OPTIONS.find((o) => o.value === teamData.tipoEquipe)?.label || teamData.tipoEquipe) : <span className="muted">Não informado</span>}
              </div>
            )}
          </div>
        </div>
        {editing && (
          <div style={{ display: "flex", gap: "var(--sp-2)", marginTop: "var(--sp-4)" }}>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setIne(teamData.ine || ""); setTipoEquipe(teamData.tipoEquipe || ""); setError(""); }}>
              Cancelar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EquipePage({ users = [], user, onOpenProfile, token }) {
  const [search, setSearch]           = useState("");
  const [groupFilter, setGroupFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      if (q) {
        const matchName  = String(u.name  || "").toLowerCase().includes(q);
        const matchEmail = String(u.email || "").toLowerCase().includes(q);
        const matchRole  = roleLabel(u.role).toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchRole) return false;
      }
      if (groupFilter !== "all" && groupIdFor(u.role) !== groupFilter) return false;
      return true;
    });
  }, [users, search, groupFilter]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const g of ROLE_GROUPS) {
      const members = filtered.filter((u) => g.roles.includes(String(u.role || "").toLowerCase()));
      if (members.length) map.set(g.id, { label: g.label, members });
    }
    const others = filtered.filter((u) => !ALL_KNOWN_ROLES.has(String(u.role || "").toLowerCase()));
    if (others.length) map.set("outros", { label: "Outros", members: others });
    return map;
  }, [filtered]);

  const visibleGroups = [...ROLE_GROUPS, { id: "outros", label: "Outros" }].filter(
    (g) => grouped.has(g.id)
  );

  const total = filtered.length;

  return (
    <div className="equipe-page">
      <PageHeader
        eyebrow="EQUIPE"
        title="Equipe"
        subtitle="Visualização dos profissionais da unidade, organizados por cargo e função."
      />

      <TeamMetaPanel user={user} token={token} />

      <div className="equipe-toolbar">
        <div style={{ flex: "1 1 240px" }}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou cargo..."
          />
        </div>
        <select
          className="input"
          style={{ flex: "0 0 200px" }}
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="all">Todos os cargos</option>
          {ROLE_GROUPS.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>
        <span className="equipe-count">
          {total} profissional{total !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="equipe-body">
        {grouped.size === 0 ? (
          <div className="empty-state">
            <div className="empty-state__title">Nenhum profissional encontrado</div>
            <div className="empty-state__body">Tente ajustar os filtros de busca.</div>
          </div>
        ) : (
          visibleGroups.map((g) => {
            const section = grouped.get(g.id);
            if (!section) return null;
            return (
              <div key={g.id} className="equipe-group">
                <div className="equipe-group__header">
                  <span className="equipe-group__label">{section.label}</span>
                  <span className="equipe-group__count">{section.members.length}</span>
                </div>
                <div className="equipe-group__grid">
                  {section.members.map((member) => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      isSelf={member.id === user?.id}
                      onOpenProfile={onOpenProfile}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
