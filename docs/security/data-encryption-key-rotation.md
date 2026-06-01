# Data Encryption Key Rotation

## Objetivo

Permitir a rotação de `DATA_ENCRYPTION_KEY` sem big-bang e sem perda de dados criptografados existentes.

Cada ciphertext agora carrega um Key ID (`kid`) que identifica qual chave foi usada na criptografia. Dados antigos sem `kid` continuam sendo descriptografados via a chave `legacy` (`DATA_ENCRYPTION_KEY`). Novas criptografias usam o `kid` ativo.

## Variáveis de ambiente

| Variável | Obrigatório | Descrição |
|---|---|---|
| `DATA_ENCRYPTION_KEY` | Sim (legado) | Chave única original. Mantida para compatibilidade com ciphertexts sem `kid`. Mapeada internamente para `kid=legacy`. |
| `DATA_ENCRYPTION_KEYS` | Opcional | Objeto JSON `{"kid1":"chave1","kid2":"chave2"}`. Habilita modo multi-chave. Cada chave deve ter ≥ 32 caracteres após trim. |
| `DATA_ENCRYPTION_ACTIVE_KEY_ID` | Obrigatório se `DATA_ENCRYPTION_KEYS` definido | `kid` da chave ativa para novas criptografias. Deve existir em `DATA_ENCRYPTION_KEYS`. |
| `PATIENT_LOOKUP_HASH_KEY` | Sim (prod) | Chave HMAC para `cpf_hash`/`cns_hash`. **Não é alterada por esta rotação.** |

### Formato do ciphertext

```
Legado (sem kid):  enc1:<iv_b64>:<enc_b64>:<tag_b64>      ← 3 partes
Novo (com kid):    enc1:<kid>:<iv_b64>:<enc_b64>:<tag_b64> ← 4 partes
```

Base64 nunca contém `:`, portanto a detecção por contagem de partes é inequívoca.

O campo `kid` nunca é `"legacy"` em ciphertexts legados — payloads de 3 partes são automaticamente roteados para `registry["legacy"]`.

## Plano de deploy em fases

### Fase 1 — Introduzir nova chave (zero downtime)

Gere uma nova chave forte:
```bash
openssl rand -base64 32
```

Configure no Elastic Beanstalk (ou arquivo `.env`):
```
DATA_ENCRYPTION_KEY=<valor atual — não mude>
DATA_ENCRYPTION_KEYS={"legacy":"<valor atual>","v2":"<nova chave>"}
DATA_ENCRYPTION_ACTIVE_KEY_ID=v2
```

Deploy. A partir deste ponto:
- Novos registros são criptografados com `kid=v2`.
- Registros antigos (sem `kid`) continuam sendo descriptografados via `legacy`.

### Fase 2 — Auditoria (dry-run)

```bash
DATABASE_URL=<url-prod> \
DATA_ENCRYPTION_KEY=<legado> \
DATA_ENCRYPTION_KEYS='{"legacy":"<legado>","v2":"<nova>"}' \
DATA_ENCRYPTION_ACTIVE_KEY_ID=v2 \
node scripts/reencrypt-audit.js
```

Verifique a saída:
- `Total de campos sensíveis` — total esperado com base em registros no banco.
- `Sem kid (formato legado)` — quantidade que ainda usa a chave antiga.
- `Campos que precisam re-criptografia` — alvo da Fase 3.

### Fase 3 — Re-criptografia (apply)

```bash
DATABASE_URL=<url-prod> \
DATA_ENCRYPTION_KEY=<legado> \
DATA_ENCRYPTION_KEYS='{"legacy":"<legado>","v2":"<nova>"}' \
DATA_ENCRYPTION_ACTIVE_KEY_ID=v2 \
node scripts/reencrypt-audit.js --apply
```

Execute novamente em dry-run para confirmar:
```
Campos que precisam re-criptografia: 0
```

### Fase 4 — Remover chave legada (opcional)

Após confirmar `Campos que precisam re-criptografia: 0`:

1. Atualize `DATA_ENCRYPTION_KEYS` removendo o entry `"legacy"`.
2. Remova ou mantenha `DATA_ENCRYPTION_KEY` (se mantiver, fica inativo mas não causa erro).
3. Deploy.

> **Atenção:** Só execute a Fase 4 após confirmar que nenhum ciphertext sem `kid` existe no banco.

## Rollback

### Antes de `--apply` (qualquer fase)

Nenhuma alteração foi feita no banco. Reverter:
1. Remova `DATA_ENCRYPTION_KEYS` e `DATA_ENCRYPTION_ACTIVE_KEY_ID` do EB.
2. Garanta que `DATA_ENCRYPTION_KEY` contém o valor original.
3. Deploy.

### Após `--apply` no driver file

O script cria um backup antes de qualquer escrita:
```
backend/data/db.json.bak.<timestamp>
```

Para restaurar:
```bash
cp backend/data/db.json.bak.<timestamp> backend/data/db.json
```

### Após `--apply` no driver postgres

O postgres não cria backup automático. Antes de executar `--apply` em produção:
```bash
pg_dump $DATABASE_URL > backup-pre-reencrypt-$(date +%Y%m%d%H%M%S).sql
```

## Validação

### Após Fase 1

Criar um novo paciente e verificar que o ciphertext começa com `enc1:v2:`:
```sql
SELECT substring(data->'patients'->0->>'cpf', 1, 15)
FROM app_state WHERE id = 1;
-- Esperado: enc1:v2:...
```

### Após Fase 3

Dry-run deve retornar:
```
Campos que precisam re-criptografia: 0
```

### Teste de regressão

```bash
cd backend && npm test
```

Todos os 13+ suites devem passar.

## Riscos

| Risco | Mitigação |
|---|---|
| Deploy com `DATA_ENCRYPTION_ACTIVE_KEY_ID` inexistente | `config.js` lança erro na startup — processo não sobe, sem tráfego afetado |
| Re-criptografia parcial por crash | Script é idempotente — re-executar pula campos já com `kid` ativo |
| Confusão entre `DATA_ENCRYPTION_KEY` e `PATIENT_LOOKUP_HASH_KEY` | São responsabilidades distintas; `PATIENT_LOOKUP_HASH_KEY` nunca entra no registry de criptografia |
| Leak de chave em logs | `config.js` e `db.js` nunca logam valores de chave; mensagens de erro são genéricas |
| JSON malformado em `DATA_ENCRYPTION_KEYS` | `config.js` lança erro descritivo na startup antes de aceitar qualquer requisição |
| Chave com menos de 32 caracteres | `config.js` valida cada entry e lança erro antes de aceitar tráfego |

## Checklist operacional

- [ ] Gerar nova chave com `openssl rand -base64 32`
- [ ] Adicionar `DATA_ENCRYPTION_KEYS` e `DATA_ENCRYPTION_ACTIVE_KEY_ID` ao EB mantendo `DATA_ENCRYPTION_KEY` inalterado
- [ ] Deploy Fase 1 — verificar startup sem erros
- [ ] Confirmar que novos ciphertexts usam `enc1:v2:...`
- [ ] Executar dry-run (`reencrypt-audit.js`) e anotar contagens
- [ ] (Opcional) Executar `pg_dump` antes de `--apply`
- [ ] Executar `reencrypt-audit.js --apply`
- [ ] Executar dry-run novamente e confirmar `Campos que precisam re-criptografia: 0`
- [ ] `npm test` verde
- [ ] (Fase 4, opcional) Remover `legacy` de `DATA_ENCRYPTION_KEYS` + deploy

## Comandos de referência rápida

```bash
# Gerar nova chave
openssl rand -base64 32

# Dry-run (file driver)
DATA_ENCRYPTION_KEY=<legado> node scripts/reencrypt-audit.js

# Dry-run (postgres)
DATABASE_URL=<url> DATA_ENCRYPTION_KEY=<legado> \
DATA_ENCRYPTION_KEYS='{"legacy":"<legado>","v2":"<nova>"}' \
DATA_ENCRYPTION_ACTIVE_KEY_ID=v2 \
node scripts/reencrypt-audit.js

# Apply (postgres) — cria backup antes de executar
DATABASE_URL=<url> DATA_ENCRYPTION_KEY=<legado> \
DATA_ENCRYPTION_KEYS='{"legacy":"<legado>","v2":"<nova>"}' \
DATA_ENCRYPTION_ACTIVE_KEY_ID=v2 \
node scripts/reencrypt-audit.js --apply
```
