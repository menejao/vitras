import Textarea from "../../../components/ui/Textarea";
import { RadioGroup, CheckboxGroup, FieldLabel } from "../shared.jsx";

const RISCO_OPTS = [
  { value: "nao_aguda", label: "Não aguda" },
  { value: "aguda_baixa", label: "Aguda / Baixa" },
  { value: "aguda_intermediaria", label: "Aguda / Intermediária" },
  { value: "aguda_alta", label: "Aguda / Alta" },
];

const CONDUTA_OPTS = [
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

const RISCO_COLORS = {
  nao_aguda: "var(--success, #16a34a)",
  aguda_baixa: "var(--warning, #f59e0b)",
  aguda_intermediaria: "#f97316",
  aguda_alta: "var(--danger, #dc2626)",
};

export default function ClassificacaoCondutaStep({ data, onChange }) {
  function set(field, val) {
    onChange({ ...data, [field]: val });
  }

  const riscoCor = RISCO_COLORS[data.classificacaoRisco] || null;

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Classificação de Risco / Vulnerabilidade</div>

        <div className="pap-field__hint" style={{ marginBottom: "var(--s-3)" }}>
          A classificação de risco alimenta alertas e indicadores operacionais do paciente.
        </div>

        <div className="pap-field">
          <FieldLabel required>Classificação</FieldLabel>
          <div className="pap-field__opts">
            {RISCO_OPTS.map(opt => {
              const cor = RISCO_COLORS[opt.value];
              const ativo = data.classificacaoRisco === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`pap-opt${ativo ? " is-active" : ""}`}
                  style={ativo ? { borderColor: cor, background: cor + "18", color: cor, fontWeight: 700 } : {}}
                >
                  <input
                    type="radio"
                    name="classificacaoRisco"
                    value={opt.value}
                    checked={ativo}
                    onChange={() => set("classificacaoRisco", opt.value)}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>

        {data.classificacaoRisco && (
          <div
            className="wf-risco-badge"
            style={{ borderLeftColor: riscoCor, color: riscoCor }}
          >
            <strong>Risco classificado:</strong>{" "}
            {RISCO_OPTS.find(o => o.value === data.classificacaoRisco)?.label}
            {data.classificacaoRisco.startsWith("aguda_") && (
              <span> — este paciente deve ser monitorado com prioridade.</span>
            )}
          </div>
        )}
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Conduta / Desfecho</div>

        <CheckboxGroup
          label="Condutas adotadas (selecione uma ou mais)"
          name="condutaDesfecho"
          value={data.condutaDesfecho || []}
          onChange={set}
          options={CONDUTA_OPTS}
        />

        <div className="pap-field">
          <FieldLabel>Observações</FieldLabel>
          <Textarea
            value={data.observacoes || ""}
            onChange={e => set("observacoes", e.target.value)}
            placeholder="Observações sobre a conduta ou encaminhamentos..."
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}
