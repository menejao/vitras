import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import RecordAttachments from "./RecordAttachments";

export default function RecordCard({ record, fmtDate, onDelete, canDelete }) {
  return (
    <Card className="record-card">
      <div className="record-card__head">
        <div>
          <Badge tone="info">{record.type || "registro"}</Badge>
          <h3>{record.title || "Registro clínico"}</h3>
          <p>{fmtDate(record.date)} {record.time ? `· ${record.time}` : ""}</p>
        </div>
        {canDelete ? <Button variant="ghost" size="sm" onClick={() => onDelete(record.id)}>Excluir</Button> : null}
      </div>
      {record.details ? <p className="record-card__details">{record.details}</p> : null}
      {record.professionalName ? <p className="record-card__meta">Profissional: {record.professionalName}</p> : null}
      <RecordAttachments attachments={record.attachments} />
    </Card>
  );
}
