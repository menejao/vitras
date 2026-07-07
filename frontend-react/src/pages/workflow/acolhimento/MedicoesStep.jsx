import { useEffect } from "react";
import Input from "../../../components/ui/Input";
import { RadioGroup, FieldLabel } from "../shared.jsx";

const MOMENTO_GLICEMIA_OPTS = [
  { value: "jejum", label: "Jejum" },
  { value: "pos_prandial", label: "Pós-prandial (2h após refeição)" },
  { value: "pre_prandial", label: "Pré-prandial" },
  { value: "casual", label: "Casual (horário não definido)" },
];

function calcIMC(peso, altura) {
  const p = parseFloat(String(peso).replace(",", "."));
  const a = parseFloat(String(altura).replace(",", "."));
  if (!p || !a || a <= 0) return "";
  const imc = p / (a * a);
  return imc.toFixed(1);
}

export default function MedicoesStep({ data, onChange }) {
  function set(field, val) {
    onChange({ ...data, [field]: val });
  }

  useEffect(() => {
    const imc = calcIMC(data.peso, data.altura);
    if (imc !== (data.imc || "")) {
      onChange({ ...data, imc });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.peso, data.altura]);

  const imc = data.imc || calcIMC(data.peso, data.altura);
  const imcLabel = (() => {
    const v = parseFloat(imc);
    if (!v) return "";
    if (v < 18.5) return "Baixo peso";
    if (v < 25) return "Eutrófico";
    if (v < 30) return "Sobrepeso";
    if (v < 35) return "Obesidade grau I";
    if (v < 40) return "Obesidade grau II";
    return "Obesidade grau III";
  })();

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Antropometria</div>

        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Peso (kg)</FieldLabel>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="300"
              value={data.peso || ""}
              onChange={e => set("peso", e.target.value)}
              placeholder="Ex: 70.5"
              style={{ maxWidth: 120 }}
            />
          </div>
          <div className="pap-field">
            <FieldLabel>Altura (m)</FieldLabel>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="3"
              value={data.altura || ""}
              onChange={e => set("altura", e.target.value)}
              placeholder="Ex: 1.70"
              style={{ maxWidth: 120 }}
            />
          </div>
          {imc && (
            <div className="pap-field">
              <FieldLabel>IMC (calculado)</FieldLabel>
              <div className="wf-imc-badge">
                <span className="pap-code">{imc}</span>
                {imcLabel && <span className="muted small"> — {imcLabel}</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Sinais Vitais</div>

        <RadioGroup
          label="Houve aferição de pressão arterial?"
          name="afericaoPA"
          value={data.afericaoPA || ""}
          onChange={set}
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
          ]}
        />

        {data.afericaoPA === "sim" && (
          <div className="pap-field">
            <FieldLabel>Pressão arterial (mmHg)</FieldLabel>
            <Input
              value={data.pressaoArterial || ""}
              onChange={e => set("pressaoArterial", e.target.value)}
              placeholder="Ex: 120/80"
              style={{ maxWidth: 160 }}
            />
          </div>
        )}

        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Frequência cardíaca (bpm)</FieldLabel>
            <Input
              type="number"
              min="0"
              max="300"
              value={data.frequenciaCardiaca || ""}
              onChange={e => set("frequenciaCardiaca", e.target.value)}
              placeholder="Ex: 72"
              style={{ maxWidth: 120 }}
            />
          </div>
          <div className="pap-field">
            <FieldLabel>Frequência respiratória (irpm)</FieldLabel>
            <Input
              type="number"
              min="0"
              max="100"
              value={data.frequenciaRespiratoria || ""}
              onChange={e => set("frequenciaRespiratoria", e.target.value)}
              placeholder="Ex: 16"
              style={{ maxWidth: 120 }}
            />
          </div>
          <div className="pap-field">
            <FieldLabel>Temperatura (°C)</FieldLabel>
            <Input
              type="number"
              step="0.1"
              min="30"
              max="45"
              value={data.temperatura || ""}
              onChange={e => set("temperatura", e.target.value)}
              placeholder="Ex: 36.5"
              style={{ maxWidth: 120 }}
            />
          </div>
          <div className="pap-field">
            <FieldLabel>Saturação O₂ (%)</FieldLabel>
            <Input
              type="number"
              min="0"
              max="100"
              value={data.saturacaoO2 || ""}
              onChange={e => set("saturacaoO2", e.target.value)}
              placeholder="Ex: 98"
              style={{ maxWidth: 120 }}
            />
          </div>
        </div>
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Glicemia</div>

        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Glicemia capilar (mg/dL)</FieldLabel>
            <Input
              type="number"
              min="0"
              max="1000"
              value={data.glicemiaCapilar || ""}
              onChange={e => set("glicemiaCapilar", e.target.value)}
              placeholder="Ex: 95"
              style={{ maxWidth: 140 }}
            />
          </div>
        </div>

        {data.glicemiaCapilar && (
          <RadioGroup
            label="Momento da coleta"
            name="momentoGlicemia"
            value={data.momentoGlicemia || ""}
            onChange={set}
            options={MOMENTO_GLICEMIA_OPTS}
          />
        )}
      </div>
    </div>
  );
}
