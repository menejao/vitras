import { useEffect, useState } from "react";
import { getMinhaSaude } from "../services/minhaSaudeService.js";

const IcoSyringe = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
    <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
  </svg>
);
const IcoFile = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const IcoPill = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v2"/>
    <circle cx="17" cy="17" r="5"/><line x1="14" y1="17" x2="20" y2="17"/>
  </svg>
);
const IcoActivity = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IcoAlert = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

function HealthSection({ title, icon, count, children, emptyMsg }) {
  return (
    <div className="portal-health-section">
      <div className="portal-health-section__header">
        <div className="portal-health-section__title">
          {icon} {title}
        </div>
        {count != null && (
          <span className="portal-health-section__count">{count} {count === 1 ? "item" : "itens"}</span>
        )}
      </div>
      <div className="portal-health-section__body">
        {children || (
          <div style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", padding: "var(--s-2) 0" }}>{emptyMsg}</div>
        )}
      </div>
    </div>
  );
}

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
        {[1,2,3].map(i => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16, marginBottom: 16 }} />
        ))}
      </div>
    );
  }

  const { vacinas = [], receitas = [], medicamentos = [], exames = [], alergias = [] } = saude || {};

  return (
    <div>
      <div className="portal-page-header">
        <div className="portal-page-header__title">Minha Saúde</div>
        <div className="portal-page-header__sub">Resumo atualizado pela sua equipe</div>
      </div>

      <div className="portal-info-banner" style={{ marginBottom: "var(--s-5)" }}>
        Estas informações são fornecidas pela equipe da sua UBS. Em caso de dúvidas, entre em contato com seu médico ou enfermeiro.
      </div>

      {/* Alergias — sempre primeiro se houver */}
      {alergias.length > 0 && (
        <HealthSection title="Alergias Importantes" icon={<IcoAlert />}>
          {alergias.map((a, i) => (
            <div key={i} className="portal-health-row">
              <span className="portal-health-row__label">{a}</span>
              <span className="chip chip--red">Alergia</span>
            </div>
          ))}
        </HealthSection>
      )}

      {/* Vacinas */}
      <HealthSection title="Vacinas" icon={<IcoSyringe />} count={vacinas.length} emptyMsg="Nenhuma vacina registrada.">
        {vacinas.map((v, i) => (
          <div key={i} className="portal-health-row">
            <div>
              <div className="portal-health-row__label">{v.nome}</div>
              {v.data && <div className="portal-health-row__value">{v.data}</div>}
            </div>
            <span className={"chip " + (v.status === "aplicada" ? "chip--green" : "chip--amber")}>
              {v.status === "aplicada" ? "Aplicada" : "Pendente"}
            </span>
          </div>
        ))}
      </HealthSection>

      {/* Receitas */}
      <HealthSection title="Receitas Ativas" icon={<IcoFile />} count={receitas.length} emptyMsg="Nenhuma receita ativa.">
        {receitas.map((r, i) => (
          <div key={i} className="portal-health-row">
            <div>
              <div className="portal-health-row__label">{r.medicamento}</div>
              <div className="portal-health-row__value">{r.posologia} · válida até {r.validade}</div>
            </div>
            <span className="chip chip--teal">Ativa</span>
          </div>
        ))}
      </HealthSection>

      {/* Medicamentos */}
      <HealthSection title="Medicamentos" icon={<IcoPill />} count={medicamentos.length} emptyMsg="Nenhum medicamento cadastrado.">
        {medicamentos.map((m, i) => (
          <div key={i} className="portal-health-row">
            <div className="portal-health-row__label">{m.nome}</div>
            <div className="portal-health-row__value" style={{ fontSize: "var(--t-xs)" }}>{m.retirada}</div>
          </div>
        ))}
      </HealthSection>

      {/* Exames */}
      <HealthSection title="Exames" icon={<IcoActivity />} count={exames.length} emptyMsg="Nenhum exame registrado.">
        {exames.map((e, i) => (
          <div key={i} className="portal-health-row">
            <div>
              <div className="portal-health-row__label">{e.tipo}</div>
              <div className="portal-health-row__value">Solicitado em {e.solicitado}</div>
            </div>
            <span className={"chip " + (e.resultado ? "chip--green" : "chip--slate")}>
              {e.resultado || "Aguardando"}
            </span>
          </div>
        ))}
      </HealthSection>
    </div>
  );
}
