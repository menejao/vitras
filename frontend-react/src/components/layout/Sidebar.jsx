import { NAV_ICON, buildNavItems } from "../../config/nav";
import Button from "../ui/Button";

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

function Sidebar({ tab, setTab, mobileOpen, setMobileOpen, user, canManageUser, onClearPatient, collapsed, onToggleCollapsed }) {
  const navItems = buildNavItems(user, canManageUser);
  const cls = ["sidebar", mobileOpen ? "is-open" : "", collapsed ? "is-collapsed" : ""].filter(Boolean).join(" ");

  return (
    <aside className={cls}>
      <div className="sidebar-inner">
        <div className="sidebar__brand">
          <div className="sidebar__brand-lockup">
            <div className="sidebar__brand-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <rect x="7.25" y="1.75" width="3.5" height="14.5" rx="1.75" fill="white" />
                <rect x="1.75" y="7.25" width="14.5" height="3.5" rx="1.75" fill="white" />
              </svg>
            </div>
            <div className="sidebar__brand-copy">
              <strong>Vitras</strong>
            </div>
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
