import Input from "../../../components/ui/Input";
import { RadioGroup, FieldLabel } from "../shared.jsx";

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

const TIPO_OPTS = [
  { value: "agendada_programada", label: "Consulta Agendada Programada / Cuidado Continuado" },
  { value: "agendada", label: "Consulta Agendada" },
  { value: "demanda_espontanea_dia", label: "Demanda Espontânea / Consulta no Dia" },
  { value: "demanda_espontanea_urgencia", label: "Demanda Espontânea / Atendimento de Urgência" },
];

const CARATER_OPTS = [
  { value: "eletivo", label: "Eletivo" },
  { value: "urgencia", label: "Urgência/Emergência" },
];

const LINHA_OPTS = [
  { value: "saude_mulher", label: "Saúde da Mulher" },
  { value: "rastreamento_mama", label: "Rastreamento de Câncer de Mama" },
  { value: "doenca_cronica", label: "Doenças Crônicas" },
  { value: "idoso", label: "Saúde do Idoso" },
  { value: "outra", label: "Outra" },
];

export default function MamografiaIdentStep({ data, onChange, users }) {
  function set(field, val) { onChange({ ...data, [field]: val }); }

  const clinicians = (users || []).filter(u =>
    ["nurse_manager", "nursing_tech", "doctor"].includes(u.role)
  );

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Cabeçalho do Atendimento</div>

        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel required>Data do atendimento</FieldLabel>
            <Input type="date" value={data.dataAtendimento || ""} onChange={e => set("dataAtendimento", e.target.value)} style={{ maxWidth: 200 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Hora</FieldLabel>
            <Input type="time" value={data.horaAtendimento || ""} onChange={e => set("horaAtendimento", e.target.value)} style={{ maxWidth: 140 }} />
          </div>
        </div>

        <RadioGroup label="Caráter do atendimento" name="carater" value={data.carater || ""} onChange={set} options={CARATER_OPTS} />
        <RadioGroup label="Linha de cuidado" name="linhaCuidado" value={data.linhaCuidado || ""} onChange={set} options={LINHA_OPTS} />

        <div className="pap-field">
          <FieldLabel required>Profissional responsável</FieldLabel>
          <select className="select" value={data.profissionalId || ""} onChange={e => set("profissionalId", e.target.value)} style={{ maxWidth: 400 }}>
            <option value="">Selecionar profissional...</option>
            {clinicians.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
          </select>
        </div>
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Seção 1 — Identificação</div>

        <div className="pap-field">
          <FieldLabel>Data da coleta (mamografia)</FieldLabel>
          <Input type="date" value={data.dataColeta || ""} onChange={e => set("dataColeta", e.target.value)} style={{ maxWidth: 200 }} />
        </div>

        <RadioGroup label="Local de atendimento" name="localAtendimento" value={data.localAtendimento || "ubs"} onChange={set} options={LOCAL_OPTS} />
        <RadioGroup label="Tipo de atendimento (e-SUS)" name="tipoAtendimento" value={data.tipoAtendimento || ""} onChange={set} options={TIPO_OPTS} />
      </div>
    </div>
  );
}
