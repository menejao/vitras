# Runbook de Resposta a Incidentes de Privacidade e Segurança

**VITRAS APS — v1.0-draft**  
**Data:** 2026-06-18  
**Classificação:** Interno — Restrito  
**Owner:** DPO + Tech Lead

---

## 1. Definição de Incidente

Um **incidente de privacidade/segurança** é qualquer evento que resulte ou possa resultar em:

- Acesso não autorizado a dados pessoais
- Divulgação, cópia ou extração indevida de dados
- Alteração ou destruição não autorizada de dados
- Perda de disponibilidade de dados pessoais por falha técnica ou ataque
- Violação de confidencialidade (ex: usuário acessa dados fora do seu escopo)
- Exportação CDS por usuário não autorizado
- Uso indevido do break-glass sem justificativa de emergência

---

## 2. Classificação de Severidade

### SEV-1 — Crítico

**Exemplos:**
- Vazamento em massa de dados de saúde de pacientes
- Acesso a banco de dados de produção por ator externo
- Ransomware ou malware em infraestrutura de produção
- Exposição pública de CPF/CNS não criptografados
- Exportação CDS em massa por ator não autorizado

**Resposta:** Imediata — 24/7. CEO + DPO + Tech Lead acionados em até 1 hora.  
**Notificação ao Controlador:** Em até 24 horas após ciência.  
**Avaliação ANPD:** Obrigatória — prazo legal de 2 dias úteis a partir da ciência do Controlador.

---

### SEV-2 — Alto

**Exemplos:**
- Acesso indevido de usuário interno a dados de pacientes fora do seu escopo
- Falha no controle de isolamento multi-tenant (usuário de município A acessa dados de município B)
- Perda de dados de um paciente específico por bug de aplicação
- Exportação CDS com dados incorretos importados no PEC
- Uso de break-glass sem justificativa registrada

**Resposta:** Horário comercial estendido. DPO + Tech Lead acionados em até 4 horas.  
**Notificação ao Controlador:** Em até 48 horas.  
**Avaliação ANPD:** Avaliar com DPO.

---

### SEV-3 — Médio/Baixo

**Exemplos:**
- Tentativas de acesso frustradas detectadas nos logs
- Usuário com permissão excessiva identificada em revisão (sem evidência de uso indevido)
- Bug de UI que exibe campo errado (sem exposição de dado sensível real)
- Solicitação de titular não respondida no prazo

**Resposta:** Próximo dia útil. Registrar e tratar dentro do ciclo normal.  
**Notificação ao Controlador:** Informar na próxima comunicação periódica.

---

## 3. Fluxo de Triagem

```
DETECÇÃO
  │
  ├─ Fonte: Audit log, alerta técnico, relato de usuário, relato externo, auditoria interna
  │
  ▼
REGISTRO
  │  Abrir registro de incidente com: data/hora, fonte, descrição inicial, ID de incidente (INC-YYYYMMDD-NNN)
  │
  ▼
CLASSIFICAÇÃO (DPO + Tech Lead)
  │  SEV-1 → SEV-3 conforme seção 2
  │
  ▼
CONTENÇÃO (vide seção 4)
  │
  ▼
INVESTIGAÇÃO
  │  Coletar evidências, identificar escopo, titulares afetados, dados afetados
  │
  ▼
NOTIFICAÇÃO (vide seção 5 a 8)
  │
  ▼
REMEDIAÇÃO
  │  Corrigir causa raiz, aplicar patch, revogar acessos, restaurar dados se necessário
  │
  ▼
POSTMORTEM (vide seção 9)
```

---

## 4. Preservação de Evidências

**Antes de qualquer ação de contenção, preservar:**

- Export dos logs de auditoria do período afetado (imutáveis por design — audit chain SHA-256)
- Logs de acesso do servidor/banco de dados
- Capturas de tela ou registros de qualquer comportamento anômalo
- Identificação dos usuários, IPs, timestamps envolvidos

**Não:**
- Não apagar logs
- Não desligar sistemas sem autorização do Tech Lead (pode destruir evidências voláteis)
- Não comunicar externamente antes de alinhar com DPO + CEO

---

## 5. Contenção

| Cenário | Ação imediata |
|---------|--------------|
| Credencial comprometida | Revogar JWT, forçar logout, resetar senha |
| Acesso indevido interno | Suspender usuário, revisar permissões RBAC |
| Exploração ativa de brecha | Ativar read-only outage mode se necessário, isolar instância |
| Exportação CDS indevida | Revogar capability `cds.export` do usuário; avaliar impacto no PEC |
| Incidente cloud | Contatar provedor, avaliar failover, acionar backup |

---

## 6. Comunicação Interna

| Evento | Quem notificar | Canal | Prazo |
|--------|---------------|-------|-------|
| SEV-1 detectado | CEO, DPO, Tech Lead, todos os sócios | Telefone + Slack urgente | 1 hora |
| SEV-2 detectado | DPO, Tech Lead | Slack + e-mail | 4 horas |
| SEV-3 detectado | DPO, Tech Lead | E-mail | Próximo dia útil |
| Containment concluído | Todos os acionados | Slack/e-mail | Assim que concluído |
| Postmortem disponível | Toda a equipe técnica | Reunião | Em até 5 dias úteis |

---

## 7. Comunicação ao Controlador (Município/UBS)

**Prazo:** 72 horas após ciência do incidente (DPA Cláusula 8).  
**Canal:** E-mail + telefone do ponto focal do Controlador (gestor municipal / coordenador de TI da Secretaria).

**Conteúdo mínimo da notificação:**

```
Assunto: [VITRAS APS] Notificação de Incidente de Segurança — INC-YYYYMMDD-NNN

1. Data e hora em que o incidente foi detectado
2. Natureza do incidente (descrição não técnica)
3. Dados pessoais possivelmente afetados (categorias + volume estimado)
4. Titulares possivelmente afetados
5. Medidas de contenção já adotadas
6. Próximos passos esperados
7. Ponto de contato VITRAS para o incidente: [DPO + Tech Lead]
```

---

## 8. Comunicação à ANPD e aos Titulares

**Responsabilidade primária:** Controlador (Município/Secretaria de Saúde)  
**Papel do VITRAS:** Apoio, fornecimento de informações, cooperação

**Prazo legal para o Controlador comunicar à ANPD:** 2 dias úteis a partir da ciência (conforme Resolução CD/ANPD nº 15/2023).

**Critério de comunicação à ANPD:** Incidentes SEV-1 e SEV-2 que envolvam dados pessoais e possam acarretar risco ou dano relevante aos titulares.

**Comunicação aos titulares:** Avaliar com DPO + jurídico se o dano individual é relevante e se a comunicação direta é viável e necessária (Art. 48, §1º LGPD).

**O VITRAS fornecerá ao Controlador:**
- Relatório técnico do incidente
- Dados necessários para o formulário ANPD
- Apoio na redação da comunicação aos titulares, se solicitado

---

## 9. Postmortem

Obrigatório para SEV-1 e SEV-2. Opcional (recomendado) para SEV-3.

**Prazo:** Em até 5 dias úteis após resolução.

**Formato mínimo:**

```
# Postmortem — INC-YYYYMMDD-NNN

## Linha do tempo
- HH:MM — evento X
- HH:MM — detecção
- HH:MM — contenção
- HH:MM — resolução

## Causa raiz
...

## Dados afetados
...

## Titulares afetados
...

## O que funcionou bem
...

## O que falhou
...

## Ações corretivas
| Ação | Responsável | Prazo |
|------|-------------|-------|
| ... | ... | ... |

## Lição aprendida
...
```

---

## 10. Prazos Internos Consolidados

| Marco | SEV-1 | SEV-2 | SEV-3 |
|-------|-------|-------|-------|
| Acionamento DPO + Tech Lead | 1h | 4h | D+1 |
| Contenção inicial | 4h | 24h | D+3 |
| Notificação ao Controlador | 24h | 48h | Próxima comunicação |
| Relatório técnico interno | 48h | 72h | 1 semana |
| Postmortem | 5 dias úteis | 5 dias úteis | Opcional |
| Ações corretivas iniciadas | Imediato | 1 semana | 2 semanas |

---

## 11. Contatos de Emergência

| Papel | Nome | Contato |
|-------|------|---------|
| DPO | TODO_USER | TODO_USER: telefone + e-mail |
| Tech Lead | TODO_USER | TODO_USER |
| CEO | TODO_USER | TODO_USER |
| Provedor cloud (suporte) | TODO_USER | TODO_USER |

---

## 12. Registro de Testes

Este runbook deve ser testado ao menos uma vez ao ano (tabletop exercise).

| Data | Tipo de teste | Resultado | Ações geradas |
|------|--------------|-----------|---------------|
| TODO_USER | Tabletop SEV-2 simulado | TODO_USER | TODO_USER |

---

*VITRAS APS · Runbook de Incidentes v1.0-draft · 2026-06-18*
