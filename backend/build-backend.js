#!/usr/bin/env node
// Build backend.zip for EB deploy with POSIX path separators (required on Amazon Linux 2023).
// Usage: node backend/build-backend.js
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { ZipArchive } = require("archiver");
import fs from "fs";

const BACKEND = "C:/dev/vitras/backend";
const OUT     = "C:/dev/vitras/deploy-artifacts/backend.zip";

if (fs.existsSync(OUT)) fs.unlinkSync(OUT);

const output  = fs.createWriteStream(OUT);
const archive = new ZipArchive({ zlib: { level: 6 } });

archive.pipe(output);
output.on("close", () => console.log(`Backend zip: ${OUT} (${archive.pointer()} bytes)`));
archive.on("error", err => { throw err; });

// Main files (non-hidden dirs/files)
archive.glob("**/*", {
  cwd: BACKEND,
  dot: false,
  ignore: ["node_modules/**", "test/**", "*.test.*", ".git/**", "build-backend.js", "coverage/**"],
});

// .platform hooks (hidden directory — must add with dot:true)
archive.glob(".platform/**/*", { cwd: BACKEND, dot: true });

archive.finalize();
