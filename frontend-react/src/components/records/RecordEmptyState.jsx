import EmptyState from "../ui/EmptyState";

export default function RecordEmptyState({ hasPatient }) {
  if (!hasPatient) {
    return <EmptyState title="Selecione um paciente" description="Escolha um paciente para consultar o prontuário eletrônico." />;
  }

  return <EmptyState title="Sem registros clínicos" description="Este paciente ainda não possui lançamentos no prontuário." />;
}
