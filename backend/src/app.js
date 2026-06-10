// Copyright (c) 2026 Vitras. Todos os direitos reservados.
import express from "express";
import { setupHelmet, setupCors, securityHeadersMiddleware, contentTypeMiddleware } from "./middlewares/security.js";
import { requestLoggingMiddleware } from "./middlewares/logging.js";
import { requestMetricsMiddleware } from "./middlewares/metrics.js";
import { globalRateLimit } from "./middlewares/rate-limits.js";
import { requireAuth } from "./middlewares/auth.js";
import { requireCsrfForCookieAuth } from "./middlewares/csrf.js";
import { globalErrorHandler } from "./middlewares/errors.js";

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
import suppliesRouter from "./routes/supplies.js";
import examsRouter from "./routes/exams.js";
import medicalRecordsRouter from "./routes/medical-records.js";
import tasksRouter from "./routes/tasks.js";
import familyGroupsRouter from "./routes/family-groups.js";
import protocolsRouter from "./routes/protocols.js";
import auditLogsRouter from "./routes/audit-logs.js";
import privacyRouter from "./routes/privacy.js";
import aiRouter from "./routes/ai.js";
import adminRouter from "./routes/admin.js";
import seedAdminRouter from "./routes/seed-admin.js";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

setupHelmet(app);
setupCors(app);

app.use(securityHeadersMiddleware);
app.use(contentTypeMiddleware);
app.use(express.json({ limit: "1mb" }));
app.use(requestLoggingMiddleware);
app.use(requestMetricsMiddleware);
app.use(globalRateLimit);

app.use(healthRouter);
app.use(authRouter);
app.use(labPublicRouter);
app.use(usersRouter);

// S10-03: adminRouter must be AFTER global requireAuth so any new admin route
// added without an inline requireAuth call is still protected by the global
// middleware. Admin routes retain their own inline requireAuth calls for
// defense-in-depth.
app.use(requireAuth);
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
app.use(referralsRouter);
app.use(pharmacyRouter);
app.use(suppliesRouter);
app.use(examsRouter);
app.use(medicalRecordsRouter);
app.use(labNotificationsRouter);
app.use(tasksRouter);
app.use(familyGroupsRouter);
app.use(protocolsRouter);
app.use(auditLogsRouter);
app.use(privacyRouter);
app.use(aiRouter);

app.use(globalErrorHandler);

export default app;
