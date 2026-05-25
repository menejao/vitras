// Possible values: "booting" | "migrating" | "warming" | "ready" | "degraded" | "shutting_down"
let _startupPhase = "booting";
let _degradedReason = null;

const runtimeState = {
  startedAt: new Date().toISOString(),
  bootCompletedAt: null,
  shuttingDown: false,
  readiness: {
    ready: false,
    startupChecks: [],
    startupTasks: [],
    lastError: null
  }
};

function markBootCompleted() {
  runtimeState.bootCompletedAt = new Date().toISOString();
}

function markShuttingDown() {
  runtimeState.shuttingDown = true;
  runtimeState.readiness.ready = false;
  _startupPhase = "shutting_down";
}

function setStartupChecks(checks = []) {
  runtimeState.readiness.startupChecks = Array.isArray(checks) ? checks : [];
}

function setStartupTasks(tasks = []) {
  runtimeState.readiness.startupTasks = Array.isArray(tasks) ? tasks : [];
}

function setReadiness(ready, lastError = null) {
  runtimeState.readiness.ready = Boolean(ready) && !runtimeState.shuttingDown;
  runtimeState.readiness.lastError = lastError
    ? { message: String(lastError.message || lastError), at: new Date().toISOString() }
    : null;
}

function setStartupPhase(phase) {
  _startupPhase = phase;
}

function getStartupPhase() {
  return _startupPhase;
}

/**
 * Transitions the server into degraded mode.
 * Degraded = still serving traffic but a subsystem is impaired.
 * Does NOT set readiness.ready to false — instance stays in EB rotation.
 */
function setDegraded(reason) {
  _startupPhase = "degraded";
  _degradedReason = String(reason || "unknown");
}

function isDegraded() {
  return _startupPhase === "degraded";
}

function getDegradedReason() {
  return _degradedReason;
}

function getRuntimeState() {
  return {
    ...runtimeState,
    readiness: {
      ...runtimeState.readiness,
      startupChecks: [...runtimeState.readiness.startupChecks],
      startupTasks: [...runtimeState.readiness.startupTasks]
    }
  };
}

export {
  markBootCompleted,
  markShuttingDown,
  setStartupChecks,
  setStartupTasks,
  setReadiness,
  setStartupPhase,
  getStartupPhase,
  getRuntimeState,
  setDegraded,
  isDegraded,
  getDegradedReason
};
