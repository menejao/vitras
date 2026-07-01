import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPerfil, getInitials } from "../services/perfilService.js";

const IcoUser    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcoBell    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcoShield  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcoLogout  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IcoChevron = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const IcoInfo    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

function MenuItem({ icon, label, sub, onClick, danger = false, iconColor }) {
  return (
    <button
      className={"portal-menu-item" + (danger ? " portal-menu-item--danger" : "")}
      onClick={onClick}
    >
      <div className="portal-menu-item__icon" style={iconColor ? { background: "transparent", color: iconColor } : {}}>
        {icon}
      </div>
      <div style={{ flex: 1, textAlign: "left" }}>
        <span className="portal-menu-item__label">{label}</span>
        {sub && <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
      </div>
      <div className="portal-menu-item__arrow"><IcoChevron /></div>
    </button>
  );
}

export default function MaisPage({ onLogout }) {
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

  const initials = getInitials(perfil?.nome);

  return (
    <div>
      <div className="portal-page-header">
        <div className="portal-page-header__title">Minha Conta</div>
      </div>

      {/* Avatar + identidade */}
      <div className="portal-mais-header">
        {loading ? (
          <div className="portal-skeleton" style={{ width: 56, height: 56, borderRadius: "50%" }} />
        ) : (
          <div className="portal-mais-avatar">{initials}</div>
        )}
        <div className="portal-mais-header__text">
          {loading ? (
            <>
              <div className="portal-skeleton" style={{ height: 18, width: 160, marginBottom: 8 }} />
              <div className="portal-skeleton" style={{ height: 13, width: 120 }} />
            </>
          ) : (
            <>
              <div className="portal-mais-header__name">{perfil?.nome || "—"}</div>
              <div className="portal-mais-header__sub">CPF {perfil?.cpf || "—"}</div>
              {perfil?.cns && <div className="portal-mais-header__sub">CNS {perfil.cns}</div>}
            </>
          )}
        </div>
      </div>

      {/* Dados */}
      <div className="portal-section">
        <div className="portal-section__title">Cadastro</div>
        <div className="portal-dash-card" style={{ marginBottom: 0 }}>
          <div className="portal-menu-list">
            <MenuItem
              icon={<IcoUser />}
              label="Meu Cadastro"
              sub="Dados pessoais e endereço"
              onClick={() => navigate("/meu-cadastro")}
            />
          </div>
        </div>
      </div>

      {/* Preferências */}
      <div className="portal-section">
        <div className="portal-section__title">Preferências</div>
        <div className="portal-dash-card" style={{ marginBottom: 0 }}>
          <div className="portal-menu-list">
            <MenuItem
              icon={<IcoBell />}
              label="Notificações"
              sub="Comunicados e avisos"
              onClick={() => navigate("/meu-cadastro")}
            />
          </div>
        </div>
      </div>

      {/* Conta e segurança */}
      <div className="portal-section">
        <div className="portal-section__title">Conta</div>
        <div className="portal-dash-card" style={{ marginBottom: 0 }}>
          <div className="portal-menu-list">
            <MenuItem
              icon={<IcoShield />}
              label="Segurança e senha"
              sub="Alterar senha e acesso"
              onClick={() => navigate("/meu-cadastro")}
            />
            <MenuItem
              icon={<IcoInfo />}
              label="Sobre o VITRAS"
              sub="Portal do Cidadão · v0.1"
              onClick={() => {}}
            />
            <MenuItem
              icon={<IcoLogout />}
              label="Sair"
              onClick={handleLogout}
              danger
            />
          </div>
        </div>
      </div>

      <p style={{ textAlign: "center", fontSize: "var(--t-xs)", color: "var(--text-dim)", padding: "var(--s-4) 0 var(--s-8)", lineHeight: "var(--lh-relaxed)" }}>
        Sua privacidade é protegida pela LGPD.
      </p>
    </div>
  );
}
