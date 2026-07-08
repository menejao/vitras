import { useState, useEffect, useRef } from "react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Textarea from "../components/ui/Textarea";
import { RadioGroup, CheckboxGroup, FieldLabel } from "./workflow/shared.jsx";
import { api } from "../api.js";
import { buildPreNatalRecord, EMPTY_PRE_NATAL } from "./workflow/prenatal/preNatalWorkflow.js";

/* ── Opções ─────────────────────────────────────────────────────── */

const LOCAL_OPTS = [
  { value: "ubs",                    label: "UBS" },
  { value: "unidade_movel",          label: "Unidade Móvel" },
  { value: "rua",                    label: "Rua" },
  { value: "domicilio",              label: "Domicílio" },
  { value: "escola_creche",          label: "Escola/Creche" },
  { value: "outros",                 label: "Outros" },
  { value: "polo_academia",          label: "Polo (Academia da Saúde)" },
  { value: "instituicao_abrigo",     label: "Instituição/Abrigo" },
  { value: "unidade_prisional",      label: "Unidade prisional ou congêneres" },
  { value: "unidade_socioeducativa", label: "Unidade socioeducativa" },
];

const TIPO_ATENDIMENTO_OPTS = [
  { value: "consulta_agendada_programada",   label: "Consulta agendada programada / cuidado continuado" },
  { value: "consulta_agendada",              label: "Consulta agendada" },
  { value: "consulta_no_dia",                label: "Consulta no dia" },
  { value: "escuta_inicial_orientacao",      label: "Escuta inicial / Orientação" },
  { value: "atendimento_urgencia",           label: "Atendimento urgência" },
  { value: "visita_domiciliar",              label: "Visita domiciliar" },
];

const CARATER_OPTS = [
  { value: "eletivo",  label: "Eletivo" },
  { value: "urgencia", label: "Urgência/Emergência" },
];

const LINHA_CUIDADO_OPTS = [
  { value: "saude_mulher",   label: "Saúde da Mulher" },
  { value: "pre_natal",      label: "Pré-natal" },
  { value: "crianca",        label: "Saúde da Criança" },
  { value: "idoso",          label: "Saúde do Idoso" },
  { value: "doenca_cronica", label: "Doenças Crônicas (Hiperdia)" },
  { value: "saude_mental",   label: "Saúde Mental" },
  { value: "dst_ist",        label: "DST/IST" },
  { value: "outra",          label: "Outra" },
];

const SIM_NAO_OPTS = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
];

const SIM_NAO_NA_OPTS = [
  { value: "sim",          label: "Sim" },
  { value: "nao",          label: "Não" },
  { value: "nao_avaliado", label: "Não avaliado" },
];

const EXAME_OPCOES = [
  { value: "solicitado", label: "Solicitado" },
  { value: "avaliado",   label: "Avaliado" },
  { value: "ambos",      label: "Ambos" },
];

const SITUACAO_FAMILIAR_OPTS = [
  { value: "com_companheiro",    label: "Com companheiro(a)" },
  { value: "sem_companheiro",    label: "Sem companheiro(a)" },
  { value: "com_familia",        label: "Com família" },
  { value: "sozinha",            label: "Sozinha" },
  { value: "outros",             label: "Outros" },
];

const CICLO_MENSTRUAL_OPTS = [
  { value: "regular",   label: "Regular" },
  { value: "irregular", label: "Irregular" },
];

const TIPO_DUM_OPTS = [
  { value: "certa",   label: "Certa" },
  { value: "incerta", label: "Incerta" },
];

const TIPO_GRAVIDEZ_OPTS = [
  { value: "unica",   label: "Única" },
  { value: "gemelar", label: "Gemelar" },
  { value: "tripla",  label: "Tripla ou mais" },
];

const ODONTO_OPTS = [
  { value: "realizado",          label: "Realizado" },
  { value: "agendado",           label: "Agendado" },
  { value: "nao_realizado",      label: "Não realizado" },
  { value: "nao_avaliado",       label: "Não avaliado" },
];

const ANTECEDENTES_FAMILIARES_OPTS = [
  { value: "diabetes",             label: "Diabetes" },
  { value: "hipertensao",          label: "Hipertensão arterial" },
  { value: "cardiopatia",          label: "Cardiopatia" },
  { value: "gemelar",              label: "Gestação gemelar" },
  { value: "malformacao",          label: "Malformação congênita" },
  { value: "tuberculose",          label: "Tuberculose" },
  { value: "doenca_mental",        label: "Doença mental" },
  { value: "pre_eclampsia",        label: "Pré-eclâmpsia / Eclâmpsia" },
  { value: "outros",               label: "Outros" },
];

const ANTECEDENTES_PESSOAIS_OPTS = [
  { value: "cirurgia_pelvica",     label: "Cirurgia pélvica/abdominal anterior" },
  { value: "hipertensao",          label: "Hipertensão arterial" },
  { value: "diabetes",             label: "Diabetes" },
  { value: "doenca_renal",         label: "Doença renal" },
  { value: "cardiopatia",          label: "Cardiopatia" },
  { value: "epilepsia",            label: "Epilepsia" },
  { value: "anemia",               label: "Anemia" },
  { value: "malaria",              label: "Malária" },
  { value: "tuberculose",          label: "Tuberculose" },
  { value: "hiv",                  label: "HIV/AIDS" },
  { value: "ist",                  label: "IST/DST" },
  { value: "depressao",            label: "Depressão / doença mental" },
  { value: "doenca_autoimune",     label: "Doença autoimune" },
  { value: "doenca_tireoide",      label: "Doença da tireoide" },
  { value: "outros",               label: "Outros" },
];

const RISCOS_GRAVIDICOS_OPTS = [
  { value: "adolescente",          label: "Adolescente (< 16 anos)" },
  { value: "maior_35",             label: "Maior de 35 anos" },
  { value: "baixa_estatura",       label: "Baixa estatura (< 1,45 m)" },
  { value: "diabetes_pre",         label: "Diabetes pré-gestacional" },
  { value: "hipertensao_cronica",  label: "Hipertensão arterial crônica" },
  { value: "nefropatia",           label: "Nefropatia" },
  { value: "cardiopatia",          label: "Cardiopatia" },
  { value: "epilepsia",            label: "Epilepsia" },
  { value: "infeccao_urinaria",    label: "Infecção urinária de repetição" },
  { value: "anemia_grave",         label: "Anemia grave" },
  { value: "hiv",                  label: "HIV positivo" },
  { value: "sifilis",              label: "Sífilis" },
  { value: "isoimunizacao_rh",     label: "Isoimunização Rh" },
  { value: "gravidez_gemelar",     label: "Gravidez gemelar" },
  { value: "malformacao_fetal",    label: "Malformação fetal confirmada" },
  { value: "obito_fetal_anterior", label: "Óbito fetal anterior" },
  { value: "pre_eclampsia_anterior", label: "Pré-eclâmpsia/eclâmpsia anterior" },
  { value: "dpg",                  label: "Desnutrição proteico-calórica grave" },
  { value: "outros",               label: "Outros fatores" },
];

const EXAMES_PRENATAL = [
  { key: "hemoglobina_glicada", label: "Hemoglobina glicada (HbA1c)" },
  { key: "vdrl",                label: "VDRL (Sífilis)" },
  { key: "hiv",                 label: "HIV" },
  { key: "curva_glicemica",     label: "Curva glicêmica" },
  { key: "abo",                 label: "ABO" },
  { key: "rh",                  label: "Rh" },
  { key: "urina_i",             label: "Urina I (EAS/EQU)" },
  { key: "urocultura",          label: "Urocultura" },
  { key: "glicemia",            label: "Glicemia" },
  { key: "hb",                  label: "Hb (Hemoglobina)" },
  { key: "ht",                  label: "Ht (Hematócrito)" },
  { key: "hbsag",               label: "HBsAg (Hepatite B)" },
  { key: "igm_toxo",            label: "IgM Toxoplasmose" },
  { key: "usg_obstetrica",      label: "Ultrassonografia Obstétrica" },
  { key: "outros_exames",       label: "Outros exames" },
];

const CONDUTA_OPTS = [
  { value: "retorno_agendado",       label: "Retorno para consulta agendada" },
  { value: "cuidado_continuado",     label: "Retorno para cuidado continuado/programado" },
  { value: "agendamento_grupos",     label: "Agendamento para grupos" },
  { value: "agendamento_emulti",     label: "Agendamento para eMulti" },
  { value: "alta_episodio",          label: "Alta do episódio" },
  { value: "encaminhamento_interno", label: "Encaminhamento interno no dia" },
  { value: "especializado",          label: "Encaminhamento para serviço especializado" },
  { value: "caps",                   label: "Encaminhamento para CAPS" },
  { value: "internacao_hospitalar",  label: "Encaminhamento para internação hospitalar" },
  { value: "urgencia",               label: "Encaminhamento para urgência" },
  { value: "atencao_domiciliar",     label: "Encaminhamento para serviço de atenção domiciliar" },
  { value: "intersetorial",          label: "Encaminhamento intersetorial" },
];

const ENC_INTERNO_OPTS = [
  { value: "medico",       label: "Médico(a)" },
  { value: "odontologia",  label: "Odontologia" },
  { value: "nutricao",     label: "Nutrição" },
  { value: "psicologia",   label: "Psicologia" },
  { value: "assistencia",  label: "Assistência Social" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "educacao_fisica", label: "Educação Física" },
  { value: "farmacia",     label: "Farmácia" },
];

/* ── Helpers ─────────────────────────────────────────────────────── */

function calcIMC(peso, altura) {
  const p = parseFloat(String(peso || "").replace(",", "."));
  const a = parseFloat(String(altura || "").replace(",", "."));
  if (!p || !a || a <= 0) return "";
  return (p / (a * a)).toFixed(1);
}

function imcLabel(v) {
  const n = parseFloat(v);
  if (!n) return "";
  if (n < 18.5) return "Baixo peso";
  if (n < 25)   return "Eutrófica";
  if (n < 30)   return "Sobrepeso";
  if (n < 35)   return "Obesidade grau I";
  if (n < 40)   return "Obesidade grau II";
  return "Obesidade grau III";
}

function calcDPP(dumStr) {
  if (!dumStr) return "";
  const d = new Date(dumStr + "T00:00:00");
  if (isNaN(d)) return "";
  d.setDate(d.getDate() + 280);
  return d.toISOString().slice(0, 10);
}

function calcIG(dumStr) {
  if (!dumStr) return { semanas: "", dias: "" };
  const dum  = new Date(dumStr + "T00:00:00");
  const hoje = new Date();
  if (isNaN(dum)) return { semanas: "", dias: "" };
  const diff  = Math.floor((hoje - dum) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { semanas: "", dias: "" };
  return { semanas: String(Math.floor(diff / 7)), dias: String(diff % 7) };
}

/* ── Componente ─────────────────────────────────────────────────── */

export default function PreNatalForm({ patient, user, token, onRecordSaved }) {
  function makeEmpty() {
    const today = new Date().toISOString().slice(0, 10);
    const now   = new Date().toTimeString().slice(0, 5);
    return {
      ...EMPTY_PRE_NATAL,
      atendimento: { ...EMPTY_PRE_NATAL.atendimento, dataAtendimento: today, horaAtendimento: now },
    };
  }

  const [form, setForm]   = useState(makeEmpty);
  const [busy, setBusy]   = useState(false);
  const [err,  setErr]    = useState("");
  const [ok,   setOk]     = useState(false);

  const [procQ,       setProcQ]       = useState("");
  const [procResults, setProcResults] = useState([]);
  const [procLoading, setProcLoading] = useState(false);
  const procDebounce = useRef(null);

  /* IMC auto */
  useEffect(() => {
    const imc = calcIMC(form.exameFisico.peso, form.exameFisico.altura);
    if (imc !== (form.exameFisico.imc || "")) {
      setForm(prev => ({ ...prev, exameFisico: { ...prev.exameFisico, imc } }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.exameFisico.peso, form.exameFisico.altura]);

  /* DPP + IG auto ao alterar DUM */
  useEffect(() => {
    const dum = form.acompanhamento.dum;
    if (!dum) return;
    const dpp = calcDPP(dum);
    const ig  = calcIG(dum);
    setForm(prev => ({
      ...prev,
      acompanhamento: {
        ...prev.acompanhamento,
        dpp:      dpp,
        igSemanas: ig.semanas,
        igDias:    ig.dias,
      },
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.acompanhamento.dum]);

  function sec(section, field, val) {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: val } }));
    setErr(""); setOk(false);
  }

  function secNested(section, sub, field, val) {
    setForm(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [sub]: { ...prev[section][sub], [field]: val },
      },
    }));
    setErr(""); setOk(false);
  }

  function setExame(key, val) {
    setForm(prev => ({ ...prev, exames: { ...prev.exames, [key]: val } }));
    setErr(""); setOk(false);
  }

  function searchProc(q) {
    setProcQ(q);
    if (q.trim().length < 2) { setProcResults([]); return; }
    clearTimeout(procDebounce.current);
    procDebounce.current = setTimeout(async () => {
      setProcLoading(true);
      try {
        const res = await api(`/catalog/items?q=${encodeURIComponent(q.trim())}&domain=procedure`, {}, token);
        setProcResults(res.data || []);
      } catch { setProcResults([]); }
      finally  { setProcLoading(false); }
    }, 300);
  }

  function addProc(item) {
    const cur = (form.conduta.procedimentos || {}).itens || [];
    if (cur.some(i => i.code === item.code)) { setProcQ(""); setProcResults([]); return; }
    setForm(prev => ({
      ...prev,
      conduta: {
        ...prev.conduta,
        procedimentos: { itens: [...cur, { code: item.code, name: item.name, category: item.category }] },
      },
    }));
    setProcQ(""); setProcResults([]);
  }

  function removeProc(code) {
    const cur = (form.conduta.procedimentos || {}).itens || [];
    setForm(prev => ({
      ...prev,
      conduta: { ...prev.conduta, procedimentos: { itens: cur.filter(i => i.code !== code) } },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk(false);
    try {
      const record = buildPreNatalRecord(form, patient);
      await api(`/patients/${patient.id}/records`, { method: "POST", body: JSON.stringify(record) }, token);
      setOk(true);
      setForm(makeEmpty());
      onRecordSaved?.();
    } catch (ex) {
      setErr(ex?.message || "Erro ao salvar atendimento.");
    } finally {
      setBusy(false);
    }
  }

  const imc       = form.exameFisico.imc || calcIMC(form.exameFisico.peso, form.exameFisico.altura);
  const procItens = (form.conduta.procedimentos || {}).itens || [];
  const encAtivo  = (form.conduta.orientacoes || []).includes("encaminhamento_interno");

  return (
    <form className="pap-form" onSubmit={handleSubmit}>

      {/* ── IDENTIFICAÇÃO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Identificação do Atendimento</div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel required>Data do atendimento</FieldLabel>
            <Input type="date" value={form.atendimento.dataAtendimento} onChange={e => sec("atendimento", "dataAtendimento", e.target.value)} style={{ maxWidth: 200 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Hora</FieldLabel>
            <Input type="time" value={form.atendimento.horaAtendimento} onChange={e => sec("atendimento", "horaAtendimento", e.target.value)} style={{ maxWidth: 140 }} />
          </div>
        </div>
        <RadioGroup
          label="Caráter do atendimento"
          name="carater"
          options={CARATER_OPTS}
          value={form.atendimento.carater}
          onChange={(_, v) => sec("atendimento", "carater", v)}
        />
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Linha de cuidado</FieldLabel>
            <Select value={form.atendimento.linhaCuidado} onChange={e => sec("atendimento", "linhaCuidado", e.target.value)} placeholder="Selecione">
              {LINHA_CUIDADO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div className="pap-field">
            <FieldLabel>Local de atendimento</FieldLabel>
            <Select value={form.atendimento.localAtendimento} onChange={e => sec("atendimento", "localAtendimento", e.target.value)}>
              {LOCAL_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        </div>
        <div className="pap-field">
          <FieldLabel>Tipo de atendimento e-SUS</FieldLabel>
          <Select value={form.atendimento.tipoAtendimento} onChange={e => sec("atendimento", "tipoAtendimento", e.target.value)} placeholder="Selecione">
            {TIPO_ATENDIMENTO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      </div>

      {/* ── PROBLEMA / CONDIÇÃO AVALIADA ── */}
      <div className="pap-section">
        <div className="pap-section__title">Problema / Condição Avaliada</div>
        <div className="pap-field">
          <div className="pap-field__opts">
            <div className="pap-opt pap-opt--active">
              <span>Pré-natal</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── PRIMEIRA CONSULTA ── */}
      <div className="pap-section">
        <div className="pap-section__title">Primeira Consulta</div>
        <div className="pap-field">
          <FieldLabel>Situação familiar</FieldLabel>
          <Select value={form.primeiraConsulta.situacaoFamiliar} onChange={e => sec("primeiraConsulta", "situacaoFamiliar", e.target.value)} placeholder="Selecione">
            {SITUACAO_FAMILIAR_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        <RadioGroup
          label="Trabalha fora de casa"
          name="trabalhaFora"
          options={SIM_NAO_OPTS}
          value={form.primeiraConsulta.trabalhaForaDeCasa}
          onChange={(_, v) => sec("primeiraConsulta", "trabalhaForaDeCasa", v)}
        />
        <div className="pap-field">
          <FieldLabel>Ocupação</FieldLabel>
          <Input value={form.primeiraConsulta.ocupacao} onChange={e => sec("primeiraConsulta", "ocupacao", e.target.value)} placeholder="Informe a ocupação" />
        </div>
        <RadioGroup
          label="Realiza esforço físico intenso"
          name="esforcoFisico"
          options={SIM_NAO_OPTS}
          value={form.primeiraConsulta.realizaEsforcoFisico}
          onChange={(_, v) => sec("primeiraConsulta", "realizaEsforcoFisico", v)}
        />
        <RadioGroup
          label="Contato com produtos químicos"
          name="contatoQuimicos"
          options={SIM_NAO_OPTS}
          value={form.primeiraConsulta.contatoProdutosQuimicos}
          onChange={(_, v) => sec("primeiraConsulta", "contatoProdutosQuimicos", v)}
        />
      </div>

      {/* ── ANTECEDENTES FAMILIARES ── */}
      <div className="pap-section">
        <div className="pap-section__title">Antecedentes Familiares</div>
        <CheckboxGroup
          name="antFamiliares"
          options={ANTECEDENTES_FAMILIARES_OPTS}
          value={form.antecedentes.familiares}
          onChange={(_, vals) => setForm(prev => ({ ...prev, antecedentes: { ...prev.antecedentes, familiares: vals } }))}
        />
      </div>

      {/* ── ANTECEDENTES PESSOAIS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Antecedentes Pessoais</div>
        <CheckboxGroup
          name="antPessoais"
          options={ANTECEDENTES_PESSOAIS_OPTS}
          value={form.antecedentes.pessoais}
          onChange={(_, vals) => setForm(prev => ({ ...prev, antecedentes: { ...prev.antecedentes, pessoais: vals } }))}
        />
      </div>

      {/* ── ANTECEDENTES GINECOLÓGICOS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Antecedentes Ginecológicos</div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Menarca (idade)</FieldLabel>
            <Input type="number" min="8" max="20" value={form.antecedentes.ginecologicos.menarca} onChange={e => secNested("antecedentes", "ginecologicos", "menarca", e.target.value)} style={{ maxWidth: 100 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Início da atividade sexual (idade)</FieldLabel>
            <Input type="number" min="10" max="60" value={form.antecedentes.ginecologicos.inicioAtividadeSexual} onChange={e => secNested("antecedentes", "ginecologicos", "inicioAtividadeSexual", e.target.value)} style={{ maxWidth: 100 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Nº de parceiros sexuais</FieldLabel>
            <Input type="number" min="0" value={form.antecedentes.ginecologicos.numeroParceiros} onChange={e => secNested("antecedentes", "ginecologicos", "numeroParceiros", e.target.value)} style={{ maxWidth: 100 }} />
          </div>
        </div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Ciclo menstrual</FieldLabel>
            <Select value={form.antecedentes.ginecologicos.cicloMenstrual} onChange={e => secNested("antecedentes", "ginecologicos", "cicloMenstrual", e.target.value)} placeholder="Selecione">
              {CICLO_MENSTRUAL_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div className="pap-field">
            <FieldLabel>Regularidade (dias)</FieldLabel>
            <Input type="number" min="21" max="45" value={form.antecedentes.ginecologicos.regularidade} onChange={e => secNested("antecedentes", "ginecologicos", "regularidade", e.target.value)} style={{ maxWidth: 100 }} />
          </div>
        </div>
        <RadioGroup
          label="Dismenorreia"
          name="dismenorreia"
          options={SIM_NAO_OPTS}
          value={form.antecedentes.ginecologicos.dismenorreia}
          onChange={(_, v) => secNested("antecedentes", "ginecologicos", "dismenorreia", v)}
        />
        <div className="pap-field">
          <FieldLabel>Métodos anticoncepcionais utilizados</FieldLabel>
          <Input value={form.antecedentes.ginecologicos.metodosAnticoncepcionais} onChange={e => secNested("antecedentes", "ginecologicos", "metodosAnticoncepcionais", e.target.value)} placeholder="Ex.: ACO, DIU, preservativo..." />
        </div>
      </div>

      {/* ── ANTECEDENTES OBSTÉTRICOS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Antecedentes Obstétricos</div>
        <div className="pap-row">
          {[
            ["gestacoes",       "Gestações"],
            ["ectopicas",       "Ectópicas"],
            ["gemelares",       "Gemelares"],
            ["partos",          "Partos"],
            ["vaginais",        "Vaginais"],
            ["cesareos",        "Cesáreos"],
            ["abortos",         "Abortos"],
            ["filhosVivos",     "Filhos vivos"],
            ["natimortos",      "Natimortos"],
            ["filhosVivosAtuais", "Filhos vivos (atual)"],
          ].map(([key, label]) => (
            <div className="pap-field" key={key}>
              <FieldLabel>{label}</FieldLabel>
              <Input type="number" min="0" value={form.antecedentes.obstetricos[key]} onChange={e => secNested("antecedentes", "obstetricos", key, e.target.value)} style={{ maxWidth: 80 }} />
            </div>
          ))}
        </div>
        <RadioGroup
          label="Amamentou"
          name="amamentou"
          options={SIM_NAO_OPTS}
          value={form.antecedentes.obstetricos.amamentou}
          onChange={(_, v) => secNested("antecedentes", "obstetricos", "amamentou", v)}
        />
        {form.antecedentes.obstetricos.amamentou === "nao" && (
          <div className="pap-field">
            <FieldLabel>Motivo de não amamentar</FieldLabel>
            <Input value={form.antecedentes.obstetricos.motivoNaoAmamentou} onChange={e => secNested("antecedentes", "obstetricos", "motivoNaoAmamentou", e.target.value)} />
          </div>
        )}
        <RadioGroup
          label="Pretende amamentar"
          name="pretendeAmamentar"
          options={SIM_NAO_OPTS}
          value={form.antecedentes.obstetricos.pretendeAmamentar}
          onChange={(_, v) => secNested("antecedentes", "obstetricos", "pretendeAmamentar", v)}
        />
      </div>

      {/* ── CONDIÇÃO VACINAL ── */}
      <div className="pap-section">
        <div className="pap-section__title">Condição Vacinal</div>
        <RadioGroup label="DTPa (difteria, tétano, coqueluche)" name="dtpa" options={SIM_NAO_NA_OPTS} value={form.condicaoVacinal.dtpa} onChange={(_, v) => sec("condicaoVacinal", "dtpa", v)} />
        <RadioGroup label="Hepatite B" name="hepatiteB" options={SIM_NAO_NA_OPTS} value={form.condicaoVacinal.hepatiteB} onChange={(_, v) => sec("condicaoVacinal", "hepatiteB", v)} />
        <RadioGroup label="Gripe (Influenza)" name="gripe" options={SIM_NAO_NA_OPTS} value={form.condicaoVacinal.gripe} onChange={(_, v) => sec("condicaoVacinal", "gripe", v)} />
        <RadioGroup label="COVID-19" name="covid19" options={SIM_NAO_NA_OPTS} value={form.condicaoVacinal.covid19} onChange={(_, v) => sec("condicaoVacinal", "covid19", v)} />
      </div>

      {/* ── RISCOS GRAVÍDICOS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Avaliação de Riscos Gravídicos</div>
        <CheckboxGroup
          name="riscos"
          options={RISCOS_GRAVIDICOS_OPTS}
          value={form.riscos.fatores}
          onChange={(_, vals) => setForm(prev => ({ ...prev, riscos: { ...prev.riscos, fatores: vals } }))}
        />
      </div>

      {/* ── CONSULTA DE ACOMPANHAMENTO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Consulta de Acompanhamento</div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Tipo de gravidez</FieldLabel>
            <Select value={form.acompanhamento.tipoGravidez} onChange={e => sec("acompanhamento", "tipoGravidez", e.target.value)} placeholder="Selecione">
              {TIPO_GRAVIDEZ_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <RadioGroup
            label="Gravidez planejada"
            name="gravidezPlanejada"
            options={SIM_NAO_OPTS}
            value={form.acompanhamento.gravidezPlanejada}
            onChange={(_, v) => sec("acompanhamento", "gravidezPlanejada", v)}
          />
        </div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel required>DUM (Data da Última Menstruação)</FieldLabel>
            <Input type="date" value={form.acompanhamento.dum} onChange={e => sec("acompanhamento", "dum", e.target.value)} style={{ maxWidth: 200 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Tipo da DUM</FieldLabel>
            <Select value={form.acompanhamento.tipoDum} onChange={e => sec("acompanhamento", "tipoDum", e.target.value)} placeholder="Selecione">
              {TIPO_DUM_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        </div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>DPP (Data Provável do Parto)</FieldLabel>
            <Input type="date" value={form.acompanhamento.dpp} onChange={e => sec("acompanhamento", "dpp", e.target.value)} style={{ maxWidth: 200 }} />
            {form.acompanhamento.dum && (
              <span style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                Calculado pela DUM: {calcDPP(form.acompanhamento.dum) || "—"}
              </span>
            )}
          </div>
          <div className="pap-field">
            <FieldLabel>IG (semanas)</FieldLabel>
            <Input type="number" min="0" max="44" value={form.acompanhamento.igSemanas} onChange={e => sec("acompanhamento", "igSemanas", e.target.value)} style={{ maxWidth: 100 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>IG (dias)</FieldLabel>
            <Input type="number" min="0" max="6" value={form.acompanhamento.igDias} onChange={e => sec("acompanhamento", "igDias", e.target.value)} style={{ maxWidth: 80 }} />
          </div>
        </div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Ultrassonografia (semanas)</FieldLabel>
            <Input type="number" min="0" max="44" value={form.acompanhamento.ultrassonografia} onChange={e => sec("acompanhamento", "ultrassonografia", e.target.value)} style={{ maxWidth: 100 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Data da ultrassonografia</FieldLabel>
            <Input type="date" value={form.acompanhamento.dataUltrassonografia} onChange={e => sec("acompanhamento", "dataUltrassonografia", e.target.value)} style={{ maxWidth: 200 }} />
          </div>
        </div>
      </div>

      {/* ── EXAME FÍSICO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Exame Físico</div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Peso (kg)</FieldLabel>
            <Input type="number" step="0.1" min="30" max="200" value={form.exameFisico.peso} onChange={e => sec("exameFisico", "peso", e.target.value)} style={{ maxWidth: 120 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Altura (m)</FieldLabel>
            <Input type="number" step="0.01" min="1.0" max="2.5" value={form.exameFisico.altura} onChange={e => sec("exameFisico", "altura", e.target.value)} style={{ maxWidth: 120 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>IMC</FieldLabel>
            <div style={{ paddingTop: 8, fontWeight: 600, color: "var(--text)" }}>
              {imc ? `${imc} — ${imcLabel(imc)}` : "—"}
            </div>
          </div>
        </div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Pressão arterial (mmHg)</FieldLabel>
            <Input value={form.exameFisico.pressaoArterial} onChange={e => sec("exameFisico", "pressaoArterial", e.target.value)} placeholder="Ex.: 120/80" style={{ maxWidth: 140 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Altura uterina (cm)</FieldLabel>
            <Input type="number" min="0" max="50" step="0.5" value={form.exameFisico.alturaUterina} onChange={e => sec("exameFisico", "alturaUterina", e.target.value)} style={{ maxWidth: 120 }} />
          </div>
        </div>
        <div className="pap-row">
          <RadioGroup
            label="Movimentação fetal"
            name="movFetal"
            options={SIM_NAO_NA_OPTS}
            value={form.exameFisico.movimentacaoFetal}
            onChange={(_, v) => sec("exameFisico", "movimentacaoFetal", v)}
          />
          <div className="pap-field">
            <FieldLabel>BCF (batimento cardíaco fetal)</FieldLabel>
            <Input value={form.exameFisico.batimentoCardiacoFetal} onChange={e => sec("exameFisico", "batimentoCardiacoFetal", e.target.value)} placeholder="bpm ou ausente" style={{ maxWidth: 160 }} />
          </div>
        </div>
        <div className="pap-field">
          <FieldLabel>Observações do exame físico</FieldLabel>
          <Textarea value={form.exameFisico.observacoes} onChange={e => sec("exameFisico", "observacoes", e.target.value)} rows={3} />
        </div>
      </div>

      {/* ── EXAME CLÍNICO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Exame Clínico</div>
        <RadioGroup
          label="Exame clínico"
          name="exClinico"
          options={[{ value: "normal", label: "Normal" }, { value: "alterado", label: "Alterado" }]}
          value={form.exameClinico.normal}
          onChange={(_, v) => sec("exameClinico", "normal", v)}
        />
        <div className="pap-field">
          <FieldLabel>Observações</FieldLabel>
          <Textarea value={form.exameClinico.observacoes} onChange={e => sec("exameClinico", "observacoes", e.target.value)} rows={2} />
        </div>
      </div>

      {/* ── EXAME GINECOLÓGICO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Exame Ginecológico</div>
        <RadioGroup
          label="Exame ginecológico"
          name="exGineco"
          options={[{ value: "normal", label: "Normal" }, { value: "alterado", label: "Alterado" }]}
          value={form.exameGinecologico.normal}
          onChange={(_, v) => sec("exameGinecologico", "normal", v)}
        />
        <div className="pap-field">
          <FieldLabel>Observações</FieldLabel>
          <Textarea value={form.exameGinecologico.observacoes} onChange={e => sec("exameGinecologico", "observacoes", e.target.value)} rows={2} />
        </div>
      </div>

      {/* ── EXAME DAS MAMAS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Exame das Mamas</div>
        <RadioGroup
          label="Exame das mamas"
          name="exMamas"
          options={[{ value: "normal", label: "Normal" }, { value: "alterado", label: "Alterado" }]}
          value={form.exameMamas.normal}
          onChange={(_, v) => sec("exameMamas", "normal", v)}
        />
        <div className="pap-field">
          <FieldLabel>Observações</FieldLabel>
          <Textarea value={form.exameMamas.observacoes} onChange={e => sec("exameMamas", "observacoes", e.target.value)} rows={2} />
        </div>
      </div>

      {/* ── QUEIXAS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Queixas</div>
        <RadioGroup label="Hiperêmese" name="hiperemese" options={SIM_NAO_OPTS} value={form.queixas.hiperemese} onChange={(_, v) => sec("queixas", "hiperemese", v)} />
        <RadioGroup label="Dor em baixo ventre" name="dorBaixo" options={SIM_NAO_OPTS} value={form.queixas.dorBaixoVentre} onChange={(_, v) => sec("queixas", "dorBaixoVentre", v)} />
        <RadioGroup label="Alterações urinárias" name="altUrn" options={SIM_NAO_OPTS} value={form.queixas.alteracoesUrinarias} onChange={(_, v) => sec("queixas", "alteracoesUrinarias", v)} />
        <RadioGroup label="Sangramento" name="sangramento" options={SIM_NAO_OPTS} value={form.queixas.sangramento} onChange={(_, v) => sec("queixas", "sangramento", v)} />
        <RadioGroup label="Leucorreia" name="leucorreia" options={SIM_NAO_OPTS} value={form.queixas.leucorreia} onChange={(_, v) => sec("queixas", "leucorreia", v)} />
        <RadioGroup label="Problemas emocionais" name="probEmoc" options={SIM_NAO_OPTS} value={form.queixas.problemasEmocionais} onChange={(_, v) => sec("queixas", "problemasEmocionais", v)} />
        <div className="pap-field">
          <FieldLabel>Outras queixas</FieldLabel>
          <Input value={form.queixas.outrasQueixas} onChange={e => sec("queixas", "outrasQueixas", e.target.value)} />
        </div>
      </div>

      {/* ── EXAMES ── */}
      <div className="pap-section">
        <div className="pap-section__title">Exames Solicitados / Avaliados</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "var(--s-2) var(--s-3)", fontWeight: 600, fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>Exame</th>
                <th style={{ textAlign: "center", padding: "var(--s-2) var(--s-3)", fontWeight: 600, fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>Solicitado</th>
                <th style={{ textAlign: "center", padding: "var(--s-2) var(--s-3)", fontWeight: 600, fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>Avaliado</th>
                <th style={{ textAlign: "center", padding: "var(--s-2) var(--s-3)", fontWeight: 600, fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>Ambos</th>
              </tr>
            </thead>
            <tbody>
              {EXAMES_PRENATAL.map(({ key, label }) => (
                <tr key={key} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "var(--s-2) var(--s-3)", fontSize: "var(--t-sm)", color: "var(--text)" }}>{label}</td>
                  {EXAME_OPCOES.map(opt => (
                    <td key={opt.value} style={{ textAlign: "center", padding: "var(--s-2) var(--s-3)" }}>
                      <input
                        type="radio"
                        name={`exame_${key}`}
                        value={opt.value}
                        checked={form.exames[key] === opt.value}
                        onChange={() => setExame(key, opt.value)}
                        style={{ accentColor: "var(--primary)" }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pap-field" style={{ marginTop: "var(--s-4)" }}>
          <FieldLabel>Resultado dos exames</FieldLabel>
          <Textarea value={form.exames.resultado} onChange={e => setExame("resultado", e.target.value)} rows={3} placeholder="Descreva resultados relevantes..." />
        </div>
      </div>

      {/* ── SUPLEMENTAÇÃO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Suplementação</div>
        <RadioGroup label="Sulfato ferroso" name="sulfatoFerroso" options={SIM_NAO_OPTS} value={form.suplementacao.sulfatoFerroso} onChange={(_, v) => sec("suplementacao", "sulfatoFerroso", v)} />
        <RadioGroup label="Ácido fólico" name="acidoFolico" options={SIM_NAO_OPTS} value={form.suplementacao.acidoFolico} onChange={(_, v) => sec("suplementacao", "acidoFolico", v)} />
        <div className="pap-field">
          <FieldLabel>Outros suplementos</FieldLabel>
          <Input value={form.suplementacao.outros} onChange={e => sec("suplementacao", "outros", e.target.value)} />
        </div>
      </div>

      {/* ── AVALIAÇÕES ODONTOLÓGICAS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Avaliações Odontológicas</div>
        <RadioGroup label="1º trimestre" name="odonto1" options={ODONTO_OPTS} value={form.odontologicas.primeiro_trimestre} onChange={(_, v) => sec("odontologicas", "primeiro_trimestre", v)} />
        <RadioGroup label="2º trimestre" name="odonto2" options={ODONTO_OPTS} value={form.odontologicas.segundo_trimestre} onChange={(_, v) => sec("odontologicas", "segundo_trimestre", v)} />
        <RadioGroup label="3º trimestre" name="odonto3" options={ODONTO_OPTS} value={form.odontologicas.terceiro_trimestre} onChange={(_, v) => sec("odontologicas", "terceiro_trimestre", v)} />
      </div>

      {/* ── OBSERVAÇÃO E eMulti ── */}
      <div className="pap-section">
        <div className="pap-section__title">Observação e eMulti</div>
        <RadioGroup
          label="Ficou em observação"
          name="ficouObs"
          options={SIM_NAO_OPTS}
          value={form.emulti.ficouObservacao}
          onChange={(_, v) => sec("emulti", "ficouObservacao", v)}
        />
        <div className="pap-field">
          <FieldLabel>Avaliação / Diagnóstico</FieldLabel>
          <Textarea value={form.emulti.avaliacaoDiagnostico} onChange={e => sec("emulti", "avaliacaoDiagnostico", e.target.value)} rows={3} />
        </div>
        <div className="pap-field">
          <FieldLabel>Procedimentos clínicos terapêuticos</FieldLabel>
          <Textarea value={form.emulti.procedimentosTerapeuticos} onChange={e => sec("emulti", "procedimentosTerapeuticos", e.target.value)} rows={2} />
        </div>
        <div className="pap-field">
          <FieldLabel>Prescrição terapêutica</FieldLabel>
          <Textarea value={form.emulti.prescricaoTerapeutica} onChange={e => sec("emulti", "prescricaoTerapeutica", e.target.value)} rows={2} />
        </div>
      </div>

      {/* ── CONDUTA / DESFECHO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Conduta / Desfecho</div>
        <CheckboxGroup
          label="Condutas e orientações"
          name="conduta"
          options={CONDUTA_OPTS}
          value={form.conduta.orientacoes}
          onChange={(_, vals) => setForm(prev => ({ ...prev, conduta: { ...prev.conduta, orientacoes: vals } }))}
        />
        {encAtivo && (
          <div className="pap-field">
            <FieldLabel>Encaminhamento interno — destino</FieldLabel>
            <Select value={form.conduta.encaminhamentoInterno} onChange={e => sec("conduta", "encaminhamentoInterno", e.target.value)} placeholder="Selecione o destino">
              {ENC_INTERNO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        )}
      </div>

      {/* ── PROCEDIMENTOS SIGTAP ── */}
      <div className="pap-section">
        <div className="pap-section__title">Procedimentos (SIGTAP)</div>
        <div className="pap-field">
          <FieldLabel>Buscar procedimento</FieldLabel>
          <div style={{ position: "relative" }}>
            <Input
              value={procQ}
              onChange={e => searchProc(e.target.value)}
              placeholder="Digite para buscar (mínimo 2 caracteres)"
            />
            {procLoading && (
              <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>Buscando…</div>
            )}
            {procResults.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-xs)", maxHeight: 220, overflowY: "auto" }}>
                {procResults.map(item => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => addProc(item)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "var(--s-2) var(--s-3)", background: "none", border: "none", cursor: "pointer", fontSize: "var(--t-sm)", color: "var(--text)", borderBottom: "1px solid var(--border-subtle)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <strong>{item.code}</strong> — {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {procItens.length > 0 && (
          <div style={{ marginTop: "var(--s-3)", display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
            {procItens.map(item => (
              <div key={item.code} style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", padding: "var(--s-2) var(--s-3)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "var(--t-sm)" }}>
                <span style={{ flex: 1 }}><strong>{item.code}</strong> — {item.name}</span>
                <button type="button" onClick={() => removeProc(item.code)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "var(--t-sm)", padding: 0 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── AÇÕES ── */}
      <div className="pap-section pap-section--actions">
        {err && <p className="form-error" role="alert">{err}</p>}
        {ok  && <p className="form-success" role="status">Atendimento salvo com sucesso.</p>}
        <div style={{ display: "flex", gap: "var(--s-3)", justifyContent: "flex-end" }}>
          <Button type="button" variant="ghost" onClick={() => { setForm(makeEmpty()); setErr(""); setOk(false); }}>
            Limpar
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Salvando…" : "Salvar atendimento"}
          </Button>
        </div>
      </div>

    </form>
  );
}
