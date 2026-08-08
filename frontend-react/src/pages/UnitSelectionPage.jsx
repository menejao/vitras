import { useState, useEffect } from "react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Alert from "../components/ui/Alert";
import Avatar from "../components/ui/Avatar";
import { roleLabel } from "../utils/roles";

const IconHospital = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="6" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 22V6M16 22V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M2 12h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9 2h6M12 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <rect x="10" y="14" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);

const IconChevron = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconUsers = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M1 14c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M13 6v4M11 8h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const LAST_UNIT_KEY = (userId) => `vitras_last_unit_${userId}`;

function UnitCard({ unit, isLastUsed, onSelect, busy }) {
  return (
    <button
      className={`usp-card${isLastUsed ? " usp-card--last-used" : ""}`}
      onClick={() => onSelect(unit.unitId)}
      disabled={busy}
      type="button"
    >
      <div className="usp-card__icon">
        <IconHospital />
      </div>
      <div className="usp-card__body">
        <div className="usp-card__top">
          <span className="usp-card__name">{unit.unitName || unit.unitId}</span>
          {isLastUsed && (
            <span className="usp-card__badge-last">Ultima utilizada</span>
          )}
        </div>
        <div className="usp-card__meta-row">
          {unit.teamName && <span className="usp-card__meta">{unit.teamName}</span>}
          {unit.cnes && <span className="usp-card__meta">CNES {unit.cnes}</span>}
          {unit.neighborhood && <span className="usp-card__meta">{unit.neighborhood}</span>}
        </div>
        <div className="usp-card__stats-row">
          <span className="usp-card__role-chip">{roleLabel(unit.role)}</span>
          {unit.professionalCount != null && (
            <span className="usp-card__stat">
              <IconUsers />
              {unit.professionalCount} prof.
            </span>
          )}
          {unit.patientCount != null && (
            <span className="usp-card__stat">
              {unit.patientCount.toLocaleString("pt-BR")} pac.
            </span>
          )}
        </div>
      </div>
      <div className="usp-card__arrow">
        <IconChevron />
      </div>
    </button>
  );
}

function UnitSelectionPage({ user, availableUnits, onSelectUnit, onLogout, busy, error }) {
  const [search, setSearch] = useState("");
  const [lastUsedId, setLastUsedId] = useState(() => {
    try {
      return localStorage.getItem(LAST_UNIT_KEY(user?.vitrasId || user?.id || "")) || null;
    } catch {
      return null;
    }
  });

  const units = Array.isArray(availableUnits) ? availableUnits : [];

  const filtered = search.trim()
    ? units.filter((u) => {
        const q = search.toLowerCase();
        return (
          (u.unitName || "").toLowerCase().includes(q) ||
          (u.teamName || "").toLowerCase().includes(q) ||
          (u.cnes || "").toLowerCase().includes(q) ||
          (u.neighborhood || "").toLowerCase().includes(q)
        );
      })
    : units;

  const sortedFiltered = search.trim()
    ? filtered
    : [
        ...filtered.filter((u) => u.unitId === lastUsedId),
        ...filtered.filter((u) => u.unitId !== lastUsedId),
      ];

  function handleSelect(unitId) {
    try {
      localStorage.setItem(LAST_UNIT_KEY(user?.vitrasId || user?.id || ""), unitId);
      setLastUsedId(unitId);
    } catch {
      /* ignore */
    }
    onSelectUnit(unitId);
  }

  const municipality = user?.municipality || user?.municipalityName || null;

  return (
    <div className="usp-root">
      <div className="usp-container">

        <div className="usp-logo-row">
          <span className="usp-logo-text">VITRAS</span>
        </div>

        <div className="usp-headline">
          <h1 className="usp-title">Escolha a unidade de saude</h1>
          <p className="usp-subtitle">
            Selecione a UBS em que voce trabalhara nesta sessao.
          </p>
        </div>

        <div className="usp-user-card">
          <Avatar name={user?.name} size="lg" />
          <div className="usp-user-card__info">
            <span className="usp-user-card__name">{user?.name || ""}</span>
            <div className="usp-user-card__meta">
              {user?.role && (
                <span className="usp-user-card__role">{roleLabel(user.role)}</span>
              )}
              {municipality && (
                <>
                  <span className="usp-user-card__sep">·</span>
                  <span className="usp-user-card__municipality">{municipality}</span>
                </>
              )}
            </div>
          </div>
          <div className="usp-user-card__count">
            <span className="usp-count-badge">{units.length}</span>
            <span className="usp-count-label">unidade{units.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        {units.length > 4 && (
          <div className="usp-search">
            <Input
              placeholder="Buscar por nome, equipe, CNES ou bairro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <div className="usp-list">
          {sortedFiltered.length === 0 ? (
            <div className="usp-empty">Nenhuma unidade encontrada.</div>
          ) : (
            sortedFiltered.map((unit) => (
              <UnitCard
                key={unit.membershipId || unit.unitId}
                unit={unit}
                isLastUsed={unit.unitId === lastUsedId}
                onSelect={handleSelect}
                busy={busy}
              />
            ))
          )}
        </div>

        <div className="usp-footer">
          <Button variant="ghost" onClick={onLogout} disabled={busy}>
            Trocar usuario
          </Button>
          <Button variant="ghost" onClick={onLogout} disabled={busy}>
            Sair
          </Button>
        </div>

      </div>
    </div>
  );
}

export default UnitSelectionPage;
