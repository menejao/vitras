import fs from "fs";

const raw = fs.readFileSync("/opt/elasticbeanstalk/deployment/env", "utf-8");
const env = {};
for (const line of raw.split("\n")) {
  if (!line.trim() || line.startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx > 0) {
    const key = line.slice(0, idx);
    const val = line.slice(idx + 1);
    env[key] = val;
    process.env[key] = val;
  }
}

console.log("DATA_ENCRYPTION_KEY length:", (env.DATA_ENCRYPTION_KEY || "").length);
console.log("DATA_ENCRYPTION_KEYS length:", (env.DATA_ENCRYPTION_KEYS || "").length);
console.log("DATA_ENCRYPTION_KEYS value:", env.DATA_ENCRYPTION_KEYS);
console.log("DATA_ENCRYPTION_ACTIVE_KEY_ID:", env.DATA_ENCRYPTION_ACTIVE_KEY_ID);
