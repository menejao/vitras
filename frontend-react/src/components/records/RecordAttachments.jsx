import EmptyState from "../ui/EmptyState";

export default function RecordAttachments({ attachments }) {
  if (!attachments || attachments.length === 0) {
    return <EmptyState title="Sem anexos" description="Este registro não possui anexos associados." compact />;
  }

  return (
    <ul className="record-attachments">
      {attachments.map((attachment) => (
        <li key={attachment.id || attachment.name} className="record-attachments__item">
          <span>{attachment.name || "Anexo"}</span>
        </li>
      ))}
    </ul>
  );
}
