import Input from "../../../components/ui/Input";
import { RadioGroup, FieldLabel } from "../shared.jsx";

const CARATER_OPTS = [
  { value: "demanda_espontanea", label: "Demanda Espontânea" },
  { value: "urgencia", label: "Urgência/Emergência" },
];

const LINHA_CUIDADO_OPTS = [
  { value: "saude_mulher", label: "Saúde da Mulher" },
  { value: "crianca", label: "Saúde da Criança" },
  { value: "idoso", label: "Saúde do Idoso" },
  { value: "doenca_cronica", label: "Doenças Crônicas (Hiperdia)" },
  { value: "saude_mental", label: "Saúde Mental" },
  { value: "saude_bucal", label: "Saúde Bucal" },
  { value: "pre_natal", label: "Pré-natal" },
  { value: "dst_ist", label: "DST/IST" },
  { value: "reabilitacao", label: "Reabilitação" },
  { value: "outra", label: "Outra" },
];

const LOCAL_OPTS = [
  { value: "ubs", label: "UBS" },
  { value: "unidade_movel", label: "Unidade Móvel" },
  { value: "rua", label: "Rua" },
  { value: "domicilio", label: "Domicílio" },
  { value: "escola_creche", label: "Escola/Creche" },
  { value: "polo_academia", label: "Polo/Academia da Saúde" },
  { value: "instituicao_abrigo", label: "Instituição/Abrigo" },
  { value: "unidade_prisional", label: "Unidade Prisional ou congêneres" },
  { value: "unidade_socioeducativa", label: "Unidade Socioeducativa" },
  { value: "outros", label: "Outros" },
];

export default function AcolhimentoAtendimentoStep({ data, onChange, users }) {
  function set(field, val) {
    onChange({ ...data, [field]: val });
  }

  const clinicians = (users || []).filter(u =>
    ["nurse_manager", "nursing_tech", "doctor", "dentist"].includes(u.role)
  );

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Identificação do Atendimento</div>

        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel required>Data do atendimento</FieldLabel>
            <Input
              type="date"
              value={data.dataAtendimento || ""}
              onChange={e => set("dataAtendimento", e.target.value)}
              style={{ maxWidth: 200 }}
            />
          </div>
          <div className="pap-field">
            <FieldLabel>Hora</FieldLabel>
            <Input
              type="time"
              value={data.horaAtendimento || ""}
              onChange={e => set("horaAtendimento", e.target.value)}
              style={{ maxWidth: 140 }}
            />
          </div>
        </div>

        <RadioGroup
          label="Caráter do atendimento"
          name="carater"
          value={data.carater || "demanda_espontanea"}
          onChange={set}
          options={CARATER_OPTS}
        />

        <RadioGroup
          label="Linha de cuidado"
          name="linhaCuidado"
          value={data.linhaCuidado || ""}
          onChange={set}
          options={LINHA_CUIDADO_OPTS}
        />

        <div className="pap-field">
          <FieldLabel>Tipo de atendimento</FieldLabel>
          <div className="pap-procedure-code">
            <span style={{ fontWeight: 600, color: "var(--primary)" }}>Demanda Espontânea — Escuta Inicial / Orientação</span>
          </div>
          <div className="muted small">Fixo para acolhimento. Não pode ser alterado.</div>
        </div>
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Local de Atendimento</div>

        <RadioGroup
          label="Local"
          name="localAtendimento"
          value={data.localAtendimento || "ubs"}
          onChange={set}
          options={LOCAL_OPTS}
        />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Profissional</div>

        <div className="pap-field">
          <FieldLabel required>Profissional responsável</FieldLabel>
          <select
            className="select"
            value={data.profissionalId || ""}
            onChange={e => set("profissionalId", e.target.value)}
            style={{ maxWidth: 400 }}
          >
            <option value="">Selecionar profissional...</option>
            {clinicians.map(u => (
              <option key={u.id} value={u.id}>{u.name || u.username}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
