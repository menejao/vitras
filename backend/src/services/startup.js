import { v4 as uuidv4 } from "uuid";
import {
  IS_PROD,
  DATABASE_URL,
  JWT_SECRET,
  DATA_ENCRYPTION_KEY,
  PATIENT_LOOKUP_HASH_KEY,
  UPSTASH_URL,
  UPSTASH_TOKEN,
  AUDIT_PRUNE_ENABLED
} from "../config.js";
import { withDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
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

function validateProductionConfig() {
  if (!IS_PROD) return; // dev/test: skip

  const warnings = [];
  const errors = [];

  // RDS / DB check — derive driver the same way db.js does
  const dbDriver = DATABASE_URL ? "postgres" : "file";
  if (!DATABASE_URL && dbDriver === "file") {
    errors.push("DATABASE_URL não configurado em produção — banco de dados em arquivo não é permitido");
  }

  // JWT
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    errors.push("JWT_SECRET ausente ou fraco (mínimo 32 caracteres)");
  }

  // Encryption
  if (!DATA_ENCRYPTION_KEY) {
    errors.push("DATA_ENCRYPTION_KEY não configurado em produção — dados sensíveis sem criptografia");
  }

  // Patient lookup hash key (HMAC for CPF/CNS unique-index)
  // F-01: Must be set independently from DATA_ENCRYPTION_KEY — silent fallback is disabled in production.
  if (!PATIENT_LOOKUP_HASH_KEY) {
    errors.push("PATIENT_LOOKUP_HASH_KEY não configurado — exigido para unicidade CPF/CNS em produção (chave separada de DATA_ENCRYPTION_KEY, mínimo 32 caracteres)");
  }

  // Redis/Upstash
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    warnings.push("UPSTASH_REDIS_REST_URL/TOKEN não configurados — rate limiting usando MemoryStore local (fail-open em multi-instância)");
  }

  // Audit prune status
  if (AUDIT_PRUNE_ENABLED) {
    warnings.push("AUDIT_PRUNE_ENABLED=true — prune de audit logs habilitado em produção");
  }

  for (const w of warnings) {
    try {
      // dynamic import avoided — logger may not be ready; use console as safe fallback
      console.warn(JSON.stringify({ level: "warn", event: "boot_config_warning", message: w, timestamp: new Date().toISOString() }));
    } catch (_) {
      console.warn("[boot_config_warning]", w);
    }
  }

  for (const e of errors) {
    try {
      console.error(JSON.stringify({ level: "error", event: "boot_config_error", message: e, timestamp: new Date().toISOString() }));
    } catch (_) {
      console.error("[boot_config_error]", e);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuração de produção inválida: ${errors.join("; ")}`);
  }
}

export { migrateLegacyPlaintextPasswords, ensureDemoManagerIfNeeded, validateProductionConfig };
