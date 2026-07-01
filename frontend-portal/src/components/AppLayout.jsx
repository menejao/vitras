import { useRef, useState, useEffect } from "react";
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

const IcoUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IcoShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IcoInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IcoLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IcoChevronUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const IcoChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const LogoMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 5 L12 19 L19 5" />
  </svg>
);

// ── Nav items ─────────────────────────────────────────────────────────────────

// "Mais" removido — conta fica no menu popup do footer da sidebar
const SIDEBAR_ITEMS = [
  { to: "/home",         label: "Início",    Icon: IcoHome     },
  { to: "/agendamentos", label: "Consultas", Icon: IcoCalendar },
  { to: "/minha-saude",  label: "Saúde",     Icon: IcoHeart    },
  { to: "/minha-ubs",    label: "Minha UBS", Icon: IcoBuilding },
  { to: "/notificacoes", label: "Avisos",    Icon: IcoBell     },
];

// Bottom nav mobile: mesmo conjunto (conta via header avatar)
const BOTTOM_ITEMS = [
  { to: "/home",         label: "Início",    Icon: IcoHome     },
  { to: "/agendamentos", label: "Consultas", Icon: IcoCalendar },
  { to: "/minha-saude",  label: "Saúde",     Icon: IcoHeart    },
  { to: "/minha-ubs",    label: "Minha UBS", Icon: IcoBuilding },
  { to: "/notificacoes", label: "Avisos",    Icon: IcoBell     },
];

function primeiroNome(nome) {
  return (nome || "").split(" ")[0] || "Cidadão";
}

function inicial(nome) {
  return (nome || "C")[0].toUpperCase();
}

// ── User account menu popup ────────────────────────────────────────────────────

function UserMenuPopup({ onClose, onLogout }) {
  const nav = useNavigate();

  function go(path) {
    nav(path);
    onClose();
  }

  const items = [
    { icon: <IcoUser />,   label: "Meu Cadastro",    action: () => go("/meu-cadastro") },
    { icon: <IcoShield />, label: "Segurança e senha", action: () => go("/meu-cadastro") },
    { icon: <IcoBell />,   label: "Preferências",    action: () => go("/meu-cadastro") },
  ];

  return (
    <div className="portal-sidebar__user-menu">
      {items.map(({ icon, label, action }) => (
        <button key={label} className="portal-sidebar__user-menu-item" onClick={action}>
          <span className="portal-sidebar__user-menu-icon">{icon}</span>
          {label}
        </button>
      ))}
      <div className="portal-sidebar__user-menu-divider" />
      <button className="portal-sidebar__user-menu-item" onClick={() => { go("/mais"); }}>
        <span className="portal-sidebar__user-menu-icon"><IcoInfo /></span>
        Sobre o VITRAS
      </button>
      <button
        className="portal-sidebar__user-menu-item portal-sidebar__user-menu-item--danger"
        onClick={() => { onClose(); onLogout(); }}
      >
        <span className="portal-sidebar__user-menu-icon"><IcoLogout /></span>
        Sair
      </button>
    </div>
  );
}

// ── Sidebar (desktop only) ────────────────────────────────────────────────────

function Sidebar({ cidadao, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const footerRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e) {
      if (footerRef.current && !footerRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <aside className="portal-sidebar" aria-label="Navegação lateral">
      {/* Brand */}
      <div className="portal-sidebar__brand">
        <div className="portal-sidebar__logo"><LogoMark /></div>
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

      {/* Footer: user area + popup menu */}
      <div className="portal-sidebar__footer" ref={footerRef}>
        {menuOpen && (
          <UserMenuPopup
            onClose={() => setMenuOpen(false)}
            onLogout={onLogout}
          />
        )}
        <button
          className="portal-sidebar__user portal-sidebar__user--btn"
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Minha conta"
          aria-expanded={menuOpen}
        >
          <div className="portal-sidebar__user-avatar">
            {inicial(cidadao?.nome)}
          </div>
          <div className="portal-sidebar__user-name">{primeiroNome(cidadao?.nome)}</div>
          <div style={{ marginLeft: "auto", color: "var(--text-dim)", display: "flex", alignItems: "center" }}>
            {menuOpen ? <IcoChevronUp /> : <IcoChevronDown />}
          </div>
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

      {/* Sidebar — hidden on mobile, visible ≥900px */}
      <Sidebar cidadao={cidadao} onLogout={onLogout} />

      {/* Main body: header + content + bottom-nav */}
      <div className="portal-shell__body">

        {/* Header */}
        <header className="portal-header">
          {/* Brand — visible only on mobile (sidebar has it on desktop) */}
          <div className="portal-header__brand">
            <div className="portal-header__logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 5 L12 19 L19 5" />
              </svg>
            </div>
            <span className="portal-header__wordmark">VITRAS</span>
          </div>

          {/* Desktop: full name in center-right */}
          <div className="portal-header__desktop-user">
            <span className="portal-header__desktop-name">{cidadao?.nome || primeiroNome(cidadao?.nome)}</span>
          </div>

          {/* Actions */}
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

            {/* Mobile only: avatar → /mais account hub */}
            <button
              className="portal-header__avatar-btn"
              onClick={() => nav("/mais")}
              aria-label="Minha conta"
            >
              <div className="portal-header__avatar-circle">
                {inicial(cidadao?.nome)}
              </div>
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
