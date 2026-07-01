import { useEffect, useState } from "react";
import { getMinhaSaude } from "../services/minhaSaudeService.js";

// ── Icons ──────────────────────────────────────────────────────────────────────
const IcoSyringe = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>;
const IcoFile    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const IcoPill    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v2"/><circle cx="17" cy="17" r="5"/><line x1="14" y1="17" x2="20" y2="17"/></svg>;
const IcoFlask   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v10l3 6H6l3-6V3z"/></svg>;
const IcoAlert   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IcoCheck   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;

// ── Status badge map ──────────────────────────────────────────────────────────
const STATUS_BADGE = {
  aplicada: { cls: "chip chip--green",  label: "Aplicada"  },
  pendente:  { cls: "chip chip--amber",  label: "Pendente"  },
  atrasada:  { cls: "chip chip--red",    label: "Atrasada"  },
  ativa:     { cls: "chip chip--teal",   label: "Ativa"     },
};

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || { cls: "chip chip--slate", label: status || "—" };
  return <span className={s.cls}>{s.label}</span>;
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ title, icon, count, badge, children, emptyMsg, fullWidth }) {
  return (
    <div className={"portal-saude-section-card" + (fullWidth ? " portal-saude-grid--full" : "")}>
      <div className="portal-saude-section-card__header">
        <div className="portal-saude-section-card__title">
          {icon}
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
          {badge}
          {count != null && (
            <span className="portal-saude-section-card__count">{count}</span>
          )}
        </div>
      </div>
      <div className="portal-saude-section-card__body">
        {children || (
          <div style={{
            padding: "var(--s-4) var(--s-5)",
            color: "var(--text-muted)", fontSize: "var(--t-sm)",
          }}>
            {emptyMsg || "Nenhum registro."}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Health row ────────────────────────────────────────────────────────────────

function HealthRow({ name, sub, badge }) {
  return (
    <div className="portal-saude-health-row">
      <div className="portal-saude-health-row__info">
        <div className="portal-saude-health-row__name">{name}</div>
        {sub && <div className="portal-saude-health-row__sub">{sub}</div>}
      </div>
      {badge}
    </div>
  );
}

// ── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ vacinas, exames, receitas, medicamentos }) {
  const vacinasPend = vacinas.filter(v => v.status !== "aplicada").length;
  const examesDisp  = exames.filter(e => e.resultado).length;
  const totalMeds   = receitas.length + medicamentos.length;

  const items = [
    {
      label: "Vacinas", value: vacinas.length, color: "var(--teal-600)",
      sub: vacinasPend > 0 ? `${vacinasPend} pendente${vacinasPend > 1 ? "s" : ""}` : "Em dia",
      subColor: vacinasPend > 0 ? "var(--warning)" : "var(--success)",
    },
    {
      label: "Exames", value: exames.length, color: "var(--accent)",
      sub: examesDisp > 0 ? `${examesDisp} disponível${examesDisp > 1 ? "s" : ""}` : "Sem resultado",
      subColor: examesDisp > 0 ? "var(--success)" : "var(--text-muted)",
    },
    {
      label: "Medicamentos", value: totalMeds, color: "var(--navy)",
      sub: totalMeds > 0 ? `${receitas.length} receita${receitas.length !== 1 ? "s" : ""}` : "Nenhum",
      subColor: "var(--text-muted)",
    },
  ];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--s-3)",
      marginBottom: "var(--s-5)",
    }}>
      {items.map(({ label, value, color, sub, subColor }) => (
        <div key={label} style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", padding: "var(--s-4)",
          borderTop: `3px solid ${color}`,
        }}>
          <div style={{ fontSize: "var(--t-2xl)", fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
          <div style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{label}</div>
          <div style={{ fontSize: "var(--t-xs)", color: subColor, marginTop: 2 }}>{sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MinhaSaudePage() {
  const [saude,   setSaude]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMinhaSaude()
      .then(setSaude)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="portal-page-header">
          <div className="portal-page-header__title">Minha Saúde</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--s-3)", marginBottom: "var(--s-5)" }}>
          {[1,2,3].map(i => <div key={i} className="portal-skeleton" style={{ height: 80, borderRadius: 16 }} />)}
        </div>
        <div className="portal-saude-grid">
          {[1,2,3,4].map(i => <div key={i} className="portal-skeleton" style={{ height: 160, borderRadius: 16 }} />)}
        </div>
      </div>
    );
  }

  const {
    vacinas      = [],
    receitas     = [],
    medicamentos = [],
    exames       = [],
    alergias     = [],
  } = saude || {};

  return (
    <div>
      <div className="portal-page-header">
        <div className="portal-page-header__title">Minha Saúde</div>
        <div className="portal-page-header__sub">Resumo atualizado pela sua equipe</div>
      </div>

      {/* Summary top strip */}
      <SummaryStrip
        vacinas={vacinas}
        exames={exames}
        receitas={receitas}
        medicamentos={medicamentos}
      />

      {/* Alerta LGPD */}
      <div className="portal-info-banner" style={{ marginBottom: "var(--s-5)" }}>
        Informações fornecidas pela equipe da sua UBS. Em caso de dúvidas, entre em contato com seu médico ou enfermeiro.
      </div>

      {/* Dashboard grid */}
      <div className="portal-saude-grid">

        {/* Alergias — full width when present */}
        {alergias.length > 0 && (
          <SectionCard
            title="Alergias Importantes"
            icon={<IcoAlert />}
            count={alergias.length}
            badge={<span className="chip chip--red">Atenção</span>}
            fullWidth
          >
            {alergias.map((a, i) => (
              <HealthRow
                key={i}
                name={typeof a === "string" ? a : a.nome || a}
                badge={<span className="chip chip--red">Alergia</span>}
              />
            ))}
          </SectionCard>
        )}

        {/* Vacinas */}
        <SectionCard
          title="Vacinas"
          icon={<IcoSyringe />}
          count={vacinas.length}
          emptyMsg="Nenhuma vacina registrada."
        >
          {vacinas.length > 0 && vacinas.map((v, i) => (
            <HealthRow
              key={i}
              name={v.nome}
              sub={v.data ? `Aplicada em ${v.data}` : null}
              badge={<StatusBadge status={v.status === "aplicada" ? "aplicada" : "pendente"} />}
            />
          ))}
        </SectionCard>

        {/* Exames */}
        <SectionCard
          title="Exames"
          icon={<IcoFlask />}
          count={exames.length}
          emptyMsg="Nenhum exame registrado."
        >
          {exames.length > 0 && exames.map((e, i) => (
            <HealthRow
              key={i}
              name={e.tipo}
              sub={`Solicitado em ${e.solicitado}`}
              badge={
                e.resultado
                  ? <span className="chip chip--green">{e.resultado}</span>
                  : <span className="chip chip--slate">Aguardando</span>
              }
            />
          ))}
        </SectionCard>

        {/* Receitas */}
        <SectionCard
          title="Receitas Ativas"
          icon={<IcoFile />}
          count={receitas.length}
          emptyMsg="Nenhuma receita ativa."
        >
          {receitas.length > 0 && receitas.map((r, i) => (
            <HealthRow
              key={i}
              name={r.medicamento}
              sub={`${r.posologia} · válida até ${r.validade}`}
              badge={<span className="chip chip--teal">Ativa</span>}
            />
          ))}
        </SectionCard>

        {/* Medicamentos */}
        <SectionCard
          title="Medicamentos"
          icon={<IcoPill />}
          count={medicamentos.length}
          emptyMsg="Nenhum medicamento cadastrado."
        >
          {medicamentos.length > 0 && medicamentos.map((m, i) => (
            <HealthRow
              key={i}
              name={m.nome}
              sub={m.retirada || null}
            />
          ))}
        </SectionCard>

      </div>
    </div>
  );
}
