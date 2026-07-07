import Input from "../../../components/ui/Input";
import Textarea from "../../../components/ui/Textarea";
import { RadioGroup, CheckboxGroup, FieldLabel } from "../shared.jsx";

const ADEQUABILIDADE_OPTS = [
  { value: "satisfatoria", label: "Satisfatória" },
  { value: "insatisfatoria", label: "Insatisfatória" },
  { value: "esfregaco_normal", label: "Esfregaço normal" },
];

const EPITELIO_OPTS = [
  { value: "escamosas", label: "Escamosas" },
  { value: "metaplasicas", label: "Metaplásicas" },
  { value: "glandulares", label: "Glandulares" },
  { value: "colunares", label: "Colunares" },
  { value: "endometrial", label: "Endometrial" },
  { value: "outros", label: "Outros" },
];

const DIAGNOSTICO_OPTS = [
  { value: "normalidade", label: "Dentro da normalidade" },
  { value: "alteracoes_benignas", label: "Alterações benignas de células" },
  { value: "atipias_celulares", label: "Atipias celulares" },
  { value: "outros", label: "Outros" },
];

const MICROBIOLOGIA_OPTS = [
  { value: "lactobacillus", label: "Lactobacillus sp" },
  { value: "gardnerella", label: "Gardnerella/Mobiluncus" },
  { value: "bacilos", label: "Bacilos (cocobacilos)" },
  { value: "cocos", label: "Cocos" },
  { value: "candida", label: "Candida sp" },
  { value: "trichomonas", label: "Trichomonas vaginalis" },
  { value: "chlamydia", label: "Chlamydia sp" },
  { value: "actinomyces", label: "Actinomyces sp" },
  { value: "herpes", label: "Herpes vírus" },
  { value: "outros", label: "Outros" },
];

const TIPO_AMOSTRA_OPTS = [
  { value: "convencional", label: "Convencional" },
  { value: "meio_liquido", label: "Meio líquido" },
];

export default function ResultadoStep({ data, onChange }) {
  function set(field, val) {
    onChange({ ...data, [field]: val });
  }

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Resultado Citopatológico</div>
        <div className="pap-field__hint" style={{ marginBottom: "var(--s-3)" }}>
          Preencha após o recebimento do laudo. Pode ser deixado em branco e preenchido posteriormente.
        </div>

        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Data da coleta (laudo)</FieldLabel>
            <Input
              type="date"
              value={data.dataColeta || ""}
              onChange={e => set("dataColeta", e.target.value)}
              style={{ maxWidth: 200 }}
            />
          </div>
          <div className="pap-field">
            <FieldLabel>Número do pedido</FieldLabel>
            <Input
              value={data.numeroPedido || ""}
              onChange={e => set("numeroPedido", e.target.value)}
              placeholder="Ex: 2026/001234"
              style={{ maxWidth: 220 }}
            />
          </div>
          <div className="pap-field">
            <FieldLabel>RA</FieldLabel>
            <Input
              value={data.ra || ""}
              onChange={e => set("ra", e.target.value)}
              placeholder="Nº RA"
              style={{ maxWidth: 160 }}
            />
          </div>
        </div>

        <RadioGroup
          label="Tipo de amostra"
          name="tipoAmostra"
          value={data.tipoAmostra || ""}
          onChange={set}
          options={TIPO_AMOSTRA_OPTS}
        />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Adequabilidade da Amostra</div>

        <RadioGroup
          label="Adequabilidade"
          name="adequabilidade"
          value={data.adequabilidade || ""}
          onChange={set}
          options={ADEQUABILIDADE_OPTS}
        />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Epitélios Representados</div>

        <CheckboxGroup
          label="Epitélios"
          name="epitelios"
          value={data.epitelios || []}
          onChange={set}
          options={EPITELIO_OPTS}
        />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Diagnóstico Descritivo</div>

        <RadioGroup
          label="Diagnóstico descritivo"
          name="diagnosticoDescritivo"
          value={data.diagnosticoDescritivo || ""}
          onChange={set}
          options={DIAGNOSTICO_OPTS}
        />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Microbiologia</div>

        <CheckboxGroup
          label="Microorganismos identificados"
          name="microbiologia"
          value={data.microbiologia || []}
          onChange={set}
          options={MICROBIOLOGIA_OPTS}
        />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Observações do Laudo</div>
        <div className="pap-field">
          <FieldLabel>Observações</FieldLabel>
          <Textarea
            value={data.observacoes || ""}
            onChange={e => set("observacoes", e.target.value)}
            placeholder="Observações do laudo citopatológico..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
