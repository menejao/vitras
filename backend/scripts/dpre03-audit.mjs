/**
 * D-PRE-03: audit patients without assignedAcsId
 * Run: node scripts/dpre03-audit.mjs
 */
process.env.DATA_ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || "smoke-data-enc-key-32bytes-pads!";
process.env.JWT_SECRET = process.env.JWT_SECRET || "smoke-jwt-secret";
process.env.NODE_ENV = "test";

const { readDb } = await import("../src/db.js");

let db;
try {
  db = await readDb();
} catch (e) {
  console.log("DB not available:", e.message);
  db = { patients: [] };
}

const pts = db.patients || [];
const total = pts.length;
const missing = pts.filter(p => !p.assignedAcsId || String(p.assignedAcsId).trim() === "");
const inactive = pts.filter(p => p.inactive);
const active = pts.filter(p => !p.inactive);
const activeMissing = active.filter(p => !p.assignedAcsId || String(p.assignedAcsId).trim() === "");

console.log("=== D-PRE-03: Pacientes sem ACS atribuído ===");
console.log(`Total pacientes: ${total}`);
console.log(`Ativos: ${active.length}`);
console.log(`Inativos: ${inactive.length}`);
console.log(`Sem assignedAcsId (total): ${missing.length} (${total ? ((missing.length/total)*100).toFixed(1) : 0}%)`);
console.log(`Sem assignedAcsId (ativos): ${activeMissing.length} (${active.length ? ((activeMissing.length/active.length)*100).toFixed(1) : 0}%)`);
console.log("");
if (activeMissing.length > 0) {
  console.log("STATUS: PHASE 6 NOT READY — pacientes ativos sem ACS");
  console.log("Ação: atribuir ACS antes de ativar restrição RBAC ACS");
} else {
  console.log("STATUS: D-PRE-03 OK — todos os pacientes ativos têm ACS");
}
