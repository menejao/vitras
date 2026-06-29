// AI Tools Layer — pure data access functions over db
// Each tool returns a structured result with count, items, source, criteria, period, limitations.
// No direct DB reads — callers pass db; no side effects.

function toDateSafe(v) {
  const d = new Date(v || "");
  return Number.isNaN(d.getTime()) ? null : d;
}

function thisMonthKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeyFromDate(v) {
  const d = toDateSafe(v);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── patient tools ─────────────────────────────────────────────────────────────

export function toolCountPatients(db) {
  const active = (db.patients || []).filter((p) => !p.inactive);
  return {
    count: active.length,
    source: "patients",
    criteria: "pacientes ativos (não inativos)",
    period: "cadastro atual",
  };
}

export function toolCountByCategory(db, category) {
  const LABELS = {
    pregnant: "gestante",
    puerperal: "puerpério",
    elderly: "pessoa idosa",
    chronic: "DCNT/crônico",
    general: "geral",
  };
  const active = (db.patients || []).filter((p) => !p.inactive && p.careCategory === category);
  return {
    count: active.length,
    items: active.map((p) => ({ id: p.id, name: p.name, microArea: p.microArea })),
    source: "patients",
    criteria: `categoria de acompanhamento = ${LABELS[category] || category}`,
    period: "cadastro atual",
  };
}

export function toolCountHypertensive(db) {
  const active = (db.patients || []).filter(
    (p) => !p.inactive && /hiperten/i.test(p.comorbidities || "")
  );
  return {
    count: active.length,
    items: active.map((p) => ({ id: p.id, name: p.name })),
    source: "patients",
    criteria: "campo comorbidades contém 'hipertensão'",
    period: "cadastro atual",
    limitations: "baseado em texto livre de comorbidades, não em diagnóstico codificado (CID-10)",
  };
}

export function toolCountDiabetic(db) {
  const active = (db.patients || []).filter(
    (p) => !p.inactive && /diabet/i.test(p.comorbidities || "")
  );
  return {
    count: active.length,
    items: active.map((p) => ({ id: p.id, name: p.name })),
    source: "patients",
    criteria: "campo comorbidades contém 'diabetes'",
    period: "cadastro atual",
    limitations: "baseado em texto livre de comorbidades, não em diagnóstico codificado (CID-10)",
  };
}

export function toolGetIncompletePatients(db) {
  const patients = (db.patients || []).filter((p) => !p.inactive);
  const incomplete = patients.map((p) => {
    const missing = [];
    if (!String(p.phone || "").trim()) missing.push("telefone");
    if (!String(p.address || p.street || "").trim()) missing.push("endereço");
    if (!p.cns && !p.cpf && !p.document) missing.push("CNS/CPF");
    if (!p.assignedAcsId) missing.push("ACS vinculado");
    return missing.length ? { id: p.id, name: p.name, missing } : null;
  }).filter(Boolean);

  return {
    count: incomplete.length,
    total: patients.length,
    items: incomplete.slice(0, 20),
    source: "patients",
    criteria: "cadastros com telefone, endereço, CNS/CPF ou ACS ausente",
    period: "cadastro atual",
  };
}

export function toolSearchPatient(db, query) {
  const q = String(query || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const patients = (db.patients || []).filter((p) => !p.inactive);
  const results = patients
    .filter((p) => {
      const name = String(p.name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      const cpf = String(p.cpf || "").replace(/\D/g, "");
      const cns = String(p.cns || "");
      return name.includes(q) || cpf.includes(q) || cns.includes(q);
    })
    .slice(0, 10);
  return {
    count: results.length,
    items: results.map((p) => ({
      id: p.id,
      name: p.name,
      careCategory: p.careCategory,
      microArea: p.microArea,
    })),
    source: "patients",
    criteria: `busca por nome, CPF ou CNS contendo "${query}"`,
    period: "cadastro atual",
  };
}

// ── family tools ──────────────────────────────────────────────────────────────

export function toolCountFamilies(db) {
  const total = (db.familyGroups || []).length;
  return {
    count: total,
    source: "familyGroups",
    criteria: "todos os grupos familiares cadastrados",
    period: "cadastro atual",
  };
}

// ── visit tools ───────────────────────────────────────────────────────────────

export function toolCountVisits(db, filters = {}) {
  const visits = db.acsVisits || [];
  const monthKey = filters.month || thisMonthKey();

  const filtered = visits.filter((v) => {
    const k = monthKeyFromDate(v.dataVisita || v.date || v.createdAt);
    return k === monthKey;
  });

  return {
    count: filtered.length,
    total: visits.length,
    source: "acsVisits",
    criteria: "visitas domiciliares ACS",
    period: `mês ${monthKey}`,
    monthKey,
  };
}

export function toolCountVisitsTotal(db) {
  return {
    count: (db.acsVisits || []).length,
    source: "acsVisits",
    criteria: "total de visitas domiciliares ACS registradas",
    period: "todo o período",
  };
}

export function toolGetPatientsWithoutVisit(db, days = 30) {
  const patients = (db.patients || []).filter((p) => !p.inactive);
  const visits = db.acsVisits || [];

  const lastVisitMap = {};
  for (const v of visits) {
    const pid = v.patientId || v.patient_id;
    if (!pid) continue;
    const d = toDateSafe(v.dataVisita || v.date || v.createdAt);
    if (!d) continue;
    if (!lastVisitMap[pid] || d > lastVisitMap[pid]) lastVisitMap[pid] = d;
  }

  const threshold = new Date(Date.now() - days * 86400000);
  const result = patients.filter((p) => {
    const last = lastVisitMap[p.id];
    return !last || last < threshold;
  });

  return {
    count: result.length,
    items: result.slice(0, 20).map((p) => ({
      id: p.id,
      name: p.name,
      lastVisit: lastVisitMap[p.id]
        ? lastVisitMap[p.id].toLocaleDateString("pt-BR")
        : "nunca",
    })),
    source: "patients + acsVisits",
    criteria: `pacientes ativos sem visita domiciliar ACS há mais de ${days} dias`,
    period: `últimos ${days} dias`,
    days,
  };
}

// ── task tools ────────────────────────────────────────────────────────────────

export function toolCountOpenTasks(db) {
  const tasks = (db.tasks || []).filter(
    (t) => t.status !== "done" && t.status !== "completed" && t.status !== "cancelled"
  );
  const now = new Date();
  const overdue = tasks.filter((t) => {
    const d = toDateSafe(t.dueDate);
    return d && d < now;
  });
  return {
    count: tasks.length,
    overdueCount: overdue.length,
    source: "tasks",
    criteria: "tarefas com status aberto (diferente de done/completed/cancelled)",
    period: "cadastro atual",
  };
}

// ── export history tools ──────────────────────────────────────────────────────

export function toolGetExportHistory(db, limit = 5) {
  const history = [...(db.exportHistory || [])].reverse().slice(0, limit);
  return {
    count: (db.exportHistory || []).length,
    recent: history.map((h) => ({
      competencia: h.competencia,
      date: h.ts,
      patientsExported: h.patientsExported,
      patientsSkipped: h.patientsSkipped,
      status: h.status,
      exportedBy: h.exportedBy?.name,
    })),
    source: "exportHistory",
    criteria: `últimos ${limit} registros de exportação e-SUS APS`,
    period: "histórico completo",
  };
}

export function toolGetLastExport(db) {
  const history = [...(db.exportHistory || [])].reverse();
  const last = history[0] || null;
  return {
    count: (db.exportHistory || []).length,
    last: last
      ? {
          competencia: last.competencia,
          date: last.ts,
          patientsExported: last.patientsExported,
          patientsSkipped: last.patientsSkipped,
          status: last.status,
          exportedBy: last.exportedBy?.name,
        }
      : null,
    source: "exportHistory",
    criteria: "exportação e-SUS APS mais recente",
    period: last?.ts ? new Date(last.ts).toLocaleDateString("pt-BR") : "nenhuma encontrada",
  };
}
