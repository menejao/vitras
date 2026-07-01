import { Outlet, NavLink, useNavigate } from "react-router-dom";

// ── Icons ─────────────────────────────────────────────────────────────────────

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

const IcoBell = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IcoBuilding = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IcoGrid = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5"  cy="12" r="1" />
  </svg>
);

const IcoLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const LogoMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 5 L12 19 L19 5" />
  </svg>
);

// ── Nav items ─────────────────────────────────────────────────────────────────

// Sidebar desktop: mostra Avisos explicitamente + Mais
const SIDEBAR_ITEMS = [
  { to: "/home",         label: "Início",    Icon: IcoHome     },
  { to: "/agendamentos", label: "Consultas", Icon: IcoCalendar },
  { to: "/minha-saude",  label: "Saúde",     Icon: IcoHeart    },
  { to: "/minha-ubs",    label: "Minha UBS", Icon: IcoBuilding },
  { to: "/notificacoes", label: "Avisos",    Icon: IcoBell     },
  { to: "/mais",         label: "Mais",      Icon: IcoGrid     },
];

// Bottom nav mobile: Avisos acessível pelo sino, foca em Mais para conta
const BOTTOM_ITEMS = [
  { to: "/home",         label: "Início",    Icon: IcoHome     },
  { to: "/agendamentos", label: "Consultas", Icon: IcoCalendar },
  { to: "/minha-saude",  label: "Saúde",     Icon: IcoHeart    },
  { to: "/minha-ubs",    label: "Minha UBS", Icon: IcoBuilding },
  { to: "/mais",         label: "Mais",      Icon: IcoGrid     },
];

function primeiroNome(nome) {
  return (nome || "").split(" ")[0] || "Cidadão";
}

// ── Sidebar (desktop only) ────────────────────────────────────────────────────

function Sidebar({ cidadao, onLogout }) {
  const nav = useNavigate();
  return (
    <aside className="portal-sidebar" aria-label="Navegação lateral">
      {/* Brand */}
      <div className="portal-sidebar__brand">
        <div className="portal-sidebar__logo">
          <LogoMark />
        </div>
        <div>
          <div className="portal-sidebar__wordmark">VITRAS</div>
          <div className="portal-sidebar__tag">Portal do Cidadão</div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="portal-sidebar__nav">
        {SIDEBAR_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              "portal-sidebar__item" + (isActive ? " active" : "")
            }
          >
            <span className="portal-sidebar__item-icon"><Icon /></span>
            <span className="portal-sidebar__item-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer: user (clicável → /mais) + logout */}
      <div className="portal-sidebar__footer">
        <button
          className="portal-sidebar__user portal-sidebar__user--btn"
          onClick={() => nav("/mais")}
          aria-label="Minha conta"
        >
          <div className="portal-sidebar__user-avatar">
            {primeiroNome(cidadao?.nome)[0]?.toUpperCase() || "C"}
          </div>
          <div className="portal-sidebar__user-name">{primeiroNome(cidadao?.nome)}</div>
        </button>
        <button
          className="portal-sidebar__logout"
          onClick={onLogout}
          aria-label="Sair"
        >
          <IcoLogout />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}

// ── AppLayout ─────────────────────────────────────────────────────────────────

export default function AppLayout({ cidadao, onLogout }) {
  const nav = useNavigate();

  return (
    <div className="portal-shell">

      {/* Sidebar — hidden on mobile, visible on ≥900px */}
      <Sidebar cidadao={cidadao} onLogout={onLogout} />

      {/* Main body */}
      <div className="portal-shell__body">

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

          {/* Desktop: citizen name only (Sair fica na sidebar) */}
          <div className="portal-header__desktop-user">
            <span className="portal-header__desktop-name">{primeiroNome(cidadao?.nome)}</span>
          </div>

          <div className="portal-header__action">
            <button
              className="portal-header__icon-btn"
              onClick={() => nav("/notificacoes")}
              aria-label="Avisos"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="portal-header__badge" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Demo banner */}
        {cidadao?.isDemo && (
          <div className="portal-demo-banner" role="status">
            Conta de demonstração — dados fictícios
          </div>
        )}

        {/* Page content */}
        <main className="portal-content">
          <Outlet />
        </main>

        {/* Bottom nav — hidden on ≥900px */}
        <nav className="portal-bottom-nav" aria-label="Navegação principal">
          {BOTTOM_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                "portal-nav-item" + (isActive ? " active" : "")
              }
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

      </div>
    </div>
  );
}
