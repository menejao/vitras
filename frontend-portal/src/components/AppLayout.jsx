import { Outlet, NavLink, useNavigate } from "react-router-dom";

const IcoBell = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IcoHome = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IcoCalendar = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8"  y1="2" x2="8"  y2="6" />
    <line x1="3"  y1="10" x2="21" y2="10" />
  </svg>
);

const IcoHeart = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const IcoUser = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export default function AppLayout({ cidadao, onLogout }) {
  const nav = useNavigate();

  return (
    <div className="portal-shell">
      {/* Header */}
      <header className="portal-header">
        <div className="portal-header__brand">
          <div className="portal-header__logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 5 L12 19 L19 5" />
            </svg>
          </div>
          <span className="portal-header__wordmark">VITRAS</span>
        </div>
        <div className="portal-header__action">
          <button
            className="portal-header__icon-btn"
            onClick={() => nav("/notificacoes")}
            aria-label="Notificações"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="portal-header__badge" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="portal-content">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="portal-bottom-nav" aria-label="Navegação principal">
        <NavLink to="/home"         className={({ isActive }) => "portal-nav-item" + (isActive ? " active" : "")}>
          <IcoHome />
          <span>Início</span>
        </NavLink>
        <NavLink to="/agendamentos" className={({ isActive }) => "portal-nav-item" + (isActive ? " active" : "")}>
          <IcoCalendar />
          <span>Consultas</span>
        </NavLink>
        <NavLink to="/minha-saude"  className={({ isActive }) => "portal-nav-item" + (isActive ? " active" : "")}>
          <IcoHeart />
          <span>Saúde</span>
        </NavLink>
        <NavLink to="/notificacoes" className={({ isActive }) => "portal-nav-item" + (isActive ? " active" : "")}>
          <IcoBell />
          <span>Avisos</span>
          <span className="portal-nav-item__dot" aria-hidden="true" />
        </NavLink>
        <NavLink to="/perfil"       className={({ isActive }) => "portal-nav-item" + (isActive ? " active" : "")}>
          <IcoUser />
          <span>Perfil</span>
        </NavLink>
      </nav>
    </div>
  );
}
