import { NAV_ICON, buildNavItems } from "../../config/nav";
import Button from "../ui/Button";
import vitrasLockupDark from "../../brand/logos/primary/vitras-lockup-dark.svg";
import vitrasMarkMonoWhite from "../../brand/symbol/svg/vitras-mark-mono-white.svg";

const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function Sidebar({ tab, setTab, mobileOpen, setMobileOpen, user, canManageUser, enabledModules, onClearPatient, collapsed, onToggleCollapsed }) {
  const navItems = buildNavItems(user, canManageUser, enabledModules);
  const cls = ["sidebar", mobileOpen ? "is-open" : "", collapsed ? "is-collapsed" : ""].filter(Boolean).join(" ");

  return (
    <aside className={cls}>
      <div className="sidebar-inner">
        <div className="sidebar__brand">
          <div className="sidebar__brand-lockup">
            <img
              src={vitrasLockupDark}
              alt="Vitras"
              className="sidebar__brand-logo"
            />
            <img
              src={vitrasMarkMonoWhite}
              alt="Vitras"
              className="sidebar__brand-mark-only"
              aria-hidden="true"
            />
          </div>
          <Button
            variant="ghost"
            className="sidebar__collapse-btn"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </Button>
        </div>

        <nav className="nav">
          {navItems.map((item, i) => {
            const prevSection = i > 0 ? navItems[i - 1].section : null;
            const showSection = item.section && item.section !== prevSection;
            return [
              showSection ? (
                <div key={"sec-" + item.id} className="nav__label">
                  <span className="nav__label-text">{item.section}</span>
                </div>
              ) : null,
              <Button key={item.id}
                variant="ghost"
                className={`nav__item${tab === item.id ? " is-active" : ""}`}
                title={collapsed ? item.label : undefined}
                onClick={() => { setTab(item.id); setMobileOpen(false); if (item.id !== "patients" && onClearPatient) onClearPatient(); }}>
                {NAV_ICON[item.id]}
                <span className="nav__item-label">{item.label}</span>
              </Button>
            ];
          })}
        </nav>
      </div>
    </aside>
  );
}

export default Sidebar;
