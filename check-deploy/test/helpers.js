/**
 * Test helpers: start/stop the app server on a random port.
 * Sets minimal env vars so the app runs in non-production mode.
 * Uses an isolated temp DB file so tests never touch data/db.json.
 */

import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolated temp DB for this test process
const _tmpDir = mkdtempSync(join(tmpdir(), "saudeubs-test-"));
const _tmpDb = join(_tmpDir, "db.json");
writeFileSync(_tmpDb, JSON.stringify({}), "utf8"); // empty DB — app will auto-init shape

// Set test env before any app import
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-not-for-production-use-only";
process.env.DATA_ENCRYPTION_KEY = "test-data-enc-key-32-bytes-pad00";
process.env.COUNCIL_VERIFY_MODE = "off";
process.env.REQUEST_LOG_ENABLED = "false";
process.env.BACKUP_EXPORT_KEY = "test-backup-key-for-integration-tests";
process.env.TEST_DB_PATH = _tmpDb;

process.on("exit", () => { try { rmSync(_tmpDir, { recursive: true }); } catch {} });

let _server = null;
let _base = null;

export async function startTestServer() {
  if (_server) return _base;
  const { default: app } = await import("../src/app.js");
  _server = createServer(app);
  _server.unref(); // don't keep process alive after tests finish
  await new Promise((resolve, reject) => {
    _server.listen(0, "127.0.0.1", (err) => (err ? reject(err) : resolve()));
  });
  const { port } = _server.address();
  _base = `http://127.0.0.1:${port}`;
  return _base;
}

export async function stopTestServer() {
  if (!_server) return;
  // closeAllConnections() destroys keep-alive connections so server.close() can resolve
  if (typeof _server.closeAllConnections === "function") _server.closeAllConnections();
  await new Promise((resolve) => _server.close(resolve));
  _server = null;
  _base = null;
}

export async function req(method, path, body, token) {
  const base = _base || (await startTestServer());
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, headers: res.headers, json };
}

export const get = (path, token) => req("GET", path, null, token);
export const post = (path, body, token) => req("POST", path, body, token);
export const patch = (path, body, token) => req("PATCH", path, body, token);
