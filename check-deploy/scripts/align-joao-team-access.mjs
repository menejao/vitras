import fs from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "../src/services/crypto.js";

const TARGET_TEAM_ID = "team-rosa";
const TARGET_TEAM_NAME = "Equipe Rosa";
const TARGET_EMAIL = "joao@vitras.com.br";
const TARGET_NAME = "João Benedito (Dev)";
const TARGET_PASSWORD = "Valens!Dev2026A1";
const TARGET_ROLE = "break_glass_admin";

const dbFiles = [
  path.resolve(process.cwd(), "data", "db.json"),
  path.resolve(process.cwd(), "data", "dev-db.json")
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function isJoaoDevUser(user) {
  const email = normalizeText(user?.email);
  const name = normalizeText(user?.name);
  return email === normalizeText(TARGET_EMAIL)
    || email.startsWith("joao.dev.")
    || name === normalizeText(TARGET_NAME);
}

function ensureJoaoUser(db) {
  const now = new Date().toISOString();
  const index = Array.isArray(db.users) ? db.users.findIndex(isJoaoDevUser) : -1;
  if (index >= 0) {
    const current = db.users[index];
    db.users[index] = {
      ...current,
      name: TARGET_NAME,
      email: TARGET_EMAIL,
      role: TARGET_ROLE,
      teamId: TARGET_TEAM_ID,
      teamName: TARGET_TEAM_NAME,
      password: hashPassword(TARGET_PASSWORD),
      updatedAt: now
    };
    return { mode: "updated", id: db.users[index].id };
  }

  const user = {
    id: `u-dev-breakglass-${Date.now()}`,
    name: TARGET_NAME,
    role: TARGET_ROLE,
    email: TARGET_EMAIL,
    password: hashPassword(TARGET_PASSWORD),
    teamId: TARGET_TEAM_ID,
    teamName: TARGET_TEAM_NAME,
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
  };
  db.users = Array.isArray(db.users) ? db.users : [];
  db.users.push(user);
  return { mode: "created", id: user.id };
}

function moveAllPatientsToTeam(db) {
  if (!Array.isArray(db.patients)) return 0;
  let count = 0;
  db.patients = db.patients.map((patient) => {
    if (String(patient?.teamId || "") === TARGET_TEAM_ID) return patient;
    count += 1;
    return {
      ...patient,
      teamId: TARGET_TEAM_ID
    };
  });
  return count;
}

for (const dbFile of dbFiles) {
  const raw = await fs.readFile(dbFile, "utf8");
  const db = JSON.parse(raw);
  const userResult = ensureJoaoUser(db);
  const movedPatients = moveAllPatientsToTeam(db);
  await fs.writeFile(dbFile, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    file: path.basename(dbFile),
    user: userResult,
    movedPatients,
    teamId: TARGET_TEAM_ID,
    email: TARGET_EMAIL
  }));
}
