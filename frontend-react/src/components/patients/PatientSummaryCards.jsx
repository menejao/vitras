import Badge from "../ui/Badge";

export default function PatientSummaryCards({ patients, filteredPatients }) {
  const incompleteCount = filteredPatients.filter((patient) => patient.incompleteProfile).length;
  const chronicCount = filteredPatients.filter((patient) => (patient.chronicConditions || []).length > 0).length;

  return (
    <div className="patients-summary">
      <div className="patients-summary__item">
        <span className="patients-summary__label">Total de pacientes</span>
        <strong className="patients-summary__value">{patients.length}</strong>
        <span className="patients-summary__hint">base carregada</span>
      </div>

      <div className="patients-summary__item">
        <span className="patients-summary__label">Resultado filtrado</span>
        <strong className="patients-summary__value">{filteredPatients.length}</strong>
        <span className="patients-summary__hint">prontos para consulta</span>
      </div>

      <div className="patients-summary__item">
        <span className="patients-summary__label">Cadastros incompletos</span>
        <strong className="patients-summary__value">{incompleteCount}</strong>
        <span className="patients-summary__hint">
          <Badge tone={incompleteCount ? "warning" : "success"}>{incompleteCount ? "Atenção" : "Em dia"}</Badge>
        </span>
      </div>

      <div className="patients-summary__item">
        <span className="patients-summary__label">Condições acompanhadas</span>
        <strong className="patients-summary__value">{chronicCount}</strong>
        <span className="patients-summary__hint">dados clínicos ativos</span>
      </div>
    </div>
  );
}
