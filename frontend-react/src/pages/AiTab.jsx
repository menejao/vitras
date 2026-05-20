import PageLayout from "../components/layout/PageLayout";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

const IconPriority = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 6h16M4 12h10M4 18h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconQuality = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);
const IconReport = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 17H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <rect x="9" y="15" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 8h6M9 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ACTION_CARDS = [
  {
    id: "priorities",
    icon: <IconPriority />,
    title: "Prioridades do dia",
    desc: "Lista classificada de pacientes que requerem atencao imediata com base em risco clinico e protocolos vigentes.",
  },
  {
    id: "quality",
    icon: <IconQuality />,
    title: "Qualidade de dados",
    desc: "Identificacao de inconsistencias, campos ausentes e cadastros incompletos que impactam indicadores e relatorios.",
  },
  {
    id: "report",
    icon: <IconReport />,
    title: "Relatorio executivo",
    desc: "Sumario gerencial consolidado com indicadores de produtividade, cobertura e alertas da unidade.",
  },
];

function ResultPanel({ aiView, aiData }) {
  if (!aiData) return null;

  if (aiView === "priorities") {
    const items = Array.isArray(aiData?.items) ? aiData.items : [];
    return (
      <Card className="card--noPad">
        <div className="card__header">
          <div>
            <div className="card__title">Prioridades do dia</div>
            <div className="card__subtitle">{items.length} paciente(s) identificado(s)</div>
          </div>
        </div>
        <div className="card__body">
          {items.length === 0 ? (
            <Alert tone="info">Nenhum paciente priorizado para o dia atual.</Alert>
          ) : (
            <div className="ai-priority-list">
              {items.map((item, idx) => {
                const level = String(item?.risk?.level || "").toLowerCase();
                const tone = level === "high" ? "danger" : "warning";
                return (
                  <div key={item.patientId || idx} className="ai-priority-item">
                    <div className="ai-priority-item__rank">{idx + 1}</div>
                    <div className="ai-priority-item__body">
                      <div className="ai-priority-item__name">{item.patientName}</div>
                      <div className="ai-priority-item__action">{item.topAction || "Revisar pendencias"}</div>
                    </div>
                    <div className={`ai-priority-item__badge badge badge--${tone}`}>
                      {String(item?.risk?.level || "-").toUpperCase()} · {item?.risk?.score || 0}pts
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    );
  }

  if (aiView === "quality") {
    const findings = Array.isArray(aiData?.findings) ? aiData.findings : [];
    return (
      <Card className="card--noPad">
        <div className="card__header">
          <div>
            <div className="card__title">Qualidade de dados</div>
            <div className="card__subtitle">{findings.length} ocorrencia(s) encontrada(s)</div>
          </div>
        </div>
        <div className="card__body">
          {findings.length === 0 ? (
            <Alert tone="success">Nenhuma inconsistencia detectada nos registros consultados.</Alert>
          ) : (
            <div className="ai-findings-list">
              {findings.map((f, idx) => (
                <div key={idx} className="ai-finding-item">
                  <div className="ai-finding-item__patient">{f.patientName || "Paciente nao identificado"}</div>
                  <div className="ai-finding-item__issue">{f.issue || "Inconsistencia nao detalhada"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    );
  }

  if (aiView === "report") {
    const totals = aiData?.totals || {};
    const recs = Array.isArray(aiData?.recommendations) ? aiData.recommendations : [];
    return (
      <Card className="card--noPad">
        <div className="card__header">
          <div className="card__title">Relatorio executivo</div>
        </div>
        <div className="card__body">
          {aiData?.executiveSummary && (
            <p className="ai-report__summary">{aiData.executiveSummary}</p>
          )}
          <div className="ai-report__totals">
            {[["Pacientes", totals.patients], ["Alto risco", totals.highRiskPatients], ["Tarefas vencidas", totals.overdueTasks]].map(([label, val]) => (
              <div key={label} className="ai-report__total-item">
                <div className="ai-report__total-value">{val ?? 0}</div>
                <div className="ai-report__total-label">{label}</div>
              </div>
            ))}
          </div>
          {recs.length > 0 && (
            <>
              <div className="ai-report__recs-title">Recomendacoes</div>
              <ul className="ai-report__recs-list">
                {recs.map((rec, i) => <li key={i}>{rec}</li>)}
              </ul>
            </>
          )}
        </div>
      </Card>
    );
  }

  if (aiView === "chat") {
    return (
      <Card className="card--noPad">
        <div className="card__header">
          <div className="card__title">Resposta da consulta</div>
        </div>
        <div className="card__body">
          <p className="ai-chat-answer">{aiData?.answer || "Sem resposta disponivel."}</p>
        </div>
      </Card>
    );
  }

  return null;
}

function AiTab({ aiView, aiData, aiQuestion, setAiQuestion, onPriorities, onQuality, onReport, onAsk, busy }) {
  const handlers = { priorities: onPriorities, quality: onQuality, report: onReport };

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Inteligencia Clinica"
        title="Analise Assistida por IA"
        subtitle="Processamento de dados operacionais para apoio a decisao clinica e gerencial. Os resultados nao substituem o julgamento profissional."
      />

      <Alert tone="warning">
        As analises geradas sao auxiliares e baseadas nos dados da unidade. Decisoes clinicas devem sempre ser validadas pelo profissional responsavel.
      </Alert>

      <div className="ai-action-grid">
        {ACTION_CARDS.map((card) => (
          <Button
            key={card.id}
            variant="ghost"
            className={`ai-action-card${aiView === card.id ? " is-active" : ""}`}
            onClick={handlers[card.id]}
            disabled={busy}
          >
            <div className="ai-action-card__icon">{card.icon}</div>
            <div className="ai-action-card__body">
              <div className="ai-action-card__title">{card.title}</div>
              <div className="ai-action-card__desc">{card.desc}</div>
            </div>
          </Button>
        ))}
      </div>

      <Card>
        <div style={{ marginBottom: "var(--s-3)" }}>
          <div className="card__title" style={{ marginBottom: 4 }}>Consulta em linguagem natural</div>
          <div className="card__subtitle">Formule perguntas operacionais sobre os dados da unidade de saude.</div>
        </div>
        <form onSubmit={onAsk} className="ai-query-form">
          <Input
            className="ai-query-form__input"
            placeholder="Ex.: Quais pacientes gestantes estao com protocolo atrasado?"
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            disabled={busy}
          />
          <Button type="submit" variant="primary" disabled={busy || !aiQuestion.trim()}>
            {busy ? "Processando..." : "Consultar"}
          </Button>
        </form>
      </Card>

      {busy && <Alert tone="info">Processando analise. Aguarde...</Alert>}

      <ResultPanel aiView={aiView} aiData={aiData} />
    </PageLayout>
  );
}

export default AiTab;
