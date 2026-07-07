import { useState, useEffect, useRef, useMemo } from "react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Textarea from "../components/ui/Textarea";
import { RadioGroup, CheckboxGroup, FieldLabel } from "./workflow/shared.jsx";
import { api } from "../api.js";
import { buildPapanicolauRecord, EMPTY_PAPANICOLAU } from "./workflow/papanicolau/papanicolauWorkflow.js";

const CARATER_OPTS = [
  { value: "eletivo", label: "Eletivo" },
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
  { value: "outra", label: "Outra" },
];

const LOCAL_OPTS = [
  { value: "ubs", label: "UBS" },
  { value: "domicilio", label: "Domicílio" },
  { value: "escola", label: "Escola" },
  { value: "polo_academia", label: "Polo Academia" },
  { value: "outros_espacos", label: "Outros espaços sociais" },
];

const TIPO_ATENDIMENTO_OPTS = [
  { value: "consulta_agendada", label: "Consulta agendada" },
  { value: "consulta_nao_agendada", label: "Consulta não agendada (demanda espontânea)" },
  { value: "atendimento_urgencia", label: "Atendimento de urgência" },
  { value: "escuta_orientacao", label: "Escuta inicial/orientação" },
  { value: "procedimento", label: "Procedimento" },
];

const SIM_NAO_NAOSABE = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "nao_sabe", label: "Não sabe" },
];

const RETORNO_OPTS = [
  { value: "sem_retorno", label: "Sem retorno necessário" },
  { value: "retornar_se_necessario", label: "Retornar se necessário" },
  { value: "agendamento_retorno", label: "Agendamento de retorno" },
  { value: "alta", label: "Alta" },
];

const ENCAMINHAMENTO_OPTS = [
  { value: "especializado", label: "Encaminhamento especializado" },
  { value: "caps", label: "CAPS" },
  { value: "hospital", label: "Hospital" },
  { value: "urgencia", label: "Urgência" },
  { value: "atencao_domiciliar", label: "Atenção domiciliar" },
  { value: "cuidado_continuado", label: "Cuidado continuado" },
  { value: "intersetorial", label: "Encaminhamento intersetorial" },
];

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

const DIAGNOSTICO_DESCRITIVO_OPTS = [
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

const LINHA_DIAG_OPTS = [
  { value: "saude_mulher", label: "Saúde da Mulher" },
  { value: "dst_ist", label: "DST/IST" },
  { value: "doenca_cronica", label: "Doenças Crônicas" },
  { value: "saude_mental", label: "Saúde Mental" },
  { value: "outra", label: "Outra" },
];

const FILE_TYPE_LABELS = {
  laudo: "Laudo", imagem: "Imagem", receita: "Receita", atestado: "Atestado", outro: "Outro",
};

export default function PapanicolauForm({ patient, user, token, users, onRecordSaved }) {
  function makeEmpty() {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toTimeString().slice(0, 5);
    return {
      ...EMPTY_PAPANICOLAU,
      atendimento: { ...EMPTY_PAPANICOLAU.atendimento, dataAtendimento: today, horaAtendimento: now, profissionalId: user?.id || "" },
      procedimentos: { ...EMPTY_PAPANICOLAU.procedimentos, dataColeta: today, responsavelId: user?.id || "" },
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
      const record = buildPapanicolauRecord(form, patient, users);
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

  const clinicians = (users || []).filter(u => ["nurse_manager", "nursing_tech", "doctor", "dentist"].includes(u.role));

  return (
    <form className="pap-form" onSubmit={handleSubmit}>

      {/* ── DADOS DO ATENDIMENTO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Dados do Atendimento</div>
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
        <RadioGroup label="Caráter do atendimento" name="carater" value={form.atendimento.carater} onChange={(_, v) => sec("atendimento", "carater", v)} options={CARATER_OPTS} />
        <RadioGroup label="Linha de cuidado" name="linhaCuidado" value={form.atendimento.linhaCuidado} onChange={(_, v) => sec("atendimento", "linhaCuidado", v)} options={LINHA_CUIDADO_OPTS} />
        <RadioGroup label="Local de atendimento" name="localAtendimento" value={form.atendimento.localAtendimento} onChange={(_, v) => sec("atendimento", "localAtendimento", v)} options={LOCAL_OPTS} />
        <RadioGroup label="Tipo de atendimento (e-SUS)" name="tipoAtendimento" value={form.atendimento.tipoAtendimento} onChange={(_, v) => sec("atendimento", "tipoAtendimento", v)} options={TIPO_ATENDIMENTO_OPTS} />
        <div className="pap-field">
          <FieldLabel required>Profissional responsável</FieldLabel>
          <Select value={form.atendimento.profissionalId} onChange={e => sec("atendimento", "profissionalId", e.target.value)} placeholder="Selecionar profissional..." style={{ maxWidth: 400 }}>
            <option value="">Selecionar profissional...</option>
            {clinicians.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
          </Select>
        </div>
      </div>

      {/* ── ANAMNESE ── */}
      <div className="pap-section">
        <div className="pap-section__title">Anamnese</div>
        <RadioGroup label="1. Motivo do exame" name="motivoExame" value={form.fichaClinica.motivoExame} onChange={(_, v) => sec("fichaClinica", "motivoExame", v)} required options={[
          { value: "rastreamento", label: "Rastreamento" },
          { value: "repeticao", label: "Repetição (ASCUS/Baixo grau)" },
          { value: "seguimento", label: "Seguimento (pós colposcopia/tratamento)" },
        ]} />
        <RadioGroup label="2. Fez exame preventivo anteriormente?" name="fezePreventivo" value={form.fichaClinica.fezePreventivo} onChange={(_, v) => sec("fichaClinica", "fezePreventivo", v)} options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]} />
        {form.fichaClinica.fezePreventivo === "sim" && (
          <RadioGroup label="Última coleta" name="ultimaColeta" value={form.fichaClinica.ultimaColeta} onChange={(_, v) => sec("fichaClinica", "ultimaColeta", v)} options={[
            { value: "1_ano", label: "Há 1 ano" },
            { value: "2_anos", label: "Há 2 anos" },
            { value: "3_anos", label: "Há 3 anos" },
            { value: "mais_3_anos", label: "Há mais de 3 anos" },
          ]} />
        )}
        <RadioGroup label="3. Usa DIU?" name="usaDiu" value={form.fichaClinica.usaDiu} onChange={(_, v) => sec("fichaClinica", "usaDiu", v)} options={SIM_NAO_NAOSABE} />
        <RadioGroup label="4. Está grávida?" name="estaGravida" value={form.fichaClinica.estaGravida} onChange={(_, v) => sec("fichaClinica", "estaGravida", v)} options={SIM_NAO_NAOSABE} />
        <RadioGroup label="5. Usa anticoncepcional?" name="usaAnticoncepcional" value={form.fichaClinica.usaAnticoncepcional} onChange={(_, v) => sec("fichaClinica", "usaAnticoncepcional", v)} options={SIM_NAO_NAOSABE} />
        <RadioGroup label="6. Usa hormônio para menopausa?" name="hormonioPosMenuopausa" value={form.fichaClinica.hormonioPosMenuopausa} onChange={(_, v) => sec("fichaClinica", "hormonioPosMenuopausa", v)} options={SIM_NAO_NAOSABE} />
        <RadioGroup label="7. Já realizou radioterapia?" name="realizouRadioterapia" value={form.fichaClinica.realizouRadioterapia} onChange={(_, v) => sec("fichaClinica", "realizouRadioterapia", v)} options={SIM_NAO_NAOSABE} />
        <RadioGroup
          label="8. Sangramento após relação sexual?"
          name="sangramentoAposRelacao"
          value={form.fichaClinica.sangramentoAposRelacao}
          onChange={(_, v) => sec("fichaClinica", "sangramentoAposRelacao", v)}
          hint="ATENÇÃO: NÃO CONSIDERAR A PRIMEIRA RELAÇÃO SEXUAL NA VIDA."
          options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }, { value: "nao_sabe", label: "Não sabe / Não lembra" }]}
        />
        <RadioGroup
          label="9. Sangramento após menopausa?"
          name="sangramentoPosMenuopausa"
          value={form.fichaClinica.sangramentoPosMenuopausa}
          onChange={(_, v) => sec("fichaClinica", "sangramentoPosMenuopausa", v)}
          hint="ATENÇÃO: NÃO CONSIDERAR SANGRAMENTOS DURANTE REPOSIÇÃO HORMONAL."
          options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }, { value: "nao_sabe", label: "Não sabe / Não lembra" }, { value: "nao_menopausa", label: "Não está na menopausa" }]}
        />
        <div className="pap-field">
          <FieldLabel>DUM (Data da Última Menstruação)</FieldLabel>
          <Input type="date" value={form.fichaClinica.dum} onChange={e => sec("fichaClinica", "dum", e.target.value)} style={{ maxWidth: 200 }} />
        </div>
      </div>

      {/* ── EXAME CLÍNICO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Exame Clínico</div>
        <RadioGroup label="10. Inspeção do colo" name="inspecaoColo" value={form.fichaClinica.inspecaoColo} onChange={(_, v) => sec("fichaClinica", "inspecaoColo", v)} options={[
          { value: "normal", label: "Normal" },
          { value: "ausente", label: "Ausente" },
          { value: "alterado", label: "Alterado" },
          { value: "nao_visualizado", label: "Colo não visualizado" },
        ]} />
        <RadioGroup label="11. Sinais sugestivos de IST?" name="sinaisIst" value={form.fichaClinica.sinaisIst} onChange={(_, v) => sec("fichaClinica", "sinaisIst", v)} options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]} />
        <div className="pap-field">
          <label className={`pap-opt${form.fichaClinica.siscan ? " is-active" : ""}`} style={{ display: "inline-flex" }}>
            <input type="checkbox" checked={!!form.fichaClinica.siscan} onChange={e => sec("fichaClinica", "siscan", e.target.checked)} />
            Registrado no SISCAN
          </label>
        </div>
        <div className="pap-field">
          <FieldLabel>Observações clínicas</FieldLabel>
          <Textarea value={form.fichaClinica.observacoes} onChange={e => sec("fichaClinica", "observacoes", e.target.value)} placeholder="Observações clínicas relevantes..." rows={3} />
        </div>
      </div>

      {/* ── DIAGNÓSTICOS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Problemas e Diagnósticos (CID-10)</div>
        <div className="pap-field">
          <FieldLabel>Buscar CID-10</FieldLabel>
          <div style={{ position: "relative", maxWidth: 480 }}>
            <Input value={cidQ} onChange={e => setCidQ(e.target.value)} placeholder="Ex: N87, displasia, candida..." />
            {cidResults.length > 0 && (
              <div className="ins-pat-results">
                {cidResults.map(r => (
                  <Button key={r.code} variant="ghost" className="ins-pat-opt" onClick={() => addCid(r)} type="button">
                    <div className="ins-pat-opt__name"><span className="pap-code" style={{ marginRight: "var(--s-2)" }}>{r.code}</span>{r.desc}</div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        {(form.diagnosticos.itens || []).length > 0 && (
          <div className="pap-field">
            <FieldLabel>Diagnósticos selecionados</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {form.diagnosticos.itens.map(item => (
                <div key={item.code} className={`wf-diag-item${item.code === form.diagnosticos.principalCode ? " is-principal" : ""}`}>
                  <label style={{ flex: 1, display: "flex", alignItems: "center", gap: "var(--s-2)", cursor: "pointer" }}>
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
        <div className="pap-field">
          <FieldLabel>Linha de cuidado (diagnóstico)</FieldLabel>
          <div className="pap-field__opts">
            {LINHA_DIAG_OPTS.map(o => (
              <label key={o.value} className={`pap-opt${form.diagnosticos.linhaCuidado === o.value ? " is-active" : ""}`}>
                <input type="radio" name="linhaCuidadoDiag" value={o.value} checked={form.diagnosticos.linhaCuidado === o.value} onChange={() => setForm(prev => ({ ...prev, diagnosticos: { ...prev.diagnosticos, linhaCuidado: o.value } }))} />
                {o.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ── PROCEDIMENTOS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Procedimentos Realizados</div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel required>Data da coleta / procedimento</FieldLabel>
            <Input type="date" value={form.procedimentos.dataColeta} onChange={e => sec("procedimentos", "dataColeta", e.target.value)} style={{ maxWidth: 200 }} />
          </div>
          <div className="pap-field" style={{ flex: 1 }}>
            <FieldLabel required>Profissional responsável</FieldLabel>
            <Select value={form.procedimentos.responsavelId} onChange={e => sec("procedimentos", "responsavelId", e.target.value)} placeholder="Selecionar..." style={{ maxWidth: 400 }}>
              <option value="">Selecionar...</option>
              {clinicians.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
            </Select>
          </div>
        </div>
        <div className="pap-field">
          <FieldLabel>Buscar procedimento</FieldLabel>
          <div style={{ position: "relative", maxWidth: 480 }}>
            <Input value={procQ} onChange={e => setProcQ(e.target.value)} placeholder="Ex: citopatológico, colposcopia..." />
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
        <div className="pap-field">
          <label className={`pap-opt${form.procedimentos.siscan ? " is-active" : ""}`} style={{ display: "inline-flex" }}>
            <input type="checkbox" checked={!!form.procedimentos.siscan} onChange={e => sec("procedimentos", "siscan", e.target.checked)} />
            Registrado no SISCAN
          </label>
        </div>
      </div>

      {/* ── CONDUTA ── */}
      <div className="pap-section">
        <div className="pap-section__title">Conduta</div>
        <div className="pap-field">
          <FieldLabel>Orientações fornecidas</FieldLabel>
          <Textarea value={form.conduta.orientacoes} onChange={e => sec("conduta", "orientacoes", e.target.value)} placeholder="Descreva as orientações fornecidas ao paciente..." rows={3} />
        </div>
        <RadioGroup label="Retorno" name="retorno" value={form.conduta.retorno} onChange={(_, v) => sec("conduta", "retorno", v)} options={RETORNO_OPTS} />
        {form.conduta.retorno === "agendamento_retorno" && (
          <div className="pap-field">
            <FieldLabel>Prazo de retorno (dias)</FieldLabel>
            <Input type="number" min="1" max="365" value={form.conduta.retornoDias} onChange={e => sec("conduta", "retornoDias", e.target.value)} placeholder="Ex: 30" style={{ maxWidth: 160 }} />
          </div>
        )}
        <CheckboxGroup label="Encaminhamentos" name="encaminhamentos" value={form.conduta.encaminhamentos} onChange={(_, v) => sec("conduta", "encaminhamentos", v)} options={ENCAMINHAMENTO_OPTS} />
        <div className="pap-field">
          <FieldLabel>Observações</FieldLabel>
          <Textarea value={form.conduta.observacoes} onChange={e => sec("conduta", "observacoes", e.target.value)} placeholder="Observações sobre a conduta..." rows={2} />
        </div>
      </div>

      {/* ── RESULTADO CITOPATOLÓGICO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Resultado Citopatológico</div>
        <div className="pap-field__hint" style={{ marginBottom: "var(--s-3)" }}>
          Preencha após o recebimento do laudo. Pode ser deixado em branco e preenchido posteriormente.
        </div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel>Data da coleta (laudo)</FieldLabel>
            <Input type="date" value={form.resultado.dataColeta} onChange={e => sec("resultado", "dataColeta", e.target.value)} style={{ maxWidth: 200 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Número do pedido</FieldLabel>
            <Input value={form.resultado.numeroPedido} onChange={e => sec("resultado", "numeroPedido", e.target.value)} placeholder="Ex: 2026/001234" style={{ maxWidth: 220 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>RA</FieldLabel>
            <Input value={form.resultado.ra} onChange={e => sec("resultado", "ra", e.target.value)} placeholder="Nº RA" style={{ maxWidth: 160 }} />
          </div>
        </div>
        <RadioGroup label="Tipo de amostra" name="tipoAmostra" value={form.resultado.tipoAmostra} onChange={(_, v) => sec("resultado", "tipoAmostra", v)} options={TIPO_AMOSTRA_OPTS} />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Adequabilidade da Amostra</div>
        <RadioGroup label="Adequabilidade" name="adequabilidade" value={form.resultado.adequabilidade} onChange={(_, v) => sec("resultado", "adequabilidade", v)} options={ADEQUABILIDADE_OPTS} />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Epitélios Representados</div>
        <CheckboxGroup label="Epitélios" name="epitelios" value={form.resultado.epitelios} onChange={(_, v) => sec("resultado", "epitelios", v)} options={EPITELIO_OPTS} />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Diagnóstico Descritivo</div>
        <RadioGroup label="Diagnóstico descritivo" name="diagnosticoDescritivo" value={form.resultado.diagnosticoDescritivo} onChange={(_, v) => sec("resultado", "diagnosticoDescritivo", v)} options={DIAGNOSTICO_DESCRITIVO_OPTS} />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Microbiologia</div>
        <CheckboxGroup label="Microorganismos identificados" name="microbiologia" value={form.resultado.microbiologia} onChange={(_, v) => sec("resultado", "microbiologia", v)} options={MICROBIOLOGIA_OPTS} />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Observações do Laudo</div>
        <div className="pap-field">
          <FieldLabel>Observações</FieldLabel>
          <Textarea value={form.resultado.observacoes} onChange={e => sec("resultado", "observacoes", e.target.value)} placeholder="Observações do laudo citopatológico..." rows={3} />
        </div>
      </div>

      {/* ── DOCUMENTOS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Documentos do Atendimento</div>
        <div className="pap-field__hint" style={{ marginBottom: "var(--s-4)" }}>
          Registre os documentos relacionados a este atendimento. O envio de arquivos físicos será integrado futuramente.
        </div>
        <div className="pap-row" style={{ alignItems: "flex-end" }}>
          <div className="pap-field" style={{ flex: 1 }}>
            <FieldLabel>Nome / descrição do documento</FieldLabel>
            <Input value={docName} onChange={e => setDocName(e.target.value)} placeholder="Ex: Laudo citopatológico 06/2026" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addDoc())} />
          </div>
          <div className="pap-field">
            <FieldLabel>Tipo</FieldLabel>
            <Select value={docType} onChange={e => setDocType(e.target.value)}>
              {Object.entries(FILE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
          <Button variant="secondary" size="sm" type="button" onClick={addDoc} style={{ marginBottom: 1 }}>+ Registrar</Button>
        </div>
        {(form.documentos.arquivos || []).length > 0 && (
          <div className="pap-field">
            <FieldLabel>Documentos registrados</FieldLabel>
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
        <div className="pap-field">
          <FieldLabel>Observações sobre documentos</FieldLabel>
          <Textarea value={form.documentos.observacoes} onChange={e => sec("documentos", "observacoes", e.target.value)} placeholder="Observações sobre os documentos deste atendimento..." rows={2} />
        </div>
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
