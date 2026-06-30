import { useEffect, useState } from "react";
import { getMinhaUbs } from "../services/ubsService.js";

function InfoRow({ icon, label, value }) {
  return (
    <div className="portal-ubs-info-row">
      <div className="portal-ubs-info-row__icon">{icon}</div>
      <div>
        <div className="portal-ubs-info-row__label">{label}</div>
        <div className="portal-ubs-info-row__value">{value}</div>
      </div>
    </div>
  );
}

const IcoPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);
const IcoPhone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const IcoClock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IcoUsers = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IcoUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

export default function MinhaUbsPage() {
  const [ubs,     setUbs]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMinhaUbs()
      .then(setUbs)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="portal-page-header">
          <div className="portal-page-header__title">Minha UBS</div>
        </div>
        <div className="skeleton" style={{ height: 100, borderRadius: 16, marginBottom: 12 }} />
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  if (!ubs) return (
    <div className="portal-empty">
      <div className="portal-empty__title">UBS não encontrada</div>
      <div className="portal-empty__text">Seu cadastro ainda não está vinculado a uma UBS.</div>
    </div>
  );

  return (
    <div>
      <div className="portal-page-header">
        <div className="portal-page-header__title">Minha UBS</div>
        <div className="portal-page-header__sub">Sua unidade de referência</div>
      </div>

      <div className="portal-ubs-card">
        <div className="portal-ubs-card__header">
          <div className="portal-ubs-card__name">{ubs.nome}</div>
          <div className="portal-ubs-card__city">{ubs.municipio} — {ubs.uf}</div>
        </div>
        <div className="portal-ubs-card__body">
          <InfoRow
            icon={<IcoPin />}
            label="Endereço"
            value={`${ubs.endereco}, ${ubs.bairro} · CEP ${ubs.cep}`}
          />
          <InfoRow
            icon={<IcoPhone />}
            label="Telefone"
            value={ubs.telefone || "—"}
          />
          <InfoRow
            icon={<IcoClock />}
            label="Horário de atendimento"
            value={ubs.horario || "—"}
          />
          {ubs.equipe && (
            <InfoRow
              icon={<IcoUsers />}
              label="Equipe de referência"
              value={ubs.equipe}
            />
          )}
          {ubs.acs && (
            <InfoRow
              icon={<IcoUser />}
              label="Agente Comunitário de Saúde"
              value={ubs.acs}
            />
          )}
        </div>
      </div>

      <div className="portal-info-banner" style={{ marginTop: "var(--s-3)" }}>
        Para alterações no seu cadastro ou vínculo de equipe, procure sua UBS pessoalmente.
      </div>
    </div>
  );
}
