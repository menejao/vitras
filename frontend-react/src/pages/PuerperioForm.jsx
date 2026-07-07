import { useState, useRef } from "react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import { RadioGroup, CheckboxGroup, FieldLabel } from "./workflow/shared.jsx";
import { api } from "../api.js";
import { buildPuerperioRecord, EMPTY_PUERPERIO } from "./workflow/puerperio/puerperioWorkflow.js";

const LOCAL_OPTS = [
  { value: "ubs",                   label: "UBS" },
  { value: "unidade_movel",         label: "Unidade Móvel" },
  { value: "rua",                   label: "Rua" },
  { value: "domicilio",             label: "Domicílio" },
  { value: "escola_creche",         label: "Escola/Creche" },
  { value: "outros",                label: "Outros" },
  { value: "polo_academia",         label: "Polo (Academia da Saúde)" },
  { value: "instituicao_abrigo",    label: "Instituição/Abrigo" },
  { value: "unidade_prisional",     label: "Unidade prisional ou congêneres" },
  { value: "unidade_socioeducativa",label: "Unidade socioeducativa" },
];

const TIPO_ATENDIMENTO_OPTS = [
  { value: "consulta_puerperio",  label: "Consulta de puericultura/puerpério (atenção básica)" },
  { value: "visita_domiciliar",   label: "Visita domiciliar pós-parto" },
];

const DESFECHO_GESTACIONAL_OPTS = [
  { value: "parto_normal",        label: "Parto normal" },
  { value: "cesareo",             label: "Parto cesáreo" },
  { value: "aborto_espontaneo",   label: "Aborto espontâneo" },
  { value: "aborto_provocado",    label: "Aborto provocado" },
  { value: "natimorto",           label: "Natimorto" },
];

const SIM_NAO_OPTS = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
];

const ESTADO_PSIQUICO_OPTS = [
  { value: "normal",    label: "Normal" },
  { value: "alterado",  label: "Alterado / Suspeita de depressão pós-parto" },
  { value: "ansiedade", label: "Ansiedade" },
  { value: "outros",    label: "Outros" },
];

const MAMAS_OPTS = [
  { value: "normal",        label: "Normal" },
  { value: "anormal",       label: "Anormal" },
  { value: "nao_examinada", label: "Não examinada" },
];

const EPISIOTOMIA_OPTS = [
  { value: "normal",        label: "Normal" },
  { value: "anormal",       label: "Anormal" },
  { value: "nao_realizada", label: "Não realizada" },
];

const INVOLUCAO_OPTS = [
  { value: "normal",        label: "Normal" },
  { value: "anormal",       label: "Anormal" },
  { value: "nao_examinada", label: "Não examinada" },
];

const LOQUIOS_OPTS = [
  { value: "ausente",        label: "Ausente" },
  { value: "rosado",         label: "Rosado" },
  { value: "sanguinolento",  label: "Sanguinolento" },
  { value: "purulento",      label: "Purulento" },
  { value: "outros",         label: "Outros" },
];

const ORIENTACOES_OPTS = [
  { value: "aleitamento_materno_exclusivo", label: "Aleitamento materno exclusivo" },
  { value: "cuidados_rn",                  label: "Cuidados com o RN" },
  { value: "anticoncepcao",                label: "Anticoncepção" },
  { value: "higiene_autocuidado",          label: "Higiene e autocuidado" },
  { value: "sinais_alerta",               label: "Sinais de alerta" },
  { value: "retorno_consulta",             label: "Retorno à consulta" },
  { value: "outros",                       label: "Outros" },
];

const DESFECHO_OPTS = [
  { value: "alta",                   label: "Alta" },
  { value: "retorno_programado",     label: "Retorno programado" },
  { value: "encaminhamento",         label: "Encaminhamento" },
  { value: "encaminhamento_interno", label: "Encaminhamento Interno" },
  { value: "obito_materno",          label: "Óbito materno" },
];

const ENC_INTERNO_OPTS = [
  { value: "medico",            label: "Médico(a) da equipe" },
  { value: "ginecologista",     label: "Ginecologista/Obstetra" },
  { value: "nutricao",          label: "Nutrição" },
  { value: "psicologia",        label: "Psicologia" },
  { value: "servico_social",    label: "Serviço Social" },
  { value: "odontologia",       label: "Odontologia" },
  { value: "fisioterapia",      label: "Fisioterapia" },
  { value: "farmacia",          label: "Farmácia" },
  { value: "caps",              label: "CAPS" },
  { value: "ubs_referencia",    label: "UBS de referência" },
];

export default function PuerperioForm({ patient, user, token, onRecordSaved }) {
  function makeEmpty() {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toTimeString().slice(0, 5);
    return {
      ...EMPTY_PUERPERIO,
      atendimento: { ...EMPTY_PUERPERIO.atendimento, dataAtendimento: today, horaAtendimento: now },
    };
  }

  const [form, setForm] = useState(makeEmpty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const [procQ, setProcQ] = useState("");
  const [procResults, setProcResults] = useState([]);
  const [procLoading, setProcLoading] = useState(false);
  const procDebounce = useRef(null);

  function sec(section, field, val) {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: val } }));
    setErr(""); setOk(false);
  }

  function toggleOrientacao(val) {
    const cur = form.conduta.orientacoes || [];
    const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];
    setForm(prev => ({ ...prev, conduta: { ...prev.conduta, orientacoes: next } }));
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
      finally { setProcLoading(false); }
    }, 300);
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

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk(false);
    try {
      const record = buildPuerperioRecord(form, patient);
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

  const temEncInterno = form.conduta.desfecho === "encaminhamento_interno";

  return (
    <form className="pap-form" onSubmit={handleSubmit}>

      {/* ── IDENTIFICAÇÃO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Identificação</div>
        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel required>Data do atendimento</FieldLabel>
            <Input type="date" value={form.atendimento.dataAtendimento} onChange={e => sec("atendimento", "dataAtendimento", e.target.value)} />
          </div>
          <div className="pap-field">
            <FieldLabel>Hora</FieldLabel>
            <Input type="time" value={form.atendimento.horaAtendimento} onChange={e => sec("atendimento", "horaAtendimento", e.target.value)} />
          </div>
        </div>
        <RadioGroup
          label="Local de atendimento"
          name="localAtendimento"
          value={form.atendimento.localAtendimento}
          onChange={(_, v) => sec("atendimento", "localAtendimento", v)}
          options={LOCAL_OPTS}
        />
        <RadioGroup
          label="Tipo de atendimento e-SUS"
          name="tipoAtendimento"
          value={form.atendimento.tipoAtendimento}
          onChange={(_, v) => sec("atendimento", "tipoAtendimento", v)}
          options={TIPO_ATENDIMENTO_OPTS}
        />
      </div>

      {/* ── PROBLEMA / CONDIÇÃO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Problema / Condição Avaliada</div>
        <div className="pap-field">
          <FieldLabel>Condição</FieldLabel>
          <div className="pap-field__opts">
            <span className="pap-opt is-active">
              <input type="checkbox" checked readOnly style={{ pointerEvents: "none" }} />
              Puerpério até 30 dias
            </span>
          </div>
        </div>
      </div>

      {/* ── DESFECHO GESTACIONAL ── */}
      <div className="pap-section">
        <div className="pap-section__title">Desfecho Gestacional</div>
        <RadioGroup
          label="Tipo de desfecho"
          name="desfechoTipo"
          value={form.desfechoGestacional.tipo}
          onChange={(_, v) => sec("desfechoGestacional", "tipo", v)}
          options={DESFECHO_GESTACIONAL_OPTS}
        />
      </div>

      {/* ── DADOS DO ATENDIMENTO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Dados do Atendimento</div>
        <div className="pap-field" style={{ maxWidth: 240 }}>
          <FieldLabel>Pressão arterial (mmHg)</FieldLabel>
          <Input
            value={form.dadosAtendimento.pressaoArterial}
            onChange={e => sec("dadosAtendimento", "pressaoArterial", e.target.value)}
            placeholder="Ex: 120/80"
          />
        </div>
        <RadioGroup
          label="Vacinação em dia"
          name="vacinacaoEmDia"
          value={form.dadosAtendimento.vacinacaoEmDia}
          onChange={(_, v) => sec("dadosAtendimento", "vacinacaoEmDia", v)}
          options={SIM_NAO_OPTS}
        />
        <RadioGroup
          label="Realizou pré-natal"
          name="realizouPreNatal"
          value={form.dadosAtendimento.realizouPreNatal}
          onChange={(_, v) => sec("dadosAtendimento", "realizouPreNatal", v)}
          options={SIM_NAO_OPTS}
        />
        <RadioGroup
          label="Avaliação odontológica no pré-natal"
          name="avaliacaoOdontologica"
          value={form.dadosAtendimento.avaliacaoOdontologica}
          onChange={(_, v) => sec("dadosAtendimento", "avaliacaoOdontologica", v)}
          options={SIM_NAO_OPTS}
        />
        <RadioGroup
          label="Situação social de risco"
          name="situacaoSocialRisco"
          value={form.dadosAtendimento.situacaoSocialRisco}
          onChange={(_, v) => sec("dadosAtendimento", "situacaoSocialRisco", v)}
          options={SIM_NAO_OPTS}
        />
        <RadioGroup
          label="Estado psíquico da puérpera"
          name="estadoPsiquico"
          value={form.dadosAtendimento.estadoPsiquico}
          onChange={(_, v) => sec("dadosAtendimento", "estadoPsiquico", v)}
          options={ESTADO_PSIQUICO_OPTS}
        />
        <RadioGroup
          label="Febre pós-parto"
          name="febrePosOperatorio"
          value={form.dadosAtendimento.febrePosOperatorio}
          onChange={(_, v) => sec("dadosAtendimento", "febrePosOperatorio", v)}
          options={SIM_NAO_OPTS}
        />
        <RadioGroup
          label="Parceiro sexual fixo"
          name="parceiroSexualFixo"
          value={form.dadosAtendimento.parceiroSexualFixo}
          onChange={(_, v) => sec("dadosAtendimento", "parceiroSexualFixo", v)}
          options={SIM_NAO_OPTS}
        />
        <RadioGroup
          label="Parceiro presente na consulta"
          name="parceiroPresenteConsulta"
          value={form.dadosAtendimento.parceiroPresenteConsulta}
          onChange={(_, v) => sec("dadosAtendimento", "parceiroPresenteConsulta", v)}
          options={SIM_NAO_OPTS}
        />
        <RadioGroup
          label="É etilista"
          name="etilista"
          value={form.dadosAtendimento.etilista}
          onChange={(_, v) => sec("dadosAtendimento", "etilista", v)}
          options={SIM_NAO_OPTS}
        />
        <RadioGroup
          label="IST tratada ou em tratamento"
          name="istTratada"
          value={form.dadosAtendimento.istTratada}
          onChange={(_, v) => sec("dadosAtendimento", "istTratada", v)}
          options={SIM_NAO_OPTS}
        />
        <RadioGroup
          label="Uso de imunoglobulina Anti-D"
          name="imunoglobulinaAntiD"
          value={form.dadosAtendimento.imunoglobulinaAntiD}
          onChange={(_, v) => sec("dadosAtendimento", "imunoglobulinaAntiD", v)}
          options={SIM_NAO_OPTS}
        />
      </div>

      {/* ── EXAME FÍSICO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Exame Físico</div>
        <RadioGroup
          label="Mamas"
          name="mamas"
          value={form.exameFisico.mamas}
          onChange={(_, v) => sec("exameFisico", "mamas", v)}
          options={MAMAS_OPTS}
        />
        <RadioGroup
          label="Episiotomia / cicatriz de cesárea"
          name="episiotomia"
          value={form.exameFisico.episiotomia}
          onChange={(_, v) => sec("exameFisico", "episiotomia", v)}
          options={EPISIOTOMIA_OPTS}
        />
        <RadioGroup
          label="Involução uterina"
          name="involucaoUterina"
          value={form.exameFisico.involucaoUterina}
          onChange={(_, v) => sec("exameFisico", "involucaoUterina", v)}
          options={INVOLUCAO_OPTS}
        />
        <RadioGroup
          label="Presença de lóquios"
          name="loquios"
          value={form.exameFisico.loquios}
          onChange={(_, v) => sec("exameFisico", "loquios", v)}
          options={LOQUIOS_OPTS}
        />
        <div className="pap-field">
          <FieldLabel>Observações do exame físico</FieldLabel>
          <Textarea
            value={form.exameFisico.observacoes}
            onChange={e => sec("exameFisico", "observacoes", e.target.value)}
            placeholder="Observações adicionais..."
            rows={3}
          />
        </div>
      </div>

      {/* ── CONDUTA / DESFECHO ── */}
      <div className="pap-section">
        <div className="pap-section__title">Conduta / Desfecho</div>
        <RadioGroup
          label="Agendado planejamento reprodutivo"
          name="planejamentoReprodutivo"
          value={form.conduta.planejamentoReprodutivo}
          onChange={(_, v) => sec("conduta", "planejamentoReprodutivo", v)}
          options={SIM_NAO_OPTS}
        />
        <CheckboxGroup
          label="Conduta / Orientação"
          name="orientacoes"
          values={form.conduta.orientacoes}
          onChange={(_, v) => toggleOrientacao(v)}
          options={ORIENTACOES_OPTS}
        />
        <RadioGroup
          label="Desfecho"
          name="desfecho"
          value={form.conduta.desfecho}
          onChange={(_, v) => sec("conduta", "desfecho", v)}
          options={DESFECHO_OPTS}
        />
        {temEncInterno && (
          <div className="pap-field">
            <FieldLabel>Encaminhamento interno — destino</FieldLabel>
            <select
              className="select"
              value={form.conduta.observacoes}
              onChange={e => sec("conduta", "observacoes", e.target.value)}
              style={{ maxWidth: 360 }}
            >
              <option value="">Selecione o destino...</option>
              {ENC_INTERNO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
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
              placeholder={procLoading ? "Buscando..." : "Ex: 0301010072, colposcopia..."}
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

      {/* ── AÇÕES ── */}
      <div className="pap-section pap-section--actions">
        {err && <div className="alert alert--danger" style={{ marginBottom: "var(--s-3)" }}>{err}</div>}
        {ok && <div className="alert alert--success" style={{ marginBottom: "var(--s-3)" }}>Atendimento de puerpério salvo com sucesso no prontuário.</div>}
        <div style={{ display: "flex", gap: "var(--s-3)", justifyContent: "flex-end" }}>
          <Button variant="secondary" type="button" disabled={busy} onClick={() => { setForm(makeEmpty()); setErr(""); setOk(false); }}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={busy}>{busy ? "Salvando..." : "Finalizar Atendimento"}</Button>
        </div>
      </div>
    </form>
  );
}
