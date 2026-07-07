import { useState } from "react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import { api } from "../api.js";

const EMPTY_FORM = {
  motivoExame: "",
  fezePreventivo: "",
  ultimaColeta: "",
  usaDiu: "",
  estaGravida: "",
  usaAnticoncepcional: "",
  hormonioPosMenuopausa: "",
  realizouRadioterapia: "",
  sangramentoAposRelacao: "",
  sangramentoPosMenuopausa: "",
  dum: "",
  inspecaoColo: "",
  sinaisIst: "",
  dataColeta: "",
  responsavelColeta: "",
  siscan: false,
  observacoes: "",
};

function RadioGroup({ label, name, value, onChange, options, hint }) {
  return (
    <div className="pap-field">
      <div className="pap-field__label">{label}</div>
      {hint && <div className="pap-field__hint alert-notice">{hint}</div>}
      <div className="pap-field__opts">
        {options.map(opt => (
          <label key={opt.value} className={`pap-opt${value === opt.value ? " is-active" : ""}`}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(name, opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function PapanicolauForm({ patient, user, token, users, onSuccess }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, dataColeta: new Date().toISOString().slice(0, 10), responsavelColeta: user?.id || "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }));
    setErr("");
    setOk(false);
  }

  function validate() {
    if (!form.motivoExame) return "Motivo do exame é obrigatório.";
    if (!form.dataColeta) return "Data da coleta é obrigatória.";
    if (!form.responsavelColeta) return "Responsável pela coleta é obrigatório.";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errMsg = validate();
    if (errMsg) { setErr(errMsg); return; }

    const profissional = users?.find(u => u.id === form.responsavelColeta);
    const details = [
      `Motivo: ${labelMotivo(form.motivoExame)}`,
      form.fezePreventivo ? `Preventivo anterior: ${form.fezePreventivo === "sim" ? "Sim" : "Não"}` : "",
      form.ultimaColeta ? `Última coleta: ${form.ultimaColeta}` : "",
      form.inspecaoColo ? `Inspeção do colo: ${form.inspecaoColo}` : "",
      form.sinaisIst ? `Sinais IST: ${form.sinaisIst === "sim" ? "Sim" : "Não"}` : "",
      form.observacoes ? `Obs: ${form.observacoes}` : "",
    ].filter(Boolean).join(" · ");

    try {
      setBusy(true);
      await api(`/patients/${patient.id}/records`, {
        method: "POST",
        body: JSON.stringify({
          type: "nursing",
          title: "Coleta de Citopatológico de Colo do Útero (Papanicolau)",
          date: form.dataColeta,
          details,
          metadata: {
            subtype: "papanicolau",
            procedureCodes: ["02.01.02.003-3"],
            professionalId: form.responsavelColeta,
            professionalName: profissional ? (profissional.name || profissional.username) : (user?.name || ""),
            siscan: form.siscan,
            papanicolau: { ...form },
          },
        }),
      }, token);
      setOk(true);
      setErr("");
      setForm({ ...EMPTY_FORM, dataColeta: new Date().toISOString().slice(0, 10), responsavelColeta: user?.id || "" });
      onSuccess?.();
    } catch (error) {
      setErr(error?.message || "Erro ao salvar registro.");
    } finally {
      setBusy(false);
    }
  }

  function labelMotivo(v) {
    if (v === "rastreamento") return "Rastreamento";
    if (v === "repeticao") return "Repetição (ASCUS/Baixo grau)";
    if (v === "seguimento") return "Seguimento (pós colposcopia/tratamento)";
    return v;
  }

  const nursingUsers = users?.filter(u => ["nurse_manager", "nursing_tech", "doctor"].includes(u.role)) || [];

  return (
    <form className="pap-form" onSubmit={handleSubmit}>

      <div className="pap-section">
        <div className="pap-section__title">Dados da Anamnese</div>

        <RadioGroup
          label="1. Motivo do exame"
          name="motivoExame"
          value={form.motivoExame}
          onChange={set}
          options={[
            { value: "rastreamento", label: "Rastreamento" },
            { value: "repeticao", label: "Repetição (ASCUS/Baixo grau)" },
            { value: "seguimento", label: "Seguimento (pós colposcopia/tratamento)" },
          ]}
        />

        <RadioGroup
          label="2. Fez exame preventivo anteriormente?"
          name="fezePreventivo"
          value={form.fezePreventivo}
          onChange={set}
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
          ]}
        />

        {form.fezePreventivo === "sim" && (
          <RadioGroup
            label="Última coleta"
            name="ultimaColeta"
            value={form.ultimaColeta}
            onChange={set}
            options={[
              { value: "primeira_coleta", label: "Primeira coleta" },
              { value: "1_ano", label: "Há 1 ano" },
              { value: "2_anos", label: "Há 2 anos" },
              { value: "3_anos", label: "Há 3 anos" },
              { value: "mais_3_anos", label: "Há mais de 3 anos" },
            ]}
          />
        )}

        <RadioGroup
          label="3. Usa DIU?"
          name="usaDiu"
          value={form.usaDiu}
          onChange={set}
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
            { value: "nao_sabe", label: "Não sabe" },
          ]}
        />

        <RadioGroup
          label="4. Está grávida?"
          name="estaGravida"
          value={form.estaGravida}
          onChange={set}
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
            { value: "nao_sabe", label: "Não sabe" },
          ]}
        />

        <RadioGroup
          label="5. Usa anticoncepcional?"
          name="usaAnticoncepcional"
          value={form.usaAnticoncepcional}
          onChange={set}
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
            { value: "nao_sabe", label: "Não sabe" },
          ]}
        />

        <RadioGroup
          label="6. Usa hormônio para menopausa?"
          name="hormonioPosMenuopausa"
          value={form.hormonioPosMenuopausa}
          onChange={set}
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
            { value: "nao_sabe", label: "Não sabe" },
          ]}
        />

        <RadioGroup
          label="7. Já realizou radioterapia?"
          name="realizouRadioterapia"
          value={form.realizouRadioterapia}
          onChange={set}
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
            { value: "nao_sabe", label: "Não sabe" },
          ]}
        />

        <RadioGroup
          label="8. Sangramento após relação sexual?"
          name="sangramentoAposRelacao"
          value={form.sangramentoAposRelacao}
          onChange={set}
          hint="ATENÇÃO: NÃO CONSIDERAR A PRIMEIRA RELAÇÃO SEXUAL NA VIDA."
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
            { value: "nao_sabe", label: "Não sabe / Não lembra" },
          ]}
        />

        <RadioGroup
          label="9. Sangramento após menopausa?"
          name="sangramentoPosMenuopausa"
          value={form.sangramentoPosMenuopausa}
          onChange={set}
          hint="ATENÇÃO: NÃO CONSIDERAR SANGRAMENTOS DURANTE REPOSIÇÃO HORMONAL."
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
            { value: "nao_sabe", label: "Não sabe / Não lembra" },
            { value: "nao_menopausa", label: "Não está na menopausa" },
          ]}
        />

        <div className="pap-field">
          <div className="pap-field__label">DUM (Data da Última Menstruação)</div>
          <Input
            type="date"
            value={form.dum}
            onChange={e => set("dum", e.target.value)}
            style={{ maxWidth: 200 }}
          />
        </div>
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Exame Clínico</div>

        <RadioGroup
          label="10. Inspeção do colo"
          name="inspecaoColo"
          value={form.inspecaoColo}
          onChange={set}
          options={[
            { value: "normal", label: "Normal" },
            { value: "ausente", label: "Ausente" },
            { value: "alterado", label: "Alterado" },
            { value: "nao_visualizado", label: "Colo não visualizado" },
          ]}
        />

        <RadioGroup
          label="11. Sinais sugestivos de IST?"
          name="sinaisIst"
          value={form.sinaisIst}
          onChange={set}
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
          ]}
        />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Dados da Coleta</div>

        <div className="pap-row">
          <div className="pap-field">
            <div className="pap-field__label">Data da coleta <span style={{ color: "var(--danger)" }}>*</span></div>
            <Input
              type="date"
              value={form.dataColeta}
              onChange={e => set("dataColeta", e.target.value)}
              style={{ maxWidth: 200 }}
              required
            />
          </div>

          <div className="pap-field" style={{ flex: 1 }}>
            <div className="pap-field__label">Responsável pela coleta <span style={{ color: "var(--danger)" }}>*</span></div>
            <select
              className="select"
              value={form.responsavelColeta}
              onChange={e => set("responsavelColeta", e.target.value)}
              required
            >
              <option value="">Selecionar profissional...</option>
              {nursingUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name || u.username}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pap-field">
          <div className="pap-field__label">Procedimento</div>
          <div className="pap-procedure-code">
            <span className="pap-code">02.01.02.003-3</span>
            <span className="muted small"> — Coleta de citopatológico de colo uterino</span>
          </div>
        </div>

        <div className="pap-field">
          <label className="pap-opt" style={{ display: "inline-flex", gap: "var(--s-2)", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.siscan}
              onChange={e => set("siscan", e.target.checked)}
            />
            <span>Registrado no SISCAN</span>
          </label>
        </div>

        <div className="pap-field">
          <div className="pap-field__label">Observações</div>
          <Textarea
            value={form.observacoes}
            onChange={e => set("observacoes", e.target.value)}
            placeholder="Observações clínicas relevantes..."
            rows={3}
          />
        </div>
      </div>

      {err && <div className="alert alert--danger" style={{ marginBottom: "var(--s-3)" }}>{err}</div>}
      {ok && <div className="alert alert--success" style={{ marginBottom: "var(--s-3)" }}>Registro salvo com sucesso. Disponível no Histórico e Prontuário do paciente.</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--s-3)", paddingTop: "var(--s-3)", borderTop: "1px solid var(--border)" }}>
        <Button variant="primary" type="submit" loading={busy} disabled={busy || ok}>
          Salvar registro
        </Button>
      </div>
    </form>
  );
}
