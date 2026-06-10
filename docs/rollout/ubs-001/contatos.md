# Contatos — UBS #1

> **INSTRUÇÃO:** Preencher TODOS os campos antes de T-7. Nenhum campo deve conter [fill] na data do go-live.
> Responsável pelo preenchimento: João Pedro (Vitras) + Coordenador UBS.
> Campos marcados com ★ são obrigatórios para qualquer incidente P0.

---

## Seção A — Equipe VITRAS
*Preencher: João Pedro*

| Função | Nome | Celular (com DDD) | E-mail | Disponibilidade |
|--------|------|-------------------|--------|-----------------|
| Tech Lead / Implantação | João Pedro | PENDENTE FORMAL — João Pedro deve inserir celular pessoal com DDD | joaoomenegucci@gmail.com | Horário comercial + plantão D+0 a D+14 |
| Break Glass Admin ★ | PENDENTE FORMAL — identificar responsável com acesso AWS | PENDENTE FORMAL — identificar responsável com acesso AWS | breakglass@vitras.com.br | On-call 24h |
| Security Auditor | PENDENTE FORMAL — designar antes do D+0 | PENDENTE FORMAL — designar antes do D+0 | PENDENTE FORMAL — designar antes do D+0 | On-call (review D+1 após uso breakglass) |

**Backup Tech Lead** (se João Pedro indisponível):
Nome: PENDENTE FORMAL — designar com confirmação de acesso AWS
Contato: PENDENTE FORMAL — designar com confirmação de acesso AWS
Tem acesso AWS: PENDENTE FORMAL — confirmar após designação

---

## Seção B — UBS #1
*Preencher: Coordenador UBS + representantes*

### Coordenador UBS ★
Nome completo: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
Cargo: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
Celular: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
E-mail: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
WhatsApp: PENDENTE FORMAL — confirmar após preenchimento
Disponível D+0 (go-live day): PENDENTE FORMAL — confirmar após preenchimento

### Médico responsável (CFM) ★
Nome completo: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
CRM: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
Especialidade: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
Celular: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
E-mail: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
Assina prontuário eletrônico: PENDENTE FORMAL — confirmar com médico designado

### Responsável TI prefeitura ★
Nome completo: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
Setor: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
Celular: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
E-mail: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
Acesso à rede/dispositivos da UBS: PENDENTE FORMAL — confirmar após preenchimento

### Enfermeiro chefe
Nome completo: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
Celular: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
E-mail: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7

### ACS de referência (teste microárea)
Nome completo: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
Equipe/microárea: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7
Celular: PENDENTE FORMAL — Coordenador UBS deve preencher no T-7

---

## Seção C — DPO e Privacidade
*Preencher: DPO ou jurídico da prefeitura*
*Obrigatório por LGPD — notificação em 72h em caso de vazamento*

### DPO (Data Protection Officer) ★
Nome completo: PENDENTE FORMAL — DPO obrigatório para conformidade LGPD/ANPD 72h
Vínculo: PENDENTE FORMAL — DPO obrigatório para conformidade LGPD/ANPD 72h
Celular: PENDENTE FORMAL — DPO obrigatório para conformidade LGPD/ANPD 72h
E-mail: PENDENTE FORMAL — DPO obrigatório para conformidade LGPD/ANPD 72h
Disponível 24h para P0 LGPD: PENDENTE FORMAL — confirmar após designação do DPO
Conhece prazo ANPD de 72h: PENDENTE FORMAL — confirmar após designação do DPO

### Contato jurídico / Secretaria de Saúde (se diferente do DPO)
Nome completo: PENDENTE FORMAL — jurídico/Secretaria deve preencher no T-7
Cargo: PENDENTE FORMAL — jurídico/Secretaria deve preencher no T-7
Celular: PENDENTE FORMAL — jurídico/Secretaria deve preencher no T-7
E-mail: PENDENTE FORMAL — jurídico/Secretaria deve preencher no T-7

---

## Seção D — AWS / Infraestrutura
*Preencher: João Pedro*

| Serviço | Plano | Contato de suporte | Account ID / Caso |
|---------|-------|--------------------|-------------------|
| AWS Support | PENDENTE FORMAL — verificar plano atual no console AWS | console.aws.amazon.com/support | PENDENTE FORMAL — verificar plano atual no console AWS |
| Upstash | PENDENTE FORMAL — verificar plano atual no painel Upstash | support@upstash.com | PENDENTE FORMAL — verificar plano atual no painel Upstash |

**IAM de emergência (quem tem acesso admin se João Pedro indisponível):**
Nome: PENDENTE FORMAL — identificar responsável com acesso IAM admin
Forma de contato: PENDENTE FORMAL — identificar responsável com acesso IAM admin
MFA device de backup em vault: PENDENTE FORMAL — confirmar após designação

---

## Seção E — Escalation em incidente

> **Nota:** Os campos de celular e e-mail referenciados nos scripts abaixo possuem pendências formais nas Seções A, B e C. Os scripts de escalação tornam-se operacionais somente após o preenchimento completo dessas seções.

### P0 — Dados expostos / Sistema completamente indisponível
```
1. João Pedro → celular (imediato, 24h)
2. DPO → celular ★ (se envolver dados de pacientes)
3. Coordenador UBS → celular
4. AWS Support → abrir case URGENTE
5. Backup Tech Lead (se João Pedro indisponível)
```

### P1 — Login falha / Funcionalidade crítica indisponível
```
1. João Pedro → celular (< 30 min resposta em horário comercial)
2. Coordenador UBS → comunicar impacto
3. Responsável TI prefeitura → se for problema de rede/dispositivo
```

### P2 — Lentidão / Bug não crítico
```
1. João Pedro → e-mail (< 4h resposta)
2. Registro no log de incidentes (docs/runbooks/incidents.md)
```

Ver `docs/operations/incident-response.md` para procedimento completo.

---

## Seção F — Canal de comunicação D+0

Grupo de WhatsApp go-live:
Nome do grupo: PENDENTE FORMAL — criar grupo com todos os participantes antes do D+0
Participantes confirmados:
- [ ] João Pedro
- [ ] Coordenador UBS
- [ ] Médico responsável
- [ ] Responsável TI prefeitura
- [ ] Break Glass Admin

---

## Confirmação de preenchimento

Este documento foi preenchido e revisado em: PENDENTE FORMAL — assinar após preenchimento completo de todos os campos

Tech Lead: PENDENTE FORMAL — assinar após preenchimento completo de todos os campos
UBS Coordinator: PENDENTE FORMAL — assinar após preenchimento completo de todos os campos
TI Prefeitura: PENDENTE FORMAL — assinar após preenchimento completo de todos os campos

---

## Pendências Formais

> Esta seção lista todas as pendências identificadas que devem ser resolvidas antes do D+0 (go-live UBS #1).
> Responsável pela resolução de cada item indicado abaixo.
> Prazo sugerido: T-7 (7 dias antes do go-live), salvo indicação contrária.

| # | Item | Responsável | Prazo sugerido |
|---|------|-------------|----------------|
| 1 | Celular pessoal do Tech Lead João Pedro (com DDD) — Seção A | João Pedro | T-7 |
| 2 | Identificar pessoa responsável pela conta Break Glass Admin (nome + celular) — Seção A | João Pedro | T-7 |
| 3 | Designar Security Auditor (nome, celular, e-mail) — Seção A | João Pedro | T-7, obrigatório antes do D+0 |
| 4 | Designar Backup Tech Lead com confirmação de acesso AWS (nome, celular) — Seção A | João Pedro | T-7 |
| 5 | Dados do Coordenador UBS (nome completo, cargo, celular, e-mail, disponibilidade D+0) — Seção B | Coordenador UBS | T-7 |
| 6 | Dados do Médico responsável com CRM (nome, especialidade, celular, e-mail, confirmação de assinatura de prontuário) — Seção B | Coordenador UBS | T-7 |
| 7 | Dados do Responsável TI prefeitura (nome, setor, celular, e-mail, confirmação de acesso à rede) — Seção B | Coordenador UBS | T-7 |
| 8 | Dados do Enfermeiro chefe (nome, celular, e-mail) — Seção B | Coordenador UBS | T-7 |
| 9 | Dados do ACS de referência (nome, equipe/microárea, celular) — Seção B | Coordenador UBS | T-7 |
| 10 | Designação formal do DPO com dados completos (nome, vínculo, celular, e-mail, confirmação de disponibilidade 24h e conhecimento do prazo ANPD 72h) — Seção C | DPO / Jurídico da prefeitura | T-14 — CRÍTICO para conformidade LGPD |
| 11 | Dados do contato jurídico / Secretaria de Saúde se diferente do DPO (nome, cargo, celular, e-mail) — Seção C | Secretaria de Saúde | T-7 |
| 12 | Verificar plano atual do AWS Support no console AWS e registrar o Account ID — Seção D | João Pedro | T-7 |
| 13 | Verificar plano atual do Upstash e registrar o ID de conta — Seção D | João Pedro | T-7 |
| 14 | Identificar responsável por IAM admin de emergência (nome, forma de contato, confirmar MFA device de backup em vault) — Seção D | João Pedro | T-7 |
| 15 | Criar grupo de WhatsApp go-live com nome definido e todos os participantes confirmados — Seção F | João Pedro + Coordenador UBS | T-3 |
| 16 | Assinar confirmação de preenchimento deste documento — Confirmação final | João Pedro + Coordenador UBS + TI Prefeitura | T-1 (após todos os campos preenchidos) |
