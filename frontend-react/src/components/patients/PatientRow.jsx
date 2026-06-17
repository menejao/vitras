import Badge from "../ui/Badge";
import Button from "../ui/Button";
import PatientActions from "./PatientActions";

function resolvePatientStatus(patient) {
  if (patient?.inactive) return { label: "Inativo", tone: "danger" };
  if (patient?.incompleteProfile) return { label: "Cadastro incompleto", tone: "warning" };
  return null;
}

export default function PatientRow({
  patient,
  selected,
  catLabel,
  templates,
  calcAge,
  protocolSummary,
  protocolChip,
  assignedAcsName,
  onToggleWorkspace,
  onView,
  onEdit,
  onDelete,
}) {
  const status = resolvePatientStatus(patient);
  const protocol = protocolChip?.(protocolSummary) || { text: "Sem protocolo", tone: "neutral" };
  const age = calcAge(patient.birthDate) || "—";

  return (
    <tr className={selected ? "selected" : ""} onClick={() => onToggleWorkspace?.(patient)}>
      <td className="expand-cell" onClick={(event) => event.stopPropagation()}>
        <Button
          className={`icon-btn expand-btn${selected ? " expanded" : ""}`}
          variant="ghost"
          size="sm"
          iconOnly
          title={selected ? "Fechar atendimento" : "Abrir atendimento"}
          onClick={() => onToggleWorkspace?.(patient)}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 12l4-4-4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Button>
      </td>
      <td>
        <div className="pat-row-patient">
          <div className="pat-row-avatar">{String(patient.nomeSocial || patient.name || "?").trim().slice(0, 1).toUpperCase()}</div>
          <div className="pat-row-copy">
            <div className="pat-row-name" title={patient.nomeSocial || patient.name}>
              {patient.nomeSocial || patient.name}
            </div>
            {patient.nomeSocial && (
              <div className="pat-row-civil-name">{patient.name}</div>
            )}
            <div className="pat-row-meta">
              <span>{patient.phone || "Sem telefone"}</span>
              <span>•</span>
              <span>{age}</span>
              {status ? (
                <>
                  <span>•</span>
                  <span className="pat-row-flag">{status.label}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </td>
      <td>{catLabel(templates || [], patient.careCategory)}</td>
      <td className="text-nowrap">{assignedAcsName || "Não atribuído"}</td>
      <td>
        <Badge tone={protocol.tone}>{protocol.text}</Badge>
      </td>
      <td className="actions-cell" onClick={(event) => event.stopPropagation()}>
        <PatientActions
          patient={patient}
          onEdit={onEdit}
          onView={onView}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}
