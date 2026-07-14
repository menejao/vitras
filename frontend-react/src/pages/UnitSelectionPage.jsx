import { useState } from "react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Alert from "../components/ui/Alert";
import Avatar from "../components/ui/Avatar";
import { roleLabel } from "../utils/roles";

const IconBuilding = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 21V9M15 21V9M3 9h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function UnitCard({ unit, onSelect, busy }) {
  return (
    <button
      className="unit-selection__card"
      onClick={() => onSelect(unit.unitId)}
      disabled={busy}
      type="button"
    >
      <div className="unit-selection__card-icon">
        <IconBuilding />
      </div>
      <div className="unit-selection__card-body">
        <div className="unit-selection__card-name">{unit.unitName || unit.unitId}</div>
        {unit.teamName ? (
          <div className="unit-selection__card-meta">{unit.teamName}</div>
        ) : null}
        {unit.cnes ? (
          <div className="unit-selection__card-cnes">CNES {unit.cnes}</div>
        ) : null}
        <div className="unit-selection__card-role">{roleLabel(unit.role)}</div>
      </div>
      <div className="unit-selection__card-arrow">
        <IconArrow />
      </div>
    </button>
  );
}

function UnitSelectionPage({ user, availableUnits, onSelectUnit, onLogout, busy, error }) {
  const [search, setSearch] = useState("");

  const units = Array.isArray(availableUnits) ? availableUnits : [];
  const filtered = search.trim()
    ? units.filter((u) => {
        const q = search.toLowerCase();
        return (
          (u.unitName || "").toLowerCase().includes(q) ||
          (u.teamName || "").toLowerCase().includes(q) ||
          (u.cnes || "").toLowerCase().includes(q)
        );
      })
    : units;

  return (
    <div className="unit-selection__root">
      <div className="unit-selection__container">
        <div className="unit-selection__header">
          <div className="unit-selection__logo">
            <span className="unit-selection__logo-text">VITRAS</span>
          </div>
          <div className="unit-selection__greeting">
            <Avatar name={user?.name} size="lg" />
            <div>
              <div className="unit-selection__user-name">{user?.name || ""}</div>
              <div className="unit-selection__user-email">{user?.email || ""}</div>
            </div>
          </div>
          <h1 className="unit-selection__title">Selecione a unidade</h1>
          <p className="unit-selection__subtitle">
            Você tem acesso a {units.length} unidade{units.length !== 1 ? "s" : ""}. Escolha em qual deseja trabalhar agora.
          </p>
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        {units.length > 4 ? (
          <div className="unit-selection__search">
            <Input
              placeholder="Buscar unidade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        ) : null}

        <div className="unit-selection__list">
          {filtered.length === 0 ? (
            <div className="unit-selection__empty">Nenhuma unidade encontrada.</div>
          ) : (
            filtered.map((unit) => (
              <UnitCard
                key={unit.membershipId || unit.unitId}
                unit={unit}
                onSelect={onSelectUnit}
                busy={busy}
              />
            ))
          )}
        </div>

        <div className="unit-selection__footer">
          <Button variant="ghost" onClick={onLogout} disabled={busy}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}

export default UnitSelectionPage;
