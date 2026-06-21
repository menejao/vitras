// API docs — served publicly (no auth required)
// GET /api-docs  → Swagger UI
// GET /api-docs/openapi.json  → raw spec
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import swaggerUi from "swagger-ui-express";
import { load as yamlLoad } from "js-yaml";
import express from "express";

const __dirname = dirname(fileURLToPath(import.meta.url));
const specPath = join(__dirname, "../../../../docs/openapi.yaml");

let spec;
try {
  spec = yamlLoad(readFileSync(specPath, "utf8"));
} catch {
  spec = { openapi: "3.0.0", info: { title: "VITRAS APS", version: "0.0.0" }, paths: {} };
}

const router = express.Router();

router.get("/api-docs/openapi.json", (_req, res) => {
  res.json(spec);
});

router.use("/api-docs", swaggerUi.serve, swaggerUi.setup(spec, {
  customSiteTitle: "VITRAS APS — API Docs",
  swaggerOptions: { persistAuthorization: true },
}));

export default router;
