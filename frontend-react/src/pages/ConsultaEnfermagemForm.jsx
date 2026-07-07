import { useState, useEffect, useRef, useMemo } from "react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Textarea from "../components/ui/Textarea";
import { RadioGroup, CheckboxGroup, FieldLabel } from "./workflow/shared.jsx";
import { api } from "../api.js";
import { buildConsultaEnfermagemRecord, EMPTY_CONSULTA_ENFERMAGEM } from "./workflow/consulta/consultaEnfermagemWorkflow.js";

/* ── Opções ──────────────────────────────────────────────────────── */

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
  { value: "eletivo",   label: "Eletivo" },
  { value: "urgencia",  label: "Urgência/Emergência" },
];

const LINHA_CUIDADO_OPTS = [
  { value: "saude_mulher",     label: "Saúde da Mulher" },
  { value: "crianca",          label: "Saúde da Criança" },
  { value: "idoso",            label: "Saúde do Idoso" },
  { value: "doenca_cronica",   label: "Doenças Crônicas (Hiperdia)" },
  { value: "saude_mental",     label: "Saúde Mental" },
  { value: "saude_bucal",      label: "Saúde Bucal" },
  { value: "pre_natal",        label: "Pré-natal" },
  { value: "dst_ist",          label: "DST/IST" },
  { value: "outra",            label: "Outra" },
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

const DOR_OPTS = [
  { value: "0",  label: "0 — Sem dor" },
  { value: "1",  label: "1" },
  { value: "2",  label: "2" },
  { value: "3",  label: "3" },
  { value: "4",  label: "4" },
  { value: "5",  label: "5 — Moderada" },
  { value: "6",  label: "6" },
  { value: "7",  label: "7" },
  { value: "8",  label: "8" },
  { value: "9",  label: "9" },
  { value: "10", label: "10 — Insuportável" },
];

const MOMENTO_GLICEMIA_OPTS = [
  { value: "jejum",        label: "Jejum" },
  { value: "pos_prandial", label: "Pós-prandial (2h após refeição)" },
  { value: "pre_prandial", label: "Pré-prandial" },
  { value: "casual",       label: "Casual (horário não definido)" },
];

const EXAME_OPCOES = [
  { value: "solicitado", label: "Solicitado" },
  { value: "avaliado",   label: "Avaliado" },
  { value: "ambos",      label: "Ambos" },
];

const EXAMES_LIST = [
  { key: "hemoglobina_glicada",   label: "Hemoglobina glicada" },
  { key: "colesterol_total",      label: "Colesterol Total" },
  { key: "creatinina",            label: "Creatinina" },
  { key: "eas_equ",               label: "EAS / EQU" },
  { key: "eletrocardiograma",     label: "Eletrocardiograma" },
  { key: "eletroforese",          label: "Eletroforese" },
  { key: "espirometria",          label: "Espirometria" },
  { key: "escarro",               label: "Escarro" },
  { key: "glicemia",              label: "Glicemia" },
  { key: "hdl",                   label: "HDL" },
  { key: "hemograma",             label: "Hemograma" },
  { key: "ldl",                   label: "LDL" },
  { key: "retinografia",          label: "Retinografia" },
  { key: "oftalmologista",        label: "Oftalmologista" },
  { key: "sifilis_vdrl",          label: "Sorologia para Sífilis (VDRL)" },
  { key: "sorologia_dengue",      label: "Sorologia para Dengue" },
  { key: "sorologia_hiv",         label: "Sorologia para HIV" },
  { key: "tia",                   label: "Teste indireto de antiglobulina humana (TIA)" },
  { key: "teste_orelhinha",       label: "Teste da Orelhinha (EOA)" },
  { key: "teste_gravidez",        label: "Teste de Gravidez" },
  { key: "teste_pezinho",         label: "Teste do Pezinho" },
  { key: "usg_obstetrica",        label: "Ultrassonografia Obstétrica" },
  { key: "urocultura",            label: "Urocultura" },
];

const PROBLEMAS_OPTS = [
  { value: "asma",                      label: "Asma" },
  { value: "desnutricao",               label: "Desnutrição" },
  { value: "diabetes",                  label: "Diabetes" },
  { value: "dpoc",                      label: "DPOC" },
  { value: "hipertensao",               label: "Hipertensão arterial" },
  { value: "obesidade",                 label: "Obesidade" },
  { value: "pre_natal",                 label: "Pré-natal" },
  { value: "puericultura",              label: "Puericultura" },
  { value: "puerperio",                 label: "Puerpério (até 30 dias)" },
  { value: "saude_sexual_reprodutiva",  label: "Saúde sexual e reprodutiva" },
  { value: "tabagismo",                 label: "Tabagismo" },
  { value: "alcool",                    label: "Usuário de álcool" },
  { value: "outras_drogas",             label: "Usuário de outras drogas" },
  { value: "saude_mental",              label: "Saúde mental" },
  { value: "reabilitacao",              label: "Reabilitação" },
  { value: "tuberculose",               label: "Tuberculose" },
  { value: "hanseniase",                label: "Hanseníase" },
  { value: "dengue",                    label: "Dengue" },
  { value: "dst",                       label: "DST" },
  { value: "rastreamento_colo_utero",   label: "Rastreamento de câncer do colo do útero" },
  { value: "rastreamento_mama",         label: "Rastreamento de câncer de mama" },
  { value: "rastreamento_cardiovascular", label: "Rastreamento de risco cardiovascular" },
  { value: "outros",                    label: "OUTROS" },
];

const CONDUTA_OPTS = [
  { value: "retorno_agendado",      label: "Retorno para consulta agendada" },
  { value: "cuidado_continuado",    label: "Retorno para cuidado continuado/programado" },
  { value: "agendamento_grupos",    label: "Agendamento para grupos" },
  { value: "agendamento_emulti",    label: "Agendamento para eMulti" },
  { value: "alta_episodio",         label: "Alta do episódio" },
  { value: "encaminhamento_interno",label: "Encaminhamento interno no dia" },
  { value: "especializado",         label: "Encaminhamento para serviço especializado" },
  { value: "caps",                  label: "Encaminhamento para CAPS" },
  { value: "internacao_hospitalar", label: "Encaminhamento para internação hospitalar" },
  { value: "urgencia",              label: "Encaminhamento para urgência" },
  { value: "atencao_domiciliar",    label: "Encaminhamento para serviço de atenção domiciliar" },
  { value: "intersetorial",         label: "Encaminhamento intersetorial" },
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
  if (n < 25)   return "Eutrófico";
  if (n < 30)   return "Sobrepeso";
  if (n < 35)   return "Obesidade grau I";
  if (n < 40)   return "Obesidade grau II";
  return "Obesidade grau III";
}

/* ── Componente ──────────────────────────────────────────────────── */

export default function ConsultaEnfermagemForm({ patient, user, token, onRecordSaved }) {
  function makeEmpty() {
    const today = new Date().toISOString().slice(0, 10);
    const now   = new Date().toTimeString().slice(0, 5);
    return {
      ...EMPTY_CONSULTA_ENFERMAGEM,
      atendimento: { ...EMPTY_CONSULTA_ENFERMAGEM.atendimento, dataAtendimento: today, horaAtendimento: now },
    };
  }

  const [form, setForm] = useState(makeEmpty);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");
  const [ok,   setOk]   = useState(false);

  const [procQ,       setProcQ]       = useState("");
  const [procResults, setProcResults] = useState([]);
  const [procLoading, setProcLoading] = useState(false);
  const procDebounce = useRef(null);

  /* IMC auto */
  useEffect(() => {
    const imc = calcIMC(form.antropometria.peso, form.antropometria.altura);
    if (imc !== (form.antropometria.imc || "")) {
      setForm(prev => ({ ...prev, antropometria: { ...prev.antropometria, imc } }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.antropometria.peso, form.antropometria.altura]);

  function sec(section, field, val) {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: val } }));
    setErr(""); setOk(false);
  }

  function setExame(key, val) {
    setForm(prev => ({ ...prev, exames: { ...prev.exames, [key]: val } }));
    setErr(""); setOk(false);
  }

  function toggleProblema(val) {
    const cur  = form.avaliacao.problemasCondicoes || [];
    const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];
    setForm(prev => ({ ...prev, avaliacao: { ...prev.avaliacao, problemasCondicoes: next } }));
  }

  function toggleConduta(val) {
    const cur  = form.conduta.orientacoes || [];
    const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];
    setForm(prev => ({ ...prev, conduta: { ...prev.conduta, orientacoes: next } }));
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
      conduta: { ...prev.conduta, procedimentos: { itens: [...cur, { code: item.code, name: item.name, category: item.category }] } },
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
      const record = buildConsultaEnfermagemRecord(form, patient);
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

  const imc    = form.antropometria.imc || calcIMC(form.antropometria.peso, form.antropometria.altura);
  const procItens = (form.conduta.procedimentos || {}).itens || [];

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
          value={form.atendimento.carater}
          onChange={(_, v) => sec("atendimento", "carater", v)}
          options={CARATER_OPTS}
        />
        <RadioGroup
          label="Linha de cuidado"
          name="linhaCuidado"
          value={form.atendimento.linhaCuidado}
          onChange={(_, v) => sec("atendimento", "linhaCuidado", v)}
          options={LINHA_CUIDADO_OPTS}
        />
      </div>

      {/* ── LOCAL DE ATENDIMENTO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Local de Atendimento</div>
        <RadioGroup
          label="Local"
          name="localAtendimento"
          value={form.atendimento.localAtendimento}
          onChange={(_, v) => sec("atendimento", "localAtendimento", v)}
          options={LOCAL_OPTS}
        />
      </div>

      {/* ── TIPO DE ATENDIMENTO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Tipo de Atendimento (e-SUS)</div>
        <RadioGroup
          label="Tipo"
          name="tipoAtendimento"
          value={form.atendimento.tipoAtendimento}
          onChange={(_, v) => sec("atendimento", "tipoAtendimento", v)}
          options={TIPO_ATENDIMENTO_OPTS}
        />
      </div>

      {/* ── MOTIVO DA CONSULTA ── */}
      <div className="pap-section">
        <div className="pap-section__title">Motivo da Consulta</div>
        <div className="pap-field">
          <FieldLabel>Motivo</FieldLabel>
          <Textarea
            value={form.motivoConsulta.texto}
            onChange={e => sec("motivoConsulta", "texto", e.target.value)}
            placeholder="Descreva o motivo da consulta..."
            rows={3}
          />
        </div>
      </div>

      {/* ── DUM ── */}
      <div className="pap-section">
        <div className="pap-section__title">DUM</div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>DUM (Data da Última Menstruação)</FieldLabel>
            <Input type="date" value={form.dum.data} onChange={e => sec("dum", "data", e.target.value)} style={{ maxWidth: 200 }} />
          </div>
        </div>
        <RadioGroup
          label="Gestante"
          name="gestante"
          value={form.dum.gestante}
          onChange={(_, v) => sec("dum", "gestante", v)}
          options={SIM_NAO_OPTS}
        />
      </div>

      {/* ── ANTROPOMETRIA ── */}
      <div className="pap-section">
        <div className="pap-section__title">Antropometria</div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Peso (kg)</FieldLabel>
            <Input value={form.antropometria.peso} onChange={e => sec("antropometria", "peso", e.target.value)} placeholder="Ex: 70,5" style={{ maxWidth: 120 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Altura (m)</FieldLabel>
            <Input value={form.antropometria.altura} onChange={e => sec("antropometria", "altura", e.target.value)} placeholder="Ex: 1,70" style={{ maxWidth: 120 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>IMC</FieldLabel>
            <Input value={imc} readOnly placeholder="—" style={{ maxWidth: 100, background: "var(--surface-2)" }} />
          </div>
        </div>
        {imc && (
          <div className="wf-imc-badge">
            <span style={{ fontWeight: 600 }}>{imc}</span>
            <span className="muted small">kg/m²</span>
            <span className="badge">{imcLabel(imc)}</span>
          </div>
        )}
      </div>

      {/* ── SINAIS VITAIS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Sinais Vitais</div>
        <RadioGroup
          label="Aferição de pressão arterial"
          name="afericaoPA"
          value={form.sinaisVitais.afericaoPA}
          onChange={(_, v) => sec("sinaisVitais", "afericaoPA", v)}
          options={SIM_NAO_OPTS}
        />
        {form.sinaisVitais.afericaoPA === "sim" && (
          <div className="pap-row">
            <div className="pap-field">
              <FieldLabel>PAS (mmHg)</FieldLabel>
              <Input value={form.sinaisVitais.pas} onChange={e => sec("sinaisVitais", "pas", e.target.value)} placeholder="Ex: 120" style={{ maxWidth: 120 }} />
            </div>
            <div className="pap-field">
              <FieldLabel>PAD (mmHg)</FieldLabel>
              <Input value={form.sinaisVitais.pad} onChange={e => sec("sinaisVitais", "pad", e.target.value)} placeholder="Ex: 80" style={{ maxWidth: 120 }} />
            </div>
          </div>
        )}
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Freq. Respiratória (irpm)</FieldLabel>
            <Input value={form.sinaisVitais.frequenciaRespiratoria} onChange={e => sec("sinaisVitais", "frequenciaRespiratoria", e.target.value)} placeholder="Ex: 16" style={{ maxWidth: 120 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Freq. Cardíaca (bpm)</FieldLabel>
            <Input value={form.sinaisVitais.frequenciaCardiaca} onChange={e => sec("sinaisVitais", "frequenciaCardiaca", e.target.value)} placeholder="Ex: 72" style={{ maxWidth: 120 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Temperatura (°C)</FieldLabel>
            <Input value={form.sinaisVitais.temperatura} onChange={e => sec("sinaisVitais", "temperatura", e.target.value)} placeholder="Ex: 36,5" style={{ maxWidth: 120 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Saturação de O₂ (%)</FieldLabel>
            <Input value={form.sinaisVitais.saturacaoO2} onChange={e => sec("sinaisVitais", "saturacaoO2", e.target.value)} placeholder="Ex: 98" style={{ maxWidth: 120 }} />
          </div>
        </div>
        <div className="pap-field" style={{ maxWidth: 320 }}>
          <FieldLabel>Dor (0–10)</FieldLabel>
          <Select
            value={form.sinaisVitais.dor}
            onChange={e => sec("sinaisVitais", "dor", e.target.value)}
            placeholder="Selecionar..."
          >
            <option value="">Não avaliado</option>
            {DOR_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Glicemia capilar (mg/dL)</FieldLabel>
            <Input value={form.sinaisVitais.glicemiaCapilar} onChange={e => sec("sinaisVitais", "glicemiaCapilar", e.target.value)} placeholder="Ex: 95" style={{ maxWidth: 140 }} />
          </div>
          <div className="pap-field" style={{ minWidth: 200 }}>
            <FieldLabel>Momento da glicemia</FieldLabel>
            <Select
              value={form.sinaisVitais.momentoGlicemia}
              onChange={e => sec("sinaisVitais", "momentoGlicemia", e.target.value)}
              placeholder="Selecionar..."
              style={{ maxWidth: 320 }}
            >
              <option value="">—</option>
              {MOMENTO_GLICEMIA_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        </div>
      </div>

      {/* ── VACINAÇÃO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Vacinação</div>
        <RadioGroup
          label="Vacinação em dia"
          name="vacinacaoEmDia"
          value={form.vacinacao.emDia}
          onChange={(_, v) => sec("vacinacao", "emDia", v)}
          options={SIM_NAO_NA_OPTS}
        />
      </div>

      {/* ── EXAMES ── */}
      <div className="pap-section">
        <div className="pap-section__title">Exames</div>
        <div className="pap-field">
          <FieldLabel>Solicitar / Avaliar exames</FieldLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
            {EXAMES_LIST.map(exame => (
              <div key={exame.key} style={{ display: "flex", alignItems: "center", gap: "var(--s-4)", flexWrap: "wrap" }}>
                <span style={{ minWidth: 280, fontSize: "var(--t-sm)", color: "var(--text)" }}>{exame.label}</span>
                <div className="pap-field__opts" style={{ margin: 0 }}>
                  {EXAME_OPCOES.map(op => (
                    <label key={op.value} className={`pap-opt${form.exames[exame.key] === op.value ? " is-active" : ""}`}>
                      <input
                        type="radio"
                        name={`exame_${exame.key}`}
                        value={op.value}
                        checked={form.exames[exame.key] === op.value}
                        onChange={() => setExame(exame.key, op.value)}
                      />
                      {op.label}
                    </label>
                  ))}
                  {form.exames[exame.key] && (
                    <button
                      type="button"
                      className="pap-opt"
                      style={{ color: "var(--danger)", borderColor: "transparent", background: "transparent" }}
                      onClick={() => setExame(exame.key, "")}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="pap-field">
          <FieldLabel>Resultado dos exames</FieldLabel>
          <Textarea
            value={form.exames.resultado}
            onChange={e => setExame("resultado", e.target.value)}
            placeholder="Registre os resultados relevantes..."
            rows={4}
          />
        </div>
      </div>

      {/* ── AVALIAÇÃO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Avaliação — Problema / Condição Avaliada</div>
        <CheckboxGroup
          label="Problemas / condições"
          name="problemasCondicoes"
          values={form.avaliacao.problemasCondicoes}
          onChange={(_, v) => toggleProblema(v)}
          options={PROBLEMAS_OPTS}
        />
      </div>

      {/* ── AVALIAÇÃO CLÍNICA ── */}
      <div className="pap-section">
        <div className="pap-section__title">Avaliação Clínica</div>
        <RadioGroup
          label="Notificação de acidente de trabalho"
          name="notificacaoAcidenteTrabalho"
          value={form.avaliacaoClinica.notificacaoAcidenteTrabalho}
          onChange={(_, v) => sec("avaliacaoClinica", "notificacaoAcidenteTrabalho", v)}
          options={SIM_NAO_OPTS}
        />
        <div className="pap-field">
          <FieldLabel>Avaliação</FieldLabel>
          <Textarea
            value={form.avaliacaoClinica.avaliacao}
            onChange={e => sec("avaliacaoClinica", "avaliacao", e.target.value)}
            placeholder="Descrição da avaliação clínica..."
            rows={4}
          />
        </div>
        <div className="pap-field">
          <FieldLabel>Exame Físico</FieldLabel>
          <Textarea
            value={form.avaliacaoClinica.exameFisico}
            onChange={e => sec("avaliacaoClinica", "exameFisico", e.target.value)}
            placeholder="Achados do exame físico..."
            rows={4}
          />
        </div>
        <RadioGroup
          label="Ficou em observação"
          name="ficouObservacao"
          value={form.avaliacaoClinica.ficouObservacao}
          onChange={(_, v) => sec("avaliacaoClinica", "ficouObservacao", v)}
          options={SIM_NAO_OPTS}
        />
        <div className="pap-field">
          <FieldLabel>eMulti / Polo</FieldLabel>
          <Input
            value={form.avaliacaoClinica.emultiPolo}
            onChange={e => sec("avaliacaoClinica", "emultiPolo", e.target.value)}
            placeholder="Registro eMulti ou Polo..."
            style={{ maxWidth: 480 }}
          />
        </div>
      </div>

      {/* ── CONDUTA / DESFECHO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Conduta / Desfecho</div>
        <CheckboxGroup
          label="Conduta / Orientação"
          name="orientacoes"
          values={form.conduta.orientacoes}
          onChange={(_, v) => toggleConduta(v)}
          options={CONDUTA_OPTS}
        />
        {(form.conduta.orientacoes || []).includes("retorno_agendado") && (
          <div className="pap-field">
            <FieldLabel>Data do retorno</FieldLabel>
            <Input
              type="date"
              value={form.conduta.dataRetorno}
              onChange={e => sec("conduta", "dataRetorno", e.target.value)}
              style={{ maxWidth: 200 }}
            />
          </div>
        )}
      </div>

      {/* ── PROCEDIMENTOS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Procedimentos</div>
        <div className="pap-field">
          <FieldLabel>Buscar procedimento SIGTAP</FieldLabel>
          <div style={{ position: "relative", maxWidth: 480 }}>
            <Input
              value={procQ}
              onChange={e => searchProc(e.target.value)}
              placeholder={procLoading ? "Buscando..." : "Ex: 0301010072, curativos..."}
            />
            {procResults.length > 0 && (
              <div className="ins-pat-results">
                {procResults.map(r => (
                  <Button key={r.code} variant="ghost" className="ins-pat-opt" onClick={() => addProc(r)} type="button">
                    <div className="ins-pat-opt__name">
                      <span className="pap-code" style={{ marginRight: "var(--s-2)" }}>{r.code}</span>
                      {r.name}
                    </div>
                    <div className="ins-pat-opt__sub">{r.category}</div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        {procItens.length > 0 && (
          <div className="pap-field">
            <FieldLabel>Procedimentos selecionados</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {procItens.map(item => (
                <div key={item.code} className="wf-proc-item">
                  <span className="pap-code">{item.code}</span>
                  <span style={{ flex: 1 }}>{item.name}</span>
                  <span className="muted small">{item.category}</span>
                  <Button variant="ghost" size="sm" type="button" iconOnly style={{ color: "var(--danger)" }} onClick={() => removeProc(item.code)}>×</Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── AÇÕES ── */}
      <div className="pap-section pap-section--actions">
        {err && <div className="alert alert--danger" style={{ marginBottom: "var(--s-3)" }}>{err}</div>}
        {ok  && <div className="alert alert--success" style={{ marginBottom: "var(--s-3)" }}>Consulta de enfermagem salva com sucesso no prontuário.</div>}
        <div style={{ display: "flex", gap: "var(--s-3)", justifyContent: "flex-end" }}>
          <Button variant="secondary" type="button" disabled={busy} onClick={() => { setForm(makeEmpty()); setErr(""); setOk(false); }}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={busy}>{busy ? "Salvando..." : "Finalizar Atendimento"}</Button>
        </div>
      </div>
    </form>
  );
}
