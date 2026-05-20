import Table from "../ui/Table";
import PatientRow from "./PatientRow";

export default function PatientsTable({
  patients,
  selectedPatientId,
  catLabel,
  templates,
  calcAge,
  users,
  protocolByPatient,
  protocolChip,
  onToggleWorkspace,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <Table className="patients-table">
      <thead>
        <tr>
          <th style={{ width: 40 }} aria-label="Expandir" />
          <th>Paciente</th>
          <th>Categoria</th>
          <th>ACS</th>
          <th>Protocolo</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        {patients.map((patient) => (
          <PatientRow
            key={patient.id}
            patient={patient}
            selected={selectedPatientId === patient.id}
            catLabel={catLabel}
            templates={templates}
            calcAge={calcAge}
            protocolSummary={protocolByPatient?.[patient.id]}
            protocolChip={protocolChip}
            assignedAcsName={users.find((user) => user.id === patient.assignedAcsId)?.name}
            onToggleWorkspace={onToggleWorkspace}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </tbody>
    </Table>
  );
}
