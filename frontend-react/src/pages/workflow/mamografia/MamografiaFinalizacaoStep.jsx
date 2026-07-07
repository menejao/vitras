import { fmtDate } from "../../../utils/formatting";

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="wf-summary-row">
      <span className="wf-summary-row__label">{label}</span>
      <span className="wf-summary-row__value">{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  const hasContent = Array.isArray(children)
    ? children.some(c => c && c.type !== undefined ? true : Boolean(c))
    : Boolean(children);
  if (!hasContent) return null;
  return (
    <div className="wf-summary-section">
      <div className="wf-summary-section__title">{title}</div>
      {children}
    </div>
  );
}

const BIRADS_LABEL = {
  "0": "BI-RADS 0 — Inconclusivo",
  "1": "BI-RADS 1 — Sem achados",
  "2": "BI-RADS 2 — Achados benignos",
  "3": "BI-RADS 3 — Achados provavelmente benignos",
  "4": "BI-RADS 4 — Achados suspeitos de malignidade",
  "5": "BI-RADS 5 — Achados altamente suspeitos de malignidade",
  "6": "BI-RADS 6 — Diagnóstico de câncer comprovado",
};

const BIRADS_COLORS = {
  "0": "var(--text-muted)", "1": "var(--success, #16a34a)", "2": "var(--success, #16a34a)",
  "3": "var(--warning, #f59e0b)", "4": "#f97316",
  "5": "var(--danger, #dc2626)", "6": "#7c3aed",
};

const LOCAL_LABEL = {
  ubs: "UBS", unidade_movel: "Unidade Móvel", rua: "Rua", domicilio: "Domicílio",
  escola_creche: "Escola/Creche", polo_academia: "Polo/Academia da Saúde",
  instituicao_abrigo: "Instituição/Abrigo", unidade_prisional: "Unidade Prisional",
  unidade_socioeducativa: "Unidade Socioeducativa", outros: "Outros",
};

export default function MamografiaFinalizacaoStep({ formData, patient, users }) {
  const {
    identificacao = {}, imagem = {}, mamas = {},
    classificacao = {}, conduta = {},
    diagnosticos = {}, procedimentos = {}, documentos = {},
  } = formData;

  const prof = users?.find(u => u.id === identificacao.profissionalId);
  const profName = prof ? (prof.name || prof.username) : "—";
  const birads = classificacao.birads;
  const biradsCor = BIRADS_COLORS[birads];

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Revisão — Resultado de Mamografia</div>
        <p className="muted small" style={{ marginBottom: "var(--s-4)" }}>
          Revise as informações. Ao salvar, o registro será gravado no Histórico e Prontuário do paciente.
        </p>

        {birads && (
          <div className="wf-risco-badge" style={{ marginBottom: "var(--s-4)", borderLeftColor: biradsCor, color: biradsCor, fontWeight: 700, fontSize: "var(--t-md)" }}>
            {BIRADS_LABEL[birads]}
          </div>
        )}

        <Section title="Atendimento">
          <Row label="Paciente" value={patient?.name} />
          <Row label="Data" value={identificacao.dataAtendimento ? fmtDate(identificacao.dataAtendimento) : undefined} />
          <Row label="Hora" value={identificacao.horaAtendimento} />
          <Row label="Profissional" value={profName} />
          <Row label="Local" value={LOCAL_LABEL[identificacao.localAtendimento] || identificacao.localAtendimento} />
          <Row label="Data da coleta" value={identificacao.dataColeta ? fmtDate(identificacao.dataColeta) : undefined} />
          <Row label="Tipo" value={identificacao.tipoAtendimento} />
        </Section>

        <Section title="Imagem">
          <Row label="Pele" value={imagem.pele} />
          <Row label="Tipo de mama" value={imagem.tipoMama} />
          <Row label="Linfonodos axilares" value={imagem.linfonodosAxilares} />
          <Row label="Nódulo" value={imagem.noduloIdentificado} />
          <Row label="Microcalcificação" value={imagem.microcalcificacaoIdentificada} />
          <Row label="Assimetria focal" value={imagem.assimetriaFocalIdentificada} />
          <Row label="Assimetria difusa" value={imagem.assimetriaDifusaIdentificada} />
        </Section>

        <Section title="Achados por Mama">
          {(mamas.mamaDireita || []).length > 0 && (
            <Row label="Mama Direita" value={(mamas.mamaDireita || []).join(", ")} />
          )}
          {(mamas.mamaEsquerda || []).length > 0 && (
            <Row label="Mama Esquerda" value={(mamas.mamaEsquerda || []).join(", ")} />
          )}
        </Section>

        <Section title="Classificação e Condição">
          <Row label="BI-RADS" value={BIRADS_LABEL[birads]} />
          <Row label="Ultrassonografia" value={classificacao.ultrassonografia} />
          {(classificacao.problemasCondicoes || []).length > 0 && (
            <Row label="Condições avaliadas" value={(classificacao.problemasCondicoes || []).join(", ")} />
          )}
        </Section>

        <Section title="Conduta">
          <Row label="Orientação" value={conduta.orientacao} />
          {(conduta.desfecho || []).length > 0 && (
            <Row label="Desfecho" value={(conduta.desfecho || []).join(", ")} />
          )}
          <Row label="Encaminhamento interno" value={conduta.encaminhamentoInternoDestino} />
        </Section>

        {(diagnosticos.itens || []).length > 0 && (
          <Section title="Diagnósticos">
            {diagnosticos.itens.map(d => (
              <Row key={d.code} label={d.code} value={`${d.desc}${d.code === diagnosticos.principalCode ? " (principal)" : ""}`} />
            ))}
          </Section>
        )}

        {(procedimentos.itens || []).length > 0 && (
          <Section title="Procedimentos">
            {procedimentos.itens.map(p => <Row key={p.code} label={p.code} value={p.name} />)}
          </Section>
        )}

        {(documentos.arquivos || []).length > 0 && (
          <Section title="Documentos">
            {documentos.arquivos.map((a, i) => <Row key={i} label={a.type} value={a.name} />)}
          </Section>
        )}
      </div>
    </div>
  );
}
