// Possible values: "booting" | "migrating" | "ready" | "degraded" | "shutting_down"
let _startupPhase = "booting";

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
  getRuntimeState
};
