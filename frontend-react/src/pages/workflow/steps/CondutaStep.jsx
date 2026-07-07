import Input from "../../../components/ui/Input";
import Textarea from "../../../components/ui/Textarea";
import { RadioGroup, CheckboxGroup, FieldLabel } from "../shared.jsx";

const RETORNO_OPTS = [
  { value: "sem_retorno", label: "Sem retorno necessário" },
  { value: "retornar_se_necessario", label: "Retornar se necessário" },
  { value: "agendamento_retorno", label: "Agendamento de retorno" },
  { value: "alta", label: "Alta" },
];

const ENCAMINHAMENTO_OPTS = [
  { value: "especializado", label: "Encaminhamento especializado" },
  { value: "caps", label: "CAPS" },
  { value: "hospital", label: "Hospital" },
  { value: "urgencia", label: "Urgência" },
  { value: "atencao_domiciliar", label: "Atenção domiciliar" },
  { value: "cuidado_continuado", label: "Cuidado continuado" },
  { value: "intersetorial", label: "Encaminhamento intersetorial" },
];

export default function CondutaStep({ data, onChange }) {
  function set(field, val) {
    onChange({ ...data, [field]: val });
  }

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Conduta</div>

        <div className="pap-field">
          <FieldLabel>Orientações fornecidas</FieldLabel>
          <Textarea
            value={data.orientacoes || ""}
            onChange={e => set("orientacoes", e.target.value)}
            placeholder="Descreva as orientações fornecidas ao paciente..."
            rows={3}
          />
        </div>

        <RadioGroup
          label="Retorno"
          name="retorno"
          value={data.retorno || ""}
          onChange={set}
          options={RETORNO_OPTS}
        />

        {data.retorno === "agendamento_retorno" && (
          <div className="pap-field">
            <FieldLabel>Prazo de retorno (dias)</FieldLabel>
            <Input
              type="number"
              min="1"
              max="365"
              value={data.retornoDias || ""}
              onChange={e => set("retornoDias", e.target.value)}
              placeholder="Ex: 30"
              style={{ maxWidth: 160 }}
            />
          </div>
        )}

        <CheckboxGroup
          label="Encaminhamentos"
          name="encaminhamentos"
          value={data.encaminhamentos || []}
          onChange={set}
          options={ENCAMINHAMENTO_OPTS}
        />

        <div className="pap-field">
          <FieldLabel>Observações</FieldLabel>
          <Textarea
            value={data.observacoes || ""}
            onChange={e => set("observacoes", e.target.value)}
            placeholder="Observações sobre a conduta..."
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}
