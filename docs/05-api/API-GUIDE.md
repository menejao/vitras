# API GUIDE

## Objetivo
Complementar `docs/openapi.yaml` com visão modular, RBAC, filtros, paginação e observações de implementação real.

## Escopo
Principais módulos HTTP montados em `backend/src/app.js`, incluindo rotas públicas, clínicas, territoriais, platform e portal.

## Pré-requisitos
- `docs/openapi.yaml`
- `docs/ai/routes-map.md`
- `backend/src/app.js`

## Descrição
API é monolítica, modular e baseada em Express. Este guia complementa OpenAPI e descreve rotas montadas, escopo de acesso e comportamentos operacionais.

## Convenções
- Auth por bearer token ou cookies
- Mutações com cookie auth exigem `X-CSRF-Token`
- Erros usuais: `400`, `401`, `403`, `404`, `409`, `429`, `500`
- Paginação varia por módulo; quando presente, ocorre por `page`, `limit`, `cursor` ou filtros de data

## Status
### IMPLEMENTADO
- OpenAPI parcial
- Rotas modulares reais em `app.js`

### PARCIAL
- Algumas rotas recentes e especializadas não estão integralmente em `openapi.yaml`

## Módulos

### Infra e observabilidade
| Método | URL | RBAC | Descrição |
|---|---|---|---|
| GET | `/health` | pública | health do serviço |
| GET | `/readyz` | pública | readiness |
| GET | `/metrics/internal` | capability específica ou pública via health router | métricas internas |
| POST | `/csp-report` | pública | relatório CSP |

### Auth
| Método | URL | RBAC | Body/Response | Observações |
|---|---|---|---|---|
| POST | `/auth/login` | público | `identifier`, `password` | pode retornar desafio 2FA |
| POST | `/auth/login/verify` | público | `challengeId`, `code` | conclui 2FA |
| POST | `/auth/refresh` | público | refresh token | rotaciona token |
| POST | `/auth/logout` | autenticado | opcional refresh token | revoga sessão |
| POST | `/auth/register` | público | dados profissionais | autocadastro restrito |
| POST | `/auth/access-requests` | público | solicitação | pré-cadastro |
| GET | `/auth/access-requests` | `access_requests.read` | lista | gestão |
| POST | `/auth/access-requests/:id/approve` | `access_requests.read` | decisão | aprovação |
| POST | `/auth/access-requests/:id/reject` | `access_requests.read` | `reason` | rejeição |

### Me e sessão
| Método | URL | RBAC | Descrição |
|---|---|---|---|
| GET | `/me` | autenticado | perfil e contexto |
| GET | `/me/access-context` | autenticado | capabilities, impersonation, break glass |
| PATCH | `/me` | autenticado | atualização do próprio perfil |
| POST | `/me/verify-password` | autenticado | valida senha |
| GET/POST | `/me/2fa/*` | autenticado | ciclo TOTP |
| POST | `/me/impersonation/start` | `session.impersonate` | suporte técnico |
| POST | `/me/impersonation/stop` | sessão impersonada | encerra contexto |
| POST | `/me/break-glass/activate` | `session.break_glass.activate` | elevação de sessão |
| POST | `/me/break-glass/deactivate` | autenticado | encerra elevação |

### Pacientes e prontuário
| Método | URL | RBAC | Descrição |
|---|---|---|---|
| GET | `/patients` | `patients.read.*` | listagem com filtros |
| POST | `/patients` | clínicos autorizados | criação |
| PUT | `/patients/:id` | acesso ao paciente | atualização |
| DELETE | `/patients/:id` | manager/doctor | inativação |
| GET | `/patients/:id/history` | acesso ao paciente | histórico |
| GET/POST | `/patients/:id/messages` | `messages.*` | recados |
| GET/POST | `/patients/:id/records` | `records.*` | registro clínico |
| DELETE/PATCH | `/patients/:id/records/:recordId/*` | perfis clínicos definidos | inativação/soft-delete |
| GET | `/patients/protocol-summaries` | leitura de paciente | resumo em lote |

### Exames
| Método | URL | RBAC | Descrição |
|---|---|---|---|
| GET/POST | `/patients/:id/exams` | `exams.*` | listagem/solicitação |
| POST | `/patients/:id/exams/:examId/attachments` | `exams.write` | anexos JSON |
| DELETE | `/patients/:id/exams/:examId` | manager/doctor | soft-delete |
| POST | `/integrations/lab/results` | `x-api-key` | entrada externa |

### Agenda, fila e tarefas
| Método | URL | RBAC | Descrição |
|---|---|---|---|
| GET/POST/PATCH/DELETE | `/agenda` e `/agenda/:id` | `agenda.*` | agenda clínica |
| GET/POST/PATCH/DELETE | `/queue` e `/queue/:id` | `queue.*` | fila |
| POST | `/queue/clear-done` | `queue.write` | limpeza |
| GET/POST/PATCH | `/tasks` e `/tasks/:id` | `tasks.*` | tarefas |

### Encaminhamentos, farmácia e insumos
| Método | URL | RBAC | Descrição |
|---|---|---|---|
| GET/POST/PATCH/DELETE | `/referrals` | `referrals.*` | encaminhamentos |
| GET/PATCH/POST | `/pharmacy/*` | `pharmacy.*` | estoque e dispensação |
| GET/POST | `/pharmacy-receitas/*` | `receitas.*`, `dispensacoes.*` | receitas e dispensações |
| GET/POST | `/supplies/*` | `supplies.*` | insumos |
| GET/POST | `/almoxarifado/*` | `almoxarifado.*` | almoxarifado |

### Territorial e ACS
| Método | URL | RBAC | Descrição |
|---|---|---|---|
| GET | `/territorial/unit` | autenticado | centro e endereço da UBS |
| GET/POST/PATCH/DELETE | `/territorial/areas*` | perfis autorizados | microáreas |
| GET/POST/PATCH | `/acs-visits*` | `acs.visit.*` | visitas |
| GET | `/active-search*` | domínios ACS | busca ativa |
| GET/POST/PATCH | `/households*` | perfis autorizados | cadastro domiciliar |
| GET/PATCH | `/family-groups*` | autenticado e perfis específicos | grupos familiares |

### Produção e indicadores
| Método | URL | RBAC | Descrição |
|---|---|---|---|
| GET | `/production/acs` | leitura permitida | produção ACS |
| GET | `/production/nurse` | leitura permitida | produção enfermagem |
| GET | `/production/manager` | leitura permitida | visão gerencial |
| GET | `/production/microareas` | leitura permitida | produção por microárea |
| GET | `/production/territorial` | leitura permitida | indicadores territoriais |

### Auditoria, privacidade e IA
| Método | URL | RBAC | Descrição |
|---|---|---|---|
| GET | `/audit-logs` | `audit.read` | trilha |
| GET | `/audit-logs/export` | export | exportação |
| GET | `/audit-logs/integrity` | auditor/ emergência | integridade |
| GET | `/audit-logs/reports/*` | auditor/ emergência | relatórios |
| GET/POST/PATCH | `/privacy/requests*` | `privacy.manage` | LGPD |
| POST | `/privacy/retention/anonymize` | `privacy.manage` | anonimização |
| GET/POST | `/ai/*` | `ai.access` | IA assistiva |

### Platform e console nacional
| Método | URL | RBAC | Descrição |
|---|---|---|---|
| GET | `/platform/municipalities*` | `support_admin` | catálogo IBGE + detalhe |
| GET | `/platform/units*` | `support_admin` | listagem UBS |
| POST/PATCH | `/platform/units*` | `support_admin` | ciclo de vida UBS |
| POST | `/platform/units/:unitId/teams` | `support_admin` | equipe |
| POST | `/platform/units/:unitId/initial-manager` | `support_admin` | gestor inicial |
| POST | `/platform/units/:unitId/initial-manager/:userId/reset-password` | `support_admin` | reset seguro |
| GET/PUT | `/platform/units/:unitId/configuration` | `support_admin` | configuração |
| GET/PUT | `/platform/units/:unitId/operational-rules` | `support_admin` | regras operacionais |

### Citizen portal
| Método | URL | RBAC | Descrição |
|---|---|---|---|
| GET/PUT | `/platform/citizen-portal/config*` | `support_admin` ou regra específica | configuração municipal e por unidade |
| Demais `/citizen-portal*` | cidadão ou backend interno | autenticação, perfil, unidade, agenda | portal cidadão |

## Paginação, filtros e versionamento
- `/platform/municipalities`: `search`, `uf`, `page`, `limit`
- `/platform/units`: `search`, `uf`, `status`, `municipalityId`, `sortBy`, `sortDir`, `page`, `limit`
- `/audit-logs`: filtros por data, ação, paciente, severidade, cursor e limite
- Versionamento hoje é implícito por release do produto e `docs/openapi.yaml`, não por prefixo `/v2`

## Exemplos
### Exemplo de leitura de paciente
```http
GET /patients?search=maria&page=1&limit=20
Authorization: Bearer <token>
```

### Exemplo de mutação com cookie auth
```http
POST /agenda
Cookie: vitras_access=...
X-CSRF-Token: ...
Content-Type: application/json
```

## Boas práticas
- Confirmar rota montada em `backend/src/app.js`
- Confirmar capability em `backend/src/utils/helpers.js`
- Confirmar se OpenAPI já cobre rota antes de editar documentação dupla

## Referências internas
- `docs/openapi.yaml`
- `docs/ai/routes-map.md`
- `backend/src/app.js`

## Arquivos relacionados
- `docs/02-architecture/ARCHITECTURE.md`
- `docs/04-data-model/DATA-MODEL.md`
