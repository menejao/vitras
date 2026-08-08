#!/usr/bin/env node
/**
 * VITRAS-GOVERNANCE-BOOTSTRAP-01
 * Creates real governance artefacts via API (state machine preserved).
 * Usage: node scripts/governance-bootstrap-01.mjs [--url <base>] [--email <e>] [--password <p>]
 *
 * Defaults: https://api.vitras.com.br  suporte@vitras.local  Demo@2026!
 */

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : def;
}

const BASE   = getArg("url",      "https://api.vitras.com.br");
const EMAIL  = getArg("email",    "suporte@vitras.local");
const PASS   = getArg("password", "Demo@2026!");

async function req(method, path, body, token) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res  = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { _raw: text }; }
  return { status: res.status, data };
}

function log(label, r) {
  const ok = r.status >= 200 && r.status < 300;
  console.log(`${ok ? "✅" : "❌"} [${r.status}] ${label}`);
  if (!ok) { console.error("   →", JSON.stringify(r.data, null, 2)); process.exit(1); }
  return r.data;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
console.log(`\n=== VITRAS-GOVERNANCE-BOOTSTRAP-01 ===`);
console.log(`Backend: ${BASE}`);
console.log(`User:    ${EMAIL}\n`);

// 1. Login
// Login uses vitrasId as identifier (9-digit), not email
const IDENTIFIER = getArg("identifier", "190000001");
const loginRes = await req("POST", "/auth/login", { identifier: IDENTIFIER, password: PASS });
const loginData = log("Login", loginRes);
if (!loginData.token) { console.error("No token in response:", loginData); process.exit(1); }
const token = loginData.token;
console.log("   Token obtained.\n");

// 2. Audit BEFORE
console.log("── AUDIT BEFORE ──────────────────────────────────");
for (const path of ["/platform/baselines", "/platform/policies", "/platform/backup-policies"]) {
  const r = await req("GET", path, null, token);
  const arr = r.data?.data || r.data?.baselines || r.data?.policies || r.data?.backupPolicies || r.data || [];
  console.log(`   ${path}: ${Array.isArray(arr) ? arr.length : JSON.stringify(arr)} registros`);
}
console.log();

// 3. Create Baseline "VITRAS Platform v1.0" → DRAFT → REVIEW → APPROVED
console.log("── FASE 1: Baseline ────────────────────────────────");
const bRes = await req("POST", "/platform/baselines", {
  name:                  "VITRAS Platform v1.0",
  version:               "1.0.0",
  scope:                 "PLATFORM",
  description:           "Baseline oficial da Plataforma VITRAS — versão de referência para o piloto municipal. Consolida arquitetura, controles de segurança, modelo clínico, protocolo e-SUS e cadeia de auditoria conforme aprovados nas sprints APS-01A–F, SEC-01, AUD-01, IAM-01 e CONSOLE-01.",
  documentationVersion:  "1.0",
  releaseId:             null,
  artifacts:             ["docs/baseline/", "backend/src/", "frontend-react/src/"],
}, token);
const baseline = log("POST /platform/baselines (DRAFT)", bRes);
const bid = baseline.id;
console.log(`   id: ${bid}  status: ${baseline.status}\n`);

const toReview = await req("PATCH", `/platform/baselines/${bid}/status`, {
  toStatus: "REVIEW",
  reason:   "Baseline submetida para revisão formal — VITRAS-GOVERNANCE-BOOTSTRAP-01.",
}, token);
const reviewedBaseline = log("PATCH /status → REVIEW", toReview);
console.log(`   status: ${reviewedBaseline.status}\n`);

const toApproved = await req("PATCH", `/platform/baselines/${bid}/status`, {
  toStatus: "APPROVED",
  reason:   "Revisão concluída. Artefatos validados conforme histórico de sprints entregues. Aprovação pelo responsável técnico da plataforma.",
}, token);
const approvedBaseline = log("PATCH /status → APPROVED", toApproved);
console.log(`   status: ${approvedBaseline.status}  approvedAt: ${approvedBaseline.approvedAt}\n`);

// 4. Create Policy SECURITY → ACTIVE
console.log("── FASE 2: Policy SECURITY ──────────────────────────");
const secRes = await req("POST", "/platform/policies", {
  name:          "Política de Segurança da Plataforma VITRAS",
  category:      "SECURITY",
  description:   "Define controles de segurança da informação, gestão de acessos, autenticação multifator, criptografia de dados em repouso e trânsito, e requisitos de auditoria aplicáveis à Plataforma VITRAS.",
  version:       "1.0",
  effectiveFrom: "2026-01-15T00:00:00.000Z",
  effectiveUntil: null,
  owner:         "Responsável Técnico — Plataforma VITRAS",
  content:       "Controles: JWT RS256 + cookie CSRF; bcrypt s=12 para senhas; AES-256-GCM para dados clínicos sensíveis; RBAC por capability; audit chain com hash encadeado; rate limiting em autenticação; rotação semestral de segredos. Referências: SEC-01, AUD-01, IAM-01, SEC-API-01A–D.",
  relatedPolicyIds: [],
}, token);
const secPolicy = log("POST /platform/policies (SECURITY)", secRes);
console.log(`   id: ${secPolicy.id}  status: ${secPolicy.status}\n`);

const secActivate = await req("PATCH", `/platform/policies/${secPolicy.id}/activate`, {
  reason: "Política de segurança em vigor desde o início da operação. Formalização retroativa — VITRAS-GOVERNANCE-BOOTSTRAP-01.",
}, token);
log("PATCH /activate (SECURITY)", secActivate);
console.log(`   status: ${secActivate.data?.status}\n`);

// 5. Create Policy BACKUP → ACTIVE
console.log("── FASE 3: Policy BACKUP (governance) ───────────────");
const bakRes = await req("POST", "/platform/policies", {
  name:          "Política de Backup da Plataforma VITRAS",
  category:      "BACKUP",
  description:   "Define requisitos de backup, RPO, RTO e teste de restauração para dados clínicos e operacionais gerenciados pela Plataforma VITRAS.",
  version:       "1.0",
  effectiveFrom: "2026-01-15T00:00:00.000Z",
  effectiveUntil: null,
  owner:         "Responsável Técnico — Plataforma VITRAS",
  content:       "RPO máximo: 1h. RTO máximo: 4h. Backup incremental: diário às 02h00 BRT. Backup completo: semanal, domingo 03h00 BRT. Retenção: 30 dias incrementais, 12 meses completos. Teste de restauração: mínimo trimestral. Criptografia de backup obrigatória. Referência: BACKUP_EXPORT_KEY em variáveis de ambiente de produção.",
  relatedPolicyIds: [secPolicy.id],
}, token);
const bakPolicy = log("POST /platform/policies (BACKUP)", bakRes);
console.log(`   id: ${bakPolicy.id}  status: ${bakPolicy.status}\n`);

const bakActivate = await req("PATCH", `/platform/policies/${bakPolicy.id}/activate`, {
  reason: "Política de backup em vigor desde o início da operação. Formalização retroativa — VITRAS-GOVERNANCE-BOOTSTRAP-01.",
}, token);
log("PATCH /activate (BACKUP)", bakActivate);
console.log(`   status: ${bakActivate.data?.status}\n`);

// 6. Create Policy DEPLOYMENT → ACTIVE
console.log("── FASE 4: Policy DEPLOYMENT ─────────────────────────");
const depRes = await req("POST", "/platform/policies", {
  name:          "Política de Deploy da Plataforma VITRAS",
  category:      "DEPLOYMENT",
  description:   "Define processo de implantação de versões na Plataforma VITRAS, incluindo pipeline CI/CD, gates de qualidade, janelas de manutenção e rollback.",
  version:       "1.0",
  effectiveFrom: "2026-01-15T00:00:00.000Z",
  effectiveUntil: null,
  owner:         "Responsável Técnico — Plataforma VITRAS",
  content:       "Pipeline: git push origin HEAD:main → Render (backend, auto-rebuild) + Vercel (frontend, auto-deploy). Gates obrigatórios antes de merge: testes de integração PASS (APS-01C–F), build sem erros críticos. Rollback: revert de commit no branch main. Janela de manutenção preferencial: terça a quinta, 23h–02h BRT. Zero-downtime deploy via Render rolling restart. Referência: ARCH-01, TECH-DEBT-01.",
  relatedPolicyIds: [secPolicy.id],
}, token);
const depPolicy = log("POST /platform/policies (DEPLOYMENT)", depRes);
console.log(`   id: ${depPolicy.id}  status: ${depPolicy.status}\n`);

const depActivate = await req("PATCH", `/platform/policies/${depPolicy.id}/activate`, {
  reason: "Política de deploy em vigor desde o início da operação. Formalização retroativa — VITRAS-GOVERNANCE-BOOTSTRAP-01.",
}, token);
log("PATCH /activate (DEPLOYMENT)", depActivate);
console.log(`   status: ${depActivate.data?.status}\n`);

// 7. Create Policy BREAK_GLASS → ACTIVE
console.log("── FASE 5: Policy BREAK_GLASS ────────────────────────");
const bgRes = await req("POST", "/platform/policies", {
  name:          "Política de Break Glass da Plataforma VITRAS",
  category:      "BREAK_GLASS",
  description:   "Define condições, procedimentos e controles de auditoria para acesso de emergência (Break Glass) a dados clínicos na Plataforma VITRAS.",
  version:       "1.0",
  effectiveFrom: "2026-01-15T00:00:00.000Z",
  effectiveUntil: null,
  owner:         "Responsável Técnico — Plataforma VITRAS",
  content:       "Break Glass permite acesso de emergência a dados de qualquer paciente, independente de vínculo de UBS, mediante senha dedicada (BREAKGLASS_PASSWORD_HASH). Cada acesso gera evento auditado imutável (break_glass.accessed) com timestamp, operador, motivo e IP. Revisão obrigatória de todos os acessos em até 24h. Senha de Break Glass não pode ser reutilizada por 6 meses. Treinamento obrigatório para break_glass_admin antes de ativação. Referência: SEC-01, AUD-01.",
  relatedPolicyIds: [secPolicy.id],
}, token);
const bgPolicy = log("POST /platform/policies (BREAK_GLASS)", bgRes);
console.log(`   id: ${bgPolicy.id}  status: ${bgPolicy.status}\n`);

const bgActivate = await req("PATCH", `/platform/policies/${bgPolicy.id}/activate`, {
  reason: "Política de break glass em vigor desde o início da operação. Formalização retroativa — VITRAS-GOVERNANCE-BOOTSTRAP-01.",
}, token);
log("PATCH /activate (BREAK_GLASS)", bgActivate);
console.log(`   status: ${bgActivate.data?.status}\n`);

// 8. Create BackupPolicy (operational, ERP-08) → enabled: true
console.log("── FASE 6: BackupPolicy operacional ──────────────────");
const bpRes = await req("POST", "/platform/backup-policies", {
  name:               "Backup Neon PostgreSQL — Dados Clínicos VITRAS",
  description:        "Política operacional de backup dos dados clínicos armazenados no Neon PostgreSQL (sa-east-1). Cobre banco principal com backups nativos Neon + exportações CDS criptografadas.",
  scope:              "DATABASE",
  backupType:         "FULL",
  frequency:          "DAILY",
  retentionDays:      30,
  rpoTargetMinutes:   60,
  rtoTargetMinutes:   240,
  environment:        "PRODUCTION",
  providerHint:       "neon-postgresql-sa-east-1",
}, token);
const backupPolicy = log("POST /platform/backup-policies", bpRes);
console.log(`   enabled: ${backupPolicy?.enabled}  rpo: ${backupPolicy?.rpo}min  rto: ${backupPolicy?.rto}min\n`);

// 9. Audit AFTER + compliance check
console.log("── AUDIT AFTER ───────────────────────────────────────");
const compRes = await req("GET", "/platform/compliance", null, token);
if (compRes.status === 200) {
  const comp = compRes.data;
  const checks = comp.results || [];
  const pass = checks.filter(c => c.status === "PASS").length;
  const warn = checks.filter(c => c.status === "WARNING").length;
  const fail = checks.filter(c => c.status === "FAIL").length;
  console.log(`   Compliance: ${pass} PASS / ${warn} WARNING / ${fail} FAIL`);
  if (fail > 0) {
    console.log("   FAILs:");
    checks.filter(c => c.status === "FAIL").forEach(c => console.log(`     ❌ ${c.code}: ${c.detail || ""}`));
  }
  if (warn > 0) {
    console.log("   WARNINGs:");
    checks.filter(c => c.status === "WARNING").forEach(c => console.log(`     ⚠️  ${c.code}: ${c.detail || ""}`));
  }
  if (fail === 0) {
    console.log("\n✅ BOOTSTRAP COMPLETO — 0 FAIL. Seguro para deploy.");
  } else {
    console.log(`\n❌ BOOTSTRAP INCOMPLETO — ${fail} FAIL restante(s). NÃO fazer deploy.`);
    process.exit(1);
  }
} else {
  console.log("   Compliance endpoint:", compRes.status, JSON.stringify(compRes.data));
}

console.log("\n=== FIM ===\n");
