/**
 * laboratory.js — Rotas para etiquetas laboratoriais e rastreamento de amostras.
 *
 * Segurança:
 *   - requireAuth + blockSupportAdminFromClinical já aplicados globalmente (app.js linha 88)
 *   - support_admin NÃO acessa essas rotas
 *   - Impressão de etiqueta NÃO altera collectedAt nem status de execução
 *
 * LGPD:
 *   - Número de acesso gerado no backend (nunca frontend)
 *   - Audit events: LAB_LABEL_PREPARED, LAB_LABEL_PRINTED, LAB_LABEL_REPRINTED
 *   - Nenhum dado clínico em logs operacionais
 */
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, withDb } from "../db.js";
import { hasCapability } from "../utils/helpers.js";
import { addAuditLog } from "../services/audit.js";
import { ensureDbShape } from "../utils/domain.js";

const router = express.Router();

// Roles allowed to prepare/print labels
function canAccessLab(user) {
  return hasCapability(user, "exams.execute") ||
    ["nursing_tech", "nurse_manager", "break_glass_admin"].includes(user?.role);
}

// Generate accession number: VIT-YYYYMMDD-NNNN (unique per date, backend only)
async function generateAccessionNumber(db, date) {
  const dateStr = date.replace(/-/g, "");
  const prefix = `VIT-${dateStr}-`;
  const existing = (db.labOrders || [])
    .filter(o => (o.accessionNumber || "").startsWith(prefix))
    .map(o => parseInt((o.accessionNumber || "").slice(prefix.length), 10))
    .filter(n => !isNaN(n));
  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/**
 * POST /laboratory/orders/:examRequestId/labels/prepare
 * Prepara etiquetas para um pedido: gera número de acesso por amostra.
 * Idempotente: se ordem já existe, retorna dados existentes.
 *
 * Body: { examIds?: string[] }
 */
router.post("/laboratory/orders/:examRequestId/labels/prepare", async (req, res) => {
  const user = req.user;
  if (!canAccessLab(user)) return res.status(403).json({ error: "Sem permissão para acessar rotas laboratoriais." });

  const { examRequestId } = req.params;

  try {
    let result;
    await withDb(async db => {
      ensureDbShape(db);
      const examRequest = (db.examRequests || []).find(r => r.id === examRequestId);
      if (!examRequest) {
        res.status(404).json({ error: "Pedido de exame não encontrado." });
        return;
      }

      // Check existing order
      const existing = (db.labOrders || []).find(o => o.examRequestId === examRequestId);
      if (existing) {
        result = existing;
        return;
      }

      // Determine exams to label
      const exams = examRequest.exams || [];
      const today = new Date().toISOString().slice(0, 10);

      const labels = [];
      for (const ex of exams) {
        const accessionNumber = await generateAccessionNumber(db, examRequest.scheduledDate || today);
        labels.push({
          id: uuidv4(),
          examTypeId: ex.examTypeId || ex.id,
          examName: ex.name || ex.examName || ex.examTypeId || "Exame",
          specimenType: ex.specimenType || null,
          containerType: ex.containerType || null,
          accessionNumber,
          preparedAt: new Date().toISOString(),
          preparedBy: user.id,
          printCount: 0,
        });
      }

      const order = {
        id: uuidv4(),
        examRequestId,
        patientId: examRequest.patientId,
        scheduledDate: examRequest.scheduledDate || today,
        labels,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      };

      db.labOrders.push(order);
      result = order;

      await addAuditLog(db, {
        action: "LAB_LABEL_PREPARED",
        userId: user.id,
        targetType: "examRequest",
        targetId: examRequestId,
        meta: { labelCount: labels.length, orderId: order.id },
      });
    });

    if (result) return res.json(result);
  } catch (e) {
    console.error("laboratory/prepare error:", e);
    res.status(500).json({ error: "Erro interno ao preparar etiquetas." });
  }
});

/**
 * GET /laboratory/orders/:examRequestId/labels
 * Recupera etiquetas existentes de um pedido.
 */
router.get("/laboratory/orders/:examRequestId/labels", async (req, res) => {
  const user = req.user;
  if (!canAccessLab(user)) return res.status(403).json({ error: "Sem permissão." });

  try {
    const db = await readDb();
    ensureDbShape(db);
    const order = (db.labOrders || []).find(o => o.examRequestId === req.params.examRequestId);
    if (!order) return res.status(404).json({ error: "Etiquetas não preparadas para este pedido." });
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: "Erro interno." });
  }
});

/**
 * POST /laboratory/orders/:examRequestId/labels/print
 * Registra evento de impressão. NÃO altera collectedAt nem status.
 *
 * Body: { labelIds: string[], labelSize: string }
 */
router.post("/laboratory/orders/:examRequestId/labels/print", async (req, res) => {
  const user = req.user;
  if (!canAccessLab(user)) return res.status(403).json({ error: "Sem permissão." });

  const { examRequestId } = req.params;
  const { labelIds = [], labelSize = "50x30" } = req.body || {};

  if (!Array.isArray(labelIds) || !labelIds.length) {
    return res.status(400).json({ error: "Selecione ao menos uma etiqueta." });
  }

  try {
    let isReprint = false;
    await withDb(async db => {
      ensureDbShape(db);
      const orderIdx = db.labOrders.findIndex(o => o.examRequestId === examRequestId);
      if (orderIdx === -1) {
        return res.status(404).json({ error: "Etiquetas não preparadas. Prepare primeiro." });
      }

      const order = db.labOrders[orderIdx];
      const now = new Date().toISOString();

      let anyPrinted = false;
      order.labels = (order.labels || []).map(label => {
        if (!labelIds.includes(label.id)) return label;
        const wasAlreadyPrinted = label.printCount > 0;
        if (wasAlreadyPrinted) isReprint = true;
        anyPrinted = true;
        return {
          ...label,
          printCount: (label.printCount || 0) + 1,
          lastPrintedAt: now,
          lastPrintedBy: user.id,
          lastLabelSize: labelSize,
        };
      });

      if (!anyPrinted) {
        return res.status(400).json({ error: "Nenhuma das etiquetas selecionadas encontrada neste pedido." });
      }

      db.labOrders[orderIdx] = order;

      const auditAction = isReprint ? "LAB_LABEL_REPRINTED" : "LAB_LABEL_PRINTED";
      await addAuditLog(db, {
        action: auditAction,
        userId: user.id,
        targetType: "examRequest",
        targetId: examRequestId,
        meta: { labelIds, labelSize, orderId: order.id },
      });
    });

    res.json({ ok: true, isReprint });
  } catch (e) {
    console.error("laboratory/print error:", e);
    res.status(500).json({ error: "Erro interno ao registrar impressão." });
  }
});

export default router;
