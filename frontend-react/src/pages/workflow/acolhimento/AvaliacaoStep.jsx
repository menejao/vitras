import Textarea from "../../../components/ui/Textarea";
import { CheckboxGroup, FieldLabel } from "../shared.jsx";

const PROBLEMAS_OPTS = [
  { value: "asma", label: "Asma" },
  { value: "desnutricao", label: "Desnutrição" },
  { value: "diabetes", label: "Diabetes" },
  { value: "dpoc", label: "DPOC" },
  { value: "hipertensao", label: "Hipertensão arterial" },
  { value: "obesidade", label: "Obesidade" },
  { value: "pre_natal", label: "Pré-natal" },
  { value: "puericultura", label: "Puericultura" },
  { value: "puerperio", label: "Puerpério até 30 dias" },
  { value: "saude_sexual_reprodutiva", label: "Saúde sexual e reprodutiva" },
  { value: "tabagismo", label: "Tabagismo" },
  { value: "alcool", label: "Usuário de álcool" },
  { value: "outras_drogas", label: "Usuário de outras drogas" },
  { value: "saude_mental", label: "Saúde mental" },
  { value: "reabilitacao", label: "Reabilitação" },
  { value: "tuberculose", label: "Tuberculose" },
  { value: "hanseniase", label: "Hanseníase" },
  { value: "dengue", label: "Dengue" },
  { value: "dst", label: "DST" },
  { value: "rastreamento_colo_utero", label: "Rastreamento de câncer do colo do útero" },
  { value: "rastreamento_mama", label: "Rastreamento de câncer de mama" },
  { value: "rastreamento_cardiovascular", label: "Rastreamento de risco cardiovascular" },
  { value: "outros", label: "Outros" },
];

export default function AvaliacaoStep({ data, onChange }) {
  function set(field, val) {
    onChange({ ...data, [field]: val });
  }

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Motivo da Consulta</div>

        <div className="pap-field">
          <FieldLabel required>Motivo da consulta</FieldLabel>
          <Textarea
            value={data.motivoConsulta || ""}
            onChange={e => set("motivoConsulta", e.target.value)}
            placeholder="Descreva o motivo da consulta / queixa principal..."
            rows={3}
          />
        </div>
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Problema / Condição Avaliada</div>

        <CheckboxGroup
          label="Selecione os problemas/condições avaliadas"
          name="problemasCondicoes"
          value={data.problemasCondicoes || []}
          onChange={set}
          options={PROBLEMAS_OPTS}
        />
      </div>
    </div>
  );
}
