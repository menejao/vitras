# SECURITY

## Objetivo
Registrar controles de segurança implementados hoje no VITRAS, incluindo limites, lacunas conhecidas e referências de código.

## Escopo
Autenticação, JWT, sessões, RBAC, Break Glass, rate limit, headers, CORS, validação, LGPD, auditoria, logs, hash, criptografia, replay, brute force e threat model.

## Pré-requisitos
- `backend/src/middlewares/security.js`
- `backend/src/middlewares/auth.js`
- `backend/src/middlewares/rate-limits.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/break-glass.js`
- `backend/src/services/audit.js`
- `backend/src/db.js`

## Descrição
Segurança é centrada em defesa em profundidade: autenticação forte, segregação de papéis, criptografia de dados sensíveis, trilha de auditoria encadeada, controles HTTP e restrições de escopo clínico.

## Status de maturidade
### IMPLEMENTADO
- JWT + refresh token
- Cookie auth com CSRF
- TOTP 2FA
- Rate limits global, auth, sensitiveData e export
- Helmet, CORS controlado e headers de cache `no-store`
- Criptografia AES-256-GCM para dados sensíveis
- HMAC para lookup de CPF/CNS
- Audit log encadeado com verificação de integridade
- Break Glass auditável
- Separação `support_admin` x ambiente clínico

### PARCIAL
- Nem toda validação está centralizada em schemas únicos
- Alguns controles dependem de env vars ou infraestrutura externa para operar em modo máximo

### ROADMAP
- Não promover controles futuros a implementados. Referir apenas artefatos específicos de `docs/security/` quando necessário.

## Autenticação
- Login primário via ID VITRAS de 9 dígitos
- Refresh token rotacionado
- Cookies `httpOnly`, `Secure`, `SameSite=None` em cenários cross-origin
- 2FA TOTP em `/me/2fa/*` e `/auth/login/verify`

## JWT
- Emissão e verificação em rotas de auth
- Uso por bearer token e por cookies
- Sessão enriquecida com capabilities, unitId, municipalityId e contexto de impersonation/break glass

## Sessões
- Refresh tokens persistidos em `db.refreshTokens[]` e `app_refresh_tokens`
- Revogação no logout e reset de senha
- Contexto de sessão preserva escopo e elevações

## RBAC
- Matriz principal em `backend/src/utils/helpers.js`
- Roles clínicas, operacionais, suporte, auditoria e emergência
- Capabilities adicionais aplicadas em break glass
- Guards específicos por rota limitam ações de alto risco

## Break Glass
- Rota dedicada `/break-glass/activate`
- Reautenticação por senha
- TTL atual de 30 minutos
- Sessões paralelas anteriores do mesmo usuário são desativadas
- Toda ativação/desativação gera auditoria

## Rate limit
- Global em middleware central
- Auth dedicado para login e registro
- Sensitive data para leituras críticas
- Export para relatórios e auditoria
- Estratégia fail-closed documentada nos mapas internos

## Headers HTTP
- Helmet configurado globalmente
- `Cache-Control: no-store, no-cache, must-revalidate, private`
- `Pragma: no-cache`
- `Expires: 0`
- Endpoint de relatório CSP presente em `/csp-report`

## CORS
- Origins controladas por `FRONTEND_ORIGINS`
- `CORS_ALLOW_ALL=true` proibido em produção por configuração

## Validação e sanitização
- Normalização de roles, e-mails, documentos e datas em utils
- Parte das rotas usa validações explícitas e validação por schema
- JSON parser limitado a `1mb`

## LGPD
- Criptografia de CPF, CNS, NIS e segredos TOTP
- Mascaramento de CPF/CNS nas respostas
- Solicitações de privacidade em `/privacy/*`
- Anonimização existe, com observação de maturidade parcial em fluxo sensível

## Auditoria e logs
- Cadeia hash em `AuditLog`
- Integridade verificável por endpoint dedicado
- Eventos clínicos, autenticação, plataforma e segurança registram log
- Logs técnicos e métricas de request habilitados no backend

## Hash e criptografia
- AES-256-GCM para dados em repouso
- HMAC-SHA256 para índices de busca
- Separação recomendada entre `DATA_ENCRYPTION_KEY` e `PATIENT_LOOKUP_HASH_KEY`

## Proteção contra replay
- Refresh token rotacionado
- Endpoint laboratorial prevê idempotency key
- CSRF exigido para mutações autenticadas por cookie

## Proteção contra brute force
- `authRateLimit`
- 2FA com desafio expirável e número limitado de tentativas

## Menor privilégio
- `support_admin` opera somente domínio platform
- `security_auditor` focado em trilha e verificação
- `gestor` lê muito, mas não assume escrita clínica plena

## Separação Support Admin
- Bloqueio clínico por `blockSupportAdminFromClinical`
- Rotas `/platform/*` exigem `requireSupportAdmin`

## Cross Municipality, Cross UBS e Patient Global
- Cross-municipality é bloqueado para leitura clínica regular
- Cross-UBS municipal é controlado por role e contexto clínico
- Eventos relevantes registram `cross_team_patient_access`

## Threat model
### Principais ameaças
- Exposição de dado sensível por rota clínica
- Escalada indevida de privilégio
- Uso abusivo de sessão técnica
- Corrupção ou apagamento de trilha
- Importação de dado inconsistente ou malicioso

## Matriz STRIDE
| Categoria | Cenário | Controle atual | Status |
|---|---|---|---|
| Spoofing | Login indevido | JWT, senha forte, 2FA, rate limit | IMPLEMENTADO |
| Tampering | Alterar trilha | cadeia hash + endpoint de integridade | IMPLEMENTADO |
| Repudiation | Negar ação clínica | audit log com ator, IP, requestId | IMPLEMENTADO |
| Information Disclosure | Vazamento de CPF/CNS | criptografia + mascaramento + RBAC | IMPLEMENTADO |
| Denial of Service | Abuso de API | rate limits e health/readiness | IMPLEMENTADO |
| Elevation of Privilege | suporte acessar clínico | `blockSupportAdminFromClinical`, guards por capability | IMPLEMENTADO |

## Tabela de controles
| Controle | Descrição | Implementação | Arquivo | Status |
|---|---|---|---|---|
| JWT access | Token de acesso | middleware auth + auth routes | `backend/src/routes/auth.js` | IMPLEMENTADO |
| Refresh rotation | Rotação de sessão | persistência e revogação | `backend/src/db.js` | IMPLEMENTADO |
| 2FA TOTP | segundo fator | setup/enable/disable/login verify | `backend/src/routes/me.js` | IMPLEMENTADO |
| CSRF | proteção cookie auth | `requireCsrfForCookieAuth` | `backend/src/middlewares/csrf.js` | IMPLEMENTADO |
| Rate limit | anti abuso | middlewares dedicados | `backend/src/middlewares/rate-limits.js` | IMPLEMENTADO |
| Helmet | headers de proteção | setup global | `backend/src/middlewares/security.js` | IMPLEMENTADO |
| CORS restrito | origins permitidas | setup global | `backend/src/middlewares/security.js` | IMPLEMENTADO |
| AES-256-GCM | criptografia em repouso | `encryptText/decryptText` | `backend/src/db.js` | IMPLEMENTADO |
| HMAC lookup | busca segura | `computeLookupHash` | `backend/src/db.js` | IMPLEMENTADO |
| Audit chain | integridade de log | hash encadeado | `backend/src/services/audit.js` | IMPLEMENTADO |
| Break Glass | acesso emergencial | senha + TTL + audit | `backend/src/routes/break-glass.js` | IMPLEMENTADO |
| Support isolation | suporte sem clínico | middleware específico | `backend/src/middlewares/auth.js` | IMPLEMENTADO |
| LGPD requests | atendimento de privacidade | rotas `/privacy/*` | `backend/src/routes/privacy.js` | PARCIAL |

## Boas práticas
- Separar chave de criptografia de chave de lookup
- Nunca ampliar capability clínica para `support_admin`
- Validar `municipalityId`, `unitId` e `teamId` em rotas novas

## Referências internas
- `backend/src/middlewares/security.js`
- `backend/src/middlewares/rate-limits.js`
- `backend/src/routes/break-glass.js`
- `backend/src/db.js`
- `docs/security/PHASE1_SECURITY_REPORT.md`
- `docs/security/security-review.md`

## Arquivos relacionados
- `docs/02-architecture/ARCHITECTURE.md`
- `docs/06-infrastructure/INFRASTRUCTURE.md`
- `docs/07-operations/OPERATIONS.md`
