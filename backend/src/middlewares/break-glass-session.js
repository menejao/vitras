import { readDb } from "../db.js";
import { ensureDbShape } from "../utils/domain.js";

// Resolves X-Break-Glass-Session header into req.user.activeBreakGlassSession.
// No-op if header absent or session invalid/expired.
// Must run after requireAuth.
export async function resolveBreakGlassSession(req, _res, next) {
  const sessionId = String(req.headers["x-break-glass-session"] || "").trim();
  if (!sessionId || !req.user) return next();

  try {
    const db = await readDb();
    ensureDbShape(db);
    const now = Date.now();

    const session = (db.breakGlassSessions || []).find((s) =>
      s.id === sessionId
      && s.activatedBy === req.user.id
      && !s.deactivatedAt
      && Date.parse(String(s.expiresAt || "")) > now
    );

    if (session) {
      req.user.activeBreakGlassSession = {
        active: true,
        sessionId: session.id,
        patientId: session.patientId,
        expiresAt: session.expiresAt
      };
    }
  } catch {
    // DB read failure must not block the request
  }

  return next();
}
