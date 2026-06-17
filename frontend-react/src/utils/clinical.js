import { parseLocalDate, parseDateSafe, nextBusinessDay } from "./dates";
import { toBoundedInt } from "./formatting";

export function normalizeSearch(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export function matchesPatientSearch(p, rawQuery) {
  const q = normalizeSearch(rawQuery);
  if (!q) return true;
  const name  = normalizeSearch(p.name);
  const cpf   = (p.cpf || "").replace(/\D/g, "");
  const phone = (p.phone || "").replace(/\D/g, "");
  const qd    = q.replace(/\D/g, "");
  return name.includes(q) || (qd.length >= 3 && cpf.includes(qd)) || (qd.length >= 3 && phone.includes(qd));
}

export function isProfileIncomplete(p) {
  if (!p) return false;
  if (p.incompleteProfile === true) return true;
  if (String(p.id || "").startsWith("local_")) return true;
  return false;
}

export function calcAge(birthDate) {
  if (!birthDate) return null;
  const b = parseLocalDate(birthDate);
  if (!b || isNaN(b)) return null;
  const now = new Date();
  let ay = now.getFullYear() - b.getFullYear();
  let am = now.getMonth() - b.getMonth();
  let ad = now.getDate() - b.getDate();
  if (ad < 0) { am--; ad += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (am < 0) { ay--; am += 12; }
  if (ay < 0) return null;
  const totalDays = Math.floor((now - b) / 86400000);
  if (ay === 0 && am === 0) return `${totalDays}d`;
  if (ay < 2) {
    const parts = [];
    if (ay > 0) parts.push(`${ay}a`);
    if (am > 0) parts.push(`${am}m`);
    if (ad > 0) parts.push(`${ad}d`);
    return parts.join(" ") || "0d";
  }
  return `${ay}a`;
}

export function gestationalAgeInfo(patient) {
  if (!patient) return null;
  const today = new Date();
  const usgRef = parseDateSafe(patient.usgDate1);
  const usgW   = toBoundedInt(patient.gestationalAgeUsgWeeks, 0, 45);
  const usgD   = toBoundedInt(patient.gestationalAgeUsgDays, 0, 6) ?? 0;
  if (usgRef && usgW !== null) {
    const base    = usgW * 7 + usgD;
    const elapsed = Math.max(0, Math.floor((today - usgRef) / 86400000));
    const total   = base + elapsed;
    return { weeks: Math.floor(total / 7), days: total % 7, source: "1ª USG" };
  }
  const dum = parseDateSafe(patient.pregnancyStartDate);
  if (dum) {
    const elapsed = Math.max(0, Math.floor((today - dum) / 86400000));
    return { weeks: Math.floor(elapsed / 7), days: elapsed % 7, source: "DUM" };
  }
  const dumW = toBoundedInt(patient.gestationalAgeDumWeeks, 0, 45);
  const dumD = toBoundedInt(patient.gestationalAgeDumDays, 0, 6) ?? 0;
  if (dumW !== null) return { weeks: dumW, days: dumD, source: "DUM" };
  return null;
}

export function catLabel(templates, category) {
  const normalized = String(category || "").trim().toLowerCase().replace(/\s+/g, "_");
  const fallbackMap = {
    pregnant: "Gestante",
    puerperal: "Puérpera",
    child_followup: "Criança em acompanhamento",
    puericulture: "Criança em acompanhamento",
    elderly: "Idoso",
    general: "Geral",
    chronic: "Condição crônica",
    pap_only: "Geral",
    somente_papanicolau: "Geral"
  };
  const matchedTemplate = (templates || []).find((t) => {
    const templateCategory = String(t?.category || "").trim().toLowerCase().replace(/\s+/g, "_");
    if (normalized === "pap_only" || normalized === "somente_papanicolau") {
      return templateCategory === "general";
    }
    return templateCategory === normalized;
  });
  return matchedTemplate?.label || fallbackMap[normalized] || fallbackMap.general;
}

export function isChildCategory(category) {
  const c = String(category || "").toLowerCase();
  return c === "puericulture" || c === "child_followup";
}

export function emptyPatientForm() {
  return {
    name: "", nomeSocial: "", motherName: "", motherUnknown: false,
    guardianName: "",
    cpf: "", cns: "",
    birthDate: "", birthCity: "", birthState: "",
    sex: "", raceColor: "",
    maritalStatus: "",
    phone: "", phoneAlt: "",
    zipCode: "", address: "", number: "", complement: "", neighborhood: "", city: "", state: "",
    careCategory: "general", chronicConditions: [], assignedAcsId: "",
    microArea: "", familyCode: "", homeVisitFreq: "",
    housingType: "", waterSupply: "", sewage: "", garbage: "", electricity: "",
    allergies: "", comorbidities: "", medications: "",
    pregnancyStartDate: "", expectedDeliveryDate: "",
    gestationalAgeDumWeeks: "", gestationalAgeDumDays: "",
    gestationalAgeUsgWeeks: "", gestationalAgeUsgDays: "",
    usgDate1: "", usgDate2: "", usgDate3: "",
    educationLevel: "", occupation: "",
    familySituation: "", familySupport: "",
    socialVulnerability: "", socialBenefit: "",
    substanceDependency: "", domesticViolence: "",
  };
}

export function suggestNextVisitDate(history, template) {
  const visits = (history || [])
    .filter(h => String(h.type || "").toLowerCase() === "visit")
    .map(h => ({ date: parseDateSafe(h.date), raw: h.date }))
    .filter(v => v.date)
    .sort((a, b) => b.date - a.date);

  const pendingVisits = Math.max((template?.targets?.visits || 0) - visits.length, 0);
  if (pendingVisits <= 0) return null;

  const intervalDays = template?.deadlines?.visits || 30;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (!visits.length) {
    return { date: today.toISOString().slice(0, 10), reason: "Nenhuma visita registrada ainda.", overdue: false, pendingVisits };
  }

  const lastVisit = parseLocalDate(visits[0].date);
  if (!lastVisit) return null;
  lastVisit.setHours(0, 0, 0, 0);
  const daysSince = Math.floor((today - lastVisit) / 86400000);
  const nextDate = new Date(lastVisit);
  nextDate.setDate(nextDate.getDate() + Math.max(intervalDays, 30));
  const daysUntil = Math.floor((nextDate - today) / 86400000);
  const overdue = daysUntil < -1;

  return {
    date: nextBusinessDay((overdue ? today : nextDate).toISOString().slice(0, 10)),
    reason: overdue
      ? `Última visita há ${daysSince} dias. Próxima está atrasada ${Math.abs(daysUntil)} dia(s).`
      : `Última visita há ${daysSince} dias. Próxima sugerida em ${daysUntil} dia(s).`,
    overdue,
    lastVisitDate: visits[0].raw,
    pendingVisits,
  };
}

export function deriveProtocolAlerts(summary) {
  if (!summary) return [];
  const special = Array.isArray(summary.specialAlerts) ? summary.specialAlerts : [];
  const specMapped = special.map((a, i) => ({
    id: a?.id || `s-${i}`,
    title: a?.title || "Alerta clínico",
    detail: a?.detail || "",
    severity: String(a?.severity || "low").toLowerCase(),
    category: a?.category || undefined,
  }));
  const specIds = new Set(specMapped.map(a => a.id));
  const schedule = summary.schedule || {};
  const out = [...specMapped];
  for (const [key, label] of [["visits","Visitas"],["consultations","Consultas"],["vaccines","Vacinas"]]) {
    const s = schedule?.[key];
    const schedId = `sch-${key}`;
    if (!s || Number(s.pending || 0) <= 0) continue;
    if (specIds.has(schedId)) continue;
    const overdue = Number(s.overdueDays || 0);
    const daysLeft = typeof s.daysLeft === "number" ? Number(s.daysLeft) : null;
    let computedDaysLeft = daysLeft;
    let detail = "";
    let severity = "low";
    if (overdue >= 1) {
      severity = "high";
      detail = `Atrasado ${overdue} dia(s)`;
    } else if (computedDaysLeft !== null) {
      severity = computedDaysLeft <= 7 ? "medium" : "low";
      detail = `${Math.max(computedDaysLeft, 0)} dia(s) para o prazo`;
    } else if (key === "visits" || key === "consultations") {
      const now = new Date();
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      endOfYear.setHours(23, 59, 59, 999);
      computedDaysLeft = Math.max(0, Math.ceil((endOfYear.getTime() - now.getTime()) / 86400000));
      severity = computedDaysLeft <= 7 ? "high" : (computedDaysLeft <= 30 ? "medium" : "low");
      const limitDate = endOfYear.toLocaleDateString("pt-BR");
      detail = `Prazo anual até ${limitDate} (${computedDaysLeft} dia(s) restantes)`;
    } else {
      detail = "Sem prazo definido";
    }
    out.push({ id: schedId, title: `${label}: ${Number(s.pending || 0)} pendente(s)`, detail, severity });
  }
  return out;
}

export function normalizeSeverity(value) {
  const v = String(value || "").toLowerCase();
  if (["high","alto","crítico","critico","vencido","atrasado"].includes(v)) return "high";
  if (["medium","médio","medio","atenção","atencao"].includes(v)) return "medium";
  return "low";
}

export function alertWeight(alert) {
  const title = String(alert?.title || "").toLowerCase();
  const match = title.match(/(\d+)\s+pendente/);
  if (match) return Math.max(1, Number(match[1] || 1));
  return 1;
}

export function ageInMonths(birthDate) {
  if (!birthDate) return null;
  const bd = parseDateSafe(birthDate);
  if (!bd) return null;
  const now = new Date();
  return (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
}

export function getBaseAgeGroup(ageMonths) {
  if (ageMonths === null) return "Adulto";
  if (ageMonths < 120) return "Criança";
  if (ageMonths < 240) return "Adolescente";
  if (ageMonths >= 720) return "Idoso";
  return "Adulto";
}

export function buildProactiveAlerts(patients, protocolByPatient, pharmacyStock, agenda) {
  const alerts = [];
  const today = new Date(); today.setHours(0,0,0,0);
  const nowIso = new Date().toISOString();

  patients.forEach(p => {
    if (String(p.careCategory||"").toLowerCase() !== "pregnant") return;
    const dpp = p.expectedDeliveryDate ? parseLocalDate(p.expectedDeliveryDate) : null;
    const dppPlusOne = dpp ? new Date(dpp.getTime() + 86400000) : null;
    if (dppPlusOne && dppPlusOne <= today) {
      const days = Math.floor((today - dpp) / 86400000);
      alerts.push({ id:"dpp-"+p.id, type:"danger", title:"DPP ultrapassada", detail:`${p.name} — ${days}d além da DPP`, patientId:p.id, createdAt:nowIso });
    }
  });

  patients.forEach(p => {
    const chip = protocolChip(protocolByPatient[p.id]);
    if (chip.tone === "danger") {
      alerts.push({ id:"prot-"+p.id, type:"danger", title:"Protocolo crítico", detail:p.name+" — "+chip.text, patientId:p.id, createdAt:nowIso });
    }
  });

  (pharmacyStock||[]).forEach(s => {
    if (s.qty === 0) alerts.push({ id:"stock0-"+s.id, type:"danger", title:"Medicamento zerado", detail:s.name, createdAt:nowIso });
    else if (s.qty <= s.minQty) alerts.push({ id:"stocklow-"+s.id, type:"warn", title:"Estoque baixo", detail:`${s.name} — ${s.qty} restante(s)`, createdAt:nowIso });
  });

  const todayStr = today.toISOString().slice(0,10);
  (agenda||[]).filter(a => a.date === todayStr && a.status === "scheduled").forEach(a => {
    alerts.push({ id:"agenda-"+a.id, type:"info", title:"Consulta hoje", detail:`${a.patientName} — ${a.time||"sem horário"} com ${a.doctorName||"profissional"}`, createdAt:nowIso });
  });

  return alerts.slice(0, 20);
}

export function protocolChip(summary) {
  if (!summary) return { text: "Sem status", tone: "muted" };
  if (summary.alertsRestricted) return { text: "Sem alertas (outra equipe)", tone: "muted" };
  const pending = summary.pending || {};
  const total = Number(pending.visits || 0) + Number(pending.consultations || 0) + Number(pending.vaccines || 0);
  const targets = summary.targets || {}, completed = summary.completed || {};
  const doneTotal   = Number(completed.visits || 0) + Number(completed.consultations || 0) + Number(completed.vaccines || 0);
  const targetTotal = Number(targets.visits || 0) + Number(targets.consultations || 0) + Number(targets.vaccines || 0);

  const allAlerts = deriveProtocolAlerts(summary);
  let criticalCount = 0, nearCount = 0;

  for (const a of allAlerts) {
    const sev      = normalizeSeverity(a?.severity);
    const overdue  = Number.isFinite(Number(a?.overdueDays)) ? Number(a.overdueDays) : 0;
    const daysLeft = Number.isFinite(Number(a?.daysLeft)) ? Number(a.daysLeft) : null;
    const weight   = alertWeight(a);
    if (overdue >= 1 || (daysLeft !== null && daysLeft <= 2) || sev === "high") {
      criticalCount += weight;
    } else if (sev === "medium") {
      nearCount += weight;
    }
  }

  if (criticalCount > 0) return { text: `Crítico (${criticalCount} item${criticalCount > 1 ? "s" : ""} crítico${criticalCount > 1 ? "s" : ""})`, tone: "danger" };
  if (nearCount > 0)     return { text: `Atenção (${nearCount} próximo${nearCount > 1 ? "s" : ""})`, tone: "warn" };
  if (total <= 0)        return { text: "Em dia", tone: "ok" };
  return { text: `No prazo (${doneTotal}/${targetTotal})`, tone: "muted" };
}
