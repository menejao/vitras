# Contatos — UBS #1

> **INSTRUÇÃO:** Preencher TODOS os campos antes de T-7. Nenhum campo deve conter [fill] na data do go-live.
> Responsável pelo preenchimento: João Pedro (Vitras) + Coordenador UBS.
> Campos marcados com ★ são obrigatórios para qualquer incidente P0.

---

## Seção A — Equipe VITRAS
*Preencher: João Pedro*

| Função | Nome | Celular (com DDD) | E-mail | Disponibilidade |
|--------|------|-------------------|--------|-----------------|
| Tech Lead / Implantação | João Pedro | _________________ | joaoomenegucci@gmail.com | Horário comercial + plantão D+0 a D+14 |
| Break Glass Admin ★ | _________________ | _________________ | breakglass@vitras.com.br | On-call 24h |
| Security Auditor | _________________ | _________________ | _________________ | On-call (review D+1 após uso breakglass) |

**Backup Tech Lead** (se João Pedro indisponível):
Nome: _________________________________
Contato: ________________________________
Tem acesso AWS: [ ] Sim  [ ] Não

---

## Seção B — UBS #1
*Preencher: Coordenador UBS + representantes*

### Coordenador UBS ★
Nome completo: ___________________________________
Cargo: __________________________________________
Celular: ________________________________________
E-mail: _________________________________________
WhatsApp: [ ] Sim  [ ] Não
Disponível D+0 (go-live day): [ ] Sim  [ ] Não

### Médico responsável (CFM) ★
Nome completo: ___________________________________
CRM: ___________________________________________
Especialidade: ___________________________________
Celular: ________________________________________
E-mail: _________________________________________
Assina prontuário eletrônico: [ ] Sim

### Responsável TI prefeitura ★
Nome completo: ___________________________________
Setor: __________________________________________
Celular: ________________________________________
E-mail: _________________________________________
Acesso à rede/dispositivos da UBS: [ ] Sim  [ ] Não

### Enfermeiro chefe
Nome completo: ___________________________________
Celular: ________________________________________
E-mail: _________________________________________

### ACS de referência (teste microárea)
Nome completo: ___________________________________
Equipe/microárea: ________________________________
Celular: ________________________________________

---

## Seção C — DPO e Privacidade
*Preencher: DPO ou jurídico da prefeitura*
*Obrigatório por LGPD — notificação em 72h em caso de vazamento*

### DPO (Data Protection Officer) ★
Nome completo: ___________________________________
Vínculo: [ ] Prefeitura  [ ] Empresa contratada: _______
Celular: ________________________________________
E-mail: _________________________________________
Disponível 24h para P0 LGPD: [ ] Sim  [ ] Não
Conhece prazo ANPD de 72h: [ ] Sim

### Contato jurídico / Secretaria de Saúde (se diferente do DPO)
Nome completo: ___________________________________
Cargo: __________________________________________
Celular: ________________________________________
E-mail: _________________________________________

---

## Seção D — AWS / Infraestrutura
*Preencher: João Pedro*

| Serviço | Plano | Contato de suporte | Account ID / Caso |
|---------|-------|--------------------|-------------------|
| AWS Support | _________________ | console.aws.amazon.com/support | _________________ |
| Upstash | _________________ | support@upstash.com | _________________ |

**IAM de emergência (quem tem acesso admin se João Pedro indisponível):**
Nome: _________________________________
Forma de contato: _______________________
MFA device de backup em vault: [ ] Sim  [ ] Não

---

## Seção E — Escalation em incidente

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
2. Registro no log de incidentes (docs/operations/incidents.md)
```

Ver `docs/operations/incident-response.md` para procedimento completo.

---

## Seção F — Canal de comunicação D+0

Grupo de WhatsApp go-live:
Nome do grupo: _______________________________
Participantes confirmados:
- [ ] João Pedro
- [ ] Coordenador UBS
- [ ] Médico responsável
- [ ] Responsável TI prefeitura
- [ ] Break Glass Admin

---

## Confirmação de preenchimento

Este documento foi preenchido e revisado em: _____ / _____ / _______

Tech Lead: _________________________  
UBS Coordinator: ___________________  
TI Prefeitura: _____________________
