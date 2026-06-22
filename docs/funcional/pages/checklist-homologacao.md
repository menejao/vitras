# Checklist de Homologação — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `PlatformConsolePage.jsx` — seção dentro de `UnitDetail`  
**Rota:** Sem rota dedicada — seção exibida no Detalhe da UBS quando `status === "homologation"`

---

## 1. Objetivo e contexto

Controle operacional auditável dos critérios que uma UBS deve cumprir antes de ser ativada. O `support_admin` marca cada item do checklist manualmente após verificação in loco ou remota. O sistema bloqueia a transição `homologation → active` enquanto qualquer critério estiver pendente. Garante que nenhuma UBS entre em produção por decisão subjetiva.

**Usuários:** `support_admin` exclusivamente.

**Frequência de uso:** Uma vez por ciclo de homologação de cada UBS.

---

## 2. Localização

| Atributo | Valor |
|---|---|
| Rota SPA | Dentro de `/platform` → Detalhe da UBS |
| Componente | Seção `checklist` em `UnitDetail` |
| Exibido quando | `unit.status === "homologation"` |
| Pré-condição | UBS deve estar no estado `homologation` |

---

## 3. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/platform/units/:unitId/checklist` | Carregar estado atual de todos os critérios |
| PATCH | `/platform/units/:unitId/homologation-checklist` | Marcar/desmarcar item individual |
| PATCH | `/platform/units/:unitId` | Transição `homologation → active` (bloqueada se checklist incompleto) |

---

## 4. Elementos da página

### 4.1 Critérios auto-derivados (somente leitura)

Calculados automaticamente pela API — `support_admin` não pode alterar:

| ID | Label | Como é verificado |
|---|---|---|
| `gestor_exists` | Gestor inicial criado | `gestors.length > 0` |
| `gestor_first_access` | Gestor realizou primeiro acesso | `gestor.forcePasswordChange === false` |
| `team_exists` | Pelo menos uma equipe cadastrada | `teams.length > 0` |
| `user_exists` | Pelo menos um usuário ativo | `activeUsers.length > 0` |
| `institutional_data` | Dados institucionais preenchidos (CNES, nome, município, UF) | `!!(cnes && name && municipalityName && uf)` |

### 4.2 Itens do checklist manual

Marcados por `support_admin` via checkbox:

| ID | Label |
|---|---|
| `auth_working` | Autenticação funcionando |
| `rbac_working` | RBAC funcionando por perfil |
| `team_configured` | Equipe configurada e ativa |
| `user_created` | Usuário operacional criado |
| `patient_cadastro` | Cadastro de cidadão funcionando |
| `household_cadastro` | Cadastro domiciliar funcionando |
| `individual_cadastro` | Cadastro individual funcionando |
| `audit_working` | Trilha de auditoria funcionando |

### 4.3 Item de aprovação técnica (auto-preenchido)

| ID | Label | Como é preenchido |
|---|---|---|
| `approval_recorded` | Aprovação técnica registrada | Preenchido automaticamente quando todos os 8 itens acima estão marcados → API seta `homologationApprovedBy` + `homologationApprovedAt` |

### 4.4 Botão de transição

- "Ativar UBS" — desabilitado quando `checklist.ok === false`
- Habilitado apenas quando todos os 14 critérios passam

### 4.5 Estados especiais

- **Loading checklist:** silencioso — sem exibição de loading específico
- **Erro ao carregar:** checklist não exibido (`null`) — transições ficam habilitadas sem validação visual
- **Todos OK:** `checklist.ok === true` — botão "Ativar UBS" habilitado

---

## 5. Dicionário de campos

| Item | ID | Tipo | Editável | Padrão | Armazenado em |
|---|---|---|---|---|---|
| Gestor inicial criado | `gestor_exists` | boolean | Não (auto) | false | derivado de `users[]` |
| Gestor primeiro acesso | `gestor_first_access` | boolean | Não (auto) | false | derivado de `user.forcePasswordChange` |
| Equipe cadastrada | `team_exists` | boolean | Não (auto) | false | derivado de `teams[]` |
| Usuário ativo | `user_exists` | boolean | Não (auto) | false | derivado de `users[]` |
| Dados institucionais | `institutional_data` | boolean | Não (auto) | false | derivado de campos da UBS |
| Autenticação | `auth_working` | boolean | Sim (checkbox) | false | `unit.homologationChecklist.auth_working` |
| RBAC | `rbac_working` | boolean | Sim (checkbox) | false | `unit.homologationChecklist.rbac_working` |
| Equipe configurada | `team_configured` | boolean | Sim (checkbox) | false | `unit.homologationChecklist.team_configured` |
| Usuário operacional | `user_created` | boolean | Sim (checkbox) | false | `unit.homologationChecklist.user_created` |
| Cadastro cidadão | `patient_cadastro` | boolean | Sim (checkbox) | false | `unit.homologationChecklist.patient_cadastro` |
| Cadastro domiciliar | `household_cadastro` | boolean | Sim (checkbox) | false | `unit.homologationChecklist.household_cadastro` |
| Cadastro individual | `individual_cadastro` | boolean | Sim (checkbox) | false | `unit.homologationChecklist.individual_cadastro` |
| Trilha de auditoria | `audit_working` | boolean | Sim (checkbox) | false | `unit.homologationChecklist.audit_working` |
| Aprovação técnica | `approval_recorded` | boolean | Não (auto) | false | `unit.homologationApprovedBy` + `unit.homologationApprovedAt` |

---

## 6. Regras de negócio

| Código | Gatilho | Condição | Ação | Mensagem |
|---|---|---|---|---|
| RN-HOM-01 | Marcar item checkbox | Sempre | `PATCH /homologation-checklist { [itemId]: true }` | — |
| RN-HOM-02 | Desmarcar item checkbox | Sempre | `PATCH /homologation-checklist { [itemId]: false }` | — |
| RN-HOM-03 | Todos 8 itens manuais marcados | API detecta `allChecked: true` | API seta `homologationApprovedBy` + `homologationApprovedAt` | — |
| RN-HOM-04 | `approval_recorded` passa | Auto — após RN-HOM-03 | `checklist.ok` vira `true` → botão "Ativar UBS" habilitado | — |
| RN-HOM-05 | Clicar "Ativar UBS" | `checklist.ok === false` | Botão desabilitado — não chega à API | — |
| RN-HOM-06 | `PATCH status=active` | Critérios não cumpridos | API retorna 422 com `blocked[]` | "Critérios pendentes:\n• [label]..." |
| RN-HOM-07 | `PATCH status=active` | Todos critérios OK | Transição executada, `activatedAt` preenchido | — |
| RN-HOM-08 | Desmarcar item após aprovação | Qualquer item | `approval_recorded` volta a `false`, botão desabilitado | — |

---

## 7. Ações e comportamentos

| Ação | Gatilho | API | Resultado sucesso | Resultado erro |
|---|---|---|---|---|
| Marcar item | Clicar checkbox | `PATCH /homologation-checklist` | Checklist atualizado localmente | Alert inline |
| Desmarcar item | Clicar checkbox marcado | `PATCH /homologation-checklist` | Checklist atualizado | Alert inline |
| Ativar UBS | "Ativar UBS" | `PATCH /platform/units/:id {status: "active"}` | UBS ativada, detalhe recarregado | Erro com critérios bloqueados |

---

## 8. Navegação entre páginas

| Elemento | Condição | Destino |
|---|---|---|
| Todos critérios OK + "Ativar UBS" | Transição bem-sucedida | [Detalhe da UBS](detalhe-ubs.md) com status `active` |
| "← Voltar" | Qualquer estado | [Console Nacional](console-nacional.md) |

---

## 9. Permissões

| Capability | Perfis | Se não tiver |
|---|---|---|
| `support_admin` | `support_admin` | Bloqueado antes de chegar aqui |

Checklist é **exclusivo** do `support_admin`. Gestor não vê e não pode marcar itens.

---

## 10. Auditoria

| Ação | Evento | Dados |
|---|---|---|
| Item checklist marcado | `UNIT_CHECKLIST_ITEM_CHECKED` | unitId, itemId, value, checkedBy, timestamp |
| Aprovação técnica registrada | `UNIT_HOMOLOGATION_APPROVED` | unitId, approvedBy, approvedAt |
| Ativação da UBS | `UNIT_STATUS_CHANGED` | unitId, fromStatus=homologation, toStatus=active, changedBy, timestamp |

---

## 11. Critérios de aceite

- [ ] Checklist exibido somente quando UBS está em `homologation`
- [ ] Critérios auto-derivados refletem estado real do banco
- [ ] Checkboxes manuais salvam imediatamente ao clicar
- [ ] `approval_recorded` marcado automaticamente quando todos 8 itens manuais OK
- [ ] Botão "Ativar UBS" desabilitado com qualquer critério pendente
- [ ] API bloqueia ativação com 422 mesmo sem UI (proteção backend)
- [ ] Desmarcar item após aprovação revoga `approval_recorded`
- [ ] Multi-tenant: critérios de UBS-A não afetam UBS-B

---

## 12. Cenários de teste

| # | Cenário | Perfil | Entrada | Esperado |
|---|---|---|---|---|
| 01 | Checklist exibido | `support_admin` | UBS em `homologation` | Todos os 14 critérios visíveis |
| 02 | Checklist não exibido | `support_admin` | UBS em `onboarding` | Seção de checklist não aparece |
| 03 | Marcar item | `support_admin` | Clicar `auth_working` | Item marcado, API confirmada |
| 04 | Desmarcar item | `support_admin` | Clicar item marcado | Item desmarcado |
| 05 | Ativar com checklist incompleto | `support_admin` | Marcar 7 de 8 itens | Botão desabilitado |
| 06 | Completar checklist | `support_admin` | Marcar todos os 8 itens | `approval_recorded` marcado automaticamente |
| 07 | Ativar UBS completa | `support_admin` | "Ativar UBS" com todos OK | UBS ativada, status → active |
| 08 | API bloqueia sem UI | `support_admin` | `PATCH status=active` via API sem checklist | 422 com `blocked[]` |
| 09 | Isolamento multi-tenant | `support_admin` | Marcar item UBS-A | UBS-B não afetada |
| 10 | Desmarcar revoga aprovação | `support_admin` | Desmarcar item após aprovação | `approval_recorded` volta a false |

---

## 13. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
