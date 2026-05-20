# Phase 3 Security Advanced Report — SaudeUbs/SIGUS

**Data de execução:** 2026-05-14  
**Branch:** main  
**Commits desta fase:** d2d6d39 → b2d2a00

---

## Regras seguidas

- Sem alterações de UI/UX
- Sem refatoração de layout
- Sem alterações no banco JSONB (estrutura)
- Fase 4 não iniciada
- Commits pequenos e isolados
- Build validado a cada etapa
- Login atual preservado
- Compatibilidade com usuários e segredos 2FA existentes mantida

---

## Mudanças realizadas

### Passo 1+2 — Refresh tokens + Revogação de sessão
**Commit:** `d2d6d39` · `feat(auth): add refresh token flow`

**Backend:**
- Novo campo `refreshTokens` em `ensureDbShape` (array no JSONB)
- `createRefreshToken(userId, ip, db)` — gera 80 chars hex aleatórios, armazena SHA-256 hash
- `POST /auth/refresh` — valida refresh token, rotaciona (token antigo revogado, novo criado), retorna novo access token + novo refresh token
- `POST /auth/logout` — revoga o refresh token específico, registra auditoria
- Login, register e 2FA verify retornam `refreshToken` na resposta
- `createToken` inclui claim `jti` (UUID único por token)
- `ACCESS_TOKEN_EXPIRES_IN` controla duração do access token (padrão: `JWT_EXPIRES_IN`)
- `REFRESH_TOKEN_EXPIRES_IN` controla duração do refresh token (padrão: `7d`)
- Pruning automático: array de refresh tokens limitado a 500 entradas válidas

**Frontend (api.js):**
- `refreshSession(refreshToken)` — chama `POST /auth/refresh`
- `logoutApi(token, refreshToken)` — chama `POST /auth/logout`

**Frontend (App.jsx):**
- sessionStorage salva `{ token, user, refreshToken }` no login/register
- `handleApiError` é agora `async`: tenta refresh transparente em 401 antes de deslogar
  - Se refresh bem-sucedido: atualiza token/user/refreshToken no estado e sessionStorage sem mostrar erro
  - Se refresh falhar: limpa sessão normalmente ("Sessão expirada")
- `logout()` chama `logoutApi` antes de limpar estado (fire-and-forget)
- Profile update preserva `refreshToken` existente no sessionStorage

**Estrutura do refresh token no JSONB:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "tokenHash": "sha256-hex",
  "expiresAt": "ISO",
  "createdAt": "ISO",
  "revokedAt": "ISO|null",
  "ip": "string"
}
```

**Auditoria registrada:** `auth.login`, `auth.register`, `auth.refresh`, `auth.logout`, `auth.login_2fa_verified`

---

### Passo 3 — CSP enforced
**Commit:** `1acb012` · `fix(security): enforce content security policy`

Removido `reportOnly: true` da configuração do Helmet. CSP agora é `Content-Security-Policy` (enforced). Backend é API-only (nenhum HTML/JS/CSS servido), então `default-src 'none'` não afeta o frontend. Violações ainda são reportadas em `/csp-report`.

---

### Passo 4 — TOTP com biblioteca auditada
**Commit:** `3325d5a` · `fix(security): replace custom totp implementation`

Substituída implementação manual de BASE32/HOTP/TOTP por `otplib` (`verifySync`, `generateSecret`). Algoritmo idêntico (SHA-1, 6 dígitos, 30s step, ±1 window). Segredos existentes permanecem válidos (mesmo formato base32). Removidos: `BASE32_ALPHABET`, `base32Encode`, `base32Decode`, `generateTotpCode` (~50 linhas).

---

### Passo 5 — Validação de payload com Zod
**Commit:** `6c728a9` · `feat(validation): add zod schemas for critical routes`

Instalado `zod`. Schemas criados para:

| Rota | Schema |
|------|--------|
| `POST /auth/login` | `LoginSchema` — email, password obrigatórios |
| `POST /auth/register` | `RegisterSchema` — name, email, password, role obrigatórios |
| `POST /patients` | `PatientCreateSchema` — name, phone obrigatórios |
| `PUT /patients/:id` | `PatientUpdateSchema` — passthrough (campos opcionais) |
| `POST /tasks` | `TaskCreateSchema` — patientId, assigneeId, title obrigatórios |
| `PATCH /tasks/:id` | `TaskPatchSchema` — status obrigatório |
| `POST /patients/:id/appointments` | `AppointmentCreateSchema` — date, summary obrigatórios |
| `POST /patients/:id/records` | `RecordCreateSchema` — type (enum), date, title obrigatórios |
| `POST /privacy/requests` | `PrivacyRequestCreateSchema` — patientId, type (enum) obrigatórios |

Payload inválido retorna `400` com `{ error: "Dados inválidos", details: ["campo: mensagem"] }`.

Schemas com `.passthrough()` onde campos extras são válidos (PUT paciente, PATCH tarefa). Schemas de auth sem passthrough (strict).

---

### Passo 6 — Auditoria de logs e erros
**Commit:** `b2d2a00` · `fix(security): redact sensitive logs and errors`

- Global error handler agora loga `Error.name: Error.message` em produção (sem stack) e erro completo em dev
- Nunca expõe stack traces para clientes (`"Erro interno do servidor"` permanece)
- Log de requisições: apenas `method URL statusCode duration userId ip` — sem corpo, sem tokens, sem PII
- `sanitizeUser` já remove `password`, `twoFactorSecret`, `twoFactorPendingSecret` de todas respostas
- `addAuditLog` detalha apenas IDs e nomes de campos (nunca valores de CPF/CNS/senha)
- CPF, CNS, `cnsCpf`, `twoFactorSecret`, `twoFactorPendingSecret` são criptografados no JSONB (AES-256-GCM via `DATA_ENCRYPTION_KEY`)
- Backup key aceita apenas via header `x-backup-key` (nunca em URL, desde Fase 1)

---

## Env vars novas (Fase 3)

| Variável | Obrigatório | Padrão | Descrição |
|----------|------------|--------|-----------|
| `ACCESS_TOKEN_EXPIRES_IN` | Não | `JWT_EXPIRES_IN` | Duração do access token (ex: `15m`) |
| `REFRESH_TOKEN_EXPIRES_IN` | Não | `7d` | Duração do refresh token |

**Para segurança máxima em produção:** defina `ACCESS_TOKEN_EXPIRES_IN=15m` no Render.

---

## Como validar

### Refresh token
1. `POST /auth/login` → resposta inclui `refreshToken`
2. Access token expira (aguardar ou definir `ACCESS_TOKEN_EXPIRES_IN=1s` temporariamente)
3. `POST /auth/refresh` com `{ "refreshToken": "<token>" }` → retorna novo `token` e `refreshToken`
4. Segundo `POST /auth/refresh` com mesmo refresh token → `401 "Sessão encerrada"` (token foi rotacionado)
5. Frontend: acionar 401 em qualquer rota autenticada com access token expirado → deve refrescar silenciosamente

### Logout / revogação
1. Login → salvar `refreshToken`
2. `POST /auth/logout` (com Bearer token) e body `{ "refreshToken": "..." }` → `{ "ok": true }`
3. `POST /auth/refresh` com o mesmo refresh token → `401 "Sessão encerrada"`
4. Verificar audit log: `auth.logout` registrado

### 2FA
1. `POST /me/2fa/setup` → retorna `secret` e `otpauthUrl`
2. Escanear QR no app TOTP (Google Authenticator, Authy, etc.)
3. `POST /me/2fa/enable` com `{ "code": "123456" }` → token renovado
4. Deslogar e logar novamente → desafio 2FA exigido
5. Usuários com segredos existentes: flow deve continuar funcionando (mesmos parâmetros base32)

### CSP
1. `GET /health` → header `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`
2. Simular violação: `POST /csp-report` com `Content-Type: application/csp-report` → `204`
3. Log do servidor: `[csp-violation] {...}` visível

### Validação Zod
1. `POST /auth/login` sem body → `400 { "error": "Dados inválidos", "details": [...] }`
2. `POST /auth/login` com `{ "email": "nao-e-email", "password": "" }` → `400`
3. `POST /patients` sem `name` → `400`
4. `POST /patients/:id/records` com `type: "invalido"` → `400`

---

## Decisões técnicas

| Decisão | Motivo |
|---------|--------|
| Refresh token como body (não cookie) | Frontend em Cloudflare Workers (subdomínio diferente); cookie `SameSite=None` exigiria mudanças de CORS e infraestrutura |
| Rotation obrigatória a cada refresh | Previne replay attacks; token velho vira inválido imediatamente |
| Access token sem lista de revogação | Tokens são de curta duração (configúravel); implementar blacklist exigiria armazenamento persistente e consulta por request |
| `otplib` com `verifySync` | API síncrona compatível com o fluxo atual; mesmos parâmetros da implementação manual |
| Zod `.passthrough()` em PUT/PATCH | Evita quebrar campos opcionais e futuras adições; strict apenas em auth |
| CSP enforced (não report-only) | Backend é API-only; impossível quebrar frontend com CSP no servidor de API |

---

## Riscos restantes

| Risco | Severidade | Fase |
|-------|-----------|------|
| Access token sem revogação imediata | Médio | Dependente de Redis |
| Banco: JSONB único, sem índices, lock serializado | Crítico-arquitetural | Fase 4 |
| App.jsx ~11k linhas sem code splitting | Médio | Fase 4 |
| `refreshTokens` em JSONB pode crescer | Baixo | Fase 4 (migração para banco relacional) |
| `backend-dotnet` abandonado no repo | Baixo | Qualquer momento |
| Sem tela de 2FA no frontend React (apenas backend implementado) | Médio | Fase 4 UI |

---

## Próximos passos — Fase 4

1. **Migração de banco** — sair do JSONB único para tabelas PostgreSQL relacionais
2. **Code splitting** — App.jsx `import()` dinâmico para reduzir bundle inicial
3. **Índices** — índices em `users.email`, `patients.teamId`, `refreshTokens.tokenHash`
4. **Tela 2FA no frontend** — implementar tela de desafio 2FA no App.jsx
5. **Admin: listar sessões ativas** — endpoint para listar/revogar refresh tokens por usuário
6. **Remover backend-dotnet** — pasta abandonada no monorepo

---

*Nenhuma alteração de UI/UX foi feita. Fase 3 focada exclusivamente em segurança avançada.*
