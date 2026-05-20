# PLANO DE NORMALIZAÇÃO DO BANCO — SaudeUbs/SIGUS

Data de referência: 2026-05-14

---

## 1. SITUAÇÃO ATUAL

O banco de dados usa um **antipadrão JSONB single-row**: toda a aplicação é armazenada em uma única linha na tabela `app_state`, coluna `data JSONB`. Isso funciona para volumes pequenos mas apresenta riscos críticos em produção:

| Risco | Impacto |
|-------|---------|
| Travamento global em escrita | `withDb` serializa todas as escritas em fila — uma operação lenta bloqueia todas as outras |
| Payload cresce indefinidamente | A cada insert/update, o JSONB inteiro é re-serializado e reescrito |
| Sem índices | Buscas em `patients` ou `clinicalRecords` fazem scan completo do JSONB |
| Sem constraints de FK | Integridade referencial garantida apenas no código |
| Backup/restore mais lento | Exporta o estado inteiro, não registros individuais |
| PITR menos útil | Reverter para um ponto no tempo afeta todos os dados, não apenas o registro problemático |

**Volume atual (2026-05-14):**

| Coleção | Registros |
|---------|-----------|
| patients | ~1.250 |
| clinicalRecords | ~9.425 |
| appointments | ~1.250 |
| tasks | ~418 |
| teams | 5 |
| users | 10 |

Payload total estimado: ~5–15 MB por leitura/escrita completa.

---

## 2. TABELAS FUTURAS

### Obrigatórias (migração sem perda de funcionalidade)

```sql
-- Controle de schema (já existe)
CREATE TABLE schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Equipes
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  manager_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usuários
-- cpf_enc, twofa_secret_enc = AES-256-GCM ciphertext (prefix enc1:)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  team_id TEXT REFERENCES teams(id),
  council_type TEXT,
  council_number TEXT,
  council_uf TEXT,
  twofa_enabled BOOLEAN NOT NULL DEFAULT false,
  twofa_secret_enc TEXT,
  twofa_pending_secret_enc TEXT,
  twofa_pending_created_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  last_seen_ip TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tokens de refresh
CREATE TABLE refresh_tokens (
  hash TEXT PRIMARY KEY,          -- SHA-256 do token raw
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON refresh_tokens(user_id);
CREATE INDEX ON refresh_tokens(expires_at);

-- Pacientes
-- cpf_enc, cns_enc = AES-256-GCM ciphertext
CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  name TEXT NOT NULL,
  mother_name TEXT,
  cpf_enc TEXT,
  cns_enc TEXT,
  cns_cpf TEXT,
  phone TEXT,
  phone_alt TEXT,
  address TEXT,
  micro_area TEXT,
  assigned_acs_id TEXT,
  care_category TEXT NOT NULL DEFAULT 'general',
  chronic_conditions JSONB NOT NULL DEFAULT '[]',
  birth_date DATE,
  marital_status TEXT,
  sex_at_birth TEXT,
  gender_identity TEXT,
  comorbidities TEXT,
  medications TEXT,
  allergies TEXT,
  -- Campos obstétricos
  pregnancy_start_date DATE,
  expected_delivery_date DATE,
  gestational_age_dum_weeks INTEGER,
  gestational_age_dum_days INTEGER,
  gestational_age_usg_weeks INTEGER,
  gestational_age_usg_days INTEGER,
  usg_date_1 DATE,
  usg_date_2 DATE,
  usg_date_3 DATE,
  prenatal_start_date DATE,
  postpartum_start_date DATE,
  -- Privacidade
  anonymized_at TIMESTAMPTZ,
  anonymized_by TEXT,
  anonymize_reason TEXT,
  anonymize_request_id TEXT,
  -- Metadados
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON patients(team_id);
CREATE INDEX ON patients(care_category);
CREATE INDEX ON patients(assigned_acs_id);
CREATE INDEX ON patients(micro_area);

-- Agendamentos
CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  date DATE NOT NULL,
  summary TEXT NOT NULL,
  conduct TEXT,
  next_step TEXT,
  demand_type TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON appointments(patient_id);
CREATE INDEX ON appointments(team_id, date DESC);

-- Registros clínicos
CREATE TABLE clinical_records (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  date DATE,
  protocol_tag TEXT,
  metadata JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON clinical_records(patient_id);
CREATE INDEX ON clinical_records(team_id, created_at DESC);
CREATE INDEX ON clinical_records(type);

-- Mensagens do paciente
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  text TEXT NOT NULL,
  author_name TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON messages(patient_id);

-- Tarefas
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  team_id TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  due_date DATE,
  assignee_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON tasks(team_id, status);
CREATE INDEX ON tasks(patient_id);

-- Protocolos
CREATE TABLE protocol_templates (
  id TEXT PRIMARY KEY,
  team_id TEXT,          -- NULL = template global
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  targets JSONB,
  deadlines JSONB,
  vaccines JSONB,
  authority TEXT,
  reference TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ON protocol_templates(team_id, category) WHERE team_id IS NOT NULL;

-- Versões de protocolos
CREATE TABLE protocol_template_versions (
  id TEXT PRIMARY KEY,
  protocol_template_id TEXT NOT NULL REFERENCES protocol_templates(id),
  data JSONB NOT NULL,
  version INTEGER NOT NULL,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  team_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON audit_logs(team_id, created_at DESC);
CREATE INDEX ON audit_logs(user_id, created_at DESC);
CREATE INDEX ON audit_logs(resource_id);

-- Solicitações de privacidade LGPD
CREATE TABLE privacy_requests (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  patient_id TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  correction_data JSONB,
  result JSONB,
  created_by TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by TEXT,
  completed_at TIMESTAMPTZ,
  executed_by TEXT
);
CREATE INDEX ON privacy_requests(team_id, status);

-- Challenges de login (2FA)
CREATE TABLE login_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON login_challenges(user_id);
```

---

## 3. PLANO DE MIGRAÇÃO INCREMENTAL

### Princípios

1. **Nunca migrar JSONB sem testar staging primeiro**
2. **Migração incremental em 3 fases** — cada fase independente e reversível
3. **Dual-write durante transição** — escrever em JSONB e nas novas tabelas em paralelo
4. **Cutover com janela de manutenção** — mudar leitura para as novas tabelas após validação
5. **Rollback = reverter variável de feature flag `DB_MODE`**

### Fase A — Tabelas auxiliares (sem breaking change)

Migrar apenas as coleções que não são lidas em hot path:
- `audit_logs`
- `refresh_tokens`
- `login_challenges`
- `privacy_requests`
- `protocol_template_versions`

**Impacto:** Zero para usuários finais. Apenas operações internas.
**Rollback:** Remover as tabelas, continuar lendo do JSONB.

### Fase B — Tabelas relacionais com dual-write

- Criar tabelas `teams`, `users`, `patients`
- Implementar dual-write: cada operação de escrita persiste em JSONB E na nova tabela
- Leitura continua do JSONB
- Validar consistência diariamente com query de comparação

### Fase C — Cutover para leitura relacional

- Feature flag `DB_MODE=relational` muda as leituras para as novas tabelas
- Desligar JSONB para escrita
- `app_state` vira somente backup/emergência
- Monitorar por 7 dias, depois deprecar

### Fase D — Remover JSONB

- Após 30 dias sem incidentes em Fase C
- Remover `app_state` tabela ou manter apenas como historical snapshot

---

## 4. ESTIMATIVA DE ESFORÇO

| Fase | Esforço estimado | Risco |
|------|-----------------|-------|
| Fase A | 2–3 dias | Baixo |
| Fase B | 5–7 dias | Médio |
| Fase C | 2–3 dias | Alto (cutover) |
| Fase D | 1 dia | Baixo |

---

## 5. PRÉ-REQUISITOS ANTES DE INICIAR

- [ ] Ambiente de staging com banco Neon separado
- [ ] Smoke tests passando em staging
- [ ] Backup completo antes de cada fase
- [ ] Rollback testado em staging
- [ ] `withDb` serialization lock será substituído por transações Postgres (Fase B/C)

---

## 6. DECISÃO

**Recomendação:** Manter JSONB para go-live inicial (v1.0). Executar Fase A assim que houver staging estável. Planejar Fase B para v1.1 (após 4–8 semanas de produção estável com dados reais).

> Migrar antes de ter tráfego real é arriscado. Migrar com dados reais e staging validado é mais seguro.
