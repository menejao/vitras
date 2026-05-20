import { parseLocalDate } from "./dates";

export const QUEUE_PRIORITY_LABELS = {
  urgent: "Urgente",
  elderly: "Idoso/PCD",
  pregnant: "Gestante",
  child: "Criança",
  normal: "Normal"
};

export const QUEUE_PRIORITY_ORDER = {
  urgent: 0,
  elderly: 1,
  pregnant: 2,
  child: 3,
  normal: 4
};

export function inferQueuePriorityFromPatient(patient) {
  const careCategory = String(patient?.careCategory || "").toLowerCase();
  if (careCategory === "pregnant") return "pregnant";
  const birthDate = patient?.birthDate ? parseLocalDate(patient.birthDate) : null;
  if (!birthDate) return "normal";
  const age = Math.floor((Date.now() - birthDate.getTime()) / 31557600000);
  if (age >= 60) return "elderly";
  if (age < 12) return "child";
  return "normal";
}

export function formatQueueClock(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatQueueWait(value) {
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
}
