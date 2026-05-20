import EmptyState from "../ui/EmptyState";

export default function PatientEmptyState() {
  return (
    <EmptyState
      title="Nenhum paciente encontrado"
      description="Ajuste a busca ou os filtros para localizar um cadastro ativo."
    />
  );
}
