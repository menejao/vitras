import { useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { matchesPatientSearch } from "../utils/clinical";
import { maskCpf, fmtDate } from "../utils/formatting";
import { isAdmin } from "../utils/roles";
import NursingWorkspace from "./NursingWorkspace";

const NURSING_ROLES = new Set(["nurse_manager", "nursing_tech"]);
const DOCTOR_ROLES  = new Set(["doctor"]);

function resolveWorkspace(user) {
  const role = String(user?.role || "");
  if (isAdmin(user) || role === "support_admin") return "nursing";
  if (NURSING_ROLES.has(role)) return "nursing";
  if (DOCTOR_ROLES.has(role))  return "doctor";
  return "none";
}

export default function AtendimentoPage({ patients, user, token, users, onRecordSaved }) {
  const [patSearch, setPatSearch] = useState("");
  const [patient, setPatient] = useState(null);

  const workspace = resolveWorkspace(user);

  const patResults = (() => {
    const q = patSearch.trim();
    if (q.length < 2) return [];
    return (patients || []).filter(p => matchesPatientSearch(p, q)).slice(0, 8);
  })();

  function selectPatient(p) {
    setPatient(p);
    setPatSearch("");
  }

  function clearPatient() {
    setPatient(null);
    setPatSearch("");
  }

  if (workspace === "none") {
    return (
      <div className="atendimento-page">
        <PageHeader
          eyebrow="ATENDIMENTO"
          title="Atendimento"
          subtitle="Registro de atendimentos clínicos por especialidade"
        />
        <div className="atendimento-body">
          <div className="empty" style={{ padding: "3rem" }}>
            <div className="empty__icon empty__icon--neutral">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3 className="empty__title">Acesso não autorizado</h3>
            <p className="empty__desc">Seu perfil não possui acesso ao módulo de Atendimento.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="atendimento-page">
      <PageHeader
        eyebrow="ATENDIMENTO"
        title="Atendimento"
        subtitle={
          workspace === "nursing"
            ? "Workspace de Enfermagem — registro de atendimentos, coletas e procedimentos"
            : "Workspace Médico — consultas e evoluções clínicas"
        }
      />

      <div className="atendimento-body">
        {/* Seleção de paciente */}
        <div className="card">
          <div className="card__header">
            <span className="card__title">Paciente</span>
          </div>
          <div className="card__body">

          {!patient ? (
            <div style={{ position: "relative", maxWidth: 480 }}>
              <Input
                value={patSearch}
                onChange={e => setPatSearch(e.target.value)}
                placeholder="Buscar paciente por nome, CPF ou CNS..."
                style={{ width: "100%" }}
              />
              {patResults.length > 0 && (
                <div className="ins-pat-results">
                  {patResults.map(p => (
                    <Button key={p.id} variant="ghost" className="ins-pat-opt" onClick={() => selectPatient(p)}>
                      <div className="ins-pat-opt__name">{p.name}</div>
                      <div className="ins-pat-opt__sub">
                        {p.cpf ? maskCpf(p.cpf) : ""}
                        {p.birthDate ? ` · ${fmtDate(p.birthDate)}` : ""}
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4)", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--t-sm)" }}>{patient.name}</div>
                <div className="muted small">
                  {patient.birthDate ? `Nasc.: ${fmtDate(patient.birthDate)}` : ""}
                  {patient.cpf ? ` · CPF: ${maskCpf(patient.cpf)}` : ""}
                </div>
              </div>
              <Button variant="ghost" size="sm" style={{ color: "var(--text-2)" }} onClick={clearPatient}>
                Trocar paciente
              </Button>
            </div>
          )}
          </div>
        </div>

        {/* Workspace por perfil */}
        {patient && workspace === "nursing" && (
          <NursingWorkspace
            patient={patient}
            user={user}
            token={token}
            users={users}
            onRecordSaved={onRecordSaved}
          />
        )}

        {patient && workspace === "doctor" && (
          <div className="empty" style={{ padding: "3rem" }}>
            <div className="empty__icon empty__icon--neutral">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <h3 className="empty__title">Workspace médico em preparação</h3>
            <p className="empty__desc">O workspace de atendimento médico estará disponível em próxima sprint.</p>
          </div>
        )}

        {!patient && (
          <div className="empty" style={{ padding: "3rem" }}>
            <div className="empty__icon empty__icon--neutral">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <h3 className="empty__title">Busque um paciente</h3>
            <p className="empty__desc">Selecione o paciente para iniciar o registro de atendimento.</p>
          </div>
        )}
      </div>
    </div>
  );
}
