import { fmtDate } from "../../../utils/formatting";

function SummaryRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="wf-summary-row">
      <span className="wf-summary-row__label">{label}</span>
      <span className="wf-summary-row__value">{value}</span>
    </div>
  );
}

function SummarySection({ title, children }) {
  const hasContent = Array.isArray(children)
    ? children.some(Boolean)
    : Boolean(children);
  if (!hasContent) return null;
  return (
    <div className="wf-summary-section">
      <div className="wf-summary-section__title">{title}</div>
      {children}
    </div>
  );
}

const LOCAL_LABEL = {
  ubs: "UBS", unidade_movel: "Unidade Móvel", rua: "Rua", domicilio: "Domicílio",
  escola_creche: "Escola/Creche", polo_academia: "Polo/Academia da Saúde",
  instituicao_abrigo: "Instituição/Abrigo", unidade_prisional: "Unidade Prisional",
  unidade_socioeducativa: "Unidade Socioeducativa", outros: "Outros",
};

const RISCO_LABEL = {
  nao_aguda: "Não aguda", aguda_baixa: "Aguda / Baixa",
  aguda_intermediaria: "Aguda / Intermediária", aguda_alta: "Aguda / Alta",
};

const RISCO_COLORS = {
  nao_aguda: "var(--success, #16a34a)", aguda_baixa: "var(--warning, #f59e0b)",
  aguda_intermediaria: "#f97316", aguda_alta: "var(--danger, #dc2626)",
};

export default function AcolhimentoFinalizacaoStep({ formData, patient, users }) {
  const {
    atendimento = {}, avaliacao = {}, medicoes = {},
    classificacaoConduta = {}, diagnosticos = {},
    procedimentos = {}, documentos = {},
  } = formData;

  const prof = users?.find(u => u.id === atendimento.profissionalId);
  const profName = prof ? (prof.name || prof.username) : "—";
  const risco = classificacaoConduta.classificacaoRisco;
  const riscoCor = RISCO_COLORS[risco];

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Revisão do Acolhimento</div>
        <p className="muted small" style={{ marginBottom: "var(--s-4)" }}>
          Revise as informações. Ao salvar, o registro será lançado como
          <strong> Demanda Espontânea — Escuta Inicial / Orientação</strong> no
          Histórico e Prontuário do paciente.
        </p>

        {risco && (
          <div className="wf-risco-badge" style={{ marginBottom: "var(--s-4)", borderLeftColor: riscoCor, color: riscoCor, fontWeight: 700 }}>
            Classificação de risco: {RISCO_LABEL[risco]}
          </div>
        )}

        <SummarySection title="Atendimento">
          <SummaryRow label="Paciente" value={patient?.name} />
          <SummaryRow label="Tipo" value="Demanda Espontânea — Escuta Inicial / Orientação" />
          <SummaryRow label="Data" value={atendimento.dataAtendimento ? fmtDate(atendimento.dataAtendimento) : undefined} />
          <SummaryRow label="Hora" value={atendimento.horaAtendimento} />
          <SummaryRow label="Local" value={LOCAL_LABEL[atendimento.localAtendimento] || atendimento.localAtendimento} />
          <SummaryRow label="Profissional" value={profName} />
        </SummarySection>

        <SummarySection title="Avaliação">
          <SummaryRow label="Motivo" value={avaliacao.motivoConsulta} />
          {(avaliacao.problemasCondicoes || []).length > 0 && (
            <SummaryRow label="Condições avaliadas" value={(avaliacao.problemasCondicoes || []).join(", ")} />
          )}
        </SummarySection>

        <SummarySection title="Medições">
          {medicoes.peso && <SummaryRow label="Peso" value={`${medicoes.peso} kg`} />}
          {medicoes.altura && <SummaryRow label="Altura" value={`${medicoes.altura} m`} />}
          {medicoes.imc && <SummaryRow label="IMC" value={medicoes.imc} />}
          {medicoes.afericaoPA === "sim" && <SummaryRow label="Pressão arterial" value={medicoes.pressaoArterial || "Sim (valor não registrado)"} />}
          {medicoes.frequenciaCardiaca && <SummaryRow label="FC" value={`${medicoes.frequenciaCardiaca} bpm`} />}
          {medicoes.temperatura && <SummaryRow label="Temperatura" value={`${medicoes.temperatura} °C`} />}
          {medicoes.saturacaoO2 && <SummaryRow label="SpO₂" value={`${medicoes.saturacaoO2}%`} />}
          {medicoes.glicemiaCapilar && <SummaryRow label="Glicemia" value={`${medicoes.glicemiaCapilar} mg/dL (${medicoes.momentoGlicemia || ""})`} />}
        </SummarySection>

        <SummarySection title="Classificação e Conduta">
          <SummaryRow label="Classificação de risco" value={RISCO_LABEL[risco]} />
          {(classificacaoConduta.condutaDesfecho || []).length > 0 && (
            <SummaryRow label="Conduta/Desfecho" value={(classificacaoConduta.condutaDesfecho || []).join(", ")} />
          )}
          <SummaryRow label="Observações" value={classificacaoConduta.observacoes} />
        </SummarySection>

        {(diagnosticos.itens || []).length > 0 && (
          <SummarySection title="Diagnósticos">
            {diagnosticos.itens.map(d => (
              <SummaryRow key={d.code} label={d.code} value={`${d.desc}${d.code === diagnosticos.principalCode ? " (principal)" : ""}`} />
            ))}
          </SummarySection>
        )}

        {(procedimentos.itens || []).length > 0 && (
          <SummarySection title="Procedimentos">
            {procedimentos.itens.map(p => (
              <SummaryRow key={p.code} label={p.code} value={p.name} />
            ))}
          </SummarySection>
        )}

        {(documentos.arquivos || []).length > 0 && (
          <SummarySection title="Documentos">
            {documentos.arquivos.map((a, i) => (
              <SummaryRow key={i} label={a.type} value={a.name} />
            ))}
          </SummarySection>
        )}
      </div>
    </div>
  );
}
