import Select from "../ui/Select";

export default function RecordFilters({ typeFilter, setTypeFilter }) {
  return (
    <div className="records-filters">
      <Select label="Tipo de registro" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
        <option value="">Todos</option>
        <option value="consultation">Consulta</option>
        <option value="visit">Visita</option>
        <option value="note">Anotação</option>
        <option value="exam">Exame</option>
        <option value="vaccine">Vacina</option>
        <option value="task">Tarefa</option>
      </Select>
    </div>
  );
}
