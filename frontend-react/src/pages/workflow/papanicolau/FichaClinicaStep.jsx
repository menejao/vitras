import Input from "../../../components/ui/Input";
import Textarea from "../../../components/ui/Textarea";
import { RadioGroup, FieldLabel } from "../shared.jsx";

const SIM_NAO_NAOSABE = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "nao_sabe", label: "Não sabe" },
];

export default function FichaClinicaStep({ data, onChange }) {
  function set(field, val) {
    onChange({ ...data, [field]: val });
  }

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Anamnese</div>

        <RadioGroup
          label="1. Motivo do exame"
          name="motivoExame"
          value={data.motivoExame || ""}
          onChange={set}
          required
          options={[
            { value: "rastreamento", label: "Rastreamento" },
            { value: "repeticao", label: "Repetição (ASCUS/Baixo grau)" },
            { value: "seguimento", label: "Seguimento (pós colposcopia/tratamento)" },
          ]}
        />

        <RadioGroup
          label="2. Fez exame preventivo anteriormente?"
          name="fezePreventivo"
          value={data.fezePreventivo || ""}
          onChange={set}
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
          ]}
        />

        {data.fezePreventivo === "sim" && (
          <RadioGroup
            label="Última coleta"
            name="ultimaColeta"
            value={data.ultimaColeta || ""}
            onChange={set}
            options={[
              { value: "1_ano", label: "Há 1 ano" },
              { value: "2_anos", label: "Há 2 anos" },
              { value: "3_anos", label: "Há 3 anos" },
              { value: "mais_3_anos", label: "Há mais de 3 anos" },
            ]}
          />
        )}

        <RadioGroup
          label="3. Usa DIU?"
          name="usaDiu"
          value={data.usaDiu || ""}
          onChange={set}
          options={SIM_NAO_NAOSABE}
        />

        <RadioGroup
          label="4. Está grávida?"
          name="estaGravida"
          value={data.estaGravida || ""}
          onChange={set}
          options={SIM_NAO_NAOSABE}
        />

        <RadioGroup
          label="5. Usa anticoncepcional?"
          name="usaAnticoncepcional"
          value={data.usaAnticoncepcional || ""}
          onChange={set}
          options={SIM_NAO_NAOSABE}
        />

        <RadioGroup
          label="6. Usa hormônio para menopausa?"
          name="hormonioPosMenuopausa"
          value={data.hormonioPosMenuopausa || ""}
          onChange={set}
          options={SIM_NAO_NAOSABE}
        />

        <RadioGroup
          label="7. Já realizou radioterapia?"
          name="realizouRadioterapia"
          value={data.realizouRadioterapia || ""}
          onChange={set}
          options={SIM_NAO_NAOSABE}
        />

        <RadioGroup
          label="8. Sangramento após relação sexual?"
          name="sangramentoAposRelacao"
          value={data.sangramentoAposRelacao || ""}
          onChange={set}
          hint="ATENÇÃO: NÃO CONSIDERAR A PRIMEIRA RELAÇÃO SEXUAL NA VIDA."
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
            { value: "nao_sabe", label: "Não sabe / Não lembra" },
          ]}
        />

        <RadioGroup
          label="9. Sangramento após menopausa?"
          name="sangramentoPosMenuopausa"
          value={data.sangramentoPosMenuopausa || ""}
          onChange={set}
          hint="ATENÇÃO: NÃO CONSIDERAR SANGRAMENTOS DURANTE REPOSIÇÃO HORMONAL."
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
            { value: "nao_sabe", label: "Não sabe / Não lembra" },
            { value: "nao_menopausa", label: "Não está na menopausa" },
          ]}
        />

        <div className="pap-field">
          <FieldLabel>DUM (Data da Última Menstruação)</FieldLabel>
          <Input
            type="date"
            value={data.dum || ""}
            onChange={e => set("dum", e.target.value)}
            style={{ maxWidth: 200 }}
          />
        </div>
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Exame Clínico</div>

        <RadioGroup
          label="10. Inspeção do colo"
          name="inspecaoColo"
          value={data.inspecaoColo || ""}
          onChange={set}
          options={[
            { value: "normal", label: "Normal" },
            { value: "ausente", label: "Ausente" },
            { value: "alterado", label: "Alterado" },
            { value: "nao_visualizado", label: "Colo não visualizado" },
          ]}
        />

        <RadioGroup
          label="11. Sinais sugestivos de IST?"
          name="sinaisIst"
          value={data.sinaisIst || ""}
          onChange={set}
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
          ]}
        />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Observações</div>
        <div className="pap-field">
          <label className={`pap-opt${data.siscan ? " is-active" : ""}`} style={{ display: "inline-flex" }}>
            <input type="checkbox" checked={!!data.siscan} onChange={e => set("siscan", e.target.checked)} />
            Registrado no SISCAN
          </label>
        </div>
        <div className="pap-field">
          <FieldLabel>Observações clínicas</FieldLabel>
          <Textarea
            value={data.observacoes || ""}
            onChange={e => set("observacoes", e.target.value)}
            placeholder="Observações clínicas relevantes..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
