import { NAV_ICON, buildNavItems } from "../../config/nav";
import Button from "../ui/Button";

function Sidebar({ tab, setTab, mobileOpen, setMobileOpen, user, canManageUser, onClearPatient }) {
  const navItems = buildNavItems(user, canManageUser);

  return (
    <aside className={`sidebar${mobileOpen ? " is-open" : ""}`}>
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
        </div>

        <nav className="nav">
          {navItems.map((item, i) => {
            const prevSection = i > 0 ? navItems[i - 1].section : null;
            const showSection = item.section && item.section !== prevSection;
            return [
              showSection ? <div key={"sec-" + item.id} className="nav__label">{item.section}</div> : null,
              <Button key={item.id}
                variant="ghost"
                className={`nav__item${tab === item.id ? " is-active" : ""}`}
                onClick={() => { setTab(item.id); setMobileOpen(false); if (item.id !== "patients" && onClearPatient) onClearPatient(); }}>
                {NAV_ICON[item.id]}
                {item.label}
              </Button>
            ];
          })}
        </nav>
      </div>
    </aside>
  );
}

export default Sidebar;
