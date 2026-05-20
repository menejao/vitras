import { useEffect, useState } from "react";
import GlobalSearch from "../ui/GlobalSearch";
import NotificationBell from "../ui/NotificationBell";
import Avatar from "../ui/Avatar";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { catLabel } from "../../utils/clinical";
import {
  roleLabel,
  canImpersonate,
  canActivateBreakGlass,
  isImpersonating,
  isBreakGlassActive
} from "../../utils/roles";

const IconSignOut = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M10 11l4-4-4-4M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function Topbar({
  user,
  selectedPatient,
  templates,
  mobileOpen,
  setMobileOpen,
  onLogout,
  onOpenProfile,
  onOpenSecureAccess,
  onStopImpersonation,
  onActivateBreakGlass,
  onDeactivateBreakGlass,
  patients,
  protocolByPatient,
  pharmacyStock,
  agenda,
  onNavigatePatient,
  apiHealth
}) {
  const [dropOpen, setDropOpen] = useState(false);

  useEffect(() => {
    if (!dropOpen) return;
    const handler = () => setDropOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [dropOpen]);

  const statusTone = apiHealth?.status === "ok" ? "success" : apiHealth?.status === "checking" ? "warning" : "danger";
  const impersonating = isImpersonating(user);
  const breakGlass = isBreakGlassActive(user);

  return (
    <header className="topbar topbar--vitras">
      <Button className="mobile-menu-btn" variant="ghost" onClick={() => setMobileOpen((value) => !value)} aria-label="Abrir navegação">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d={mobileOpen ? "M2 2l12 12M2 14L14 2" : "M2 4h12M2 8h12M2 12h12"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </Button>

      <div className="topbar__center">
        <GlobalSearch patients={patients || []} templates={templates || []} onNavigate={onNavigatePatient || (() => {})} />
        {selectedPatient ? (
          <div className="topbar__patient-pill">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="topbar__patient-icon">
              <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span className="topbar__patient-name">{selectedPatient.name}</span>
            <span className="topbar__patient-meta">· {catLabel(templates, selectedPatient.careCategory)}</span>
          </div>
        ) : null}
      </div>

      <div className="topbar__right">
        {impersonating ? <Badge tone="warning">Contexto assumido</Badge> : null}
        {breakGlass ? <Badge tone="danger">Break-glass ativo</Badge> : null}
        <Badge tone={statusTone} className="topbar__status">
          API {apiHealth?.label || "Verificando..."}
        </Badge>
        <NotificationBell
          patients={patients || []}
          protocolByPatient={protocolByPatient || {}}
          pharmacyStock={pharmacyStock || []}
          agenda={agenda || []}
          onNavigate={onNavigatePatient || (() => {})}
        />
        {selectedPatient ? <div className="topbar__divider" /> : null}

        <div className="topbar__account" onClick={(event) => event.stopPropagation()}>
          <Button className="topbar__account-trigger" variant="ghost" onClick={() => setDropOpen((value) => !value)}>
            <Avatar name={user?.name} />
            <div className="topbar__account-copy">
              <span>{user?.name || "-"}</span>
              <span>
                {roleLabel(user?.role)}
                {user?.teamName ? ` · ${user.teamName}` : ""}
              </span>
            </div>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="topbar__account-caret">
              <path d={dropOpen ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Button>

          {dropOpen ? (
            <div className="topbar__account-menu">
              <div className="topbar__account-head">
                <div className="topbar__account-head-row">
                  <Avatar name={user?.name} size="lg" />
                  <div>
                    <div className="topbar__account-name">{user?.name || "-"}</div>
                    <div className="topbar__account-email">{user?.email || ""}</div>
                  </div>
                </div>
                {impersonating ? (
                  <div className="topbar__account-email">
                    Atuando no contexto de {user?.impersonation?.targetUserName || "usuário"}.
                  </div>
                ) : null}
              </div>

              <div className="topbar__account-actions">
                <Button onClick={() => { setDropOpen(false); onOpenProfile(); }} variant="ghost" className="topbar__menu-button">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  Editar perfil
                </Button>

                {canImpersonate(user) ? (
                  <Button onClick={() => { setDropOpen(false); onOpenSecureAccess?.("impersonation"); }} variant="ghost" className="topbar__menu-button">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M1.5 13c0-2.5 2-4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M10 8h4M12 6v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    Assumir contexto
                  </Button>
                ) : null}

                {impersonating ? (
                  <Button onClick={() => { setDropOpen(false); onStopImpersonation?.(); }} variant="ghost" className="topbar__menu-button">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M1.5 13c0-2.5 2-4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M10 10l3-3M13 10l-3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    Encerrar contexto
                  </Button>
                ) : null}

                {canActivateBreakGlass(user) && !breakGlass ? (
                  <Button onClick={() => { setDropOpen(false); onOpenSecureAccess?.("break-glass"); }} variant="ghost" className="topbar__menu-button topbar__menu-button--danger">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2l5 9H3l5-9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                      <path d="M8 6v2.5M8 10.8h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    Ativar break-glass
                  </Button>
                ) : null}

                {breakGlass ? (
                  <Button onClick={() => { setDropOpen(false); onDeactivateBreakGlass?.(); }} variant="ghost" className="topbar__menu-button topbar__menu-button--danger">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    Encerrar break-glass
                  </Button>
                ) : null}

                <div className="topbar__menu-divider" />
                <Button onClick={() => { setDropOpen(false); onLogout(); }} variant="ghost" className="topbar__menu-button topbar__menu-button--danger">
                  <IconSignOut />
                  Sair
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
