import RecordCard from "./RecordCard";

export default function RecordTimeline({ records, fmtDate, onDelete, canDelete }) {
  return (
    <div className="records-timeline">
      {records.map((record) => (
        <RecordCard key={record.id} record={record} fmtDate={fmtDate} onDelete={onDelete} canDelete={canDelete} />
      ))}
    </div>
  );
}
