import Button from "../ui/Button";

function AppShell({ sidebar, topbar, children, mobileNavOpen = false, onCloseMobileNav }) {
  return (
    <div className="app-shell">
      {mobileNavOpen ? (
        <Button
          className="app-shell__scrim"
          variant="ghost"
          onClick={onCloseMobileNav}
          aria-label="Fechar navegação"
        />
      ) : null}
      {sidebar}
      <div className="app-shell__main">
        {topbar}
        {children}
      </div>
    </div>
  );
}

export default AppShell;
