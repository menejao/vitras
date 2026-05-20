import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { withDb } from "../src/db.js";
import { ensureDbShape } from "../src/utils/domain.js";
import { hashPassword } from "../src/services/crypto.js";
import { addAuditLog } from "../src/services/audit.js";

const DEV_USER = {
  name: "João Benedito (Dev)",
  email: "joao.dev@valens.local",
  role: "developer_readonly",
  teamId: "team-rosa",
  password: "Valens!Dev2026A1"
};

const now = new Date().toISOString();
const dbPath = path.resolve(process.env.TEST_DB_PATH || "./data/dev-db.json");

try {
  await fs.access(dbPath);
} catch {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.writeFile(dbPath, "{}", "utf8");
}

const result = await withDb((db) => {
  ensureDbShape(db);
  const existingIndex = db.users.findIndex(
    (user) => String(user.email || "").trim().toLowerCase() === DEV_USER.email
  );

  if (existingIndex >= 0) {
    const current = db.users[existingIndex];
    const next = {
      ...current,
      name: DEV_USER.name,
      role: DEV_USER.role,
      teamId: DEV_USER.teamId,
      password: hashPassword(DEV_USER.password),
      updatedAt: now
    };
    db.users[existingIndex] = next;
    addAuditLog(
      db,
      { id: "system-seed", name: "Provisionamento Local", role: "break_glass_admin", requestId: "dev-user-update" },
      "user.provisioned_manual",
      "user",
      next.id,
      { role: next.role, email: next.email, teamId: next.teamId, mode: "updated" }
    );
    return { mode: "updated", user: next };
  }

  const user = {
    id: randomUUID(),
    name: DEV_USER.name,
    role: DEV_USER.role,
    email: DEV_USER.email,
    password: hashPassword(DEV_USER.password),
    teamId: DEV_USER.teamId,
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

  db.users.push(user);
  addAuditLog(
    db,
    { id: "system-seed", name: "Provisionamento Local", role: "break_glass_admin", requestId: "dev-user-create" },
    "user.provisioned_manual",
    "user",
    user.id,
    { role: user.role, email: user.email, teamId: user.teamId, mode: "created" }
  );
  return { mode: "created", user };
});

console.log(
  JSON.stringify(
    {
      mode: result.mode,
      email: DEV_USER.email,
      password: DEV_USER.password,
      role: DEV_USER.role,
      teamId: DEV_USER.teamId
    },
    null,
    2
  )
);
