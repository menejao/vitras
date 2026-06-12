/**
 * D-PRE-07: Auditoria de campo cnsCpf legado em pacientes
 *
 * Objetivo: mapear registros com cnsCpf preenchido para planejar backfill seguro
 * antes da remoção do campo @deprecated.
 *
 * Classificação por regra de backfill:
 *   CPF_CANDIDATE   — cnsCpf tem 11 dígitos numéricos → backfill para cpf
 *   CNS_CANDIDATE   — cnsCpf tem 15 dígitos numéricos → backfill para cns
 *   CONFLICT        — cnsCpf preenchido E cpf/cns já preenchido com valor diferente
 *   REDUNDANT       — cnsCpf igual ao cpf ou cns já existente
 *   INVALID         — cnsCpf presente mas não é 11 nem 15 dígitos numéricos
 *
 * Execução:
 *   node scripts/dpre07-cnscpf-audit.mjs
 *
 * Requer variáveis de ambiente do servidor EB (DATA_ENCRYPTION_KEY ou DATA_ENCRYPTION_KEYS).
 */

const { readDb } = await import("../src/db.js");

let db;
try {
  db = await readDb();
} catch (e) {
  console.error("DB not available:", e.message);
  process.exit(1);
}

const patients = db.patients || [];
const total = patients.length;
const active = patients.filter(p => !p.inactive);
const inactive = patients.filter(p => p.inactive);

// Análise por paciente
const withCnsCpf = patients.filter(p => p.cnsCpf && String(p.cnsCpf).trim() !== "");

const categories = {
  CPF_CANDIDATE: [],
  CNS_CANDIDATE: [],
  CONFLICT_WITH_CPF: [],
  CONFLICT_WITH_CNS: [],
  REDUNDANT: [],
  INVALID: [],
  BOTH_EMPTY_BACKFILL: [] // cnsCpf set, cpf empty AND cns empty
};

for (const p of withCnsCpf) {
  const raw = String(p.cnsCpf || "").trim();
  const digits = raw.replace(/\D/g, "");
  const cpf = String(p.cpf || "").trim();
  const cns = String(p.cns || "").trim();

  const cpfEmpty = !cpf;
  const cnsEmpty = !cns;

  // Check redundancy
  if (raw === cpf || digits === cpf.replace(/\D/g, "")) { categories.REDUNDANT.push(p.id); continue; }
  if (raw === cns || digits === cns) { categories.REDUNDANT.push(p.id); continue; }

  if (digits.length === 11) {
    if (!cpfEmpty && cpf.replace(/\D/g, "") !== digits) {
      categories.CONFLICT_WITH_CPF.push({ id: p.id, name: p.name, cnsCpfLen: digits.length });
    } else {
      categories.CPF_CANDIDATE.push({ id: p.id, name: p.name });
      if (cpfEmpty && cnsEmpty) categories.BOTH_EMPTY_BACKFILL.push({ id: p.id, type: "cpf" });
    }
  } else if (digits.length === 15) {
    if (!cnsEmpty && cns !== digits) {
      categories.CONFLICT_WITH_CNS.push({ id: p.id, name: p.name, cnsCpfLen: digits.length });
    } else {
      categories.CNS_CANDIDATE.push({ id: p.id, name: p.name });
      if (cpfEmpty && cnsEmpty) categories.BOTH_EMPTY_BACKFILL.push({ id: p.id, type: "cns" });
    }
  } else {
    categories.INVALID.push({ id: p.id, name: p.name, rawLength: raw.length, digitsLength: digits.length });
  }
}

const conflicts = categories.CONFLICT_WITH_CPF.length + categories.CONFLICT_WITH_CNS.length;
const safeToBackfill = categories.BOTH_EMPTY_BACKFILL.length;
const needsReview = categories.INVALID.length + conflicts;

console.log("=== D-PRE-07: Auditoria cnsCpf legado ===");
console.log("");
console.log(`Total pacientes: ${total}`);
console.log(`  Ativos:   ${active.length}`);
console.log(`  Inativos: ${inactive.length}`);
console.log("");
console.log(`Com cnsCpf preenchido: ${withCnsCpf.length}`);
console.log(`  CPF_CANDIDATE  (11 dígitos → backfill cpf): ${categories.CPF_CANDIDATE.length}`);
console.log(`  CNS_CANDIDATE  (15 dígitos → backfill cns): ${categories.CNS_CANDIDATE.length}`);
console.log(`  REDUNDANT      (cnsCpf == cpf ou cns):      ${categories.REDUNDANT.length}`);
console.log(`  CONFLICT_CPF   (cnsCpf ≠ cpf existente):   ${categories.CONFLICT_WITH_CPF.length}`);
console.log(`  CONFLICT_CNS   (cnsCpf ≠ cns existente):   ${categories.CONFLICT_WITH_CNS.length}`);
console.log(`  INVALID        (não 11 nem 15 dígitos):     ${categories.INVALID.length}`);
console.log("");
console.log(`Backfill seguro disponível: ${safeToBackfill}`);
console.log(`Requer revisão manual:      ${needsReview}`);
console.log("");

if (needsReview > 0) {
  console.log("--- CONFLITOS (requerem resolução manual antes do backfill) ---");
  for (const c of categories.CONFLICT_WITH_CPF) {
    console.log(`  [CONFLICT_CPF] ${c.id} — ${c.name}`);
  }
  for (const c of categories.CONFLICT_WITH_CNS) {
    console.log(`  [CONFLICT_CNS] ${c.id} — ${c.name}`);
  }
  for (const c of categories.INVALID) {
    console.log(`  [INVALID] ${c.id} — ${c.name} (cnsCpf raw_len=${c.rawLength}, digits=${c.digitsLength})`);
  }
  console.log("");
}

if (withCnsCpf.length === 0) {
  console.log("STATUS: D-PRE-07 PASS — nenhum registro com cnsCpf preenchido");
  console.log("AÇÃO: cnsCpf pode ser removido sem backfill");
} else if (needsReview > 0) {
  console.log("STATUS: D-PRE-07 NEEDS_MANUAL_REVIEW");
  console.log("AÇÃO: resolver conflitos/inválidos antes de executar migration 018");
} else if (safeToBackfill > 0) {
  console.log("STATUS: D-PRE-07 READY_FOR_BACKFILL");
  console.log(`AÇÃO: executar migration 018 (${safeToBackfill} registros serão backfilled)`);
} else {
  console.log("STATUS: D-PRE-07 REDUNDANT_ONLY");
  console.log("AÇÃO: cnsCpf presente apenas como redundância — migration 018 limpa sem risco");
}
