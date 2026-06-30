/**
 * authService.js — Autenticação do cidadão no Portal VITRAS
 * Todos os calls de API ficam aqui — nenhuma página chama fetch diretamente.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body:    JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

/** Verifica se CPF existe no VITRAS e se já tem conta no Portal */
export async function checkCpf(cpf) {
  return apiPost("/citizen-portal/auth/first-access/check-cpf", { cpf });
}

/** Verifica identidade do cidadão contra o cadastro da UBS */
export async function verifyIdentity({ cpf, birthDate, name, motherName, phone }) {
  return apiPost("/citizen-portal/auth/first-access/verify", { cpf, birthDate, name, motherName, phone });
}

/** Cria conta no Portal vinculada ao paciente */
export async function createAccount({ verifyToken, senha, confirmSenha, aceitaTermos, aceitaPrivacidade }) {
  return apiPost("/citizen-portal/auth/first-access/create", { verifyToken, senha, confirmSenha, aceitaTermos, aceitaPrivacidade });
}

/** Login com CPF + senha */
export async function login(cpf, senha) {
  return apiPost("/citizen-portal/auth/login", { cpf, senha });
}

/** Logout — invalida sessão no backend */
export async function logout(token) {
  try {
    await fetch(`${API_BASE}/citizen-portal/auth/logout`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch { /* silent — session removed locally regardless */ }
}

/** Retorna dados do cidadão autenticado */
export async function fetchMe(token) {
  return apiGet("/citizen-portal/me", token);
}
