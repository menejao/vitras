# 03 — Roteiro de Homologação Funcional

**Versão:** 1.0 | **Produto:** VITRAS APS | **Aplicação:** qualquer UBS do Brasil

---

## Princípio

Homologação funcional deve ser executada em ambiente de **staging** com dados sintéticos, antes de qualquer acesso a dados reais de pacientes.

**Critério de aprovação:** todos os testes obrigatórios com resultado PASS.

---

## Pré-condições Globais

- [ ] Backend deployado e `/readyz` retornando 200
- [ ] Frontend publicado e acessível
- [ ] Usuários criados: gestor, enfermeiro, ACS (ver doc 02)
- [ ] Equipe com INE configurado
- [ ] `MUNICIPALITY_ID` setado no ambiente

---

## HF-01 — Login e Sessão

**Objetivo:** validar autenticação, refresh token e logout  
**Responsável:** QA Senior  
**Duração estimada:** 15 min

| Passo | Ação | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | Acessar URL do frontend | Tela de login carrega sem erros | [ ] |
| 2 | Login com e-mail/senha do gestor | Redireciona para dashboard; token válido | [ ] |
| 3 | Aguardar 16 minutos sem interagir | Sessão renovada automaticamente (refresh token) | [ ] |
| 4 | Logout | Redireciona para login; cookie invalidado | [ ] |
| 5 | Tentar acessar rota autenticada após logout | Retorna 401 ou redireciona para login | [ ] |
| 6 | 11 tentativas de login com senha errada | Retorna 429 "Muitas tentativas" | [ ] |

**Evidência obrigatória:** screenshot do dashboard após login, screenshot do 429

---

## HF-02 — Gestão de Usuários

**Objetivo:** validar criação e isolamento de usuários  
**Responsável:** QA Senior + Tech Lead  
**Duração estimada:** 20 min

| Passo | Ação | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | Login como gestor | Dashboard carrega | [ ] |
| 2 | Criar ACS com dados válidos | 201 Created; ACS aparece na lista | [ ] |
| 3 | Login como ACS criado | Dashboard ACS carrega | [ ] |
| 4 | ACS tenta acessar rota de gestor (`GET /users`) | 403 Forbidden | [ ] |
| 5 | Criar segundo ACS em outra equipe | 201 Created | [ ] |
| 6 | ACS 1 tenta ver paciente da equipe do ACS 2 | 404 (team scope) | [ ] |

**Evidência obrigatória:** screenshot do 403 e 404 (team scope)

---

## HF-03 — Cadastro Individual

**Objetivo:** validar cadastro de paciente  
**Responsável:** APS Specialist + QA Senior  
**Duração estimada:** 20 min

| Passo | Ação | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | Login como enfermeiro | Dashboard carrega | [ ] |
| 2 | Criar paciente com campos obrigatórios (nome, data nasc., sexo, telefone) | 201 Created; ID retornado | [ ] |
| 3 | `GET /patients/[id]` | Retorna dados completos do paciente | [ ] |
| 4 | Criar paciente com CPF já existente | 409 Conflict | [ ] |
| 5 | Criar paciente sem telefone | 400 Bad Request | [ ] |
| 6 | ACS busca paciente da própria equipe | 200 OK | [ ] |
| 7 | ACS busca paciente de equipe diferente | 404 Not Found | [ ] |

**Evidência obrigatória:** screenshot do paciente criado + screenshot do 409

---

## HF-04 — Cadastro Domiciliar

**Objetivo:** validar cadastro do domicílio familiar  
**Responsável:** APS Specialist + QA Senior  
**Duração estimada:** 15 min

| Passo | Ação | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | Login como enfermeiro | Dashboard carrega | [ ] |
| 2 | `POST /households` com patientId válido | 201 Created | [ ] |
| 3 | `GET /households?patientId=[id]` | Retorna o domicílio cadastrado | [ ] |
| 4 | `POST /households` com patientId de outra equipe | 403 ou 404 | [ ] |

**Evidência obrigatória:** screenshot do household criado

---

## HF-05 — Visita ACS

**Objetivo:** validar registro de visita domiciliar  
**Responsável:** APS Specialist + QA Senior  
**Duração estimada:** 20 min

| Passo | Ação | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | Login como ACS | Dashboard ACS carrega | [ ] |
| 2 | `POST /acs-visits` com patientId, date, turno, desfecho, motivos válidos | 201 Created | [ ] |
| 3 | `GET /acs-visits/[id]` | Retorna dados da visita | [ ] |
| 4 | ACS tenta `GET /acs-visits/[id]` de visita de outro ACS | 404 (scope) | [ ] |
| 5 | Enviar `desfecho` inválido | 400 Bad Request com mensagem clara | [ ] |
| 6 | Enviar `motivos` com código LEDI inválido | 400 Bad Request | [ ] |

**Evidência obrigatória:** screenshot da visita criada

---

## HF-06 — Busca Ativa

**Objetivo:** validar score e filtragem de pacientes prioritários  
**Responsável:** APS Specialist  
**Duração estimada:** 15 min

| Passo | Ação | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | Login como enfermeiro | Dashboard carrega | [ ] |
| 2 | `GET /active-search` | Retorna lista ordenada por score | [ ] |
| 3 | `GET /active-search/stats` | Retorna contagens por categoria | [ ] |
| 4 | Criar paciente com `careCategory: "chronic"` e verificar score | Score > 0 | [ ] |
| 5 | `GET /active-search?scoreMin=50` | Retorna apenas pacientes com score ≥ 50 | [ ] |

**Evidência obrigatória:** screenshot da lista de busca ativa com scores

---

## HF-07 — Produção

**Objetivo:** validar métricas automáticas de produção  
**Responsável:** APS Specialist + QA Senior  
**Duração estimada:** 10 min

| Passo | Ação | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | Login como gestor | Dashboard carrega | [ ] |
| 2 | `GET /production/acs` | Retorna métricas dos ACS da equipe | [ ] |
| 3 | `GET /production/nurse` | Retorna métricas dos enfermeiros | [ ] |
| 4 | `GET /production/manager` | Retorna métricas consolidadas do gestor | [ ] |
| 5 | `GET /production/microareas` | Retorna dados por microárea | [ ] |

**Evidência obrigatória:** screenshot das métricas de produção

---

## HF-08 — Auditoria

**Objetivo:** validar cadeia de auditoria e exportação  
**Responsável:** Security/LGPD Lead  
**Duração estimada:** 15 min

| Passo | Ação | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | Login como gestor ou security_auditor | Dashboard carrega | [ ] |
| 2 | `GET /audit-logs` | Retorna eventos com actor, action, resource, timestamp | [ ] |
| 3 | `GET /audit-logs/export` (JSON) | Download de arquivo JSON com logs | [ ] |
| 4 | `GET /audit-logs/export?format=csv` | Download de arquivo CSV | [ ] |
| 5 | Verificar que eventos de login aparecem no log | Log contém `auth.login` com IP e timestamp | [ ] |
| 6 | ACS tenta `GET /audit-logs` | 403 Forbidden | [ ] |

**Evidência obrigatória:** screenshot do audit log + arquivo CSV baixado

---

## HF-09 — LGPD — Direitos do Titular

**Objetivo:** validar fluxo de direito de acesso e anonimização  
**Responsável:** Security/LGPD Lead  
**Duração estimada:** 15 min

| Passo | Ação | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | `GET /privacy/patient-access-report/[patientId]` | Retorna relatório de todos acessos ao paciente | [ ] |
| 2 | Solicitar anonimização de paciente (gestor) | Retorna confirmação; dados sensíveis removidos | [ ] |
| 3 | Tentar acessar paciente anonimizado | Nome substituído por "[ANONIMIZADO]" | [ ] |

**Evidência obrigatória:** screenshot do relatório de acesso

---

## Critério de Aprovação da Homologação Funcional

| Resultado | Definição |
|-----------|-----------|
| **PASS** | Todos os 9 módulos aprovados sem desvios |
| **PASS COM RESSALVA** | 1-2 falhas menores documentadas com prazo de correção |
| **FAIL** | Qualquer falha em HF-01, HF-02, HF-08 (auth, RBAC, auditoria) |

**Assinatura do QA Senior:**  
Data: ______  
Resultado: ______  
Observações: ______
