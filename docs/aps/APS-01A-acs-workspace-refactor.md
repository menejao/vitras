# APS-01A — ACS Workspace Refactor
## Especificação Técnica e Plano de Implementação

**Versão:** 1.0  
**Data:** 2026-06-18  
**Status:** APROVADO PARA IMPLEMENTAÇÃO  
**Branch alvo:** feat/aps-01a-acs-workspace

---

## 1. Diagnóstico — Estado Atual

### 1.1 Módulo ACS hoje

**Arquivo:** `frontend-react/src/pages/AcsTasksPage.jsx` (539 linhas)  
**Tab ID:** `acs_tasks` → label "ACS"  
**Acesso:** apenas role=acs (+ admin)

**Estrutura atual — 2 tabs:**
```
┌─ Tarefas ─────────────────────────────────────────────┐
│  KPIs: Pendentes / Urgentes / Em atraso / Concluídas  │
│  Toolbar: busca, status, tipo, prioridade, período    │
│  Lista de cards por paciente                          │
└───────────────────────────────────────────────────────┘
┌─ Grupos Familiares ────────────────────────────────────┐
│  FamilyGroupsSection — auto-agrupamento por endereço  │
│  Cards com: endereço, microárea, membros (botões)     │
│  Seção "sem grupo" + "sem endereço"                   │
└───────────────────────────────────────────────────────┘
```

### 1.2 Visita ACS — onde está hoje

**PatientDetailPanel.jsx:**
- Linha 417-428: "Visita domiciliar" como tipo de registro no formulário de atendimento
- Linha 423: `type === "visit"` renderiza "Visita ACS"
- Linha 1379/1389: cria tarefa com title "Visita ACS — {nome}" direto do painel do paciente
- Linha 1653: campo `homeVisitFreq` (frequência de visita domiciliar)
- Linhas 112/114: indicadores de protocolo pediátrico (1ª/2ª visita ACS)

**Backend tasks.js:**
- Task types existentes: `home_visit`, `active_search`, `return_visit`, `vaccination`, `pregnant_follow`, `chronic_follow`, `child_follow`, `other`
- Tasks criadas via `POST /tasks` (requer nurse_manager ou doctor como criador)
- ACS conclui/atualiza via `PATCH /patients/:id/tasks/:id`

### 1.3 Problemas identificados

| # | Problema | Impacto |
|---|---------|---------|
| P-01 | Visita ACS nasce dentro do Workspace do Paciente | ACS precisa ir até o paciente para criar visita — modelo invertido |
| P-02 | "Grupos Familiares" é agrupador automático por endereço, não família real | ACS não consegue ver família como unidade operacional |
| P-03 | Sem entidade de Visita Domiciliar própria — visita = registro clínico | Mistura responsabilidade clínica com territorial |
| P-04 | Sem Cadastro Domiciliar como entidade — campos espalhados em patient | FCD incompleto para exportação e-SUS |
| P-05 | Sem Busca Ativa operacional | ACS sem agenda inteligente por condição |
| P-06 | Sem Produção — ACS não visualiza sua própria produtividade | Sem feedback de desempenho |
| P-07 | Tab única "ACS" no sidebar — não reflete a complexidade do módulo | Experiência de produto subdesenvolvida |

---

## 2. Mapa de Navegação — Novo

```
SIDEBAR
└─ ACS [acs_tasks]
   ├─ Tab 1: Minha Fila      [fila]
   ├─ Tab 2: Famílias        [familias]
   │   └─ Detalhe da Família [familia/:id]
   ├─ Tab 3: Cadastro Individual  [cadastro_individual]
   ├─ Tab 4: Cadastro Domiciliar  [cadastro_domiciliar]
   ├─ Tab 5: Visitas              [visitas]
   │   └─ Nova Visita / Editar    [visita_form]
   ├─ Tab 6: Busca Ativa          [busca_ativa]
   └─ Tab 7: Produção             [producao]
```

**Rota nova no TabContent:**
```jsx
// TabContent.jsx
{tab === "acs_tasks" && <AcsWorkspacePage ... />}
```

O componente `AcsTasksPage` é **renomeado** para `AcsWorkspacePage` e completamente refatorado internamente.

---

## 3. Estrutura de Tabs — Detalhada

### Tab 1 — Minha Fila

**Propósito:** o ACS entra e sabe imediatamente o que fazer hoje.

**Fontes de dados:**
- Tarefas existentes: `GET /tasks?assigneeId={userId}` (fluxo atual preservado)
- Origem possível: nurse_manager, doctor, gestor, sistema

**Layout — 3 seções verticais:**

```
┌─ URGENTE (vermelho) ──────────────────────────────────┐
│  [Card tarefa urgente vencida]                        │
│  [Card tarefa urgente hoje]                           │
└───────────────────────────────────────────────────────┘
┌─ HOJE / ESTA SEMANA ──────────────────────────────────┐
│  [Card tarefa normal]                                 │
└───────────────────────────────────────────────────────┘
┌─ CONCLUÍDAS RECENTES (últimos 7d, colapsado) ─────────┐
│  ...                                                  │
└───────────────────────────────────────────────────────┘
```

**Card da tarefa — campos:**
```
┌─────────────────────────────────────────────────────┐
│ [TIPO] [PRIORIDADE]          [PRAZO]  [STATUS ▾]    │
│ Título da tarefa                                    │
│ Notas                                               │
│                                                     │
│ 👤 Nome do paciente                                 │
│ 🏠 Endereço da família                              │
│ ℹ  Por: Enf. Carlos · criada em 15/06              │
│                                                     │
│ [Registrar Visita]  [Concluir]  [Observação]       │
└─────────────────────────────────────────────────────┘
```

**Ações do card:**
- `Registrar Visita` → abre formulário de visita (Tab 5) pré-preenchido com paciente+família
- `Concluir` → `PATCH /patients/:id/tasks/:id { status: "done" }` (fluxo atual)
- `Observação` → adiciona nota à tarefa

**Preservação:** toda lógica atual de filtro, KPIs e `changeStatus()` é mantida. A diferença é no layout dos cards e nas ações adicionais.

---

### Tab 2 — Famílias

**Propósito:** família como unidade central de navegação territorial.

**Fonte de dados:**
- `GET /family-groups` (existente) — agrupamento por endereço
- `GET /households` (existente, após restauração do git — ver truth audit)

**Layout — lista de cards de família:**
```
┌─ Busca ──────────────────── [Filtro: microárea ▾] ──┐
└─────────────────────────────────────────────────────┘

┌─ Família: Rua das Flores, 42 ───────────────────────┐
│  MICROÁREA 001 · 3 moradores                        │
│  Responsável: Maria da Conceição Oliveira           │
│  Última visita: 10/06/2026 · Atualização: 15/06    │
│                                                     │
│  Membros: [Maria] [João] [Ana Paula]                │
│                                                     │
│  ⚠ 2 pendências   [Criar Visita] [Abrir Família ›] │
└─────────────────────────────────────────────────────┘
```

**Indicadores de estado:**
- `🟢` Família atualizada nos últimos 30d
- `🟡` Sem visita há 60d
- `🔴` Sem visita há 90d+
- `⚠` Tem pendências (tarefas em aberto ou dados incompletos)

#### 2a. Tela Detalhe da Família

Painel lateral (desktop) ou tela nova (mobile):

```
┌─ FAMÍLIA — Rua das Flores, 42 ──────────────────────┐
│                                                     │
│  RESUMO                                             │
│  Endereço · Microárea · ACS responsável             │
│  Território                                         │
│                                                     │
│  MORADORES                   [+ Adicionar]          │
│  ┌──────────────────────────────────────────────┐   │
│  │ Maria · 58a · CNS ·  Responsável             │   │
│  │ João  · 61a · CNS ·  Cônjuge                 │   │
│  │ Ana   · 31a · CNS ·  Filha — Gestante ⚕     │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  PENDÊNCIAS                                         │
│  ● Visita em atraso — Ana Paula (31d)               │
│  ● Dado incompleto — CNS de João                   │
│  ● Tarefa aberta — Hipertensão Maria                │
│                                                     │
│  TIMELINE                                [filtrar]  │
│  ── Junho ────────────────────────────────────      │
│  10/06  Visita domiciliar                           │
│  01/06  Atualização cadastral                       │
│  ── Maio ─────────────────────────────────────      │
│  20/05  Atendimento UBS — Maria                     │
│                                                     │
│  [Nova Visita]  [Cadastro Domiciliar]               │
└─────────────────────────────────────────────────────┘
```

---

### Tab 3 — Cadastro Individual

**Propósito:** substituir formulário gigante por fluxo guiado de 5 etapas.

**Compatibilidade CDS:** preservar todos os campos exportados. Apenas reorganizar UX.

**Fluxo — multi-step wizard (mobile-friendly):**

```
Etapa 1/5  ●●○○○   [Anterior] [Próximo →]

IDENTIFICAÇÃO
─────────────
CNS
CPF
Nome completo
Nome Social
Sexo
Data de nascimento
Nacionalidade
```

```
Etapa 2/5  ●●●○○

CONTATO
───────
Telefone celular
Telefone residencial
E-mail
```

```
Etapa 3/5  ●●●●○

ENDEREÇO
────────
CEP                 [Buscar ↗]
Tipo de logradouro
Logradouro
Número
Complemento
Bairro
Município           (automático via CEP)
Microárea
Fora de área        [ ] Sim
```

```
Etapa 4/5  ●●●●●

INFORMAÇÕES SOCIAIS
───────────────────
Escolaridade
Ocupação
Situação no mercado de trabalho
Renda familiar
Comunidades tradicionais
Deficiência
Situação de rua
```

```
Etapa 5/5  Revisão

CONDIÇÕES DE SAÚDE
──────────────────
[Campos CDS existentes — sem alteração]

[Salvar Cadastro]
```

**Implementação:**
- Componente: `AcsCadastroIndividualForm.jsx`
- Reutiliza: `PatientModal` lógica de submit, `usePatientModal` hooks
- **Não** duplica: `POST /patients` e `PUT /patients/:id` — mesmos endpoints
- **Não** remove campos do PatientModal — este formulário é interface alternativa para o ACS

---

### Tab 4 — Cadastro Domiciliar

**Propósito:** tornar informações de moradia compreensíveis e compatíveis com FCD e-SUS.

**Componente:** `AcsCadastroDomiciliarForm.jsx`

**Blocos colapsáveis:**

```
┌─ ENDEREÇO ────────────────────────────────────────── ▼ ┐
│  CEP · Tipo logradouro · Logradouro · Número           │
│  Complemento · Bairro · Tipo imóvel · Microárea        │
└────────────────────────────────────────────────────────┘
┌─ CONDIÇÕES DE MORADIA ────────────────────────────── ▼ ┐
│  Situação de posse da terra                            │
│  Localização (urbana/rural)                            │
│  Tipo de domicílio                                     │
│  Área rural produtiva? / Tipo de acesso                │
│  Nº de moradores · Nº de cômodos                       │
└────────────────────────────────────────────────────────┘
┌─ ABASTECIMENTO DE ÁGUA ───────────────────────────── ▼ ┐
│  Fonte de abastecimento · Água para consumo            │
└────────────────────────────────────────────────────────┘
┌─ ENERGIA ELÉTRICA ────────────────────────────────── ▼ ┐
│  Disponibilidade · Origem                              │
└────────────────────────────────────────────────────────┘
┌─ ESGOTAMENTO SANITÁRIO ───────────────────────────── ▼ ┐
│  Tipo de escoamento                                    │
└────────────────────────────────────────────────────────┘
┌─ DESTINO DO LIXO ─────────────────────────────────── ▼ ┐
│  Tipo de destinação                                    │
└────────────────────────────────────────────────────────┘
┌─ ANIMAIS NO DOMICÍLIO ────────────────────────────── ▼ ┐
│  Gato [ ] · Cachorro [ ] · Pássaro [ ] · Outros [ ]   │
│  Quantidade de cada                                    │
└────────────────────────────────────────────────────────┘
┌─ FAMÍLIAS VINCULADAS ─────────────────────────────── ▼ ┐
│  CNS/CPF · Nome responsável                            │
│  Renda familiar · Nº membros                          │
│  Reside desde · Mudou-se · Parentesco                 │
│                                          [+ Família]  │
└────────────────────────────────────────────────────────┘
┌─ INSTITUIÇÃO DE PERMANÊNCIA ──────────────────────── ▼ ┐
│  [ ] Sim · Nome da instituição                        │
│  [ ] Preso · [ ] Outros                               │
└────────────────────────────────────────────────────────┘

                    [Salvar Cadastro Domiciliar]
```

**Backend:** `PUT /patients/:id` com campos household (F5-01 — já implementado) + `/households` route (a restaurar).

---

### Tab 5 — Visitas

**Propósito:** toda visita ACS nasce aqui. Não mais dentro do paciente.

**Componente:** `AcsVisitasPage.jsx` + `AcsVisitaForm.jsx`

**Lista de visitas:**
```
┌─ Filtros: [Período ▾] [Desfecho ▾] [Microárea ▾] [Buscar] ┐

┌─ Visita — 12/06/2026 ──────────────────────────────────────┐
│  🏠 Rua das Flores, 42 · Microárea 001                    │
│  👤 Maria da Conceição                                     │
│  Desfecho: REALIZADA  · Turno: Manhã                      │
│  Motivo: Visita periódica · HAS + DM                      │
│                                           [Editar] [Ver]  │
└────────────────────────────────────────────────────────────┘
```

**Formulário de Nova Visita — campos completos:**

```
DADOS DA VISITA
───────────────
Data                 [📅 Hoje]
Turno                ○ Manhã  ○ Tarde  ○ Noite
Microárea
Domicílio / Família  [Selecionar família ▾]
Paciente             [Selecionar na família ▾]

DESFECHO
────────
○ Realizada   ○ Recusada   ○ Ausente

MOTIVO DA VISITA
────────────────
[ ] Cadastramento / Atualização cadastral
[ ] Visita periódica
[ ] Busca ativa
[ ] Convite para atividades coletivas
[ ] Outros

BUSCA ATIVA (se marcado acima)
──────────────────────────────
[ ] Consulta     [ ] Exame        [ ] Vacina
[ ] Condicionalidades do Bolsa Família

ACOMPANHAMENTOS
───────────────
[ ] Gestante        [ ] Puérpera         [ ] Recém-nascido
[ ] Criança         [ ] Desnutrição      [ ] Reabilitação/Deficiência
[ ] Hipertensão     [ ] Diabetes         [ ] Asma
[ ] DPOC            [ ] Câncer           [ ] Outras doenças crônicas
[ ] Hanseníase      [ ] Tuberculose      [ ] Sint. respiratórios
[ ] Tabagista       [ ] Acamado          [ ] Vulnerabilidade social
[ ] Cond. Bolsa Família  [ ] Saúde mental  [ ] Álcool/Drogas
[ ] Pessoa idosa    [ ] Egresso internação

CONTROLE AMBIENTAL / VETORIAL
─────────────────────────────
[ ] Ação educativa      [ ] Imóvel em foco
[ ] Ação mecânica       [ ] Tratamento focal

SINAIS CLÍNICOS (quando desfecho = Realizada)
────────────────────────────────────────────
Peso         _____ kg
Altura       _____ cm
Temperatura  _____ °C
PA sistólica _____ mmHg
PA diastólica _____ mmHg
Glicemia     _____ mg/dL
             ○ Jejum  ○ Pós-prandial  ○ Não especificado

OBSERVAÇÕES
───────────
[Área de texto livre]

                    [Cancelar]  [Salvar Visita]
```

**Backend — nova rota necessária:**
```
POST   /acs-visits               — criar visita
GET    /acs-visits               — listar visitas do ACS
GET    /acs-visits/:id           — detalhe
PATCH  /acs-visits/:id           — editar
GET    /acs-visits/family/:fgId  — visitas por família
```

**Schema novo:** `AcsVisitCreateSchema` (zod)

---

### Tab 6 — Busca Ativa

**Propósito:** fila operacional por condição de saúde.

**Componente:** `AcsBuscaAtivaPage.jsx`

```
BUSCA ATIVA INTELIGENTE

Filtros:
[Sem visita recente ▾]  [Condição ▾]  [Microárea ▾]

Ordenar: [Mais tempo sem visita ▾]

┌─ Antônio José Vieira · 83a ──────────────────────────┐
│  🏠 Estrada da Roça, S/N · Microárea 003             │
│  Condições: HAS · DM · Cardiopatia                   │
│  Última visita: 45 dias atrás    ← ATENÇÃO           │
│                                                      │
│  [Criar Visita]  [Criar Tarefa]  [Abrir Família]    │
└──────────────────────────────────────────────────────┘
```

**Filtros disponíveis:**
- Sem atualização cadastral (> 6 meses)
- Sem visita recente (> 30d / > 60d / > 90d)
- Gestantes
- Hipertensos
- Diabéticos
- Crianças (0–5 anos)
- Idosos (≥ 60 anos)
- Vulnerabilidade social
- Acamados
- Tabagistas

**Fonte de dados:** pacientes com `assignedAcsId === user.id` + dados de visitas (quando rota `/acs-visits` existir) + `careCategory` + `conditions`

**Fase 1 (sem rota /acs-visits):** filtros por `careCategory`, `conditions`, data de cadastro — sem filtro de última visita real.  
**Fase 2 (com /acs-visits):** filtro completo por data da última visita registrada.

---

### Tab 7 — Produção

**Propósito:** gerado automaticamente — sem preenchimento manual.

**Componente:** `AcsProducaoPage.jsx`

```
PRODUÇÃO — JUNHO 2026

Período: [Semana ▾] [Mês ▾] [Trimestre ▾]

┌── VISITAS ─────────────────────────────────────────┐
│  Realizadas   12   Recusadas   2   Ausentes  1     │
└────────────────────────────────────────────────────┘
┌── CADASTROS ───────────────────────────────────────┐
│  Indivíduos  8    Domiciliares  3                  │
└────────────────────────────────────────────────────┘
┌── TAREFAS ─────────────────────────────────────────┐
│  Concluídas  15   Pendentes  4   Em atraso  1      │
└────────────────────────────────────────────────────┘
┌── FAMÍLIAS ACOMPANHADAS ───────────────────────────┐
│  18 famílias · 67 pessoas · Microárea 001+002+003  │
└────────────────────────────────────────────────────┘
```

**Fonte de dados:** calculado no frontend a partir de:
- Tarefas: já disponíveis
- Pacientes: já disponíveis
- Visitas: da rota `/acs-visits` (Fase 2)

---

## 4. Fluxos Operacionais

### Fluxo A — ACS inicia dia de trabalho
```
Login → ACS Workspace → Tab "Minha Fila"
→ Vê tarefas urgentes no topo
→ Seleciona tarefa → Card abre detalhes
→ Clica "Registrar Visita"
→ Formulário de visita pré-preenchido com paciente
→ Registra visita → Tarefa marcada como concluída
```

### Fluxo B — ACS visita família sem tarefa prévia
```
Tab "Famílias" → Busca ou localiza família
→ Abre Detalhe da Família
→ Vê pendências e histórico
→ Clica "Nova Visita"
→ Formulário de visita para aquela família
→ Salva visita → Timeline da família atualizada
```

### Fluxo C — ACS atualiza cadastro individual
```
Tab "Famílias" → Abre Família → Clica em membro
→ Tab "Cadastro Individual" com paciente pré-selecionado
→ Wizard de 5 etapas
→ Salva → Volta ao detalhe da família
```

### Fluxo D — ACS faz busca ativa
```
Tab "Busca Ativa" → Filtra: "Diabéticos + sem visita > 60d"
→ Lista priorizada
→ Seleciona paciente → Clica "Criar Visita"
→ Registra visita de busca ativa
```

### Fluxo E — Tarefa criada por enfermeira chega ao ACS
```
Enfermeira: PatientDetailPanel → cria tarefa → assignee = ACS
→ ACS: Tab "Minha Fila" → card novo aparece
→ ACS executa e conclui
```
*(fluxo atual — preservado sem alteração)*

---

## 5. Migração — Visita ACS do Workspace do Paciente

### O que remover de PatientDetailPanel.jsx

| Linha | O que é | O que fazer |
|-------|---------|------------|
| ~417-428 | Tipo "Visita domiciliar" no select do formulário de registro | **Remover** option `value="visit"` do select de tipo |
| ~423 | `type === "visit" ? "Visita ACS"` | **Remover** do label de histórico (usar apenas "Visita domiciliar" via /acs-visits) |
| ~1379, ~1389 | Criação de tarefa "Visita ACS — {nome}" pelo profissional clínico | **Manter** — enfermeiro/médico ainda pode criar tarefa de visita ACS |
| ~1653 | `homeVisitFreq` — frequência de visita | **Manter** — dado cadastral, não visita |
| ~112, ~114 | Indicadores de protocolo pediátrico (1ª/2ª visita ACS) | **Manter** — são alertas do protocolo, não o formulário de visita |

**Regra da migração:** o PatientDetailPanel **não perde** funcionalidade clínica. Remove apenas a capacidade de registrar a *ocorrência* da visita domiciliar como tipo de atendimento. Indicadores de protocolo permanecem.

### Fase de migração (gradual)

**Fase 1 (APS-01A):** Visitas nascem na Tab 5. PatientDetailPanel mantém o tipo "visit" como legado — não remove ainda. Adiciona aviso: "Para registrar visita domiciliar ACS, use o módulo ACS".

**Fase 2 (APS-01B):** Após validação em campo que ACS usa o novo módulo → remover tipo "visit" do PatientDetailPanel. Migrar registros históricos de `type=visit` para a nova entidade `/acs-visits`.

---

## 6. Impactos Técnicos

### 6.1 Frontend — arquivos afetados

| Arquivo | Mudança | Tipo |
|---------|---------|------|
| `src/pages/AcsTasksPage.jsx` | Renomear → `AcsWorkspacePage.jsx`, refatorar estrutura interna | Modificação |
| `src/components/TabContent.jsx` | Atualizar import e tab handler | Modificação |
| `src/config/nav.jsx` | Nenhuma mudança (tab id permanece `acs_tasks`) | — |
| `src/styles/05-patterns/acstasks.css` | Renomear → `acs.css`, expandir estilos | Modificação |
| `src/styles/05-patterns/index.css` | Atualizar import | Modificação |

### 6.2 Frontend — arquivos novos

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/AcsWorkspacePage.jsx` | Container principal com 7 tabs |
| `src/components/acs/AcsFilaTab.jsx` | Tab 1 — Minha Fila |
| `src/components/acs/AcsFamiliasTab.jsx` | Tab 2 — Famílias |
| `src/components/acs/AcsFamiliaDetalhe.jsx` | Painel detalhe da família |
| `src/components/acs/AcsCadastroIndividualTab.jsx` | Tab 3 — wrapper multi-step |
| `src/components/acs/AcsCadastroIndividualForm.jsx` | Wizard 5 etapas |
| `src/components/acs/AcsCadastroDomiciliarTab.jsx` | Tab 4 — blocos colapsáveis |
| `src/components/acs/AcsVisitasTab.jsx` | Tab 5 — lista de visitas |
| `src/components/acs/AcsVisitaForm.jsx` | Formulário completo de visita |
| `src/components/acs/AcsBuscaAtivaTab.jsx` | Tab 6 — fila operacional |
| `src/components/acs/AcsProducaoTab.jsx` | Tab 7 — dashboard produção |
| `src/styles/05-patterns/acs.css` | Todos os estilos novos |

### 6.3 Backend — rotas novas necessárias

| Rota | Método | Propósito | Prioridade |
|------|--------|-----------|-----------|
| `/acs-visits` | GET | Listar visitas do ACS autenticado | Alta |
| `/acs-visits` | POST | Criar visita | Alta |
| `/acs-visits/:id` | PATCH | Editar visita | Média |
| `/acs-visits/family/:fgId` | GET | Visitas por família | Média |

**Arquivo novo:** `backend/src/routes/acs-visits.js`  
**Schema novo:** `AcsVisitCreateSchema` em `backend/src/schemas.js`  
**Migration nova:** `backend/migrations/XXX_create_acs_visits.js` (Postgres) ou estrutura em db.json

### 6.4 Backend — sem alteração

- `GET/POST/PATCH /tasks` — preservado
- `GET/PUT /patients/:id` — preservado  
- `GET /family-groups` — preservado
- `POST/GET /patients/:id/records` — preservado
- CDS Export — sem toque

---

## 7. Componentes Reutilizáveis

Componentes existentes que serão reutilizados sem modificação:

| Componente | Onde reutilizado |
|-----------|-----------------|
| `KPI` | Tab Produção e Minha Fila (KPIs de topo) |
| `PageHeader` | Header do AcsWorkspacePage |
| `Button` | Ações em todos os cards e formulários |
| `Input` | Formulários de Cadastro Individual e Domiciliar |
| `Select` | Selects de tipo, turno, condições |
| `Alert` | Erros de formulário |
| `Card` | Container de cards de família |
| `PatBtn` (interno AcsTasksPage) | Mantido para navegação para paciente |
| `TypeBadge`, `PriorityBadge` (internos) | Mantidos na Tab Minha Fila |
| `FamilyGroupsSection` (interno) | Base para Tab Famílias (refatorada) |

---

## 8. Componentes Novos

| Componente | Descrição |
|-----------|-----------|
| `AcsFilaCard` | Card de tarefa com ações de Registrar Visita + Observação |
| `AcsFamiliaCard` | Card de família com indicadores de estado (🟢🟡🔴) e pendências |
| `AcsFamiliaDetalhe` | Painel/drawer com resumo, moradores, pendências, timeline |
| `AcsMemberRow` | Linha de membro familiar com CNS, parentesco, condições |
| `AcsTimeline` | Timeline cronológica de eventos por família |
| `AcsPendenciasBlock` | Bloco de pendências (visita em atraso, dado incompleto, tarefa aberta) |
| `AcsWizardStep` | Passo do wizard multi-step de Cadastro Individual |
| `AcsWizardNav` | Navegação de etapas (indicador de progresso) |
| `AcsCadastroBloco` | Bloco colapsável do Cadastro Domiciliar |
| `AcsVisitaCard` | Card de visita na lista de visitas |
| `AcsVisitaDesfechoBadge` | Badge colorido: Realizada / Recusada / Ausente |
| `AcsBuscaAtivaCard` | Card de paciente na busca ativa com indicador de urgência |
| `AcsProducaoBlock` | Bloco de KPIs de produção por categoria |

---

## 9. Mobile First — Validação por Breakpoint

| Breakpoint | Adaptação |
|-----------|-----------|
| 360px | Tabs horizontais com scroll; cards em full width; wizard uma etapa por tela; detalhe da família em tela cheia; form campos empilhados |
| 390px | Idem; botões de ação em linha horizontal |
| 412px | Idem; mínima mudança de 390px |
| 768px+ | Detalhe da família como painel lateral direito; wizard com sidebar de etapas |

**CSS approach:** mobile-first base. Desktop = overrides em `@media (min-width: 768px)`.

---

## 10. Plano de Implementação

### APS-01A-P1 — Estrutura e Minha Fila (5–7d)

| Task | Arquivo | Esforço |
|------|---------|---------|
| Criar `AcsWorkspacePage.jsx` com 7 tabs (stubs) | novo | 4h |
| Migrar lógica de tarefas para `AcsFilaTab.jsx` | novo | 3h |
| Implementar `AcsFilaCard` com ação "Registrar Visita" | novo | 4h |
| Migrar `FamilyGroupsSection` melhorada para `AcsFamiliasTab.jsx` | novo | 3h |
| Criar `AcsFamiliaCard` com indicadores 🟢🟡🔴 | novo | 3h |
| CSS base em `acs.css` | novo | 4h |
| Mobile responsive Tab 1 e 2 | acs.css | 3h |

### APS-01A-P2 — Famílias e Detalhe (5–7d)

| Task | Arquivo | Esforço |
|------|---------|---------|
| `AcsFamiliaDetalhe` — painel completo | novo | 6h |
| `AcsMemberRow`, `AcsTimeline`, `AcsPendenciasBlock` | novos | 4h |
| Mobile: detalhe em tela cheia no 360px | acs.css | 2h |
| Integrar com `/family-groups` e `/households` | AcsFamiliasTab | 2h |

### APS-01A-P3 — Cadastro Individual (wizard) (4–5d)

| Task | Arquivo | Esforço |
|------|---------|---------|
| `AcsCadastroIndividualForm` — wizard 5 etapas | novo | 8h |
| `AcsWizardStep`, `AcsWizardNav` | novos | 3h |
| Reutilizar `usePatientModal` e endpoints existentes | hook | 2h |
| Validação por etapa + mobile | | 3h |

### APS-01A-P4 — Cadastro Domiciliar (3–4d)

| Task | Arquivo | Esforço |
|------|---------|---------|
| `AcsCadastroDomiciliarTab` — blocos colapsáveis | novo | 6h |
| `AcsCadastroBloco` (componente colapsável) | novo | 2h |
| Integrar com `/patients/:id` (campos household) | | 2h |

### APS-01A-P5 — Rota /acs-visits + Tab Visitas (7–10d)

| Task | Arquivo | Esforço |
|------|---------|---------|
| `acs-visits.js` — GET/POST/PATCH | backend | 6h |
| `AcsVisitCreateSchema` em schemas.js | backend | 1h |
| Migration `XXX_create_acs_visits.js` | backend | 2h |
| `AcsVisitasTab` — lista + filtros | novo | 4h |
| `AcsVisitaForm` — formulário completo | novo | 8h |
| `AcsVisitaCard`, `AcsVisitaDesfechoBadge` | novos | 2h |
| Mobile form | | 3h |

### APS-01A-P6 — Busca Ativa + Produção (4–5d)

| Task | Arquivo | Esforço |
|------|---------|---------|
| `AcsBuscaAtivaTab` — filtros Fase 1 (sem visitas) | novo | 4h |
| `AcsBuscaAtivaCard` | novo | 2h |
| `AcsProducaoTab` — KPIs calculados | novo | 4h |
| `AcsProducaoBlock` | novo | 1h |

### APS-01A-P7 — Migração Visita + QA (3–4d)

| Task | Arquivo | Esforço |
|------|---------|---------|
| Aviso no PatientDetailPanel para Fase 1 | PatientDetailPanel | 1h |
| Testes mobile (360/390/412) | | 4h |
| Smoke de regressão: tarefas, grupos, CDS | | 2h |
| QA funcional dos 5 fluxos operacionais | | 4h |

**Esforço total estimado:** 50–70h dev + 10h QA = ~2 semanas sprint dedicado.

---

## 11. Riscos

| # | Risco | Severidade | Mitigação |
|---|-------|-----------|-----------|
| R-01 | `households.js` ausente do git — Cadastro Domiciliar depende dele | Alto | Restaurar do git history antes de APS-01A-P4 |
| R-02 | `/acs-visits` é rota nova — requer migration de banco | Médio | Fase P5 é a mais crítica; testar em staging antes |
| R-03 | Wizard de Cadastro Individual em mobile 360px pode ser difícil de usar | Médio | Testar em dispositivo real no P3 |
| R-04 | Regressão no fluxo de tarefas existente (enfermeiro → ACS) | Baixo | Smoke test no P7; lógica de tarefas isolada em AcsFilaTab |
| R-05 | Visita ACS em PatientDetailPanel cria confusão (dois pontos de entrada) | Baixo | Fase 1 mantém aviso; Fase 2 remove após validação |

---

## 12. QA — Critérios de Aceitação

- [ ] Visita ACS não nasce mais dentro do Workspace do Paciente (Fase 2)
- [ ] Família é a unidade central de navegação na Tab 2
- [ ] Detalhe da família exibe moradores, pendências e timeline
- [ ] Tarefas existentes preservadas e funcionais na Tab 1
- [ ] Compatibilidade CDS: nenhum campo exportado foi removido
- [ ] Fluxo territorial coerente: Microárea → Família → Pessoa → Visita → Tarefa
- [ ] Mobile first: 360px / 390px / 412px testados
- [ ] Sem regressão no PatientDetailPanel para perfis clínicos
- [ ] Sem regressão na criação de tarefas por enfermeiro/médico
- [ ] `/acs-visits` autenticado e restrito (role=acs ou canWriteRecords)
- [ ] AcsProducaoTab sem campo manual

---

*VITRAS APS — docs/aps/APS-01A-acs-workspace-refactor.md*
