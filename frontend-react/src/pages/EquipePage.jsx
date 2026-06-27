import { useMemo, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { roleLabel } from "../utils/roles";
import { initials } from "../utils/formatting";

const PAGE_SIZE = 20;

const ROLE_GROUPS = [
  { id: "medicos",    label: "Médicos",                   roles: ["doctor"] },
  { id: "dentistas",  label: "Dentistas",                  roles: ["dentist"] },
  { id: "enfermagem", label: "Enfermagem",                  roles: ["nurse_manager", "nursing_tech"] },
  { id: "acs",        label: "Agentes Comunitários (ACS)", roles: ["acs"] },
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

export default function EquipePage({ users = [], user, onOpenProfile }) {
  const [search, setSearch]           = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [page, setPage]               = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      if (q) {
        const matchName  = String(u.name  || "").toLowerCase().includes(q);
        const matchEmail = String(u.email || "").toLowerCase().includes(q);
        const matchRole  = roleLabel(u.role).toLowerCase().includes(q);
        const matchId    = String(u.id    || "").toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchRole && !matchId) return false;
      }
      if (groupFilter !== "all" && groupIdFor(u.role) !== groupFilter) return false;
      return true;
    });
  }, [users, search, groupFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Build groups only from current page slice for header rows
  const pagedGrouped = useMemo(() => {
    const map = new Map();
    for (const g of ROLE_GROUPS) {
      const members = filtered.filter((u) => g.roles.includes(String(u.role || "").toLowerCase()));
      if (members.length) map.set(g.id, { label: g.label, total: members.length });
    }
    const others = filtered.filter((u) => !ALL_KNOWN_ROLES.has(String(u.role || "").toLowerCase()));
    if (others.length) map.set("outros", { label: "Outros", total: others.length });
    return map;
  }, [filtered]);

  function applyFilter(fn) { fn(); setPage(1); }

  const total = filtered.length;

  // Build table rows with group separators
  const rows = useMemo(() => {
    const result = [];
    let lastGroupId = null;
    for (const member of paged) {
      const gid = groupIdFor(member.role);
      if (gid !== lastGroupId) {
        const info = pagedGrouped.get(gid) || { label: "Outros", total: 0 };
        result.push({ type: "group", id: gid, label: info.label, total: info.total });
        lastGroupId = gid;
      }
      result.push({ type: "member", member });
    }
    return result;
  }, [paged, pagedGrouped]);

  const isSelf = (m) => m.id === user?.id;

  return (
    <div className="equipe-page">
      <PageHeader
        eyebrow="EQUIPE"
        title="Equipe"
        subtitle="Profissionais da unidade organizados por cargo e função."
      />

      <div className="equipe-toolbar">
        <div style={{ flex: "1 1 240px" }}>
          <Input
            value={search}
            onChange={(e) => applyFilter(() => setSearch(e.target.value))}
            placeholder="Buscar por nome, e-mail, ID ou cargo..."
          />
        </div>
        <select
          className="input"
          style={{ flex: "0 0 200px" }}
          value={groupFilter}
          onChange={(e) => applyFilter(() => setGroupFilter(e.target.value))}
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    if (row.type === "group") {
                      return (
                        <tr key={`g-${row.id}-${idx}`} className="equipe-table__group-row">
                          <td colSpan={6}>
                            <span className="equipe-group__label">{row.label}</span>
                            <span className="equipe-group__count">{row.total}</span>
                          </td>
                        </tr>
                      );
                    }
                    const m = row.member;
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
                              </div>
                              {m.email && <div className="equipe-table__email">{m.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="equipe-table__role">{roleLabel(m.role)}</td>
                        <td className="muted small">{m.teamName || "—"}</td>
                        <td className="equipe-table__id">{String(m.id || "").slice(0, 8)}</td>
                        <td className="muted small">
                          {m.councilNumber
                            ? `${m.councilType || "CRM"} ${m.councilNumber}/${m.councilUf || ""}`
                            : "—"}
                        </td>
                        <td>
                          {self && onOpenProfile && (
                            <Button variant="ghost" size="sm" onClick={onOpenProfile}>
                              Editar
                            </Button>
                          )}
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
  );
}
