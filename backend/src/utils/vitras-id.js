import crypto from "node:crypto";

// Gera vitrasId único de 9 dígitos.
// db.users deve ser passado para garantir unicidade.
function generateVitrasId(existingUsers = []) {
  const existingIds = new Set(existingUsers.map(u => String(u.vitrasId || "")));
  let attempts = 0;
  while (attempts < 100) {
    // 9 dígitos: entre 100000000 e 999999999
    const id = String(100000000 + (crypto.randomInt(0, 900000000)));
    if (!existingIds.has(id)) return id;
    attempts++;
  }
  throw new Error("Falha ao gerar vitrasId único após 100 tentativas");
}

export { generateVitrasId };
