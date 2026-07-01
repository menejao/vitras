#!/usr/bin/env node
// Build backend.zip with POSIX path separators for EB (Linux)
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { ZipArchive } = require("archiver");
import fs from "fs";
import path from "path";

const BACKEND_DIR = "C:/dev/vitras/backend";
const OUT_FILE    = "C:/dev/vitras/deploy-artifacts/backend.zip";

const EXCLUDE = new Set([
  "node_modules",
  ".git",
  "test",
  "coverage",
  ".env",
  ".env.local",
]);

if (fs.existsSync(OUT_FILE)) fs.unlinkSync(OUT_FILE);

const output  = fs.createWriteStream(OUT_FILE);
const archive = new ZipArchive({ zlib: { level: 6 } });

archive.pipe(output);

output.on("close", () => {
  console.log(`Backend zip criado em ${OUT_FILE} (${archive.pointer()} bytes)`);
});

archive.on("error", (err) => { throw err; });

// Add all files from backend dir with POSIX paths, excluding EXCLUDE set
function addDir(dir, prefix) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel  = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDir(full, rel);
    } else {
      archive.file(full, { name: rel });
    }
  }
}

addDir(BACKEND_DIR, "");
archive.finalize();
