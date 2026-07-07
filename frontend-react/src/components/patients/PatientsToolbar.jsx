import Button from "../ui/Button";
import Input from "../ui/Input";

const IconFilter = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export default function PatientsToolbar({
  query,
  setQuery,
  onCreate,
  selectedCount,
  showFilters,
  onToggleFilters,
  activeFilterCount,
}) {
  return (
    <div className="patients-toolbar">
      <Input
        label="Busca rápida"
        placeholder="Buscar por nome, CPF, CNS ou telefone"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
      />
      <div className="patients-toolbar__actions">
        <span className="patients-toolbar__meta">{selectedCount} paciente(s)</span>
        <Button
          variant="secondary"
          size="sm"
          className={`patients-toolbar__filter-btn${showFilters ? " is-active" : ""}`}
          onClick={onToggleFilters}
        >
          <IconFilter />
          Filtros
          {activeFilterCount > 0 ? (
            <span className="patients-toolbar__filter-badge">{activeFilterCount}</span>
          ) : null}
        </Button>
        <Button variant="primary" onClick={onCreate}>Novo paciente</Button>
      </div>
    </div>
  );
}
