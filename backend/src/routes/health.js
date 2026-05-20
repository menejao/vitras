import express from "express";

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

router.post("/csp-report", express.json({ type: ["application/json", "application/csp-report"] }), (req, res) => {
  const report = req.body?.["csp-report"] || req.body;
  if (report) console.warn("[csp-violation]", JSON.stringify(report));
  res.status(204).end();
});

export default router;
