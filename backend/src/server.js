// Copyright (c) 2026 Vitras. Todos os direitos reservados.
import app from "./app.js";
import { PORT } from "./config.js";
import { migrateLegacyPlaintextPasswords } from "./services/startup.js";
import { runMigrations } from "./migrations/runner.js";
import { closeDbPool } from "./db.js";
import {
  markBootCompleted,
  markShuttingDown,
  setReadiness,
  setStartupChecks,
  setStartupTasks
} from "./services/runtime-state.js";
import { logError, logInfo, logWarn } from "./utils/logger.js";

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
  const shouldRunMigrations =
    String(process.env.RUN_MIGRATIONS || "").trim().toLowerCase() === "true";

  if (shouldRunMigrations) {
    logInfo("startup.migrations.started");
    try {
      await withTimeout("runMigrations", runMigrations(), 60000);
      tasks.push({ name: "runMigrations", status: "ok" });
      logInfo("startup.migrations.completed");
    } catch (err) {
      tasks.push({ name: "runMigrations", status: "failed", message: err.message });
      logWarn("startup.migrations.failed_non_fatal", { message: err.message });
    }
  } else {
    tasks.push({ name: "runMigrations", status: "skipped" });
    logInfo("startup.migrations.skipped");
  }

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
  setStartupChecks([{ name: "config", status: "ok" }]);
  logInfo("startup.server.starting", { port: PORT });

  // Assign to module-level `server` so gracefulShutdown can close it
  await new Promise((resolve, reject) => {
    server = app.listen(PORT, (err) => {
      if (err) { reject(err); return; }
      logInfo("startup.server.listening", { port: PORT });
      resolve();
    });
  });

  markBootCompleted();
  setReadiness(true);

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
