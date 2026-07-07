import Input from "../ui/Input";
import Select from "../ui/Select";

export default function RecordHeader({
  query,
  setQuery,
  patientOptions,
  selectedPatientId,
  onSelectPatient,
}) {
  return (
    <div className="records-header">
      <Input
        label="Buscar paciente"
        placeholder="Digite nome, CPF ou CNS"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
      />
      <Select label="Paciente" value={selectedPatientId} onChange={(event) => onSelectPatient(event.target.value)}>
        <option value="">Selecione</option>
        {patientOptions.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}
      </Select>
    </div>
  );
}
