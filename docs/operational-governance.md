# Governança Operacional — VITRAS

> **Revisão:** Sprint 4 — Maio 2026

---

## 1. Modelo de Governança

### 1.1 Papéis com Acesso a Relatórios

| Papel | Acesso | Frequência Recomendada |
|-------|--------|------------------------|
| `security_auditor` | Todos os relatórios operacionais | Semanal |
| `break_glass_admin` | Todos os relatórios operacionais | Por incidente |
| `gestor` | Audit logs da própria unidade | Mensal |
| Outros | Sem acesso a relatórios | — |

### 1.2 Princípio de Acesso Mínimo

- Relatórios de governança são restritos a `security_auditor` e `break_glass_admin`
- Gestores só visualizam eventos da própria unidade (isolamento multi-UBS)
- Nenhum relatório retorna email, nome completo ou CPF/CNS raw
- Todas as consultas de relatório são auditadas automaticamente

---

## 2. Tipos de Relatório

### 2.1 Acesso Cross-Team
- **Endpoint:** `GET /audit-logs/reports/cross-team-access`
- **Propósito:** Detectar ACS ou outros usuários acessando pacientes fora de sua equipe
- **Campos retornados:** id, timestamp, actorId (8 chars), actorRole, patientId (8 chars), teamId, reason
- **Frequência recomendada:** Semanal
- **Ação em caso de anomalia:** Investigar com gestor da unidade; potencial violação de LGPD

### 2.2 Falhas de Autenticação
- **Endpoint:** `GET /audit-logs/reports/auth-failures?since=ISO&until=ISO&limit=N`
- **Propósito:** Detectar tentativas de acesso não autorizado, força bruta, contas comprometidas
- **Campos retornados:** id, timestamp, actorId (8 chars), outcome, ip (15 chars), emailMasked
- **Limite:** máximo 500 registros por query
- **Frequência recomendada:** Diário em produção
- **Ação em caso de anomalia:** >20 falhas em 5min → investigar IP; considerar bloqueio

### 2.3 Abuso de Rate Limit
- **Endpoint:** `GET /audit-logs/reports/rate-limit-abuse`
- **Propósito:** Identificar padrões de abuso, ataques, integrações mal configuradas
- **Campos retornados:** prefix, count, lastSeen (agrupado por prefixo)
- **Frequência recomendada:** Semanal
- **Ação em caso de anomalia:** >100 hits em 5min → investigar; potencial ataque

---

## 3. Proteção de PII nos Relatórios

| Campo | Proteção |
|-------|----------|
| Email | Mascarado em `auth.login_failed` (ex: `a***@c***.com`) |
| CPF/CNS | Nunca armazenado em audit logs; apenas hash em banco |
| actorId | Truncado para 8 caracteres |
| patientId | Truncado para 8 caracteres |
| IP | Truncado para 15 caracteres |
| Nome completo | Não incluído em relatórios |

**Base legal:** LGPD Art.6 — minimização de dados em logs de auditoria.

---

## 4. Procedimentos de Escalação

### 4.1 Anomalia Detectada em Relatório

1. `security_auditor` executa relatório e identifica padrão suspeito
2. Documenta achado com timestamp, tipo, actorId, scope
3. Escala para Tech Lead em até 4 horas
4. Tech Lead decide: investigação adicional, bloqueio de conta, ou incidente formal
5. Se dado clínico afetado: notificar DPO (Encarregado LGPD) em até 72 horas (LGPD Art. 48)

### 4.2 Violação de Isolamento Multi-UBS

Se relatório de cross-team-access mostrar acesso de usuário a unidade diferente da sua:

1. Identificar actorId completo via `GET /audit-logs?action=cross_team_patient_access`
2. Suspender conta temporariamente via API admin (se disponível)
3. Notificar gestor da unidade afetada
4. Documentar em registro de incidente de privacidade
5. Avaliar necessidade de notificação ANPD

---

## 5. Retenção de Relatórios Operacionais

- Relatórios são derivados do audit log existente — não armazenados separadamente
- Audit log: retenção conforme `AUDIT_LOG_RETENTION_DAYS` (padrão: 2 anos)
- Exportações de relatórios em CSV/JSON: manter por 5 anos em armazenamento seguro
- Base legal: LGPD Art. 37 (obrigação de manutenção de registros)

---

## 6. Isolamento Multi-UBS nos Relatórios

- `gestor` só acessa audit logs com `teamId` da própria unidade
- `security_auditor` pode filtrar por `unitId` usando parâmetro de query
- `break_glass_admin` tem acesso global mas cada acesso é auditado
- Relatórios de governança sempre incluem `teamId` nos dados retornados para rastreabilidade

---

## 7. Referências

- `docs/lgpd-cfm-considerations.md` — Considerações LGPD/CFM
- `docs/security/security-operations.md` — Operações de segurança
- `docs/runbooks/key-rotation.md` — Rotação de chaves
