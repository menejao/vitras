# Detalhe da UBS — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `PlatformConsolePage.jsx` — componente `UnitDetail` + `UnitForm`  
**Rota:** Sem rota dedicada — renderizado como subview do Console Nacional

---

## 1. Objetivo e contexto

Página de operação individual de uma UBS. Permite ao `support_admin` visualizar dados institucionais, operacionais e de implantação; criar gestor inicial; cadastrar equipe; e avançar o status no ciclo de vida da UBS (draft → onboarding → homologation → active → suspended).

**Usuários:** `support_admin` exclusivamente.

**Frequência de uso:** Durante implantação de nova UBS; pontual para manutenção operacional.

---

## 2. Localização

| Atributo | Valor |
|---|---|
| Rota SPA | N/A — subview de `/platform` |
| Componente | `UnitDetail` em `PlatformConsolePage.jsx` |
| Acessado via | Clicar linha na tabela do Console Nacional |
| Pré-condição | UBS deve existir — `unitId` passado via prop |

---

## 3. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/platform/units/:unitId` | Carregar dados completos da UBS |
| GET | `/platform/units/:unitId/checklist` | Critérios de transição do estado atual |
| PATCH | `/platform/units/:unitId` | Transição de status |
| PATCH | `/platform/units/:unitId/homologation-checklist` | Marcar/desmarcar item do checklist de homologação |
| POST | `/platform/units/:unitId/teams` | Criar equipe |
| POST | `/platform/units/:unitId/initial-manager` | Criar gestor inicial |

---

## 4. Elementos da página

### 4.1 Header

- "← Voltar" — retorna para Console Nacional
- Nome da UBS (h2)
- StatusBadge com status atual

### 4.2 Banner de senha temporária (condicional)

Exibido **uma única vez** após criar gestor inicial:

- Alerta amarelo com título: "Senha temporária do gestor — exibida uma única vez"
- Código da senha em bloco monoespaçado
- Instrução: "Comunique esta senha ao gestor agora. Após sair desta tela, não será possível recuperá-la."
- Botão: "Confirmo que anotei — ocultar senha"

### 4.3 Banner de ações pendentes (OnboardingActions)

Exibido quando faltam gestor ou equipe. Cor âmbar (#fffbeb / #fbbf24):

- Título: "Ações necessárias para concluir implantação:"
- Lista de ações pendentes + botão "Fazer agora" por item:
  - "Cadastrar gestor inicial" (se `gestors.length === 0`)
  - "Cadastrar equipe inicial" (se `teams.length === 0`)

### 4.4 Grid de informações (view = "detail")

**Card: Dados Institucionais**

- CNES (monospace)
- Município / UF
- IBGE (se preenchido)
- E-mail institucional (se preenchido)
- Telefone (se preenchido)

**Card: Dados Operacionais**

- Equipes (count)
- Gestores (count)
- Usuários (count)
- Pacientes (count)

**Card: Dados de Implantação**

- Status atual
- Criado em (data)
- Criado por (nome)
- Ativado em (se aplicável)
- Suspenso em (se aplicável)
- Aprovação de homologação: aprovado por + data (se aplicável)

### 4.5 Seção de Gestores

- Lista dos gestores da UBS (nome, e-mail, primeiro acesso realizado?)
- Botão "+ Cadastrar gestor" (se nenhum gestor ainda)

### 4.6 Seção de Equipes

- Lista das equipes (nome, INE, tipo)
- Botão "+ Cadastrar equipe"

### 4.7 Painel de Transição de Status

Exibido quando existem transições possíveis para o status atual:

- Título: "Transições de status disponíveis"
- Critérios do estado atual (lidos de `/checklist`) — somente leitura:
  - Lista de critérios auto-derivados com ícone ✓ (verde) ou ✗ (vermelho)
- Botão(ões) de transição (desabilitado se `checklist && !checklist.ok`)

**Transições disponíveis por status:**

| Status atual | Transições possíveis |
|---|---|
| `draft` | → `onboarding` ("Iniciar Implantação") |
| `onboarding` | → `homologation` ("Iniciar Homologação") |
| `homologation` | → `active` ("Ativar UBS"), → `onboarding` ("Voltar a Implantação") |
| `active` | → `suspended` ("Suspender") |
| `suspended` | → `active` ("Reativar") |

### 4.8 Subviews (substituem o detalhe)

- `view = "new-team"` → formulário de criação de equipe
- `view = "new-manager"` → formulário de criação de gestor

---

## 5. Dicionário de campos

### Formulário: Nova UBS (`UnitForm`)

| Campo | Nome técnico | Tipo | Obrig | Validação | Mensagem de erro |
|---|---|---|---|---|---|
| Nome da UBS | `name` | text | S | Não vazio | "Nome da UBS é obrigatório." |
| CNES | `cnes` | text | S | `/^\d{7}$/` | "CNES deve ter exatamente 7 dígitos." |
| Município | `municipalityName` | text | S | Não vazio | "Município é obrigatório." |
| UF | `uf` | select (27) | S | Não vazio | "UF é obrigatória." |
| Código IBGE | `municipalityId` | text | N | 7 dígitos (não validado client) | — |
| Endereço | `address` | text | N | — | — |
| E-mail institucional | `contactEmail` | text | N | — | — |
| Telefone | `phone` | text | N | — | — |
| Status | `status` | select | N | Padrão: `draft` | — |

### Formulário: Nova Equipe

| Campo | Nome técnico | Tipo | Obrig |
|---|---|---|---|
| Nome da equipe | `name` | text | S |
| INE | `ine` | text | N |
| Tipo de equipe | `tipoEquipe` | text/select | N |

### Formulário: Gestor Inicial

| Campo | Nome técnico | Tipo | Obrig | LGPD |
|---|---|---|---|---|
| Nome completo | `name` | text | S | PD |
| E-mail | `email` | email | S | PD |
| CPF | `cpf` | text | N | PD |
| CNS | `cns` | text | N | PD |
| CBO | `cbo` | text | N | — |
| Telefone | `phone` | text | N | PD |

### Dados exibidos da UBS

| Campo exibido | Nome técnico | Tipo | Fonte |
|---|---|---|---|
| CNES | `cnes` | string | API |
| Município | `municipalityName` | string | API |
| UF | `uf` | enum | API |
| IBGE | `municipalityId` | string | API |
| E-mail | `contactEmail` | string | API |
| Telefone | `phone` | string | API |
| Equipes | `teamCount` | number | API |
| Gestores | `gestorCount` | number | API |
| Usuários | `userCount` | number | API |
| Pacientes | `patientCount` | number | API |
| Status | `status` | enum | API |
| Criado em | `createdAt` | ISO date | API |
| Criado por | `createdByName` | string | API (join) |
| Ativado em | `activatedAt` | ISO date | API |
| Suspenso em | `suspendedAt` | ISO date | API |
| Aprovado por | `homologationApprovedBy` | string | API |
| Aprovado em | `homologationApprovedAt` | ISO date | API |

---

## 6. Regras de negócio

| Código | Gatilho | Condição | Ação | Mensagem |
|---|---|---|---|---|
| RN-UBS-01 | Clicar transição | Checklist incompleto (`checklist.ok === false`) | Botão desabilitado | — |
| RN-UBS-02 | Confirmar transição | `window.confirm` aceito | `PATCH /platform/units/:id {status}` | — |
| RN-UBS-03 | API retorna 422 com `blocked[]` | Critérios não cumpridos | Exibe lista de critérios bloqueados | "Critérios pendentes:\n• [label1]\n• [label2]" |
| RN-UBS-04 | Criar gestor inicial | Sucesso | Banner de senha temporária exibido | "Senha temporária do gestor — exibida uma única vez" |
| RN-UBS-05 | Criar gestor inicial | Sucesso | Status auto-transicionado `draft→onboarding` pela API | — |
| RN-UBS-06 | Senha temporária exibida | Clicar "Confirmo que anotei" | Banner ocultado (`setTempPwd("")`) | — |
| RN-UBS-07 | Transição → `active` | `homologation` → `active` | API seta `activatedAt` | — |
| RN-UBS-08 | Transição → `suspended` | Qualquer → `suspended` | API seta `suspendedAt` | — |

---

## 7. Ações e comportamentos

| Ação | Gatilho | API | Resultado sucesso | Resultado erro |
|---|---|---|---|---|
| Carregar UBS | Montar componente | `GET /platform/units/:id` | Dados exibidos | Alert vermelho |
| Carregar checklist | Montar componente | `GET /platform/units/:id/checklist` | Critérios exibidos | Checklist ocultado |
| Transitar status | Botão de transição | `PATCH /platform/units/:id` | UBS recarregada | Alert com critérios bloqueados |
| Criar equipe | Submit `new-team` | `POST /platform/units/:id/teams` | Volta para detalhe | Alert no form |
| Criar gestor | Submit `new-manager` | `POST /platform/units/:id/initial-manager` | Banner senha + volta detalhe | Alert no form |

---

## 8. Navegação entre páginas

| Elemento | Condição | Destino | Parâmetros |
|---|---|---|---|
| "← Voltar" (header) | Sempre | [Console Nacional](console-nacional.md) | — |
| "Fazer agora" → gestor | `gestors.length === 0` | `view = "new-manager"` | — |
| "Fazer agora" → equipe | `teams.length === 0` | `view = "new-team"` | — |
| "+ Cadastrar equipe" | Sempre | `view = "new-team"` | — |
| "← Voltar" (subview) | Sempre | `view = "detail"` | — |

---

## 9. Permissões

| Capability | Perfis | Se não tiver |
|---|---|---|
| `support_admin` | `support_admin` | Bloqueado antes de chegar aqui |

---

## 10. Auditoria

| Ação | Evento | Dados |
|---|---|---|
| Transição de status | `UNIT_STATUS_CHANGED` | unitId, fromStatus, toStatus, changedBy, timestamp |
| Criação de gestor | `USER_CREATED` | unitId, userId, role=gestor, createdBy, timestamp |
| Criação de equipe | `TEAM_CREATED` | unitId, teamId, name, createdBy, timestamp |

**Crítico:** senha temporária nunca registrada em log.

---

## 11. Critérios de aceite

- [ ] Dados da UBS carregam ao abrir detalhe
- [ ] StatusBadge reflete status atual com cor correta
- [ ] Banner de ações pendentes aparece quando faltam gestor/equipe
- [ ] Botão de transição desabilitado quando checklist incompleto
- [ ] Transição mostra `window.confirm` antes de executar
- [ ] Erro 422 com `blocked[]` exibe lista de critérios pendentes
- [ ] Senha temporária exibida uma única vez após criar gestor
- [ ] Botão "Confirmo que anotei" oculta a senha
- [ ] Criar gestor em UBS `draft` auto-transiciona para `onboarding`
- [ ] "← Voltar" retorna para lista do Console Nacional

---

## 12. Cenários de teste

| # | Cenário | Perfil | Entrada | Esperado |
|---|---|---|---|---|
| 01 | Abrir UBS draft sem gestor | `support_admin` | Clicar UBS draft | Banner amarelo "Cadastrar gestor inicial" |
| 02 | Criar gestor inicial | `support_admin` | Preencher form gestor | Senha temporária exibida, status → onboarding |
| 03 | Ocultar senha | `support_admin` | Clicar "Confirmo que anotei" | Banner de senha desaparece |
| 04 | Tentar ativar sem checklist | `support_admin` | Clicar "Ativar UBS" sem itens marcados | Botão desabilitado ou erro 422 |
| 05 | Transição bloqueada | `support_admin` | API retorna `blocked[]` | Lista de critérios exibida |
| 06 | Criar equipe | `support_admin` | "+ Cadastrar equipe" + nome | Equipe criada, detalhe recarregado |
| 07 | Voltar para lista | `support_admin` | "← Voltar" | Console Nacional exibido |
| 08 | Suspender UBS ativa | `support_admin` | "Suspender" + confirmar | Status → suspended, `suspendedAt` preenchido |
| 09 | Reativar UBS suspensa | `support_admin` | "Reativar" + confirmar | Status → active |

---

## 13. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
