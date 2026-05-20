import { v4 as uuidv4 } from "uuid";
import { IS_PROD } from "../config.js";
import { isPostgresMode, withDb } from "../db.js";
import {
  ensureDbShape,
  isJoaoDevVerificationUser,
  JOAO_DEV_TARGET_TEAM_ID
} from "../utils/domain.js";
import { hashPassword, isHashedPassword } from "./crypto.js";

async function migrateLegacyPlaintextPasswords() {
  await withDb((db) => {
    ensureDbShape(db);
    let changed = false;
    db.users = db.users.map((user) => {
      if (!isHashedPassword(user.password)) {
        changed = true;
        return { ...user, password: hashPassword(user.password || ""), updatedAt: new Date().toISOString() };
      }
      return user;
    });
    return changed;
  });
}

async function ensureDemoManagerIfNeeded(email, password) {
  if (IS_PROD) return null;

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const rawPassword = String(password || "");
  const demoEmail = "ana@clinica.local";
  const demoPassword = "123456";

  if (normalizedEmail !== demoEmail || rawPassword !== demoPassword) {
    return null;
  }

  return withDb(async (db) => {
    ensureDbShape(db);
    const existing = db.users.find(
      (u) => String(u.email || "").trim().toLowerCase() === demoEmail
    );

    if (existing) {
      existing.password = hashPassword(demoPassword);
      existing.role = "nurse_manager";
      existing.name = existing.name || "Enfermeira Ana";
      existing.councilType = existing.councilType || "COREN";
      existing.councilNumber = existing.councilNumber || "123456";
      existing.councilUf = existing.councilUf || "SP";
      existing.updatedAt = new Date().toISOString();

      if (!existing.teamId) {
        let fallbackTeam = db.teams[0];
        if (!fallbackTeam) {
          fallbackTeam = {
            id: `team-${uuidv4()}`,
            name: "Equipe Enfermeira Ana",
            managerUserId: "",
            createdAt: new Date().toISOString()
          };
          db.teams.push(fallbackTeam);
        }
        existing.teamId = fallbackTeam.id;
        if (!fallbackTeam.managerUserId) fallbackTeam.managerUserId = existing.id;
      }

      return { user: existing, db };
    }

    let team = db.teams[0];
    if (!team) {
      team = {
        id: `team-${uuidv4()}`,
        name: "Equipe Enfermeira Ana",
        managerUserId: "",
        createdAt: new Date().toISOString()
      };
      db.teams.push(team);
    }

    const demoUser = {
      id: uuidv4(),
      name: "Enfermeira Ana",
      role: "nurse_manager",
      email: demoEmail,
      password: hashPassword(demoPassword),
      teamId: team.id,
      councilType: "COREN",
      councilNumber: "123456",
      councilUf: "SP",
      createdAt: new Date().toISOString()
    };

    db.users.push(demoUser);
    if (!team.managerUserId) {
      team.managerUserId = demoUser.id;
    }
    return { user: demoUser, db };
  });
}

async function alignJoaoTeamOnStartup() {
  const storage = isPostgresMode() ? "postgres" : "file";
  console.log(`[startup:joao-align] storage=${storage}`);

  await withDb((db) => {
    const preAlign = (Array.isArray(db.users) ? db.users : []).filter(isJoaoDevVerificationUser);
    if (!preAlign.length) {
      console.log("[startup:joao-align] user not found before align");
    } else {
      for (const u of preAlign) {
        console.log(`[startup:joao-align] before id=${u.id} email=${u.email} teamId=${u.teamId || "(empty)"}`);
      }
    }

    ensureDbShape(db);

    const postAlign = db.users.filter(isJoaoDevVerificationUser);
    if (!postAlign.length) {
      console.log("[startup:joao-align] user not found after align");
    } else {
      for (const u of postAlign) {
        console.log(`[startup:joao-align] after  id=${u.id} email=${u.email} teamId=${u.teamId}`);
      }
    }

    const outsideRosa = db.patients.filter(
      (p) => String(p?.teamId || "") !== JOAO_DEV_TARGET_TEAM_ID
    ).length;
    console.log(`[startup:joao-align] patients outside team-rosa=${outsideRosa}`);
  });
}

export { migrateLegacyPlaintextPasswords, ensureDemoManagerIfNeeded, alignJoaoTeamOnStartup };
