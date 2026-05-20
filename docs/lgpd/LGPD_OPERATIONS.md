# OPERAÇÕES LGPD — SaudeUbs/SIGUS

Data de referência: 2026-05-14

---

## 1. VISÃO GERAL

O sistema implementa conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018) para dados de saúde. Dados de saúde são considerados **dados sensíveis** (Art. 11 LGPD) e exigem nível de proteção superior.

### Recursos implementados

| Recurso | Como funciona |
|---------|---------------|
| Criptografia em repouso | CPF, CNS, `twoFactorSecret` cifrados com AES-256-GCM antes de persistir no banco |
| Anonimização | `POST /privacy/retention/anonymize` — apaga dados pessoais, mantém ID e marcador de anonimização |
| Solicitações de privacidade | `POST /privacy/requests` — fluxo de acesso, correção e exclusão de dados |
| Trilha de auditoria | Toda ação relevante registrada em `auditLogs` com userId, IP, timestamp |
| Retenção automática | Anonimização de pacientes sem atividade por período configurável |
| Exclusão de conta | Desativação de usuários por gestor |

---

## 2. SOLICITAÇÕES DE PRIVACIDADE (titular dos dados)

Quando um paciente (ou responsável legal) solicitar exercício dos direitos LGPD:

### Tipos suportados

| Tipo | Descrição | Endpoint |
|------|-----------|----------|
| `access` | Relatório completo dos dados do paciente | `POST /privacy/requests` com `type: "access"` |
| `correction` | Correção de dados incorretos | `POST /privacy/requests` com `type: "correction"` |
| `deletion` | Anonimização do paciente (exclusão efetiva) | `POST /privacy/requests` com `type: "deletion"` |

### Fluxo operacional

```
1. Gestor recebe solicitação do titular (presencial, e-mail, etc.)

2. Registrar solicitação no sistema:
   POST /privacy/requests
   {
     "patientId": "UUID_DO_PACIENTE",
     "type": "access|correction|deletion",
     "notes": "Motivo e como o titular entrou em contato"
   }

3. Sistema cria solicitação com status "pending"

4. Revisar e aprovar:
   PATCH /privacy/requests/:id
   { "status": "approved" }

5. Executar a solicitação:
   POST /privacy/requests/:id/execute

6. Para "access": sistema gera relatório (retornado no body)
   Para "correction": sistema aplica correções no cadastro
   Para "deletion": sistema anonimiza o paciente e remove registros clínicos

7. Confirmar para o titular que a solicitação foi atendida
8. Prazo legal: 15 dias corridos (Art. 18 LGPD)
```

### Verificar solicitações pendentes

```bash
# Listar todas as pendentes (como gestor autenticado)
curl -H "Authorization: Bearer $TOKEN" \
  https://api.saudeubs.com.br/privacy/requests?status=pending | jq

# Listar por paciente
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.saudeubs.com.br/privacy/requests?patientId=UUID_PACIENTE" | jq
```

---

## 3. ANONIMIZAÇÃO POR RETENÇÃO

Pacientes sem atividade por longo período devem ser anonimizados conforme política de retenção da organização.

### Dry-run (verificar sem alterar dados)

```bash
curl -X POST https://api.saudeubs.com.br/privacy/retention/anonymize \
  -H "Authorization: Bearer $GESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"olderThanDays": 1825, "dryRun": true}' | jq
# Retorna: candidateCount, sample (20 primeiros), cutoffIso
```

### Executar anonimização

```bash
# ATENÇÃO: irreversível. Sempre fazer dry-run antes.
curl -X POST https://api.saudeubs.com.br/privacy/retention/anonymize \
  -H "Authorization: Bearer $GESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"olderThanDays": 1825}' | jq
# olderThanDays = 1825 dias = ~5 anos
```

> Sistema registra automaticamente em `auditLogs` com ação `privacy.retention_anonymize_run`.

### O que a anonimização faz

**Apaga do cadastro do paciente:**
- Nome, nome da mãe, CPF, CNS, telefone, endereço, microárea
- Data de nascimento, condições crônicas, estado civil, identidade de gênero
- Todos os campos obstétricos/ginecológicos
- Comorbidades, medicamentos, alergias

**Apaga completamente:**
- Todos os agendamentos do paciente
- Todos os registros clínicos
- Todas as mensagens
- Todas as tarefas

**Preserva:**
- ID do paciente (para manter consistência de referências)
- Nome: `"Paciente Anonimizado XXXXXXXX"` (8 chars do UUID)
- Marcador `privacy.anonymizedAt`, `privacy.anonymizedBy`, `privacy.reason`

---

## 4. TRILHA DE AUDITORIA

### Acessar logs de auditoria

```bash
# Últimas ações (como gestor ou médico)
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.saudeubs.com.br/audit-logs?limit=100" | jq '.items'

# Por paciente específico
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.saudeubs.com.br/audit-logs?patientId=UUID" | jq '.items'

# Por usuário específico
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.saudeubs.com.br/audit-logs?action=me.read&limit=100" | jq '.items'

# Exportar CSV
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.saudeubs.com.br/audit-logs/export?format=csv" -o audit-export.csv
```

### Ações auditadas (principais)

| Ação | Quando |
|------|--------|
| `auth.login` | Login bem-sucedido |
| `auth.login_failed` | Tentativa de login com senha errada |
| `auth.logout` | Logout |
| `patient.created` | Novo paciente criado |
| `patient.updated` | Cadastro de paciente atualizado |
| `patient.deleted` | Paciente removido |
| `appointment.created` | Agendamento criado |
| `record.created` | Registro clínico criado |
| `privacy.request_created` | Solicitação LGPD registrada |
| `privacy.request_executed_*` | Solicitação LGPD executada |
| `privacy.retention_anonymize_run` | Anonimização em lote |
| `user.created` | Novo usuário criado |
| `user.updated` | Usuário atualizado |
| `user.deleted` | Usuário removido |

---

## 5. INCIDENTE DE SEGURANÇA / VIOLAÇÃO DE DADOS

Se houver suspeita de acesso não autorizado a dados pessoais de saúde:

### Checklist de resposta (72h)

```
HORA 0-1:
[ ] Identificar o escopo: quais dados, quais pacientes, por qual período
[ ] Acionar DPO (Encarregado de Proteção de Dados)
[ ] Isolar o problema: revogar credenciais comprometidas (ver RUNBOOK_OPERACIONAL.md seção 9)
[ ] Coletar evidências: logs do Render, audit logs, Neon connection logs

HORA 1-24:
[ ] Avaliar: confirmada violação de dados pessoais?
[ ] Se confirmada: notificação interna (diretoria, responsáveis)
[ ] Estimar impacto: número de titulares afetados, natureza dos dados

HORA 24-72:
[ ] Se confirmada: notificar ANPD em até 72h (art. 48 LGPD)
   Formulário: gov.br/anpd → Comunicação de incidente
[ ] Notificar titulares afetados se houver risco relevante
[ ] Documentar: o que ocorreu, quando, como foi detectado, medidas tomadas

PÓS-INCIDENTE:
[ ] Relatório interno completo (post-mortem)
[ ] Corrigir vulnerabilidade
[ ] Atualizar RIPD se necessário
[ ] Registrar no log de incidentes
```

### Como notificar a ANPD

- Portal: peticionamento.anpd.gov.br
- Prazo: 72 horas após ter conhecimento da violação
- Informações necessárias: natureza dos dados, número de titulares, medidas adotadas, contato do DPO

---

## 6. DIREITOS DOS TITULARES (LGPD Art. 18)

| Direito | Como exercer no sistema |
|---------|------------------------|
| Confirmação de existência | Gestor consulta `GET /patients/:id` |
| Acesso aos dados | `POST /privacy/requests` com `type: "access"` → executar |
| Correção de dados incompletos/inexatos | `POST /privacy/requests` com `type: "correction"` → executar |
| Anonimização/bloqueio/eliminação | `POST /privacy/requests` com `type: "deletion"` → executar |
| Portabilidade | Exportar via `POST /privacy/requests/:id/execute` (access) — retorna JSON completo |
| Revogação de consentimento | Gestor pode desativar acesso do usuário |
| Informação sobre compartilhamento | Documentar na Política de Privacidade |

---

## 7. PENDÊNCIAS LGPD (pré-go-live)

| Item | Status | Responsável |
|------|--------|-------------|
| Política de Privacidade publicada | ⬜ Pendente | Jurídico / DPO |
| DPO designado e registrado na ANPD | ⬜ Pendente | Organização |
| RIPD (Relatório de Impacto) elaborado | ⬜ Pendente | DPO + TI |
| Termo de consentimento dos pacientes | ⬜ Pendente | Jurídico |
| Treinamento da equipe de saúde | ⬜ Pendente | Gestor |
| Período de retenção definido formalmente | ⬜ Pendente | DPO |
| Canal oficial para solicitações dos titulares | ⬜ Pendente | Organização |

> A implementação técnica está completa. Os itens pendentes são de natureza organizacional e jurídica.
