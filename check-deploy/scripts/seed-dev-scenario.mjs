import { randomUUID } from "node:crypto";
import { withDb } from "../src/db.js";
import { ensureDbShape, getProtocolTemplateMap, DEFAULT_CARE_PROTOCOLS } from "../src/utils/domain.js";
import {
  buildSeedPatient,
  buildSeedClinicalRecords,
  buildSeedAppointments,
  buildSeedMessages,
  buildSeedTasks
} from "../src/utils/seed.js";
import { hashPassword } from "../src/services/crypto.js";
import { addAuditLog } from "../src/services/audit.js";

const now = new Date().toISOString();
const DEV_USER_EMAIL = "joao.dev@valens.local";
const DEV_USER_PASSWORD = "Valens!Dev2026A1";

const teams = [
  { id: "team-rosa", name: "Equipe Rosa", managerUserId: "u-nurse-rosa", createdAt: now },
  { id: "team-azul", name: "Equipe Azul", managerUserId: "u-nurse-azul", createdAt: now },
  { id: "team-cinza", name: "Equipe Cinza", managerUserId: "u-nurse-cinza", createdAt: now }
];

const seededUsers = [
  {
    id: "u-dev-breakglass",
    name: "João Benedito (Dev)",
    role: "break_glass_admin",
    email: DEV_USER_EMAIL,
    password: hashPassword(DEV_USER_PASSWORD),
    teamId: "team-rosa",
    councilType: "",
    councilNumber: "",
    councilUf: "",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: "",
    lastSeenAt: "",
    lastSeenIp: ""
  },
  {
    id: "u-gestor",
    name: "Gestora Operacional",
    role: "gestor",
    email: "gestora@valens.local",
    password: hashPassword("Valens!Gestor2026A1"),
    teamId: "",
    councilType: "",
    councilNumber: "",
    councilUf: "",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: now
  },
  {
    id: "u-nurse-rosa",
    name: "Enfermeira Rosa",
    role: "nurse_manager",
    email: "nurse.rosa@valens.local",
    password: hashPassword("Valens!NurseRosa2026"),
    teamId: "team-rosa",
    councilType: "COREN",
    councilNumber: "123456",
    councilUf: "SP",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: now
  },
  {
    id: "u-nurse-azul",
    name: "Enfermeira Azul",
    role: "nurse_manager",
    email: "nurse.azul@valens.local",
    password: hashPassword("Valens!NurseAzul2026"),
    teamId: "team-azul",
    councilType: "COREN",
    councilNumber: "223456",
    councilUf: "SP",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: now
  },
  {
    id: "u-nurse-cinza",
    name: "Enfermeira Cinza",
    role: "nurse_manager",
    email: "nurse.cinza@valens.local",
    password: hashPassword("Valens!NurseCinza2026"),
    teamId: "team-cinza",
    councilType: "COREN",
    councilNumber: "323456",
    councilUf: "SP",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: now
  },
  {
    id: "u-doctor-rosa",
    name: "Dra. Helena Rosa",
    role: "doctor",
    email: "doctor.rosa@valens.local",
    password: hashPassword("Valens!DoctorRosa2026"),
    teamId: "team-rosa",
    councilType: "CRM",
    councilNumber: "445566",
    councilUf: "SP",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: now
  },
  {
    id: "u-dentist",
    name: "Dra. Camila Sorriso",
    role: "dentist",
    email: "dentista@valens.local",
    password: hashPassword("Valens!Dentista2026"),
    teamId: "team-azul",
    councilType: "",
    councilNumber: "",
    councilUf: "",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: now
  },
  {
    id: "u-acs-rosa",
    name: "ACS Rosa",
    role: "acs",
    email: "acs.rosa@valens.local",
    password: hashPassword("Valens!AcsRosa2026"),
    teamId: "team-rosa",
    councilType: "",
    councilNumber: "",
    councilUf: "",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: now
  },
  {
    id: "u-acs-azul",
    name: "ACS Azul",
    role: "acs",
    email: "acs.azul@valens.local",
    password: hashPassword("Valens!AcsAzul2026"),
    teamId: "team-azul",
    councilType: "",
    councilNumber: "",
    councilUf: "",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: now
  },
  {
    id: "u-acs-cinza",
    name: "ACS Cinza",
    role: "acs",
    email: "acs.cinza@valens.local",
    password: hashPassword("Valens!AcsCinza2026"),
    teamId: "team-cinza",
    councilType: "",
    councilNumber: "",
    councilUf: "",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: now
  },
  {
    id: "u-pharmacist",
    name: "Farmacêutica Paula",
    role: "pharmacist",
    email: "farmaceutica@valens.local",
    password: hashPassword("Valens!Farmacia2026"),
    teamId: "team-rosa",
    councilType: "",
    councilNumber: "",
    councilUf: "",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: now
  },
  {
    id: "u-pharmacy-tech",
    name: "Téc. Farmácia Bruno",
    role: "pharmacy_tech",
    email: "tec.farmacia@valens.local",
    password: hashPassword("Valens!TecFarm2026"),
    teamId: "team-rosa",
    councilType: "",
    councilNumber: "",
    councilUf: "",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: now
  },
  {
    id: "u-nursing-tech",
    name: "Téc. Enfermagem Lívia",
    role: "nursing_tech",
    email: "tec.enfermagem@valens.local",
    password: hashPassword("Valens!TecEnf2026"),
    teamId: "team-cinza",
    councilType: "",
    councilNumber: "",
    councilUf: "",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: now
  },
  {
    id: "u-reception",
    name: "Recepção Beatriz",
    role: "receptionist",
    email: "recepcao@valens.local",
    password: hashPassword("Valens!Recepcao2026"),
    teamId: "team-rosa",
    councilType: "",
    councilNumber: "",
    councilUf: "",
    twoFactorEnabled: false,
    twoFactorSecret: "",
    twoFactorPendingSecret: "",
    twoFactorPendingCreatedAt: "",
    createdAt: now
  }
];

const categories = ["pregnant", "puerperal", "child_followup", "elderly", "general"];
const teamIds = teams.map((team) => team.id);
const acsIds = seededUsers.filter((user) => user.role === "acs").map((user) => user.id);
const staffUsers = seededUsers.filter((user) => ["nurse_manager", "doctor", "gestor", "dentist"].includes(user.role));

function bucketForIndex(index) {
  if (index < 10) return "ok";
  if (index < 20) return "progress";
  return "critical";
}

const result = await withDb((db) => {
  ensureDbShape(db);

  db.teams = teams.map((team) => ({ ...team }));
  db.users = seededUsers.map((user) => ({ ...user }));
  db.patients = [];
  db.appointments = [];
  db.tasks = [];
  db.messages = [];
  db.clinicalRecords = [];
  db.privacyRequests = [];
  db.loginChallenges = [];
  db.refreshTokens = [];

  const templateMapCache = new Map();
  const getTemplateMap = (teamId) => {
    if (!templateMapCache.has(teamId)) {
      templateMapCache.set(teamId, getProtocolTemplateMap(db, teamId));
    }
    return templateMapCache.get(teamId);
  };

  for (let index = 0; index < 30; index += 1) {
    const forcedCategory = categories[index % categories.length];
    const incomplete = index >= 24;
    const patient = buildSeedPatient({
      index,
      teamIds,
      acsIds,
      incomplete
    });
    patient.careCategory = forcedCategory;
    patient.teamId = teamIds[index % teamIds.length];
    patient.assignedAcsId = acsIds[index % acsIds.length] || "";
    patient.cnsCpf = patient.cpf || patient.cns || "";
    patient.createdBy = staffUsers[index % staffUsers.length]?.id || "seed-system";
    db.patients.push(patient);

    const templateMap = getTemplateMap(patient.teamId);
    const template =
      templateMap[patient.careCategory] ||
      DEFAULT_CARE_PROTOCOLS[patient.careCategory] ||
      DEFAULT_CARE_PROTOCOLS.general;
    const bucket = bucketForIndex(index);
    const authorId = staffUsers[index % staffUsers.length]?.id || "seed-system";

    db.clinicalRecords.push(...buildSeedClinicalRecords(patient, template, bucket, staffUsers));
    db.appointments.push(...buildSeedAppointments(patient, authorId));
    db.messages.push(...buildSeedMessages(patient, staffUsers));
    db.tasks.push(...buildSeedTasks(patient, acsIds, authorId));
  }

  addAuditLog(
    db,
    { id: "system-seed", name: "Seed DEV", role: "break_glass_admin", requestId: "seed-dev-scenario" },
    "admin.dev_scenario.seeded",
    "patient",
    "bulk",
    {
      totalPatients: db.patients.length,
      totalUsers: db.users.length,
      appointments: db.appointments.length,
      tasks: db.tasks.length,
      messages: db.messages.length,
      clinicalRecords: db.clinicalRecords.length,
      note: "Cenário DEV sintético com 30 pacientes variados e acesso total de verificação"
    }
  );

  return {
    users: db.users.length,
    patients: db.patients.length,
    appointments: db.appointments.length,
    tasks: db.tasks.length,
    messages: db.messages.length,
    clinicalRecords: db.clinicalRecords.length
  };
});

console.log(JSON.stringify({
  ok: true,
  devUser: DEV_USER_EMAIL,
  devRole: "break_glass_admin",
  ...result
}, null, 2));
