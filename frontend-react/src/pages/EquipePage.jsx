import { useMemo, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { roleLabel } from "../utils/roles";

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

export default function EquipePage({ users = [], user, onOpenProfile }) {
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
