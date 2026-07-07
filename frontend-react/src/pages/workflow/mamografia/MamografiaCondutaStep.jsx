import { useState } from "react";
import Textarea from "../../../components/ui/Textarea";
import Input from "../../../components/ui/Input";
import { CheckboxGroup, FieldLabel } from "../shared.jsx";

const DESFECHO_OPTS = [
  { value: "retorno_agendado", label: "Retorno para consulta agendada" },
  { value: "cuidado_continuado", label: "Retorno para cuidado continuado/programado" },
  { value: "agendamento_grupos", label: "Agendamento para grupos" },
  { value: "agendamento_emulti", label: "Agendamento para eMulti" },
  { value: "alta_episodio", label: "Alta do episódio" },
  { value: "encaminhamento_interno", label: "Encaminhamento interno no dia" },
  { value: "especializado", label: "Encaminhamento para serviço especializado" },
  { value: "caps", label: "Encaminhamento para CAPS" },
  { value: "internacao_hospitalar", label: "Encaminhamento para internação hospitalar" },
  { value: "urgencia", label: "Encaminhamento para urgência" },
  { value: "atencao_domiciliar", label: "Encaminhamento para serviço de atenção domiciliar" },
  { value: "intersetorial", label: "Encaminhamento intersetorial" },
];

export default function MamografiaCondutaStep({ data, onChange }) {
  function set(field, val) { onChange({ ...data, [field]: val }); }

  const temEncInterno = (data.desfecho || []).includes("encaminhamento_interno");

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Conduta / Orientação</div>
        <div className="pap-field">
          <FieldLabel>Orientações fornecidas</FieldLabel>
          <Textarea
            value={data.orientacao || ""}
            onChange={e => set("orientacao", e.target.value)}
            placeholder="Descreva as orientações, recomendações e condutas adotadas..."
            rows={5}
          />
        </div>
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Conduta / Desfecho</div>
        <CheckboxGroup
          label="Condutas adotadas (selecione uma ou mais)"
          name="desfecho"
          value={data.desfecho || []}
          onChange={set}
          options={DESFECHO_OPTS}
        />

        {temEncInterno && (
          <div className="pap-field">
            <FieldLabel>Destino do encaminhamento interno</FieldLabel>
            <Input
              value={data.encaminhamentoInternoDestino || ""}
              onChange={e => set("encaminhamentoInternoDestino", e.target.value)}
              placeholder="Ex: Médico de referência, Ginecologista, Mastologista..."
              style={{ maxWidth: 400 }}
            />
          </div>
        )}

        <div className="pap-field">
          <FieldLabel>Observações</FieldLabel>
          <Textarea
            value={data.observacoes || ""}
            onChange={e => set("observacoes", e.target.value)}
            placeholder="Observações adicionais sobre a conduta..."
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}
