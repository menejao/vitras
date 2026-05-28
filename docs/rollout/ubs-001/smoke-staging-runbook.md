# Smoke Staging Runbook — UBS #1

**Versao:** v1.0
**Data de referencia:** 2026-05-27
**Branch alvo:** release/pilot-baseline
**Prerequisito:** ambiente staging em execucao com migrações aplicadas

---

## 1. Pre-requisitos

Antes de executar o smoke:

1. Backend de staging rodando e respondendo em `https://saude-backend-staging.onrender.com`
   (ou URL alternativa — ver secao 2)
2. Banco Neon branch `staging` acessivel pelo backend de staging
3. Migrações aplicadas no banco de staging — verificar com:
   ```bash
   DATABASE_URL=<staging-database-url> node backend/src/migrations/check-status.js
   ```
   Esperado: "All migrations applied." com exit 0.
4. Node.js >= 18 instalado localmente
5. Credenciais de teste disponíveis (ver secao 3)

---

## 2. Comando exato de execução

### Usando o npm script (recomendado)

```bash
# Variavel BASE_URL aponta para o backend de staging
# Credenciais de gestor de teste via SMOKE_EMAIL e SMOKE_PASSWORD
# SMOKE_ORIGIN deve ser a origem do frontend de staging

BASE_URL=https://saude-backend-staging.onrender.com \
SMOKE_EMAIL=<gestor-staging@vitras.com.br> \
SMOKE_PASSWORD=<senha-do-gestor-de-staging> \
SMOKE_BACKUP_KEY=<chave-backup-de-staging> \
SMOKE_ORIGIN=https://gestaopacientes-staging.<worker>.workers.dev \
npm run smoke:staging
```

### Invocação direta (equivalente)

```bash
BASE_URL=https://saude-backend-staging.onrender.com
SMOKE_EMAIL=<email> SMOKE_PASSWORD=<senha> \
node scripts/smoke-production.js --base $BASE_URL
```

### Se a URL do staging for diferente

Passar diretamente via `BASE_URL`:
```bash
BASE_URL=https://meu-staging.elasticbeanstalk.com npm run smoke:staging
```

---

## 3. Credenciais necessárias

Nao incluir valores reais neste documento. Obter de:
- Gerenciador de secrets do projeto (1Password / AWS Secrets Manager)
- Ou criar usuario de teste diretamente no banco de staging

| Variavel | Descricao | Onde obter |
|----------|-----------|-----------|
| `SMOKE_EMAIL` | Email de um usuario gestor no banco staging | Admin do staging ou seed |
| `SMOKE_PASSWORD` | Senha desse usuario | Idem |
| `SMOKE_BACKUP_KEY` | Valor de `BACKUP_EXPORT_KEY` configurado no backend staging | Painel Render staging → env vars |
| `SMOKE_ORIGIN` | URL do frontend de staging (para teste de CORS) — **OBRIGATORIA**: o script falha com exit 1 se ausente | URL do worker Cloudflare staging (Cloudflare Workers dashboard → dominio do worker de staging) |
| `BASE_URL` | URL base do backend staging | Painel Render → Settings → URL |

> Nunca usar credenciais de producao contra staging. Nunca usar credenciais de staging contra producao.

---

## 4. Como preencher staging-smoke-final-report.md

O arquivo `docs/rollout/ubs-001/staging-smoke-final-report.md` serve como registro de execucao.

Procedimento:
1. Abrir `staging-smoke-final-report.md` antes de executar
2. Preencher: Data, Operador, URL de staging, versao do commit (`git rev-parse --short HEAD`)
3. Executar o smoke (secao 2 acima)
4. Para cada categoria, copiar o output do terminal e preencher as colunas "Actual Result" e "Pass?"
5. Preencher a tabela Summary ao final
6. Assinar com nome e data

---

## 5. Criterios de pass/fail

### PASS (pode prosseguir para producao)
- Todos os testes das Categorias 1–4 passaram (0 falhas)
- Total de falhas nas demais categorias: 0

### FAIL parcial — investigar antes de prosseguir
- 1 ou mais falhas nas Categorias 5–10 que nao sejam de infraestrutura de staging (ex: Upstash nao configurado em staging = aceitavel para redis "unknown")

### FAIL critico — NO-GO imediato
Qualquer um dos seguintes bloqueia o deploy em producao:

| Falha | Categoria | Acao |
|-------|-----------|------|
| Cross-tenant: Gestor A acessa paciente de equipe B (retorna 200 em vez de 403) | Cat. 4 | Revisao de seguranca obrigatoria |
| CPF exposto sem mascara em qualquer GET | Cat. 3 | Nao deployar — violacao de privacidade |
| /readyz nao retorna 200 apos startup | Cat. 1 | Investigar boot do servidor |
| POST /auth/login com credenciais erradas retorna 200 | Cat. 2 | Investigar logica de autenticacao |
| Audit logs nao registrando eventos (array vazio apos acoes) | Cat. 7 | Investigar servico de auditoria |

---

## 6. Smoke automatizado vs. manual

O script `scripts/smoke-production.js` cobre 9 testes publicos e 10+ testes autenticados automaticamente.

Os seguintes testes requerem preparacao manual (usuarios em equipes separadas):
- Categoria 4 (isolamento multi-tenant): requer tokens de Gestor A e Gestor B em equipes distintas
- Categoria 6 (agenda/fila): requer token de recepcionista
- Categoria 5 clinico: requer token de medico para prescricao

Para os testes automaticos (Categorias 1–3, 7, 8), o script faz tudo. Para 4–6 e partes de 9–10, executar os `curl` manualmente conforme `staging-smoke-final-report.md`.

---

## 7. Rollback do smoke (nao aplicavel)

O smoke e somente leitura + operacoes criadas em staging. Nao ha rollback necessario.
Se foram criados pacientes de teste no banco staging, podem ser removidos apos a execucao via:
```sql
DELETE FROM patients WHERE name LIKE 'Paciente Smoke Test%';
```
Executar no banco Neon branch `staging` — nunca no banco de producao.

---

*Runbook criado em 2026-05-27 — Sprint 4.5 hardening operacional*
