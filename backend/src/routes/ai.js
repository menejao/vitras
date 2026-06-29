import express from "express";
import { readDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";
import { isManager } from "../utils/helpers.js";
import { getPatientOrError } from "../utils/patients.js";
import { buildAiPatientContext, buildAiTeamContexts } from "../utils/metrics.js";
import {
  patientSummary,
  protocolHighlights,
  evolutionDraft,
  acsMessage,
  suggestProtocolCategory,
  transcribePayload,
  teamPriorities,
  dataQualityChecks,
  teamReport,
  chatAnswer
} from "../ai.js";

const router = express.Router();

router.get("/ai/status", (_req, res) => {
  const provider = String(process.env.AI_PROVIDER || "local").trim().toLowerCase();
  return res.json({
    provider,
    mode: provider === "openai" ? "online" : "local-heuristico",
    features: [
      "patient-summary",
      "protocol-highlights",
      "daily-priorities",
      "evolution-draft",
      "acs-message",
      "data-quality",
      "chat",
      "team-report",
      "category-suggestion",
      "transcription-structuring"
    ]
  });
});

router.post("/ai/patients/:id/summary", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const lookup = getPatientOrError(db, req.user, req.params.id);
  if (lookup.error) return res.status(lookup.error.status).json({ error: lookup.error.message });
  const context = buildAiPatientContext(db, req.user, lookup.patient);
  return res.json(patientSummary(context));
});

router.post("/ai/patients/:id/protocol-highlights", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const lookup = getPatientOrError(db, req.user, req.params.id);
  if (lookup.error) return res.status(lookup.error.status).json({ error: lookup.error.message });
  const context = buildAiPatientContext(db, req.user, lookup.patient);
  return res.json(protocolHighlights(context));
});

router.post("/ai/patients/:id/evolution-draft", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const lookup = getPatientOrError(db, req.user, req.params.id);
  if (lookup.error) return res.status(lookup.error.status).json({ error: lookup.error.message });
  const context = buildAiPatientContext(db, req.user, lookup.patient);
  return res.json(evolutionDraft(context, req.body || {}));
});

router.post("/ai/patients/:id/acs-message", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const lookup = getPatientOrError(db, req.user, req.params.id);
  if (lookup.error) return res.status(lookup.error.status).json({ error: lookup.error.message });
  const context = buildAiPatientContext(db, req.user, lookup.patient);
  return res.json(acsMessage(context));
});

router.post("/ai/patients/:id/suggest-category", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const lookup = getPatientOrError(db, req.user, req.params.id);
  if (lookup.error) return res.status(lookup.error.status).json({ error: lookup.error.message });
  const context = buildAiPatientContext(db, req.user, lookup.patient);
  return res.json(suggestProtocolCategory(context));
});

router.post("/ai/patients/:id/transcribe", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const lookup = getPatientOrError(db, req.user, req.params.id);
  if (lookup.error) return res.status(lookup.error.status).json({ error: lookup.error.message });
  return res.json(transcribePayload(req.body || {}));
});

router.post("/ai/team/priorities", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const contexts = buildAiTeamContexts(db, req.user);
  return res.json({ items: teamPriorities(contexts) });
});

router.post("/ai/team/data-quality", async (req, res) => {
  const db = await readDb();
  ensureDbShape(db);
  const contexts = buildAiTeamContexts(db, req.user);
  return res.json({ findings: dataQualityChecks(contexts) });
});

router.post("/ai/team/report", async (req, res) => {
  if (!isManager(req.user)) {
    return res.status(403).json({ error: "Somente enfermeira pode gerar relatório executivo" });
  }
  const db = await readDb();
  ensureDbShape(db);
  const contexts = buildAiTeamContexts(db, req.user);
  const month = String(req.body?.month || "").trim();
  return res.json(teamReport(contexts, { month }));
});

router.post("/ai/chat", async (req, res) => {
  const question = String(req.body?.question || "").trim();
  const db = await readDb();
  ensureDbShape(db);
  const contexts = buildAiTeamContexts(db, req.user);
  return res.json(chatAnswer(question, contexts, db));
});

export default router;
