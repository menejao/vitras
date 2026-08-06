/**
 * demo-restore.mjs — restaura ambiente demo ao estado canônico.
 *
 * Executa os dois seeds em sequência (idempotentes, < 15s total):
 *   1. seed-demo-santa-aurora-v2  — 850 pacientes sintéticos, 3 UBS
 *   2. seed-demo-parte3           — usuários canônicos + memberships
 *
 * Uso:
 *   npm run demo:restore
 *   # ou diretamente:
 *   DEMO_SEED_ALLOWED=true node --env-file=.env scripts/demo-restore.mjs
 *
 * Segurança:
 *   - Exige DEMO_SEED_ALLOWED=true
 *   - Bloqueia se RENDER está setado (proteção produção real)
 *   - Break Glass admin (4f49cad8-...) nunca é alterado
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (!process.env.DEMO_SEED_ALLOWED || process.env.DEMO_SEED_ALLOWED !== 'true') {
  console.error('❌ DEMO_SEED_ALLOWED=true é obrigatório');
  process.exit(1);
}
if (process.env.RENDER) {
  console.error('❌ Bloqueado: variável RENDER detectada. Não execute em instância Render de produção real.');
  process.exit(1);
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const node = process.execPath;
const opts = { stdio: 'inherit', env: process.env, cwd: path.join(dir, '..') };

const seeds = [
  'scripts/seed-demo-santa-aurora-v2.mjs',
  'scripts/seed-demo-parte3.mjs',
];

console.log('══════════════════════════════════════════════════');
console.log('  VITRAS Demo Restore — restauração completa');
console.log('══════════════════════════════════════════════════');

for (const seed of seeds) {
  console.log(`\n▶ ${seed}`);
  execFileSync(node, ['--env-file=.env', seed], opts);
}

console.log('\n══ Restauração concluída ════════════════════════');
