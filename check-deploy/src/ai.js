function toDateSafe(value) {
  const d = new Date(value || "");
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(dateA, dateB = new Date()) {
  if (!dateA) return null;
  return Math.floor((dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24));
}

function sanitizeText(input) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

function computePatientRisk(context) {
  const pending = context.protocolSummary?.pending || {};
  const pendingTotal = Number(pending.visits || 0) + Number(pending.consultations || 0) + Number(pending.vaccines || 0);
  const overdueTasks = context.tasks.filter((t) => t.status !== "done" && t.dueDate && toDateSafe(t.dueDate) && toDateSafe(t.dueDate) < new Date()).length;
  const lastHistoryDate = toDateSafe(context.history[0]?.date);
  const daysNoEvent = daysBetween(lastHistoryDate);

  let score = pendingTotal * 12 + overdueTasks * 10;
  if (daysNoEvent !== null && daysNoEvent > 30) score += Math.min(40, daysNoEvent - 30);
  if (context.patient.careCategory === "pregnant") score += 12;
  if (context.patient.careCategory === "puerperal") score += 8;

  let level = "baixo";
  if (score >= 65) level = "alto";
  else if (score >= 35) level = "moderado";

  return { score, level, pendingTotal, overdueTasks, daysNoEvent };
}

function patientSummary(context) {
  const risk = computePatientRisk(context);
  const protocol = context.protocolSummary || {};
  const completed = protocol.completed || { visits: 0, consultations: 0, vaccines: 0 };
  const targets = protocol.targets || { visits: 0, consultations: 0, vaccines: 0 };
  const pending = protocol.pending || { visits: 0, consultations: 0, vaccines: 0 };
  const lastEvent = context.history[0];

  return {
    headline: `${context.patient.name} | Risco ${risk.level.toUpperCase()} (${risk.score})`,
    resumoClinico: [
      `Categoria: ${protocol.categoryLabel || context.patient.careCategory || "geral"}.`,
      `Comorbidades: ${sanitizeText(context.patient.comorbidities) || "não informado"}.`,
      `Medicações: ${sanitizeText(context.patient.medications) || "não informado"}.`,
      `Alergias: ${sanitizeText(context.patient.allergies) || "não informado"}.`
    ].join(" "),
    protocolo: {
      visitas: `${completed.visits}/${targets.visits}`,
      consultas: `${completed.consultations}/${targets.consultations}`,
      vacinas: `${completed.vaccines}/${targets.vaccines}`,
      pendências: pending
    },
    ultimoEvento: lastEvent
      ? `${lastEvent.type} em ${new Date(lastEvent.date).toLocaleDateString("pt-BR")} - ${sanitizeText(lastEvent.title)}`
      : "Sem eventos registrados",
    recomendacoes: [
      pending.visits > 0 ? `Programar ${pending.visits} visita(s) domiciliar(es).` : null,
      pending.consultations > 0 ? `Programar ${pending.consultations} consulta(s).` : null,
      pending.vaccines > 0 ? `Revisar caderneta para ${pending.vaccines} vacina(s) pendente(s).` : null,
      risk.overdueTasks > 0 ? `Existem ${risk.overdueTasks} tarefa(s) atrasada(s) para ACS.` : null
    ].filter(Boolean)
  };
}

function protocolHighlights(context) {
  const protocol = context.protocolSummary || {};
  const pending = protocol.pending || { visits: 0, consultations: 0, vaccines: 0 };
  const done = protocol.completed || { visits: 0, consultations: 0, vaccines: 0 };
  const target = protocol.targets || { visits: 0, consultations: 0, vaccines: 0 };

  const missing = [];
  if (pending.visits > 0) missing.push(`${pending.visits} visita(s)`);
  if (pending.consultations > 0) missing.push(`${pending.consultations} consulta(s)`);
  if (pending.vaccines > 0) missing.push(`${pending.vaccines} vacina(s)`);

  return {
    categoria: protocol.categoryLabel || context.patient.careCategory || "Geral",
    progresso: {
      visitas: `${done.visits}/${target.visits}`,
      consultas: `${done.consultations}/${target.consultations}`,
      vacinas: `${done.vaccines}/${target.vaccines}`
    },
    destaque: missing.length
      ? `Falta concluir: ${missing.join(", ")}`
      : "Protocolo em dia para esta categoria.",
    acoesSugeridas: [
      pending.visits > 0 ? "Reservar agenda de visita domiciliar com ACS." : null,
      pending.consultations > 0 ? "Agendar consulta de enfermagem/médica da categoria." : null,
      pending.vaccines > 0 ? "Conferir esquema vacinal e registrar aplicação." : null
    ].filter(Boolean)
  };
}

function evolutionDraft(context, payload = {}) {
  const sintese = patientSummary(context);
  const notaLivre = sanitizeText(payload.freeText);
  const ultimaConsulta = context.history.find((h) => h.type === "consultation");
  const ultimaVisita = context.history.find((h) => h.type === "visit");

  const subjective = notaLivre || "Paciente sem queixas novas registradas neste atendimento.";
  const objective = [
    ultimaConsulta ? `Última consulta: ${sanitizeText(ultimaConsulta.title)}.` : null,
    ultimaVisita ? `Última visita domiciliar: ${sanitizeText(ultimaVisita.title)}.` : null,
    `Protocolo atual: ${sintese.protocolo.visitas} visitas, ${sintese.protocolo.consultas} consultas, ${sintese.protocolo.vacinas} vacinas.`
  ].filter(Boolean).join(" ");

  return {
    model: "assistente-local",
    soap: {
      S: subjective,
      O: objective,
      A: `Paciente em seguimento de ${context.protocolSummary?.categoryLabel || context.patient.careCategory}. Risco ${computePatientRisk(context).level}.`,
      P: [
        "Manter seguimento conforme protocolo da categoria.",
        ...sintese.recomendacoes.slice(0, 3)
      ].join(" ")
    }
  };
}

function acsMessage(context) {
  const risk = computePatientRisk(context);
  const highlights = protocolHighlights(context);
  return {
    short: `ACS, acompanhar ${context.patient.name}. ${highlights.destaque}`,
    detailed: [
      `Paciente: ${context.patient.name}`,
      `Microárea: ${context.patient.microArea || "-"}`,
      `Risco atual: ${risk.level.toUpperCase()} (${risk.score})`,
      `Orientação principal: ${highlights.acoesSugeridas[0] || "Manter monitoramento rotineiro."}`,
      "Registrar retorno no sistema após visita."
    ].join("\n")
  };
}

function suggestProtocolCategory(context) {
  const text = [
    context.patient.comorbidities,
    context.patient.medications,
    context.patient.allergies,
    ...context.history.slice(0, 8).map((h) => h.title),
    ...context.history.slice(0, 8).map((h) => h.details)
  ].join(" ").toLowerCase();

  const signals = [];
  let category = context.patient.careCategory || "general";
  if (/gesta|prenatal|gravida/.test(text)) {
    category = "pregnant";
    signals.push("Termos relacionados a gestação/pré-natal.");
  } else if (/puerper|pos-parto/.test(text)) {
    category = "puerperal";
    signals.push("Termos relacionados ao puerpério.");
  } else if (/preventivo|papanicolau|colo do utero|citopat/.test(text)) {
    category = "general";
    signals.push("Termos relacionados a rastreamento de colo do útero dentro do protocolo geral.");
  } else if (/idos|geriatr|longev/.test(text)) {
    category = "elderly";
    signals.push("Termos relacionados ao cuidado da pessoa idosa.");
  } else if (/diabet|hiperten|dcnt|cronica/.test(text)) {
    category = "chronic";
    signals.push("Comorbidades crônicas mencionadas.");
  }

  return {
    suggestedCategory: category,
    confidence: signals.length ? 0.78 : 0.42,
    rationale: signals.length ? signals : ["Sem sinais fortes; manter categoria atual e revisar clinicamente."]
  };
}

function transcribePayload(payload = {}) {
  const transcript = sanitizeText(payload.transcript || payload.text || "");
  if (transcript) {
    return {
      transcript,
      structured: {
        summary: transcript.slice(0, 200),
        suggestedRecordType: /vacina/i.test(transcript) ? "vaccine" : (/consulta|atendimento/i.test(transcript) ? "consultation" : "note"),
        keywords: [...new Set(transcript.toLowerCase().split(/[^a-z0-9áàãâéêíóôõúç]+/i).filter((w) => w.length > 3))].slice(0, 10)
      }
    };
  }

  return {
    transcript: "",
    warning: "Transcrição de áudio bruto ainda não habilitada neste ambiente. Envie texto no campo transcript para estruturar automaticamente."
  };
}

function teamPriorities(items) {
  const ranked = items
    .map((context) => {
      const risk = computePatientRisk(context);
      return {
        patientId: context.patient.id,
        patientName: context.patient.name,
        microArea: context.patient.microArea || "-",
        acsId: context.patient.assignedAcsId || "",
        risk,
        protocol: context.protocolSummary?.pending || {},
        topAction: protocolHighlights(context).acoesSugeridas[0] || "Revisar prontuário e contato ativo."
      };
    })
    .sort((a, b) => b.risk.score - a.risk.score);

  return ranked.slice(0, 20);
}

function normalizeQueryText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseMonthKey(input = "") {
  const raw = String(input || "").trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeyFromDate(value) {
  const d = toDateSafe(value);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function computeDemandMetrics(items, month = "") {
  const key = parseMonthKey(month);
  let scheduled = 0;
  let spontaneous = 0;
  for (const context of items) {
    for (const ap of context.appointments || []) {
      if (monthKeyFromDate(ap.date || ap.createdAt) !== key) continue;
      const type = normalizeQueryText(ap.demandType);
      if (type.includes("spont")) spontaneous += 1;
      else scheduled += 1;
    }
  }
  const total = scheduled + spontaneous;
  const ratioScheduled = total > 0 ? Number(((scheduled / total) * 100).toFixed(2)) : 0;
  const status = total === 0 ? "no_data" : (ratioScheduled < 50 || ratioScheduled > 70 ? "out_of_range" : "in_range");
  return {
    month: key,
    totals: { scheduled, spontaneous, total },
    ratioScheduled,
    target: { min: 50, max: 70 },
    status
  };
}

function detectChartInconsistencies(items) {
  const findings = [];
  const cpfMap = new Map();
  const cnsMap = new Map();

  for (const context of items) {
    const p = context.patient;
    const patientId = p.id;
    const patientName = p.name;

    const cpf = String(p.cpf || "").replace(/\D/g, "");
    const cns = String(p.cns || "").replace(/\D/g, "");
    if (cpf) cpfMap.set(cpf, [...(cpfMap.get(cpf) || []), { patientId, patientName }]);
    if (cns) cnsMap.set(cns, [...(cnsMap.get(cns) || []), { patientId, patientName }]);

    const linkedAppointmentIds = new Set(
      (context.history || [])
        .map((h) => String(h?.metadata?.sourceAppointmentId || "").trim())
        .filter(Boolean)
    );

    const unlinkedOldAppointments = (context.appointments || []).filter((a) => {
      const id = String(a.id || "").trim();
      if (!id || linkedAppointmentIds.has(id)) return false;
      const days = daysBetween(toDateSafe(a.date || a.createdAt));
      return days !== null && days > 2;
    });
    if (unlinkedOldAppointments.length > 0) {
      findings.push({
        patientId,
        patientName,
        issue: `${unlinkedOldAppointments.length} atendimento(s) sem registro clínico vinculado`,
        severity: "medium",
        domain: "consistency"
      });
    }

    const futureRecords = (context.history || []).filter((h) => {
      const d = toDateSafe(h.date || h.createdAt);
      return d && d.getTime() > Date.now() + (24 * 60 * 60 * 1000);
    });
    if (futureRecords.length > 0) {
      findings.push({
        patientId,
        patientName,
        issue: `${futureRecords.length} registro(s) com data futura`,
        severity: "high",
        domain: "consistency"
      });
    }
  }

  for (const [, patients] of cpfMap) {
    if (patients.length < 2) continue;
    const names = patients.map((i) => i.patientName).join(", ");
    findings.push({
      patientId: patients[0].patientId,
      patientName: patients[0].patientName,
      issue: `CPF duplicado entre pacientes: ${names}`,
      severity: "high",
      domain: "consistency"
    });
  }
  for (const [, patients] of cnsMap) {
    if (patients.length < 2) continue;
    const names = patients.map((i) => i.patientName).join(", ");
    findings.push({
      patientId: patients[0].patientId,
      patientName: patients[0].patientName,
      issue: `CNS duplicado entre pacientes: ${names}`,
      severity: "high",
      domain: "consistency"
    });
  }

  return findings;
}

function dataQualityChecks(items) {
  const findings = [];
  for (const context of items) {
    const p = context.patient;
    if (!sanitizeText(p.phone)) findings.push({ patientId: p.id, patientName: p.name, issue: "Telefone ausente", severity: "high" });
    if (!sanitizeText(p.address)) findings.push({ patientId: p.id, patientName: p.name, issue: "Endereço ausente", severity: "medium" });
    if (!sanitizeText(p.cnsCpf)) findings.push({ patientId: p.id, patientName: p.name, issue: "Documento CNS/CPF ausente", severity: "medium" });
    if (!sanitizeText(p.assignedAcsId)) findings.push({ patientId: p.id, patientName: p.name, issue: "Paciente sem ACS vinculado", severity: "high" });
    const r = computePatientRisk(context);
    if (r.daysNoEvent !== null && r.daysNoEvent > 60) {
      findings.push({ patientId: p.id, patientName: p.name, issue: `Sem registro há ${r.daysNoEvent} dias`, severity: "high" });
    }
  }
  return [...findings, ...detectChartInconsistencies(items)];
}

function teamReport(items, options = {}) {
  const total = items.length;
  const byCategory = {};
  let overdueTasks = 0;
  let highRisk = 0;

  for (const context of items) {
    const cat = context.protocolSummary?.categoryLabel || context.patient.careCategory || "Geral";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    const risk = computePatientRisk(context);
    if (risk.level === "alto") highRisk += 1;
    overdueTasks += risk.overdueTasks;
  }

  const demand = computeDemandMetrics(items, options.month);
  const inconsistencies = detectChartInconsistencies(items);
  const severeInconsistencies = inconsistencies.filter((f) => f.severity === "high").length;
  const demandSummary = demand.status === "no_data"
    ? `Sem atendimentos no mês ${demand.month}.`
    : `Demanda programada em ${demand.ratioScheduled}% no mês ${demand.month} (meta: 50-70%).`;

  return {
    generatedAt: new Date().toISOString(),
    totals: { patients: total, highRiskPatients: highRisk, overdueTasks },
    byCategory,
    monthlyDemand: demand,
    dataConsistency: {
      totalFindings: inconsistencies.length,
      highSeverityFindings: severeInconsistencies
    },
    executiveSummary: `Equipe com ${total} paciente(s), ${highRisk} em alto risco, ${overdueTasks} tarefa(s) atrasada(s). ${demandSummary} Inconsistências críticas: ${severeInconsistencies}.`,
    recommendations: [
      "Priorizar pacientes de alto risco para contato em 48h.",
      "Revisar tarefas atrasadas em reunião rápida da equipe.",
      demand.status === "out_of_range"
        ? "Ajustar agenda mensal para manter demanda programada entre 50% e 70%."
        : "Manter monitoramento da proporção entre demanda programada e espontânea.",
      inconsistencies.length
        ? "Corrigir inconsistências de prontuário e vínculos de atendimento com registro clínico."
        : "Manter rotina de auditoria de dados para prevenir inconsistências."
    ]
  };
}

function chatAnswer(question, contexts) {
  const originalQ = String(question || "").trim();
  const q = normalizeQueryText(originalQ);
  if (!q.trim()) return { answer: "Envie uma pergunta para o assistente.", references: [] };

  if (/inconsisten|prontuar|erro de dado|duplicad/.test(q)) {
    const inconsistencies = detectChartInconsistencies(contexts).slice(0, 12);
    if (!inconsistencies.length) {
      return { answer: "Não encontrei inconsistências de prontuário no recorte atual.", references: [] };
    }
    return {
      answer: `Inconsistências encontradas: ${inconsistencies.map((i) => `${i.patientName} (${i.issue})`).join("; ")}.`,
      references: inconsistencies.map((i) => i.patientName)
    };
  }

  if (/demanda|agendada|espontan/.test(q) && /mes|mensal|percent|%/.test(q)) {
    const monthMatch = originalQ.match(/\b\d{4}-\d{2}\b/);
    const demand = computeDemandMetrics(contexts, monthMatch?.[0] || "");
    if (demand.status === "no_data") {
      return { answer: `Sem atendimentos lançados no mês ${demand.month}.`, references: [] };
    }
    return {
      answer: `No mês ${demand.month}: programada ${demand.totals.scheduled}, espontânea ${demand.totals.spontaneous}, proporção programada ${demand.ratioScheduled}% (meta 50-70%).`,
      references: []
    };
  }

  if (q.includes("gestante")) {
    const gest = contexts.filter((c) => c.patient.careCategory === "pregnant").map((c) => c.patient.name);
    return { answer: gest.length ? `Gestantes cadastradas: ${gest.join(", ")}.` : "Não encontrei gestantes cadastradas.", references: gest };
  }

  if (q.includes("atras") || q.includes("penden")) {
    const pendentes = contexts
      .map((c) => ({ name: c.patient.name, pending: c.protocolSummary?.pending || {} }))
      .filter((i) => Number(i.pending.visits || 0) + Number(i.pending.consultations || 0) + Number(i.pending.vaccines || 0) > 0)
      .slice(0, 12);
    if (!pendentes.length) return { answer: "Não há pendências de protocolo no momento.", references: [] };
    return {
      answer: `Pendências encontradas: ${pendentes.map((p) => `${p.name} (V:${p.pending.visits || 0}, C:${p.pending.consultations || 0}, Vac:${p.pending.vaccines || 0})`).join("; ")}.`,
      references: pendentes.map((p) => p.name)
    };
  }

  if (/risco alto|alto risco|prioridade/.test(q)) {
    const high = teamPriorities(contexts).filter((p) => p.risk.level === "alto").slice(0, 12);
    if (!high.length) return { answer: "Não há pacientes em alto risco no momento.", references: [] };
    return {
      answer: `Pacientes em alto risco: ${high.map((p) => `${p.patientName} (${p.risk.score})`).join(", ")}.`,
      references: high.map((p) => p.patientName)
    };
  }

  if (/sem telefone|telefone ausente|sem endereco|endereco ausente|sem acs/.test(q)) {
    const quality = dataQualityChecks(contexts);
    const filtered = quality.filter((f) =>
      (/telefone/.test(q) && /telefone/i.test(f.issue))
      || (/endereco/.test(q) && /endere/i.test(f.issue))
      || (/sem acs/.test(q) && /acs/i.test(f.issue))
    ).slice(0, 12);
    if (!filtered.length) return { answer: "Não encontrei pacientes com esse tipo de pendência.", references: [] };
    return {
      answer: `Pendências encontradas: ${filtered.map((f) => `${f.patientName} (${f.issue})`).join("; ")}.`,
      references: filtered.map((f) => f.patientName)
    };
  }

  const priorities = teamPriorities(contexts).slice(0, 5);
  return {
    answer: `Sugestão de foco do dia: ${priorities.map((p) => `${p.patientName} [${p.risk.level}]`).join(", ")}.`,
    references: priorities.map((p) => p.patientName)
  };
}

export {
  patientSummary,
  protocolHighlights,
  evolutionDraft,
  acsMessage,
  suggestProtocolCategory,
  transcribePayload,
  teamPriorities,
  dataQualityChecks,
  teamReport,
  chatAnswer
};
