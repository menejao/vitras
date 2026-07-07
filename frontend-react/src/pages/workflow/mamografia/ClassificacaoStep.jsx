import { RadioGroup, CheckboxGroup, FieldLabel } from "../shared.jsx";

const BIRADS_OPTS = [
  { value: "0", label: "BI-RADS 0 — Inconclusivo" },
  { value: "1", label: "BI-RADS 1 — Sem achados" },
  { value: "2", label: "BI-RADS 2 — Achados benignos" },
  { value: "3", label: "BI-RADS 3 — Achados provavelmente benignos" },
  { value: "4", label: "BI-RADS 4 — Achados suspeitos de malignidade" },
  { value: "5", label: "BI-RADS 5 — Achados altamente suspeitos de malignidade" },
  { value: "6", label: "BI-RADS 6 — Diagnóstico de câncer comprovado histologicamente" },
];

const BIRADS_COLORS = {
  "0": "var(--text-muted)",
  "1": "var(--success, #16a34a)",
  "2": "var(--success, #16a34a)",
  "3": "var(--warning, #f59e0b)",
  "4": "#f97316",
  "5": "var(--danger, #dc2626)",
  "6": "#7c3aed",
};

const PROBLEMAS_OPTS = [
  { value: "asma", label: "Asma" },
  { value: "desnutricao", label: "Desnutrição" },
  { value: "diabetes", label: "Diabetes" },
  { value: "dpoc", label: "DPOC" },
  { value: "hipertensao", label: "Hipertensão arterial" },
  { value: "obesidade", label: "Obesidade" },
  { value: "pre_natal", label: "Pré-natal" },
  { value: "puericultura", label: "Puericultura" },
  { value: "puerperio", label: "Puerpério (até 30 dias)" },
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

export default function ClassificacaoStep({ data, onChange }) {
  function set(field, val) { onChange({ ...data, [field]: val }); }

  const birads = data.birads;
  const biradsCor = BIRADS_COLORS[birads];

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Classificação Radiológica — BI-RADS</div>

        <div className="pap-field">
          <FieldLabel required>BI-RADS</FieldLabel>
          <div className="pap-field__opts" style={{ flexDirection: "column", gap: "var(--s-2)" }}>
            {BIRADS_OPTS.map(opt => {
              const cor = BIRADS_COLORS[opt.value];
              const ativo = birads === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`pap-opt${ativo ? " is-active" : ""}`}
                  style={ativo ? { borderColor: cor, background: cor + "15", color: cor, fontWeight: 700 } : {}}
                >
                  <input type="radio" name="birads" value={opt.value} checked={ativo} onChange={() => set("birads", opt.value)} />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>

        {birads && (
          <div className="wf-risco-badge" style={{ borderLeftColor: biradsCor, color: biradsCor }}>
            <strong>BI-RADS {birads}</strong> — {BIRADS_OPTS.find(o => o.value === birads)?.label.split(" — ")[1]}
            {["4", "5", "6"].includes(birads) && (
              <div style={{ marginTop: "var(--s-1)", fontWeight: 400 }}>
                Recomenda-se encaminhamento para avaliação especializada.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Ultrassonografia</div>
        <RadioGroup
          label="Apresentou resultado de ultrassonografia das mamas nesta consulta?"
          name="ultrassonografia"
          value={data.ultrassonografia || ""}
          onChange={set}
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
          ]}
        />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Problema / Condição Avaliada</div>
        <CheckboxGroup
          label="Condições avaliadas"
          name="problemasCondicoes"
          value={data.problemasCondicoes || []}
          onChange={set}
          options={PROBLEMAS_OPTS}
        />
      </div>
    </div>
  );
}
