/**
 * authService.js — Autenticação do cidadão no Portal VITRAS
 * Todos os calls de API ficam aqui — nenhuma página chama fetch diretamente.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function statusMessage(status, serverMsg) {
  if (status === 401) return "CPF ou senha inválidos.";
  if (status === 404) return "Serviço de login não encontrado. Verifique a configuração da API.";
  if (status === 429) return "Muitas tentativas. Aguarde alguns segundos e tente novamente.";
  if (status === 502 || status === 503 || status === 504)
    return "Não foi possível conectar ao servidor. Verifique se o backend está ativo.";
  if (status >= 500)  return "Não foi possível entrar agora. Tente novamente em instantes.";
  return serverMsg || `Erro ${status}`;
}

async function apiPost(path, body) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body:    JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error("Não foi possível conectar ao servidor."), { type: "network" });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(statusMessage(res.status, data.error)), { status: res.status });
  return data;
}

async function apiGet(path, token) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch {
    throw Object.assign(new Error("Não foi possível conectar ao servidor."), { type: "network" });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(statusMessage(res.status, data.error)), { status: res.status });
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
