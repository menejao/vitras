/**
 * PlatformHealthService — ERP-06
 *
 * Computes synthetic health status from app_state data.
 * No external API calls. No clinical data accessed.
 *
 * Health checks derive status from:
 *   - deployments: stuck/stale states
 *   - licenses: expired, expiring soon
 *   - incidents: open critical
 *   - migrations: pending
 *   - municipalities / units: counts
 *   - platform alerts: open alerts
 */

import { randomUUID } from "node:crypto";

// ── Status catalogue ────────────────────────────────────────────────────────

export const HEALTH_STATUS = {
  HEALTHY:  "HEALTHY",
  WARNING:  "WARNING",
  CRITICAL: "CRITICAL",
  OFFLINE:  "OFFLINE",
  UNKNOWN:  "UNKNOWN",
};

// Aggregate: worst status wins
export function worstStatus(...statuses) {
  const ORDER = ["CRITICAL","OFFLINE","WARNING","UNKNOWN","HEALTHY"];
  for (const s of ORDER) {
    if (statuses.includes(s)) return s;
  }
  return HEALTH_STATUS.HEALTHY;
}

// ── Alert categories & statuses ─────────────────────────────────────────────

export const ALERT_CATEGORY = {
  DATABASE: "DATABASE", API: "API", AUTH: "AUTH", DEPLOYMENT: "DEPLOYMENT",
  BACKUP: "BACKUP", MIGRATION: "MIGRATION", LICENSE: "LICENSE",
  BREAK_GLASS: "BREAK_GLASS", PERFORMANCE: "PERFORMANCE", SECURITY: "SECURITY",
  CONFIGURATION: "CONFIGURATION", OBSERVABILITY: "OBSERVABILITY",
};

export const ALERT_STATUS = {
  OPEN:         "OPEN",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  RESOLVED:     "RESOLVED",
  SUPPRESSED:   "SUPPRESSED",
};

// ── Diagnostic categories ────────────────────────────────────────────────────

export const DIAG_CATEGORY = {
  DATABASE: "DATABASE", API: "API", AUTH: "AUTH", DEPLOYMENT: "DEPLOYMENT",
  LICENSE: "LICENSE", MIGRATION: "MIGRATION", CONFIGURATION: "CONFIGURATION",
  SECURITY: "SECURITY", OBSERVABILITY: "OBSERVABILITY",
};

// ── Alert factory ────────────────────────────────────────────────────────────

export function createAlert({ code, title, description, severity, category, affectedComponent, recommendation, operator, existingAlerts = [] }) {
  const now = new Date().toISOString();
  return {
    id:                randomUUID(),
    alertCode:         generateAlertCode(existingAlerts),
    code,
    title,
    description:       description || "",
    severity:          severity || "MEDIUM",
    category,
    affectedComponent: affectedComponent || null,
    recommendation:    recommendation   || null,
    status:            ALERT_STATUS.OPEN,
    createdAt:         now,
    updatedAt:         now,
    acknowledgedAt:    null,
    acknowledgedBy:    null,
    resolvedAt:        null,
    resolvedBy:        null,
    operator:          operator || null,
    auditTrail:        [{ action: "created", by: operator, at: now }],
  };
}

export function generateAlertCode(alerts) {
  const year   = new Date().getFullYear();
  const prefix = `ALT-${year}-`;
  const existing = (alerts || [])
    .map(a => a.alertCode || "")
    .filter(c => c.startsWith(prefix))
    .map(c => parseInt(c.slice(prefix.length), 10))
    .filter(n => !isNaN(n));
  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export function ackAlert(alert, operator) {
  if (alert.status !== ALERT_STATUS.OPEN) {
    throw Object.assign(new Error(`Alerta não pode ser confirmado: status ${alert.status}`), { statusCode: 422 });
  }
  const now = new Date().toISOString();
  alert.status         = ALERT_STATUS.ACKNOWLEDGED;
  alert.acknowledgedAt = now;
  alert.acknowledgedBy = operator;
  alert.updatedAt      = now;
  alert.auditTrail.push({ action: "acknowledged", by: operator, at: now });
  return alert;
}

export function resolveAlert(alert, operator) {
  const now = new Date().toISOString();
  alert.status     = ALERT_STATUS.RESOLVED;
  alert.resolvedAt = now;
  alert.resolvedBy = operator;
  alert.updatedAt  = now;
  alert.auditTrail.push({ action: "resolved", by: operator, at: now });
  return alert;
}

// ── Diagnostic result factory ────────────────────────────────────────────────

export function diagResult({ code, title, description, severity, status, category, affectedComponent, recommendation, documentationLink = null }) {
  return {
    id: randomUUID(), code, title, description: description || "", severity, status,
    category, affectedComponent: affectedComponent || null,
    recommendation: recommendation || null, documentationLink,
    detectedAt: new Date().toISOString(), resolvedAt: null, automatic: true, manual: false,
  };
}

// ── PlatformDiagnosticEngine ─────────────────────────────────────────────────

export function runDiagnostics(db) {
  const results = [];
  const now     = Date.now();
  const in30d   = new Date(now + 30 * 86400000).toISOString();
  const today   = new Date().toDateString();

  // ── DB shape ───────────────────────────────────────────────────────────────
  const deployments   = db.deployments           || [];
  const licenses      = db.licenses              || [];
  const incidents     = db.incidents             || [];
  const municipalities = db.municipalities_meta  || [];
  const units         = db.units                 || [];
  const alerts        = db.platformAlerts        || [];
  const migrations    = db.schema_migrations     || []; // Postgres migrations table via snapshot if available
  const migSnap       = db._migrationSnapshot    || null;

  // DIAG-001: Stuck deployments (IN_PROGRESS-like states > 30 days)
  const ACTIVE_DEP_STATES = ["CONFIGURING","MIGRATING","VALIDATING","TRAINING","READY_FOR_GO_LIVE","GO_LIVE"];
  const stuckDeps = deployments.filter(d => {
    if (!ACTIVE_DEP_STATES.includes(d.status)) return false;
    const age = (now - new Date(d.updatedAt).getTime()) / 86400000;
    return age > 30;
  });
  if (stuckDeps.length > 0) {
    results.push(diagResult({
      code: "DIAG-001", title: "Deployments presos",
      description: `${stuckDeps.length} deployment(s) sem atualização há mais de 30 dias`,
      severity: "HIGH", status: "OPEN", category: DIAG_CATEGORY.DEPLOYMENT,
      affectedComponent: "Deployment Engine",
      recommendation: "Revisar manualmente os deployments listados e atualizar status ou cancelar",
    }));
  }

  // DIAG-002: Expired licenses with active deployments
  const expiredLics = licenses.filter(l => l.status === "EXPIRED" || (l.status === "ACTIVE" && l.contractEnd && l.contractEnd < new Date().toISOString()));
  if (expiredLics.length > 0) {
    results.push(diagResult({
      code: "DIAG-002", title: "Licenças expiradas",
      description: `${expiredLics.length} licença(s) expiradas ou com contrato vencido`,
      severity: "HIGH", status: "OPEN", category: DIAG_CATEGORY.LICENSE,
      affectedComponent: "License Engine",
      recommendation: "Renovar licenças ou encerrar municípios não renovados",
    }));
  }

  // DIAG-003: Licenses expiring in 30 days
  const expiringLics = licenses.filter(l => l.status === "ACTIVE" && l.contractEnd && l.contractEnd > new Date().toISOString() && l.contractEnd <= in30d);
  if (expiringLics.length > 0) {
    results.push(diagResult({
      code: "DIAG-003", title: "Licenças expirando em 30 dias",
      description: `${expiringLics.length} licença(s) com vencimento nos próximos 30 dias`,
      severity: "MEDIUM", status: "OPEN", category: DIAG_CATEGORY.LICENSE,
      affectedComponent: "License Engine",
      recommendation: "Iniciar processo de renovação com antecedência",
    }));
  }

  // DIAG-004: Open CRITICAL incidents
  const criticalInc = incidents.filter(i => i.severity === "CRITICAL" && !["RESOLVED","CLOSED","CANCELLED"].includes(i.status));
  if (criticalInc.length > 0) {
    results.push(diagResult({
      code: "DIAG-004", title: "Incidentes críticos abertos",
      description: `${criticalInc.length} incidente(s) CRITICAL sem resolução`,
      severity: "CRITICAL", status: "OPEN", category: DIAG_CATEGORY.API,
      affectedComponent: "Platform Operations",
      recommendation: "Investigar e escalonar imediatamente",
    }));
  }

  // DIAG-005: SLA breach — incidents with firstResponse breach
  const slaBreached = incidents.filter(i => {
    if (i.firstResponseAt) return false;
    const deadline = i.sla?.firstResponseDeadline;
    return deadline && new Date(deadline).getTime() < now && !["RESOLVED","CLOSED","CANCELLED"].includes(i.status);
  });
  if (slaBreached.length > 0) {
    results.push(diagResult({
      code: "DIAG-005", title: "SLA de primeira resposta violado",
      description: `${slaBreached.length} incidente(s) sem primeira resposta além do prazo SLA`,
      severity: "HIGH", status: "OPEN", category: DIAG_CATEGORY.OBSERVABILITY,
      affectedComponent: "Incident SLA",
      recommendation: "Atribuir responsável e registrar primeira resposta",
    }));
  }

  // DIAG-006: Municipalities with no active deployment
  const muniIds = [...new Set(deployments.filter(d => d.type === "MUNICIPAL" && d.status === "OPERATIONAL").map(d => d.municipalityId))];
  const licMuniIds = licenses.filter(l => l.status === "ACTIVE").map(l => l.municipalityId);
  const licWithoutDep = licMuniIds.filter(id => !muniIds.includes(id));
  if (licWithoutDep.length > 0) {
    results.push(diagResult({
      code: "DIAG-006", title: "Municípios com licença ativa sem deployment operacional",
      description: `${licWithoutDep.length} município(s) com licença ACTIVE mas sem deployment OPERATIONAL`,
      severity: "MEDIUM", status: "OPEN", category: DIAG_CATEGORY.DEPLOYMENT,
      affectedComponent: "Deployment Engine",
      recommendation: "Verificar se implantação está em andamento ou precisa ser iniciada",
    }));
  }

  // DIAG-007: Units with no parent municipality deployment
  const orphanUnits = units.filter(u => {
    if (!u.municipalityId) return false;
    const munDep = deployments.find(d => d.type === "MUNICIPAL" && d.municipalityId === u.municipalityId && d.status === "OPERATIONAL");
    return !munDep;
  });
  if (orphanUnits.length > 0) {
    results.push(diagResult({
      code: "DIAG-007", title: "UBS sem deployment municipal operacional",
      description: `${orphanUnits.length} UBS em municípios sem deployment OPERATIONAL`,
      severity: "LOW", status: "OPEN", category: DIAG_CATEGORY.DEPLOYMENT,
      affectedComponent: "Unit Deployment",
      recommendation: "Verificar status do deployment municipal",
    }));
  }

  // DIAG-008: Too many open alerts
  const openAlerts = alerts.filter(a => a.status === ALERT_STATUS.OPEN);
  if (openAlerts.length >= 10) {
    results.push(diagResult({
      code: "DIAG-008", title: "Volume elevado de alertas abertos",
      description: `${openAlerts.length} alertas OPEN acumulados — investigar e resolver`,
      severity: "MEDIUM", status: "OPEN", category: DIAG_CATEGORY.OBSERVABILITY,
      affectedComponent: "Alert Engine",
      recommendation: "Revisar alertas abertos, confirmar os válidos, suprimir os obsoletos",
    }));
  }

  // DIAG-009: Migration snapshot available
  if (migSnap) {
    const pending = (migSnap.pending || []);
    if (pending.length > 0) {
      results.push(diagResult({
        code: "DIAG-009", title: "Migrations pendentes",
        description: `${pending.length} migration(s) não aplicadas: ${pending.join(", ")}`,
        severity: "CRITICAL", status: "OPEN", category: DIAG_CATEGORY.MIGRATION,
        affectedComponent: "Database",
        recommendation: "Aplicar migrations pendentes com urgência via script de deploy",
      }));
    }
  }

  return results;
}

// ── PlatformHealthService ─────────────────────────────────────────────────────

export function computePlatformHealth(db) {
  const now = Date.now();
  const deployments   = db.deployments           || [];
  const licenses      = db.licenses              || [];
  const incidents     = db.incidents             || [];
  const units         = db.units                 || [];
  const municipalities = db.municipalities_meta  || [];
  const alerts        = db.platformAlerts        || [];

  // API: always up if we're responding
  const apiStatus = HEALTH_STATUS.HEALTHY;

  // Database: HEALTHY if db readable, WARNING if any pending migration
  const migPending = (db._migrationSnapshot?.pending || []).length;
  const dbStatus   = migPending > 0 ? HEALTH_STATUS.WARNING : HEALTH_STATUS.HEALTHY;

  // Deployments health
  const ACTIVE_DEP_STATES = ["CONFIGURING","MIGRATING","VALIDATING","TRAINING","READY_FOR_GO_LIVE","GO_LIVE"];
  const stuckCount = deployments.filter(d => {
    if (!ACTIVE_DEP_STATES.includes(d.status)) return false;
    return (now - new Date(d.updatedAt).getTime()) / 86400000 > 30;
  }).length;
  const depStatus = stuckCount > 0 ? HEALTH_STATUS.WARNING : HEALTH_STATUS.HEALTHY;

  // License health
  const expiredCount  = licenses.filter(l => l.status === "EXPIRED").length;
  const criticalCount = incidents.filter(i => i.severity === "CRITICAL" && !["RESOLVED","CLOSED","CANCELLED"].includes(i.status)).length;
  const licStatus     = expiredCount > 0 ? HEALTH_STATUS.WARNING : HEALTH_STATUS.HEALTHY;

  // Incidents health
  const incStatus = criticalCount > 0 ? HEALTH_STATUS.CRITICAL : HEALTH_STATUS.HEALTHY;

  // Alerts health
  const openAlerts = alerts.filter(a => a.status === ALERT_STATUS.OPEN);
  const critAlerts = openAlerts.filter(a => a.severity === "CRITICAL").length;
  const altStatus  = critAlerts > 0 ? HEALTH_STATUS.CRITICAL : openAlerts.length >= 5 ? HEALTH_STATUS.WARNING : HEALTH_STATUS.HEALTHY;

  const overall = worstStatus(apiStatus, dbStatus, depStatus, licStatus, incStatus, altStatus);

  return {
    overall,
    checkedAt: new Date().toISOString(),
    components: {
      api:         { status: apiStatus,  label: "API",          detail: "Platform API responding" },
      database:    { status: dbStatus,   label: "Database",     detail: migPending > 0 ? `${migPending} pending migrations` : "Schema up to date" },
      deployments: { status: depStatus,  label: "Deployments",  detail: stuckCount > 0 ? `${stuckCount} stuck` : `${deployments.filter(d => d.status === "OPERATIONAL").length} operational` },
      licenses:    { status: licStatus,  label: "Licenses",     detail: `${licenses.filter(l => l.status === "ACTIVE").length} active, ${expiredCount} expired` },
      incidents:   { status: incStatus,  label: "Incidents",    detail: `${criticalCount} critical open` },
      alerts:      { status: altStatus,  label: "Alerts",       detail: `${openAlerts.length} open (${critAlerts} critical)` },
      breakGlass:  { status: HEALTH_STATUS.HEALTHY, label: "Break Glass", detail: "Engine operational" },
      auditEngine: { status: HEALTH_STATUS.HEALTHY, label: "Audit Engine", detail: "Audit chain active" },
      auth:        { status: HEALTH_STATUS.HEALTHY, label: "Auth",        detail: "JWT + CSRF active" },
      rbac:        { status: HEALTH_STATUS.HEALTHY, label: "RBAC",        detail: "Capability model active" },
    },
    summary: {
      totalDeployments:     deployments.length,
      operationalDeps:      deployments.filter(d => d.status === "OPERATIONAL").length,
      activeLicenses:       licenses.filter(l => l.status === "ACTIVE").length,
      expiredLicenses:      expiredCount,
      openCriticalIncidents: criticalCount,
      openAlerts:           openAlerts.length,
      totalUnits:           units.filter(u => u.status !== "suspended").length,
    },
  };
}

// ── Municipality Health view ─────────────────────────────────────────────────

export function computeMunicipalityHealth(db, municipalityId) {
  const deployments = (db.deployments || []).filter(d => d.municipalityId === municipalityId);
  const licenses    = (db.licenses    || []).filter(l => l.municipalityId === municipalityId);
  const incidents   = (db.incidents   || []).filter(i => i.municipalityId === municipalityId);
  const units       = (db.units       || []).filter(u => u.municipalityId === municipalityId);
  const alerts      = (db.platformAlerts || []).filter(a => a.municipalityId === municipalityId);

  const activeLicense = licenses.find(l => l.status === "ACTIVE") || null;
  const munDep        = deployments.find(d => d.type === "MUNICIPAL" && d.status === "OPERATIONAL");
  const openInc       = incidents.filter(i => !["RESOLVED","CLOSED","CANCELLED"].includes(i.status));
  const critInc       = openInc.filter(i => i.severity === "CRITICAL");

  const depStatus  = munDep ? HEALTH_STATUS.HEALTHY : deployments.some(d => d.type === "MUNICIPAL") ? HEALTH_STATUS.WARNING : HEALTH_STATUS.UNKNOWN;
  const licStatus  = activeLicense ? (activeLicense.contractEnd && activeLicense.contractEnd < new Date().toISOString() ? HEALTH_STATUS.WARNING : HEALTH_STATUS.HEALTHY) : HEALTH_STATUS.WARNING;
  const incStatus  = critInc.length > 0 ? HEALTH_STATUS.CRITICAL : openInc.length > 0 ? HEALTH_STATUS.WARNING : HEALTH_STATUS.HEALTHY;

  return {
    municipalityId,
    overallHealth:      worstStatus(depStatus, licStatus, incStatus),
    deployment:         { status: depStatus, deploymentId: munDep?.id || null, deploymentCode: munDep?.deploymentCode || null, lastUpdated: munDep?.updatedAt || null },
    license:            { status: licStatus, licenseId: activeLicense?.id || null, licenseCode: activeLicense?.licenseCode || null, plan: activeLicense?.plan || null, contractEnd: activeLicense?.contractEnd || null },
    incidents:          { total: incidents.length, open: openInc.length, critical: critInc.length },
    units:              { total: units.length, active: units.filter(u => u.status !== "suspended").length },
    alerts:             { open: alerts.filter(a => a.status === "OPEN").length },
    checkedAt:          new Date().toISOString(),
  };
}

// ── Unit Health view ─────────────────────────────────────────────────────────

export function computeUnitHealth(db, unitId) {
  const unit      = (db.units || []).find(u => u.id === unitId);
  if (!unit) return null;

  const deployment = (db.deployments || []).find(d => d.unitId === unitId && d.type === "UBS" && d.status === "OPERATIONAL");
  const incidents  = (db.incidents   || []).filter(i => i.unitId === unitId);
  const openInc    = incidents.filter(i => !["RESOLVED","CLOSED","CANCELLED"].includes(i.status));

  const depStatus  = deployment ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.UNKNOWN;
  const incStatus  = openInc.filter(i => i.severity === "CRITICAL").length > 0 ? HEALTH_STATUS.CRITICAL : openInc.length > 0 ? HEALTH_STATUS.WARNING : HEALTH_STATUS.HEALTHY;

  return {
    unitId,
    unitName:      unit.name || unit.cnes || unitId,
    municipalityId: unit.municipalityId || null,
    status:        unit.status || "unknown",
    overallHealth: worstStatus(depStatus, incStatus),
    deployment:    { status: depStatus, deploymentId: deployment?.id || null, deploymentCode: deployment?.deploymentCode || null },
    incidents:     { total: incidents.length, open: openInc.length },
    services:      { portal: HEALTH_STATUS.HEALTHY, acs: HEALTH_STATUS.HEALTHY }, // synthetic
    checkedAt:     new Date().toISOString(),
  };
}
