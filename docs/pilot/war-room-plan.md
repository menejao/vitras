# War Room Plan — Primeiras 2 Semanas do Piloto

**Versão:** 1.0  
**Data:** 2026-06-18  
**Escopo:** checkpoints, responsáveis, comunicação e critérios de escalonamento para os primeiros 14 dias

---

## Estrutura do War Room

O "war room" é um protocolo de atenção intensificada — não requer sala física.  
É um conjunto de reuniões, métricas e canais de comunicação que garantem visibilidade total nos primeiros 14 dias.

### Participantes

| Papel | Responsabilidade |
|-------|-----------------|
| Operador VITRAS (tech lead) | Monitoramento técnico, resposta a incidentes |
| Gestor Municipal | Ponto de contato com a equipe da UBS |
| Enfermeira-chefe (nurse_manager) | Referência clínica e feedback de uso |
| DPO VITRAS | Questões LGPD |

---

## Calendário de Checkpoints

### Dia 0 — Ativação (Go-Live)

**Horário:** Manhã do dia de ativação  
**Duração:** 2h

| Atividade | Responsável |
|-----------|-------------|
| Verificar go-live checklist completo | Tech Lead VITRAS |
| Criar usuários de todos os profissionais | Tech Lead + Gestor |
| Primeiro acesso de cada perfil testado | Tech Lead (presencial ou vídeo) |
| Confirmar CloudWatch alarmes ativos | Tech Lead |
| Confirmar backup RDS ativo | Tech Lead |
| Briefing de suporte para o gestor municipal | Operador VITRAS |
| Canal de suporte comunicado a toda equipe | Gestor Municipal |

**Go/No-Go final:** Tech Lead confirma go-live antes de liberar para usuários.

---

### Dia 1 — Primeiro Dia Operacional

**Horário:** Final do expediente (17h ou 18h)  
**Formato:** Call de 30 min com gestor + enfermeira-chefe

| Pauta | Meta |
|-------|------|
| Quantos usuários logaram? | >= 50% da equipe |
| Algum erro reportado? | Classificar e resolver |
| Dúvidas de uso? | Responder e documentar no FAQ |
| Sistema estável? | Health check verde |

**Métricas verificadas:**
- Audit log: logins por perfil
- CloudWatch: CPU, memória, erros 5xx
- `/health`: status OK

---

### Dia 3 — Checkpoint Precoce

**Formato:** Assíncrono — gestor envia relatório por e-mail  
**Prazo:** até as 18h do Dia 3

Gestor reporta:
- Número de atendimentos registrados
- Problemas encontrados
- Dúvidas recorrentes dos profissionais

Tech Lead VITRAS:
- Verifica audit log — registros criados
- Verifica CloudWatch — sem erros silenciosos
- Responde ao gestor em até 2h

---

### Dia 7 — Revisão Semanal 1

**Formato:** Call de 45 min  
**Participantes:** Operador VITRAS + Gestor + Enfermeira-chefe

| Pauta | Meta |
|-------|------|
| Revisão de métricas semana 1 | Ver tabela abaixo |
| Incidentes da semana | Zero SEV1, SEV2 resolvidos |
| Feedback por perfil | Coletar 1 ponto positivo e 1 melhoria por perfil |
| Previsão de homologação PEC | Confirmar data |
| Ajustes de treinamento? | Se adoção < 50% |

**Métricas semana 1:**

| Métrica | Coleta | Meta semana 1 |
|---------|--------|--------------|
| Usuários ativos (logins distintos) | Audit log | >= 50% da equipe |
| Pacientes cadastrados | COUNT(patients) | >= 20 |
| Atendimentos criados | COUNT(records) | >= 30 |
| Incidentes SEV1 | Canal suporte | 0 |
| Tempo médio de resposta API | CloudWatch | < 500ms |

---

### Dia 10 — Checkpoint Homologação PEC

**Atividade:** Sessão de homologação PEC (se não realizada antes)  
**Responsável:** Tech Lead VITRAS + Técnico PEC municipal  
**Duração:** até 4h  
**Documento:** preencher `docs/homologacao/evidence-{municipio}-{data}.md`

Se homologação PEC não for possível no Dia 10 por indisponibilidade do PEC:  
→ Reagendar para o Dia 14 no máximo  
→ Registrar como risco R-18 ativo

---

### Dia 14 — Revisão Semanal 2 / Revisão de Meados

**Formato:** Call de 60 min  
**Participantes:** Operador VITRAS + Gestor + Enfermeira-chefe + (opcional) 1 ACS + 1 médico

| Pauta | Meta |
|-------|------|
| Revisão de métricas semana 2 | Ver tabela abaixo |
| Status homologação PEC | PASS ou plano de re-homologação |
| Feedback qualitativo completo | 1 entrevista por perfil |
| Problemas persistentes | Plano de resolução |
| Previsão de encerramento do piloto | Data Dia 30 confirmada |
| Ajuste de critérios de sucesso? | Se necessário, documentar |

**Métricas dia 14:**

| Métrica | Meta dia 14 |
|---------|-------------|
| Usuários ativos (últimos 7 dias) | >= 70% da equipe |
| Pacientes cadastrados | >= 50 |
| Atendimentos criados | >= 80 |
| Exportações CDS executadas | >= 2 |
| Homologação PEC | PASS ou agendada |
| SEV1 total | 0 |
| SEV2 resolvidos | 100% |

---

## Comunicação

### Canal principal

E-mail: lgpd@vitras.com.br com cópia ao gestor municipal  
Assunto padrão: `[PILOTO-{MUNICÍPIO}] {tipo}: {descrição breve}`

### Templates de comunicação

**Update diário (dias 1-7):**
```
[PILOTO-{MUNICÍPIO}] Update Dia {N}

Status: ESTÁVEL | ATENÇÃO | INCIDENTE
Usuários ativos hoje: {N}
Atendimentos do dia: {N}
Incidentes: {N} (detalhes abaixo)
Próximo checkpoint: Dia {N}
```

**Alerta de incidente (SEV1/SEV2):**
```
[PILOTO-{MUNICÍPIO}] ALERTA {SEV}: {descrição}

Detectado: {hora}
Impacto: {descrição do impacto}
Ação em curso: {o que estamos fazendo}
Próxima atualização: {hora}
```

---

## Métricas Observadas — Dashboard War Room

Verificar diariamente nos primeiros 7 dias, depois 2x/semana:

| Métrica | Fonte | Alerta se |
|---------|-------|-----------|
| HTTP 5xx count | CloudWatch | > 10 em 1h |
| CPU instância EB | CloudWatch | > 80% por 10min |
| Memória instância | CloudWatch | > 85% |
| Logins distintos/dia | Audit log query | < 2/dia após dia 3 |
| Registros criados/dia | DB query | 0/dia por 2 dias seguidos |
| Erros de importação CDS | Log export | > 0 |
| Backup RDS | AWS Console | Snapshot não gerado em 24h |

---

## Critérios de Escalonamento

| Situação | Ação |
|----------|------|
| 0 logins por 2 dias | Verificar conectividade UBS, reativar senhas |
| SEV1 sem resolução em 2h | Rollback EB → comunicar município |
| Adoção < 30% no Dia 7 | Reunião emergencial gestor + treinamento adicional |
| Homologação PEC falhando 2x | Acionar suporte DATASUS + revisar cds-field-mapping |
| Incidente LGPD | Parar sistema → DPO → avaliar notificação ANPD |
| Gestor municipal solicita pausa | Honrar pedido, documentar, planejar retomada |

---

## Encerramento do War Room

O war room intensificado encerra no Dia 14 se:
- Todos os critérios de meados atendidos
- Zero SEV1 na semana 2
- Homologação PEC concluída ou com data confirmada
- Gestor confirma que equipe está operacional

Após Dia 14: suporte padrão conforme support-runbook.md.

---

*VITRAS APS — docs/pilot/war-room-plan.md*
