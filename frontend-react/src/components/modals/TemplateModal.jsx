import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";

function TemplateModal({ open, editingTemplate, templateForm, setTemplateForm, error, busy, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <Modal title={editingTemplate ? "Editar protocolo" : "Novo protocolo"} onClose={onClose}>
      <form className="form template-modal-form" onSubmit={onSubmit}>
        <Input
          label="Categoria (chave)"
          value={templateForm.category}
          disabled={Boolean(editingTemplate)}
          onChange={(e) => setTemplateForm((s) => ({ ...s, category: e.target.value }))}
        />
        <Input
          label="Nome de exibição"
          value={templateForm.label}
          onChange={(e) => setTemplateForm((s) => ({ ...s, label: e.target.value }))}
        />

        <div className="template-modal__grid">
          <Input label="Visitas alvo" type="number" min="0" value={templateForm.visits} onChange={(e) => setTemplateForm((s) => ({ ...s, visits: Number(e.target.value || 0) }))} />
          <Input label="Consultas alvo" type="number" min="0" value={templateForm.consultations} onChange={(e) => setTemplateForm((s) => ({ ...s, consultations: Number(e.target.value || 0) }))} />
          <Input label="Vacinas alvo" type="number" min="0" value={templateForm.vaccines} onChange={(e) => setTemplateForm((s) => ({ ...s, vaccines: Number(e.target.value || 0) }))} />
          <Input label="Prazo visitas (d)" type="number" min="0" value={templateForm.deadlinesVisits} onChange={(e) => setTemplateForm((s) => ({ ...s, deadlinesVisits: Number(e.target.value || 0) }))} />
          <Input label="Prazo consultas (d)" type="number" min="0" value={templateForm.deadlinesConsultations} onChange={(e) => setTemplateForm((s) => ({ ...s, deadlinesConsultations: Number(e.target.value || 0) }))} />
          <Input label="Prazo vacinas (d)" type="number" min="0" value={templateForm.deadlinesVaccines} onChange={(e) => setTemplateForm((s) => ({ ...s, deadlinesVaccines: Number(e.target.value || 0) }))} />
        </div>

        <Textarea label="Lista de vacinas" value={templateForm.vaccineList} onChange={(e) => setTemplateForm((s) => ({ ...s, vaccineList: e.target.value }))} />

        {error ? <p className="error">{error}</p> : null}

        <div className="modal__footer">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default TemplateModal;
