export const API_URL = import.meta.env.VITE_API_URL || "https://api.vitras.com.br";
const COOKIE_SESSION_SENTINEL = "__cookie_session__";
const SESSION_KEY = "vitras_react_session";
// 429 excluded: retrying rate-limited requests amplifies the storm
const RETRYABLE_STATUSES = new Set([408, 425, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status, customStatuses) {
  if (Array.isArray(customStatuses) && customStatuses.length > 0) {
    return customStatuses.includes(status);
  }
  return RETRYABLE_STATUSES.has(status);
}

function getCsrfToken() {
  if (typeof document !== "undefined") {
    const pair = document.cookie.split("; ").find((item) => item.startsWith("vitras_csrf="));
    if (pair) return decodeURIComponent(pair.split("=").slice(1).join("="));
  }
  if (typeof sessionStorage === "undefined") return "";
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return String(parsed?.csrfToken || "").trim();
  } catch {
    return "";
  }
}

export async function api(path, options = {}, token = "") {
  const {
    retryCount = 0,
    retryDelayMs = 350,
    retryStatuses,
    ...fetchOptions
  } = options || {};

  const headers = { ...(fetchOptions.headers || {}) };
  const isFormData = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
  const method = String(fetchOptions.method || "GET").toUpperCase();
  if (!isFormData && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }
  const csrfToken = getCsrfToken();
  if (csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  if (token && token !== COOKIE_SESSION_SENTINEL) headers.Authorization = `Bearer ${token}`;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    let response;

    try {
      response = await fetch(`${API_URL}${path}`, {
        ...fetchOptions,
        headers,
        credentials: "include"
      });
    } catch (err) {
      const message = String(err?.message || "");
      if (attempt < retryCount) {
        const waitMs = retryDelayMs * (attempt + 1) + Math.floor(Math.random() * 120);
        await sleep(waitMs);
        continue;
      }
      if (message.toLowerCase().includes("failed to fetch")) {
        throw new Error("Falha de conexão com o servidor");
      }
      throw err;
    }

    if (!response.ok) {
      if (attempt < retryCount && shouldRetryStatus(response.status, retryStatuses)) {
        const waitMs = retryDelayMs * (attempt + 1) + Math.floor(Math.random() * 120);
        await sleep(waitMs);
        continue;
      }
      const body = await response.json().catch(() => ({}));
      const err = new Error(body?.error || "Erro na API");
      err.status = response.status;
      throw err;
    }

    return response.json();
  }

  throw new Error("Erro na API");
}

export async function login(email, password) {
  return api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function verifyLogin2fa(challengeId, code) {
  return api("/auth/login/verify", {
    method: "POST",
    body: JSON.stringify({ challengeId, code })
  });
}

export async function register(payload) {
  return api("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function refreshSession(refreshToken) {
  return api("/auth/refresh", {
    method: "POST",
    body: JSON.stringify(refreshToken ? { refreshToken } : {})
  });
}

export async function logoutApi(token, refreshToken) {
  return api("/auth/logout", { method: "POST", body: JSON.stringify(refreshToken ? { refreshToken } : {}) }, token);
}

export async function listPublicTeams() {
  return api("/teams/public", { method: "GET", retryCount: 2 });
}

export async function bootstrap(token) {
  return api("/bootstrap", { method: "GET", retryCount: 2 }, token);
}

export async function listPatients(token) {
  return api("/patients", { method: "GET", retryCount: 2 }, token);
}

export async function listQueueEntries(token) {
  return api("/queue", { method: "GET", retryCount: 2 }, token);
}

export async function createQueueEntry(token, payload) {
  return api("/queue", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function updateQueueEntry(token, id, payload) {
  return api(`/queue/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
}

export async function deleteQueueEntry(token, id) {
  return api(`/queue/${id}`, { method: "DELETE" }, token);
}

export async function clearDoneQueueEntries(token) {
  return api("/queue/clear-done", { method: "POST", body: JSON.stringify({}) }, token);
}

export async function listAgendaEntries(token, params = {}) {
  const query = buildAuditQuery(params);
  return api(`/agenda${query}`, { method: "GET", retryCount: 2 }, token);
}

export async function createAgendaEntry(token, payload) {
  return api("/agenda", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function updateAgendaEntry(token, id, payload) {
  return api(`/agenda/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
}

export async function deleteAgendaEntry(token, id) {
  return api(`/agenda/${id}`, { method: "DELETE" }, token);
}

export async function listReferrals(token) {
  return api("/referrals", { method: "GET", retryCount: 2 }, token);
}

export async function createReferral(token, payload) {
  return api("/referrals", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function updateReferral(token, id, payload) {
  return api(`/referrals/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
}

export async function deleteReferral(token, id) {
  return api(`/referrals/${id}`, { method: "DELETE" }, token);
}

export async function listPharmacyStock(token) {
  return api("/pharmacy/stock", { method: "GET", retryCount: 2 }, token);
}

export async function listPharmacyLogs(token) {
  return api("/pharmacy/logs", { method: "GET", retryCount: 2 }, token);
}

export async function createPharmacyStockItem(token, payload) {
  return api("/pharmacy/stock", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function updatePharmacyStockItem(token, id, payload) {
  return api(`/pharmacy/stock/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
}

export async function adjustPharmacyStockItem(token, id, payload) {
  return api(`/pharmacy/stock/${id}/adjust`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function dispensePharmacyItem(token, payload) {
  return api("/pharmacy/dispense", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function listSuppliesStock(token) {
  return api("/supplies/stock", { method: "GET", retryCount: 2 }, token);
}

export async function listSuppliesLogs(token) {
  return api("/supplies/logs", { method: "GET", retryCount: 2 }, token);
}

export async function listSuppliesContinuous(token) {
  return api("/supplies/continuous", { method: "GET", retryCount: 2 }, token);
}

export async function adjustSuppliesStockItem(token, id, payload) {
  return api(`/supplies/stock/${id}/adjust`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function dispenseSupplies(token, payload) {
  return api("/supplies/dispense", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function closeSuppliesContinuous(token, id, payload) {
  return api(`/supplies/continuous/${id}/close`, { method: "POST", body: JSON.stringify(payload || {}) }, token);
}

export async function listExams(token, patientId) {
  return api(`/patients/${patientId}/exams`, { method: "GET", retryCount: 2 }, token);
}

export async function createExam(token, patientId, payload) {
  return api(`/patients/${patientId}/exams`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function uploadExamAttachment(token, patientId, examId, payload) {
  return api(`/patients/${patientId}/exams/${examId}/attachments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x.valens-exam-attachment+json"
    },
    body: JSON.stringify(payload)
  }, token);
}

export async function deleteExam(token, patientId, examId, justification) {
  return api(`/patients/${patientId}/exams/${examId}`, {
    method: "DELETE",
    headers: {
      "X-Justification": String(justification || "")
    }
  }, token);
}

export async function createPatient(token, payload) {
  return api("/patients", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function updatePatient(token, id, payload) {
  return api(`/patients/${id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
}

export async function deletePatient(token, id) {
  return api(`/patients/${id}`, { method: "DELETE" }, token);
}

export async function listProtocolTemplates(token) {
  return api("/protocol/templates", { method: "GET", retryCount: 2 }, token);
}

export async function createProtocolTemplate(token, payload) {
  return api("/protocol/templates", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function updateProtocolTemplate(token, category, payload) {
  return api(`/protocol/templates/${encodeURIComponent(category)}`, { method: "PUT", body: JSON.stringify(payload) }, token);
}

export async function deleteProtocolTemplate(token, category, payload = {}) {
  return api(`/protocol/templates/${encodeURIComponent(category)}`, {
    method: "DELETE",
    body: JSON.stringify(payload || {})
  }, token);
}

export async function getProtocolSummaries(token, ids) {
  const query = encodeURIComponent(ids.join(","));
  return api(`/patients/protocol-summaries?ids=${query}`, { method: "GET", retryCount: 2 }, token);
}

export async function getPatientProtocolSummary(token, patientId) {
  return api(`/patients/${patientId}/protocol-summary`, { method: "GET", retryCount: 2 }, token);
}

export async function getPatientHistory(token, patientId) {
  return api(`/patients/${patientId}/history`, { method: "GET", retryCount: 2 }, token);
}

export async function listAppointments(token, patientId) {
  return api(`/patients/${patientId}/appointments`, { method: "GET", retryCount: 2 }, token);
}

export async function createAppointment(token, patientId, payload) {
  return api(`/patients/${patientId}/appointments`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function deleteAppointment(token, patientId, appointmentId, payload = {}) {
  return api(`/patients/${patientId}/appointments/${appointmentId}`, {
    method: "DELETE",
    body: JSON.stringify(payload || {})
  }, token);
}

export async function listTasks(token, patientId) {
  return api(`/tasks?patientId=${encodeURIComponent(patientId)}`, { method: "GET", retryCount: 2 }, token);
}

export async function createTask(token, payload) {
  return api("/tasks", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function updateTaskStatus(token, taskId, status) {
  return api(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status }) }, token);
}

export async function listMessages(token, patientId) {
  return api(`/patients/${patientId}/messages`, { method: "GET", retryCount: 2 }, token);
}

export async function sendMessage(token, patientId, text) {
  return api(`/patients/${patientId}/messages`, { method: "POST", body: JSON.stringify({ text }) }, token);
}

export async function createRecord(token, patientId, payload) {
  return api(`/patients/${patientId}/records`, { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function fetchPrescriptions(token) {
  return api("/records/prescriptions", { method: "GET" }, token);
}

export async function deleteRecord(token, patientId, recordId, payload = {}) {
  return api(`/patients/${patientId}/records/${recordId}`, {
    method: "DELETE",
    body: JSON.stringify(payload || {})
  }, token);
}

export async function listUsers(token) {
  return api("/users", { method: "GET", retryCount: 2 }, token);
}

export async function createUser(token, payload) {
  return api("/users", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function updateUser(token, userId, payload) {
  return api(`/users/${userId}`, { method: "PUT", body: JSON.stringify(payload) }, token);
}

export async function updateMe(token, payload) {
  return api("/me", { method: "PATCH", body: JSON.stringify(payload) }, token);
}

export async function verifyCurrentPassword(token, password) {
  return api("/me/verify-password", { method: "POST", body: JSON.stringify({ password }) }, token);
}

export async function getUserUsage(token, userId) {
  return api(`/users/${userId}/usage`, { method: "GET" }, token);
}

export async function deleteUser(token, userId, payload = {}) {
  return api(`/users/${userId}`, {
    method: "DELETE",
    body: JSON.stringify(payload || {})
  }, token);
}

export async function aiTeamPriorities(token) {
  return api("/ai/team/priorities", { method: "POST", body: JSON.stringify({}), retryCount: 1 }, token);
}

export async function aiTeamDataQuality(token) {
  return api("/ai/team/data-quality", { method: "POST", body: JSON.stringify({}), retryCount: 1 }, token);
}

export async function aiTeamReport(token) {
  return api("/ai/team/report", { method: "POST", body: JSON.stringify({}), retryCount: 1 }, token);
}

export async function aiTeamAsk(token, question) {
  return api("/ai/chat", { method: "POST", body: JSON.stringify({ question }), retryCount: 1 }, token);
}

export async function requestAccess(payload) {
  return api("/auth/access-requests", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function listAccessRequests(token) {
  return api("/auth/access-requests", { method: "GET", retryCount: 1 }, token);
}

export async function approveAccessRequest(token, id) {
  return api(`/auth/access-requests/${id}/approve`, { method: "POST", body: JSON.stringify({}) }, token);
}

export async function rejectAccessRequest(token, id) {
  return api(`/auth/access-requests/${id}/reject`, { method: "POST", body: JSON.stringify({}) }, token);
}

export async function getApiHealth() {
  return api("/health", { method: "GET", retryCount: 1, retryDelayMs: 250 });
}

export async function pingPresence(token) {
  try {
    const headers = {};
    if (token && token !== COOKIE_SESSION_SENTINEL) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${API_URL}/me/presence`, {
      method: "POST",
      headers,
      credentials: "include"
    });
    if (!res.ok && res.status !== 404) throw new Error("presence failed");
  } catch {}
}

export async function getAccessContext(token) {
  return api("/me/access-context", { method: "GET" }, token);
}

export async function startImpersonation(token, payload) {
  return api("/me/impersonation/start", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export async function stopImpersonation(token) {
  return api("/me/impersonation/stop", {
    method: "POST",
    body: JSON.stringify({})
  }, token);
}

export async function activateBreakGlass(token, payload) {
  return api("/me/break-glass/activate", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export async function deactivateBreakGlass(token) {
  return api("/me/break-glass/deactivate", {
    method: "POST",
    body: JSON.stringify({})
  }, token);
}

function buildAuditQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    search.set(key, normalized);
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchAuditLogs(token, params = {}) {
  const query = buildAuditQuery(params);
  return api(`/audit-logs${query}`, { method: "GET", retryCount: 1 }, token);
}

export async function exportAuditLogs(token, params = {}) {
  const query = buildAuditQuery(params);
  const headers = {};
  if (token && token !== COOKIE_SESSION_SENTINEL) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}/audit-logs/export${query}`, {
    method: "GET",
    headers,
    credentials: "include"
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Erro ao exportar auditoria");
  }
  const blob = await response.blob();
  return {
    blob,
    filename: `audit-logs-${new Date().toISOString().slice(0, 10)}.${String(params.format || "json").trim().toLowerCase() === "csv" ? "csv" : "json"}`
  };
}

export async function pruneAuditLogs(token, payload) {
  return api("/audit-logs/retention/prune", {
    method: "POST",
    body: JSON.stringify(payload || {})
  }, token);
}
