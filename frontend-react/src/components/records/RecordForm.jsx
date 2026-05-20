import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Textarea from "../ui/Textarea";

export default function RecordForm({ form, setForm, onSubmit, busy, error, onCancel }) {
  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="field-grid">
        <Select label="Tipo" value={form.type} onChange={(event) => setForm((state) => ({ ...state, type: event.target.value }))}>
          <option value="consultation">Consulta</option>
          <option value="visit">Visita</option>
          <option value="note">Anotação</option>
          <option value="exam">Exame</option>
          <option value="vaccine">Vacina</option>
          <option value="task">Tarefa</option>
        </Select>
        <Input label="Data" type="date" value={form.date} onChange={(event) => setForm((state) => ({ ...state, date: event.target.value }))} />
        <Input label="Hora" type="time" value={form.time} onChange={(event) => setForm((state) => ({ ...state, time: event.target.value }))} />
        <Input className="field--span-2" label="Título" value={form.title} onChange={(event) => setForm((state) => ({ ...state, title: event.target.value }))} />
        <Textarea className="field--span-2" label="Detalhes" rows={6} value={form.details} onChange={(event) => setForm((state) => ({ ...state, details: event.target.value }))} />
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="modal__footer">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Salvando..." : "Salvar registro"}</Button>
      </div>
    </form>
  );
}
