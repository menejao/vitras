import { useState, useEffect, useRef, useMemo } from "react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import { RadioGroup, CheckboxGroup, FieldLabel } from "./workflow/shared.jsx";
import { api } from "../api.js";
import { buildMamografiaRecord, EMPTY_MAMOGRAFIA } from "./workflow/mamografia/mamografiaWorkflow.js";

const LOCAL_OPTS = [
  { value: "ubs", label: "UBS" },
  { value: "unidade_movel", label: "Unidade móvel" },
  { value: "rua", label: "Rua" },
  { value: "domicilio", label: "Domicílio" },
  { value: "escola_creche", label: "Escola/Creche" },
  { value: "outros", label: "Outros" },
  { value: "polo_academia", label: "Polo (Academia da Saúde)" },
  { value: "instituicao_abrigo", label: "Instituição/Abrigo" },
  { value: "unidade_prisional", label: "Unidade prisional ou congêneres" },
  { value: "unidade_socioeducativa", label: "Unidade socioeducativa" },
];

const TIPO_OPTS = [
  { value: "agendada_programada", label: "Consulta Agendada Programada / Cuidado Continuado" },
  { value: "agendada", label: "Consulta Agendada" },
  { value: "demanda_espontanea_dia", label: "Demanda Espontânea/Consulta no Dia" },
  { value: "demanda_espontanea_urgencia", label: "Demanda Espontânea/Atendimento de Urgência" },
];

const PELE_OPTS = [
  { value: "normal", label: "Normal" },
  { value: "espessada", label: "Espessada" },
  { value: "retraida", label: "Retraída" },
  { value: "sem_informacao", label: "Sem Informação" },
];

const TIPO_MAMA_OPTS = [
  { value: "densa", label: "Densa" },
  { value: "adiposa", label: "Adiposa" },
  { value: "predominantemente_densa", label: "Predominantemente Densa" },
  { value: "predominantemente_adiposa", label: "Predominantemente Adiposa" },
  { value: "parenquima_deslocado_implante", label: "Parênquima Deslocado Anteriormente pelo Implante" },
  { value: "mama_reconstruida", label: "Mama Reconstruída" },
  { value: "sem_informacao", label: "Sem Informação" },
];

const LINFONODO_OPTS = [
  { value: "normais", label: "Normais" },
  { value: "nao_visualizados", label: "Não Visibilizados" },
  { value: "aumentados", label: "Aumentados" },
  { value: "densos", label: "Densos" },
  { value: "confluentes", label: "Confluentes" },
  { value: "dilatacao_ductal_retroareolar", label: "Dilatação Ductal Isolada na Região Retroaerolar" },
];

const SIM_NAO = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
];

const ACHADOS_OPTS = [
  { value: "nodulo_gordura", label: "Nódulo com densidade de gordura (sugere lipoma)" },
  { value: "nodulo_calcificado", label: "Nódulo calcificado (sugere fibroadenoma)" },
  { value: "nodulo_heterogeneo", label: "Nódulo com densidade heterogênea (sugere fibroadenolipoma)" },
  { value: "cisto_oleoso", label: "Cisto oleoso (esteatonecrose)" },
  { value: "calcificacoes_vasculares", label: "Calcificações vasculares" },
  { value: "calcificacoes_benignas", label: "Calcificações tipicamente benignas" },
  { value: "linfonodos_intramamarios", label: "Linfonodos intramamários" },
  { value: "distorcao_cirurgia", label: "Distorção arquitetural por cirurgia" },
  { value: "implante_sem_ruptura", label: "Implante sem sinais de ruptura" },
  { value: "implante_com_ruptura", label: "Implante com sinais de ruptura" },
  { value: "ectasia_ductal", label: "Ectasia ductal" },
  { value: "ginecomastia", label: "Ginecomastia" },
];

const BIRADS_OPTS = [
  { value: "0", label: "BI-RADS 0 (Inconclusivo)" },
  { value: "1", label: "BI-RADS 1 (Sem achados)" },
  { value: "2", label: "BI-RADS 2 (Achados benignos)" },
  { value: "3", label: "BI-RADS 3 (Achados provavelmente benignos)" },
  { value: "4", label: "BI-RADS 4 (Achados suspeitos de malignidade)" },
  { value: "5", label: "BI-RADS 5 (Achados altamente suspeitos de malignidade)" },
  { value: "6", label: "BI-RADS 6 (Diagnóstico de câncer comprovado histologicamente-Biópsia)" },
];

const BIRADS_COLORS = {
  "0": "var(--text-muted)", "1": "var(--success, #16a34a)", "2": "var(--success, #16a34a)",
  "3": "var(--warning, #f59e0b)", "4": "#f97316",
  "5": "var(--danger, #dc2626)", "6": "#7c3aed",
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

const DESFECHO_OPTS = [
  { value: "retorno_agendado", label: "Retorno para consulta agendada" },
  { value: "cuidado_continuado", label: "Retorno para cuidado continuado / programado" },
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

const CID10 = [
  { code: "Z12.3", desc: "Exame de rastreamento — neoplasia da mama" },
  { code: "C50.9", desc: "Neoplasia maligna da mama, parte não especificada" },
  { code: "D05.9", desc: "Carcinoma in situ da mama, parte não especificada" },
  { code: "N60.0", desc: "Cisto solitário da mama" },
  { code: "N60.1", desc: "Mastopatia fibrocística difusa" },
  { code: "N63",   desc: "Nódulo não especificado na mama" },
  { code: "Z12.4", desc: "Exame de rastreamento — neoplasia do colo uterino" },
  { code: "I10",   desc: "Hipertensão essencial (primária)" },
  { code: "E11.9", desc: "Diabetes mellitus tipo 2 sem complicações" },
  { code: "E66.0", desc: "Obesidade por excesso de calorias" },
  { code: "N95.1", desc: "Menopausa e estados climatéricos femininos" },
  { code: "Z00.0", desc: "Exame médico geral" },
  { code: "Z71.1", desc: "Visita para fins de saúde / orientação" },
];

const FILE_TYPE_LABELS = {
  laudo: "Laudo", imagem: "Imagem", receita: "Receita", atestado: "Atestado", outro: "Outro",
};

export default function MamografiaForm({ patient, user, token, users, onRecordSaved }) {
  function makeEmpty() {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toTimeString().slice(0, 5);
    return {
      ...EMPTY_MAMOGRAFIA,
      identificacao: { ...EMPTY_MAMOGRAFIA.identificacao, dataAtendimento: today, horaAtendimento: now, profissionalId: user?.id || "" },
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
      const record = buildMamografiaRecord(form, patient, users);
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

  const birads = form.classificacao.birads;
  const biradsCor = BIRADS_COLORS[birads];
  const temEncInterno = (form.conduta.desfecho || []).includes("encaminhamento_interno");

  return (
    <form className="pap-form" onSubmit={handleSubmit}>

      {/* ── IDENTIFICAÇÃO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Identificação do Atendimento</div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel required>Data do atendimento</FieldLabel>
            <Input type="date" value={form.identificacao.dataAtendimento} onChange={e => sec("identificacao", "dataAtendimento", e.target.value)} style={{ maxWidth: 200 }} />
          </div>
          <div className="pap-field">
            <FieldLabel>Hora</FieldLabel>
            <Input type="time" value={form.identificacao.horaAtendimento} onChange={e => sec("identificacao", "horaAtendimento", e.target.value)} style={{ maxWidth: 140 }} />
          </div>
        </div>
      </div>

      {/* ── LOCAL ── */}
      <div className="pap-section">
        <div className="pap-section__title">Local de Atendimento</div>
        <RadioGroup label="Local" name="localAtendimento" value={form.identificacao.localAtendimento} onChange={(_, v) => sec("identificacao", "localAtendimento", v)} options={LOCAL_OPTS} />
      </div>

      {/* ── TIPO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Tipo de Atendimento (e-SUS)</div>
        <RadioGroup label="Tipo" name="tipoAtendimento" value={form.identificacao.tipoAtendimento} onChange={(_, v) => sec("identificacao", "tipoAtendimento", v)} options={TIPO_OPTS} />
      </div>

      {/* ── DATA COLETA ── */}
      <div className="pap-section">
        <div className="pap-section__title">Data da Coleta</div>
        <div className="pap-field">
          <FieldLabel required>Data da coleta (mamografia)</FieldLabel>
          <Input type="date" value={form.identificacao.dataColeta} onChange={e => sec("identificacao", "dataColeta", e.target.value)} style={{ maxWidth: 200 }} />
        </div>
      </div>

      {/* ── PELE ── */}
      <div className="pap-section">
        <div className="pap-section__title">Pele</div>
        <RadioGroup label="Pele" name="pele" value={form.imagem.pele} onChange={(_, v) => sec("imagem", "pele", v)} options={PELE_OPTS} />
      </div>

      {/* ── TIPO DE MAMA ── */}
      <div className="pap-section">
        <div className="pap-section__title">Tipo de Mama</div>
        <RadioGroup label="Tipo de mama" name="tipoMama" value={form.imagem.tipoMama} onChange={(_, v) => sec("imagem", "tipoMama", v)} options={TIPO_MAMA_OPTS} />
      </div>

      {/* ── ACHADOS GERAIS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Achados Gerais</div>
        <RadioGroup label="Nódulo Identificado" name="noduloIdentificado" value={form.imagem.noduloIdentificado} onChange={(_, v) => sec("imagem", "noduloIdentificado", v)} options={SIM_NAO} />
        <RadioGroup label="Microcalcificação Identificada" name="microcalcificacaoIdentificada" value={form.imagem.microcalcificacaoIdentificada} onChange={(_, v) => sec("imagem", "microcalcificacaoIdentificada", v)} options={SIM_NAO} />
        <RadioGroup label="Assimetria Focal Identificada" name="assimetriaFocalIdentificada" value={form.imagem.assimetriaFocalIdentificada} onChange={(_, v) => sec("imagem", "assimetriaFocalIdentificada", v)} options={SIM_NAO} />
        <RadioGroup label="Assimetria Difusa Identificada" name="assimetriaDifusaIdentificada" value={form.imagem.assimetriaDifusaIdentificada} onChange={(_, v) => sec("imagem", "assimetriaDifusaIdentificada", v)} options={SIM_NAO} />
      </div>

      {/* ── LINFONODOS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Linfonodos Axilares</div>
        <RadioGroup label="Linfonodos Axilares" name="linfonodosAxilares" value={form.imagem.linfonodosAxilares} onChange={(_, v) => sec("imagem", "linfonodosAxilares", v)} options={LINFONODO_OPTS} />
      </div>

      {/* ── MAMA DIREITA ── */}
      <div className="pap-section">
        <div className="pap-section__title">Mama Direita</div>
        <CheckboxGroup label="Achados — Mama Direita" name="mamaDireita" value={form.mamas.mamaDireita} onChange={(_, v) => sec("mamas", "mamaDireita", v)} options={ACHADOS_OPTS} />
      </div>

      {/* ── MAMA ESQUERDA ── */}
      <div className="pap-section">
        <div className="pap-section__title">Mama Esquerda</div>
        <CheckboxGroup label="Achados — Mama Esquerda" name="mamaEsquerda" value={form.mamas.mamaEsquerda} onChange={(_, v) => sec("mamas", "mamaEsquerda", v)} options={ACHADOS_OPTS} />
      </div>

      {/* ── BI-RADS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Classificação Radiológica</div>
        <div className="pap-field">
          <FieldLabel required>BI-RADS</FieldLabel>
          <div className="pap-field__opts" style={{ flexDirection: "column", gap: "var(--s-2)" }}>
            {BIRADS_OPTS.map(opt => {
              const cor = BIRADS_COLORS[opt.value];
              const ativo = birads === opt.value;
              return (
                <label key={opt.value} className={`pap-opt${ativo ? " is-active" : ""}`} style={ativo ? { borderColor: cor, background: cor + "15", color: cor, fontWeight: 700 } : {}}>
                  <input type="radio" name="birads" value={opt.value} checked={ativo} onChange={() => sec("classificacao", "birads", opt.value)} />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
        {birads && (
          <div className="wf-risco-badge" style={{ borderLeftColor: biradsCor, color: biradsCor }}>
            <strong>BI-RADS {birads}</strong>{["4", "5", "6"].includes(birads) && " — Recomenda-se encaminhamento para avaliação especializada."}
          </div>
        )}
      </div>

      {/* ── USG ── */}
      <div className="pap-section">
        <div className="pap-section__title">Apresentou Resultado de Ultrassonografia de Mamas Nesta Consulta</div>
        <RadioGroup label="Ultrassonografia" name="ultrassonografia" value={form.classificacao.ultrassonografia} onChange={(_, v) => sec("classificacao", "ultrassonografia", v)} options={SIM_NAO} />
      </div>

      {/* ── PROBLEMA / CONDIÇÃO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Problema / Condição Avaliada</div>
        <CheckboxGroup label="Condições avaliadas" name="problemasCondicoes" value={form.classificacao.problemasCondicoes} onChange={(_, v) => sec("classificacao", "problemasCondicoes", v)} options={PROBLEMAS_OPTS} />
      </div>

      {/* ── CONDUTA / ORIENTAÇÃO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Conduta/Orientação</div>
        <div className="pap-field">
          <Textarea value={form.conduta.orientacao} onChange={e => sec("conduta", "orientacao", e.target.value)} placeholder="Orientações, recomendações e condutas adotadas..." rows={4} />
        </div>
      </div>

      {/* ── CONDUTA / DESFECHO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Conduta / Desfecho</div>
        <CheckboxGroup label="Condutas adotadas" name="desfecho" value={form.conduta.desfecho} onChange={(_, v) => sec("conduta", "desfecho", v)} options={DESFECHO_OPTS} />
        {temEncInterno && (
          <div className="pap-field">
            <FieldLabel>Destino do encaminhamento interno</FieldLabel>
            <Input value={form.conduta.encaminhamentoInternoDestino} onChange={e => sec("conduta", "encaminhamentoInternoDestino", e.target.value)} placeholder="Ex: Médico de referência, Ginecologista, Mastologista..." style={{ maxWidth: 400 }} />
          </div>
        )}
      </div>

      {/* ── PROCEDIMENTOS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Novo Procedimento</div>
        <div className="pap-field">
          <FieldLabel>Buscar procedimento</FieldLabel>
          <div style={{ position: "relative", maxWidth: 480 }}>
            <Input value={procQ} onChange={e => setProcQ(e.target.value)} placeholder="Ex: mamografia, ultrassom, biópsia..." />
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
            <Input value={cidQ} onChange={e => setCidQ(e.target.value)} placeholder="Ex: C50, mama, neoplasia..." />
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
            <FieldLabel>Diagnósticos</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {form.diagnosticos.itens.map(item => (
                <div key={item.code} className={`wf-diag-item${item.code === form.diagnosticos.principalCode ? " is-principal" : ""}`}>
                  <label style={{ flex: 1, display: "flex", alignItems: "center", gap: "var(--s-2)", cursor: "pointer" }}>
                    <input type="radio" name="principalCodeMamo" checked={item.code === form.diagnosticos.principalCode} onChange={() => setForm(prev => ({ ...prev, diagnosticos: { ...prev.diagnosticos, principalCode: item.code } }))} />
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
          <Input value={form.diagnosticos.linhaCuidado} onChange={e => sec("diagnosticos", "linhaCuidado", e.target.value)} placeholder="Ex: Rastreamento de Câncer de Mama, Saúde da Mulher..." style={{ maxWidth: 480 }} />
        </div>
      </div>

      {/* ── DOCUMENTOS ── */}
      <div className="pap-section">
        <div className="pap-section__title">Anexar Arquivos</div>
        <div className="pap-row" style={{ alignItems: "flex-end" }}>
          <div className="pap-field" style={{ flex: 1 }}>
            <FieldLabel>Nome / descrição do documento</FieldLabel>
            <input className="input" value={docName} onChange={e => setDocName(e.target.value)} placeholder="Ex: Laudo mamografia 06/2026" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addDoc())} />
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
      <div className="pap-section" style={{ border: "none", paddingTop: 0 }}>
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
