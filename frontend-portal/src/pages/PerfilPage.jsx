import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPerfil, getInitials } from "../services/perfilService.js";

const IcoUser    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcoPhone   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const IcoMail    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const IcoShield  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcoLogout  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IcoChevron = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const IcoUsers   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcoBell    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;

function MenuItem({ icon, label, onClick, danger = false }) {
  return (
    <button
      className={"portal-menu-item" + (danger ? " portal-menu-item--danger" : "")}
      onClick={onClick}
    >
      <div className="portal-menu-item__icon">{icon}</div>
      <span className="portal-menu-item__label">{label}</span>
      <div className="portal-menu-item__arrow"><IcoChevron /></div>
    </button>
  );
}

export default function PerfilPage({ onLogout }) {
  const navigate = useNavigate();
  const [perfil,  setPerfil]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPerfil()
      .then(setPerfil)
      .finally(() => setLoading(false));
  }, []);

  function handleLogout() {
    if (window.confirm("Sair do Portal do Cidadão VITRAS?")) onLogout();
  }

  if (loading) {
    return (
      <div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "var(--s-8) 0" }}>
          <div className="portal-skeleton" style={{ width: 72, height: 72, borderRadius: "50%" }} />
          <div className="portal-skeleton" style={{ width: 160, height: 24, borderRadius: 8 }} />
          <div className="portal-skeleton" style={{ width: 120, height: 16, borderRadius: 8 }} />
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="portal-skeleton" style={{ height: 56, borderRadius: 12, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  const initials = getInitials(perfil?.nome);

  return (
    <div>
      {/* Avatar + nome */}
      <div className="portal-profile-header">
        <div className="portal-avatar">{initials}</div>
        <div>
          <div className="portal-profile-name">{perfil?.nome}</div>
          <div className="portal-profile-sub">CPF {perfil?.cpf}</div>
          {perfil?.cns && (
            <div className="portal-profile-sub" style={{ marginTop: 2 }}>CNS {perfil.cns}</div>
          )}
        </div>
      </div>

      {/* Dados pessoais */}
      <div className="portal-section">
        <div className="portal-section__title">Dados pessoais</div>
        <div className="portal-dash-card" style={{ marginBottom: 0 }}>
          <div className="portal-menu-list">
            <MenuItem icon={<IcoUser />}  label="Meu Cadastro" onClick={() => navigate("/meu-cadastro")} />
            <MenuItem icon={<IcoPhone />} label={`Telefone: ${perfil?.telefone || "—"}`} onClick={() => navigate("/meu-cadastro")} />
            <MenuItem icon={<IcoMail />}  label={perfil?.email || "E-mail não cadastrado"} onClick={() => navigate("/meu-cadastro")} />
          </div>
        </div>
      </div>

      {/* Dependentes */}
      <div className="portal-section">
        <div className="portal-section__title">Dependentes</div>
        <div className="portal-dash-card" style={{ marginBottom: 0 }}>
          <div className="portal-menu-list">
            <MenuItem icon={<IcoUsers />} label={perfil?.dependentes?.length > 0 ? `${perfil.dependentes.length} dependente(s)` : "Nenhum dependente cadastrado"} onClick={() => {}} />
          </div>
        </div>
      </div>

      {/* Preferências */}
      <div className="portal-section">
        <div className="portal-section__title">Preferências</div>
        <div className="portal-dash-card" style={{ marginBottom: 0 }}>
          <div className="portal-menu-list">
            <MenuItem icon={<IcoBell />} label="Notificações e comunicação" onClick={() => navigate("/meu-cadastro")} />
          </div>
        </div>
      </div>

      {/* Segurança */}
      <div className="portal-section">
        <div className="portal-section__title">Conta</div>
        <div className="portal-dash-card" style={{ marginBottom: 0 }}>
          <div className="portal-menu-list">
            <MenuItem icon={<IcoShield />} label="Segurança e senha"  onClick={() => navigate("/meu-cadastro")} />
            <MenuItem icon={<IcoLogout />} label="Sair"               onClick={handleLogout} danger />
          </div>
        </div>
      </div>

      <p style={{ textAlign: "center", fontSize: "var(--t-xs)", color: "var(--text-dim)", padding: "var(--s-4) 0 var(--s-8)" }}>
        VITRAS Portal do Cidadão · v0.1<br />
        Sua privacidade é protegida pela LGPD.
      </p>
    </div>
  );
}
