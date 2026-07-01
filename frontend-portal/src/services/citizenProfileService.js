/**
 * citizenProfileService.js — Dados do perfil do cidadão
 *
 * Acessa GET /citizen-portal/profile e PUT /citizen-portal/profile/password|preferences.
 * A UI nunca acessa APIs diretamente — usa este service.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function getToken() {
  try { return JSON.parse(sessionStorage.getItem("portal_cidadao") || "null")?.token || null; }
  catch { return null; }
}

async function apiCall(method, path, body) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

/** Carrega perfil completo do cidadão */
export async function getPerfil() {
  return apiCall("GET", "/citizen-portal/profile");
}

/** Altera senha — exige senhaAtual + novaSenha + confirmSenha */
export async function alterarSenha(senhaAtual, novaSenha, confirmSenha) {
  return apiCall("PUT", "/citizen-portal/profile/password", { senhaAtual, novaSenha, confirmSenha });
}

/** Carrega preferências de comunicação */
export async function getPreferencias() {
  return apiCall("GET", "/citizen-portal/profile/preferences");
}

/** Salva preferências de comunicação */
export async function salvarPreferencias(preferencias) {
  return apiCall("PUT", "/citizen-portal/profile/preferences", { preferencias });
}

/** Formata CPF mascarado para exibição */
export function formatarCpfMascarado(cpf) {
  return cpf || "***.***.***-**";
}

/** Formata data YYYY-MM-DD para exibição */
export function formatarDataNasc(iso) {
  if (!iso) return null;
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return iso; }
}

/** Iniciais do nome */
export function getInitials(nome) {
  if (!nome) return "?";
  return nome.trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");
}
