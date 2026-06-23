import { createWriteStream, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { ZipArchive } = require("./backend/node_modules/archiver/index.js");

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = join(__dirname, "backend");
const output = createWriteStream(join(__dirname, "deploy-mig-01.zip"));
const archive = new ZipArchive({ zlib: { level: 9 } });

const SKIP_DIRS = new Set(["node_modules", ".git", "test", ".nyc_output"]);

output.on("close", () => console.log("ZIP ready:", archive.pointer(), "bytes"));
archive.on("error", (err) => { throw err; });
archive.pipe(output);

function addDir(dir, prefix) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const arc = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) addDir(full, arc);
    } else {
      archive.file(full, { name: arc });
    }
  }
}

addDir(backendDir, "");
archive.finalize();
