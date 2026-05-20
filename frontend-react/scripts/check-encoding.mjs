import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targetDirs = ["src"];
const extensions = new Set([".js", ".jsx", ".ts", ".tsx", ".css", ".html", ".json", ".md"]);
const suspiciousPatterns = [
  /\uFFFD/g,
  /�/g,
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (extensions.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

const files = targetDirs.flatMap((d) => walk(path.join(root, d)));
const findings = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of suspiciousPatterns) {
    if (!pattern.test(content)) continue;
    const rel = path.relative(root, file).replace(/\\/g, "/");
    findings.push(`${rel} contém padrão suspeito: ${pattern}`);
    break;
  }
}

if (findings.length > 0) {
  console.error("\n[encoding-check] Foram encontrados possíveis textos com encoding quebrado:\n");
  findings.forEach((f) => console.error(`- ${f}`));
  console.error("\n[encoding-check] Corrija os arquivos acima antes do build.\n");
  process.exit(1);
}

console.log("[encoding-check] OK: nenhum padrão crítico de mojibake encontrado.");
