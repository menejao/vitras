/**
 * ScheduleConfigTab — Configuração operacional de escalas e bloqueios por profissional.
 * Domínio da UBS — acessado pelo gestor e perfis autorizados no módulo operacional.
 * Reutilizável: aceita { token, unitId, canEdit } ou { token, unit } para compat.
 *
 * Regras (Sprint 5 + Relocation):
 *   - Toda lógica de slots permanece no backend (scheduleEngine.js)
 *   - Canal: portal, reception, nursing, reserve (valores absolutos)
 *   - Soma dos canais ≤ capacidade do período (validado no backend)
 *   - Bloqueios por data prevalecem sobre recorrência semanal (backend)
 *   - Agendamentos existentes NUNCA são cancelados automaticamente
 *   - Conflitos retornados no POST /schedule/blocks devem ser exibidos ao usuário
 */

import { useState, useEffect, useCallback } from "react";
import {
  listScheduleConfigurations,
  listScheduleBlocks,
  saveScheduleConfiguration,
  updateScheduleConfiguration,
  setScheduleStatus,
  createScheduleBlock,
  updateScheduleBlock,
  deleteScheduleBlock,
  listUsers,
} from "../../api";

const ISO_DAY_LABELS = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const BLOCK_TYPE_LABELS = {
  absence:  "Falta / Ausência",
  holiday:  "Feriado",
  meeting:  "Reunião",
  course:   "Curso / Capacitação",
  vacation: "Férias",
  other:    "Outro",
};

const CHANNEL_LABELS = {
  portal:    "Portal",
  reception: "Recepção",
  nursing:   "Enfermagem",
  reserve:   "Reserva",
};

const DEFAULT_WEEKLY = Array.from({ length: 5 }, (_, i) => ({
  dayOfWeek: i + 1,
  active: true,
  periods: [
    {
      startTime: "07:00",
      endTime: "17:30",
      capacity: null,
      channelAllocation: { portal: 0, reception: 0, nursing: 0, reserve: 0 },
    },
  ],
}));

function emptyConfig(professionalId, unitId) {
  return {
    professionalId,
    unitId,
    status: "open",
    slotDurationMinutes: 30,
    weeklySchedule: DEFAULT_WEEKLY,
  };
}

function emptyBlock(unitId, professionalId) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    unitId,
    professionalId: professionalId || "",
    type: "absence",
    reason: "",
    startDate: today,
    endDate: today,
    startTime: "",
    endTime: "",
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        background: status === "open" ? "var(--success-bg, #d1fae5)" : "var(--danger-bg, #fee2e2)",
        color: status === "open" ? "var(--success-text, #065f46)" : "var(--danger-text, #991b1b)",
      }}
    >
      {status === "open" ? "Aberta" : "Fechada"}
    </span>
  );
}

function PeriodEditor({ period, onChange, onRemove, slotMin }) {
  const updateAlloc = (channel, val) => {
    onChange({
      ...period,
      channelAllocation: {
        ...period.channelAllocation,
        [channel]: Number(val) || 0,
      },
    });
  };

  return (
    <div className="schedule-period">
      <div className="schedule-period__times">
        <label>
          Início
          <input
            type="time"
            value={period.startTime}
            onChange={e => onChange({ ...period, startTime: e.target.value })}
          />
        </label>
        <span>–</span>
        <label>
          Fim
          <input
            type="time"
            value={period.endTime}
            onChange={e => onChange({ ...period, endTime: e.target.value })}
          />
        </label>
        <button type="button" className="btn-icon btn-icon--danger" onClick={onRemove} title="Remover período">
          ×
        </button>
      </div>
      <div className="schedule-period__channels">
        {Object.keys(CHANNEL_LABELS).map(ch => (
          <label key={ch} className="schedule-channel-input">
            <span>{CHANNEL_LABELS[ch]}</span>
            <input
              type="number"
              min={0}
              max={999}
              value={period.channelAllocation?.[ch] ?? 0}
              onChange={e => updateAlloc(ch, e.target.value)}
              style={{ width: 56 }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function DayRow({ day, onChange, slotMin }) {
  const addPeriod = () =>
    onChange({
      ...day,
      periods: [
        ...day.periods,
        { startTime: "13:00", endTime: "17:30", capacity: null, channelAllocation: { portal: 0, reception: 0, nursing: 0, reserve: 0 } },
      ],
    });

  return (
    <div className={`schedule-day${day.active ? "" : " schedule-day--inactive"}`}>
      <div className="schedule-day__header">
        <label className="schedule-day__toggle">
          <input
            type="checkbox"
            checked={day.active}
            onChange={e => onChange({ ...day, active: e.target.checked })}
          />
          <strong>{ISO_DAY_LABELS[day.dayOfWeek]}</strong>
        </label>
        {day.active && (
          <button type="button" className="btn-link" onClick={addPeriod}>
            + Período
          </button>
        )}
      </div>
      {day.active && (
        <div className="schedule-day__periods">
          {(day.periods || []).map((period, idx) => (
            <PeriodEditor
              key={idx}
              period={period}
              slotMin={slotMin}
              onChange={updated => {
                const next = [...day.periods];
                next[idx] = updated;
                onChange({ ...day, periods: next });
              }}
              onRemove={() => {
                const next = day.periods.filter((_, i) => i !== idx);
                onChange({ ...day, periods: next });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigForm({ config, onSave, onCancel, saving, error }) {
  const [form, setForm] = useState(config);

  const updateDay = (idx, updated) => {
    const ws = [...form.weeklySchedule];
    ws[idx] = updated;
    setForm({ ...form, weeklySchedule: ws });
  };

  return (
    <div className="schedule-config-form">
      <div className="schedule-form-row">
        <label>
          Duração do slot (min)
          <input
            type="number"
            min={5}
            max={120}
            value={form.slotDurationMinutes}
            onChange={e => setForm({ ...form, slotDurationMinutes: Number(e.target.value) })}
            style={{ width: 80 }}
          />
        </label>
        <label>
          Status
          <select
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value })}
          >
            <option value="open">Aberta</option>
            <option value="closed">Fechada</option>
          </select>
        </label>
      </div>

      <div className="schedule-week">
        {(form.weeklySchedule || []).map((day, idx) => (
          <DayRow
            key={day.dayOfWeek}
            day={day}
            slotMin={form.slotDurationMinutes}
            onChange={updated => updateDay(idx, updated)}
          />
        ))}
      </div>

      {error && <p style={{ color: "var(--error, red)", marginTop: 8 }}>{error}</p>}

      <div className="schedule-form-actions">
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="button" className="btn btn--primary" onClick={() => onSave(form)} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

function BlockForm({ unitId, professionalId, onSave, onCancel, saving, error }) {
  const [form, setForm] = useState(emptyBlock(unitId, professionalId));

  return (
    <div className="schedule-block-form">
      <div className="schedule-form-row">
        <label>
          Tipo
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            {Object.entries(BLOCK_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Data início
          <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
        </label>
        <label>
          Data fim
          <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
        </label>
      </div>
      <div className="schedule-form-row">
        <label>
          Hora início (opcional)
          <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
        </label>
        <label>
          Hora fim (opcional)
          <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
        </label>
        <label style={{ flex: 2 }}>
          Motivo
          <input
            type="text"
            value={form.reason}
            onChange={e => setForm({ ...form, reason: e.target.value })}
            placeholder={form.type === "other" ? "Obrigatório" : "Opcional"}
          />
        </label>
      </div>
      {error && <p style={{ color: "var(--error, red)", marginTop: 8 }}>{error}</p>}
      <div className="schedule-form-actions">
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="button" className="btn btn--primary" onClick={() => onSave(form)} disabled={saving}>
          {saving ? "Salvando…" : "Salvar bloqueio"}
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ScheduleConfigTab({ token, unit, unitId: unitIdProp, canEdit = true }) {
  const unitId = unitIdProp || unit?.id || "";

  const [users, setUsers] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("");
  const [editingConfig, setEditingConfig] = useState(null); // null | config object
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingBlock, setSavingBlock] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [blockError, setBlockError] = useState(null);
  const [conflicts, setConflicts] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, configsRes, blocksRes] = await Promise.all([
        listUsers(token),
        listScheduleConfigurations(token, unitId),
        listScheduleBlocks(token, { unitId }),
      ]);
      const clinical = (usersRes?.users || usersRes || []).filter(
        u => u.unitId === unitId && !["support_admin", "developer_readonly"].includes(u.role)
      );
      setUsers(clinical);
      setConfigs(configsRes?.data || []);
      setBlocks(blocksRes?.data || []);
    } catch (err) {
      setError(err?.message || "Erro ao carregar dados de agenda");
    } finally {
      setLoading(false);
    }
  }, [token, unitId]);

  useEffect(() => { load(); }, [load]);

  const selectedUser = users.find(u => u.id === selectedProfessionalId) || null;
  const activeConfig = configs.find(c => c.professionalId === selectedProfessionalId) || null;
  const professionalBlocks = blocks.filter(
    b => !b.professionalId || b.professionalId === selectedProfessionalId
  );

  async function handleSaveConfig(form) {
    setSavingConfig(true);
    setConfigError(null);
    try {
      if (activeConfig?.id) {
        await updateScheduleConfiguration(token, activeConfig.id, form);
      } else {
        await saveScheduleConfiguration(token, { ...form, professionalId: selectedProfessionalId, unitId });
      }
      setEditingConfig(null);
      await load();
    } catch (err) {
      setConfigError(err?.message || "Erro ao salvar configuração");
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleToggleStatus() {
    if (!activeConfig?.id) return;
    const newStatus = activeConfig.status === "open" ? "closed" : "open";
    try {
      await setScheduleStatus(token, activeConfig.id, newStatus);
      await load();
    } catch (err) {
      setError(err?.message || "Erro ao alterar status");
    }
  }

  async function handleSaveBlock(form) {
    setSavingBlock(true);
    setBlockError(null);
    setConflicts(null);
    try {
      const res = await createScheduleBlock(token, { ...form, professionalId: selectedProfessionalId || null, unitId });
      if (res?.conflicts?.length > 0) {
        setConflicts(res.conflicts);
      }
      setShowBlockForm(false);
      await load();
    } catch (err) {
      setBlockError(err?.message || "Erro ao criar bloqueio");
    } finally {
      setSavingBlock(false);
    }
  }

  async function handleDeleteBlock(id) {
    if (!window.confirm("Remover este bloqueio?")) return;
    try {
      await deleteScheduleBlock(token, id);
      await load();
    } catch (err) {
      setError(err?.message || "Erro ao remover bloqueio");
    }
  }

  if (loading) return <p style={{ padding: 24 }}>Carregando configurações de agenda…</p>;
  if (error) return <p style={{ padding: 24, color: "var(--error, red)" }}>{error}</p>;

  return (
    <div className="schedule-config-tab">
      <div className="schedule-config-tab__header">
        <h3>Configuração de Agenda</h3>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
          Configure escalas semanais e bloqueios por profissional. Toda lógica de disponibilidade é calculada no servidor.
        </p>
      </div>

      {/* Seleção de profissional */}
      <div className="schedule-config-tab__selector">
        <label>
          <strong>Profissional</strong>
          <select
            value={selectedProfessionalId}
            onChange={e => {
              setSelectedProfessionalId(e.target.value);
              setEditingConfig(null);
              setShowBlockForm(false);
              setConflicts(null);
            }}
          >
            <option value="">— Selecione um profissional —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name || u.username} ({u.role})
              </option>
            ))}
          </select>
        </label>
      </div>

      {!selectedProfessionalId && (
        <p style={{ padding: "16px 0", color: "var(--text-muted)" }}>
          Selecione um profissional para gerenciar sua escala.
        </p>
      )}

      {selectedProfessionalId && (
        <>
          {/* Configuração de escala semanal */}
          <section className="schedule-section">
            <div className="schedule-section__header">
              <h4>Escala Semanal</h4>
              {activeConfig && <StatusBadge status={activeConfig.status} />}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {canEdit && activeConfig && (
                  <button type="button" className="btn btn--secondary btn--sm" onClick={handleToggleStatus}>
                    {activeConfig.status === "open" ? "Fechar agenda" : "Abrir agenda"}
                  </button>
                )}
                {canEdit && <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() =>
                    setEditingConfig(
                      activeConfig || emptyConfig(selectedProfessionalId, unitId)
                    )
                  }
                >
                  {activeConfig ? "Editar escala" : "Configurar escala"}
                </button>}
              </div>
            </div>

            {!activeConfig && !editingConfig && (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Sem configuração cadastrada. Usando fallback: Seg–Sex, 07:00–17:30, slots de 30min.
              </p>
            )}

            {activeConfig && !editingConfig && (
              <div className="schedule-summary">
                <p>Slot: <strong>{activeConfig.slotDurationMinutes} min</strong></p>
                <div className="schedule-summary__days">
                  {(activeConfig.weeklySchedule || []).map(d => (
                    <span
                      key={d.dayOfWeek}
                      className={`schedule-day-chip${d.active ? " schedule-day-chip--active" : ""}`}
                    >
                      {ISO_DAY_LABELS[d.dayOfWeek]?.slice(0, 3)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {editingConfig && (
              <ConfigForm
                config={editingConfig}
                onSave={handleSaveConfig}
                onCancel={() => setEditingConfig(null)}
                saving={savingConfig}
                error={configError}
              />
            )}
          </section>

          {/* Bloqueios */}
          <section className="schedule-section">
            <div className="schedule-section__header">
              <h4>Bloqueios de Agenda</h4>
              {canEdit && <button
                type="button"
                className="btn btn--secondary btn--sm"
                style={{ marginLeft: "auto" }}
                onClick={() => setShowBlockForm(v => !v)}
              >
                {showBlockForm ? "Cancelar" : "+ Novo bloqueio"}
              </button>}
            </div>

            {conflicts && conflicts.length > 0 && (
              <div className="schedule-conflicts-alert">
                <strong>Atenção:</strong> {conflicts.length} agendamento(s) existente(s) caem dentro do bloqueio criado.
                Esses agendamentos <strong>não foram cancelados automaticamente</strong> — verifique e cancele manualmente se necessário.
                <ul style={{ marginTop: 4 }}>
                  {conflicts.slice(0, 5).map(c => (
                    <li key={c.id}>{c.date} {c.time} — paciente #{c.patientId}</li>
                  ))}
                  {conflicts.length > 5 && <li>… e mais {conflicts.length - 5}</li>}
                </ul>
                <button type="button" className="btn-link" onClick={() => setConflicts(null)}>
                  Fechar
                </button>
              </div>
            )}

            {showBlockForm && (
              <BlockForm
                unitId={unitId}
                professionalId={selectedProfessionalId}
                onSave={handleSaveBlock}
                onCancel={() => setShowBlockForm(false)}
                saving={savingBlock}
                error={blockError}
              />
            )}

            {professionalBlocks.length === 0 && !showBlockForm && (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Nenhum bloqueio cadastrado.</p>
            )}

            {professionalBlocks.length > 0 && (
              <table className="schedule-blocks-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Período</th>
                    <th>Horário</th>
                    <th>Motivo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {professionalBlocks
                    .sort((a, b) => a.startDate.localeCompare(b.startDate))
                    .map(b => (
                      <tr key={b.id}>
                        <td><span className="badge">{BLOCK_TYPE_LABELS[b.type] || b.type}</span></td>
                        <td>
                          {b.startDate === b.endDate
                            ? b.startDate
                            : `${b.startDate} a ${b.endDate}`}
                        </td>
                        <td>
                          {b.startTime && b.endTime
                            ? `${b.startTime}–${b.endTime}`
                            : "Dia inteiro"}
                        </td>
                        <td>{b.reason || "—"}</td>
                        <td>
                          {canEdit && <button
                            type="button"
                            className="btn-link btn-link--danger"
                            onClick={() => handleDeleteBlock(b.id)}
                          >
                            Remover
                          </button>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
