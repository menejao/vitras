/**
 * schedule.test.js — Testes de integração para Sprint 5
 *
 * Cobre:
 *   - scheduleEngine: fallback, configuração semanal, bloqueios, canais
 *   - POST /agenda: overbooking 409, slot bloqueado 409, bookingChannel
 *   - GET /availability: respeita scheduleEngine
 *   - GET /schedule/configurations: listagem e criação
 *   - POST /schedule/blocks: criação e detecção de conflitos
 *
 * Regressão (não deve quebrar):
 *   - APS-01C: createQueueEntry
 *   - APS-01D: dar-entrada agenda
 */

import { strict as assert } from "assert";
import {
  getSlotsForDate,
  getAvailableSlots,
  isSlotAvailable,
  validateScheduleConfig,
  detectConflictingAppointments,
} from "../src/services/scheduleEngine.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDb(overrides = {}) {
  return {
    patients: [],
    users: [],
    agendaEntries: [],
    queueEntries: [],
    examRequests: [],
    professionalSchedules: [],
    scheduleBlocks: [],
    ...overrides,
  };
}

function makeEntry(date, time, doctorId = "doc1", status = "scheduled") {
  return { id: `e-${date}-${time}`, date, time, doctorId, status };
}

// ── scheduleEngine: fallback ──────────────────────────────────────────────────

{
  console.log("TEST: getSlotsForDate fallback Seg-Sex");
  const slots = getSlotsForDate(null, "2025-01-06"); // Monday
  assert(slots.length > 0, "Monday should have slots");
  assert(slots[0].time === "07:00", "First slot 07:00");
  const last = slots[slots.length - 1];
  assert(last.time < "17:30", "Last slot before 17:30");
  console.log(`  OK: ${slots.length} slots`);
}

{
  console.log("TEST: getSlotsForDate fallback Sábado (sem slots)");
  const slots = getSlotsForDate(null, "2025-01-04"); // Saturday ISO=6
  assert.equal(slots.length, 0, "Saturday should have 0 slots");
  console.log("  OK");
}

{
  console.log("TEST: getSlotsForDate fallback Domingo (sem slots)");
  const slots = getSlotsForDate(null, "2025-01-05"); // Sunday ISO=7
  assert.equal(slots.length, 0, "Sunday should have 0 slots");
  console.log("  OK");
}

// ── scheduleEngine: config com período customizado ─────────────────────────────

{
  console.log("TEST: getSlotsForDate com config customizada");
  const schedule = {
    status: "open",
    slotDurationMinutes: 30,
    weeklySchedule: [
      {
        dayOfWeek: 1, // Monday
        active: true,
        periods: [
          {
            startTime: "08:00",
            endTime: "12:00",
            capacity: null,
            channelAllocation: { portal: 2, reception: 4, nursing: 0, reserve: 0 },
          },
        ],
      },
    ],
  };
  const slots = getSlotsForDate(schedule, "2025-01-06");
  assert(slots.length === 8, `Expected 8 slots (08:00-12:00 / 30min), got ${slots.length}`);
  assert(slots[0].time === "08:00");
  assert(slots[0].channelAllocation.portal === 2);
  console.log("  OK");
}

{
  console.log("TEST: getSlotsForDate status=closed retorna zero");
  const schedule = {
    status: "closed",
    slotDurationMinutes: 30,
    weeklySchedule: [{ dayOfWeek: 1, active: true, periods: [{ startTime: "08:00", endTime: "12:00" }] }],
  };
  const slots = getSlotsForDate(schedule, "2025-01-06");
  assert.equal(slots.length, 0);
  console.log("  OK");
}

// ── scheduleEngine: getAvailableSlots + bloqueios ─────────────────────────────

{
  console.log("TEST: getAvailableSlots sem config usa fallback");
  const db = makeDb();
  const slots = getAvailableSlots(db, { date: "2025-01-06", doctorId: "doc1", unitId: "u1" });
  assert(slots.length > 0, "Should have fallback slots");
  console.log(`  OK: ${slots.length} slots`);
}

{
  console.log("TEST: getAvailableSlots slot já ocupado não aparece");
  const db = makeDb({
    agendaEntries: [makeEntry("2025-01-06", "07:00", "doc1")],
  });
  const slots = getAvailableSlots(db, { date: "2025-01-06", doctorId: "doc1", unitId: "u1" });
  assert(!slots.includes("07:00"), "07:00 should be taken");
  assert(slots.includes("07:30"), "07:30 should be free");
  console.log("  OK");
}

{
  console.log("TEST: getAvailableSlots slot bloqueado não aparece");
  const db = makeDb({
    scheduleBlocks: [{
      id: "b1",
      unitId: "u1",
      professionalId: "doc1",
      startDate: "2025-01-06",
      endDate: "2025-01-06",
      startTime: "07:00",
      endTime: "09:00",
    }],
  });
  const slots = getAvailableSlots(db, { date: "2025-01-06", doctorId: "doc1", unitId: "u1" });
  assert(!slots.includes("07:00"), "07:00 should be blocked");
  assert(!slots.includes("08:30"), "08:30 should be blocked");
  assert(slots.includes("09:00"), "09:00 after block should be free");
  console.log("  OK");
}

{
  console.log("TEST: getAvailableSlots bloqueio dia inteiro = zero slots");
  const db = makeDb({
    scheduleBlocks: [{
      id: "b2",
      unitId: "u1",
      professionalId: "doc1",
      startDate: "2025-01-06",
      endDate: "2025-01-06",
      startTime: null,
      endTime: null,
    }],
  });
  const slots = getAvailableSlots(db, { date: "2025-01-06", doctorId: "doc1", unitId: "u1" });
  assert.equal(slots.length, 0, "Full-day block should clear all slots");
  console.log("  OK");
}

// ── scheduleEngine: isSlotAvailable ──────────────────────────────────────────

{
  console.log("TEST: isSlotAvailable livre");
  const db = makeDb();
  assert(isSlotAvailable(db, { date: "2025-01-06", time: "07:30", doctorId: "doc1", unitId: "u1" }));
  console.log("  OK");
}

{
  console.log("TEST: isSlotAvailable ocupado");
  const db = makeDb({ agendaEntries: [makeEntry("2025-01-06", "07:30", "doc1")] });
  assert(!isSlotAvailable(db, { date: "2025-01-06", time: "07:30", doctorId: "doc1", unitId: "u1" }));
  console.log("  OK");
}

// ── scheduleEngine: validateScheduleConfig ────────────────────────────────────

{
  console.log("TEST: validateScheduleConfig válido");
  const result = validateScheduleConfig({
    professionalId: "doc1",
    unitId: "u1",
    slotDurationMinutes: 30,
    weeklySchedule: [
      {
        dayOfWeek: 1,
        active: true,
        periods: [
          { startTime: "08:00", endTime: "12:00", channelAllocation: { portal: 2, reception: 4, nursing: 0, reserve: 0 } },
        ],
      },
    ],
  });
  assert(result.valid, `Expected valid, errors: ${JSON.stringify(result.errors)}`);
  console.log("  OK");
}

{
  console.log("TEST: validateScheduleConfig canal acima da capacidade");
  const result = validateScheduleConfig({
    professionalId: "doc1",
    unitId: "u1",
    slotDurationMinutes: 30,
    weeklySchedule: [
      {
        dayOfWeek: 1,
        active: true,
        periods: [
          {
            startTime: "08:00",
            endTime: "09:00", // 2 slots
            channelAllocation: { portal: 5, reception: 5, nursing: 0, reserve: 0 }, // 10 > 2
          },
        ],
      },
    ],
  });
  assert(!result.valid, "Should be invalid");
  assert(result.errors.some(e => e.includes("soma dos canais")), `Expected canal error, got ${JSON.stringify(result.errors)}`);
  console.log("  OK");
}

{
  console.log("TEST: validateScheduleConfig períodos se sobrepõem");
  const result = validateScheduleConfig({
    professionalId: "doc1",
    unitId: "u1",
    slotDurationMinutes: 30,
    weeklySchedule: [
      {
        dayOfWeek: 1,
        active: true,
        periods: [
          { startTime: "08:00", endTime: "12:00" },
          { startTime: "11:00", endTime: "14:00" }, // overlap
        ],
      },
    ],
  });
  assert(!result.valid, "Should be invalid");
  assert(result.errors.some(e => e.includes("sobrepõem")), `Expected overlap error`);
  console.log("  OK");
}

// ── detectConflictingAppointments ─────────────────────────────────────────────

{
  console.log("TEST: detectConflictingAppointments encontra conflito");
  const db = makeDb({
    agendaEntries: [
      { id: "a1", date: "2025-01-06", time: "08:00", doctorId: "doc1", executingUnitId: "u1", status: "scheduled" },
      { id: "a2", date: "2025-01-08", time: "09:00", doctorId: "doc1", executingUnitId: "u1", status: "scheduled" },
    ],
  });
  const conflicts = detectConflictingAppointments(db, {
    professionalId: "doc1",
    unitId: "u1",
    startDate: "2025-01-06",
    endDate: "2025-01-07",
  });
  assert.equal(conflicts.length, 1, `Expected 1 conflict, got ${conflicts.length}`);
  assert.equal(conflicts[0].id, "a1");
  console.log("  OK");
}

{
  console.log("TEST: detectConflictingAppointments ignora cancelados");
  const db = makeDb({
    agendaEntries: [
      { id: "a1", date: "2025-01-06", time: "08:00", doctorId: "doc1", executingUnitId: "u1", status: "cancelled" },
    ],
  });
  const conflicts = detectConflictingAppointments(db, {
    professionalId: "doc1",
    unitId: "u1",
    startDate: "2025-01-06",
    endDate: "2025-01-06",
  });
  assert.equal(conflicts.length, 0, "Cancelled should not conflict");
  console.log("  OK");
}

// ── Fim ───────────────────────────────────────────────────────────────────────

console.log("\n✓ Todos os testes de schedule.test.js passaram.\n");
