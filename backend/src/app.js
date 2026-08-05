// Copyright (c) 2026 Vitras. Todos os direitos reservados.
import express from "express";
import { setupHelmet, setupCors, securityHeadersMiddleware, contentTypeMiddleware } from "./middlewares/security.js";
import { requestLoggingMiddleware } from "./middlewares/logging.js";
import { requestMetricsMiddleware } from "./middlewares/metrics.js";
import { globalRateLimit } from "./middlewares/rate-limits.js";
import { requireAuth, blockSupportAdminFromClinical } from "./middlewares/auth.js";
import { requireCsrfForCookieAuth } from "./middlewares/csrf.js";
import { globalErrorHandler } from "./middlewares/errors.js";
import compression from "compression";

import { labPublicRouter, labNotificationsRouter } from "./routes/lab.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import meRouter from "./routes/me.js";
import usersRouter from "./routes/users.js";
import patientsRouter from "./routes/patients.js";
import queueRouter from "./routes/queue.js";
import agendaRouter from "./routes/agenda.js";
import referralsRouter from "./routes/referrals.js";
import pharmacyRouter from "./routes/pharmacy.js";
import pharmacyReceitasRouter from "./routes/pharmacy-receitas.js";
import suppliesRouter from "./routes/supplies.js";
import dentalRouter from "./routes/dental.js";
import odontologiaRouter from "./routes/odontologia.js";
import almoxarifadoRouter from "./routes/almoxarifado.js";
import catalogRouter from "./routes/catalog.js";
import examsRouter from "./routes/exams.js";
import examRequestsRouter from "./routes/exam-requests.js";
import medicalRecordsRouter from "./routes/medical-records.js";
import tasksRouter from "./routes/tasks.js";
import familyGroupsRouter from "./routes/family-groups.js";
import protocolsRouter from "./routes/protocols.js";
import auditLogsRouter from "./routes/audit-logs.js";
import privacyRouter from "./routes/privacy.js";
import aiRouter from "./routes/ai.js";
import adminRouter from "./routes/admin.js";
import seedAdminRouter from "./routes/seed-admin.js";
import householdsRouter from "./routes/households.js";
import cdsExportRouter from "./routes/cds-export.js";
import exportBatchRouter from "./routes/export-batch.js";
import acsVisitsRouter from "./routes/acs-visits.js";
import activeSearchRouter from "./routes/active-search.js";
import productionRouter from "./routes/production.js";
import swaggerRouter from "./routes/swagger.js";
import platformRouter from "./routes/platform.js";
import importRouter from "./routes/import.js";
import scheduleRouter from "./routes/schedule.js";
import laboratoryRouter from "./routes/laboratory.js";
import territorialRouter from "./routes/territorial.js";
import citizenPortalRouter     from "./routes/citizen-portal.js";
import citizenPortalAuthRouter         from "./routes/citizen-portal-auth.js";
import citizenPortalAppointmentsRouter from "./routes/citizen-portal-appointments.js";
import citizenPortalUnitRouter         from "./routes/citizen-portal-unit.js";
import citizenPortalProfileRouter      from "./routes/citizen-portal-profile.js";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

setupHelmet(app);
setupCors(app);

// PERF-06: gzip/brotli compression for text payloads ≥1KB.
// Threshold prevents compression overhead on small responses (health, errors, auth tokens).
// Filter excludes already-compressed content types (images, zip, etc.).
// No BREACH risk: VITRAS never reflects secrets in compressed responses — auth tokens
// are in non-reflected headers; patient data is scoped per authenticated user.
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    const ct = res.getHeader("Content-Type") || "";
    if (/image|audio|video|zip|gzip|br|compress/.test(String(ct))) return false;
    return compression.filter(req, res);
  }
}));

app.use(securityHeadersMiddleware);
app.use(contentTypeMiddleware);
app.use(express.json({ limit: "1mb" }));
app.use(requestLoggingMiddleware);
app.use(requestMetricsMiddleware);
app.use(globalRateLimit);

app.use(healthRouter);
app.use(swaggerRouter);
app.use(authRouter);
app.use(labPublicRouter);
app.use(usersRouter);

// S10-03: adminRouter must be AFTER global requireAuth so any new admin route
// added without an inline requireAuth call is still protected by the global
// middleware. Admin routes retain their own inline requireAuth calls for
// defense-in-depth.
app.use(platformRouter);
app.use(territorialRouter);
app.use(citizenPortalRouter);
app.use(citizenPortalAuthRouter);
app.use(citizenPortalAppointmentsRouter);
app.use(citizenPortalUnitRouter);
app.use(citizenPortalProfileRouter);
app.use(requireAuth);
app.use(importRouter);  // MIG-01: before blockSupportAdminFromClinical — import is support_admin territory
app.use(blockSupportAdminFromClinical);  // IAM-01
app.use(requireCsrfForCookieAuth);
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(adminRouter);
app.use(meRouter);
app.use(seedAdminRouter);
app.use(patientsRouter);
app.use(queueRouter);
app.use(agendaRouter);
app.use(scheduleRouter); // schedule config: operacional da UBS, após blockSupportAdminFromClinical
app.use(referralsRouter);
app.use(pharmacyRouter);
app.use(pharmacyReceitasRouter);
app.use(suppliesRouter);
app.use(dentalRouter);
app.use(odontologiaRouter);
app.use(almoxarifadoRouter);
app.use(catalogRouter);
app.use(examsRouter);
app.use(examRequestsRouter);
app.use(medicalRecordsRouter);
app.use(labNotificationsRouter);
app.use(laboratoryRouter);
app.use(tasksRouter);
app.use(familyGroupsRouter);
app.use(protocolsRouter);
app.use(auditLogsRouter);
app.use(privacyRouter);
app.use(aiRouter);
app.use(householdsRouter);
app.use(cdsExportRouter);
app.use(exportBatchRouter);
app.use(acsVisitsRouter);
app.use(activeSearchRouter);
app.use(productionRouter);

app.use(globalErrorHandler);

export default app;
