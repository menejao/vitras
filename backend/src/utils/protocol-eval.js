import {
  eventDate,
  toDateOnlySafe,
  daysDiff,
  addDays,
  addMonths,
  normalizeText,
  isDentalText,
  isClinicalConsultation,
  homeVisitSeverityByDaysLeft,
  deadlineSeverity,
  vaccineDeadlineSeverity,
  detectRapidTestCoverage,
  matchesAnyAlias,
  monitorWindowDaysLeft
} from "./helpers.js";
import { normalizeCategory, normalizeChronicConditions } from "./domain.js";

function filterHistoryByPeriod(history, start, end) {
  const from = toDateOnlySafe(start);
  const until = toDateOnlySafe(end);
  return history.filter((h) => {
    const d = eventDate(h);
    if (!d) return false;
    if (from && d < from) return false;
    if (until && d > until) return false;
    return true;
  });
}

function detectGestationTimeline(patient) {
  const rawStart = toDateOnlySafe(patient?.pregnancyStartDate);
  const rawDue = toDateOnlySafe(patient?.expectedDeliveryDate);
  const usgDate1 = toDateOnlySafe(patient?.usgDate1);
  const dumWeeks = Number.isFinite(Number(patient?.gestationalAgeDumWeeks))
    ? Number(patient.gestationalAgeDumWeeks)
    : null;
  const dumDays = Number.isFinite(Number(patient?.gestationalAgeDumDays))
    ? Number(patient.gestationalAgeDumDays)
    : 0;
  const usgWeeks = Number.isFinite(Number(patient?.gestationalAgeUsgWeeks))
    ? Number(patient.gestationalAgeUsgWeeks)
    : null;
  const usgDays = Number.isFinite(Number(patient?.gestationalAgeUsgDays))
    ? Number(patient.gestationalAgeUsgDays)
    : 0;
  const now = toDateOnlySafe(new Date());

  const inferredStartFromFirstUsg =
    usgDate1 && usgWeeks !== null
      ? addDays(usgDate1, -Math.max(0, Math.floor(usgWeeks * 7 + usgDays)))
      : null;
  const inferredStartFromDumAge =
    now && dumWeeks !== null
      ? addDays(now, -Math.max(0, Math.floor(dumWeeks * 7 + dumDays)))
      : null;

  const start =
    inferredStartFromFirstUsg ||
    rawStart ||
    inferredStartFromDumAge ||
    (rawDue ? addDays(rawDue, -280) : null);
  const due = rawDue || (start ? addDays(start, 280) : null);
  const prenatalStart = toDateOnlySafe(patient?.prenatalStartDate);
  const gestationalDays = start ? Math.max(daysDiff(start, now) || 0, 0) : null;
  const gestationalWeeks = gestationalDays !== null ? Math.floor(gestationalDays / 7) : null;
  const daysUntilDue = due ? daysDiff(now, due) : null;

  return {
    start,
    due,
    prenatalStart,
    gestationalDays,
    gestationalWeeks,
    daysUntilDue,
    inferredBy: inferredStartFromFirstUsg
      ? "usg_1"
      : rawStart
      ? "dum"
      : inferredStartFromDumAge
      ? "ig_dum"
      : rawDue
      ? "dpp"
      : ""
  };
}

function detectPuerperalTimeline(patient) {
  const start = toDateOnlySafe(patient?.postpartumStartDate);
  const now = toDateOnlySafe(new Date());
  const daysAfterBirth = start ? Math.max(daysDiff(start, now) || 0, 0) : null;
  const daysLeft = daysAfterBirth === null ? null : 42 - daysAfterBirth;
  return { start, daysAfterBirth, daysLeft };
}

function makeClinicalAlert({
  id,
  activity,
  title,
  detail,
  severity = "low",
  daysLeft = null,
  overdueDays = 0,
  categoryLabel = "Gestante"
}) {
  return {
    id,
    activity,
    title,
    detail,
    severity,
    severityClass:
      severity === "lost"
        ? "status lost"
        : severity === "high"
        ? "status alert"
        : severity === "medium"
        ? "status pending"
        : "status progress",
    category: categoryLabel,
    daysLeft,
    overdue: Math.max(Number(overdueDays || 0), 0)
  };
}

function evaluatePregnantProtocol(patient, history) {
  const timeline = detectGestationTimeline(patient);
  const alerts = [];
  const categoryLabel = "Gestante";

  if (!timeline.start || !timeline.due) {
    alerts.push(
      makeClinicalAlert({
        id: "pregnancy-dates-missing",
        activity: "dados gestacionais",
        title: "Definir DUM ou DPP",
        detail: "Sem data-base de gestação. Cadastre DUM ou DPP para calcular prazos e alertas.",
        severity: "high",
        categoryLabel
      })
    );
    return { timeline, alerts, checklist: {} };
  }

  const pregnancyHistory = filterHistoryByPeriod(history, timeline.start, timeline.due);
  const visits = pregnancyHistory.filter((h) => h.type === "visit");
  const allClinicalConsultations = history.filter((h) => isClinicalConsultation(h));
  const allConsultations = pregnancyHistory.filter((h) => h.type === "consultation");
  const consultations = allConsultations.filter((h) => isClinicalConsultation(h));
  const consultationsTracked = consultations.length > 0 ? consultations : allClinicalConsultations;
  const procedures = pregnancyHistory.filter((h) => h.type === "procedure");
  const vaccines = pregnancyHistory.filter((h) => h.type === "vaccine");
  const consultationDatesAsc = consultationsTracked
    .map((entry) => eventDate(entry))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  const firstConsultDate = consultationDatesAsc.length ? consultationDatesAsc[0] : null;

  const weeks = Number(timeline.gestationalWeeks || 0);
  const visitPending = Math.max(3 - visits.length, 0);
  if (visitPending > 0) {
    const severity = homeVisitSeverityByDaysLeft(timeline.daysUntilDue);
    alerts.push(
      makeClinicalAlert({
        id: "pregnancy-visits",
        activity: "visita ACS",
        title: `Faltam ${visitPending} visita(s) domiciliar(es)`,
        detail: `Meta mínima de 3 visitas durante a gestação. Realizadas: ${visits.length}.`,
        severity,
        daysLeft: timeline.daysUntilDue,
        overdueDays:
          timeline.daysUntilDue !== null && timeline.daysUntilDue < 0
            ? Math.abs(timeline.daysUntilDue)
            : 0,
        categoryLabel
      })
    );
  }

  const prenatalStart = timeline.prenatalStart || firstConsultDate;
  if (!prenatalStart) {
    if (weeks >= 12) {
      alerts.push(
        makeClinicalAlert({
          id: "prenatal-start-missing",
          activity: "início do pré-natal",
          title: "Pré-natal sem data de início",
          detail: "O pré-natal deve iniciar até 12 semanas. Registre a data de início.",
          severity: "high",
          categoryLabel
        })
      );
    }
  } else {
    const prenatalWeek = Math.floor((daysDiff(timeline.start, prenatalStart) || 0) / 7);
    if (prenatalWeek > 12) {
      alerts.push(
        makeClinicalAlert({
          id: timeline.prenatalStart ? "prenatal-start-late" : "prenatal-start-late-by-first-consult",
          activity: "início do pré-natal",
          title: `Pré-natal iniciado com ${prenatalWeek} semanas`,
          detail: timeline.prenatalStart
            ? "Início recomendado até 12 semanas de gestação."
            : "Primeira consulta clínica ocorreu após 12 semanas de gestação.",
          severity: "high",
          overdueDays: Math.max((prenatalWeek - 12) * 7, 0),
          categoryLabel
        })
      );
    }
  }

  const consultPending = Math.max(7 - consultationsTracked.length, 0);
  if (consultPending > 0) {
    const severity = weeks >= 35 ? "high" : weeks >= 28 ? "medium" : "low";
    alerts.push(
      makeClinicalAlert({
        id: "pregnancy-consult-total",
        activity: "consultas pré-natais",
        title: `Faltam ${consultPending} consulta(s)`,
        detail: `Meta mínima de 7 consultas durante a gestação. Realizadas: ${consultationsTracked.length}.`,
        severity,
        categoryLabel
      })
    );
  }

  if (weeks >= 20 && !consultationsTracked.length) {
    alerts.push(
      makeClinicalAlert({
        id: "pregnancy-consult-first-missing",
        activity: "consultas pré-natais",
        title: "Sem consultas registradas na gestação",
        detail:
          "Registre consulta médica ou de enfermagem para iniciar o seguimento por faixa de semanas.",
        severity: "high",
        categoryLabel
      })
    );
  }

  const oralEvents = [...allConsultations, ...procedures].filter((h) => {
    const text = `${h.title || ""} ${h.details || ""}`;
    return isDentalText(text);
  });
  if (!oralEvents.length) {
    const overdueDentalDays = weeks > 35 ? (weeks - 35) * 7 : 0;
    alerts.push(
      makeClinicalAlert({
        id: "pregnancy-dental",
        activity: "consulta odontológica",
        title: "Falta consulta odontológica",
        detail:
          "Gestante deve ter pelo menos 1 consulta com cirurgião-dentista durante a gestação.",
        severity: weeks >= 35 ? "high" : weeks >= 24 ? "medium" : "low",
        overdueDays: overdueDentalDays,
        categoryLabel
      })
    );
  }

  const dtpaInWindow = vaccines.some((h) => {
    const d = eventDate(h);
    if (!d) return false;
    const week = Math.floor((daysDiff(timeline.start, d) || 0) / 7);
    const text = normalizeText(
      `${h.metadata?.vaccineName || ""} ${h.title || ""} ${h.details || ""}`
    );
    return week >= 20 && week <= 26 && text.includes("dtpa");
  });
  if (!dtpaInWindow && weeks >= 20) {
    const severity = weeks > 26 ? "high" : "medium";
    const overdueDtpaDays = weeks > 26 ? (weeks - 26) * 7 : 0;
    alerts.push(
      makeClinicalAlert({
        id: "pregnancy-dtpa",
        activity: "vacina dTpa",
        title: weeks > 26 ? "Janela da dTpa vencida" : "Aplicar dTpa entre 20ª e 26ª semana",
        detail: "Não há registro de dTpa na janela recomendada da gestação.",
        severity,
        overdueDays: overdueDtpaDays,
        categoryLabel
      })
    );
  }

  const hasPregnancyVaccine = (regex) =>
    vaccines.some((h) => {
      const text = normalizeText(
        `${h.metadata?.vaccineName || ""} ${h.title || ""} ${h.details || ""}`
      );
      return regex.test(text);
    });
  const influenzaDone = hasPregnancyVaccine(/influenza|gripe/);
  const covidDone = hasPregnancyVaccine(/covid/);
  const hepBDone = hasPregnancyVaccine(/hepatite b|hbv/);

  if (weeks >= 12 && !influenzaDone) {
    alerts.push(
      makeClinicalAlert({
        id: "pregnancy-influenza",
        activity: "vacina influenza",
        title: "Vacina influenza pendente na gestação",
        detail: "Registrar pelo menos 1 dose de influenza durante a gestação.",
        severity: weeks >= 28 ? "high" : "medium",
        categoryLabel
      })
    );
  }

  if (weeks >= 12 && !covidDone) {
    alerts.push(
      makeClinicalAlert({
        id: "pregnancy-covid",
        activity: "vacina COVID-19",
        title: "Vacina COVID-19 pendente na gestação",
        detail: "Registrar pelo menos 1 dose de COVID-19 durante a gestação.",
        severity: weeks >= 28 ? "high" : "medium",
        categoryLabel
      })
    );
  }

  if (weeks >= 12 && !hepBDone) {
    alerts.push(
      makeClinicalAlert({
        id: "pregnancy-hepb",
        activity: "vacina hepatite B",
        title: "Vacina hepatite B pendente na gestação",
        detail:
          "Registrar dose de hepatite B durante a gestação quando não houver comprovação prévia no prontuário.",
        severity: weeks >= 28 ? "high" : "medium",
        categoryLabel
      })
    );
  }

  const testEntries = [...procedures];
  const rapidTests = detectRapidTestCoverage(testEntries, timeline.start);
  const { hivFirst, sifFirst, hivThird, sifThird } = rapidTests;

  if (weeks > 13 && (!hivFirst || !sifFirst)) {
    const overdueFirstTrimesterDays = Math.max((weeks - 13) * 7, 0);
    alerts.push(
      makeClinicalAlert({
        id: "pregnancy-tests-first-trimester",
        activity: "testes rápidos 1º trimestre",
        title: "Teste rápido pendente no 1º trimestre",
        detail: `Pendência: ${!hivFirst ? "HIV" : ""}${!hivFirst && !sifFirst ? " e " : ""}${!sifFirst ? "sífilis" : ""}.`,
        severity: "high",
        overdueDays: overdueFirstTrimesterDays,
        categoryLabel
      })
    );
  }

  if (weeks >= 28 && (!hivThird || !sifThird)) {
    const overdueThirdTrimesterDays = Math.max((weeks - 28) * 7, 0);
    alerts.push(
      makeClinicalAlert({
        id: "pregnancy-tests-third-trimester",
        activity: "testes rápidos 3º trimestre",
        title: "Teste rápido pendente no 3º trimestre",
        detail: `Pendência: ${!hivThird ? "HIV" : ""}${!hivThird && !sifThird ? " e " : ""}${!sifThird ? "sífilis" : ""}.`,
        severity: "high",
        overdueDays: overdueThirdTrimesterDays,
        categoryLabel
      })
    );
  }

  return {
    timeline,
    alerts,
    checklist: {
      visitsDone: visits.length,
      consultationsDone: consultationsTracked.length,
      dentalDone: oralEvents.length > 0,
      dtpaDone: dtpaInWindow,
      influenzaDone,
      covidDone,
      hepBDone,
      hivFirstTrimesterDone: hivFirst,
      sifilisFirstTrimesterDone: sifFirst,
      hivThirdTrimesterDone: hivThird,
      sifilisThirdTrimesterDone: sifThird
    }
  };
}

function evaluatePuerperalProtocol(patient, history) {
  const timeline = detectPuerperalTimeline(patient);
  const alerts = [];
  const categoryLabel = "Puérpera";

  if (!timeline.start) {
    alerts.push(
      makeClinicalAlert({
        id: "puerperal-start-missing",
        activity: "início do puerpério",
        title: "Definir data do parto",
        detail: "Cadastre a data do parto para controlar o prazo de 42 dias do puerpério.",
        severity: "high",
        categoryLabel
      })
    );
    return { timeline, alerts, checklist: {} };
  }

  const periodEnd = addDays(timeline.start, 42);
  const puerperalHistory = filterHistoryByPeriod(history, timeline.start, periodEnd);
  const visits = puerperalHistory.filter((h) => h.type === "visit");
  const consultations = puerperalHistory.filter((h) => isClinicalConsultation(h));
  const overdue =
    timeline.daysLeft !== null && timeline.daysLeft < 0 ? Math.abs(timeline.daysLeft) : 0;
  const severityByDeadline =
    overdue > 0
      ? "high"
      : (timeline.daysLeft || 0) <= 7
      ? "high"
      : (timeline.daysLeft || 0) <= 14
      ? "medium"
      : "low";
  const visitSeverityByDeadline = homeVisitSeverityByDaysLeft(timeline.daysLeft);

  if (visits.length < 1) {
    alerts.push(
      makeClinicalAlert({
        id: "puerperal-visit",
        activity: "visita ACS",
        title: "Visita domiciliar pendente no puerpério",
        detail: "Necessário 1 visita domiciliar do ACS até 42 dias pós-parto.",
        severity: visitSeverityByDeadline,
        daysLeft: timeline.daysLeft,
        overdueDays: overdue,
        categoryLabel
      })
    );
  }

  if (consultations.length < 1) {
    alerts.push(
      makeClinicalAlert({
        id: "puerperal-consult",
        activity: "consulta puerperal",
        title: "Consulta puerperal pendente",
        detail:
          "Necessária 1 consulta médica ou de enfermagem até 42 dias pós-parto.",
        severity: severityByDeadline,
        daysLeft: timeline.daysLeft,
        overdueDays: overdue,
        categoryLabel
      })
    );
  }

  return {
    timeline,
    alerts,
    checklist: {
      visitsDone: visits.length,
      consultationsDone: consultations.length
    }
  };
}

function monthsFromDate(startDate, endDate = new Date()) {
  const start = toDateOnlySafe(startDate);
  const end = toDateOnlySafe(endDate);
  if (!start || !end) return null;
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(months, 0);
}

function yearsFromDate(startDate, endDate = new Date()) {
  const start = toDateOnlySafe(startDate);
  const end = toDateOnlySafe(endDate);
  if (!start || !end) return null;
  let years = end.getFullYear() - start.getFullYear();
  const monthDelta = end.getMonth() - start.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && end.getDate() < start.getDate())) {
    years -= 1;
  }
  return Math.max(years, 0);
}

function evaluatePapOnlyProtocol(patient, history) {
  const alerts = [];
  const categoryLabel = "Rastreamento Feminino/Trans";
  const birthDate = toDateOnlySafe(patient?.birthDate);
  const ageYears = yearsFromDate(birthDate, new Date());
  // F5-05: canonical enum values — M/F/I for sexAtBirth; IdentidadeGenero for genderIdentity
  const sexAtBirth = String(patient?.sexAtBirth || "").trim();
  const genderIdentity = String(patient?.genderIdentity || "").trim();
  // Female at birth or trans man (HOMEM_TRANSGENERO, assigned female at birth) — cervix present
  const isFemale = sexAtBirth === "F";
  const isTransMan = genderIdentity === "HOMEM_TRANSGENERO";
  const eligiblePapPopulation = isFemale || isTransMan;
  const now = toDateOnlySafe(new Date());

  if (ageYears === null) {
    alerts.push(
      makeClinicalAlert({
        id: "pap-birthdate-missing",
        activity: "dados demográficos",
        title: "Data de nascimento não informada",
        detail:
          "Cadastre a data de nascimento para aplicar as regras de idade de rastreamento.",
        severity: "high",
        categoryLabel
      })
    );
  }
  if (!sexAtBirth && !genderIdentity) {
    alerts.push(
      makeClinicalAlert({
        id: "pap-sex-gender-missing",
        activity: "dados demográficos",
        title: "Sexo ao nascer/identidade de gênero não informados",
        detail:
          "Preencha sexo ao nascer e identidade de gênero para aplicar as regras de elegibilidade.",
        severity: "medium",
        categoryLabel
      })
    );
  }

  const history12 = filterHistoryByPeriod(history, addDays(now, -365), now);
  const history24 = filterHistoryByPeriod(history, addDays(now, -730), now);
  const history36 = filterHistoryByPeriod(history, addDays(now, -1095), now);

  const isRequestedCollectedOrEvaluated = (text) => /solicit|colet|avali/.test(text);

  if (eligiblePapPopulation && ageYears !== null && ageYears >= 25 && ageYears <= 64) {
    const papDone = history36.some((h) => {
      const text = normalizeText(`${h.title || ""} ${h.details || ""}`);
      const isCervicalScreening =
        /papanicolau|citopat|colo do utero|preventivo|oncotica/.test(text);
      return isCervicalScreening && isRequestedCollectedOrEvaluated(text);
    });
    if (!papDone) {
      alerts.push(
        makeClinicalAlert({
          id: "pap-screening-36m",
          activity: "rastreamento de colo do útero",
          title: "Papanicolau/citopatológico pendente",
          detail:
            "Necessário registro coletado, solicitado ou avaliado nos últimos 36 meses (25 a 64 anos).",
          severity: "high",
          categoryLabel
        })
      );
    }
  }

  if (isFemale && ageYears !== null && ageYears >= 9 && ageYears <= 14) {
    const hpvDose = history.some((h) => {
      if (h.type !== "vaccine") return false;
      const text = normalizeText(
        `${h.metadata?.vaccineName || ""} ${h.title || ""} ${h.details || ""}`
      );
      return /hpv/.test(text);
    });
    if (!hpvDose) {
      alerts.push(
        makeClinicalAlert({
          id: "pap-hpv-9-14",
          activity: "vacina HPV",
          title: "Dose de HPV pendente",
          detail: "Necessária pelo menos 1 dose de HPV para meninas de 9 a 14 anos.",
          severity: "high",
          categoryLabel
        })
      );
    }
  }

  if (ageYears !== null && ageYears >= 14 && ageYears <= 69) {
    const consultDone = history12.some((h) => isClinicalConsultation(h));
    if (!consultDone) {
      alerts.push(
        makeClinicalAlert({
          id: "pap-consult-12m",
          activity: "consulta anual",
          title: "Consulta anual pendente",
          detail:
            "Necessária pelo menos 1 consulta médica ou de enfermagem nos últimos 12 meses (14 a 69 anos).",
          severity: "medium",
          categoryLabel
        })
      );
    }
  }

  if (ageYears !== null && ageYears >= 50 && ageYears <= 69) {
    const breastDone = history24.some((h) => {
      const text = normalizeText(`${h.title || ""} ${h.details || ""}`);
      const isBreastScreening =
        /(mamografia|rastreamento de mama|cancer de mama|exame de mama)/.test(text);
      return isBreastScreening && isRequestedCollectedOrEvaluated(text);
    });
    if (!breastDone) {
      alerts.push(
        makeClinicalAlert({
          id: "pap-breast-24m",
          activity: "rastreamento de mama",
          title: "Rastreamento de mama pendente",
          detail:
            "Necessário exame de rastreamento de câncer de mama solicitado ou avaliado nos últimos 24 meses (50 a 69 anos).",
          severity: "high",
          categoryLabel
        })
      );
    }
  }

  return {
    timeline: { birthDate, ageYears },
    alerts,
    checklist: { eligiblePapPopulation, ageYears }
  };
}

function evaluateChildProtocol(patient, history, template = null) {
  const alerts = [];
  const categoryLabel = "Puericultura";
  const birthDate = toDateOnlySafe(patient?.birthDate);
  if (!birthDate) {
    alerts.push(
      makeClinicalAlert({
        id: "child-birthdate-missing",
        activity: "dados da criança",
        title: "Definir data de nascimento",
        detail:
          "Cadastre a data de nascimento para controlar consultas, visitas e vacinas por mês de vida.",
        severity: "high",
        categoryLabel
      })
    );
    return {
      timeline: { birthDate: null, ageMonths: null, ageDays: null },
      alerts,
      checklist: {},
      acsFocus: []
    };
  }

  const ageDays = Math.max(daysDiff(birthDate, new Date()) || 0, 0);
  const ageMonths = monthsFromDate(birthDate, new Date());
  const until2Years = addDays(birthDate, 730);
  const history0to24m = filterHistoryByPeriod(history, birthDate, until2Years);
  const firstMonthEnd = addDays(birthDate, 30);
  const first6MonthsEnd = addDays(birthDate, 183);

  const consultations = history0to24m.filter((h) => isClinicalConsultation(h));
  const visits = history0to24m.filter((h) => h.type === "visit");
  const consultationsFirstMonth = consultations.filter((h) => {
    const d = eventDate(h);
    return d && d <= firstMonthEnd;
  });
  const visitsFirstMonth = visits.filter((h) => {
    const d = eventDate(h);
    return d && d <= firstMonthEnd;
  });
  const visitsFirst6Months = visits.filter((h) => {
    const d = eventDate(h);
    return d && d <= first6MonthsEnd;
  });

  const firstMonthDaysLeft = 30 - ageDays;
  if (consultationsFirstMonth.length < 1) {
    alerts.push(
      makeClinicalAlert({
        id: "child-consult-first-month",
        activity: "consulta no 1º mês",
        title: "Consulta inicial pendente",
        detail: "Necessária 1 consulta médica ou de enfermagem no primeiro mês de vida.",
        severity: deadlineSeverity(firstMonthDaysLeft),
        daysLeft: firstMonthDaysLeft,
        overdueDays: Math.max(-firstMonthDaysLeft, 0),
        categoryLabel
      })
    );
  }

  const totalConsultTarget = Math.max(1, Number(template?.targets?.consultations ?? 10));
  const expectedByAge =
    ageMonths >= 24
      ? totalConsultTarget
      : Math.min(
          totalConsultTarget,
          Math.max(
            1,
            Math.ceil(((ageMonths || 0) / 24) * Math.max(totalConsultTarget - 1, 0)) + 1
          )
        );
  const targetConsults = expectedByAge;
  const consultPending = Math.max(targetConsults - consultations.length, 0);
  if (consultPending > 0) {
    alerts.push(
      makeClinicalAlert({
        id: "child-consult-total",
        activity: "consultas até 2 anos",
        title: `Faltam ${consultPending} consulta(s) até 2 anos`,
        detail: `Registradas: ${consultations.length}. Esperado para idade atual: ${targetConsults}.`,
        severity: ageMonths >= 18 ? "high" : ageMonths >= 12 ? "medium" : "low",
        categoryLabel
      })
    );
  }

  if (visitsFirstMonth.length < 1) {
    alerts.push(
      makeClinicalAlert({
        id: "child-visit-first-month",
        activity: "visita ACS 1º mês",
        title: "Visita domiciliar pendente no 1º mês",
        detail: "Necessária 1 visita do ACS dentro do primeiro mês de vida.",
        severity: homeVisitSeverityByDaysLeft(firstMonthDaysLeft),
        daysLeft: firstMonthDaysLeft,
        overdueDays: Math.max(-firstMonthDaysLeft, 0),
        categoryLabel
      })
    );
  }

  const firstSixMonthsDaysLeft = 183 - ageDays;
  if (visitsFirst6Months.length < 2) {
    const missing = 2 - visitsFirst6Months.length;
    alerts.push(
      makeClinicalAlert({
        id: "child-visit-first-6m",
        activity: "visitas ACS até 6 meses",
        title: `Falta(m) ${missing} visita(s) do ACS até o 6º mês`,
        detail: `Registradas até 6 meses: ${visitsFirst6Months.length}.`,
        severity: homeVisitSeverityByDaysLeft(firstSixMonthsDaysLeft),
        daysLeft: firstSixMonthsDaysLeft,
        overdueDays: Math.max(-firstSixMonthsDaysLeft, 0),
        categoryLabel
      })
    );
  }

  const vaccinePlan = [
    { month: 0, vaccine: "bcg", label: "BCG", aliases: ["bcg"], acsHighlight: true },
    { month: 0, vaccine: "hepatite_b", label: "Hepatite B", aliases: ["hepatite b"], acsHighlight: true },
    { month: 2, vaccine: "penta", label: "Penta", aliases: ["penta", "pentavalente"], acsHighlight: true },
    { month: 2, vaccine: "vip", label: "VIP", aliases: ["vip", "polio inativada"], acsHighlight: true },
    { month: 2, vaccine: "pneumo10", label: "Pneumo 10", aliases: ["pneumo 10", "pneumo10", "pneumococ"], acsHighlight: true },
    { month: 2, vaccine: "rotavirus", label: "Rotavírus", aliases: ["rota", "rotavirus"], acsHighlight: true },
    { month: 3, vaccine: "meningo", label: "Meningocócica", aliases: ["meningo"], acsHighlight: false },
    { month: 4, vaccine: "penta", label: "Penta", aliases: ["penta", "pentavalente"], acsHighlight: true },
    { month: 4, vaccine: "vip", label: "VIP", aliases: ["vip", "polio inativada"], acsHighlight: true },
    { month: 4, vaccine: "pneumo10", label: "Pneumo 10", aliases: ["pneumo 10", "pneumo10", "pneumococ"], acsHighlight: true },
    { month: 4, vaccine: "rotavirus", label: "Rotavírus", aliases: ["rota", "rotavirus"], acsHighlight: true },
    { month: 5, vaccine: "meningo", label: "Meningocócica", aliases: ["meningo"], acsHighlight: false },
    { month: 6, vaccine: "penta", label: "Penta", aliases: ["penta", "pentavalente"], acsHighlight: true },
    { month: 6, vaccine: "vip", label: "VIP", aliases: ["vip", "polio inativada"], acsHighlight: true },
    { month: 6, vaccine: "influenza", label: "Influenza", aliases: ["influenza", "gripe"], acsHighlight: false },
    { month: 6, vaccine: "covid", label: "COVID", aliases: ["covid"], acsHighlight: false },
    { month: 7, vaccine: "covid", label: "COVID", aliases: ["covid"], acsHighlight: false },
    { month: 9, vaccine: "covid", label: "COVID", aliases: ["covid"], acsHighlight: false },
    { month: 9, vaccine: "febre_amarela", label: "Febre amarela", aliases: ["febre amarela"], acsHighlight: true },
    { month: 12, vaccine: "pneumo10", label: "Pneumo 10", aliases: ["pneumo 10", "pneumo10", "pneumococ"], acsHighlight: true },
    { month: 12, vaccine: "acwy", label: "ACWY", aliases: ["acwy"], acsHighlight: false },
    { month: 12, vaccine: "triplice_viral", label: "Tríplice viral", aliases: ["triplice viral", "triviral"], acsHighlight: true },
    { month: 15, vaccine: "dtp", label: "DTP", aliases: ["dtp"], acsHighlight: false },
    { month: 15, vaccine: "vip", label: "VIP", aliases: ["vip", "polio inativada"], acsHighlight: true },
    { month: 15, vaccine: "triplice_viral", label: "Tríplice viral", aliases: ["triplice viral", "triviral"], acsHighlight: true },
    { month: 15, vaccine: "varicela", label: "Varicela", aliases: ["varicela"], acsHighlight: false },
    { month: 15, vaccine: "hepatite_a", label: "Hepatite A", aliases: ["hepatite a"], acsHighlight: false }
  ];

  const vaccineEvents = history0to24m
    .filter((h) => h.type === "vaccine")
    .map((h) => ({
      date: eventDate(h),
      text: normalizeText(
        `${h.metadata?.vaccineName || ""} ${h.title || ""} ${h.details || ""}`
      )
    }))
    .filter((h) => h.date && h.text);

  const eventsByVaccine = {};
  for (const item of vaccinePlan) eventsByVaccine[item.vaccine] = [];
  for (const event of vaccineEvents) {
    for (const item of vaccinePlan) {
      if (matchesAnyAlias(event.text, item.aliases)) {
        eventsByVaccine[item.vaccine].push(event.date);
      }
    }
  }
  for (const key of Object.keys(eventsByVaccine)) {
    eventsByVaccine[key].sort((a, b) => a.getTime() - b.getTime());
  }

  const acsFocus = [];
  const plannedDoseIndexByVaccine = {};
  for (const item of vaccinePlan) {
    plannedDoseIndexByVaccine[item.vaccine] = (plannedDoseIndexByVaccine[item.vaccine] || 0) + 1;
    const requiredDoseCount = plannedDoseIndexByVaccine[item.vaccine];
    const appliedDoseCount = (eventsByVaccine[item.vaccine] || []).length;
    if (appliedDoseCount >= requiredDoseCount) continue;

    const dueDate = addMonths(birthDate, item.month);
    const daysLeft = daysDiff(new Date(), dueDate);
    const severity = vaccineDeadlineSeverity(daysLeft);
    const overdueDays = Math.max(-(Number(daysLeft) || 0), 0);
    alerts.push(
      makeClinicalAlert({
        id: `child-vaccine-${item.vaccine}-${item.month}`,
        activity: "vacina",
        title: `Vacina pendente: ${item.label} (${item.month} mês[es])`,
        detail: `Dose prevista aos ${item.month} mês[es] de vida (${dueDate ? dueDate.toLocaleDateString("pt-BR") : "-"}) ainda não identificada no histórico.`,
        severity,
        daysLeft,
        overdueDays,
        categoryLabel
      })
    );
    if (item.acsHighlight && Number(daysLeft) <= 30) {
      acsFocus.push(`${item.label} (${item.month}m)`);
    }
  }

  return {
    timeline: { birthDate, ageMonths, ageDays },
    alerts,
    acsFocus: [...new Set(acsFocus)],
    checklist: {
      consultationsFirstMonthDone: consultationsFirstMonth.length > 0,
      consultationsDone0to24m: consultations.length,
      visitsFirstMonthDone: visitsFirstMonth.length > 0,
      visitsDone0to6m: visitsFirst6Months.length
    }
  };
}

function evaluateElderlyProtocol(patient, history) {
  const alerts = [];
  const categoryLabel = "Pessoa Idosa";
  const now = toDateOnlySafe(new Date());
  const periodStart = addDays(now, -365);
  const periodHistory = filterHistoryByPeriod(history, periodStart, now);
  const hasAssignedAcs = Boolean(String(patient?.assignedAcsId || "").trim());

  const consultations = periodHistory.filter((h) => isClinicalConsultation(h));
  const visits = periodHistory
    .filter((h) => h.type === "visit")
    .map((h) => eventDate(h))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());

  const vaccines = periodHistory.filter((h) => h.type === "vaccine");
  const influenzaDone = vaccines.some((h) => {
    const text = normalizeText(
      `${h.metadata?.vaccineName || ""} ${h.title || ""} ${h.details || ""}`
    );
    return /influenza|gripe/.test(text);
  });

  if (consultations.length < 1) {
    alerts.push(
      makeClinicalAlert({
        id: "elderly-consult-12m",
        activity: "consulta em 12 meses",
        title: "Consulta anual pendente",
        detail:
          "Necessária pelo menos 1 consulta médica ou de enfermagem dentro de 12 meses.",
        severity: "high",
        categoryLabel
      })
    );
  }

  let visitsWithMinInterval = false;
  if (visits.length >= 2) {
    for (let i = 1; i < visits.length; i += 1) {
      const diff = daysDiff(visits[i - 1], visits[i]);
      if ((diff || 0) >= 30) {
        visitsWithMinInterval = true;
        break;
      }
    }
  }
  if (!hasAssignedAcs) {
    alerts.push(
      makeClinicalAlert({
        id: "elderly-acs-missing",
        activity: "vínculo ACS",
        title: "Paciente sem ACS vinculado",
        detail:
          "Atribua um ACS para habilitar e contabilizar visitas domiciliares no protocolo.",
        severity: "medium",
        categoryLabel
      })
    );
  } else if (!visitsWithMinInterval) {
    alerts.push(
      makeClinicalAlert({
        id: "elderly-visits-12m",
        activity: "visitas ACS em 12 meses",
        title: "Visitas domiciliares pendentes",
        detail:
          "Necessárias 2 visitas do ACS com intervalo mínimo de 30 dias dentro de 12 meses.",
        severity: "high",
        categoryLabel
      })
    );
  }

  if (!influenzaDone) {
    alerts.push(
      makeClinicalAlert({
        id: "elderly-flu-12m",
        activity: "vacina influenza",
        title: "Vacina influenza pendente",
        detail: "Necessária 1 dose de influenza dentro dos últimos 12 meses.",
        severity: "medium",
        categoryLabel
      })
    );
  }

  return {
    timeline: { periodStart, periodEnd: now },
    alerts,
    checklist: {
      consultationDone12m: consultations.length >= 1,
      visitsDone12m: visits.length,
      visitsWithMin30Days: visitsWithMinInterval,
      influenzaDone12m: influenzaDone
    }
  };
}

function evaluateChronicProtocol(patient, history) {
  const conditions = normalizeChronicConditions(patient?.chronicConditions);
  const alerts = [];
  const categoryLabel = "Condição crônica";
  if (!conditions.length) {
    alerts.push(
      makeClinicalAlert({
        id: "chronic-conditions-missing",
        activity: "subtipo crônico",
        title: "Selecione hipertensão e/ou diabetes",
        detail:
          "No cadastro do paciente crônico, marque uma ou as duas condições para ativar as regras de acompanhamento.",
        severity: "medium",
        categoryLabel
      })
    );
    return { alerts, checklist: { conditions: [] }, timeline: {} };
  }

  const now = toDateOnlySafe(new Date());
  const period6Start = addDays(now, -183);
  const period12Start = addDays(now, -365);
  const daysLeft6m = monitorWindowDaysLeft(patient, 183);
  const daysLeft12m = monitorWindowDaysLeft(patient, 365);
  const hasAssignedAcs = Boolean(String(patient?.assignedAcsId || "").trim());
  const history6 = filterHistoryByPeriod(history, period6Start, now);
  const history12 = filterHistoryByPeriod(history, period12Start, now);
  const consultations6 = history6.filter((h) => isClinicalConsultation(h));
  const visits12 = history12
    .filter((h) => h.type === "visit")
    .map((h) => eventDate(h))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());

  let visitsWithMinInterval = false;
  if (visits12.length >= 2) {
    for (let i = 1; i < visits12.length; i += 1) {
      const diff = daysDiff(visits12[i - 1], visits12[i]);
      if ((diff || 0) >= 30) {
        visitsWithMinInterval = true;
        break;
      }
    }
  }

  let missingAcsAlertAdded = false;
  for (const condition of conditions) {
    const label = condition === "diabetes" ? "Diabetes" : "Hipertensão";
    if (consultations6.length < 1) {
      alerts.push(
        makeClinicalAlert({
          id: `chronic-${condition}-consult-6m`,
          activity: "consulta em 6 meses",
          title: `${label}: consulta semestral pendente`,
          detail:
            "Necessária pelo menos 1 consulta médica ou de enfermagem nos últimos 6 meses.",
          severity: deadlineSeverity(daysLeft6m),
          daysLeft: daysLeft6m,
          overdueDays: Math.max(-daysLeft6m, 0),
          categoryLabel
        })
      );
    }
    if (!hasAssignedAcs) {
      if (!missingAcsAlertAdded) {
        alerts.push(
          makeClinicalAlert({
            id: "chronic-acs-missing",
            activity: "vínculo ACS",
            title: "Paciente sem ACS vinculado",
            detail:
              "Atribua um ACS para habilitar e contabilizar visitas domiciliares no monitoramento crônico.",
            severity: "medium",
            categoryLabel
          })
        );
        missingAcsAlertAdded = true;
      }
    } else if (!visitsWithMinInterval) {
      alerts.push(
        makeClinicalAlert({
          id: `chronic-${condition}-visits-12m`,
          activity: "visitas ACS em 12 meses",
          title: `${label}: visitas domiciliares pendentes`,
          detail:
            "Necessárias pelo menos 2 visitas do ACS com intervalo mínimo de 30 dias, dentro de 12 meses.",
          severity: deadlineSeverity(daysLeft12m),
          daysLeft: daysLeft12m,
          overdueDays: Math.max(-daysLeft12m, 0),
          categoryLabel
        })
      );
    }

    if (condition === "diabetes") {
      const diabetesEntries12 = history12.filter((h) =>
        ["consultation", "procedure", "note"].includes(h.type)
      );
      const hasGlycated = diabetesEntries12.some((h) => {
        const text = normalizeText(`${h.title || ""} ${h.details || ""}`);
        return /hemoglobina glicada|hba1c|glicada/.test(text);
      });
      const hasFootAssessment = diabetesEntries12.some((h) => {
        const text = normalizeText(`${h.title || ""} ${h.details || ""}`);
        return /avaliac.*pe|avaliacao dos pes|exame dos pes|inspecao dos pes|pe diabetico/.test(text);
      });

      if (!hasGlycated) {
        alerts.push(
          makeClinicalAlert({
            id: "chronic-diabetes-hba1c-12m",
            activity: "hemoglobina glicada",
            title: "Diabetes: registro de hemoglobina glicada pendente",
            detail:
              "Registrar solicitação/realização/avaliação de hemoglobina glicada ao menos 1 vez em 12 meses.",
            severity: deadlineSeverity(daysLeft12m),
            daysLeft: daysLeft12m,
            overdueDays: Math.max(-daysLeft12m, 0),
            categoryLabel
          })
        );
      }
      if (!hasFootAssessment) {
        alerts.push(
          makeClinicalAlert({
            id: "chronic-diabetes-foot-12m",
            activity: "avaliação dos pés",
            title: "Diabetes: avaliação dos pés pendente",
            detail: "Registrar pelo menos 1 avaliação dos pés em 12 meses.",
            severity: deadlineSeverity(daysLeft12m),
            daysLeft: daysLeft12m,
            overdueDays: Math.max(-daysLeft12m, 0),
            categoryLabel
          })
        );
      }
    }
  }

  return {
    alerts,
    timeline: { period6Start, period12Start, periodEnd: now },
    checklist: {
      conditions,
      consultationDone6m: consultations6.length >= 1,
      visitsDone12m: visits12.length,
      visitsWithMin30Days12m: visitsWithMinInterval
    }
  };
}

function buildProtocolSummary(patient, history, templateMap) {
  const normalizedCategory = normalizeCategory(patient.careCategory, templateMap);
  const template = templateMap[normalizedCategory] || templateMap.general;

  const completed = {
    visits: history.filter((h) => h.type === "visit").length,
    consultations: history.filter((h) => isClinicalConsultation(h)).length,
    vaccines: history.filter((h) => h.type === "vaccine").length
  };

  const pending = {
    visits: Math.max(template.targets.visits - completed.visits, 0),
    consultations: Math.max(template.targets.consultations - completed.consultations, 0),
    vaccines: Math.max(template.targets.vaccines - completed.vaccines, 0)
  };

  const lastDates = {
    visits: history.find((h) => h.type === "visit")?.date || "",
    consultations: history.find((h) => isClinicalConsultation(h))?.date || "",
    vaccines: history.find((h) => h.type === "vaccine")?.date || ""
  };

  const now = Date.now();
  const scheduleOf = (key) => {
    const intervalDays = Number(template.deadlines?.[key] || 0);
    const lastDate = lastDates[key];
    const lastTs = lastDate ? new Date(lastDate).getTime() : NaN;
    const daysSinceLast = Number.isFinite(lastTs)
      ? Math.max(0, Math.floor((now - lastTs) / (1000 * 60 * 60 * 24)))
      : null;
    const daysLeft =
      intervalDays > 0
        ? daysSinceLast === null
          ? intervalDays
          : intervalDays - daysSinceLast
        : null;
    const overdueDays =
      intervalDays > 0 && daysSinceLast !== null
        ? Math.max(daysSinceLast - intervalDays, 0)
        : 0;
    return {
      intervalDays,
      lastDate,
      daysSinceLast,
      daysLeft,
      overdueDays,
      pending: Number(pending[key] || 0)
    };
  };

  const appliedVaccineNames = history
    .filter((h) => h.type === "vaccine")
    .map((h) => h.metadata?.vaccineName || h.title || "")
    .filter(Boolean);
  const normalizedAppliedVaccineNames = appliedVaccineNames.map((name) => normalizeText(name));
  const vaccineAliases = {
    dtpa: ["dtpa"],
    influenza: ["influenza", "gripe"],
    "covid-19": ["covid-19", "covid 19", "covid"],
    "hepatite b": ["hepatite b", "hbv"],
    bcg: ["bcg"],
    penta: ["penta", "pentavalente"],
    vip: ["vip", "polio inativada"],
    "pneumo 10": ["pneumo 10", "pneumo10", "pneumococ"],
    rotavirus: ["rotavirus", "rota"],
    meningococica: ["meningococica", "meningo"],
    acwy: ["acwy"],
    "triplice viral": ["triplice viral", "triviral"],
    dtp: ["dtp"],
    varicela: ["varicela"],
    "hepatite a": ["hepatite a"],
    hpv: ["hpv"]
  };
  const vaccineDoneByName = (name) => {
    const normalizedName = normalizeText(name);
    const aliases = vaccineAliases[normalizedName] || [normalizedName];
    return normalizedAppliedVaccineNames.some((applied) =>
      aliases.some((alias) => applied.includes(alias))
    );
  };

  const recommendedVaccines = template.vaccines.map((name) => ({
    name,
    done: vaccineDoneByName(name)
  }));

  let specialMonitoring = null;
  let specialAlerts = [];
  const chronicConditions = normalizeChronicConditions(patient?.chronicConditions);
  if (template.category === "pregnant") {
    specialMonitoring = evaluatePregnantProtocol(patient, history);
    specialAlerts = specialMonitoring.alerts || [];
  } else if (template.category === "puerperal") {
    specialMonitoring = evaluatePuerperalProtocol(patient, history);
    specialAlerts = specialMonitoring.alerts || [];
  } else if (template.category === "child_followup") {
    specialMonitoring = evaluateChildProtocol(patient, history, template);
    specialAlerts = specialMonitoring.alerts || [];
  } else if (template.category === "elderly") {
    specialMonitoring = evaluateElderlyProtocol(patient, history);
    specialAlerts = specialMonitoring.alerts || [];
  }

  if (chronicConditions.length > 0) {
    const chronicMonitoring = evaluateChronicProtocol(patient, history);
    specialMonitoring = {
      ...(specialMonitoring || {}),
      chronic: chronicMonitoring,
      checklist: {
        ...((specialMonitoring && specialMonitoring.checklist) || {}),
        chronicConditions: chronicMonitoring?.checklist?.conditions || []
      }
    };
    specialAlerts = [...(specialAlerts || []), ...(chronicMonitoring?.alerts || [])];
  }

  const severityWeight = { lost: 4, high: 3, medium: 2, low: 1 };
  specialAlerts = [...specialAlerts].sort((a, b) => {
    const aW = severityWeight[String(a?.severity || "low")] || 1;
    const bW = severityWeight[String(b?.severity || "low")] || 1;
    if (bW !== aW) return bW - aW;
    const aOver = Number(a?.overdue || 0);
    const bOver = Number(b?.overdue || 0);
    if (bOver !== aOver) return bOver - aOver;
    const aLeft = Number.isFinite(Number(a?.daysLeft)) ? Number(a.daysLeft) : 999999;
    const bLeft = Number.isFinite(Number(b?.daysLeft)) ? Number(b.daysLeft) : 999999;
    return aLeft - bLeft;
  });

  return {
    category: template.category,
    categoryLabel: template.label,
    targets: template.targets,
    completed,
    pending,
    deadlines: template.deadlines || { visits: 0, consultations: 0, vaccines: 0 },
    lastDates,
    schedule: {
      visits: scheduleOf("visits"),
      consultations: scheduleOf("consultations"),
      vaccines: scheduleOf("vaccines")
    },
    specialAlerts,
    specialMonitoring,
    vaccines: {
      recommended: recommendedVaccines,
      appliedNames: [...new Set(appliedVaccineNames)]
    }
  };
}

function restrictSummaryAlertsForForeignTeam(summary) {
  const safe = summary && typeof summary === "object" ? summary : {};
  return {
    ...safe,
    alertsRestricted: true,
    specialAlerts: [],
    schedule: {
      visits: null,
      consultations: null,
      vaccines: null
    }
  };
}

export {
  filterHistoryByPeriod,
  detectGestationTimeline,
  detectPuerperalTimeline,
  makeClinicalAlert,
  evaluatePregnantProtocol,
  evaluatePuerperalProtocol,
  monthsFromDate,
  yearsFromDate,
  evaluateChildProtocol,
  evaluateElderlyProtocol,
  evaluateChronicProtocol,
  buildProtocolSummary,
  restrictSummaryAlertsForForeignTeam
};
