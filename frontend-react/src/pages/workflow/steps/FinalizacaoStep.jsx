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
  return (
    <div className="wf-summary-section">
      <div className="wf-summary-section__title">{title}</div>
      {children}
    </div>
  );
}

const MOTIVO_LABEL = { rastreamento: "Rastreamento", repeticao: "Repetição (ASCUS/Baixo grau)", seguimento: "Seguimento (pós colposcopia/tratamento)" };
const CARATER_LABEL = { eletivo: "Eletivo", urgencia: "Urgência/Emergência" };
const LOCAL_LABEL = { ubs: "UBS", domicilio: "Domicílio", escola: "Escola", polo_academia: "Polo Academia", outros_espacos: "Outros espaços sociais" };
const RETORNO_LABEL = { sem_retorno: "Sem retorno", retornar_se_necessario: "Retornar se necessário", agendamento_retorno: "Agendamento de retorno", alta: "Alta" };

export default function FinalizacaoStep({ formData, patient, users }) {
  const { atendimento = {}, fichaClinica = {}, diagnosticos = {}, procedimentos = {}, conduta = {}, resultado = {}, documentos = {} } = formData;

  const prof = users?.find(u => u.id === atendimento.profissionalId);
  const profName = prof ? (prof.name || prof.username) : "—";

  const hasResultado = resultado.dataColeta || resultado.numeroPedido || resultado.adequabilidade;
  const hasDiag = (diagnosticos.itens || []).length > 0;
  const hasProc = (procedimentos.itens || []).length > 0;
  const hasEnc = (conduta.encaminhamentos || []).length > 0;

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Revisão do Atendimento</div>
        <p className="muted small" style={{ marginBottom: "var(--s-4)" }}>
          Revise as informações antes de salvar. Após salvar, o registro estará disponível no Histórico e Prontuário do paciente.
        </p>

        <SummarySection title="Atendimento">
          <SummaryRow label="Paciente" value={patient?.name} />
          <SummaryRow label="Data" value={atendimento.dataAtendimento ? fmtDate(atendimento.dataAtendimento) : undefined} />
          <SummaryRow label="Hora" value={atendimento.horaAtendimento} />
          <SummaryRow label="Caráter" value={CARATER_LABEL[atendimento.carater]} />
          <SummaryRow label="Local" value={LOCAL_LABEL[atendimento.localAtendimento]} />
          <SummaryRow label="Profissional" value={profName} />
        </SummarySection>

        <SummarySection title="Ficha Clínica">
          <SummaryRow label="Motivo" value={MOTIVO_LABEL[fichaClinica.motivoExame] || fichaClinica.motivoExame} />
          <SummaryRow label="Preventivo anterior" value={fichaClinica.fezePreventivo === "sim" ? "Sim" : fichaClinica.fezePreventivo === "nao" ? "Não" : undefined} />
          <SummaryRow label="Usa DIU" value={fichaClinica.usaDiu} />
          <SummaryRow label="Grávida" value={fichaClinica.estaGravida} />
          <SummaryRow label="Inspeção do colo" value={fichaClinica.inspecaoColo} />
          <SummaryRow label="Sinais IST" value={fichaClinica.sinaisIst} />
          <SummaryRow label="DUM" value={fichaClinica.dum ? fmtDate(fichaClinica.dum) : undefined} />
        </SummarySection>

        {hasDiag && (
          <SummarySection title="Diagnósticos">
            {(diagnosticos.itens || []).map(d => (
              <SummaryRow key={d.code} label={d.code} value={`${d.desc}${d.code === diagnosticos.principalCode ? " (principal)" : ""}`} />
            ))}
          </SummarySection>
        )}

        {hasProc && (
          <SummarySection title="Procedimentos">
            {(procedimentos.itens || []).map(p => (
              <SummaryRow key={p.code} label={p.code} value={p.name} />
            ))}
            <SummaryRow label="Data coleta" value={procedimentos.dataColeta ? fmtDate(procedimentos.dataColeta) : undefined} />
            {procedimentos.siscan && <SummaryRow label="SISCAN" value="Registrado" />}
          </SummarySection>
        )}

        <SummarySection title="Conduta">
          <SummaryRow label="Retorno" value={RETORNO_LABEL[conduta.retorno]} />
          {conduta.retornoDias && conduta.retorno === "agendamento_retorno" && (
            <SummaryRow label="Prazo retorno" value={`${conduta.retornoDias} dias`} />
          )}
          {hasEnc && <SummaryRow label="Encaminhamentos" value={(conduta.encaminhamentos || []).join(", ")} />}
          <SummaryRow label="Orientações" value={conduta.orientacoes} />
        </SummarySection>

        {hasResultado ? (
          <SummarySection title="Resultado Citopatológico">
            <SummaryRow label="Data coleta" value={resultado.dataColeta ? fmtDate(resultado.dataColeta) : undefined} />
            <SummaryRow label="Nº pedido" value={resultado.numeroPedido} />
            <SummaryRow label="RA" value={resultado.ra} />
            <SummaryRow label="Adequabilidade" value={resultado.adequabilidade} />
            <SummaryRow label="Diagnóstico" value={resultado.diagnosticoDescritivo} />
          </SummarySection>
        ) : (
          <div className="pap-field__hint" style={{ marginTop: "var(--s-3)" }}>
            Resultado citopatológico não informado. Pode ser lançado posteriormente na aba Resultado.
          </div>
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
