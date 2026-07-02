// Copyright (c) 2026 Vitras. Todos os direitos reservados.
import express from "express";
import { readDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";

const router = express.Router();

// GET /catalog/items?q=&domain=
router.get("/catalog/items", (req, res) => {
  const db = readDb();
  ensureDbShape(db);

  const q = String(req.query.q || "").toLowerCase().trim();
  const domain = String(req.query.domain || "").toLowerCase().trim();

  let items = (db.catalogItems || []).filter(i => i.active !== false);
  if (domain) items = items.filter(i => i.domain === domain);
  if (q) {
    items = items.filter(i =>
      String(i.code || "").toLowerCase().includes(q) ||
      String(i.name || "").toLowerCase().includes(q) ||
      String(i.category || "").toLowerCase().includes(q)
    );
  }

  res.json({ data: items.slice(0, 50) });
});

export default router;
