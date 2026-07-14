/**
 * scheduleEngine.js — Motor central de disponibilidade de agenda do VITRAS.
 *
 * Substitui availabilityService.js (hardcoded 07:00-17:30, Seg-Sex, 30min).
 * Toda disponibilidade deriva de regras persistidas (professionalSchedules).
 * Fallback: Seg-Sex, 07:00-17:30, slots de 30min (comportamento anterior preservado).
 *
 * Princípios:
 *   - Determinístico: mesma config + agendamentos = mesma disponibilidade
 *   - scheduleBlocks prevalecem sobre recorrência semanal
 *   - Nunca cancela agendamentos existentes automaticamente
 *   - Suporte a múltiplos turnos por dia
 *   - Distribuição de vagas por canal (portal/reception/nursing/reserve)
 */

// ── Defaults (fallback quando não há config cadastrada) ──────────────────────
const DEFAULT_SLOT_DURATION_MIN = 30;
const DEFAULT_ISO_WEEKDAYS = new Set([1, 2, 3, 4, 5]); // 1=Seg, 5=Sex
const DEFAULT_PERIOD_START = "07:00";
const DEFAULT_PERIOD_END = "17:30";

// ── Helpers de tempo ─────────────────────────────────────────────────────────

function timeToMinutes(timeStr) {
  const [h, m] = String(timeStr || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** ISO weekday: 1=Seg, 2=Ter, ..., 6=Sáb, 7=Dom */
function getISOWeekday(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay(); // 0=Dom, 1=Seg, ..., 6=Sáb
  return dow === 0 ? 7 : dow;
}

function generatePeriodSlots(startTime, endTime, slotMinutes) {
  const slots = [];
  let current = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  while (current + slotMinutes <= end) {
    slots.push(minutesToTime(current));
    current += slotMinutes;
  }
  return slots;
}

// ── Resolução de configuração ─────────────────────────────────────────────────

/**
 * Resolve a configuração de escala de um profissional em uma UBS.
 * Retorna o objeto de configuração ou null (usar default).
 */
export function resolveSchedule(db, { unitId, professionalId }) {
  const configs = db.professionalSchedules || [];
  return configs.find(c =>
    String(c.unitId || "") === String(unitId || "") &&
    String(c.professionalId || "") === String(professionalId || "")
  ) || null;
}

// ── Slots para uma data ───────────────────────────────────────────────────────

/**
 * Gera todos os slots potenciais para uma data, com base na config (ou default).
 * Retorna array de:
 *   { time, periodStart, periodEnd, periodCapacity, channelAllocation }
 */
export function getSlotsForDate(schedule, dateStr) {
  const isoDay = getISOWeekday(dateStr);

  if (!schedule) {
    // Fallback: Seg-Sex, 07:00-17:30, 30min, sem alocação de canal
    if (!DEFAULT_ISO_WEEKDAYS.has(isoDay)) return [];
    return generatePeriodSlots(DEFAULT_PERIOD_START, DEFAULT_PERIOD_END, DEFAULT_SLOT_DURATION_MIN)
      .map(time => ({
        time,
        periodStart: DEFAULT_PERIOD_START,
        periodEnd: DEFAULT_PERIOD_END,
        periodCapacity: null,
        channelAllocation: { portal: 0, reception: 0, nursing: 0, reserve: 0 },
      }));
  }

  if (schedule.status === "closed") return [];

  const dayConfig = (schedule.weeklySchedule || []).find(d => d.dayOfWeek === isoDay);
  if (!dayConfig || !dayConfig.active) return [];

  const slotMin = schedule.slotDurationMinutes || DEFAULT_SLOT_DURATION_MIN;
  const result = [];

  for (const period of (dayConfig.periods || [])) {
    const times = generatePeriodSlots(period.startTime, period.endTime, slotMin);
    const alloc = period.channelAllocation || { portal: 0, reception: 0, nursing: 0, reserve: 0 };
    const periodCap = typeof period.capacity === "number" ? period.capacity : times.length;
    for (const time of times) {
      result.push({
        time,
        periodStart: period.startTime,
        periodEnd: period.endTime,
        periodCapacity: periodCap,
        channelAllocation: alloc,
      });
    }
  }

  return result;
}

// ── Bloqueios ─────────────────────────────────────────────────────────────────

/**
 * Retorna bloqueios ativos para uma data/profissional/UBS.
 */
export function getActiveBlocks(db, { date, professionalId, unitId }) {
  return (db.scheduleBlocks || []).filter(b => {
    if (String(b.unitId || "") !== String(unitId || "")) return false;
    if (b.professionalId && String(b.professionalId) !== String(professionalId || "")) return false;
    if (date < b.startDate || date > b.endDate) return false;
    return true;
  });
}

function isTimeInBlock(timeStr, block) {
  // Bloqueio de dia inteiro
  if (!block.startTime && !block.endTime) return true;
  const t = timeToMinutes(timeStr);
  const bs = block.startTime ? timeToMinutes(block.startTime) : 0;
  const be = block.endTime ? timeToMinutes(block.endTime) : 24 * 60;
  return t >= bs && t < be;
}

// ── Contagem de agendamentos ──────────────────────────────────────────────────

/**
 * Conta agendamentos não-cancelados em um slot específico.
 */
export function countBookingsAtSlot(db, { date, time, doctorId }) {
  return (db.agendaEntries || []).filter(e =>
    String(e.date || "") === date &&
    String(e.time || "") === time &&
    e.status !== "cancelled" &&
    (!doctorId || String(e.doctorId || "") === String(doctorId || ""))
  ).length;
}

/**
 * Conta agendamentos de um canal específico em um período de um dia.
 * Entradas sem bookingChannel são tratadas como "reception" (conservador).
 */
export function countChannelBookingsInPeriod(db, { date, periodStart, periodEnd, doctorId, channel }) {
  const ps = timeToMinutes(periodStart);
  const pe = timeToMinutes(periodEnd);
  return (db.agendaEntries || []).filter(e => {
    if (String(e.date || "") !== date) return false;
    if (e.status === "cancelled") return false;
    if (doctorId && String(e.doctorId || "") !== String(doctorId || "")) return false;
    const et = timeToMinutes(e.time || "00:00");
    if (et < ps || et >= pe) return false;
    const entryChannel = e.bookingChannel || "reception";
    return entryChannel === channel;
  }).length;
}

// ── API principal ─────────────────────────────────────────────────────────────

/**
 * Retorna os horários disponíveis para uma data/profissional.
 * Backward-compatible com availabilityService.getAvailableSlots.
 *
 * @param db - banco de dados
 * @param options - { date, specialtyKey?, doctorId?, unitId?, channel? }
 * @returns string[] - horários disponíveis (ex: ["07:00", "07:30", ...])
 */
export function getAvailableSlots(db, { date, specialtyKey, doctorId, unitId, channel }) {
  if (!date) return [];

  const schedule = (unitId || doctorId)
    ? resolveSchedule(db, { unitId: unitId || "", professionalId: doctorId || "" })
    : null;

  const potentialSlots = getSlotsForDate(schedule, date);
  if (!potentialSlots.length) return [];

  const blocks = (unitId || doctorId)
    ? getActiveBlocks(db, { date, professionalId: doctorId || "", unitId: unitId || "" })
    : [];

  const available = [];

  for (const slot of potentialSlots) {
    // Verificar bloqueio
    if (blocks.some(b => isTimeInBlock(slot.time, b))) continue;

    // Verificar capacidade: 1 agendamento por slot (slot = 1 paciente)
    const booked = countBookingsAtSlot(db, { date, time: slot.time, doctorId });
    if (booked >= 1) continue; // capacidade por slot sempre 1

    // Verificar alocação de canal (se canal especificado)
    if (channel && channel !== "any") {
      const alloc = slot.channelAllocation || {};
      const totalAllocated = Object.values(alloc).reduce((a, b) => a + b, 0);

      if (totalAllocated > 0) {
        const channelCap = alloc[channel] || 0;
        if (channelCap === 0) continue; // canal sem alocação neste período

        const channelBooked = countChannelBookingsInPeriod(db, {
          date,
          periodStart: slot.periodStart,
          periodEnd: slot.periodEnd,
          doctorId,
          channel,
        });
        if (channelBooked >= channelCap) continue;
      }
      // Se totalAllocated === 0: sem alocação configurada, qualquer canal pode usar
    }

    available.push(slot.time);
  }

  return available;
}

/**
 * Verifica se um slot específico está disponível.
 * Usado no POST /agenda para validação de overbooking.
 */
export function isSlotAvailable(db, { date, time, doctorId, unitId, channel }) {
  const slots = getAvailableSlots(db, { date, doctorId, unitId, channel });
  return slots.includes(time);
}

/**
 * Retorna informações detalhadas de capacidade de um slot.
 * Usado na resposta de erro 409.
 */
export function getSlotCapacityInfo(db, { date, time, doctorId, unitId }) {
  const schedule = resolveSchedule(db, { unitId: unitId || "", professionalId: doctorId || "" });
  const potentialSlots = getSlotsForDate(schedule, date);
  const slot = potentialSlots.find(s => s.time === time);
  if (!slot) return null;

  const booked = countBookingsAtSlot(db, { date, time, doctorId });
  const blocks = getActiveBlocks(db, { date, professionalId: doctorId || "", unitId: unitId || "" });
  const blocked = blocks.some(b => isTimeInBlock(time, b));

  return {
    time,
    booked,
    capacity: 1,
    available: !blocked && booked < 1,
    blocked,
    channelAllocation: slot.channelAllocation,
  };
}

/**
 * Detecta agendamentos existentes que seriam afetados por um bloqueio.
 * Retorna a lista de agendamentos conflitantes (nunca cancela automaticamente).
 */
export function detectConflictingAppointments(db, { professionalId, unitId, startDate, endDate, startTime, endTime }) {
  return (db.agendaEntries || []).filter(e => {
    if (e.status === "cancelled") return false;
    if (unitId && String(e.executingUnitId || "") !== String(unitId || "")) return false;
    if (professionalId && String(e.doctorId || "") !== String(professionalId || "")) return false;
    if (e.date < startDate || e.date > endDate) return false;
    if (startTime && endTime) {
      const et = timeToMinutes(e.time || "00:00");
      const bs = timeToMinutes(startTime);
      const be = timeToMinutes(endTime);
      if (et < bs || et >= be) return false;
    }
    return true;
  }).map(e => ({
    id: e.id,
    date: e.date,
    time: e.time,
    patientId: e.patientId,
    doctorId: e.doctorId,
    status: e.status,
  }));
}

/**
 * Valida uma configuração de escala antes de salvar.
 * Retorna { valid, errors[] }.
 */
export function validateScheduleConfig(config) {
  const errors = [];

  if (!config.professionalId) errors.push("professionalId obrigatório");
  if (!config.unitId) errors.push("unitId obrigatório");

  const slotMin = config.slotDurationMinutes || DEFAULT_SLOT_DURATION_MIN;
  if (slotMin < 5 || slotMin > 120) errors.push("slotDurationMinutes deve ser entre 5 e 120");

  for (const day of (config.weeklySchedule || [])) {
    if (!day.active) continue;
    const periods = day.periods || [];

    // Verificar sobreposição de períodos
    const sortedPeriods = [...periods].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    for (let i = 1; i < sortedPeriods.length; i++) {
      const prev = sortedPeriods[i - 1];
      const curr = sortedPeriods[i];
      if (timeToMinutes(curr.startTime) < timeToMinutes(prev.endTime)) {
        errors.push(`Dia ${day.dayOfWeek}: períodos se sobrepõem (${prev.startTime}–${prev.endTime} e ${curr.startTime}–${curr.endTime})`);
      }
    }

    for (const period of periods) {
      const start = timeToMinutes(period.startTime);
      const end = timeToMinutes(period.endTime);
      if (start >= end) {
        errors.push(`Dia ${day.dayOfWeek}: horário inválido (${period.startTime}–${period.endTime})`);
        continue;
      }
      if (end - start < slotMin) {
        errors.push(`Dia ${day.dayOfWeek}: período ${period.startTime}–${period.endTime} menor que a duração do slot (${slotMin}min)`);
      }

      // Validar alocação de canais
      const alloc = period.channelAllocation || {};
      const totalAlloc = Object.values(alloc).reduce((a, b) => (a || 0) + (b || 0), 0);
      const slotsInPeriod = generatePeriodSlots(period.startTime, period.endTime, slotMin).length;
      if (totalAlloc > slotsInPeriod) {
        errors.push(`Dia ${day.dayOfWeek}: soma dos canais (${totalAlloc}) excede a capacidade do período (${slotsInPeriod} slots)`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
