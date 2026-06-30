/**
 * AgendarPage.jsx — Jornada de Agendamento do Portal do Cidadão
 *
 * Passos:
 *   1. Escolher serviço
 *   2. Escolher UBS
 *   3. Escolher profissional (quando habilitado)
 *   4. Escolher data
 *   5. Escolher horário
 *   6. Revisar
 *   7. Confirmação
 *
 * A UI nunca conhece regras de agenda. Apenas consome appointmentJourneyService.
 */

import { useState, useEffect } from "react";
import { useNavigate }         from "react-router-dom";
import {
  getServicos,
  getUnidades,
  getProfissionais,
  getDiasDisponiveis,
  getSlots,
  confirmarAgendamento,
  formatarData,
} from "../services/appointmentJourneyService.js";

// ── Progress bar ──────────────────────────────────────────────────────────────
const TOTAL_STEPS = 6; // 1-6 (7 é confirmação final)

function ProgressBar({ step }) {
  const pct = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100);
  return (
    <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginBottom: "var(--s-5)" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 2, transition: "width 300ms" }} />
    </div>
  );
}

// ── Step header ───────────────────────────────────────────────────────────────
function StepHeader({ titulo, sub }) {
  return (
    <div style={{ marginBottom: "var(--s-5)" }}>
      <h2 style={{ fontSize: "var(--t-xl)", fontWeight: 700, color: "var(--text)", margin: 0 }}>{titulo}</h2>
      {sub && <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

// ── Loading ───────────────────────────────────────────────────────────────────
function LoadingList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="portal-skeleton" style={{ height: 72, borderRadius: 12 }} />
      ))}
    </div>
  );
}

// ── Option card ───────────────────────────────────────────────────────────────
function OptionCard({ icone, titulo, sub, onClick, selected }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "var(--s-3)",
        padding: "var(--s-4)", width: "100%", textAlign: "left",
        background: selected ? "var(--accent-soft)" : "var(--surface)",
        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--r-lg)", cursor: "pointer", minHeight: 64,
        transition: "all var(--d-fast)",
      }}
    >
      <span style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>{icone}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--t-md)", fontWeight: 600, color: "var(--text)" }}>{titulo}</div>
        {sub && <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
      </div>
      <span style={{ color: selected ? "var(--accent)" : "var(--text-dim)", fontSize: 18 }}>
        {selected ? "✓" : "›"}
      </span>
    </button>
  );
}

// ── Chip de dia ───────────────────────────────────────────────────────────────
function DayChip({ iso, selected, onClick }) {
  const d   = new Date(iso + "T12:00:00");
  const dia = d.getDate();
  const dow = d.toLocaleString("pt-BR", { weekday: "short" }).replace(".", "");
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "var(--s-2) var(--s-3)", minWidth: 56, minHeight: 64,
        background: selected ? "var(--accent)" : "var(--surface)",
        color: selected ? "#fff" : "var(--text)",
        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--r-lg)", cursor: "pointer",
        transition: "all var(--d-fast)",
      }}
    >
      <span style={{ fontSize: "var(--t-xs)", textTransform: "uppercase", opacity: 0.8 }}>{dow}</span>
      <span style={{ fontSize: "var(--t-xl)", fontWeight: 700 }}>{dia}</span>
    </button>
  );
}

// ── Chip de horário ───────────────────────────────────────────────────────────
function SlotChip({ slot, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "var(--s-3) var(--s-4)", minHeight: 48,
        background: selected ? "var(--accent)" : "var(--surface)",
        color: selected ? "#fff" : "var(--text)",
        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--r-lg)", cursor: "pointer", fontWeight: 600,
        fontSize: "var(--t-md)", transition: "all var(--d-fast)",
      }}
    >
      {slot.hora}
    </button>
  );
}

// ── Tela de confirmação ───────────────────────────────────────────────────────
function TelaConfirmacao({ protocolo, booking, navigate }) {
  return (
    <div style={{ textAlign: "center", padding: "var(--s-6) 0" }}>
      <div style={{ fontSize: 56, marginBottom: "var(--s-4)" }}>✅</div>
      <h2 style={{ fontSize: "var(--t-2xl)", fontWeight: 700, color: "var(--text)", margin: "0 0 var(--s-2)" }}>
        Agendado!
      </h2>
      <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", margin: "0 0 var(--s-6)" }}>
        Seu atendimento foi confirmado com sucesso.
      </p>

      {/* Protocolo */}
      <div style={{
        background: "var(--accent-soft)", border: "1px solid var(--accent-bd)",
        borderRadius: "var(--r-xl)", padding: "var(--s-4) var(--s-5)",
        marginBottom: "var(--s-5)", textAlign: "center",
      }}>
        <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Protocolo</div>
        <div style={{ fontSize: "var(--t-xl)", fontWeight: 700, color: "var(--accent)", letterSpacing: "0.08em" }}>
          {protocolo?.protocolo || "—"}
        </div>
      </div>

      {/* Detalhes */}
      <div className="portal-dash-card" style={{ textAlign: "left", marginBottom: "var(--s-5)" }}>
        <div className="portal-dash-card__body" style={{ padding: 0 }}>
          {[
            { icone: "🩺", label: "Serviço",  valor: booking.serviceName },
            { icone: "🏥", label: "UBS",       valor: booking.unitName    },
            { icone: "📅", label: "Data",      valor: formatarData(booking.date) },
            { icone: "🕐", label: "Horário",   valor: booking.hora        },
          ].map((row, i, arr) => (
            <div key={i} className="portal-ubs-info-row" style={i === arr.length - 1 ? { borderBottom: "none" } : {}}>
              <div className="portal-ubs-info-row__icon">{row.icone}</div>
              <div>
                <div className="portal-ubs-info-row__label">{row.label}</div>
                <div className="portal-ubs-info-row__value">{row.valor}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Orientações */}
      <div className="portal-info-banner" style={{ textAlign: "left", marginBottom: "var(--s-6)" }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>📋 Orientações</div>
        {(protocolo?.orientacoes || []).map((o, i) => (
          <div key={i} style={{ fontSize: "var(--t-sm)", marginBottom: 4 }}>• {o}</div>
        ))}
      </div>

      <button className="btn btn--primary btn--full" onClick={() => navigate("/agendamentos")}>
        Ver meus agendamentos
      </button>
      <button className="btn btn--ghost btn--full" style={{ marginTop: "var(--s-2)" }} onClick={() => navigate("/home")}>
        Voltar ao início
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AgendarPage() {
  const navigate = useNavigate();

  const [step,          setStep]          = useState(1);
  const [loading,       setLoading]       = useState(false);
  const [erro,          setErro]          = useState("");
  const [enviando,      setEnviando]      = useState(false);

  // Dados carregados
  const [servicos,      setServicos]      = useState(null);
  const [unidades,      setUnidades]      = useState(null);
  const [profissionais, setProfissionais] = useState(null);
  const [dias,          setDias]          = useState(null);
  const [slots,         setSlots]         = useState(null);

  // Escolhas do cidadão
  const [servico,       setServico]       = useState(null);
  const [unidade,       setUnidade]       = useState(null);
  const [profissional,  setProfissional]  = useState(null);
  const [dia,           setDia]           = useState(null);
  const [slot,          setSlot]          = useState(null);

  // Resultado final
  const [protocolo,     setProtocolo]     = useState(null);

  // Carregamento por step
  useEffect(() => {
    async function load() {
      setErro(""); setLoading(true);
      try {
        if (step === 1) {
          const data = await getServicos();
          setServicos(data.services || []);
        } else if (step === 2 && servico) {
          const data = await getUnidades(servico.id);
          setUnidades(data.units || []);
        } else if (step === 3 && servico && unidade) {
          const data = await getProfissionais(servico.id, unidade.id);
          setProfissionais(data);
          if (!data.selecaoPermitida) {
            setProfissional({ id: "qualquer", nome: null });
            setStep(4); return;
          }
        } else if (step === 4 && servico && unidade) {
          const data = await getDiasDisponiveis(servico.id, unidade.id, profissional?.id);
          setDias(data.availableDates || []);
        } else if (step === 5 && dia) {
          const data = await getSlots(servico.id, unidade.id, profissional?.id, dia);
          setSlots(data.slots || []);
        }
      } catch (e) {
        setErro(e.message || "Erro ao carregar. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [step]); // eslint-disable-line

  function next() { setErro(""); setStep(s => s + 1); }
  function back() { setErro(""); setStep(s => s - 1); }

  async function handleConfirmar() {
    setEnviando(true); setErro("");
    try {
      const result = await confirmarAgendamento({
        serviceId:   servico.id,
        serviceName: servico.nome,
        unitId:      unidade.id,
        unitName:    unidade.nome,
        professionalId: profissional?.id !== "qualquer" ? profissional?.id : null,
        date:        dia,
        slotId:      slot.id,
        hora:        slot.hora,
      });
      setProtocolo(result);
      setStep(7);
    } catch (e) {
      setErro(e.message || "Erro ao confirmar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  // Confirmação final
  if (step === 7) {
    return (
      <div className="portal-content">
        <TelaConfirmacao
          protocolo={protocolo}
          booking={{ serviceName: servico?.nome, unitName: unidade?.nome, date: dia, hora: slot?.hora }}
          navigate={navigate}
        />
      </div>
    );
  }

  return (
    <div className="portal-content">
      {/* Topo com voltar */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", marginBottom: "var(--s-4)" }}>
        <button
          onClick={() => step === 1 ? navigate(-1) : back()}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "var(--text-muted)", padding: "var(--s-2)", minWidth: 40, minHeight: 40 }}
        >
          ‹
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
            Passo {Math.min(step, 6)} de {TOTAL_STEPS}
          </div>
        </div>
      </div>

      <ProgressBar step={Math.min(step, TOTAL_STEPS)} />

      {erro && <div className="alert alert--error" role="alert" style={{ marginBottom: "var(--s-4)" }}>{erro}</div>}

      {/* PASSO 1: Escolher serviço */}
      {step === 1 && (
        <>
          <StepHeader titulo="O que você precisa?" sub="Escolha o tipo de atendimento desejado." />
          {loading ? <LoadingList /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {(servicos || []).length === 0 && !loading && (
                <div className="portal-info-banner">Agendamento online não está disponível no momento. Procure sua UBS.</div>
              )}
              {(servicos || []).map(s => (
                <OptionCard
                  key={s.id}
                  icone={s.icone} titulo={s.nome} sub={s.descricao}
                  selected={servico?.id === s.id}
                  onClick={() => { setServico(s); next(); }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* PASSO 2: Escolher UBS */}
      {step === 2 && (
        <>
          <StepHeader titulo="Em qual UBS?" sub="Escolha a unidade de saúde para o atendimento." />
          {loading ? <LoadingList /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {(unidades || []).map(u => (
                <OptionCard
                  key={u.id}
                  icone={u.isMinhaUbs ? "🏥" : "📍"}
                  titulo={u.isMinhaUbs ? `${u.nome} (Minha UBS)` : u.nome}
                  sub={[u.endereco, u.bairro].filter(Boolean).join(", ") || u.municipio || null}
                  selected={unidade?.id === u.id}
                  onClick={() => { setUnidade(u); next(); }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* PASSO 3: Profissional (quando habilitado — geralmente auto-skip) */}
      {step === 3 && (
        <>
          <StepHeader titulo="Profissional" sub="Configuração do atendimento." />
          {loading ? <LoadingList /> : (
            <div className="portal-info-banner" style={{ marginBottom: "var(--s-5)" }}>
              🧑‍⚕️ Você será atendido pelo profissional disponível da sua equipe de referência.
            </div>
          )}
          {!loading && (
            <button className="btn btn--primary btn--full" onClick={() => { setProfissional({ id: "qualquer" }); next(); }}>
              Continuar
            </button>
          )}
        </>
      )}

      {/* PASSO 4: Escolher data */}
      {step === 4 && (
        <>
          <StepHeader titulo="Quando?" sub="Escolha um dia disponível para o atendimento." />
          {loading ? <LoadingList /> : (
            <>
              {(dias || []).length === 0 ? (
                <div className="portal-info-banner">Nenhuma vaga disponível no momento. Tente mais tarde ou procure sua UBS.</div>
              ) : (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)", marginBottom: "var(--s-5)" }}>
                    {(dias || []).map(d => (
                      <DayChip key={d} iso={d} selected={dia === d} onClick={() => setDia(d)} />
                    ))}
                  </div>
                  <button
                    className="btn btn--primary btn--full"
                    disabled={!dia}
                    onClick={() => { if (dia) next(); }}
                  >
                    Continuar
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* PASSO 5: Escolher horário */}
      {step === 5 && (
        <>
          <StepHeader titulo="Qual horário?" sub={dia ? `Horários disponíveis para ${formatarData(dia)}` : "Escolha um horário."} />
          {loading ? <LoadingList /> : (
            <>
              {(slots || []).length === 0 ? (
                <div className="portal-info-banner">Nenhum horário disponível para este dia. Escolha outra data.</div>
              ) : (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)", marginBottom: "var(--s-5)" }}>
                    {(slots || []).map(s => (
                      <SlotChip key={s.id} slot={s} selected={slot?.id === s.id} onClick={() => setSlot(s)} />
                    ))}
                  </div>
                  <button
                    className="btn btn--primary btn--full"
                    disabled={!slot}
                    onClick={() => { if (slot) next(); }}
                  >
                    Continuar
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* PASSO 6: Revisar */}
      {step === 6 && (
        <>
          <StepHeader titulo="Confirmar agendamento" sub="Revise os dados antes de confirmar." />

          <div className="portal-dash-card" style={{ marginBottom: "var(--s-5)" }}>
            <div className="portal-dash-card__body" style={{ padding: 0 }}>
              {[
                { icone: "🩺", label: "Serviço",  valor: servico?.nome   },
                { icone: "🏥", label: "UBS",       valor: unidade?.nome   },
                { icone: "📅", label: "Data",      valor: formatarData(dia) },
                { icone: "🕐", label: "Horário",   valor: slot?.hora      },
              ].map((row, i, arr) => (
                <div key={i} className="portal-ubs-info-row" style={i === arr.length - 1 ? { borderBottom: "none" } : {}}>
                  <div className="portal-ubs-info-row__icon">{row.icone}</div>
                  <div>
                    <div className="portal-ubs-info-row__label">{row.label}</div>
                    <div className="portal-ubs-info-row__value">{row.valor || "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            className={"btn btn--primary btn--full" + (enviando ? " btn--loading" : "")}
            disabled={enviando}
            onClick={handleConfirmar}
          >
            {enviando ? "" : "Confirmar Agendamento"}
          </button>
          <button className="btn btn--ghost btn--full" style={{ marginTop: "var(--s-2)" }} onClick={back} disabled={enviando}>
            Voltar e alterar
          </button>
        </>
      )}
    </div>
  );
}
