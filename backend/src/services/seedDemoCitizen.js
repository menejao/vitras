/**
 * seedDemoCitizen.js — Inicializa conta de demonstração (dev/staging apenas)
 *
 * CPF: 000.000.001-91 (CPF válido, não pertence a cidadão real)
 * Senha: Demo@123
 * isDemo: true
 *
 * Chamado uma vez no startup por server.js (IS_PROD=false).
 * Idempotente — não recria se já existe.
 */

import { v4 as uuidv4 } from "uuid";
import { withDb, computeLookupHash } from "../db.js";
import { hashPassword } from "./crypto.js";
import { PATIENT_LOOKUP_HASH_KEY, IS_PROD } from "../config.js";
import { logInfo } from "../utils/logger.js";

const DEMO_CPF_DIGITS = "00000000191"; // CPF 000.000.001-91 (válido)
const DEMO_PASSWORD   = "Demo@123";
const DEMO_UNIT_ID    = "unit-default";

export async function initDemoCitizen() {
  const seedAllowed = !IS_PROD || process.env.SEED_DEMO_CITIZEN === "true";
  if (!seedAllowed) return;

  await withDb(async (db) => {
    if (!Array.isArray(db.citizenUsers)) db.citizenUsers = [];
    if (!Array.isArray(db.patients))     db.patients     = [];

    const alreadyExists = db.citizenUsers.some((u) => u.isDemo === true);
    if (alreadyExists) return;

    // Paciente fictício
    const patientId = uuidv4();
    db.patients.push({
      id:          patientId,
      name:        "Paciente Demonstração",
      birthDate:   "1990-01-01",
      motherName:  "Mãe Demonstração",
      cpf:         DEMO_CPF_DIGITS,
      cns:         null,
      unitId:      DEMO_UNIT_ID,
      municipalityId: null,
      gender:      "M",
      phone:       null,
      email:       null,
      address:     {},
      createdAt:   new Date().toISOString(),
      _isDemo:     true,
    });

    const cpfHash = computeLookupHash(DEMO_CPF_DIGITS, PATIENT_LOOKUP_HASH_KEY);

    db.citizenUsers.push({
      id:           uuidv4(),
      patientId,
      nome:         "Paciente Demonstração",
      cpfHash,
      passwordHash: hashPassword(DEMO_PASSWORD),
      unitId:       DEMO_UNIT_ID,
      status:       "ACTIVE",
      isDemo:       true,
      createdAt:    new Date().toISOString(),
    });

    logInfo("demo_citizen.seeded", {
      event: "demo_citizen.seeded",
      message: "Conta demo criada (000.000.001-91 / Demo@123)",
    });
  });
}
