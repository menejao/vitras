import Select from "../ui/Select";

export default function PatientFilters({
  categoryFilter,
  setCategoryFilter,
  acsFilter,
  setAcsFilter,
  conditionFilter,
  setConditionFilter,
  categories,
  acsUsers,
}) {
  return (
    <div className="patients-filters">
      <Select label="Categoria" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
        <option value="">Todas</option>
        {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
      </Select>
      <Select label="ACS" value={acsFilter} onChange={(event) => setAcsFilter(event.target.value)}>
        <option value="">Todos</option>
        {acsUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
      </Select>
      <Select label="Condição" value={conditionFilter} onChange={(event) => setConditionFilter(event.target.value)}>
        <option value="">Todas</option>
        <option value="hypertension">Hipertensão</option>
        <option value="diabetes">Diabetes</option>
        <option value="both">Ambas</option>
      </Select>
    </div>
  );
}
