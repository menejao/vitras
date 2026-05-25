// Copyright (c) 2026 Vitras. Todos os direitos reservados.
import app from "./app.js";
import {
  IS_PROD,
  PORT,
  APP_VERSION,
  LOG_FORMAT,
  UPSTASH_URL,
  UPSTASH_TOKEN,
  DATA_ENCRYPTION_KEY,
  AUDIT_PRUNE_ENABLED,
  DATABASE_URL
} from "./config.js";
import { migrateLegacyPlaintextPasswords, validateProductionConfig, checkRdsBackupHealth } from "./services/startup.js";
import { runMigrations } from "./migrations/runner.js";
import { closeDbPool, pool } from "./db.js";
import {
  markBootCompleted,
  markShuttingDown,
  setReadiness,
  setStartupChecks,
  setStartupTasks,
  setStartupPhase,
  setDegraded
} from "./services/runtime-state.js";
import { logError, logInfo, logWarn } from "./utils/logger.js";
import { Pool } from "pg";

// EB-01: Critical migrations that must be applied before the server accepts traffic.
// Column name in schema_migrations is `id` (see migrations/runner.js).
const CRITICAL_MIGRATIONS = ["006_patient_hash_columns"];

function _stripSslParamsForMigrationCheck(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    ["sslmode", "sslcert", "sslkey", "sslrootcert", "sslpassword"].forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Verifies that all CRITICAL_MIGRATIONS have been applied in the schema_migrations
 * table before the server begins accepting traffic.
 *
 * Only runs when IS_PROD=true AND DATABASE_URL is set (postgres mode).
 * Throws on missing migrations so startServer() aborts before app.listen().
 */
async function checkCriticalMigrations() {
  if (!IS_PROD || !DATABASE_URL) return; // dev/test/file-mode: skip

  const checkPool = new Pool({
    connectionString: _stripSslParamsForMigrationCheck(DATABASE_URL),
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });

  let client;
  try {
    client = await checkPool.connect();

    // Check whether schema_migrations table exists yet
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'schema_migrations'
      ) AS exists
    `);

    if (!tableCheck.rows[0]?.exists) {
      logError("boot_migrations_required", {
        event: "boot_migrations_required",
        missing: CRITICAL_MIGRATIONS,
        message: "Tabela schema_migrations não existe. Execute com RUN_MIGRATIONS=true antes de aceitar tráfego.",
        timestamp: new Date().toISOString()
      });
      throw new Error("Boot abortado: schema_migrations não encontrada. Configure RUN_MIGRATIONS=true.");
    }

    // schema_migrations uses column `id` (see migrations/runner.js)
    const result = await client.query(
      `SELECT id FROM schema_migrations WHERE id = ANY($1)`,
      [CRITICAL_MIGRATIONS]
    );

    const applied = new Set(result.rows.map((r) => r.id));
    const missing = CRITICAL_MIGRATIONS.filter((id) => !applied.has(id));

    if (missing.length > 0) {
      logError("boot_migrations_required", {
        event: "boot_migrations_required",
        missing,
        message: `Migrations críticas não aplicadas: ${missing.join(", ")}. Configure RUN_MIGRATIONS=true no próximo deploy.`,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Boot abortado: migrations críticas não aplicadas: ${missing.join(", ")}`);
    }

    logInfo("boot_migrations_ok", {
      event: "boot_migrations_ok",
      verified: CRITICAL_MIGRATIONS,
      timestamp: new Date().toISOString()
    });
  } finally {
    client?.release();
    await checkPool.end().catch(() => {});
  }
}

// LOG-01: Module-level declarations so gracefulShutdown can reference `server`
// even when errors occur before app.listen() is called.
let isShuttingDown = false;
let server; // populated by startServer() after app.listen()

function gracefulShutdown(exitCode, reason) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    logError("fatal_shutdown_initiated", { event: "fatal_shutdown_initiated", reason, exitCode, timestamp: new Date().toISOString() });
  } catch (_) {
    console.error("[FATAL] shutdown:", reason);
  }

  const timeout = setTimeout(() => process.exit(exitCode), 5000);
  timeout.unref();

  if (server) {
    server.close(() => process.exit(exitCode));
  } else {
    process.exit(exitCode);
  }
}

// LOG-01: Registered at module level — covers errors thrown during startup
// (before app.listen) as well as runtime errors after the server is up.
process.on("uncaughtException", (err) => {
  try {
    logError("uncaught_exception", {
      event: "uncaught_exception",
      timestamp: new Date().toISOString(),
      name: err.name,
      message: err.message,
      stack: err.stack
    });
  } catch (_) {
    console.error("[FATAL] uncaughtException:", err);
  }
  gracefulShutdown(1, `uncaughtException: ${err.message}`);
});

process.on("unhandledRejection", (reason) => {
  try {
    logError("unhandled_rejection", {
      event: "unhandled_rejection",
      timestamp: new Date().toISOString(),
      reason: reason instanceof Error
        ? { name: reason.name, message: reason.message, stack: reason.stack }
        : String(reason)
    });
  } catch (_) {
    console.error("[FATAL] unhandledRejection:", reason);
  }
  gracefulShutdown(1, `unhandledRejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});

function withTimeout(label, promise, ms = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[startup] TIMEOUT após ${ms}ms em: ${label}`));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

async function runStartupTasks() {
  const tasks = [];

  logInfo("startup.password_migration.started");
  try {
    await withTimeout("migrateLegacyPlaintextPasswords", migrateLegacyPlaintextPasswords(), 30000);
    tasks.push({ name: "migrateLegacyPlaintextPasswords", status: "ok" });
    logInfo("startup.password_migration.completed");
  } catch (err) {
    tasks.push({ name: "migrateLegacyPlaintextPasswords", status: "failed", message: err.message });
    logWarn("startup.password_migration.failed_non_fatal", { message: err.message });
  }

  setStartupTasks(tasks);
}

async function startServer() {
  // Validate production config BEFORE making any DB connections
  validateProductionConfig();

  // ITEM 6: Verify CORS restrictiveness in production
  if (IS_PROD && !process.env.FRONTEND_ORIGINS && !process.env.CORS_ALLOW_ALL) {
    logWarn("security.cors_not_configured", {
      event: "security.cors_not_configured",
      message: "FRONTEND_ORIGINS not set in production — CORS may be misconfigured",
      timestamp: new Date().toISOString()
    });
  }

  setStartupChecks([{ name: "config", status: "ok" }]);
  logInfo("startup.server.starting", { port: PORT });

  // F-08: Run migrations BEFORE app.listen() so EB never routes traffic before schema is ready.
  const shouldRunMigrations =
    String(process.env.RUN_MIGRATIONS || "").trim().toLowerCase() === "true";

  if (shouldRunMigrations) {
    try {
      setStartupPhase("migrating");
      logInfo("migrations.started", { event: "migrations.started", timestamp: new Date().toISOString() });
      await withTimeout("runMigrations", runMigrations(), 60000);
      logInfo("migrations.completed", { event: "migrations.completed", timestamp: new Date().toISOString() });
    } catch (err) {
      if (IS_PROD) {
        logError("migrations.failed_fatal", {
          event: "migrations.failed_fatal",
          error: err.message,
          stack: err.stack
        });
        throw err; // → process.exit(1) via startServer().catch
      } else {
        logWarn("migrations.failed_non_fatal", {
          event: "migrations.failed_non_fatal",
          error: err.message
        });
        // Non-production: set degraded instead of fatal crash
        setDegraded("migrations_failed");
      }
    }
  } else {
    logInfo("startup.migrations.skipped");
    // Informational only: RUN_MIGRATIONS not set. Critical migration guard (EB-01)
    // runs below and would abort boot if 006 was missing in prod+postgres.
    if (IS_PROD && process.env.DATABASE_URL) {
      logInfo("boot_migrations_skipped", {
        event: "boot_migrations_skipped",
        message: "RUN_MIGRATIONS não está definido — migrations não serão aplicadas neste deploy. Schemas verificados pelo boot guard (EB-01)."
      });
    }
  }

  // EB-01: Fatal guard — verify critical migrations were applied (post-migration check).
  // Runs after runMigrations() so it validates the final state before accepting traffic.
  await withTimeout("checkCriticalMigrations", checkCriticalMigrations(), 15000);

  // Assign to module-level `server` so gracefulShutdown can close it
  await new Promise((resolve, reject) => {
    server = app.listen(PORT, (err) => {
      if (err) { reject(err); return; }
      logInfo("startup.server.listening", { port: PORT });
      resolve();
    });
  });

  logInfo("server_started", {
    event: "server_started",
    port: PORT,
    env: process.env.NODE_ENV,
    driver: process.env.DATABASE_URL ? "postgres" : "file",
    version: APP_VERSION,
    logFormat: LOG_FORMAT,
    upstashConfigured: !!(UPSTASH_URL && UPSTASH_TOKEN),
    encryptionEnabled: !!DATA_ENCRYPTION_KEY,
    auditPruneEnabled: AUDIT_PRUNE_ENABLED,
    timestamp: new Date().toISOString()
  });

  // ITEM 1: Advisory RDS backup health check (production only, never fatal)
  checkRdsBackupHealth(pool).catch(() => {});

  // ITEM 2: warming phase — brief window between server.listen() and accepting traffic
  setStartupPhase("warming");
  logInfo("startup.warming", { event: "startup.warming", message: "Server warming up before marking ready" });

  markBootCompleted();
  setReadiness(true);
  setStartupPhase("ready");

  const shutdown = async (signal) => {
    logWarn("shutdown.started", { signal });
    markShuttingDown();
    setReadiness(false, signal);

    await new Promise((resolve) => {
      server.close(() => resolve());
    });

    try {
      await closeDbPool();
    } catch (error) {
      logError("shutdown.db_pool_close_failed", { error });
    }

    logInfo("shutdown.completed", { signal });
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    shutdown("SIGTERM").catch((error) => {
      logError("shutdown.failed", { signal: "SIGTERM", error });
      process.exit(1);
    });
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT").catch((error) => {
      logError("shutdown.failed", { signal: "SIGINT", error });
      process.exit(1);
    });
  });

  // LOG-01: uncaughtException and unhandledRejection are registered at module
  // level (above startServer) and reference `server` via closure — no need to
  // re-register them here.

  runStartupTasks().catch((err) => {
    setReadiness(true, err);
    logError("startup.background_tasks.failed", { error: err });
  });
}

startServer().catch((err) => {
  setReadiness(false, err);
  logError("startup.failed", { error: err });
  process.exit(1);
});
