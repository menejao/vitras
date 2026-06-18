import { v4 as uuidv4 } from "uuid";
import { normalizeCategory, DEFAULT_CARE_PROTOCOLS } from "./domain.js";

function randomInt(min, max) {
  const low = Math.ceil(Number(min));
  const high = Math.floor(Number(max));
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function pickRandom(items = []) {
  if (!Array.isArray(items) || !items.length) return null;
  return items[randomInt(0, items.length - 1)];
}

function chance(percent = 50) {
  return Math.random() * 100 < Number(percent);
}

function isoDateOffset(daysOffset = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Number(daysOffset));
  return d.toISOString().slice(0, 10);
}

function makeDigits(size = 11) {
  let out = "";
  for (let i = 0; i < size; i += 1) out += String(randomInt(0, 9));
  return out;
}

function makePhone() {
  return `(${randomInt(11, 99)}) 9${makeDigits(4)}-${makeDigits(4)}`;
}

function normalizeSeedCategory(category) {
  return normalizeCategory(category, Object.fromEntries(Object.keys(DEFAULT_CARE_PROTOCOLS).map((k) => [k, DEFAULT_CARE_PROTOCOLS[k]])));
}

function buildSeedPatient({ index, teamIds, acsIds, incomplete = false }) {
  const firstNames = [
    "Ana", "Bruna", "Carla", "Daniela", "Eduarda", "Fernanda", "Gabriela", "Helena", "Isabela", "Juliana",
    "Karen", "Larissa", "Marina", "Nathalia", "Paula", "Quezia", "Renata", "Sabrina", "Talita", "Vanessa",
    "Wesley", "Yasmin", "Zilda", "Amanda", "Bianca", "Camila", "Debora", "Eliane", "Fabiana", "Giovana",
    "Heloisa", "Iris", "Joana", "Karina", "Livia", "Michele", "Noemi", "Priscila", "Raquel", "Simone",
    "Tiago", "Ursula", "Vitoria", "William", "Yuri", "Zuleica", "Aline", "Beatriz", "Cecilia", "Diego",
    "Elaine", "Felipe", "Gustavo", "Hugo", "Icaro", "Janaina", "Katia", "Leandro", "Marta", "Nicolas"
  ];
  const lastNames = [
    "Silva", "Souza", "Santos", "Oliveira", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento",
    "Lima", "Carvalho", "Araujo", "Fernandes", "Ribeiro", "Gomes", "Martins", "Rocha", "Melo", "Barbosa"
  ];
  const streets = ["Rua das Flores", "Rua Sete de Setembro", "Avenida Central", "Rua do Sol", "Travessa Esperança", "Rua Boa Vista"];
  const districts = ["Centro", "Jardim Primavera", "Vila Nova", "Bela Vista", "Alvorada", "São José"];
  const cities = ["São Paulo", "Guarulhos", "Campinas", "Santo André", "Osasco", "Sorocaba"];
  const ufs = ["SP", "RJ", "MG", "BA", "PE", "PR"];
  const categories = ["pregnant", "puerperal", "child_followup", "elderly", "general"];
  const category = normalizeSeedCategory(categories[index % categories.length]);
  const teamId = pickRandom(teamIds) || "team-ana";
  const acsId = chance(82) ? (pickRandom(acsIds) || "") : "";

  const first = pickRandom(firstNames) || `Paciente${index + 1}`;
  const middle = pickRandom(lastNames) || "Silva";
  const last = pickRandom(lastNames) || "Souza";
  const name = `${first} ${middle} ${last}`;

  let birthDate = isoDateOffset(-randomInt(18 * 365, 65 * 365));
  if (category === "child_followup") birthDate = isoDateOffset(-randomInt(3, 700));
  if (category === "elderly") birthDate = isoDateOffset(-randomInt(60 * 365, 90 * 365));

  const pregStart = isoDateOffset(-randomInt(35, 230));
  const usgWeeks = randomInt(6, 24);
  const usgDays = randomInt(0, 6);
  const usgDate1 = isoDateOffset(-randomInt(10, 80));
  const expectedDelivery = isoDateOffset(randomInt(15, 120));

  return {
    id: uuidv4(),
    teamId,
    incompleteProfile: Boolean(incomplete),
    name,
    motherName: category === "child_followup" ? `${pickRandom(firstNames)} ${pickRandom(lastNames)}` : "",
    cpf: incomplete && chance(65) ? "" : makeDigits(11),
    cns: incomplete && chance(60) ? "" : makeDigits(15),
    cnsCpf: "",
    address: incomplete && chance(55)
      ? ""
      : `${pickRandom(streets)}, ${randomInt(10, 999)} - ${pickRandom(districts)}, ${pickRandom(cities)} - ${pickRandom(ufs)}`,
    phone: incomplete && chance(35) ? "" : makePhone(),
    phoneAlt: chance(30) ? makePhone() : "",
    microArea: "",
    assignedAcsId: acsId,
    careCategory: category,
    chronicConditions: chance(28)
      ? (chance(35) ? ["hypertension"] : (chance(55) ? ["diabetes"] : ["diabetes", "hypertension"]))
      : [],
    maritalStatus: category === "child_followup" ? "" : pickRandom(["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"]),
    sexAtBirth: pickRandom(["female", "male"]),
    genderIdentity: "",
    birthDate,
    pregnancyStartDate: category === "pregnant" ? pregStart : "",
    expectedDeliveryDate: category === "pregnant" ? expectedDelivery : "",
    gestationalAgeDumWeeks: category === "pregnant" ? randomInt(8, 38) : "",
    gestationalAgeDumDays: category === "pregnant" ? randomInt(0, 6) : "",
    gestationalAgeUsgWeeks: category === "pregnant" ? usgWeeks : "",
    gestationalAgeUsgDays: category === "pregnant" ? usgDays : "",
    usgDate1: category === "pregnant" ? usgDate1 : "",
    usgDate2: category === "pregnant" && chance(50) ? isoDateOffset(-randomInt(5, 35)) : "",
    usgDate3: category === "pregnant" && chance(25) ? isoDateOffset(-randomInt(1, 12)) : "",
    prenatalStartDate: category === "pregnant" ? isoDateOffset(-randomInt(20, 150)) : "",
    postpartumStartDate: category === "puerperal" ? isoDateOffset(-randomInt(1, 38)) : "",
    comorbidities: chance(22) ? "Acompanhamento de condição crônica." : "",
    medications: chance(38) ? "Uso contínuo conforme prescrição." : "",
    allergies: chance(15) ? "Alergia relatada a dipirona." : "",
    createdAt: new Date().toISOString(),
    createdBy: "seed-system"
  };
}

function buildSeedClinicalRecords(patient, template, bucket = "progress", staffUsers = []) {
  const items = [];
  const staff = pickRandom(staffUsers);
  const createdBy = staff?.id || "seed-system";
  const protocolTag = patient.careCategory;
  const targets = template?.targets || { visits: 0, consultations: 0, vaccines: 0 };
  const vaccines = Array.isArray(template?.vaccines) ? template.vaccines : [];

  const visitDone = bucket === "ok"
    ? targets.visits
    : (bucket === "critical" ? Math.min(1, targets.visits) : Math.max(1, Math.floor(targets.visits * 0.5)));
  const consultDone = bucket === "ok"
    ? targets.consultations
    : (bucket === "critical" ? Math.min(1, targets.consultations) : Math.max(1, Math.floor(targets.consultations * 0.45)));
  const vaccineDone = bucket === "ok"
    ? Math.min(targets.vaccines, Math.max(1, vaccines.length))
    : (bucket === "critical" ? 0 : Math.max(0, Math.floor(targets.vaccines * 0.35)));

  for (let i = 0; i < visitDone; i += 1) {
    items.push({
      id: uuidv4(),
      patientId: patient.id,
      type: "visit",
      title: "Visita ACS",
      details: "Visita domiciliar de rotina registrada no território.",
      date: isoDateOffset(-randomInt(2, bucket === "critical" ? 160 : 70)),
      protocolTag,
      metadata: {},
      createdBy,
      createdAt: new Date().toISOString()
    });
  }

  for (let i = 0; i < consultDone; i += 1) {
    const specialty = chance(20) ? "dental" : (chance(45) ? "medical" : "nursing");
    const title = specialty === "medical"
      ? "Consulta médica"
      : (specialty === "nursing" ? "Consulta de enfermagem" : "Consulta odontológica");
    items.push({
      id: uuidv4(),
      patientId: patient.id,
      type: "consultation",
      title,
      details: "Consulta registrada para acompanhamento clínico.",
      date: isoDateOffset(-randomInt(1, bucket === "critical" ? 180 : 80)),
      protocolTag,
      metadata: { specialty },
      createdBy,
      createdAt: new Date().toISOString()
    });
  }

  for (let i = 0; i < vaccineDone; i += 1) {
    const vacName = vaccines[i % Math.max(vaccines.length, 1)] || "Influenza";
    items.push({
      id: uuidv4(),
      patientId: patient.id,
      type: "vaccine",
      title: vacName,
      details: `Aplicação de ${vacName}.`,
      date: isoDateOffset(-randomInt(1, 200)),
      protocolTag,
      metadata: {},
      createdBy,
      createdAt: new Date().toISOString()
    });
  }

  if (chance(30)) {
    items.push({
      id: uuidv4(),
      patientId: patient.id,
      type: "procedure",
      title: "Procedimento registrado",
      details: "Procedimento clínico com evolução favorável.",
      date: isoDateOffset(-randomInt(1, 120)),
      protocolTag,
      metadata: {},
      createdBy,
      createdAt: new Date().toISOString()
    });
  }

  return items;
}

function buildSeedAppointments(patient, createdBy = "seed-system") {
  const total = randomInt(0, 4);
  const list = [];
  for (let i = 0; i < total; i += 1) {
    list.push({
      id: uuidv4(),
      patientId: patient.id,
      date: isoDateOffset(-randomInt(0, 120)),
      summary: "Atendimento ambulatorial",
      demandType: chance(65) ? "scheduled" : "spontaneous",
      conduct: "Conduta registrada no atendimento.",
      nextStep: chance(55) ? "Retorno agendado." : "",
      createdBy,
      createdAt: new Date().toISOString()
    });
  }
  return list;
}

function buildSeedMessages(patient, users = []) {
  if (!chance(35)) return [];
  const author = pickRandom(users);
  return [{
    id: uuidv4(),
    patientId: patient.id,
    text: "Orientação de acompanhamento registrada para a equipe.",
    createdBy: author?.id || "seed-system",
    createdByName: author?.name || "Sistema",
    createdAt: new Date().toISOString()
  }];
}

function buildSeedTasks(patient, acsIds = [], createdBy = "seed-system") {
  const assigneeId = pickRandom(acsIds);
  if (!assigneeId || !chance(45)) return [];
  const status = pickRandom(["pending", "pending", "in_progress", "done"]) || "pending";
  return [{
    id: uuidv4(),
    patientId: patient.id,
    assigneeId,
    title: "Contato ativo com paciente",
    notes: "Registrar retorno no sistema.",
    status,
    dueDate: status === "done" ? isoDateOffset(-randomInt(1, 15)) : isoDateOffset(randomInt(-5, 15)),
    createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }];
}

export {
  randomInt,
  pickRandom,
  chance,
  isoDateOffset,
  makeDigits,
  makePhone,
  normalizeSeedCategory,
  buildSeedPatient,
  buildSeedClinicalRecords,
  buildSeedAppointments,
  buildSeedMessages,
  buildSeedTasks
};
