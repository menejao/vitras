/**
 * availabilityService.js — Wrapper de compatibilidade.
 * Delega para scheduleEngine.js (motor centralizado).
 * Mantido para evitar breaking change nos importadores existentes.
 */
export {
  getAvailableSlots,
  isSlotAvailable,
} from "./scheduleEngine.js";
