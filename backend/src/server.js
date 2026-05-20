import app from "./app.js";
import { PORT } from "./config.js";
import { migrateLegacyPlaintextPasswords, alignJoaoTeamOnStartup } from "./services/startup.js";
import { runMigrations } from "./migrations/runner.js";

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
  const shouldRunMigrations =
    String(process.env.RUN_MIGRATIONS || "").trim().toLowerCase() === "true";

  if (shouldRunMigrations) {
    console.log("[startup] runMigrations — início");
    try {
      await withTimeout("runMigrations", runMigrations(), 60000);
      console.log("[startup] runMigrations — OK");
    } catch (err) {
      console.error("[startup] runMigrations — FALHA (não-fatal):", err.message);
    }
  } else {
    console.log("[startup] runMigrations — ignorado (defina RUN_MIGRATIONS=true para executar)");
  }

  console.log("[startup] migrateLegacyPlaintextPasswords — início");
  try {
    await withTimeout("migrateLegacyPlaintextPasswords", migrateLegacyPlaintextPasswords(), 30000);
    console.log("[startup] migrateLegacyPlaintextPasswords — OK");
  } catch (err) {
    console.error("[startup] migrateLegacyPlaintextPasswords — FALHA (não-fatal):", err.message);
  }

  console.log("[startup] alignJoaoTeamOnStartup — início");
  try {
    await withTimeout("alignJoaoTeamOnStartup", alignJoaoTeamOnStartup(), 30000);
    console.log("[startup] alignJoaoTeamOnStartup — OK");
  } catch (err) {
    console.error("[startup] alignJoaoTeamOnStartup — FALHA (não-fatal):", err.message);
  }
}

async function startServer() {
  console.log("[startup] iniciando servidor");

  // Listen first — /health responde imediatamente, sem bloquear em migrations.
  await new Promise((resolve, reject) => {
    app.listen(PORT, (err) => {
      if (err) { reject(err); return; }
      console.log(`[startup] server listening on http://localhost:${PORT}`);
      resolve();
    });
  });

  // Startup tasks em background — falhas não derrubam o processo.
  runStartupTasks().catch((err) => {
    console.error("[startup] startup tasks — erro inesperado:", err.message);
  });
}

startServer().catch((err) => {
  console.error("[startup] falha crítica ao subir o servidor:", err);
  process.exit(1);
});
