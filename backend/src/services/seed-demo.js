import { withDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { hashPassword } from "./crypto.js";
import { backfillFamilyGroups } from "../utils/family-groups.js";
import { logInfo, logWarn } from "../utils/logger.js";

const TEAM_ID = "team-rosa";
const TEAM_NAME = "Equipe Rosa";
const BREAKGLASS_ID = "seed-user-joao";
const BREAKGLASS_NAME = "Break Glass Admin";
const BREAKGLASS_EMAIL = "breakglass@vitras.com.br";
const DRA_ID = "seed-user-dra";
const ACS_ID = "seed-user-acs";
const ENF_ID = "seed-user-enf";
const DENT_ID = "seed-user-dent";

function upsert(arr, item) {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
}

function hasId(arr, id) { return arr.some((x) => x.id === id); }

// Break glass admin is an operational emergency account, not a demo user.
// Never overwrite a hardened password or identity — only update safe operational fields.
function upsertBreakGlassUser(db) {
  const idx = db.users.findIndex((u) => u.id === BREAKGLASS_ID);
  if (idx >= 0) {
    db.users[idx] = {
      ...db.users[idx],
      name: BREAKGLASS_NAME,
      email: BREAKGLASS_EMAIL,
      role: "break_glass_admin",
      teamId: TEAM_ID,
      teamName: TEAM_NAME,
      unitId: UNIT_ID,
      municipalityId: MUNICIPALITY_ID,
    };
    return;
  }

  const envHash = process.env.BREAKGLASS_PASSWORD_HASH;
  if (!envHash) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SEED_DEMO: BREAKGLASS_PASSWORD_HASH not set — refusing to create break_glass_admin with a weak default in production"
      );
    }
    logWarn("seed_demo_breakglass_dev_fallback", {
      event: "seed_demo_breakglass_dev_fallback",
      message: "BREAKGLASS_PASSWORD_HASH not set — using Demo@2026 fallback (dev/test only, never use in production)"
    });
  }

  const baseFields = {
    councilType: "", councilNumber: "", councilUf: "",
    twoFactorEnabled: false, twoFactorSecret: "",
    twoFactorPendingSecret: "", twoFactorPendingCreatedAt: "",
    lastLoginAt: "", lastSeenAt: "", lastSeenIp: "",
    createdAt: tsAgo(180), updatedAt: NOW,
  };
  db.users.push({
    ...baseFields,
    id: BREAKGLASS_ID,
    name: BREAKGLASS_NAME,
    email: BREAKGLASS_EMAIL,
    role: "break_glass_admin",
    teamId: TEAM_ID,
    teamName: TEAM_NAME,
    unitId: UNIT_ID,
    municipalityId: MUNICIPALITY_ID,
    password: envHash || hashPassword("Demo@2026"),
  });
}

function dAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}
function dAhead(n) {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}
function tsAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString();
}

const NOW = new Date().toISOString();

// ── Pharmacy ──────────────────────────────────────────────────────────────────
const PHARMACY_ITEMS = [
  { key: "seed-pharm-01", name: "Paracetamol 500mg",        category: "Analgésico",       unit: "comprimido", qty: 1200, minQty: 200, location: "Prateleira A1" },
  { key: "seed-pharm-02", name: "Dipirona 500mg",           category: "Analgésico",       unit: "comprimido", qty: 800,  minQty: 150, location: "Prateleira A1" },
  { key: "seed-pharm-03", name: "Ibuprofeno 600mg",         category: "Anti-inflamatorio",unit: "comprimido", qty: 500,  minQty: 100, location: "Prateleira A2" },
  { key: "seed-pharm-04", name: "Amoxicilina 500mg",        category: "Antibiotico",      unit: "capsula",    qty: 400,  minQty: 80,  location: "Prateleira B1" },
  { key: "seed-pharm-05", name: "Enalapril 10mg",           category: "Cardiovascular",   unit: "comprimido", qty: 900,  minQty: 200, location: "Prateleira C1" },
  { key: "seed-pharm-06", name: "Losartana 50mg",           category: "Cardiovascular",   unit: "comprimido", qty: 900,  minQty: 200, location: "Prateleira C1" },
  { key: "seed-pharm-07", name: "Metformina 850mg",         category: "Diabetes",         unit: "comprimido", qty: 1000, minQty: 200, location: "Prateleira D1" },
  { key: "seed-pharm-08", name: "Insulina NPH 100UI/mL",   category: "Diabetes",         unit: "frasco",     qty: 80,   minQty: 20,  location: "Geladeira G1" },
  { key: "seed-pharm-09", name: "Fluoxetina 20mg",          category: "Saude Mental",     unit: "comprimido", qty: 400,  minQty: 80,  location: "Prateleira E1" },
  { key: "seed-pharm-10", name: "Salbutamol spray 100mcg", category: "Respiratorio",     unit: "frasco",     qty: 60,   minQty: 15,  location: "Prateleira F1" },
  { key: "seed-pharm-11", name: "Sulfato Ferroso 40mg",     category: "Gestante",         unit: "comprimido", qty: 600,  minQty: 120, location: "Prateleira G2" },
  { key: "seed-pharm-12", name: "Omeprazol 20mg",           category: "Gastrointestinal", unit: "capsula",    qty: 500,  minQty: 100, location: "Prateleira A3" },
];

// ── Supplies ──────────────────────────────────────────────────────────────────
const SUPPLIES_ITEMS = [
  { id: "i01", name: "Atadura de Crepe 6 cm",                            category: "Curativo",      unit: "unidade",  maxQty: 30,  qty: 20  },
  { id: "i02", name: "Atadura de Crepe 10 cm",                           category: "Curativo",      unit: "unidade",  maxQty: 30,  qty: 15  },
  { id: "i07", name: "Clorexidina Degermante",                           category: "Antisseptico",  unit: "frasco",   maxQty: 3,   qty: 2   },
  { id: "i08", name: "Compressa Gaze",                                   category: "Curativo",      unit: "unidade",  maxQty: 180, qty: 120 },
  { id: "i09", name: "Esparadrapo Impermeavel P",                        category: "Curativo",      unit: "rolo",     maxQty: 4,   qty: 3   },
  { id: "i11", name: "Micropore Pequeno",                                category: "Curativo",      unit: "rolo",     maxQty: 4,   qty: 4   },
  { id: "i16", name: "Luva P (caixa 100 un)",                           category: "EPI",           unit: "caixa",    maxQty: 2,   qty: 2   },
  { id: "i17", name: "Luva M (caixa 100 un)",                           category: "EPI",           unit: "caixa",    maxQty: 2,   qty: 1   },
  { id: "i19", name: "Seringa 20 mL",                                    category: "Seringa",       unit: "unidade",  maxQty: 60,  qty: 40  },
  { id: "i38", name: "Tiras Reagentes Hemoanalise (cx 50 tiras)",       category: "Diabetes",      unit: "caixa",    maxQty: 100, qty: 60  },
  { id: "i39", name: "Micro Lancetas (cx 100 unidades)",                category: "Diabetes",      unit: "caixa",    maxQty: 2,   qty: 2   },
  { id: "i41", name: "Agulha para Caneta de Insulina",                  category: "Diabetes",      unit: "unidade",  maxQty: 30,  qty: 25  },
  { id: "i42", name: "Seringa 1 mL para Insulina",                      category: "Diabetes",      unit: "unidade",  maxQty: 60,  qty: 50  },
  { id: "i32", name: "Cloreto de Sodio 0,9% para Curativo 500 mL",     category: "Soro/Curativo", unit: "frasco",   maxQty: 10,  qty: 8   },
];

// ── Patient definitions ───────────────────────────────────────────────────────
// geral (18) · gestante (7) · puérpera (4) · criança (6) · idoso (6) = 41

const GENERAL_DEFS = [
  { idx: "g01", name: "Thiago de Oliveira Braga",   birthDate: "1988-08-23", sexAtBirth: "male",   cond: [],                           microArea: "MA-1", phone: "(11) 91111-0001", address: "Rua Henrique, 214",             cpf: "001.001.001-01", situation: "ok" },
  { idx: "g02", name: "Mariana Castro Ferreira",    birthDate: "1990-03-14", sexAtBirth: "female", cond: [],                           microArea: "MA-1", phone: "(11) 91111-0002", address: "Rua das Flores, 77",            cpf: "001.001.002-02", situation: "ok" },
  { idx: "g03", name: "Lucas Gabriel Santos",       birthDate: "1997-04-02", sexAtBirth: "male",   cond: [],                           microArea: "MA-1", phone: "(11) 91111-0003", address: "Rua Floresta, 4",               cpf: "001.001.003-03", situation: "nodata" },
  { idx: "g04", name: "Débora Vieira Matos",        birthDate: "1982-10-25", sexAtBirth: "female", cond: [],                           microArea: "MA-1", phone: "(11) 91111-0004", address: "Av. Brasil, 500",               cpf: "001.001.004-04", situation: "ok" },
  { idx: "g05", name: "Adriana Monteiro Pires",     birthDate: "1985-09-22", sexAtBirth: "female", cond: [],                           microArea: "MA-2", phone: "(11) 91111-0005", address: "Rua Clementina, 38",            cpf: "001.001.005-05", situation: "pap_pending" },
  { idx: "g06", name: "Cintia Almeida Rocha",       birthDate: "1979-06-11", sexAtBirth: "female", cond: [],                           microArea: "MA-2", phone: "(11) 91111-0006", address: "Rua Camargo, 71",               cpf: "001.001.006-06", situation: "pap_overdue" },
  { idx: "g07", name: "Roberto Alves Mendonça",     birthDate: "1972-05-19", sexAtBirth: "male",   cond: ["hypertension"],             microArea: "MA-2", phone: "(11) 91111-0007", address: "Rua Antônio Carlos, 99",        cpf: "001.001.007-07", situation: "chronic_ok" },
  { idx: "g08", name: "Sandra Lima Andrade",        birthDate: "1969-11-02", sexAtBirth: "female", cond: ["hypertension"],             microArea: "MA-2", phone: "(11) 91111-0008", address: "Rua do Horto, 7",               cpf: "001.001.008-08", situation: "chronic_critical" },
  { idx: "g09", name: "Paulo Henrique Braga",       birthDate: "1975-07-28", sexAtBirth: "male",   cond: ["diabetes"],                 microArea: "MA-3", phone: "(11) 91111-0009", address: "Av. das Nações, 210",           cpf: "001.001.009-09", situation: "chronic_ok" },
  { idx: "g10", name: "Vera Lúcia Santos Costa",    birthDate: "1978-12-07", sexAtBirth: "female", cond: ["diabetes"],                 microArea: "MA-3", phone: "(11) 91111-0010", address: "Rua Primavera, 64",             cpf: "001.001.010-10", situation: "delayed_exam" },
  { idx: "g11", name: "Francisco José Melo",        birthDate: "1964-04-15", sexAtBirth: "male",   cond: ["hypertension", "diabetes"], microArea: "MA-3", phone: "(11) 91111-0011", address: "Beco do Moinho, 13",            cpf: "001.001.011-11", situation: "chronic_critical" },
  { idx: "g12", name: "Edmundo Tavares Cunha",      birthDate: "1966-03-08", sexAtBirth: "male",   cond: ["hypertension", "diabetes"], microArea: "MA-3", phone: "(11) 91111-0012", address: "Rua Esperança, 29",             cpf: "001.001.012-12", situation: "chronic_ok" },
  { idx: "g13", name: "Patricia Ramos Coelho",      birthDate: "1983-08-05", sexAtBirth: "female", cond: [],                           microArea: "MA-4", phone: "(11) 91111-0013", address: "Rua Vilarinho, 155",            cpf: "001.001.013-13", situation: "pending_task" },
  { idx: "g14", name: "Marcelo Costa Barbosa",      birthDate: "1980-11-14", sexAtBirth: "male",   cond: [],                           microArea: "MA-4", phone: "(11) 91111-0014", address: "Av. Getúlio Vargas, 876",       cpf: "001.001.014-14", situation: "delayed_exam" },
  { idx: "g15", name: "Juliana Pereira Nogueira",   birthDate: "1987-02-28", sexAtBirth: "female", cond: [],                           microArea: "MA-4", phone: "(11) 91111-0015", address: "Rua Marechal, 47",              cpf: "001.001.015-15", situation: "recent_consult" },
  { idx: "g16", name: "Anderson Gomes Silva",       birthDate: "1993-01-30", sexAtBirth: "male",   cond: [],                           microArea: "MA-4", phone: "(11) 91111-0016", address: "Estrada da Serrinha, 300",      cpf: "001.001.016-16", situation: "incomplete", incompleteProfile: true },
  { idx: "g17", name: "Camila Ribeiro Fonseca",     birthDate: "1991-07-18", sexAtBirth: "female", cond: [],                           microArea: "MA-5", phone: "(11) 91111-0017", address: "Rua das Acácias, 142",          cpf: "001.001.017-17", situation: "with_message" },
  { idx: "g18", name: "Rafael Augusto Teixeira",    birthDate: "1990-05-30", sexAtBirth: "male",   cond: [],                           microArea: "MA-5", phone: "(11) 91111-0018", address: "Rua dos Ipês, 87",              cpf: "001.001.018-18", situation: "sporadic" },
];

const PREGNANT_DEFS = [
  { idx: "pg01", name: "Amanda Cristina Lopes",       birthDate: "1995-01-07", sexAtBirth: "female", microArea: "MA-5", phone: "(11) 92222-0001", address: "Rua das Violetas, 52",         cpf: "002.002.001-01", weeksGest: 8  },
  { idx: "pg02", name: "Juliana Meireles Costa",      birthDate: "1993-11-15", sexAtBirth: "female", microArea: "MA-5", phone: "(11) 92222-0002", address: "Rua Camargo, 71, apto 5",     cpf: "002.002.002-02", weeksGest: 16 },
  { idx: "pg03", name: "Fernanda Cristina Araújo",    birthDate: "1994-12-22", sexAtBirth: "female", microArea: "MA-6", phone: "(11) 92222-0003", address: "Rua Santos Dumont, 310",      cpf: "002.002.003-03", weeksGest: 24 },
  { idx: "pg04", name: "Ana Beatriz Ferreira Campos", birthDate: "1996-08-14", sexAtBirth: "female", microArea: "MA-6", phone: "(11) 92222-0004", address: "Av. das Flores, 200, apto 8", cpf: "002.002.004-04", weeksGest: 32 },
  { idx: "pg05", name: "Renata Souza Galvão",         birthDate: "1992-06-30", sexAtBirth: "female", microArea: "MA-6", phone: "(11) 92222-0005", address: "Rua Panorâmica, 19",          cpf: "002.002.005-05", weeksGest: 36 },
  { idx: "pg06", name: "Patrícia Vieira Moreira",     birthDate: "1989-04-05", sexAtBirth: "female", microArea: "MA-6", phone: "(11) 92222-0006", address: "Av. Principal, 450",          cpf: "002.002.006-06", weeksGest: 20 },
  { idx: "pg07", name: "Simone Aparecida Nunes",      birthDate: "1991-02-17", sexAtBirth: "female", microArea: "MA-5", phone: "(11) 92222-0007", address: "Rua do Cedro, 88",            cpf: "002.002.007-07", weeksGest: 28 },
];

const PUERPERAL_DEFS = [
  { idx: "pu01", name: "Camila Rodrigues Soares", birthDate: "1992-03-11", sexAtBirth: "female", microArea: "MA-7", phone: "(11) 93333-0001", address: "Rua das Acácias, 500",  cpf: "003.003.001-01", daysSinceBirth: 5  },
  { idx: "pu02", name: "Beatriz Alves Duarte",    birthDate: "1991-09-18", sexAtBirth: "female", microArea: "MA-7", phone: "(11) 93333-0002", address: "Rua do Sol, 127",       cpf: "003.003.002-02", daysSinceBirth: 15 },
  { idx: "pu03", name: "Claudia Mendes Rocha",    birthDate: "1993-03-22", sexAtBirth: "female", microArea: "MA-7", phone: "(11) 93333-0003", address: "Rua Dom Pedro II, 118", cpf: "003.003.003-03", daysSinceBirth: 30 },
  { idx: "pu04", name: "Vanessa Lima Cardoso",    birthDate: "1990-11-10", sexAtBirth: "female", microArea: "MA-7", phone: "(11) 93333-0004", address: "Rua Nova, 320",         cpf: "003.003.004-04", daysSinceBirth: 45 },
];

const CHILD_DEFS = [
  { idx: "ch01", name: "Miguel Oliveira Barbosa",  sexAtBirth: "male",   motherName: "Juliana Oliveira Barbosa",  microArea: "MA-8", phone: "(11) 94444-0001", address: "Rua Esperança, 74",       cpf: "004.004.001-01", ageInDays: 7   },
  { idx: "ch02", name: "Sofia Ramos Teixeira",     sexAtBirth: "female", motherName: "Patricia Ramos Teixeira",   microArea: "MA-8", phone: "(11) 94444-0002", address: "Av. das Flores, 200",     cpf: "004.004.002-02", ageInDays: 31  },
  { idx: "ch03", name: "Davi Lima Gonçalves",      sexAtBirth: "male",   motherName: "Renata Lima Gonçalves",     microArea: "MA-8", phone: "(11) 94444-0003", address: "Rua Boa Vista, 55",       cpf: "004.004.003-03", ageInDays: 62  },
  { idx: "ch04", name: "Larissa Costa Moura",      sexAtBirth: "female", motherName: "Fernanda Costa Moura",      microArea: "MA-8", phone: "(11) 94444-0004", address: "Rua das Mangueiras, 41",  cpf: "004.004.004-04", ageInDays: 122 },
  { idx: "ch05", name: "Gabriel Ferreira Santos",  sexAtBirth: "male",   motherName: "Cristina Ferreira Santos",  microArea: "MA-8", phone: "(11) 94444-0005", address: "Rua São João, 210",       cpf: "004.004.005-05", ageInDays: 182 },
  { idx: "ch06", name: "Isabella Nascimento Cruz", sexAtBirth: "female", motherName: "Leticia Nascimento Cruz",   microArea: "MA-8", phone: "(11) 94444-0006", address: "Travessa das Flores, 9",  cpf: "004.004.006-06", ageInDays: 365 },
];

const ELDERLY_DEFS = [
  { idx: "el01", name: "Rosa Maria da Silva Cunha",   birthDate: "1953-09-16", sexAtBirth: "female", cond: [],                           microArea: "MA-9", phone: "(11) 95555-0001", address: "Rua Esperança, 29",           cpf: "005.005.001-01" },
  { idx: "el02", name: "Silvio Roberto Araújo",        birthDate: "1945-05-20", sexAtBirth: "male",   cond: ["hypertension"],             microArea: "MA-9", phone: "(11) 95555-0002", address: "Rua Antônio Carlos, 99",      cpf: "005.005.002-02" },
  { idx: "el03", name: "João Carlos Oliveira Santos", birthDate: "1952-03-14", sexAtBirth: "male",   cond: ["hypertension", "diabetes"], microArea: "MA-9", phone: "(11) 95555-0003", address: "Rua das Acácias, 142, apto 3",cpf: "005.005.003-03" },
  { idx: "el04", name: "Maria das Graças Ferreira",   birthDate: "1948-07-22", sexAtBirth: "female", cond: ["hypertension", "diabetes"], microArea: "MA-9", phone: "(11) 95555-0004", address: "Rua dos Ipês, 87",            cpf: "005.005.004-04" },
  { idx: "el05", name: "Antônio Rodrigues da Silva",  birthDate: "1945-11-05", sexAtBirth: "male",   cond: ["hypertension"],             microArea: "MA-9", phone: "(11) 95555-0005", address: "Av. Principal, 1450, casa 2", cpf: "005.005.005-05" },
  { idx: "el06", name: "Luiza Fernanda Rocha",        birthDate: "1951-01-19", sexAtBirth: "female", cond: [],                           microArea: "MA-9", phone: "(11) 95555-0006", address: "Rua das Mangueiras, 41",      cpf: "005.005.006-06" },
];

// ── buildPatient ──────────────────────────────────────────────────────────────
const UNIT_ID = "unit-default";
const MUNICIPALITY_ID = "3534401";

function buildPatient(def, careCategory) {
  const chronicConditions = def.cond || [];
  const p = {
    id: `seed-p-${def.idx}`,
    teamId: TEAM_ID,
    unitId: UNIT_ID,
    municipalityId: MUNICIPALITY_ID,
    name: def.name,
    motherName: def.motherName || "",
    cpf: def.cpf,
    cns: "",
    cnsCpf: def.cpf,
    address: def.address,
    phone: def.phone,
    phoneAlt: "",
    microArea: def.microArea || "MA-1",
    assignedAcsId: ACS_ID,
    careCategory,
    chronicConditions,
    maritalStatus: "",
    incompleteProfile: def.incompleteProfile || false,
    inactive: false,
    inactivationReason: "",
    sexAtBirth: def.sexAtBirth,
    genderIdentity: "",
    birthDate: def.ageInDays != null ? dAgo(def.ageInDays) : def.birthDate,
    comorbidities: chronicConditions.length
      ? chronicConditions.map((c) => c === "hypertension" ? "Hipertensão Arterial" : "Diabetes Mellitus").join(", ")
      : "",
    medications: "",
    allergies: "",
    createdAt: tsAgo(180),
    createdBy: BREAKGLASS_ID,
    updatedAt: tsAgo(30),
    updatedBy: BREAKGLASS_ID,
  };

  if (def.weeksGest != null) {
    const gestDays = def.weeksGest * 7;
    p.pregnancyStartDate = dAgo(gestDays);
    p.expectedDeliveryDate = dAhead(280 - gestDays);
    p.gestationalAgeDumWeeks = def.weeksGest;
    p.gestationalAgeDumDays = 0;
  }

  return p;
}

// ── Main seed ─────────────────────────────────────────────────────────────────
export async function seedDemoTeamRosa() {
  if (process.env.SEED_DEMO_DATA !== "true") return { skipped: true };

  logInfo("seed_demo_start", { event: "seed_demo_start" });

  const stats = await withDb((db) => {
    ensureDbShape(db);

    // ── Clean old seed data (prefix-based, safe) ──────────────────────────
    const oldSeedCount = db.patients.filter((x) => x.id?.startsWith("seed-p-")).length;
    logInfo("seed_demo_removing_old", { event: "seed_demo_removing_old", oldSeedCount });
    db.patients          = db.patients.filter((x) => !x.id?.startsWith("seed-p-"));
    db.clinicalRecords   = db.clinicalRecords.filter((x) => !x.id?.startsWith("seed-rec-"));
    db.appointments      = db.appointments.filter((x) => !x.id?.startsWith("seed-appt-"));
    db.agendaEntries     = db.agendaEntries.filter((x) => !x.id?.startsWith("seed-ag-"));
    db.referrals         = db.referrals.filter((x) => !x.id?.startsWith("seed-ref-"));
    db.exams             = db.exams.filter((x) => !x.id?.startsWith("seed-exam-"));
    db.tasks             = db.tasks.filter((x) => !x.id?.startsWith("seed-task-"));
    db.messages          = db.messages.filter((x) => !x.id?.startsWith("seed-msg-"));
    if (!Array.isArray(db.notifications)) db.notifications = [];
    db.notifications     = db.notifications.filter((x) => !x.id?.startsWith("seed-notif-"));
    if (!Array.isArray(db.familyGroups)) db.familyGroups = [];
    db.familyGroups      = db.familyGroups.filter((x) => x.teamId !== TEAM_ID);
    if (!Array.isArray(db.labIntegrations)) db.labIntegrations = [];
    db.labIntegrations   = db.labIntegrations.filter((x) => !x.id?.startsWith("seed-labint-"));
    db.pharmacyLogs      = db.pharmacyLogs.filter((x) => !x.id?.startsWith("seed-pharma-log-"));
    db.suppliesLogs      = db.suppliesLogs.filter((x) => !x.id?.startsWith("seed-supply-log-"));
    db.suppliesContinuous= db.suppliesContinuous.filter((x) => !x.id?.startsWith("seed-cont-"));

    // ── Team ──────────────────────────────────────────────────────────────
    if (!db.teams.some((t) => t.id === TEAM_ID)) {
      db.teams.push({ id: TEAM_ID, name: TEAM_NAME, managerUserId: BREAKGLASS_ID, unitId: "unit-default", createdAt: NOW });
    }

    // ── Users ─────────────────────────────────────────────────────────────
    const baseUser = {
      councilType: "", councilNumber: "", councilUf: "",
      twoFactorEnabled: false, twoFactorSecret: "",
      twoFactorPendingSecret: "", twoFactorPendingCreatedAt: "",
      lastLoginAt: "", lastSeenAt: "", lastSeenIp: "",
      createdAt: tsAgo(180), updatedAt: NOW,
      unitId: UNIT_ID,
      municipalityId: MUNICIPALITY_ID,
    };

    upsertBreakGlassUser(db);
    upsert(db.users, { ...baseUser, id: DRA_ID,  name: "Dra. Maria Rosa",   email: "dra.rosa@vitras.com.br",    role: "doctor",            teamId: TEAM_ID, teamName: TEAM_NAME, password: hashPassword("Demo@2026"), councilType: "CRM",   councilNumber: "88001", councilUf: "SP" });
    upsert(db.users, { ...baseUser, id: ACS_ID,  name: "Lucas ACS",         email: "lucas.acs@vitras.com.br",   role: "acs",               teamId: TEAM_ID, teamName: TEAM_NAME, password: hashPassword("Demo@2026") });
    upsert(db.users, { ...baseUser, id: ENF_ID,  name: "Enf. Patrícia Lima",email: "patricia.enf@vitras.com.br",role: "nurse_manager",     teamId: TEAM_ID, teamName: TEAM_NAME, password: hashPassword("Demo@2026"), councilType: "COREN", councilNumber: "12345", councilUf: "SP" });
    upsert(db.users, { ...baseUser, id: DENT_ID, name: "Dr. Carlos Dental",  email: "carlos.dent@vitras.com.br", role: "doctor",            teamId: TEAM_ID, teamName: TEAM_NAME, password: hashPassword("Demo@2026"), councilType: "CRO",   councilNumber: "55001", councilUf: "SP" });

    // ── Patients ──────────────────────────────────────────────────────────
    logInfo("seed_demo_creating_patients", { event: "seed_demo_creating_patients" });
    for (const def of GENERAL_DEFS)   db.patients.push(buildPatient(def, "general"));
    for (const def of PREGNANT_DEFS)  db.patients.push(buildPatient(def, "pregnant"));
    for (const def of PUERPERAL_DEFS) db.patients.push(buildPatient(def, "puerperal"));
    for (const def of CHILD_DEFS)     db.patients.push(buildPatient(def, "child_followup"));
    for (const def of ELDERLY_DEFS)   db.patients.push(buildPatient(def, "elderly"));

    const seedPatients = db.patients.filter((p) => p.id?.startsWith("seed-p-"));
    const countCat = (cat) => seedPatients.filter((p) => p.careCategory === cat).length;
    logInfo("seed_demo_patients_created", {
      event: "seed_demo_patients_created",
      total: seedPatients.length,
      general: countCat("general"),
      pregnant: countCat("pregnant"),
      puerperal: countCat("puerperal"),
      child_followup: countCat("child_followup"),
      elderly: countCat("elderly")
    });

    // ── Clinical records ──────────────────────────────────────────────────
    const recs = [];

    // Helper
    const r = (id, patientIdx, type, title, details, date, protocolTag, createdBy, meta = {}) => ({
      id, patientId: `seed-p-${patientIdx}`, type, title, details, date, protocolTag,
      createdBy, metadata: meta, createdAt: `${date}T10:00:00.000Z`,
    });

    // — General —
    recs.push(r("seed-rec-g01-c1", "g01", "consultation", "Consulta Médica", "Paciente sem queixas. Exame físico dentro da normalidade. Orientações gerais.", dAgo(120), "general", DRA_ID));
    recs.push(r("seed-rec-g02-c1", "g02", "consultation", "Consulta Médica", "Paciente em bom estado geral. Orientações sobre estilo de vida.", dAgo(80), "general", DRA_ID));
    recs.push(r("seed-rec-g02-v1", "g02", "visit",        "Visita ACS",      "Visita domiciliar de rotina. Paciente bem, sem queixas.", dAgo(50), "general", ACS_ID));
    // g03: nodata — sem registros
    recs.push(r("seed-rec-g04-c1", "g04", "consultation", "Consulta Médica", "Retorno. Paciente refere bem-estar. Sem alterações.", dAgo(95), "general", DRA_ID));
    recs.push(r("seed-rec-g05-c1", "g05", "consultation", "Consulta Médica", "Consulta preventiva. Solicitado colpocitológico — coleta agendada.", dAgo(45), "general", DRA_ID));
    recs.push(r("seed-rec-g05-e1", "g05", "exam_request", "Pedido: Colpocitológico (Papanicolau)", "Coleta agendada na UBS. Paciente orientada.", dAgo(45), "general", DRA_ID));
    recs.push(r("seed-rec-g06-c1", "g06", "consultation", "Consulta Médica", "Consulta preventiva anual. Paciente nega queixas atuais.", dAgo(180), "general", DRA_ID));
    recs.push(r("seed-rec-g07-c1", "g07", "consultation", "Consulta Médica — HAS", "PA 135/85. Losartana 50mg em uso regular. Controle satisfatório.", dAgo(90), "general", DRA_ID));
    recs.push(r("seed-rec-g07-c2", "g07", "consultation", "Retorno — HAS", "PA 130/80. Paciente aderente à medicação. Manter conduta.", dAgo(30), "general", DRA_ID));
    recs.push(r("seed-rec-g07-v1", "g07", "visit", "Visita ACS", "Verificação de adesão ao tratamento anti-hipertensivo. Paciente em uso correto.", dAgo(60), "general", ACS_ID));
    recs.push(r("seed-rec-g08-c1", "g08", "consultation", "Consulta Médica — HAS", "PA 175/105. Ajuste de medicação. Enalapril 20mg adicionado. Solicitado ECG.", dAgo(20), "general", DRA_ID));
    recs.push(r("seed-rec-g09-c1", "g09", "consultation", "Consulta Médica — DM", "Glicemia jejum 108 mg/dL. Metformina em uso. Bom controle glicêmico.", dAgo(90), "general", DRA_ID));
    recs.push(r("seed-rec-g09-c2", "g09", "consultation", "Retorno — DM", "HbA1c 6,8%. Controle adequado. Orientações sobre dieta.", dAgo(30), "general", DRA_ID));
    recs.push(r("seed-rec-g10-c1", "g10", "consultation", "Consulta Médica — DM", "Glicemia jejum 180 mg/dL. Solicitado HbA1c + painel metabólico. Retorno pendente.", dAgo(100), "general", DRA_ID));
    recs.push(r("seed-rec-g10-e1", "g10", "exam_request", "Pedido: HbA1c + Glicemia + Painel Metabólico", "Exames solicitados em consulta. Resultado não retornou.", dAgo(100), "general", DRA_ID));
    recs.push(r("seed-rec-g11-c1", "g11", "consultation", "Consulta Médica — HAS + DM", "PA 168/98, Glicemia 220 mg/dL. Controle inadequado. Ajuste de dose. Encaminhamento cardiologia.", dAgo(15), "general", DRA_ID));
    recs.push(r("seed-rec-g12-c1", "g12", "consultation", "Consulta Médica — HAS + DM", "PA 130/80, HbA1c 7,1%. Boa adesão ao tratamento. Manter conduta.", dAgo(75), "general", DRA_ID));
    recs.push(r("seed-rec-g12-c2", "g12", "consultation", "Retorno — HAS + DM", "Paciente estável. Exames laboratoriais normalizados. Retorno em 90 dias.", dAgo(15), "general", DRA_ID));
    recs.push(r("seed-rec-g13-c1", "g13", "consultation", "Consulta Médica", "Queixa de tosse persistente > 3 semanas. Encaminhamento ambulatório pneumologia solicitado.", dAgo(30), "general", DRA_ID));
    recs.push(r("seed-rec-g14-c1", "g14", "consultation", "Consulta Médica", "Queixa de fadiga. Solicitado hemograma completo. Retorno aguardado.", dAgo(120), "general", DRA_ID));
    recs.push(r("seed-rec-g14-e1", "g14", "exam_request", "Pedido: Hemograma Completo + TSH", "Exames solicitados. Não há resultado registrado.", dAgo(120), "general", DRA_ID));
    recs.push(r("seed-rec-g15-c1", "g15", "consultation", "Consulta Médica", "Consulta de rotina. Paciente sem queixas. Exame físico normal.", dAgo(3), "general", DRA_ID));
    // g16: incompleteProfile — sem registros
    recs.push(r("seed-rec-g17-c1", "g17", "consultation", "Consulta Médica", "Retorno de queixa gastrointestinal. Melhora do quadro com Omeprazol. Orientações.", dAgo(30), "general", DRA_ID));
    recs.push(r("seed-rec-g18-c1", "g18", "consultation", "Consulta Médica", "Única consulta registrada. Paciente refere não ter problemas de saúde.", dAgo(400), "general", DRA_ID));

    // — Gestantes —
    // pg01 — 8 semanas (1ª consulta)
    recs.push(r("seed-rec-pg01-c1", "pg01", "consultation", "1ª Consulta Pré-natal", "8ª semana gestacional. Painel pré-natal solicitado. Ácido fólico + Sulfato Ferroso prescritos. Carteira da gestante entregue.", dAgo(56), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg01-v1", "pg01", "visit", "Visita ACS — Gestante", "Primeira visita puerperal. Orientações sobre pré-natal e sinais de alerta.", dAgo(49), "pregnant", ACS_ID));

    // pg02 — 16 semanas
    recs.push(r("seed-rec-pg02-c1", "pg02", "consultation", "1ª Consulta Pré-natal", "8ª semana. Painel solicitado. Ácido fólico prescrito. Boa aceitação da gestação.", dAgo(112), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg02-c2", "pg02", "consultation", "Pré-natal — 2ª consulta", "16ª semana. PA 110/70, peso 63 kg. Morfológico 1º tri normal. BCF 148bpm.", dAgo(56), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg02-v1", "pg02", "visit", "Visita ACS — Gestante", "Caderneta atualizada. Gestante realizando consultas regulares.", dAgo(45), "pregnant", ACS_ID));

    // pg03 — 24 semanas
    recs.push(r("seed-rec-pg03-c1", "pg03", "consultation", "1ª Consulta Pré-natal", "Captação na 8ª semana. Exames normais. Suplementação iniciada.", dAgo(168), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg03-c2", "pg03", "consultation", "Pré-natal — 2ª consulta", "16ª semana. Morfológico normal. Ganho de peso adequado.", dAgo(112), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg03-c3", "pg03", "consultation", "Pré-natal — 3ª consulta", "24ª semana. PA 112/72, AU 24cm, BCF 140bpm. TOTG normal. Movimentos fetais presentes.", dAgo(56), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg03-v1", "pg03", "visit", "Visita ACS — Gestante", "Orientações sobre sinais de alerta e cuidados no 2º trimestre.", dAgo(84), "pregnant", ACS_ID));
    recs.push(r("seed-rec-pg03-vac1", "pg03", "vaccine", "dTpa (gestante)", "Vacina antitetânica/pertussis aplicada. Sem intercorrências.", dAgo(70), "pregnant", ENF_ID, { vaccineName: "dTpa" }));

    // pg04 — 32 semanas
    recs.push(r("seed-rec-pg04-c1", "pg04", "consultation", "1ª Consulta Pré-natal", "8ª semana. Captação precoce. Exames normais.", dAgo(224), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg04-c2", "pg04", "consultation", "Pré-natal — 2ª consulta", "16ª semana. BCF 145bpm. Morfológico 1º tri normal.", dAgo(168), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg04-c3", "pg04", "consultation", "Pré-natal — 3ª consulta", "24ª semana. TOTG 92 mg/dL. Ganho ponderal adequado.", dAgo(112), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg04-c4", "pg04", "consultation", "Pré-natal — 4ª consulta", "32ª semana. PA 115/75, AU 32cm, BCF 138bpm. Morfológico 2º tri normal. Apresentação cefálica.", dAgo(56), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg04-v1", "pg04", "visit", "Visita ACS — Gestante", "Gestante orientada sobre plano de parto e sinais de trabalho de parto.", dAgo(140), "pregnant", ACS_ID));
    recs.push(r("seed-rec-pg04-v2", "pg04", "visit", "Visita ACS — Gestante", "Verificação de adesão ao pré-natal. Caderneta atualizada.", dAgo(70), "pregnant", ACS_ID));
    recs.push(r("seed-rec-pg04-vac1", "pg04", "vaccine", "dTpa (gestante)", "Aplicada sem intercorrências.", dAgo(84), "pregnant", ENF_ID, { vaccineName: "dTpa" }));
    recs.push(r("seed-rec-pg04-e1", "pg04", "exam_request", "Pedido: USG obstétrica + Doppler 3º tri", "Solicitada para avaliação de crescimento fetal e fluxo umbilical.", dAgo(56), "pregnant", DRA_ID));

    // pg05 — 36 semanas
    recs.push(r("seed-rec-pg05-c1", "pg05", "consultation", "1ª Consulta Pré-natal", "8ª semana. Boa saúde materna. Exames normais.", dAgo(252), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg05-c2", "pg05", "consultation", "Pré-natal — 2ª consulta", "16ª semana. Morfológico normal. Suplementação mantida.", dAgo(196), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg05-c3", "pg05", "consultation", "Pré-natal — 3ª consulta", "24ª semana. TOTG normal. Movimentos fetais ativos.", dAgo(140), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg05-c4", "pg05", "consultation", "Pré-natal — 4ª consulta", "32ª semana. Crescimento fetal adequado. Doppler normal.", dAgo(84), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg05-c5", "pg05", "consultation", "Pré-natal — 5ª consulta", "36ª semana. PA 118/76, AU 36cm, BCF 142bpm. Apresentação cefálica encaixada. Orientações sobre parto.", dAgo(28), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg05-v1", "pg05", "visit", "Visita ACS — Gestante", "Orientações sobre hospital de referência para o parto.", dAgo(168), "pregnant", ACS_ID));
    recs.push(r("seed-rec-pg05-v2", "pg05", "visit", "Visita ACS — Gestante", "Gestante em boas condições. Aguardando parto.", dAgo(21), "pregnant", ACS_ID));
    recs.push(r("seed-rec-pg05-vac1", "pg05", "vaccine", "dTpa (gestante)", "Aplicada na 28ª semana.", dAgo(112), "pregnant", ENF_ID, { vaccineName: "dTpa" }));
    recs.push(r("seed-rec-pg05-vac2", "pg05", "vaccine", "Influenza (gestante)", "Aplicada na 32ª semana.", dAgo(84), "pregnant", ENF_ID, { vaccineName: "Influenza" }));

    // pg06 — 20 semanas
    recs.push(r("seed-rec-pg06-c1", "pg06", "consultation", "1ª Consulta Pré-natal", "8ª semana. Exames solicitados. Suplementação iniciada.", dAgo(140), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg06-c2", "pg06", "consultation", "Pré-natal — 2ª consulta", "20ª semana. Morfológico de 2º trimestre solicitado. BCF 144bpm. Exames normais.", dAgo(56), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg06-v1", "pg06", "visit", "Visita ACS — Gestante", "Visita domiciliar. Gestante sem queixas. Caderneta em dia.", dAgo(70), "pregnant", ACS_ID));

    // pg07 — 28 semanas, apenas 1 consulta (mínimo PNAB para IG≥26s = 3) → dispara alerta de perda de indicador
    recs.push(r("seed-rec-pg07-c1", "pg07", "consultation", "1ª Consulta Pré-natal", "Captação tardia na 16ª semana. Exames solicitados. Ácido fólico + Sulfato Ferroso prescritos. Orientada sobre importância do pré-natal regular.", dAgo(112), "pregnant", DRA_ID));
    recs.push(r("seed-rec-pg07-v1", "pg07", "visit", "Visita ACS — Gestante", "Visita domiciliar. Gestante faltou às consultas marcadas. Reorientada sobre importância do acompanhamento.", dAgo(30), "pregnant", ACS_ID));

    // — Puérperas —
    // pu01 — 5 dias
    recs.push(r("seed-rec-pu01-c1", "pu01", "consultation", "Consulta Puerperal — 1ª semana", "Parto vaginal há 5 dias. Lóquios normais. Amamentação estabelecida. Coto umbilical íntegro.", dAgo(3), "puerperal", ENF_ID));
    recs.push(r("seed-rec-pu01-v1", "pu01", "visit", "Visita ACS — Puerpério imediato", "Visita no 2º dia pós-alta. Mãe e bebê bem. Orientações sobre cuidados neonatais.", dAgo(4), "puerperal", ACS_ID));

    // pu02 — 15 dias
    recs.push(r("seed-rec-pu02-c1", "pu02", "consultation", "Consulta Puerperal — 1ª semana", "Puérpera com boa evolução. Amamentação exclusiva. Lóquios normais.", dAgo(12), "puerperal", ENF_ID));
    recs.push(r("seed-rec-pu02-c2", "pu02", "consultation", "Consulta Puerperal — 2ª semana", "Mama bem. Feito preventivo de IM 48h. Bebê com ganho adequado de peso.", dAgo(5), "puerperal", DRA_ID));
    recs.push(r("seed-rec-pu02-v1", "pu02", "visit", "Visita ACS — Puerpério", "Visita puerperal. Amamentação exclusiva confirmada. Ambiente adequado.", dAgo(10), "puerperal", ACS_ID));

    // pu03 — 30 dias
    recs.push(r("seed-rec-pu03-c1", "pu03", "consultation", "Consulta Puerperal — 1ª semana", "Parto cesáreo há 30 dias. Cicatriz cicatrizando. Amamentação exclusiva.", dAgo(28), "puerperal", DRA_ID));
    recs.push(r("seed-rec-pu03-c2", "pu03", "consultation", "Consulta Puerperal — 30 dias", "Boa evolução. Retorno ao planejamento familiar discutido. Sem queixas.", dAgo(1), "puerperal", DRA_ID));
    recs.push(r("seed-rec-pu03-v1", "pu03", "visit", "Visita ACS — Puerpério", "Mãe e bebê bem. Amamentação exclusiva mantida. Caderneta do bebê em dia.", dAgo(20), "puerperal", ACS_ID));
    recs.push(r("seed-rec-pu03-v2", "pu03", "visit", "Visita ACS — Puerpério", "Confirmação de consulta pediátrica agendada. Vacinação do RN verificada.", dAgo(8), "puerperal", ACS_ID));

    // pu04 — 45 dias
    recs.push(r("seed-rec-pu04-c1", "pu04", "consultation", "Consulta Puerperal — 1ª semana", "Parto vaginal sem intercorrências. Puerpério imediato normal.", dAgo(42), "puerperal", ENF_ID));
    recs.push(r("seed-rec-pu04-c2", "pu04", "consultation", "Consulta Puerperal — 15 dias", "Boa evolução. Amamentação exclusiva. Orientações sobre anticoncepção.", dAgo(28), "puerperal", DRA_ID));
    recs.push(r("seed-rec-pu04-c3", "pu04", "consultation", "Consulta Puerperal — 45 dias", "Alta do puerpério. Planejamento familiar iniciado. Bebê saudável.", dAgo(1), "puerperal", DRA_ID));
    recs.push(r("seed-rec-pu04-v1", "pu04", "visit", "Visita ACS — Puerpério", "Visita no puerpério imediato. Ambiente domiciliar adequado.", dAgo(38), "puerperal", ACS_ID));
    recs.push(r("seed-rec-pu04-v2", "pu04", "visit", "Visita ACS — Puerpério tardio", "Mãe em boas condições. Amamentação exclusiva confirmada.", dAgo(15), "puerperal", ACS_ID));

    // — Crianças —
    // ch01 — 7 dias
    recs.push(r("seed-rec-ch01-c1", "ch01", "consultation", "Puericultura — 1ª semana de vida", "RN com 7 dias. Peso 3.250g, comprimento 50cm. Triagem neonatal solicitada. Amamentação exclusiva. Reflexos normais.", dAgo(5), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch01-v1", "ch01", "visit", "Visita ACS — RN", "Visita puerperal. Bebê bem. Mãe orientada sobre cuidados e coto umbilical.", dAgo(6), "child_followup", ACS_ID));
    recs.push(r("seed-rec-ch01-vac1", "ch01", "vaccine", "BCG + Hepatite B (ao nascer)", "Aplicadas na maternidade sem intercorrências.", dAgo(7), "child_followup", ENF_ID, { vaccineName: "BCG + Hepatite B" }));

    // ch02 — 31 dias
    recs.push(r("seed-rec-ch02-c1", "ch02", "consultation", "Puericultura — 1ª semana de vida", "Peso 3.100g. Amamentação exclusiva. BCG aplicada. Triagem neonatal colhida.", dAgo(28), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch02-c2", "ch02", "consultation", "Puericultura — 1 mês", "Peso 4.200g. Ganho adequado. Sorriso social presente. Reflexos normais.", dAgo(1), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch02-v1", "ch02", "visit", "Visita ACS — RN/1 mês", "Bebê saudável. Mãe orientada sobre vacinas dos 2 meses.", dAgo(14), "child_followup", ACS_ID));
    recs.push(r("seed-rec-ch02-vac1", "ch02", "vaccine", "BCG + Hepatite B (ao nascer)", "Aplicadas na maternidade.", dAgo(31), "child_followup", ENF_ID, { vaccineName: "BCG + Hepatite B" }));

    // ch03 — 62 dias
    recs.push(r("seed-rec-ch03-c1", "ch03", "consultation", "Puericultura — 1ª semana", "Peso 3.400g. Amamentação exclusiva. Triagem neonatal normal.", dAgo(59), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch03-c2", "ch03", "consultation", "Puericultura — 2 meses", "Peso 5.100g, comprimento 58cm. Vacinas 2 meses aplicadas. Desenvolvimento adequado.", dAgo(2), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch03-v1", "ch03", "visit", "Visita ACS — acompanhamento", "Bebê saudável. Verificada caderneta de vacinas.", dAgo(20), "child_followup", ACS_ID));
    recs.push(r("seed-rec-ch03-vac1", "ch03", "vaccine", "BCG + Hepatite B (ao nascer)", "Aplicadas na maternidade.", dAgo(62), "child_followup", ENF_ID, { vaccineName: "BCG + Hepatite B" }));
    recs.push(r("seed-rec-ch03-vac2", "ch03", "vaccine", "Vacinas 2 meses: Penta + VIP + Pneumo + Rota", "Penta 1ª, VIP 1ª, Pneumo 10 1ª, Rotavírus 1ª. Sem intercorrências.", dAgo(2), "child_followup", ENF_ID, { vaccineName: "Penta+VIP+Pneumo+Rota 1ª dose" }));

    // ch04 — 122 dias (4 meses)
    recs.push(r("seed-rec-ch04-c1", "ch04", "consultation", "Puericultura — 1ª semana", "RN 3.600g. Triagem normal. Amamentação exclusiva.", dAgo(119), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch04-c2", "ch04", "consultation", "Puericultura — 1 mês",     "Peso 4.500g. Crescimento adequado. Reflexos normais.", dAgo(91), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch04-c3", "ch04", "consultation", "Puericultura — 4 meses",   "Peso 6.700g, comprimento 63cm. Vacinas 4 meses. Desenvolvimento normal. Introdução alimentar orientada para 6 meses.", dAgo(2), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch04-v1", "ch04", "visit", "Visita ACS — acompanhamento", "Verificação de caderneta e caderneta de vacinação.", dAgo(60), "child_followup", ACS_ID));
    recs.push(r("seed-rec-ch04-v2", "ch04", "visit", "Visita ACS — acompanhamento", "Criança com ganho adequado. Mãe orientada.", dAgo(15), "child_followup", ACS_ID));
    recs.push(r("seed-rec-ch04-vac1", "ch04", "vaccine", "BCG + Hepatite B", "Ao nascer — maternidade.", dAgo(122), "child_followup", ENF_ID, { vaccineName: "BCG + Hepatite B" }));
    recs.push(r("seed-rec-ch04-vac2", "ch04", "vaccine", "Vacinas 2 meses: Penta + VIP + Pneumo + Rota", "1ª dose. Sem intercorrências.", dAgo(62), "child_followup", ENF_ID, { vaccineName: "Penta+VIP+Pneumo+Rota 1ª dose" }));
    recs.push(r("seed-rec-ch04-vac3", "ch04", "vaccine", "Vacinas 4 meses: Penta + VIP + Pneumo + Rota", "2ª dose. Sem intercorrências.", dAgo(2), "child_followup", ENF_ID, { vaccineName: "Penta+VIP+Pneumo+Rota 2ª dose" }));

    // ch05 — 182 dias (6 meses)
    recs.push(r("seed-rec-ch05-c1", "ch05", "consultation", "Puericultura — 1ª semana", "Peso 3.200g. Amamentação exclusiva. Triagem normal.", dAgo(179), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch05-c2", "ch05", "consultation", "Puericultura — 1 mês",     "Peso 4.100g. Desenvolvimento adequado.", dAgo(151), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch05-c3", "ch05", "consultation", "Puericultura — 2 meses",   "Vacinas aplicadas. Peso 5.300g.", dAgo(122), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch05-c4", "ch05", "consultation", "Puericultura — 4 meses",   "Peso 6.900g. Vacinas 4 meses. Desenvolvimento normal.", dAgo(62), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch05-c5", "ch05", "consultation", "Puericultura — 6 meses",   "Peso 7.800g, comprimento 67cm. Introdução alimentar iniciada. Vacinas 6 meses aplicadas.", dAgo(2), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch05-v1", "ch05", "visit", "Visita ACS — RN", "Visita puerperal. Ambiente adequado.", dAgo(175), "child_followup", ACS_ID));
    recs.push(r("seed-rec-ch05-v2", "ch05", "visit", "Visita ACS — acompanhamento 6m", "Criança saudável. Orientações sobre alimentação complementar.", dAgo(5), "child_followup", ACS_ID));
    recs.push(r("seed-rec-ch05-vac1", "ch05", "vaccine", "BCG + Hepatite B", "Ao nascer.", dAgo(182), "child_followup", ENF_ID, { vaccineName: "BCG + Hepatite B" }));
    recs.push(r("seed-rec-ch05-vac2", "ch05", "vaccine", "Vacinas 2 meses: Penta + VIP + Pneumo + Rota", "1ª dose.", dAgo(122), "child_followup", ENF_ID, { vaccineName: "Penta+VIP+Pneumo+Rota 1ª dose" }));
    recs.push(r("seed-rec-ch05-vac3", "ch05", "vaccine", "Vacinas 4 meses: Penta + VIP + Pneumo + Rota", "2ª dose.", dAgo(62), "child_followup", ENF_ID, { vaccineName: "Penta+VIP+Pneumo+Rota 2ª dose" }));
    recs.push(r("seed-rec-ch05-vac4", "ch05", "vaccine", "Vacinas 6 meses: Penta + VIP + Pneumo + Influenza", "3ª dose Penta/VIP, 3ª Pneumo, Influenza 1ª dose.", dAgo(2), "child_followup", ENF_ID, { vaccineName: "Penta+VIP+Pneumo 3ª + Influenza" }));

    // ch06 — 365 dias (1 ano)
    recs.push(r("seed-rec-ch06-c1", "ch06", "consultation", "Puericultura — 1ª semana",  "Peso 3.500g. Amamentação exclusiva.", dAgo(362), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch06-c2", "ch06", "consultation", "Puericultura — 1 mês",      "Peso 4.400g. Reflexos normais.", dAgo(334), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch06-c3", "ch06", "consultation", "Puericultura — 2 meses",    "Vacinas 2m. Peso 5.600g.", dAgo(305), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch06-c4", "ch06", "consultation", "Puericultura — 4 meses",    "Vacinas 4m. Peso 7.100g. Desenvolvimento motor adequado.", dAgo(245), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch06-c5", "ch06", "consultation", "Puericultura — 6 meses",    "Introdução alimentar. Vacinas 6m. Peso 8.100g.", dAgo(185), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch06-c6", "ch06", "consultation", "Puericultura — 12 meses",   "Peso 9.800g, comprimento 75cm. Andando com apoio. Vacinas 12 meses. Desenvolvimento adequado.", dAgo(2), "child_followup", DRA_ID));
    recs.push(r("seed-rec-ch06-v1", "ch06", "visit", "Visita ACS — RN", "Visita puerperal.", dAgo(360), "child_followup", ACS_ID));
    recs.push(r("seed-rec-ch06-v2", "ch06", "visit", "Visita ACS — 12 meses", "Criança com desenvolvimento adequado. Mãe orientada sobre alimentação.", dAgo(10), "child_followup", ACS_ID));
    recs.push(r("seed-rec-ch06-vac1", "ch06", "vaccine", "BCG + Hepatite B", "Ao nascer.", dAgo(365), "child_followup", ENF_ID, { vaccineName: "BCG + Hepatite B" }));
    recs.push(r("seed-rec-ch06-vac2", "ch06", "vaccine", "Vacinas 2 meses",  "Penta+VIP+Pneumo+Rota 1ª.", dAgo(305), "child_followup", ENF_ID, { vaccineName: "Penta+VIP+Pneumo+Rota 1ª" }));
    recs.push(r("seed-rec-ch06-vac3", "ch06", "vaccine", "Vacinas 4 meses",  "2ª dose.", dAgo(245), "child_followup", ENF_ID, { vaccineName: "Penta+VIP+Pneumo+Rota 2ª" }));
    recs.push(r("seed-rec-ch06-vac4", "ch06", "vaccine", "Vacinas 6 meses",  "3ª dose + Influenza.", dAgo(185), "child_followup", ENF_ID, { vaccineName: "Penta+VIP+Pneumo 3ª + Influenza" }));
    recs.push(r("seed-rec-ch06-vac5", "ch06", "vaccine", "Vacinas 12 meses: SCR + VPC10 + VRH + Influenza", "Sarampo/Caxumba/Rubéola, Pneumocócica 10 reforço, Rotavírus reforço, Influenza.", dAgo(2), "child_followup", ENF_ID, { vaccineName: "SCR + reforços 12m" }));

    // — Idosos —
    // el01 — sem condições crônicas
    recs.push(r("seed-rec-el01-c1", "el01", "consultation", "Avaliação Geriátrica", "Paciente em boas condições gerais. Cognição preservada. Autonomia funcional mantida. Sem polifarmácia.", dAgo(90), "elderly", DRA_ID));
    recs.push(r("seed-rec-el01-v1", "el01", "visit", "Visita ACS — Idoso", "Visita domiciliar. Condições habitacionais adequadas. Idosa ativa.", dAgo(60), "elderly", ACS_ID));

    // el02 — HAS
    recs.push(r("seed-rec-el02-c1", "el02", "consultation", "Consulta Idoso — HAS", "PA 145/90. Losartana 50mg em uso. Orientado sobre dieta hipossódica e atividade física.", dAgo(90), "elderly", DRA_ID));
    recs.push(r("seed-rec-el02-c2", "el02", "consultation", "Retorno — HAS", "PA 138/85. Melhora com ajuste de dose. Encaminhamento cardiologia solicitado.", dAgo(30), "elderly", DRA_ID));
    recs.push(r("seed-rec-el02-v1", "el02", "visit", "Visita ACS — Idoso HAS", "Verificação de adesão ao tratamento. Idoso em uso correto da medicação.", dAgo(60), "elderly", ACS_ID));
    recs.push(r("seed-rec-el02-vac1", "el02", "vaccine", "Influenza", "Aplicada na campanha anual. Sem intercorrências.", dAgo(45), "elderly", ENF_ID, { vaccineName: "Influenza" }));

    // el03 — HAS + DM
    recs.push(r("seed-rec-el03-c1", "el03", "consultation", "Consulta Idoso — HAS + DM", "PA 155/95, Glicemia 180 mg/dL. Ajuste de metformina. Encaminhamento endocrinologia.", dAgo(120), "elderly", DRA_ID));
    recs.push(r("seed-rec-el03-c2", "el03", "consultation", "Retorno — HAS + DM", "PA 140/88. Glicemia melhorada. Exames laboratoriais solicitados.", dAgo(60), "elderly", DRA_ID));
    recs.push(r("seed-rec-el03-c3", "el03", "consultation", "Retorno — resultado exames", "HbA1c 7,8%. Ajuste de insulina. Encaminhamento cardiologia por ECG alterado.", dAgo(20), "elderly", DRA_ID));
    recs.push(r("seed-rec-el03-v1", "el03", "visit", "Visita ACS — Idoso HAS+DM", "Verificação do esquema medicamentoso. Paciente usa insulina corretamente.", dAgo(80), "elderly", ACS_ID));
    recs.push(r("seed-rec-el03-v2", "el03", "visit", "Visita ACS — acompanhamento", "Glicemia capilar 148 mg/dL no domicílio. Dieta sendo seguida.", dAgo(25), "elderly", ACS_ID));
    recs.push(r("seed-rec-el03-vac1", "el03", "vaccine", "Influenza", "Campanha anual. Sem intercorrências.", dAgo(45), "elderly", ENF_ID, { vaccineName: "Influenza" }));

    // el04 — HAS + DM
    recs.push(r("seed-rec-el04-c1", "el04", "consultation", "Consulta Idoso — HAS + DM", "PA 150/92, HbA1c 8,2%. Controle inadequado. Ajuste terapêutico.", dAgo(110), "elderly", DRA_ID));
    recs.push(r("seed-rec-el04-c2", "el04", "consultation", "Retorno — HAS + DM", "PA 140/85. Melhora progressiva. Exames solicitados.", dAgo(50), "elderly", DRA_ID));
    recs.push(r("seed-rec-el04-c3", "el04", "consultation", "Retorno — resultado exames", "HbA1c 7,4%. Controle melhorando. Manter conduta.", dAgo(10), "elderly", DRA_ID));
    recs.push(r("seed-rec-el04-v1", "el04", "visit", "Visita ACS — Idoso HAS+DM", "Idosa aderente ao tratamento. Dieta controlada.", dAgo(75), "elderly", ACS_ID));
    recs.push(r("seed-rec-el04-v2", "el04", "visit", "Visita ACS — acompanhamento", "Verificação de pressão arterial domiciliar — 138/86.", dAgo(20), "elderly", ACS_ID));

    // el05 — HAS
    recs.push(r("seed-rec-el05-c1", "el05", "consultation", "Consulta Idoso — HAS", "PA 160/100. Ajuste de Enalapril. Orientações sobre dieta.", dAgo(80), "elderly", DRA_ID));
    recs.push(r("seed-rec-el05-c2", "el05", "consultation", "Retorno — HAS", "PA 148/90. Redução da pressão após ajuste. Encaminhamento cardiologia.", dAgo(20), "elderly", DRA_ID));
    recs.push(r("seed-rec-el05-v1", "el05", "visit", "Visita ACS — Idoso HAS", "Verificação de adesão. Paciente relata esquecer medicação eventualmente. Reorientado.", dAgo(50), "elderly", ACS_ID));

    // el06 — sem condições crônicas
    recs.push(r("seed-rec-el06-c1", "el06", "consultation", "Avaliação Geriátrica", "Idosa em bom estado geral. Sem doenças crônicas. Cognitivamente preservada. Independente nas AVDs.", dAgo(60), "elderly", DRA_ID));

    for (const rec of recs) {
      if (!hasId(db.clinicalRecords, rec.id)) db.clinicalRecords.push(rec);
    }

    // ── Appointments (past consultations) ────────────────────────────────
    const appts = [
      { id: "seed-appt-g01-1",  patientId: "seed-p-g01",  date: dAgo(120), summary: "Consulta preventiva",          demandType: "spontaneous", conduct: "Sem alterações. Orientações gerais.", createdBy: DRA_ID },
      { id: "seed-appt-g02-1",  patientId: "seed-p-g02",  date: dAgo(80),  summary: "Consulta de rotina",            demandType: "spontaneous", conduct: "Paciente em bom estado.", createdBy: DRA_ID },
      { id: "seed-appt-g05-1",  patientId: "seed-p-g05",  date: dAgo(45),  summary: "Preventivo — coleta pap",       demandType: "scheduled",   conduct: "Colpocitológico agendado.", createdBy: DRA_ID },
      { id: "seed-appt-g06-1",  patientId: "seed-p-g06",  date: dAgo(180), summary: "Consulta anual",                demandType: "scheduled",   conduct: "Sem queixas.", createdBy: DRA_ID },
      { id: "seed-appt-g07-1",  patientId: "seed-p-g07",  date: dAgo(90),  summary: "Consulta HAS",                  demandType: "scheduled",   conduct: "Controle satisfatório.", createdBy: DRA_ID },
      { id: "seed-appt-g07-2",  patientId: "seed-p-g07",  date: dAgo(30),  summary: "Retorno HAS",                   demandType: "scheduled",   conduct: "Manter losartana.", nextStep: "Retorno em 90d.", createdBy: DRA_ID },
      { id: "seed-appt-g08-1",  patientId: "seed-p-g08",  date: dAgo(20),  summary: "HAS descompensada",             demandType: "spontaneous", conduct: "Ajuste de medicação. ECG solicitado.", nextStep: "Urgência se PA > 180.", createdBy: DRA_ID },
      { id: "seed-appt-g09-1",  patientId: "seed-p-g09",  date: dAgo(90),  summary: "Consulta DM",                   demandType: "scheduled",   conduct: "Glicemia controlada.", createdBy: DRA_ID },
      { id: "seed-appt-g09-2",  patientId: "seed-p-g09",  date: dAgo(30),  summary: "Retorno DM — HbA1c",            demandType: "scheduled",   conduct: "HbA1c 6,8%. Manter conduta.", nextStep: "Retorno em 90d.", createdBy: DRA_ID },
      { id: "seed-appt-g10-1",  patientId: "seed-p-g10",  date: dAgo(100), summary: "Consulta DM — exames",          demandType: "scheduled",   conduct: "Glicemia 180. Exames solicitados.", nextStep: "Retorno com resultado.", createdBy: DRA_ID },
      { id: "seed-appt-g11-1",  patientId: "seed-p-g11",  date: dAgo(15),  summary: "HAS+DM crítico",                demandType: "spontaneous", conduct: "Ajuste intenso de medicação. Cardiologia solicitada.", createdBy: DRA_ID },
      { id: "seed-appt-g12-1",  patientId: "seed-p-g12",  date: dAgo(75),  summary: "Consulta HAS+DM",               demandType: "scheduled",   conduct: "Estável. Manter conduta.", createdBy: DRA_ID },
      { id: "seed-appt-g12-2",  patientId: "seed-p-g12",  date: dAgo(15),  summary: "Retorno HAS+DM",                demandType: "scheduled",   conduct: "Exames normalizados. Retorno 90d.", createdBy: DRA_ID },
      { id: "seed-appt-g13-1",  patientId: "seed-p-g13",  date: dAgo(30),  summary: "Tosse persistente",             demandType: "spontaneous", conduct: "Encaminhamento pneumologia.", nextStep: "Aguardar encaminhamento.", createdBy: DRA_ID },
      { id: "seed-appt-g14-1",  patientId: "seed-p-g14",  date: dAgo(120), summary: "Fadiga — exames solicitados",   demandType: "spontaneous", conduct: "Hemograma + TSH solicitados.", nextStep: "Retorno com resultado.", createdBy: DRA_ID },
      { id: "seed-appt-g15-1",  patientId: "seed-p-g15",  date: dAgo(3),   summary: "Consulta rotina",               demandType: "spontaneous", conduct: "Sem alterações.", createdBy: DRA_ID },
      { id: "seed-appt-g17-1",  patientId: "seed-p-g17",  date: dAgo(30),  summary: "Queixa gastrointestinal",       demandType: "spontaneous", conduct: "Omeprazol prescrito. Melhora em 30d.", createdBy: DRA_ID },
      { id: "seed-appt-g18-1",  patientId: "seed-p-g18",  date: dAgo(400), summary: "Consulta esporádica",           demandType: "spontaneous", conduct: "Paciente sem queixas.", createdBy: DRA_ID },
      // Gestantes
      { id: "seed-appt-pg01-1", patientId: "seed-p-pg01", date: dAgo(56),  summary: "1ª consulta pré-natal",         demandType: "scheduled",   conduct: "Captação precoce. Painel solicitado.", nextStep: "Retorno 16 semanas.", createdBy: DRA_ID },
      { id: "seed-appt-pg02-1", patientId: "seed-p-pg02", date: dAgo(112), summary: "1ª consulta pré-natal",         demandType: "scheduled",   conduct: "Captação. Exames normais.", createdBy: DRA_ID },
      { id: "seed-appt-pg02-2", patientId: "seed-p-pg02", date: dAgo(56),  summary: "Pré-natal — 2ª consulta",      demandType: "scheduled",   conduct: "Morfológico normal. BCF 148bpm.", nextStep: "Retorno 24 semanas.", createdBy: DRA_ID },
      { id: "seed-appt-pg03-1", patientId: "seed-p-pg03", date: dAgo(168), summary: "1ª consulta pré-natal",         demandType: "scheduled",   conduct: "Captação.", createdBy: DRA_ID },
      { id: "seed-appt-pg03-2", patientId: "seed-p-pg03", date: dAgo(112), summary: "Pré-natal — 2ª consulta",      demandType: "scheduled",   conduct: "Morfológico normal.", createdBy: DRA_ID },
      { id: "seed-appt-pg03-3", patientId: "seed-p-pg03", date: dAgo(56),  summary: "Pré-natal — 3ª consulta",      demandType: "scheduled",   conduct: "TOTG normal. BCF 140bpm.", nextStep: "Retorno 28 semanas.", createdBy: DRA_ID },
      { id: "seed-appt-pg04-1", patientId: "seed-p-pg04", date: dAgo(224), summary: "1ª consulta pré-natal",         demandType: "scheduled",   conduct: "Captação 8ª semana.", createdBy: DRA_ID },
      { id: "seed-appt-pg04-2", patientId: "seed-p-pg04", date: dAgo(168), summary: "Pré-natal — 2ª consulta",      demandType: "scheduled",   conduct: "16ª semana. Normal.", createdBy: DRA_ID },
      { id: "seed-appt-pg04-3", patientId: "seed-p-pg04", date: dAgo(112), summary: "Pré-natal — 3ª consulta",      demandType: "scheduled",   conduct: "24ª semana. TOTG normal.", createdBy: DRA_ID },
      { id: "seed-appt-pg04-4", patientId: "seed-p-pg04", date: dAgo(56),  summary: "Pré-natal — 4ª consulta",      demandType: "scheduled",   conduct: "32ª semana. Apresentação cefálica.", nextStep: "Retorno 36 semanas.", createdBy: DRA_ID },
      { id: "seed-appt-pg05-1", patientId: "seed-p-pg05", date: dAgo(252), summary: "1ª consulta pré-natal",         demandType: "scheduled",   conduct: "Captação precoce.", createdBy: DRA_ID },
      { id: "seed-appt-pg05-5", patientId: "seed-p-pg05", date: dAgo(28),  summary: "Pré-natal — 5ª consulta",      demandType: "scheduled",   conduct: "36ª semana. Encaixamento cefálico. Orientada sobre parto.", nextStep: "Hospital referência em trabalho de parto.", createdBy: DRA_ID },
      { id: "seed-appt-pg06-1", patientId: "seed-p-pg06", date: dAgo(140), summary: "1ª consulta pré-natal",         demandType: "scheduled",   conduct: "8ª semana.", createdBy: DRA_ID },
      { id: "seed-appt-pg06-2", patientId: "seed-p-pg06", date: dAgo(56),  summary: "Pré-natal — 2ª consulta",      demandType: "scheduled",   conduct: "20ª semana. BCF 144bpm.", nextStep: "Retorno 24 semanas.", createdBy: DRA_ID },
      // Puérperas
      { id: "seed-appt-pu01-1", patientId: "seed-p-pu01", date: dAgo(3),   summary: "Consulta puerperal — 1ª semana",demandType: "scheduled",   conduct: "Puerpério normal. Amamentação estabelecida.", nextStep: "Retorno 15 dias.", createdBy: ENF_ID },
      { id: "seed-appt-pu02-1", patientId: "seed-p-pu02", date: dAgo(12),  summary: "Consulta puerperal — 1ª semana",demandType: "scheduled",   conduct: "Boa evolução.", createdBy: ENF_ID },
      { id: "seed-appt-pu03-1", patientId: "seed-p-pu03", date: dAgo(28),  summary: "Consulta puerperal — 1ª semana",demandType: "scheduled",   conduct: "Cesárea. Cicatriz boa.", createdBy: DRA_ID },
      { id: "seed-appt-pu03-2", patientId: "seed-p-pu03", date: dAgo(1),   summary: "Consulta puerperal — 30 dias",  demandType: "scheduled",   conduct: "Alta do puerpério. Bem.", createdBy: DRA_ID },
      { id: "seed-appt-pu04-1", patientId: "seed-p-pu04", date: dAgo(42),  summary: "Consulta puerperal — 1ª semana",demandType: "scheduled",   conduct: "Normal.", createdBy: ENF_ID },
      { id: "seed-appt-pu04-3", patientId: "seed-p-pu04", date: dAgo(1),   summary: "Consulta puerperal — 45 dias",  demandType: "scheduled",   conduct: "Alta puerperal. Planejamento familiar.", createdBy: DRA_ID },
      // Crianças
      { id: "seed-appt-ch01-1", patientId: "seed-p-ch01", date: dAgo(5),   summary: "Puericultura 1ª semana",        demandType: "scheduled",   conduct: "Normal. Amamentação.", nextStep: "Consulta 1 mês.", createdBy: DRA_ID },
      { id: "seed-appt-ch02-2", patientId: "seed-p-ch02", date: dAgo(1),   summary: "Puericultura 1 mês",            demandType: "scheduled",   conduct: "Peso 4,2kg. Normal.", nextStep: "Vacinas e consulta 2 meses.", createdBy: DRA_ID },
      { id: "seed-appt-ch03-2", patientId: "seed-p-ch03", date: dAgo(2),   summary: "Puericultura 2 meses",          demandType: "scheduled",   conduct: "Vacinas 2m. Normal.", nextStep: "Consulta 4 meses.", createdBy: DRA_ID },
      { id: "seed-appt-ch04-3", patientId: "seed-p-ch04", date: dAgo(2),   summary: "Puericultura 4 meses",          demandType: "scheduled",   conduct: "Vacinas 4m. Introdução alimentar orientada 6m.", nextStep: "Consulta 6 meses.", createdBy: DRA_ID },
      { id: "seed-appt-ch05-5", patientId: "seed-p-ch05", date: dAgo(2),   summary: "Puericultura 6 meses",          demandType: "scheduled",   conduct: "Vacinas 6m. Intro alimentar iniciada.", nextStep: "Consulta 9 meses.", createdBy: DRA_ID },
      { id: "seed-appt-ch06-6", patientId: "seed-p-ch06", date: dAgo(2),   summary: "Puericultura 12 meses",         demandType: "scheduled",   conduct: "Vacinas 12m. Andando com apoio.", nextStep: "Consulta 15 meses.", createdBy: DRA_ID },
      // Idosos
      { id: "seed-appt-el01-1", patientId: "seed-p-el01", date: dAgo(90),  summary: "Avaliação geriátrica",          demandType: "scheduled",   conduct: "Autonomia preservada.", nextStep: "Retorno anual.", createdBy: DRA_ID },
      { id: "seed-appt-el02-1", patientId: "seed-p-el02", date: dAgo(90),  summary: "Consulta HAS idoso",            demandType: "scheduled",   conduct: "PA controlando.", createdBy: DRA_ID },
      { id: "seed-appt-el02-2", patientId: "seed-p-el02", date: dAgo(30),  summary: "Retorno HAS idoso",             demandType: "scheduled",   conduct: "Cardiologia solicitada.", nextStep: "Aguardar encaminhamento.", createdBy: DRA_ID },
      { id: "seed-appt-el03-1", patientId: "seed-p-el03", date: dAgo(120), summary: "Consulta HAS+DM idoso",         demandType: "scheduled",   conduct: "Ajuste medicação.", createdBy: DRA_ID },
      { id: "seed-appt-el03-3", patientId: "seed-p-el03", date: dAgo(20),  summary: "Retorno — exames HAS+DM",       demandType: "scheduled",   conduct: "HbA1c 7,8%. Insulina ajustada.", nextStep: "Retorno 60 dias.", createdBy: DRA_ID },
      { id: "seed-appt-el04-1", patientId: "seed-p-el04", date: dAgo(110), summary: "Consulta HAS+DM idosa",         demandType: "scheduled",   conduct: "Controle inadequado.", createdBy: DRA_ID },
      { id: "seed-appt-el04-3", patientId: "seed-p-el04", date: dAgo(10),  summary: "Retorno — exames HAS+DM",       demandType: "scheduled",   conduct: "HbA1c 7,4%. Melhorando.", nextStep: "Retorno 90 dias.", createdBy: DRA_ID },
      { id: "seed-appt-el05-1", patientId: "seed-p-el05", date: dAgo(80),  summary: "Consulta HAS idoso",            demandType: "scheduled",   conduct: "PA 160/100. Ajuste.", createdBy: DRA_ID },
      { id: "seed-appt-el05-2", patientId: "seed-p-el05", date: dAgo(20),  summary: "Retorno HAS",                   demandType: "scheduled",   conduct: "Redução da PA. Cardiologia.", createdBy: DRA_ID },
      { id: "seed-appt-el06-1", patientId: "seed-p-el06", date: dAgo(60),  summary: "Avaliação geriátrica",          demandType: "scheduled",   conduct: "Sem doenças crônicas. Normal.", createdBy: DRA_ID },
    ];
    for (const a of appts) {
      if (!hasId(db.appointments, a.id))
        db.appointments.push({ nextStep: "", ...a, createdAt: `${a.date}T09:00:00.000Z` });
    }

    // ── Agenda (upcoming) ─────────────────────────────────────────────────
    const agenda = [
      // Gestantes — próxima consulta pré-natal
      { id: "seed-ag-pg01-1", patientId: "seed-p-pg01", patientName: "Amanda Cristina Lopes",       date: dAhead(14),  time: "08:00", type: "consultation", status: "scheduled", notes: "Pré-natal — 2ª consulta (16 semanas)",  specialty: "enfermagem" },
      { id: "seed-ag-pg02-1", patientId: "seed-p-pg02", patientName: "Juliana Meireles Costa",      date: dAhead(14),  time: "08:30", type: "consultation", status: "scheduled", notes: "Pré-natal — 3ª consulta (24 semanas)",  specialty: "enfermagem" },
      { id: "seed-ag-pg03-1", patientId: "seed-p-pg03", patientName: "Fernanda Cristina Araújo",    date: dAhead(28),  time: "09:00", type: "consultation", status: "scheduled", notes: "Pré-natal — 4ª consulta (28 semanas)",  specialty: "medico_familia" },
      { id: "seed-ag-pg04-1", patientId: "seed-p-pg04", patientName: "Ana Beatriz Ferreira Campos", date: dAhead(21),  time: "09:30", type: "consultation", status: "scheduled", notes: "Pré-natal — 5ª consulta (36 semanas)",  specialty: "medico_familia" },
      { id: "seed-ag-pg05-1", patientId: "seed-p-pg05", patientName: "Renata Souza Galvão",         date: dAhead(7),   time: "10:00", type: "consultation", status: "scheduled", notes: "Pré-natal — 6ª consulta (38 semanas)",  specialty: "medico_familia" },
      { id: "seed-ag-pg06-1", patientId: "seed-p-pg06", patientName: "Patrícia Vieira Moreira",     date: dAhead(14),  time: "10:30", type: "consultation", status: "scheduled", notes: "Pré-natal — 3ª consulta (24 semanas)",  specialty: "enfermagem" },
      // Puérperas — retorno
      { id: "seed-ag-pu01-1", patientId: "seed-p-pu01", patientName: "Camila Rodrigues Soares",  date: dAhead(10),  time: "08:00", type: "return", status: "scheduled", notes: "Consulta puerperal 15 dias",           specialty: "medico_familia" },
      { id: "seed-ag-pu02-1", patientId: "seed-p-pu02", patientName: "Beatriz Alves Duarte",     date: dAhead(15),  time: "08:30", type: "return", status: "scheduled", notes: "Consulta puerperal 30 dias",           specialty: "medico_familia" },
      // Crianças — próxima puericultura
      { id: "seed-ag-ch01-1", patientId: "seed-p-ch01", patientName: "Miguel Oliveira Barbosa",  date: dAhead(23),  time: "09:00", type: "consultation", status: "scheduled", notes: "Puericultura 1 mês",                  specialty: "pediatria" },
      { id: "seed-ag-ch02-1", patientId: "seed-p-ch02", patientName: "Sofia Ramos Teixeira",     date: dAhead(31),  time: "09:30", type: "consultation", status: "scheduled", notes: "Puericultura 2 meses + vacinas",      specialty: "pediatria" },
      { id: "seed-ag-ch03-1", patientId: "seed-p-ch03", patientName: "Davi Lima Gonçalves",      date: dAhead(60),  time: "10:00", type: "consultation", status: "scheduled", notes: "Puericultura 4 meses + vacinas",      specialty: "pediatria" },
      { id: "seed-ag-ch04-1", patientId: "seed-p-ch04", patientName: "Larissa Costa Moura",      date: dAhead(58),  time: "10:30", type: "consultation", status: "scheduled", notes: "Puericultura 6 meses + vacinas",      specialty: "pediatria" },
      { id: "seed-ag-ch05-1", patientId: "seed-p-ch05", patientName: "Gabriel Ferreira Santos",  date: dAhead(88),  time: "11:00", type: "consultation", status: "scheduled", notes: "Puericultura 9 meses",                specialty: "pediatria" },
      { id: "seed-ag-ch06-1", patientId: "seed-p-ch06", patientName: "Isabella Nascimento Cruz", date: dAhead(91),  time: "11:30", type: "consultation", status: "scheduled", notes: "Puericultura 15 meses",               specialty: "pediatria" },
      // Crônicos — retorno (médico da família)
      { id: "seed-ag-g07-1",  patientId: "seed-p-g07",  patientName: "Roberto Alves Mendonça",   date: dAhead(60),  time: "08:00", type: "return", status: "scheduled", notes: "Retorno HAS — 90 dias",               specialty: "medico_familia" },
      { id: "seed-ag-g08-1",  patientId: "seed-p-g08",  patientName: "Sandra Lima Andrade",      date: dAhead(14),  time: "08:30", type: "return", status: "scheduled", notes: "Retorno urgente HAS — resultado ECG", specialty: "medico_familia" },
      { id: "seed-ag-g09-1",  patientId: "seed-p-g09",  patientName: "Paulo Henrique Braga",     date: dAhead(60),  time: "09:00", type: "return", status: "scheduled", notes: "Retorno DM 90 dias",                  specialty: "medico_familia" },
      { id: "seed-ag-g11-1",  patientId: "seed-p-g11",  patientName: "Francisco José Melo",      date: dAhead(14),  time: "09:30", type: "return", status: "scheduled", notes: "Retorno HAS+DM crítico",              specialty: "medico_familia" },
      { id: "seed-ag-g12-1",  patientId: "seed-p-g12",  patientName: "Edmundo Tavares Cunha",    date: dAhead(75),  time: "10:00", type: "return", status: "scheduled", notes: "Retorno HAS+DM — 90 dias",            specialty: "medico_familia" },
      // Idosos — retorno (médico da família)
      { id: "seed-ag-el01-1", patientId: "seed-p-el01", patientName: "Rosa Maria da Silva Cunha",   date: dAhead(90),  time: "08:00", type: "consultation", status: "scheduled", notes: "Avaliação geriátrica anual",         specialty: "medico_familia" },
      { id: "seed-ag-el02-1", patientId: "seed-p-el02", patientName: "Silvio Roberto Araújo",        date: dAhead(30),  time: "08:30", type: "return",       status: "scheduled", notes: "Retorno HAS pós cardiologia",        specialty: "medico_familia" },
      { id: "seed-ag-el03-1", patientId: "seed-p-el03", patientName: "João Carlos Oliveira Santos", date: dAhead(40),  time: "09:00", type: "return",       status: "scheduled", notes: "Retorno HAS+DM — insulina",          specialty: "medico_familia" },
      { id: "seed-ag-el04-1", patientId: "seed-p-el04", patientName: "Maria das Graças Ferreira",   date: dAhead(80),  time: "09:30", type: "return",       status: "scheduled", notes: "Retorno HAS+DM — 90 dias",           specialty: "medico_familia" },
      { id: "seed-ag-el05-1", patientId: "seed-p-el05", patientName: "Antônio Rodrigues da Silva",  date: dAhead(21),  time: "10:00", type: "return",       status: "scheduled", notes: "Retorno HAS pós cardiologia",        specialty: "medico_familia" },
      { id: "seed-ag-el06-1", patientId: "seed-p-el06", patientName: "Luiza Fernanda Rocha",        date: dAhead(270), time: "10:30", type: "consultation", status: "scheduled", notes: "Avaliação geriátrica anual",         specialty: "medico_familia" },
      // Odontologia — consultas de hoje (para testar fluxo dental completo)
      { id: "seed-ag-g05-dent", patientId: "seed-p-g05", patientName: "Adriana Monteiro Pires",  date: dAhead(0), time: "08:00", type: "consultation", status: "scheduled", notes: "Consulta odontológica — 1ª consulta",   specialty: "odontologia" },
      { id: "seed-ag-g09-dent", patientId: "seed-p-g09", patientName: "Paulo Henrique Braga",    date: dAhead(0), time: "08:30", type: "return",       status: "scheduled", notes: "Retorno odontológico — revisão",        specialty: "odontologia" },
      { id: "seed-ag-g06-dent", patientId: "seed-p-g06", patientName: "Marcos Paulo Rodrigues",  date: dAhead(0), time: "09:00", type: "consultation", status: "scheduled", notes: "Consulta odontológica — profilaxia",    specialty: "odontologia" },
    ];
    for (const ag of agenda) {
      if (!hasId(db.agendaEntries, ag.id)) {
        const isDental = ag.specialty === "odontologia";
        db.agendaEntries.push({
          ...ag,
          teamId: TEAM_ID,
          doctorId: isDental ? DENT_ID : DRA_ID,
          doctorName: isDental ? "Dr. Carlos Dental" : "Dra. Maria Rosa",
          specialtyKey: ag.specialty || "medico_familia",
          incompletePatient: false,
          summary: ag.notes,
          createdAt: NOW,
          createdBy: isDental ? DENT_ID : DRA_ID,
          updatedAt: NOW,
          updatedBy: isDental ? DENT_ID : DRA_ID,
        });
      }
    }
    // Backfill specialty on existing agenda entries that lack it
    for (const entry of db.agendaEntries) {
      if (!entry.specialty) {
        entry.specialty = entry.specialtyKey || "medico_familia";
        entry.specialtyKey = entry.specialty;
      }
    }

    // ── Tasks ─────────────────────────────────────────────────────────────
    if (!hasId(db.tasks, "seed-task-g13-1")) {
      db.tasks.push({
        id: "seed-task-g13-1",
        patientId: "seed-p-g13",
        assigneeId: ACS_ID,
        title: "Agendar consulta de retorno — aguardar encaminhamento pneumologia",
        notes: "Paciente aguarda aprovação do encaminhamento. Ligar para confirmar quando disponível.",
        status: "pending",
        dueDate: dAhead(14),
        createdBy: BREAKGLASS_ID,
        createdAt: tsAgo(29),
        updatedAt: tsAgo(29),
      });
    }

    // ── Messages ──────────────────────────────────────────────────────────
    if (!hasId(db.messages, "seed-msg-g17-1")) {
      db.messages.push({
        id: "seed-msg-g17-1",
        patientId: "seed-p-g17",
        authorId: DRA_ID,
        authorName: "Dra. Maria Rosa",
        text: "Paciente entrou em contato solicitando informação sobre resultado do exame de endoscopia. Retornar contato e verificar resultado no sistema de referência.",
        createdAt: tsAgo(5),
      });
    }

    // ── Referrals ─────────────────────────────────────────────────────────
    const refs = [
      { id: "seed-ref-g08-1",  patientId: "seed-p-g08",  patientName: "Sandra Lima Andrade",        specialty: "Cardiologia",    priority: "priority", status: "pending",    date: dAgo(20),  reason: "HAS descompensada. PA 175/105. ECG solicitado. Necessita avaliação." },
      { id: "seed-ref-g11-1",  patientId: "seed-p-g11",  patientName: "Francisco José Melo",        specialty: "Cardiologia",    priority: "priority", status: "pending",    date: dAgo(15),  reason: "HAS+DM de difícil controle. Necessita avaliação cardiológica urgente." },
      { id: "seed-ref-g13-1",  patientId: "seed-p-g13",  patientName: "Patricia Ramos Coelho",      specialty: "Pneumologia",    priority: "routine",  status: "pending",    date: dAgo(30),  reason: "Tosse persistente > 3 semanas. Investigar causa." },
      { id: "seed-ref-el02-1", patientId: "seed-p-el02", patientName: "Silvio Roberto Araújo",       specialty: "Cardiologia",    priority: "routine",  status: "pending",    date: dAgo(30),  reason: "HAS idoso — avaliação de risco cardiovascular e estratificação." },
      { id: "seed-ref-el03-1", patientId: "seed-p-el03", patientName: "João Carlos Oliveira Santos", specialty: "Cardiologia",    priority: "priority", status: "scheduled",  date: dAgo(20),  reason: "ECG alterado. HAS+DM. Avaliação cardiológica necessária." },
      { id: "seed-ref-el03-2", patientId: "seed-p-el03", patientName: "João Carlos Oliveira Santos", specialty: "Endocrinologia", priority: "routine",  status: "pending",    date: dAgo(120), reason: "DM idoso com HbA1c 7,8%. Avaliação especializada do controle glicêmico." },
      { id: "seed-ref-el04-1", patientId: "seed-p-el04", patientName: "Maria das Graças Ferreira",   specialty: "Endocrinologia", priority: "routine",  status: "pending",    date: dAgo(110), reason: "DM idosa com HbA1c 8,2%. Acompanhamento endocrinológico." },
      { id: "seed-ref-el05-1", patientId: "seed-p-el05", patientName: "Antônio Rodrigues da Silva",  specialty: "Cardiologia",    priority: "routine",  status: "pending",    date: dAgo(20),  reason: "HAS idoso. Necessita estratificação de risco cardiovascular." },
    ];
    for (const ref of refs) {
      if (!hasId(db.referrals, ref.id)) {
        db.referrals.push({
          ...ref,
          teamId: TEAM_ID,
          notes: "",
          doctorId: DRA_ID,
          doctorName: "Dra. Maria Rosa",
          createdAt: `${ref.date}T11:00:00.000Z`,
          createdBy: DRA_ID,
          updatedAt: `${ref.date}T11:00:00.000Z`,
          updatedBy: DRA_ID,
        });
      }
    }

    // ── Exams (results) ───────────────────────────────────────────────────
    const exams = [
      // Histórico laboratorial (source explícito)
      { id: "seed-exam-g09-1",  patientId: "seed-p-g09",  source: "posto",   title: "Glicemia de Jejum",   date: dAgo(30),  details: "108 mg/dL — dentro do alvo terapêutico." },
      { id: "seed-exam-g09-2",  patientId: "seed-p-g09",  source: "posto",   title: "HbA1c",               date: dAgo(30),  details: "6,8% — bom controle glicêmico." },
      { id: "seed-exam-g12-1",  patientId: "seed-p-g12",  source: "posto",   title: "Hemograma Completo",  date: dAgo(15),  details: "Sem alterações relevantes." },
      { id: "seed-exam-g12-2",  patientId: "seed-p-g12",  source: "posto",   title: "HbA1c",               date: dAgo(15),  details: "7,1% — controle aceitável." },
      { id: "seed-exam-el03-1", patientId: "seed-p-el03", source: "posto",   title: "HbA1c",               date: dAgo(60),  details: "7,8% — controle parcial. Ajuste indicado." },
      { id: "seed-exam-el03-2", patientId: "seed-p-el03", source: "posto",   title: "Glicemia de Jejum",   date: dAgo(60),  details: "165 mg/dL — acima da meta." },
      { id: "seed-exam-el03-3", patientId: "seed-p-el03", source: "posto",   title: "Creatinina + Ureia",  date: dAgo(60),  details: "Creatinina 1,1 mg/dL, Ureia 38 mg/dL — dentro da normalidade." },
      { id: "seed-exam-el04-1", patientId: "seed-p-el04", source: "posto",   title: "HbA1c",               date: dAgo(50),  details: "8,2% na primeira dosagem; 7,4% após ajuste terapêutico." },
      { id: "seed-exam-el04-2", patientId: "seed-p-el04", source: "posto",   title: "Hemograma Completo",  date: dAgo(50),  details: "Sem anemia. Leucócitos normais." },
      // Demo integração laboratorial — exame enviado, aguardando resultado
      {
        id: "seed-exam-g10-pending", patientId: "seed-p-g10",
        title: "HbA1c", date: dAgo(100),
        details: "[EXAME REALIZADO NO POSTO]",
        source: "posto", status: "sent_to_lab",
      },
      // Demo integração laboratorial — resultado publicado pelo laboratório
      {
        id: "seed-exam-g14-result", patientId: "seed-p-g14",
        title: "Hemograma Completo", date: dAgo(120),
        details: "[EXAME REALIZADO NO POSTO]\nResultado: Hemoglobina 13,2 g/dL, Leucócitos 7.200/mm³ — dentro da normalidade.\nReferência: Hb 12–17 g/dL, Leuco 4.000–10.000/mm³",
        source: "posto", status: "result_available",
        resultDate: dAgo(115), lab: "Laboratório Municipal",
        externalId: "SEED-LAB-G14-001",
      },
      // Demo — exame externo trazido pelo paciente
      {
        id: "seed-exam-g17-ext", patientId: "seed-p-g17",
        title: "Endoscopia Digestiva Alta", date: dAgo(5),
        details: "[EXAME EXTERNO — trazido pelo paciente]\nResultado: Gastrite leve. Sem lesões relevantes. H. pylori negativo.",
        source: "externo", status: "result_available",
        resultDate: dAgo(5), lab: "Clínica Diagnóstica Paulista",
      },
    ];
    for (const ex of exams) {
      if (!hasId(db.exams, ex.id)) {
        db.exams.push({
          ...ex,
          teamId: TEAM_ID,
          attachments: [],
          createdAt: `${ex.date}T08:00:00.000Z`,
          createdBy: DRA_ID,
          updatedAt: `${ex.date}T08:00:00.000Z`,
          updatedBy: DRA_ID,
        });
      }
    }

    // ── Notifications (lab result events) ────────────────────────────────
    if (!hasId(db.notifications, "seed-notif-lab-g14")) {
      db.notifications.push({
        id: "seed-notif-lab-g14",
        type: "info",
        title: "Resultado disponível: Hemograma Completo",
        detail: "Saiu o resultado do exame Hemograma Completo do paciente Marcelo Costa Barbosa.",
        patientId: "seed-p-g14",
        teamId: TEAM_ID,
        examId: "seed-exam-g14-result",
        createdAt: tsAgo(115),
        read: false,
      });
    }

    // ── Lab integration records (idempotency control) ────────────────────
    if (!hasId(db.labIntegrations, "seed-labint-g14-001")) {
      db.labIntegrations.push({
        id: "seed-labint-g14-001",
        requestId: "seed-req-g14-001",
        idempotencyKey: "SEED-LAB-G14-001",
        examId: "seed-exam-g14-result",
        patientId: "seed-p-g14",
        teamId: TEAM_ID,
        examTitle: "Hemograma Completo",
        status: "result_received",
        lab: "Laboratório Municipal",
        createdAt: tsAgo(115),
      });
    }

    // ── Pharmacy stock ────────────────────────────────────────────────────
    if (!db.pharmacyStock.some((i) => i.teamId === TEAM_ID)) {
      for (const item of PHARMACY_ITEMS) {
        db.pharmacyStock.push({
          id: `${item.key}-${TEAM_ID}`,
          teamId: TEAM_ID,
          name: item.name,
          category: item.category,
          unit: item.unit,
          qty: item.qty,
          minQty: item.minQty,
          location: item.location,
          createdAt: tsAgo(60),
          createdBy: BREAKGLASS_ID,
          updatedAt: tsAgo(7),
          updatedBy: BREAKGLASS_ID,
        });
      }
    }

    // Pharmacy dispense logs
    const pharmaLogs = [
      { id: "seed-pharma-log-1", ts: tsAgo(10), type: "dispensa", itemId: `seed-pharm-06-${TEAM_ID}`, itemName: "Losartana 50mg",   patientId: "seed-p-el03", patient: "João Carlos Oliveira Santos", prescriberId: DRA_ID, prescriber: "Dra. Maria Rosa", qty: 30, numReceita: "RCP-001", lote: "L2026A" },
      { id: "seed-pharma-log-2", ts: tsAgo(8),  type: "dispensa", itemId: `seed-pharm-07-${TEAM_ID}`, itemName: "Metformina 850mg", patientId: "seed-p-el04", patient: "Maria das Graças Ferreira",   prescriberId: DRA_ID, prescriber: "Dra. Maria Rosa", qty: 60, numReceita: "RCP-002", lote: "L2026B" },
      { id: "seed-pharma-log-3", ts: tsAgo(5),  type: "dispensa", itemId: `seed-pharm-05-${TEAM_ID}`, itemName: "Enalapril 10mg",   patientId: "seed-p-el05", patient: "Antônio Rodrigues da Silva",  prescriberId: DRA_ID, prescriber: "Dra. Maria Rosa", qty: 30, numReceita: "RCP-003", lote: "L2026A" },
    ];
    for (const log of pharmaLogs) {
      if (!hasId(db.pharmacyLogs, log.id)) {
        db.pharmacyLogs.unshift({ ...log, teamId: TEAM_ID, pharma: BREAKGLASS_NAME, pharmaId: BREAKGLASS_ID, dtReceita: dAgo(12) });
      }
    }

    // ── Supplies stock ────────────────────────────────────────────────────
    if (!db.suppliesStock.some((i) => i.teamId === TEAM_ID)) {
      for (const item of SUPPLIES_ITEMS) {
        db.suppliesStock.push({
          id: item.id,
          teamId: TEAM_ID,
          name: item.name,
          category: item.category,
          unit: item.unit,
          maxQty: item.maxQty,
          qty: item.qty,
          notes: "",
          createdAt: tsAgo(60),
          createdBy: BREAKGLASS_ID,
          updatedAt: tsAgo(7),
          updatedBy: BREAKGLASS_ID,
        });
      }
    }

    // Supplies dispense logs
    const supplyLogs = [
      { id: "seed-supply-log-1", type: "dispensa", patientId: "seed-p-el03", patientName: "João Carlos Oliveira Santos", continuo: true,  items: [{ id: "i41", qty: 30 }, { id: "i42", qty: 30 }], obs: "Insulinoterapia contínua.", date: dAgo(14) },
      { id: "seed-supply-log-2", type: "entrada",  itemId: "i38", itemName: "Tiras Reagentes Hemoanalise (cx 50 tiras)",           qty: 60, date: dAgo(20) },
    ];
    for (const log of supplyLogs) {
      if (!hasId(db.suppliesLogs, log.id)) {
        db.suppliesLogs.unshift({
          ...log,
          ts: `${log.date}T14:00:00.000Z`,
          professionalId: BREAKGLASS_ID,
          professionalName: BREAKGLASS_NAME,
          professionalRole: "break_glass_admin",
          teamId: TEAM_ID,
        });
      }
    }

    // Continuous supply (insulin — el03)
    if (!hasId(db.suppliesContinuous, "seed-cont-01")) {
      db.suppliesContinuous.unshift({
        id: "seed-cont-01",
        patientId: "seed-p-el03",
        patientName: "João Carlos Oliveira Santos",
        teamId: TEAM_ID,
        items: [{ id: "i41", qty: 30 }, { id: "i42", qty: 30 }],
        profissional: BREAKGLASS_NAME,
        dtInicio: dAgo(14),
        dtFim: "",
        ativo: true,
        obs: "Insulinoterapia contínua — HAS+DM.",
      });
    }

    // ── Family groups (auto-generated from patient addresses) ────────────
    const fgResult = backfillFamilyGroups(db, { id: BREAKGLASS_ID, name: BREAKGLASS_NAME, teamId: TEAM_ID });
    logInfo("seed_demo_family_groups", { event: "seed_demo_family_groups", groups: fgResult.groups });

    return {
      removedPatients: oldSeedCount,
      createdPatients: seedPatients.length,
      totalPatients: db.patients.length,
      familyGroups: fgResult.groups,
      countsByCategory: {
        general:       countCat("general"),
        pregnant:      countCat("pregnant"),
        puerperal:     countCat("puerperal"),
        child_followup:countCat("child_followup"),
        elderly:       countCat("elderly"),
      },
    };
  });

  logInfo("seed_demo_persist_ok", { event: "seed_demo_persist_ok" });
  return { ok: true, ...stats };
}
