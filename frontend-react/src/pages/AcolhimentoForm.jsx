import { useState, useEffect, useRef, useMemo } from "react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import { RadioGroup, CheckboxGroup, FieldLabel } from "./workflow/shared.jsx";
import { api } from "../api.js";
import { buildAcolhimentoRecord, EMPTY_ACOLHIMENTO } from "./workflow/acolhimento/acolhimentoWorkflow.js";

const LOCAL_OPTS = [
  { value: "ubs", label: "UBS" },
  { value: "unidade_movel", label: "Unidade Móvel" },
  { value: "rua", label: "Rua" },
  { value: "domicilio", label: "Domicílio" },
  { value: "escola_creche", label: "Escola/Creche" },
  { value: "outros", label: "Outros" },
  { value: "polo_academia", label: "Polo (Academia da Saúde)" },
  { value: "instituicao_abrigo", label: "Instituição/Abrigo" },
  { value: "unidade_prisional", label: "Unidade prisional ou congêneres" },
  { value: "unidade_socioeducativa", label: "Unidade socioeducativa" },
];

const PROBLEMAS_OPTS = [
  { value: "asma", label: "Asma" },
  { value: "desnutricao", label: "Desnutrição" },
  { value: "diabetes", label: "Diabetes" },
  { value: "dpoc", label: "DPOC" },
  { value: "hipertensao", label: "Hipertensão arterial" },
  { value: "obesidade", label: "Obesidade" },
  { value: "pre_natal", label: "Pré-natal" },
  { value: "puericultura", label: "Puericultura" },
  { value: "puerperio", label: "Puerpério (até 42 dias)" },
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
  { value: "outros", label: "OUTROS" },
];

const MOMENTO_GLICEMIA_OPTS = [
  { value: "jejum", label: "Jejum" },
  { value: "pos_prandial", label: "Pós-prandial (2h após refeição)" },
  { value: "pre_prandial", label: "Pré-prandial" },
  { value: "casual", label: "Casual (horário não definido)" },
];

const RISCO_OPTS = [
  { value: "nao_aguda", label: "Não aguda" },
  { value: "aguda_baixa", label: "Aguda / Baixa" },
  { value: "aguda_intermediaria", label: "Aguda / Intermediária" },
  { value: "aguda_alta", label: "Aguda / Alta" },
];

const RISCO_COLORS = {
  nao_aguda: "var(--success, #16a34a)",
  aguda_baixa: "var(--warning, #f59e0b)",
  aguda_intermediaria: "#f97316",
  aguda_alta: "var(--danger, #dc2626)",
};

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

const ENC_INTERNO_OPTS = [
  { value: "", label: "Selecione..." },
  { value: "medico_referencia", label: "Médico de referência" },
  { value: "ginecologista", label: "Ginecologista" },
  { value: "mastologista", label: "Mastologista" },
  { value: "pediatra", label: "Pediatra" },
  { value: "psicologo", label: "Psicólogo" },
  { value: "assistente_social", label: "Assistente Social" },
  { value: "nutricionista", label: "Nutricionista" },
  { value: "fisioterapeuta", label: "Fisioterapeuta" },
  { value: "farmaceutico", label: "Farmacêutico" },
  { value: "outro", label: "Outro" },
];

const CID10 = [
  { code: "Z12.4", desc: "Exame de rastreamento — neoplasia do colo uterino" },
  { code: "N87.0", desc: "Displasia leve do colo uterino (NIC I)" },
  { code: "N87.1", desc: "Displasia moderada do colo uterino (NIC II)" },
  { code: "N87.9", desc: "Displasia do colo uterino, não especificada" },
  { code: "D06.9", desc: "Carcinoma in situ do colo uterino, parte não especificada" },
  { code: "C53.9", desc: "Neoplasia maligna do colo uterino, parte não especificada" },
  { code: "N72",   desc: "Doença inflamatória do colo uterino" },
  { code: "N76.0", desc: "Vaginite aguda" },
  { code: "N89.0", desc: "Displasia vaginal leve" },
  { code: "A59.0", desc: "Tricomoníase urogenital" },
  { code: "B37.3", desc: "Candidíase da vulva e vagina" },
  { code: "A54.0", desc: "Infecção gonocócica do trato geniturinário inferior" },
  { code: "A63.0", desc: "Condiloma acuminado (HPV)" },
  { code: "Z34.0", desc: "Supervisão de primeira gravidez normal" },
  { code: "Z34.8", desc: "Supervisão de outras gravidez normais" },
  { code: "Z30.0", desc: "Aconselhamento sobre contracepção" },
  { code: "N95.1", desc: "Menopausa e estados climatéricos femininos" },
  { code: "I10",   desc: "Hipertensão essencial (primária)" },
  { code: "E11.9", desc: "Diabetes mellitus tipo 2 sem complicações" },
  { code: "E66.0", desc: "Obesidade por excesso de calorias" },
  { code: "F32.9", desc: "Episódio depressivo não especificado" },
  { code: "Z00.0", desc: "Exame médico geral" },
  { code: "Z71.1", desc: "Visita para fins de saúde / orientação" },
];

const FILE_TYPE_LABELS = {
  laudo: "Laudo", imagem: "Imagem", receita: "Receita", atestado: "Atestado", outro: "Outro",
};

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
  if (n < 25) return "Eutrófico";
  if (n < 30) return "Sobrepeso";
  if (n < 35) return "Obesidade grau I";
  if (n < 40) return "Obesidade grau II";
  return "Obesidade grau III";
}

export default function AcolhimentoForm({ patient, user, token, users, onRecordSaved }) {
  function makeEmpty() {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toTimeString().slice(0, 5);
    return {
      ...EMPTY_ACOLHIMENTO,
      atendimento: { ...EMPTY_ACOLHIMENTO.atendimento, dataAtendimento: today, horaAtendimento: now, profissionalId: user?.id || "" },
      procedimentos: { ...EMPTY_ACOLHIMENTO.procedimentos, dataColeta: today, responsavelId: user?.id || "" },
    };
  }

  const [form, setForm] = useState(makeEmpty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const [cidQ, setCidQ] = useState("");
  const [procQ, setProcQ] = useState("");
  const [procResults, setProcResults] = useState([]);
  const [procLoading, setProcLoading] = useState(false);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("laudo");
  const procDebounce = useRef(null);

  useEffect(() => {
    const imc = calcIMC(form.medicoes.peso, form.medicoes.altura);
    if (imc !== (form.medicoes.imc || "")) {
      setForm(prev => ({ ...prev, medicoes: { ...prev.medicoes, imc } }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.medicoes.peso, form.medicoes.altura]);

  useEffect(() => {
    if (procQ.trim().length < 2) { setProcResults([]); return; }
    clearTimeout(procDebounce.current);
    procDebounce.current = setTimeout(async () => {
      setProcLoading(true);
      try {
        const res = await api(`/catalog/items?q=${encodeURIComponent(procQ.trim())}&domain=procedure`, {}, token);
        setProcResults(res.data || []);
      } catch { setProcResults([]); }
      finally { setProcLoading(false); }
    }, 300);
    return () => clearTimeout(procDebounce.current);
  }, [procQ, token]);

  const cidResults = useMemo(() => {
    const t = cidQ.trim().toLowerCase();
    if (t.length < 2) return [];
    return CID10.filter(c => c.code.toLowerCase().includes(t) || c.desc.toLowerCase().includes(t)).slice(0, 10);
  }, [cidQ]);

  function sec(section, field, val) {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: val } }));
    setErr(""); setOk(false);
  }

  function addCid(item) {
    const cur = form.diagnosticos.itens || [];
    if (cur.some(i => i.code === item.code)) { setCidQ(""); return; }
    const next = [...cur, item];
    setForm(prev => ({ ...prev, diagnosticos: { ...prev.diagnosticos, itens: next, principalCode: prev.diagnosticos.principalCode || item.code } }));
    setCidQ("");
  }

  function removeCid(code) {
    const next = (form.diagnosticos.itens || []).filter(i => i.code !== code);
    setForm(prev => ({ ...prev, diagnosticos: { ...prev.diagnosticos, itens: next, principalCode: prev.diagnosticos.principalCode === code ? (next[0]?.code || "") : prev.diagnosticos.principalCode } }));
  }

  function addProc(item) {
    const cur = form.procedimentos.itens || [];
    if (cur.some(i => i.code === item.code)) { setProcQ(""); setProcResults([]); return; }
    setForm(prev => ({ ...prev, procedimentos: { ...prev.procedimentos, itens: [...cur, { code: item.code, name: item.name, category: item.category }] } }));
    setProcQ(""); setProcResults([]);
  }

  function removeProc(code) {
    setForm(prev => ({ ...prev, procedimentos: { ...prev.procedimentos, itens: (prev.procedimentos.itens || []).filter(i => i.code !== code) } }));
  }

  function addDoc() {
    const name = docName.trim();
    if (!name) return;
    setForm(prev => ({ ...prev, documentos: { ...prev.documentos, arquivos: [...(prev.documentos.arquivos || []), { name, type: docType, registeredAt: new Date().toISOString() }] } }));
    setDocName(""); setDocType("laudo");
  }

  function removeDoc(i) {
    setForm(prev => ({ ...prev, documentos: { ...prev.documentos, arquivos: (prev.documentos.arquivos || []).filter((_, idx) => idx !== i) } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk(false);
    try {
      const record = buildAcolhimentoRecord(form, patient, users);
      await api(`/patients/${patient.id}/records`, { method: "POST", body: JSON.stringify(record) }, token);
      setOk(true);
      setForm(makeEmpty());
      onRecordSaved?.();
    } catch (e) {
      setErr(e?.message || "Erro ao salvar atendimento.");
    } finally {
      setBusy(false);
    }
  }

  const imc = form.medicoes.imc || calcIMC(form.medicoes.peso, form.medicoes.altura);
  const riscoCor = RISCO_COLORS[form.classificacaoConduta.classificacaoRisco];
  const temEncInterno = (form.classificacaoConduta.condutaDesfecho || []).includes("encaminhamento_interno");

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
      </div>

      {/* ── LOCAL ── */}
      <div className="pap-section">
        <div className="pap-section__title">Local de Atendimento</div>
        <RadioGroup label="Local" name="localAtendimento" value={form.atendimento.localAtendimento} onChange={(_, v) => sec("atendimento", "localAtendimento", v)} options={LOCAL_OPTS} />
      </div>

      {/* ── TIPO (fixo) ── */}
      <div className="pap-section">
        <div className="pap-section__title">Tipo de Atendimento</div>
        <div className="pap-field">
          <div className="pap-field__opts">
            <label className="pap-opt is-active">
              <input type="radio" checked readOnly />
              Demanda Espontânea — Escuta Inicial/Orientação
            </label>
          </div>
        </div>
      </div>

      {/* ── MOTIVO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Motivo da Consulta</div>
        <div className="pap-field">
          <FieldLabel required>Motivo da consulta / queixa principal</FieldLabel>
          <Textarea value={form.avaliacao.motivoConsulta} onChange={e => sec("avaliacao", "motivoConsulta", e.target.value)} placeholder="Descreva o motivo da consulta / queixa principal..." rows={3} />
        </div>
      </div>

      {/* ── PROBLEMA / CONDIÇÃO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Problema / Condição Avaliada</div>
        <CheckboxGroup label="Selecione os problemas/condições avaliadas" name="problemasCondicoes" value={form.avaliacao.problemasCondicoes} onChange={(_, v) => sec("avaliacao", "problemasCondicoes", v)} options={PROBLEMAS_OPTS} />
      </div>

      {/* ── ANTROPOMETRIA ── */}
      <div className="pap-section">
        <div className="pap-section__title">Antropometria</div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Peso (kg)</FieldLabel>
            <Input type="number" step="0.1" min="0" max="300" value={form.medicoes.peso} onChange={e => sec("medicoes", "peso", e.target.value)} placeholder="Ex: 70.5" style={{ maxWidth: 120 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Altura (m)</FieldLabel>
            <Input type="number" step="0.01" min="0" max="3" value={form.medicoes.altura} onChange={e => sec("medicoes", "altura", e.target.value)} placeholder="Ex: 1.70" style={{ maxWidth: 120 }} />
          </div>
          {imc && (
            <div className="pap-field">
              <FieldLabel>IMC (calculado)</FieldLabel>
              <div className="wf-imc-badge">
                <span className="pap-code">{imc}</span>
                <span className="muted small"> — {imcLabel(imc)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SINAIS VITAIS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Sinais Vitais</div>
        <RadioGroup label="Houve aferição de pressão arterial?" name="afericaoPA" value={form.medicoes.afericaoPA} onChange={(_, v) => sec("medicoes", "afericaoPA", v)} options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]} />
        {form.medicoes.afericaoPA === "sim" && (
          <div className="pap-field">
            <FieldLabel>Pressão arterial (mmHg)</FieldLabel>
            <Input value={form.medicoes.pressaoArterial} onChange={e => sec("medicoes", "pressaoArterial", e.target.value)} placeholder="Ex: 120/80" style={{ maxWidth: 160 }} />
          </div>
        )}
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Frequência cardíaca (bpm)</FieldLabel>
            <Input type="number" min="0" max="300" value={form.medicoes.frequenciaCardiaca} onChange={e => sec("medicoes", "frequenciaCardiaca", e.target.value)} placeholder="Ex: 72" style={{ maxWidth: 120 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Frequência respiratória (mpm)</FieldLabel>
            <Input type="number" min="0" max="100" value={form.medicoes.frequenciaRespiratoria} onChange={e => sec("medicoes", "frequenciaRespiratoria", e.target.value)} placeholder="Ex: 16" style={{ maxWidth: 120 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Temperatura (°C)</FieldLabel>
            <Input type="number" step="0.1" min="30" max="45" value={form.medicoes.temperatura} onChange={e => sec("medicoes", "temperatura", e.target.value)} placeholder="Ex: 36.5" style={{ maxWidth: 120 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Saturação O₂ (%)</FieldLabel>
            <Input type="number" min="0" max="100" value={form.medicoes.saturacaoO2} onChange={e => sec("medicoes", "saturacaoO2", e.target.value)} placeholder="Ex: 98" style={{ maxWidth: 120 }} />
          </div>
        </div>
      </div>

      {/* ── GLICEMIA ── */}
      <div className="pap-section">
        <div className="pap-section__title">Glicemia</div>
        <div className="pap-field">
          <FieldLabel>Glicemia capilar (mg/dL)</FieldLabel>
          <Input type="number" min="0" max="1000" value={form.medicoes.glicemiaCapilar} onChange={e => sec("medicoes", "glicemiaCapilar", e.target.value)} placeholder="Ex: 95" style={{ maxWidth: 140 }} />
        </div>
        {form.medicoes.glicemiaCapilar && (
          <RadioGroup label="Momento da coleta" name="momentoGlicemia" value={form.medicoes.momentoGlicemia} onChange={(_, v) => sec("medicoes", "momentoGlicemia", v)} options={MOMENTO_GLICEMIA_OPTS} />
        )}
      </div>

      {/* ── CLASSIFICAÇÃO DE RISCO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Classificação de Risco / Vulnerabilidade</div>
        <div className="pap-field">
          <FieldLabel required>Classificação de Risco / Vulnerabilidade</FieldLabel>
          <div className="pap-field__opts">
            {RISCO_OPTS.map(opt => {
              const cor = RISCO_COLORS[opt.value];
              const ativo = form.classificacaoConduta.classificacaoRisco === opt.value;
              return (
                <label key={opt.value} className={`pap-opt${ativo ? " is-active" : ""}`} style={ativo ? { borderColor: cor, background: cor + "18", color: cor, fontWeight: 700 } : {}}>
                  <input type="radio" name="classificacaoRisco" value={opt.value} checked={ativo} onChange={() => sec("classificacaoConduta", "classificacaoRisco", opt.value)} />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
        {form.classificacaoConduta.classificacaoRisco && (
          <div className="wf-risco-badge" style={{ borderLeftColor: riscoCor, color: riscoCor }}>
            <strong>Risco classificado:</strong>{" "}
            {RISCO_OPTS.find(o => o.value === form.classificacaoConduta.classificacaoRisco)?.label}
          </div>
        )}
      </div>

      {/* ── CONDUTA / DESFECHO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Conduta / Desfecho</div>
        <CheckboxGroup label="Condutas adotadas" name="condutaDesfecho" value={form.classificacaoConduta.condutaDesfecho} onChange={(_, v) => sec("classificacaoConduta", "condutaDesfecho", v)} options={CONDUTA_OPTS} />
        {temEncInterno && (
          <div className="pap-field">
            <FieldLabel>Encaminhamento Interno</FieldLabel>
            <select className="select" value={form.classificacaoConduta.observacoes} onChange={e => sec("classificacaoConduta", "observacoes", e.target.value)} style={{ maxWidth: 360 }}>
              {ENC_INTERNO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── PROCEDIMENTOS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Novo Procedimento</div>
        <div className="pap-field">
          <FieldLabel>Buscar procedimento</FieldLabel>
          <div style={{ position: "relative", maxWidth: 480 }}>
            <Input value={procQ} onChange={e => setProcQ(e.target.value)} placeholder="Ex: citopatológico, HIV, curativo..." />
            {procLoading && <div className="muted small" style={{ padding: "var(--s-2)" }}>Buscando...</div>}
            {procResults.length > 0 && (
              <div className="ins-pat-results">
                {procResults.map(r => (
                  <Button key={r.code} variant="ghost" className="ins-pat-opt" onClick={() => addProc(r)} type="button">
                    <div className="ins-pat-opt__name"><span className="pap-code" style={{ marginRight: "var(--s-2)" }}>{r.code}</span>{r.name}</div>
                    <div className="ins-pat-opt__sub">{r.category}</div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        {(form.procedimentos.itens || []).length > 0 && (
          <div className="pap-field">
            <FieldLabel>Procedimentos selecionados</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {form.procedimentos.itens.map(item => (
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

      {/* ── DIAGNÓSTICOS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Adicionar Diagnóstico ao Atendimento</div>
        <div className="pap-field">
          <FieldLabel>Buscar CID-10</FieldLabel>
          <div style={{ position: "relative", maxWidth: 480 }}>
            <Input value={cidQ} onChange={e => setCidQ(e.target.value)} placeholder="Ex: hipertensão, E11, diabetes..." />
            {cidResults.length > 0 && (
              <div className="ins-pat-results">
                {cidResults.map(r => (
                  <Button key={r.code} variant="ghost" className="ins-pat-opt" onClick={() => addCid(r)} type="button">
                    <div className="ins-pat-opt__name">
                      <span className="pap-code" style={{ marginRight: "var(--s-2)" }}>{r.code}</span>
                      {r.desc}
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        {(form.diagnosticos.itens || []).length > 0 && (
          <div className="pap-field">
            <FieldLabel>Diagnósticos</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {form.diagnosticos.itens.map(item => (
                <div key={item.code} className={`wf-diag-item${item.code === form.diagnosticos.principalCode ? " is-principal" : ""}`}>
                  <label className="wf-diag-radio" style={{ flex: 1, display: "flex", alignItems: "center", gap: "var(--s-2)", cursor: "pointer" }}>
                    <input type="radio" name="principalCode" checked={item.code === form.diagnosticos.principalCode} onChange={() => setForm(prev => ({ ...prev, diagnosticos: { ...prev.diagnosticos, principalCode: item.code } }))} />
                    <span className="pap-code">{item.code}</span>
                    <span>{item.desc}</span>
                    {item.code === form.diagnosticos.principalCode && <span className="badge badge--primary" style={{ marginLeft: "auto" }}>Principal</span>}
                  </label>
                  <Button variant="ghost" size="sm" type="button" iconOnly style={{ color: "var(--danger)" }} onClick={() => removeCid(item.code)}>×</Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── LINHA DE CUIDADO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Linha de Cuidado</div>
        <div className="pap-field">
          <FieldLabel>Linha de Cuidado</FieldLabel>
          <Input value={form.diagnosticos.linhaCuidado} onChange={e => sec("diagnosticos", "linhaCuidado", e.target.value)} placeholder="Ex: Saúde da Mulher, Hiperdia, Saúde Mental..." style={{ maxWidth: 480 }} />
        </div>
      </div>

      {/* ── DOCUMENTOS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Anexar Arquivos</div>
        <div className="pap-row" style={{ alignItems: "flex-end" }}>
          <div className="pap-field" style={{ flex: 1 }}>
            <FieldLabel>Nome / descrição do documento</FieldLabel>
            <input className="input" value={docName} onChange={e => setDocName(e.target.value)} placeholder="Ex: Laudo citopatológico 06/2026" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addDoc())} />
          </div>
          <div className="pap-field">
            <FieldLabel>Tipo</FieldLabel>
            <select className="select" value={docType} onChange={e => setDocType(e.target.value)}>
              {Object.entries(FILE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <Button variant="secondary" size="sm" type="button" onClick={addDoc} style={{ marginBottom: 1 }}>+ Registrar</Button>
        </div>
        {(form.documentos.arquivos || []).length > 0 && (
          <div className="pap-field">
            <FieldLabel>Documentos</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {form.documentos.arquivos.map((a, i) => (
                <div key={i} className="wf-proc-item">
                  <span style={{ flex: 1 }}>{a.name}</span>
                  <span className="badge">{FILE_TYPE_LABELS[a.type] || a.type}</span>
                  <Button variant="ghost" size="sm" type="button" iconOnly style={{ color: "var(--danger)" }} onClick={() => removeDoc(i)}>×</Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── AÇÕES ── */}
      <div className="pap-section pap-section--actions">
        {err && <div className="alert alert--danger" style={{ marginBottom: "var(--s-3)" }}>{err}</div>}
        {ok && <div className="alert alert--success" style={{ marginBottom: "var(--s-3)" }}>Atendimento salvo com sucesso no prontuário.</div>}
        <div style={{ display: "flex", gap: "var(--s-3)", justifyContent: "flex-end" }}>
          <Button variant="secondary" type="button" disabled={busy} onClick={() => { setForm(makeEmpty()); setErr(""); setOk(false); }}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={busy}>{busy ? "Salvando..." : "Finalizar Atendimento"}</Button>
        </div>
      </div>
    </form>
  );
}
