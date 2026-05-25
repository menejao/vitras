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

  let server;
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

  // LOG-01: Global error handlers — must be registered after server variable is in scope
  process.on("unhandledRejection", (reason) => {
    logError("unhandled_rejection", {
      event: "unhandled_rejection",
      timestamp: new Date().toISOString(),
      reason: reason instanceof Error
        ? { name: reason.name, message: reason.message, stack: reason.stack }
        : String(reason)
    });
    // Do not exit — log and continue (Node 15+ already warns; graceful shutdown
    // can be wired here if stricter policy is required in a future iteration).
  });

  process.on("uncaughtException", (err) => {
    // Process is in an undefined state after uncaughtException — must exit.
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
    // Safety-timeout ensures exit even if server.close() stalls.
    const exitTimeout = setTimeout(() => process.exit(1), 5000);
    exitTimeout.unref();
    if (server) {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });

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
