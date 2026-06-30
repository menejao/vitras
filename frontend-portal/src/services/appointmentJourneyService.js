/**
 * appointmentJourneyService.js — Jornada de Agendamento do Portal do Cidadão
 *
 * Este é o ÚNICO service utilizado pela jornada de agendamento.
 * A UI NUNCA conhece regras de agenda, capacidade, horários ou cotas.
 * O Portal apenas consome o que o VITRAS Clínico libera via API.
 *
 * Mock ativo em todos os métodos — pronto para substituição por chamadas reais
 * quando o módulo de Agenda do VITRAS Clínico for integrado.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function getToken() {
  try {
    const s = JSON.parse(sessionStorage.getItem("portal_cidadao") || "null");
    return s?.token || null;
  } catch { return null; }
}

async function apiGet(path, params = {}) {
  const token = getToken();
  const qs    = new URLSearchParams(params).toString();
  const url   = `${API_BASE}${path}${qs ? "?" + qs : ""}`;
  const res   = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

async function apiPost(path, body) {
  const token = getToken();
  const res   = await fetch(`${API_BASE}${path}`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body:    JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

async function apiDelete(path, body = {}) {
  const token = getToken();
  const res   = await fetch(`${API_BASE}${path}`, {
    method:  "DELETE",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body:    JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

/** Lista serviços habilitados para agendamento online */
export async function getServicos() {
  return apiGet("/citizen-portal/appointments/services");
}

/** Lista UBS disponíveis para o serviço escolhido */
export async function getUnidades(serviceId) {
  return apiGet("/citizen-portal/appointments/units", { serviceId });
}

/** Lista profissionais disponíveis para serviço + UBS */
export async function getProfissionais(serviceId, unitId) {
  return apiGet("/citizen-portal/appointments/professionals", { serviceId, unitId });
}

/** Retorna dias com disponibilidade (array de YYYY-MM-DD) */
export async function getDiasDisponiveis(serviceId, unitId, professionalId) {
  return apiGet("/citizen-portal/appointments/availability", { serviceId, unitId, professionalId });
}

/** Retorna horários disponíveis para um dia específico */
export async function getSlots(serviceId, unitId, professionalId, date) {
  return apiGet("/citizen-portal/appointments/slots", { serviceId, unitId, professionalId, date });
}

/** Confirma um agendamento — retorna protocolo */
export async function confirmarAgendamento({ serviceId, serviceName, unitId, professionalId, date, slotId, hora }) {
  return apiPost("/citizen-portal/appointments", { serviceId, serviceName, unitId, professionalId, date, slotId, hora });
}

/** Lista todos os agendamentos do cidadão separados por status */
export async function getMeusAgendamentos() {
  return apiGet("/citizen-portal/my-appointments");
}

/** Cancela um agendamento */
export async function cancelarAgendamento(id, motivo) {
  return apiDelete(`/citizen-portal/my-appointments/${id}`, { motivo });
}

/** Formata data YYYY-MM-DD para exibição */
export function formatarData(iso) {
  if (!iso) return "";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  } catch { return iso; }
}

/** Formata data YYYY-MM-DD para exibição curta */
export function formatarDataCurta(iso) {
  if (!iso) return "";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "numeric", month: "short"
    });
  } catch { return iso; }
}
