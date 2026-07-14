/**
 * UnitDetail — Administração completa de uma UBS no Console Nacional.
 * Tabs: Visão Geral, Configurações, Equipes, Usuários, Gestores, Território,
 *       Módulos, Regras, Portal, Integrações, Segurança, Auditoria.
 *
 * Todas as seções são exclusivas do Console Nacional (support_admin).
 * Nenhuma destas rotas/telas é acessível a usuários da UBS.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../api";
import ScheduleConfigTab from "./ScheduleConfigTab";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Alert from "../../components/ui/Alert";
import { lookupCep, formatCep } from "../../services/cepService";
import { geocodeAddress } from "../../services/geocodingService";

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  draft: "Rascunho", onboarding: "Em implantação",
  homologation: "Homologação", active: "Operacional", suspended: "Suspensa",
};
const STATUS_BADGE = {
  draft: "badge", onboarding: "badge badge--warning",
  homologation: "badge badge--info", active: "badge badge--success",
  suspended: "badge badge--danger",
};
const STATUS_TRANSITIONS = {
  draft: [{ to: "onboarding", label: "Iniciar Implantação" }],
  onboarding: [{ to: "homologation", label: "Iniciar Homologação" }],
  homologation: [{ to: "active", label: "Ativar UBS" }, { to: "onboarding", label: "Voltar a Implantação" }],
  active: [{ to: "suspended", label: "Suspender" }],
  suspended: [{ to: "active", label: "Reativar" }],
};
const TRANSITION_VARIANT = { active: "primary", suspended: "danger" };
const UF_OPTIONS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const ALL_MODULES = [
  { id: "nutricao",            label: "Nutrição" },
  { id: "psicologia",          label: "Psicologia" },
  { id: "fisioterapia",        label: "Fisioterapia" },
  { id: "servico_social",      label: "Serviço Social" },
  { id: "terapia_ocupacional", label: "Terapia Ocupacional" },
  { id: "fonoaudiologia",      label: "Fonoaudiologia" },
  { id: "odontologia",         label: "Odontologia" },
  { id: "farmacia",            label: "Farmácia" },
  { id: "vacinacao",           label: "Vacinação" },
  { id: "exames",              label: "Exames" },
  { id: "medicamentos",        label: "Medicamentos" },
  { id: "agendamentos",        label: "Agendamentos" },
  { id: "notificacoes",        label: "Notificações" },
];

const ROLE_LABELS = {
  gestor: "Gestor", medico: "Médico", enfermeiro: "Enfermeiro",
  acs: "ACS", tecnico_enfermagem: "Técnico de Enfermagem",
  administrativo: "Administrativo", developer_readonly: "Dev (somente leitura)",
};

const ACTION_LABELS = {
  PLATFORM_UNIT_CREATED: "UBS criada",
  PLATFORM_UNIT_UPDATED: "UBS editada",
  PLATFORM_MODULE_ENABLED: "Módulo ativado",
  PLATFORM_MODULE_DISABLED: "Módulo desativado",
  PLATFORM_TEAM_CREATED: "Equipe criada",
  PLATFORM_TEAM_UPDATED: "Equipe editada",
  PLATFORM_INITIAL_MANAGER_CREATED: "Gestor criado",
  USER_PASSWORD_RESET: "Senha resetada",
  PLATFORM_HOMOLOGATION_CHECKLIST_UPDATED: "Checklist de homologação",
  PLATFORM_UNIT_CONFIGURATION_UPDATED: "Configurações gerais salvas",
  PLATFORM_UNIT_RULES_UPDATED: "Regras operacionais salvas",
  CITIZEN_PORTAL_UNIT_CONFIG_UPDATED: "Portal do Cidadão configurado",
};

const TABS = [
  { id: "overview",   label: "Visão Geral"   },
  { id: "config",     label: "Configurações" },
  { id: "modules",    label: "Módulos"       },
  { id: "rules",      label: "Regras"        },
  { id: "portal",     label: "Portal"        },
  { id: "teams",      label: "Equipes"       },
  { id: "users",      label: "Usuários"      },
  { id: "gestors",    label: "Gestores"      },
  { id: "territory",  label: "Território"    },
  { id: "integrations",label: "Integrações" },
  { id: "security",   label: "Segurança"     },
  { id: "agenda",     label: "Agenda"        },
  { id: "audit",      label: "Auditoria"     },
];

const GENERAL_CONFIG_FIELDS = [
  { key: "ativo",                   label: "UBS ativa",                      desc: "Unidade aparece como disponível na plataforma" },
  { key: "atendimentoHabilitado",   label: "Atendimento habilitado",         desc: "Permite registro de atendimentos clínicos" },
  { key: "cadastroPacientes",       label: "Cadastro de pacientes",          desc: "Permite cadastrar novos cidadãos nesta unidade" },
  { key: "cadastroFamilias",        label: "Cadastro de famílias",           desc: "Permite vincular grupos familiares" },
  { key: "cadastroTerritorial",     label: "Cadastro territorial",           desc: "Habilita cadastro domiciliar e microáreas" },
  { key: "operacaoPorEquipes",      label: "Operação por equipes",           desc: "Organização por equipes de saúde da família" },
  { key: "operacaoPorMicroareas",   label: "Operação por microáreas",        desc: "Territorialização por microáreas de cobertura" },
  { key: "atendimentoEspontaneo",   label: "Atendimento espontâneo",         desc: "Aceita demanda sem agendamento prévio" },
  { key: "atendimentoAgendado",     label: "Atendimento agendado",           desc: "Permite agenda com horário marcado" },
  { key: "visitasDomiciliares",     label: "Visitas domiciliares",           desc: "Habilita registro de visitas do ACS" },
  { key: "triagem",                 label: "Triagem",                        desc: "Protocolo de triagem na entrada" },
  { key: "acompanhamentoLongitudinal", label: "Acompanhamento longitudinal", desc: "Registro de acompanhamento contínuo de pacientes" },
  { key: "encaminhamentos",         label: "Encaminhamentos",                desc: "Referência e contrarreferência para especialidades" },
  { key: "notificacoesInternas",    label: "Notificações internas",          desc: "Avisos internos entre profissionais da unidade" },
];

const RULES_SECTIONS = [
  {
    id: "agendas", label: "Agendamentos", fields: [
      { key: "maxAgendasPorProfissional", label: "Máx. agendas por profissional/dia", type: "number", min: 1, max: 100, unit: "consultas" },
      { key: "antecedenciaMinDias",       label: "Antecedência mínima",               type: "number", min: 0, max: 30,  unit: "dias" },
      { key: "antecedenciaMaxDias",       label: "Antecedência máxima",               type: "number", min: 1, max: 365, unit: "dias" },
      { key: "duracaoPadraoConsultaMin",  label: "Duração padrão da consulta",        type: "number", min: 5, max: 120, unit: "minutos" },
      { key: "toleranciaAtrasoMin",       label: "Tolerância de atraso",              type: "number", min: 0, max: 60,  unit: "minutos" },
      { key: "limiteEncaixes",            label: "Limite de encaixes por turno",      type: "number", min: 0, max: 20,  unit: "encaixes" },
      { key: "confirmacaoObrigatoria",    label: "Confirmação de presença obrigatória", type: "toggle" },
      { key: "cancelamentoPermitido",     label: "Cancelamento pelo Portal",          type: "toggle" },
      { key: "remarcacaoPermitida",       label: "Remarcação pelo Portal",            type: "toggle" },
      { key: "listaEspera",              label: "Lista de espera",                   type: "toggle" },
    ]
  },
  {
    id: "visitas", label: "Visitas Domiciliares", fields: [
      { key: "frequenciaMaxMensal", label: "Frequência máxima mensal", type: "number", min: 1, max: 20, unit: "visitas/mês" },
      { key: "registroObrigatorio", label: "Registro obrigatório",    type: "toggle" },
    ]
  },
  {
    id: "atribuicao", label: "Atribuição Territorial", fields: [
      { key: "porEquipe",         label: "Atribuição por equipe",     type: "toggle" },
      { key: "porMicroarea",      label: "Atribuição por microárea",  type: "toggle" },
      { key: "maxPacientesPorAcs", label: "Máx. cidadãos por ACS",   type: "number", min: 100, max: 2000, unit: "cidadãos" },
    ]
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function apiFetch(path, token, options = {}) {
  const { body, ...rest } = options;
  return api(path, { ...rest, body, credentials: "include" }, token);
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
  } catch { return iso.slice(0, 10); }
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch { return iso.slice(0, 16).replace("T", " "); }
}

// ── Icons ──────────────────────────────────────────────────────────────────

const IcoCheck = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcoWarning = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M8 7v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="8" cy="12" r=".7" fill="currentColor"/>
  </svg>
);
const IcoInfo = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M8 7v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="8" cy="5" r=".8" fill="currentColor"/>
  </svg>
);
const IcoShield = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M8 2l5 2v4c0 3-2.5 5.5-5 6-2.5-.5-5-3-5-6V4l5-2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Shared Components ──────────────────────────────────────────────────────

function StatusBadge({ status }) {
  return <span className={STATUS_BADGE[status] || "badge"}>{STATUS_LABELS[status] || status}</span>;
}

function InheritanceBadge({ isOverride, isDirty }) {
  if (isDirty) return (
    <span className="chip" style={{ fontSize: 10, background: "var(--warning-soft, #fef3c7)", color: "var(--warning, #d97706)", border: "1px solid var(--warning-bd, #fcd34d)" }}>
      alteração pendente
    </span>
  );
  if (isOverride) return (
    <span className="chip" style={{ fontSize: 10, background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-bd)" }}>
      configuração própria
    </span>
  );
  return (
    <span className="chip" style={{ fontSize: 10, background: "var(--surface-3)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
      padrão do sistema
    </span>
  );
}

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? "var(--accent)" : "var(--border-strong)",
        border: "none", cursor: disabled ? "not-allowed" : "pointer",
        position: "relative", flexShrink: 0,
        transition: "background var(--d-fast)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: checked ? 20 : 2,
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "left 150ms",
      }} />
    </button>
  );
}

function SectionSaveBar({ dirty, saving, saved, error, onSave, onReset, resetLabel = "Restaurar padrão" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", padding: "var(--s-3) 0", borderTop: "1px solid var(--border-subtle)", marginTop: "var(--s-2)" }}>
      <Button size="sm" loading={saving} disabled={!dirty || saving} onClick={onSave}>
        Salvar
      </Button>
      {dirty && onReset && (
        <Button size="sm" variant="ghost" disabled={saving} onClick={onReset}>
          {resetLabel}
        </Button>
      )}
      {!dirty && !saving && <span style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>Sem alterações pendentes</span>}
      {saved && <span style={{ fontSize: "var(--t-sm)", color: "var(--success)" }}>✓ Salvo</span>}
      {error && <span style={{ fontSize: "var(--t-sm)", color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

function TempPasswordModal({ password, onClose }) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  async function handleCopy() {
    try { await navigator.clipboard.writeText(password); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 3000);
  }
  return (
    <div className="console-modal-overlay">
      <div className="console-modal">
        <h2 className="console-modal__title">Senha Temporária — Exibição Única</h2>
        <div className="console-pwd-box">
          <div className="console-pwd-box__warn">Esta senha será exibida uma única vez. Anote ou copie agora.</div>
          <code className="console-pwd-box__code">{password}</code>
        </div>
        <Button full variant={copied ? "secondary" : "primary"} onClick={handleCopy} style={{ marginBottom: "var(--s-3)" }}>
          {copied ? "✓ Senha copiada com sucesso!" : "Copiar Senha"}
        </Button>
        <label style={{ display: "flex", alignItems: "flex-start", gap: "var(--s-2)", cursor: "pointer", marginBottom: "var(--s-4)", fontSize: "var(--t-sm)" }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, accentColor: "var(--accent)" }} />
          <span>Confirmo que anotei ou copiei esta senha.</span>
        </label>
        <Button full variant="secondary" disabled={!confirmed} onClick={onClose}>Fechar</Button>
      </div>
    </div>
  );
}

// ── Tab: Visão Geral ───────────────────────────────────────────────────────

function OverviewTab({ unit, gestors, teams, checklist, transitioning, formError, onTransition, onChecklistItem, onAddTeam, onAddManager, onEdit }) {
  const transitions = STATUS_TRANSITIONS[unit.status] || [];

  return (
    <>
      {/* Onboarding actions */}
      {((gestors.length === 0) || (teams.length === 0)) && (
        <div className="console-onboarding-alert">
          <div className="console-onboarding-alert__title"><IcoWarning /> Ações necessárias para concluir implantação</div>
          <div className="console-onboarding-alert__rows">
            {gestors.length === 0 && (
              <div className="console-onboarding-alert__row">
                <span style={{ flex: 1 }}>• Cadastrar gestor inicial</span>
                <Button variant="warn" size="sm" onClick={onAddManager}>Fazer agora</Button>
              </div>
            )}
            {teams.length === 0 && (
              <div className="console-onboarding-alert__row">
                <span style={{ flex: 1 }}>• Cadastrar equipe inicial</span>
                <Button variant="warn" size="sm" onClick={onAddTeam}>Fazer agora</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {formError && <Alert type="error" style={{ marginBottom: "var(--s-4)" }}>{formError}</Alert>}

      {/* Stats grid */}
      <div className="console-detail-grid">
        <div className="console-section">
          <div className="console-section__header">Dados Institucionais</div>
          <div className="console-section__body">
            {[
              ["CNES", <span className="num">{unit.cnes || "—"}</span>],
              ["Município", `${unit.municipalityName || "—"}${unit.uf ? ` / ${unit.uf}` : ""}`],
              unit.municipalityId && ["IBGE", <span className="num">{unit.municipalityId}</span>],
              unit.contactEmail && ["E-mail", unit.contactEmail],
              unit.phone && ["Telefone", unit.phone],
            ].filter(Boolean).map(([label, val]) => (
              <div key={label} className="console-data-row">
                <span className="console-data-row__label">{label}</span>
                <span>{val}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="console-section">
          <div className="console-section__header">Operacional</div>
          <div className="console-section__body">
            <div className="console-metric-grid">
              {[
                { label: "Equipes",   val: unit.teamCount    ?? 0 },
                { label: "Gestores",  val: unit.gestorCount  ?? 0 },
                { label: "Usuários",  val: unit.userCount    ?? 0 },
                { label: "Pacientes", val: unit.patientCount ?? 0 },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div className="console-metric__value">{val}</div>
                  <div className="console-metric__label">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="console-section">
          <div className="console-section__header">Implantação</div>
          <div className="console-section__body">
            {[
              ["Cadastro",     fmtDate(unit.createdAt)],
              unit.activatedAt && ["Ativação", fmtDate(unit.activatedAt)],
              unit.suspendedAt && ["Suspensão", fmtDate(unit.suspendedAt)],
              ["Atualização",  fmtDate(unit.updatedAt)],
              unit.createdByName && ["Responsável", unit.createdByName],
            ].filter(Boolean).map(([label, val]) => (
              <div key={label} className="console-data-row">
                <span className="console-data-row__label">{label}</span>
                <span style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lifecycle */}
      {transitions.length > 0 && (
        <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
          <div className="console-section__header">
            Ciclo de Vida
            <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
              Status atual: <strong style={{ color: "var(--text)" }}>{STATUS_LABELS[unit.status] || unit.status}</strong>
            </span>
          </div>
          <div className="console-section__body">
            {checklist?.criteria?.length > 0 && (
              <>
                <p style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)", marginBottom: "var(--s-3)" }}>
                  Critérios para avançar para {STATUS_LABELS[transitions[0]?.to] || "próximo estado"}:
                </p>
                <div className="console-checklist">
                  {checklist.criteria.map((c) => {
                    const isInteractive = ["auth_","rbac_","team_configured","user_created","patient_","household_","individual_","audit_"].some(pfx => c.id.startsWith(pfx));
                    return isInteractive ? (
                      <label key={c.id} className="console-checklist__item" style={{ cursor: "pointer" }}>
                        <input type="checkbox" checked={!!c.pass} onChange={(e) => onChecklistItem(c.id, e.target.checked)}
                          style={{ width: 14, height: 14, flexShrink: 0, accentColor: "var(--success)" }} />
                        <span style={{ color: c.pass ? "var(--success)" : "var(--text)" }}>{c.label}</span>
                        {c.pass && <span className="chip ok">✓</span>}
                      </label>
                    ) : (
                      <div key={c.id} className="console-checklist__item">
                        <div className={`console-checklist__dot ${c.pass ? "pass" : "pending"}`} />
                        <span style={{ color: c.pass ? "var(--success)" : "var(--text)" }}>{c.label}</span>
                        {c.pass ? <span className="chip ok">✓</span> : <span className="chip warn">pendente</span>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
              {transitions.map(({ to, label }) => {
                const isForward = ["onboarding","homologation","active"].includes(to);
                const blocked = isForward && checklist && !checklist.ok;
                return (
                  <Button key={to} variant={TRANSITION_VARIANT[to] || "secondary"} size="sm"
                    disabled={transitioning || blocked} loading={transitioning}
                    onClick={() => onTransition(to)}
                    title={blocked ? `Critérios pendentes: ${(checklist?.criteria||[]).filter(c=>!c.pass).map(c=>c.label).join(", ")}` : undefined}>
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Tab: Configurações Gerais ──────────────────────────────────────────────

function ConfigTab({ token, unit }) {
  const [data, setData] = useState(null);
  const [local, setLocal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch(`/platform/units/${unit.id}/configuration`, token)
      .then((d) => { setData(d); setLocal(JSON.parse(JSON.stringify(d.effective))); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [unit.id, token]);

  function toggle(key, val) {
    setLocal((prev) => ({ ...prev, general: { ...prev.general, [key]: val } }));
    setSaved(false);
  }

  function isDirtyKey(key) {
    if (!data) return false;
    return data.effective?.general?.[key] !== local?.general?.[key];
  }
  const dirty = data ? JSON.stringify(data.effective) !== JSON.stringify(local) : false;

  async function handleSave() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const result = await apiFetch(`/platform/units/${unit.id}/configuration`, token, {
        method: "PUT", body: JSON.stringify({ general: local.general }),
      });
      setData((prev) => ({ ...prev, unitOverrides: result.unitOverrides, effective: result.effective }));
      setLocal(JSON.parse(JSON.stringify(result.effective)));
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  function handleReset() {
    if (!data) return;
    setLocal(JSON.parse(JSON.stringify(data.effective)));
    setSaved(false);
  }

  const filtered = GENERAL_CONFIG_FIELDS.filter((f) =>
    !search || f.label.toLowerCase().includes(search.toLowerCase()) || f.desc.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="console-loading">Carregando configurações...</div>;

  return (
    <div>
      <div style={{ marginBottom: "var(--s-4)", display: "flex", gap: "var(--s-3)", alignItems: "center" }}>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar configuração..."
          style={{ maxWidth: 320 }}
        />
        <span style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
          {filtered.length} de {GENERAL_CONFIG_FIELDS.length} configurações
        </span>
      </div>

      {/* Info banner */}
      <div className="console-section" style={{ marginBottom: "var(--s-4)", background: "var(--accent-soft)", borderColor: "var(--accent-bd)" }}>
        <div className="console-section__body" style={{ color: "var(--text)", fontSize: "var(--t-sm)" }}>
          <IcoInfo /> Configurações com <strong>configuração própria</strong> sobrescrevem o padrão do sistema para esta UBS. Configurações com <strong>padrão do sistema</strong> usam os valores globais da plataforma.
          Nenhuma dessas configurações é acessível a usuários da UBS.
        </div>
      </div>

      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header">
          Configuração Geral
          <span style={{ fontWeight: 400, fontSize: "var(--t-sm)", color: "var(--text-muted)", textTransform: "none", letterSpacing: 0 }}>
            Parâmetros operacionais desta unidade
          </span>
        </div>
        <div className="console-section__body">
          {filtered.map((field) => {
            const val = local?.general?.[field.key] ?? false;
            const isOwnOverride = data?.unitOverrides?.general?.[field.key] !== undefined;
            const dirty = isDirtyKey(field.key);
            return (
              <div key={field.key} style={{
                display: "flex", alignItems: "flex-start", gap: "var(--s-4)",
                padding: "var(--s-3) 0", borderBottom: "1px solid var(--border-subtle)",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "var(--t-md)", fontWeight: 500, color: "var(--text)" }}>{field.label}</span>
                    <InheritanceBadge isOverride={isOwnOverride} isDirty={dirty} />
                  </div>
                  <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginTop: 2 }}>{field.desc}</div>
                </div>
                <ToggleSwitch checked={val} onChange={(v) => toggle(field.key, v)} />
              </div>
            );
          })}
        </div>
      </div>

      <SectionSaveBar dirty={dirty} saving={saving} saved={saved} error={error}
        onSave={handleSave} onReset={handleReset} resetLabel="Descartar alterações" />
    </div>
  );
}

// ── Tab: Módulos ───────────────────────────────────────────────────────────

function ModulesTab({ token, unit }) {
  const [localModules, setLocalModules] = useState(unit.enabledModules || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const changed = JSON.stringify([...localModules].sort()) !== JSON.stringify([...(unit.enabledModules || [])].sort());

  function toggle(id) {
    setLocalModules((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
    setSaved(false);
  }

  async function save() {
    setSaving(true); setError("");
    try {
      await apiFetch(`/platform/units/${unit.id}/modules`, token, {
        method: "PATCH", body: JSON.stringify({ enabledModules: localModules }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header">
          Módulos e Especialidades
          <span style={{ fontWeight: 400, fontSize: "var(--t-sm)", color: "var(--text-muted)", textTransform: "none", letterSpacing: 0 }}>
            Ative os serviços disponíveis nesta unidade
          </span>
        </div>
        <div className="console-section__body">
          <div className="console-modules-grid">
            {ALL_MODULES.map(({ id, label }) => {
              const active = localModules.includes(id);
              return (
                <label key={id} className={`console-module-item${active ? " is-active" : ""}`}>
                  <input type="checkbox" checked={active} onChange={() => toggle(id)} style={{ display: "none" }} />
                  <div className="console-module-item__check">{active && <IcoCheck />}</div>
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
      <SectionSaveBar dirty={changed} saving={saving} saved={saved} error={error}
        onSave={save} onReset={() => { setLocalModules(unit.enabledModules || []); setSaved(false); }}
        resetLabel="Descartar" />
    </div>
  );
}

// ── Tab: Regras Operacionais ───────────────────────────────────────────────

function RulesTab({ token, unit }) {
  const [data, setData] = useState(null);
  const [local, setLocal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch(`/platform/units/${unit.id}/operational-rules`, token)
      .then((d) => { setData(d); setLocal(JSON.parse(JSON.stringify(d.effective))); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [unit.id, token]);

  function setVal(sectionId, key, val) {
    setLocal((prev) => ({ ...prev, [sectionId]: { ...prev[sectionId], [key]: val } }));
    setSaved(false);
  }

  const dirty = data ? JSON.stringify(data.effective) !== JSON.stringify(local) : false;

  async function handleSave() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const result = await apiFetch(`/platform/units/${unit.id}/operational-rules`, token, {
        method: "PUT", body: JSON.stringify(local),
      });
      setData((prev) => ({ ...prev, unitRules: result.unitRules, effective: result.effective }));
      setLocal(JSON.parse(JSON.stringify(result.effective)));
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="console-loading">Carregando regras...</div>;
  if (error && !local) return <Alert type="error">{error}</Alert>;

  const filteredSections = RULES_SECTIONS.map((section) => ({
    ...section,
    fields: section.fields.filter((f) =>
      !search || f.label.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((s) => s.fields.length > 0);

  return (
    <div>
      <div style={{ marginBottom: "var(--s-4)", display: "flex", gap: "var(--s-3)", alignItems: "center" }}>
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar regra..." style={{ maxWidth: 320 }} />
      </div>

      <div className="console-section" style={{ marginBottom: "var(--s-3)", background: "var(--accent-soft)", borderColor: "var(--accent-bd)" }}>
        <div className="console-section__body" style={{ fontSize: "var(--t-sm)" }}>
          <IcoInfo /> Regras operacionais são administradas exclusivamente pela equipe interna do VITRAS.
          Usuários da UBS não podem alterar estas configurações.
        </div>
      </div>

      {filteredSections.map((section) => (
        <div key={section.id} className="console-section" style={{ marginBottom: "var(--s-4)" }}>
          <div className="console-section__header">{section.label}</div>
          <div className="console-section__body">
            {section.fields.map((field) => {
              const val = local?.[section.id]?.[field.key];
              const defVal = data?.systemDefaults?.[section.id]?.[field.key];
              const isOverride = data?.unitRules?.[section.id]?.[field.key] !== undefined;
              const isDirty = JSON.stringify(val) !== JSON.stringify(data?.effective?.[section.id]?.[field.key]);
              return (
                <div key={field.key} style={{
                  display: "flex", alignItems: "flex-start", gap: "var(--s-4)",
                  padding: "var(--s-3) 0", borderBottom: "1px solid var(--border-subtle)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "var(--t-md)", fontWeight: 500 }}>{field.label}</span>
                      {field.unit && <span style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>({field.unit})</span>}
                      <InheritanceBadge isOverride={isOverride} isDirty={isDirty} />
                    </div>
                    {defVal !== undefined && !isOverride && (
                      <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                        Padrão: {String(defVal)}
                      </div>
                    )}
                  </div>
                  {field.type === "toggle" ? (
                    <ToggleSwitch checked={!!val} onChange={(v) => setVal(section.id, field.key, v)} />
                  ) : (
                    <input type="number" min={field.min ?? 0} max={field.max ?? 9999}
                      value={val ?? 0}
                      onChange={(e) => setVal(section.id, field.key, parseInt(e.target.value, 10) || 0)}
                      style={{
                        width: 80, height: 32, padding: "0 var(--s-2)", textAlign: "center",
                        border: "1px solid var(--border)", borderRadius: "var(--r-md)",
                        background: "var(--surface)", color: "var(--text)",
                        font: "var(--t-md)/1 var(--font-sans)", flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <SectionSaveBar dirty={dirty} saving={saving} saved={saved} error={error}
        onSave={handleSave} onReset={() => { setLocal(JSON.parse(JSON.stringify(data.effective))); setSaved(false); }}
        resetLabel="Restaurar valores atuais" />
    </div>
  );
}

// ── Tab: Portal do Cidadão (per-unit) ─────────────────────────────────────

const PORTAL_SECTIONS_DEF = [
  { id: "portal", label: "Status do Portal", desc: "Controle de disponibilidade e mensagens", fields: [
    { key: "ativo",                 label: "Portal ativo",               type: "toggle" },
    { key: "manutencao",            label: "Modo manutenção",            type: "toggle" },
    { key: "bannerAtivo",           label: "Banner institucional",       type: "toggle" },
    { key: "mensagemInstitucional", label: "Mensagem institucional",     type: "text"   },
    { key: "bannerTexto",           label: "Texto do banner",            type: "text"   },
  ]},
  { id: "modulos", label: "Módulos do Portal", desc: "Seções disponíveis ao cidadão", fields: [
    { key: "agendamentos", label: "Agendamentos",  type: "toggle" },
    { key: "vacinas",      label: "Vacinas",       type: "toggle" },
    { key: "medicamentos", label: "Medicamentos",  type: "toggle" },
    { key: "exames",       label: "Exames",        type: "toggle" },
    { key: "minhaUbs",     label: "Minha UBS",     type: "toggle" },
    { key: "notificacoes", label: "Notificações",  type: "toggle" },
    { key: "perfil",       label: "Perfil",        type: "toggle" },
    { key: "dependentes",  label: "Dependentes",   type: "toggle" },
    { key: "documentos",   label: "Documentos",    type: "toggle" },
  ]},
  { id: "agendamentos", label: "Agendamentos Online", desc: "Regras para agendamento digital", fields: [
    { key: "onlineAtivo",         label: "Agendamento online",          type: "toggle" },
    { key: "cancelamentoAtivo",   label: "Cancelamento online",         type: "toggle" },
    { key: "remarcacaoAtivo",     label: "Remarcação online",           type: "toggle" },
    { key: "confirmacaoAtiva",    label: "Confirmação de presença",     type: "toggle" },
    { key: "listaEspera",         label: "Lista de espera",             type: "toggle" },
    { key: "antecedenciaMinDias", label: "Antecedência mínima (dias)",  type: "number", min: 0, max: 30  },
    { key: "antecedenciaMaxDias", label: "Antecedência máxima (dias)",  type: "number", min: 1, max: 365 },
    { key: "vagasDigitaisPerc",   label: "% vagas digitais",           type: "number", min: 0, max: 100 },
  ]},
  { id: "comunicacao", label: "Comunicação", desc: "Canais de comunicação com o cidadão", fields: [
    { key: "portalAtivo",   label: "Notificações no Portal", type: "toggle" },
    { key: "whatsappAtivo", label: "WhatsApp",               type: "toggle" },
    { key: "emailAtivo",    label: "E-mail",                 type: "toggle" },
    { key: "smsAtivo",      label: "SMS",                    type: "toggle" },
  ]},
];

function PortalTab({ token, unit }) {
  const [data, setData] = useState(null);
  const [local, setLocal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch(`/platform/citizen-portal/units/${unit.id}/config`, token)
      .then((d) => { setData(d); setLocal(JSON.parse(JSON.stringify(d.unitOverrides || {}))); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [unit.id, token]);

  function setVal(sectionId, key, val) {
    setLocal((prev) => ({ ...prev, [sectionId]: { ...(prev[sectionId] || {}), [key]: val } }));
    setSaved(false);
  }

  const dirty = data ? JSON.stringify(data.unitOverrides || {}) !== JSON.stringify(local) : false;

  async function handleSave() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const result = await apiFetch(`/platform/citizen-portal/units/${unit.id}/config`, token, {
        method: "PUT", body: JSON.stringify(local),
      });
      setData((prev) => ({ ...prev, unitOverrides: result.unitOverrides, effective: result.effective }));
      setLocal(JSON.parse(JSON.stringify(result.unitOverrides || {})));
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="console-loading">Carregando configurações do Portal...</div>;
  if (error && !data) return <Alert type="error">{error}</Alert>;

  const municipal = data?.municipal || {};

  return (
    <div>
      <div className="console-section" style={{ marginBottom: "var(--s-4)", background: "var(--accent-soft)", borderColor: "var(--accent-bd)" }}>
        <div className="console-section__body" style={{ fontSize: "var(--t-sm)" }}>
          Configurações da UBS complementam as regras municipais. Uma UBS <strong>nunca pode habilitar</strong> algo desabilitado pelo município — apenas restringir mais.
          Itens bloqueados pelo município aparecem com indicador visual e são ignorados ao salvar.
        </div>
      </div>

      {PORTAL_SECTIONS_DEF.map((section) => (
        <div key={section.id} className="console-section" style={{ marginBottom: "var(--s-4)" }}>
          <div className="console-section__header">
            {section.label}
            <span style={{ fontWeight: 400, fontSize: "var(--t-sm)", color: "var(--text-muted)", textTransform: "none", letterSpacing: 0 }}>{section.desc}</span>
          </div>
          <div className="console-section__body">
            {section.fields.map((field) => {
              const muniVal = municipal?.[section.id]?.[field.key];
              const localVal = local?.[section.id]?.[field.key];
              const hasOverride = localVal !== undefined;
              const effectiveVal = hasOverride ? localVal : muniVal;
              const blocked = field.type === "toggle" && muniVal === false;
              return (
                <div key={field.key} style={{
                  display: "flex", alignItems: "flex-start", gap: "var(--s-4)",
                  padding: "var(--s-3) 0", borderBottom: "1px solid var(--border-subtle)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "var(--t-md)", fontWeight: 500 }}>{field.label}</span>
                      {blocked
                        ? <span className="chip" style={{ fontSize: 10, background: "var(--surface-3)", color: "var(--text-muted)" }}>bloqueado pelo município</span>
                        : <InheritanceBadge isOverride={hasOverride} isDirty={false} />
                      }
                    </div>
                  </div>
                  {field.type === "toggle" && (
                    <ToggleSwitch checked={!!effectiveVal} disabled={blocked} onChange={(v) => setVal(section.id, field.key, v)} />
                  )}
                  {field.type === "number" && (
                    <input type="number" min={field.min ?? 0} max={field.max ?? 999}
                      value={effectiveVal ?? 0}
                      onChange={(e) => setVal(section.id, field.key, parseInt(e.target.value,10) || 0)}
                      style={{ width: 72, height: 32, padding: "0 var(--s-2)", textAlign: "center", border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--surface)", color: "var(--text)", font: "var(--t-md)/1 var(--font-sans)", flexShrink: 0 }}
                    />
                  )}
                  {field.type === "text" && (
                    <input type="text" value={effectiveVal || ""} maxLength={300}
                      onChange={(e) => setVal(section.id, field.key, e.target.value)}
                      style={{ width: 240, height: 32, padding: "0 var(--s-3)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--surface)", color: "var(--text)", font: "var(--t-md)/1 var(--font-sans)", flexShrink: 0 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <SectionSaveBar dirty={dirty} saving={saving} saved={saved} error={error}
        onSave={handleSave} onReset={() => { setLocal(JSON.parse(JSON.stringify(data?.unitOverrides || {}))); setSaved(false); }}
        resetLabel="Descartar alterações" />
    </div>
  );
}

// ── Tab: Equipes ───────────────────────────────────────────────────────────

function TeamsTab({ token, unit, teams, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", ine: "", tipoEquipe: "" });
  const [addMode, setAddMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function startEdit(team) {
    setEditing(team.id);
    setForm({ name: team.name || "", ine: team.ine || "", tipoEquipe: team.tipoEquipe || "" });
    setError("");
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true); setError("");
    try {
      await apiFetch(`/platform/units/${unit.id}/teams/${editing}`, token, {
        method: "PATCH", body: JSON.stringify(form),
      });
      setEditing(null); onRefresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function addTeam(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await apiFetch(`/platform/units/${unit.id}/teams`, token, {
        method: "POST", body: JSON.stringify(form),
      });
      setForm({ name: "", ine: "", tipoEquipe: "" });
      setAddMode(false); onRefresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      {error && <Alert type="error" style={{ marginBottom: "var(--s-3)" }}>{error}</Alert>}

      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Equipes ({teams.length})</span>
          <Button size="sm" variant="secondary" onClick={() => { setAddMode(true); setForm({ name: "", ine: "", tipoEquipe: "" }); setError(""); }}>+ Adicionar equipe</Button>
        </div>
        <div className="console-section__body">
          {addMode && (
            <form onSubmit={addTeam} style={{ padding: "var(--s-3)", background: "var(--surface-2)", borderRadius: "var(--r-md)", marginBottom: "var(--s-4)", display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--s-3)" }}>
                <Input label="Nome *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="ESF Francisca" />
                <Input label="INE" value={form.ine} onChange={(e) => setForm((f) => ({ ...f, ine: e.target.value }))} placeholder="0000000000" />
                <Input label="Tipo" value={form.tipoEquipe} onChange={(e) => setForm((f) => ({ ...f, tipoEquipe: e.target.value }))} placeholder="ESF" />
              </div>
              <div style={{ display: "flex", gap: "var(--s-2)" }}>
                <Button type="submit" size="sm" loading={busy}>Criar</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAddMode(false)}>Cancelar</Button>
              </div>
            </form>
          )}

          {teams.length === 0 && !addMode ? (
            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>Nenhuma equipe cadastrada.</p>
          ) : (
            <div className="console-people-list">
              {teams.map((t) => (
                <div key={t.id} className="console-person" style={{ alignItems: "flex-start" }}>
                  {editing === t.id ? (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--s-2)" }}>
                        <Input label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                        <Input label="INE" value={form.ine} onChange={(e) => setForm((f) => ({ ...f, ine: e.target.value }))} />
                        <Input label="Tipo" value={form.tipoEquipe} onChange={(e) => setForm((f) => ({ ...f, tipoEquipe: e.target.value }))} />
                      </div>
                      <div style={{ display: "flex", gap: "var(--s-2)" }}>
                        <Button size="sm" loading={busy} onClick={saveEdit}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1 }}>
                        <span className="console-person__name">{t.name}</span>
                        <span className="console-person__email">
                          {t.ine ? `INE ${t.ine}` : ""}
                          {t.tipoEquipe ? ` · ${t.tipoEquipe}` : ""}
                        </span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(t)}>Editar</Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Usuários ──────────────────────────────────────────────────────────

function UsersTab({ token, unit }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch(`/platform/units/${unit.id}/users`, token)
      .then((d) => setUsers(d.users || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [unit.id, token]);

  const filtered = users.filter((u) =>
    !search ||
    (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
    String(u.vitrasId || "").includes(search) ||
    (u.role || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.teamName || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="console-loading">Carregando usuários...</div>;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div>
      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__body" style={{ padding: "var(--s-3) var(--s-5)", fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
          <IcoShield /> Usuários listados aqui têm acesso operacional ao Painel Clínico desta UBS.
          Nenhum deles possui acesso ao Console Nacional — isso requer perfil interno do VITRAS.
        </div>
      </div>

      <div style={{ marginBottom: "var(--s-4)" }}>
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, ID ou equipe..." style={{ maxWidth: 360 }} />
      </div>

      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header">
          Usuários da UBS ({users.length})
          <span style={{ fontWeight: 400, fontSize: "var(--t-sm)", color: "var(--text-muted)", textTransform: "none", letterSpacing: 0 }}>
            Ordenados por perfil
          </span>
        </div>
        <div className="console-section__body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <p style={{ padding: "var(--s-4) var(--s-5)", color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>
              {search ? "Nenhum usuário encontrado para o filtro." : "Nenhum usuário cadastrado nesta UBS."}
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>ID VITRAS</th>
                    <th>Perfil</th>
                    <th>Equipe</th>
                    <th>Status</th>
                    <th>Último acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.name || "—"}</td>
                      <td><span className="num">{u.vitrasId || "—"}</span></td>
                      <td><span className="chip">{ROLE_LABELS[u.role] || u.role}</span></td>
                      <td style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>{u.teamName || "—"}</td>
                      <td>
                        {u.inactive
                          ? <span className="chip" style={{ color: "var(--danger)" }}>Inativo</span>
                          : u.forcePasswordChange
                          ? <span className="chip warn">Troca pendente</span>
                          : <span className="chip ok">Ativo</span>
                        }
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>{fmtDate(u.lastLoginAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Gestores ──────────────────────────────────────────────────────────

function GestorsTab({ token, unit, gestors, onAddManager, onRefresh }) {
  const [resettingId, setResettingId] = useState(null);
  const [tempPwd, setTempPwd] = useState("");
  const [error, setError] = useState("");

  async function resetPassword(userId) {
    if (!window.confirm("Resetar senha deste gestor? A senha temporária será exibida uma única vez.")) return;
    setResettingId(userId); setError("");
    try {
      const data = await apiFetch(`/platform/units/${unit.id}/initial-manager/${userId}/reset-password`, token, { method: "POST" });
      setTempPwd(data.temporaryPassword || "");
      onRefresh();
    } catch (e) { setError(e.message); }
    finally { setResettingId(null); }
  }

  return (
    <div>
      {tempPwd && <TempPasswordModal password={tempPwd} onClose={() => setTempPwd("")} />}
      {error && <Alert type="error" style={{ marginBottom: "var(--s-3)" }}>{error}</Alert>}

      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Gestores ({gestors.length})</span>
          <Button size="sm" variant="secondary" onClick={onAddManager}>+ Adicionar gestor</Button>
        </div>
        <div className="console-section__body">
          {gestors.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>Nenhum gestor cadastrado.</p>
          ) : (
            <div className="console-people-list">
              {gestors.map((g) => (
                <div key={g.id} className="console-person">
                  <div style={{ flex: 1 }}>
                    <span className="console-person__name">{g.name}</span>
                    <span className="console-person__email">{g.email}</span>
                    {g.forcePasswordChange && <span className="chip warn" style={{ marginLeft: "var(--s-2)" }}>Troca pendente</span>}
                  </div>
                  <Button size="sm" variant="ghost" loading={resettingId === g.id} onClick={() => resetPassword(g.id)}>
                    Resetar senha
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Território ────────────────────────────────────────────────────────

// CepField — only input + lookup. Geocoding is handled by TerritoryTab.
function CepField({ value, onRawChange, onAutoFill, cepStatus, cepError }) {
  // cepStatus: "" | "searching" | "found" | "error"
  const debounceRef = useRef(null);

  function handleChange(e) {
    const raw = e.target.value;
    onRawChange(raw);
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onAutoFill(digits), 400);
  }

  function handleBlur(e) {
    const digits = e.target.value.replace(/\D/g, "");
    if (digits.length === 8) {
      clearTimeout(debounceRef.current);
      onAutoFill(digits);
    }
  }

  const statusLabel = {
    searching: " buscando endereço…",
    found: " ✓ endereço encontrado",
    error: "",
  }[cepStatus] || "";

  return (
    <div className="field">
      <label className="field__label">
        CEP
        {cepStatus === "searching" && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{statusLabel}</span>}
        {cepStatus === "found"     && <span style={{ color: "var(--success)",    fontWeight: 400 }}>{statusLabel}</span>}
      </label>
      <div className="input">
        <input
          value={formatCep(value)}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="00000-000"
          maxLength={9}
        />
      </div>
      {cepError && <span className="field__error">{cepError} — preencha manualmente.</span>}
    </div>
  );
}

function TerritoryTab({ token, unit, onRefresh }) {
  function formFromUnit(u) {
    return {
      cep:             u.cep           || "",
      street:          u.street        || "",
      streetNumber:    u.streetNumber  || "",
      neighborhood:    u.neighborhood  || "",
      municipalityName:u.municipalityName || "",
      uf:              u.uf            || "",
      municipalityId:  u.municipalityId || "",
      complement:      u.complement    || "",
      reference:       u.reference     || "",
      lat:             u.lat  != null ? String(u.lat)  : "",
      lng:             u.lng  != null ? String(u.lng)  : "",
    };
  }

  const [form, setForm] = useState(() => formFromUnit(unit));
  // Track last updatedAt we synced from — prevents double-reset after PATCH + onRefresh
  const syncedAtRef = useRef(unit.updatedAt || "");
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [saveError, setSaveError] = useState("");

  // CEP lookup state
  const [cepStatus, setCepStatus] = useState(""); // "" | "searching" | "found" | "error"
  const [cepError,  setCepError]  = useState("");
  const [autoFilledKeys, setAutoFilledKeys] = useState([]);

  // Geocoding state (lat/lng)
  const [geoStatus,  setGeoStatus]  = useState(""); // "" | "searching" | "found" | "error"
  const [geoError,   setGeoError]   = useState("");
  const [geoApprox,  setGeoApprox]  = useState(false);

  const geoDebounceRef = useRef(null);

  // Re-sync form when unit prop changes (after onRefresh),
  // but skip if we already synced from a PATCH response with the same updatedAt.
  useEffect(() => {
    if (unit.updatedAt && unit.updatedAt === syncedAtRef.current) return;
    syncedAtRef.current = unit.updatedAt || "";
    setForm(formFromUnit(unit));
    setAutoFilledKeys([]);
    setCepStatus(""); setCepError("");
    setGeoStatus(""); setGeoError("");
    setSaved(false); setSaveError("");
  }, [unit.id, unit.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
    setSaved(false);
    // Trigger geocoding when address fields change
    if (["street", "streetNumber", "neighborhood", "municipalityName", "uf"].includes(key)) {
      scheduleGeocode({ ...form, [key]: val });
    }
  }

  function scheduleGeocode(f) {
    clearTimeout(geoDebounceRef.current);
    // Only geocode when municipality + uf are present
    if (!f.municipalityName || !f.uf) return;
    geoDebounceRef.current = setTimeout(() => runGeocode(f), 800);
  }

  async function runGeocode(f) {
    setGeoStatus("searching"); setGeoError(""); setGeoApprox(false);
    try {
      const result = await geocodeAddress({
        street:           f.street,
        streetNumber:     f.streetNumber,
        neighborhood:     f.neighborhood,
        municipalityName: f.municipalityName,
        uf:               f.uf,
        cep:              f.cep,
      });
      setForm((prev) => ({ ...prev, lat: String(result.lat), lng: String(result.lng) }));
      setGeoStatus("found");
      setGeoApprox(!!result.approximate);
      setSaved(false);
    } catch (e) {
      setGeoStatus("error");
      setGeoError(e.message || "Não foi possível localizar as coordenadas");
    }
  }

  async function handleCepLookup(digits) {
    setCepStatus("searching"); setCepError("");
    try {
      const addr = await lookupCep(digits);
      // Batch all auto-fill in one setForm to avoid race conditions
      setForm((prev) => ({
        ...prev,
        street:           addr.street        || prev.street,
        neighborhood:     addr.neighborhood  || prev.neighborhood,
        municipalityName: addr.municipalityName || prev.municipalityName,
        uf:               addr.uf            || prev.uf,
        municipalityId:   addr.municipalityId || prev.municipalityId,
      }));
      setAutoFilledKeys(["street", "neighborhood", "municipalityName", "uf", "municipalityId"]);
      setCepStatus("found");
      setSaved(false);
      // Trigger geocoding after CEP fill
      scheduleGeocode({
        ...form,
        street:           addr.street        || form.street,
        neighborhood:     addr.neighborhood  || form.neighborhood,
        municipalityName: addr.municipalityName || form.municipalityName,
        uf:               addr.uf            || form.uf,
        cep:              digits,
      });
    } catch (e) {
      setCepStatus("error");
      setCepError(e.message || "CEP não encontrado");
    }
  }

  const hl = (k) => autoFilledKeys.includes(k) ? { background: "var(--success-soft, #f0fdf4)" } : {};
  const addressComplete = form.street && form.streetNumber && form.neighborhood && form.municipalityName && form.uf;

  function buildPayload() {
    const latRaw = form.lat !== "" && form.lat != null ? parseFloat(String(form.lat)) : null;
    const lngRaw = form.lng !== "" && form.lng != null ? parseFloat(String(form.lng)) : null;
    return {
      cep:              String(form.cep || "").replace(/\D/g, "") || null,
      street:           form.street,
      streetNumber:     form.streetNumber,
      neighborhood:     form.neighborhood,
      municipalityName: form.municipalityName,
      uf:               form.uf,
      municipalityId:   form.municipalityId || null,
      complement:       form.complement || null,
      reference:        form.reference  || null,
      lat:              (latRaw !== null && !isNaN(latRaw)) ? latRaw : null,
      lng:              (lngRaw !== null && !isNaN(lngRaw)) ? lngRaw : null,
    };
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSaveError(""); setSaved(false);
    try {
      const saved = await apiFetch(`/platform/units/${unit.id}`, token, {
        method: "PATCH",
        body: JSON.stringify(buildPayload()),
      });
      // Sync form from the persisted data returned by backend (source of truth)
      syncedAtRef.current = saved.updatedAt || "";
      setForm(formFromUnit(saved));
      setAutoFilledKeys([]);
      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
      // Refresh parent to update stats/header/gestors — won't re-trigger useEffect
      // since unit.updatedAt will match what was returned above
      onRefresh();
    } catch (err) {
      setSaveError(err.message || "Erro ao salvar endereço");
    } finally {
      setSaving(false);
    }
  }

  // Geocoding status label
  const geoLabel = {
    searching: "Buscando coordenadas…",
    found:     geoApprox ? "Localização aproximada" : "Coordenadas encontradas",
    error:     geoError,
  }[geoStatus] || "";

  return (
    <form onSubmit={handleSave}>
      {!addressComplete && !saving && (
        <Alert type="warn" style={{ marginBottom: "var(--s-4)" }}>
          <IcoWarning /> Endereço incompleto — preencha logradouro, número, bairro, município e UF.
        </Alert>
      )}

      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header">Endereço</div>
        <div className="console-section__body">
          <div className="field-grid">
            <CepField
              value={form.cep}
              onRawChange={(v) => { setForm((f) => ({ ...f, cep: v })); setSaved(false); }}
              onAutoFill={handleCepLookup}
              cepStatus={cepStatus}
              cepError={cepError}
            />
            <div style={hl("street")}>
              <Input label="Logradouro" value={form.street}
                onChange={(e) => setField("street", e.target.value)} placeholder="Rua das Flores" />
            </div>
            <Input label="Número" value={form.streetNumber}
              onChange={(e) => setField("streetNumber", e.target.value)} placeholder="123" />
            <div style={hl("neighborhood")}>
              <Input label="Bairro" value={form.neighborhood}
                onChange={(e) => setField("neighborhood", e.target.value)} placeholder="Centro" />
            </div>
            <div style={hl("municipalityName")}>
              <Input label="Município" value={form.municipalityName}
                onChange={(e) => setField("municipalityName", e.target.value)} placeholder="Recife" />
            </div>
            <div className="field" style={hl("uf")}>
              <label className="field__label">UF</label>
              <select className="console-filter-select" style={{ height: 34, width: "100%" }}
                value={form.uf} onChange={(e) => setField("uf", e.target.value)}>
                <option value="">Selecionar UF</option>
                {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div style={hl("municipalityId")}>
              <Input label="Código IBGE (7 dígitos)" value={form.municipalityId}
                onChange={(e) => setField("municipalityId", e.target.value)} placeholder="2611606" />
            </div>
            <Input label="Complemento" value={form.complement}
              onChange={(e) => { setForm((f) => ({ ...f, complement: e.target.value })); setSaved(false); }}
              placeholder="Ap. 10" />
            <Input label="Referência" value={form.reference}
              onChange={(e) => { setForm((f) => ({ ...f, reference: e.target.value })); setSaved(false); }}
              placeholder="Próximo à Praça Central" />
          </div>
        </div>
      </div>

      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header">
          Coordenadas
          <span style={{ fontWeight: 400, fontSize: "var(--t-sm)", textTransform: "none", letterSpacing: 0, color: "var(--text-muted)" }}>
            {geoStatus === "searching" && <span style={{ color: "var(--text-muted)" }}> buscando coordenadas…</span>}
            {geoStatus === "found"     && <span style={{ color: geoApprox ? "var(--warning)" : "var(--success)" }}> {geoLabel}</span>}
            {geoStatus === "error"     && <span style={{ color: "var(--warning)" }}> Não foi possível localizar as coordenadas — edite manualmente</span>}
          </span>
        </div>
        <div className="console-section__body">
          <div className="field-grid">
            <Input label="Latitude" value={form.lat}
              onChange={(e) => { setForm((f) => ({ ...f, lat: e.target.value })); setSaved(false); setGeoStatus(""); }}
              placeholder="-8.0476" type="number" step="any" min="-90" max="90" />
            <Input label="Longitude" value={form.lng}
              onChange={(e) => { setForm((f) => ({ ...f, lng: e.target.value })); setSaved(false); setGeoStatus(""); }}
              placeholder="-34.8770" type="number" step="any" min="-180" max="180" />
          </div>
          {geoApprox && geoStatus === "found" && (
            <p style={{ fontSize: "var(--t-xs)", color: "var(--warning)", marginTop: "var(--s-2)" }}>
              Localização aproximada — adicione o número para maior precisão.
            </p>
          )}
        </div>
      </div>

      {saveError && <Alert type="error" style={{ marginBottom: "var(--s-3)" }}>{saveError}</Alert>}

      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", padding: "var(--s-3) 0" }}>
        <Button type="submit" loading={saving} disabled={saving}>
          {saving ? "Salvando…" : "Salvar endereço"}
        </Button>
        {saved && !saving && (
          <span style={{ fontSize: "var(--t-sm)", color: "var(--success)" }}>✓ Endereço salvo com sucesso</span>
        )}
        {!saved && !saving && (
          <span style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>Alterações pendentes</span>
        )}
      </div>
    </form>
  );
}

// ── Tab: Integrações ───────────────────────────────────────────────────────

function IntegrationsTab({ unit }) {
  const INTEGRATIONS = [
    { id: "cds_export", label: "e-SUS CDS Export", desc: "Exportação de fichas para o e-SUS APS (CDS)", status: "active", note: "Protocolo nativo da plataforma VITRAS. Não requer configuração adicional por UBS." },
    { id: "pec",        label: "PEC e-SUS",         desc: "Prontuário Eletrônico do Cidadão (futuro)", status: "pending", note: "Requer contrato com o município e credenciais do PEC. Disponível em versão futura." },
    { id: "cnes",       label: "CNES",               desc: "Cadastro Nacional de Estabelecimentos de Saúde", status: "partial", note: `CNES configurado: ${unit.cnes || "não informado"}. Sincronização automática não disponível nesta versão.` },
    { id: "notif",      label: "Notificações (WhatsApp / SMS)", desc: "Envio de lembretes e avisos ao cidadão", status: "pending", note: "Requer integração com provedor de mensagens. Disponível em versão futura." },
  ];

  const statusChip = {
    active:  { label: "Ativo",    color: "var(--success)",   bg: "var(--success-soft, #f0fdf4)" },
    partial: { label: "Parcial",  color: "var(--warning)",   bg: "var(--warning-soft, #fef3c7)" },
    pending: { label: "Pendente", color: "var(--text-muted)", bg: "var(--surface-2)" },
  };

  return (
    <div>
      <div className="console-section" style={{ marginBottom: "var(--s-3)", background: "var(--surface-2)", borderColor: "var(--border)" }}>
        <div className="console-section__body" style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
          <IcoInfo /> Integrações são configuradas pela equipe interna do VITRAS. Nenhuma credencial é exibida nesta tela.
          Não altere <code>cds-export.js</code> sem aprovação e revisão de LGPD.
        </div>
      </div>

      {INTEGRATIONS.map((integ) => {
        const s = statusChip[integ.status] || statusChip.pending;
        return (
          <div key={integ.id} className="console-section" style={{ marginBottom: "var(--s-3)" }}>
            <div className="console-section__body">
              <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--s-4)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", marginBottom: "var(--s-1)" }}>
                    <span style={{ fontWeight: 600, fontSize: "var(--t-md)" }}>{integ.label}</span>
                    <span className="chip" style={{ fontSize: 10, color: s.color, background: s.bg, border: `1px solid ${s.color}20` }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginBottom: "var(--s-1)" }}>{integ.desc}</div>
                  <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>{integ.note}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Segurança ─────────────────────────────────────────────────────────

function SecurityTab({ unit }) {
  const SECURITY_ITEMS = [
    { label: "Acesso ao Console Nacional",      status: "blocked", note: "Usuários desta UBS são bloqueados de /platform/* no backend. Verificado via requireSupportAdmin." },
    { label: "Separação clínica / plataforma",  status: "ok",      note: "blockSupportAdminFromClinical impede support_admin de acessar rotas clínicas." },
    { label: "Autenticação JWT",                status: "ok",      note: "Tokens JWT com issuer, audience e expiração. Não alterável por configuração de UBS." },
    { label: "Cookie CSRF",                     status: "ok",      note: "CSRF token via cookie httpOnly. Não alterável por configuração de UBS." },
    { label: "RBAC por capabilities",           status: "ok",      note: "Cada rota valida capability explícita. Role de gestor local não concede acesso de plataforma." },
    { label: "Auditoria de alterações",         status: "ok",      note: "Toda mutação registra log de auditoria com usuário, data e detalhes." },
    { label: "LGPD — campos sensíveis",         status: "ok",      note: "Dados clínicos especiais não são registrados em logs de auditoria operacional." },
    { label: "Criptografia de dados",           status: "ok",      note: "AES-256-GCM com chave rotacionável. Campos sensíveis criptografados em repouso." },
  ];

  const statusIcon = { ok: "✓", blocked: "🔒", warn: "⚠" };
  const statusColor = { ok: "var(--success)", blocked: "var(--accent)", warn: "var(--warning)" };

  return (
    <div>
      <div className="console-section" style={{ marginBottom: "var(--s-3)", background: "var(--surface-2)" }}>
        <div className="console-section__body" style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
          <IcoShield /> Configurações de segurança são validadas no backend. Ocultar no frontend não é suficiente —
          o backend rejeita qualquer tentativa de acesso indevido independente da interface.
        </div>
      </div>

      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header">Controles de Segurança</div>
        <div className="console-section__body">
          {SECURITY_ITEMS.map((item) => (
            <div key={item.label} style={{
              display: "flex", alignItems: "flex-start", gap: "var(--s-3)",
              padding: "var(--s-3) 0", borderBottom: "1px solid var(--border-subtle)",
            }}>
              <span style={{ color: statusColor[item.status], fontSize: "var(--t-md)", flexShrink: 0, width: 18 }}>
                {statusIcon[item.status]}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: "var(--t-md)" }}>{item.label}</div>
                <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", marginTop: 2 }}>{item.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header">Resumo de Acesso — {unit.name}</div>
        <div className="console-section__body">
          {[
            ["support_admin",      "Console Nacional completo",  "var(--accent)"],
            ["break_glass_admin",  "Painel Clínico (via capability explícita, sem Console Nacional)", "var(--warning)"],
            ["gestor",             "Painel Clínico — gestão operacional da UBS", "var(--text-muted)"],
            ["médico / enfermeiro","Painel Clínico — atendimento clínico", "var(--text-muted)"],
            ["ACS",                "Painel Clínico — visitas e cadastro territorial", "var(--text-muted)"],
          ].map(([role, access, color]) => (
            <div key={role} style={{ display: "flex", gap: "var(--s-3)", padding: "var(--s-2) 0", borderBottom: "1px solid var(--border-subtle)", alignItems: "center" }}>
              <span className="chip" style={{ color, fontSize: 10, flexShrink: 0 }}>{role}</span>
              <span style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>{access}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Auditoria ─────────────────────────────────────────────────────────

function AuditTab({ token, unit }) {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch(`/platform/units/${unit.id}/audit-log?limit=100`, token)
      .then((d) => { setEntries(d.entries || []); setTotal(d.total || 0); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [unit.id, token]);

  const filtered = entries.filter((e) =>
    !search ||
    (ACTION_LABELS[e.action] || e.action).toLowerCase().includes(search.toLowerCase()) ||
    (e.userName || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="console-loading">Carregando auditoria...</div>;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div>
      <div style={{ marginBottom: "var(--s-4)", display: "flex", gap: "var(--s-3)", alignItems: "center" }}>
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por ação ou usuário..." style={{ maxWidth: 360 }} />
        <span style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
          {total} registro{total !== 1 ? "s" : ""} total{total !== 1 ? "is" : ""}
        </span>
      </div>

      <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
        <div className="console-section__header">Histórico de Alterações</div>
        <div className="console-section__body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <p style={{ padding: "var(--s-4) var(--s-5)", color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>
              {search ? "Nenhum registro encontrado." : "Nenhuma alteração registrada para esta UBS."}
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Data / Hora</th>
                    <th>Ação</th>
                    <th>Usuário</th>
                    <th>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id || e.createdAt}>
                      <td style={{ whiteSpace: "nowrap", fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>{fmtDateTime(e.createdAt)}</td>
                      <td>
                        <span className="chip" style={{ fontSize: 10 }}>{ACTION_LABELS[e.action] || e.action}</span>
                      </td>
                      <td style={{ fontSize: "var(--t-sm)" }}>{e.userName || "system"}</td>
                      <td style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {e.details?.changedSections
                          ? `Seções: ${e.details.changedSections.join(", ")}`
                          : e.details?.module
                          ? `Módulo: ${e.details.module}`
                          : e.details?.changedFields
                          ? `Campos: ${e.details.changedFields.join(", ")}`
                          : "—"
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main UnitDetail ────────────────────────────────────────────────────────

export default function UnitDetail({ token, unitId, onBack }) {
  const [unit, setUnit] = useState(null);
  const [formView, setFormView] = useState(null); // "new-team" | "new-manager" | "edit-unit-data"
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [managerForm, setManagerForm] = useState({ name: "", email: "", cpf: "", cns: "", cbo: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [tempPwd, setTempPwd] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [checklist, setChecklist] = useState(null);

  async function loadChecklist(id) {
    try { const data = await apiFetch(`/platform/units/${id}/checklist`, token); setChecklist(data); }
    catch { setChecklist(null); }
  }

  const loadUnit = useCallback(() => {
    setLoading(true);
    apiFetch(`/platform/units/${unitId}`, token)
      .then(setUnit)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [unitId, token]);

  useEffect(() => { loadUnit(); }, [loadUnit]);
  useEffect(() => { if (unitId && token) loadChecklist(unitId); }, [unitId, token]); // eslint-disable-line

  function setMF(key) { return (e) => setManagerForm((f) => ({ ...f, [key]: e.target.value })); }

  async function handleTransition(toStatus) {
    if (!window.confirm(`Confirmar transição: ${STATUS_LABELS[unit?.status]} → ${STATUS_LABELS[toStatus]}?`)) return;
    setTransitioning(true); setFormError("");
    try {
      await apiFetch(`/platform/units/${unitId}`, token, { method: "PATCH", body: JSON.stringify({ status: toStatus }) });
      loadUnit();
    } catch (err) {
      let msg = err.message;
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.blocked?.length) msg = `Critérios pendentes:\n• ${parsed.blocked.map((b) => b.label).join("\n• ")}`;
      } catch { /* not JSON */ }
      setFormError(msg);
    } finally { setTransitioning(false); }
  }

  async function handleChecklistItem(itemId, value) {
    try {
      const data = await apiFetch(`/platform/units/${unitId}/homologation-checklist`, token, {
        method: "PATCH", body: JSON.stringify({ [itemId]: value })
      });
      setChecklist((prev) => prev ? {
        ...prev,
        criteria: prev.criteria.map((c) => c.id === itemId ? { ...c, pass: value } : c),
        ok: data.allChecked
      } : prev);
      if (data.allChecked) loadUnit();
    } catch (err) { setFormError(err.message); }
  }

  async function submitManager(e) {
    e.preventDefault();
    setFormError(""); setBusy(true);
    try {
      const data = await apiFetch(`/platform/units/${unitId}/initial-manager`, token, {
        method: "POST", body: JSON.stringify(managerForm)
      });
      setTempPwd(data.temporaryPassword || "");
      setManagerForm({ name: "", email: "", cpf: "", cns: "", cbo: "", phone: "" });
      setFormView(null); loadUnit();
    } catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="console-loading">Carregando dados da UBS...</div>;
  if (error)   return <Alert type="error">{error}</Alert>;
  if (!unit)   return null;

  const gestors = unit.gestors || [];
  const teams   = unit.teams   || [];
  const moduleCount = (unit.enabledModules || []).length;
  const hasConfig = unit.configuration && Object.keys(unit.configuration).length > 0;
  const hasRules  = unit.operationalRules && Object.keys(unit.operationalRules).length > 0;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="console-breadcrumb">
        <Button type="button" variant="ghost" size="sm" onClick={() => { setFormView(null); onBack(); }}>← Unidades</Button>
        <span className="console-breadcrumb__sep">/</span>
        <span className="console-breadcrumb__current">{unit.name}</span>
      </div>

      {/* Header */}
      <div className="console-page-header" style={{ marginBottom: "var(--s-4)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", flexWrap: "wrap", marginBottom: "var(--s-2)" }}>
            <h1 className="console-page-header__title" style={{ fontSize: "var(--t-xl)", margin: 0 }}>{unit.name}</h1>
            <StatusBadge status={unit.status} />
          </div>
          <div style={{ display: "flex", gap: "var(--s-4)", flexWrap: "wrap", fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
            {unit.cnes && <span>CNES {unit.cnes}</span>}
            {unit.municipalityName && <span>{unit.municipalityName}{unit.uf ? ` / ${unit.uf}` : ""}</span>}
            <span>{teams.length} equipe{teams.length !== 1 ? "s" : ""}</span>
            <span>{gestors.length} gestor{gestors.length !== 1 ? "es" : ""}</span>
            <span>{unit.userCount ?? 0} usuário{(unit.userCount ?? 0) !== 1 ? "s" : ""}</span>
            <span>{unit.patientCount ?? 0} paciente{(unit.patientCount ?? 0) !== 1 ? "s" : ""}</span>
            {moduleCount > 0 && <span>{moduleCount} módulo{moduleCount !== 1 ? "s" : ""} ativo{moduleCount !== 1 ? "s" : ""}</span>}
            {hasConfig && <span className="chip" style={{ fontSize: 10 }}>config própria</span>}
            {hasRules  && <span className="chip" style={{ fontSize: 10 }}>regras próprias</span>}
          </div>
        </div>
        {!formView && (
          <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
            <Button variant="secondary" size="sm" onClick={() => { setFormView("edit-unit-data"); setFormError(""); }}>Editar dados</Button>
            <Button variant="secondary" size="sm" onClick={() => { setFormError(""); setActiveTab("teams"); setFormView(null); }}>+ Equipe</Button>
            <Button variant="secondary" size="sm" onClick={() => { setFormError(""); setTempPwd(""); setActiveTab("gestors"); setFormView("new-manager"); }}>+ Gestor</Button>
          </div>
        )}
      </div>

      {tempPwd && <TempPasswordModal password={tempPwd} onClose={() => setTempPwd("")} />}

      {/* Form overlays */}
      {formView === "edit-unit-data" && (
        <TerritoryTab token={token} unit={unit} onRefresh={() => { setFormView(null); loadUnit(); }} />
      )}
      {formView === "new-manager" && (
        <div className="console-section" style={{ marginBottom: "var(--s-4)" }}>
          <div className="console-section__header">Gestor Inicial</div>
          {formError && <Alert type="error" style={{ margin: "0 var(--s-5) var(--s-3)" }}>{formError}</Alert>}
          <form onSubmit={submitManager}>
            <div className="field-grid">
              <Input label="Nome completo *" value={managerForm.name} onChange={setMF("name")} placeholder="Maria da Silva" />
              <Input label="E-mail *"       value={managerForm.email} onChange={setMF("email")} placeholder="gestora@ubs.gov.br" />
              <Input label="CPF"            value={managerForm.cpf}  onChange={setMF("cpf")}  placeholder="000.000.000-00" />
              <Input label="CNS"            value={managerForm.cns}  onChange={setMF("cns")}  placeholder="000 0000 0000 0000" />
              <Input label="CBO"            value={managerForm.cbo}  onChange={setMF("cbo")}  placeholder="2232" />
              <Input label="Telefone"       value={managerForm.phone} onChange={setMF("phone")} placeholder="(81) 99999-0000" />
            </div>
            <div style={{ display: "flex", gap: "var(--s-3)", padding: "0 var(--s-5) var(--s-5)" }}>
              <Button type="submit" loading={busy}>Criar gestor</Button>
              <Button type="button" variant="ghost" onClick={() => { setFormError(""); setFormView(null); }}>Cancelar</Button>
            </div>
          </form>
        </div>
      )}

      {/* Tab navigation (hide when form overlay is showing) */}
      {!formView && (
        <>
          <div style={{ display: "flex", gap: 0, flexWrap: "wrap", borderBottom: "1px solid var(--border)", marginBottom: "var(--s-5)", overflowX: "auto" }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "var(--s-2) var(--s-4)", border: "none", background: "none",
                  borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
                  color: activeTab === tab.id ? "var(--accent)" : "var(--text-muted)",
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  fontSize: "var(--t-sm)", cursor: "pointer", whiteSpace: "nowrap",
                  marginBottom: -1,
                  transition: "color var(--d-fast), border-color var(--d-fast)",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <OverviewTab
              unit={unit} gestors={gestors} teams={teams}
              checklist={checklist} transitioning={transitioning} formError={formError}
              onTransition={handleTransition} onChecklistItem={handleChecklistItem}
              onAddTeam={() => { setActiveTab("teams"); }}
              onAddManager={() => { setFormView("new-manager"); setTempPwd(""); setFormError(""); }}
              onEdit={() => { setFormView("edit-unit-data"); setFormError(""); }}
            />
          )}
          {activeTab === "config"      && <ConfigTab     token={token} unit={unit} />}
          {activeTab === "modules"     && <ModulesTab    token={token} unit={unit} />}
          {activeTab === "rules"       && <RulesTab      token={token} unit={unit} />}
          {activeTab === "portal"      && <PortalTab     token={token} unit={unit} />}
          {activeTab === "teams"       && <TeamsTab      token={token} unit={unit} teams={teams} onRefresh={loadUnit} />}
          {activeTab === "users"       && <UsersTab      token={token} unit={unit} />}
          {activeTab === "gestors"     && <GestorsTab    token={token} unit={unit} gestors={gestors} onAddManager={() => setFormView("new-manager")} onRefresh={loadUnit} />}
          {activeTab === "territory"   && <TerritoryTab  token={token} unit={unit} onRefresh={loadUnit} />}
          {activeTab === "integrations"&& <IntegrationsTab unit={unit} />}
          {activeTab === "security"    && <SecurityTab   unit={unit} />}
          {activeTab === "agenda"      && <ScheduleConfigTab token={token} unit={unit} />}
          {activeTab === "audit"       && <AuditTab      token={token} unit={unit} />}
        </>
      )}
    </div>
  );
}
