# Painel — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-23  
**Nome funcional:** `Painel`  
**Label navegação:** `Painel`  
**Tab interna:** `dashboard`  
**Arquivo principal:** `frontend-react/src/pages/Dashboard.jsx`

---

## 1. Objetivo

Consolidar visão operacional da unidade em uma única tela com indicadores resumidos, alertas proativos, lista de pacientes prioritários e visão rápida da equipe ativa.

Tela não executa escrita direta. Uso principal: leitura operacional e navegação para outros módulos.

---

## 2. Contexto e localização real no código

| Item | Evidência em código |
|---|---|
| Renderização da página | `frontend-react/src/components/TabContent.jsx` |
| Condição de exibição | `tab === "dashboard"` |
| Arquivo React principal | `frontend-react/src/pages/Dashboard.jsx` |
| Estado de navegação | `frontend-react/src/App.jsx` via `const [tab, setTab] = useState(...)` |
| Entrada inicial padrão | `dashboard` em `App.jsx` |
| Exceção de entrada | `gestor` faz `setTab("gestor")` no login; `receptionist` não usa esta tela e vai para `ReceptionistApp`; `support_admin` vai para `PlatformConsolePage` |
| Item de menu | `frontend-react/src/config/nav.jsx` com `id: "dashboard", label: "Painel"` |
| Shell da tela | `PageLayout` + `PageHeader` + `Card` + `KPI` + `Button` + `Chip` + `Badge` |

**Rota real:** não existe rota URL dedicada para `Painel`.  
Sistema usa SPA com rota base `/` e navegação interna por estado `tab`.

---

## 3. Dependências e fontes de dados

### 3.1 Hooks e carregamento

| Dependência | Arquivo | Papel |
|---|---|---|
| `useBootstrap` | `frontend-react/src/hooks/useBootstrap.js` | carrega pacientes, usuários, templates, `protocolByPatient`, `demandMonthly` |
| `useAgenda` | `frontend-react/src/hooks/useAgenda.js` | carrega `agendaEntries` quando usuário possui `agenda.read` ou `agenda.write` e `teamId` |
| `usePharmacy` | `frontend-react/src/hooks/usePharmacy.js` | carrega `pharmacyStock` quando usuário possui `pharmacy.read` ou `pharmacy.write` e `teamId` |
| `useAuth` | `frontend-react/src/hooks/useAuth.js` | define usuário autenticado, login, refresh e redirecionamentos por perfil |

### 3.2 APIs efetivamente usadas

| API | Origem no código | Uso no Painel |
|---|---|---|
| `GET /bootstrap` | `bootstrap(token)` em `frontend-react/src/api.js` | fonte principal para `patients`, `users`, `protocolTemplates`, `demandMonthly`, `user` |
| `GET /patients/protocol-summaries?ids=...` | `getProtocolSummaries(token, ids)` | gera `protocolByPatient`, usado em KPIs, pacientes prioritários e alertas |
| `GET /agenda` | `useAgenda` | alimenta alertas de agenda do dia |
| `GET /pharmacy/stock` | `usePharmacy` | alimenta alertas de estoque zerado/baixo |
| `POST /me/presence` | `pingPresence(token)` em `useBootstrap` | mantém `allUsers` com status online; não altera renderização do Painel atual |
| `GET /users` | `listUsers(token)` em `useBootstrap` | reaproveitado para `allUsers`; Painel usa `users`, não `allUsers` |

### 3.3 Backend diretamente relacionado

| Arquivo | Papel |
|---|---|
| `backend/src/routes/admin.js` | implementa `GET /bootstrap` |
| `backend/src/utils/patients.js` | aplica Team Scope e mascaramento LGPD em pacientes |
| `backend/src/utils/metrics.js` | calcula `demandMonthly` |

---

## 4. Team Scope, LGPD e escopo de dados

### 4.1 Escopo de pacientes no `GET /bootstrap`

`GET /bootstrap` usa `getAllowedPatients(db, req.user, {})`.

| Perfil / condição | Escopo implementado |
|---|---|
| `receptionist` | busca municipal por paciente na lógica de pacientes, mas este perfil não usa `Painel`; renderiza `ReceptionistApp` |
| `acs` | somente pacientes `teamId === user.teamId` e `assignedAcsId === user.id` |
| `gestor` | pacientes das equipes pertencentes à `unitId` do gestor |
| demais perfis clínicos | pacientes autorizados por `canAccessPatient(user, patient)` |
| `break_glass_admin` | acesso liberado por `canAccessPatient` |

### 4.2 Escopo de usuários no `GET /bootstrap`

| Condição | Resultado |
|---|---|
| com capability `users.read.all` | recebe usuários de múltiplas equipes/unidade |
| sem capability `users.read.all` | recebe apenas usuários com `teamId === req.user.teamId` |

### 4.3 Mascaramento LGPD

No retorno de `GET /bootstrap`, pacientes passam por `maskSensitivePatientFields(patient)`.

| Campo | Comportamento |
|---|---|
| `cpf` | mascarado para `***.***.***-NN` |
| `cns` | mascarado para `*************NN` |

Painel não exibe CPF nem CNS, mas recebe lista já mascarada.

---

## 5. Elementos visíveis da tela

## 5.1 Header

Componente `PageHeader` com:

| Elemento | Valor real |
|---|---|
| `eyebrow` | `Vitras` |
| `title` | `Visão operacional da unidade` |
| `subtitle` | texto institucional fixo no componente |
| ação 1 | botão `Abrir gestão à vista` |
| ação 2 | botão `Ir para pacientes` |

### 5.2 KPIs

Seção `dashboard__kpis` com 4 cards `KPI`.

| Card | Cálculo real | Observações |
|---|---|---|
| `Pacientes ativos` | `patients.length` | helper: `Total cadastrado` |
| `Com ACS definido` | pacientes com `assignedAcsId` preenchido | helper: `Sem ACS: {unassigned}` |
| `Protocolos críticos` | contagem de `protocolChip(summary).tone === "danger"` | helper mostra contagem `Atenção` e `Em dia` |
| `Profissionais` | `users.length` | helper: `ACS: {acsCount} · Médicos: {docCount}` |

### 5.3 Card de demanda programada

Renderizado somente quando `currentUser?.role === "nurse_manager"`.

| Campo visível | Origem | Regra |
|---|---|---|
| título | fixo `Demanda programada` | sempre |
| badge status | `dmStatus` | calculado por faixa 50%–70% |
| percentual | `dmPct` | arredondado com `Math.round` |
| barra | `dashboard__meter-fill` | largura limitada por `Math.min(dmPct, 100)` |
| rodapé | `dmSched`, `dmSpont`, meta | se sem dados, mostra `Nenhum atendimento registrado.` |

### 5.4 Alertas proativos

Renderizados somente quando `alerts.length > 0`.

| Elemento | Regra real |
|---|---|
| quantidade exibida | até 6 na tela (`slice(0, 6)`) |
| origem | `buildProactiveAlerts(patients, protocolByPatient, pharmacyStock, agenda)` |
| formato | botão `ghost` clicável ou desabilitado |
| clique | só navega se `a.patientId` existir |
| botão desabilitado | `disabled={!a.patientId}` |

Tipos implementados por `buildProactiveAlerts`:

| Tipo | Gatilho real | Navega para paciente |
|---|---|---|
| `DPP ultrapassada` | paciente gestante com `expectedDeliveryDate + 1 dia <= hoje` | sim |
| `Protocolo crítico` | `protocolChip(...).tone === "danger"` | sim |
| `Medicamento zerado` | item farmácia com `qty === 0` | não |
| `Estoque baixo` | item farmácia com `qty <= minQty` | não |
| `Consulta hoje` | agenda com `date === hoje` e `status === "scheduled"` | não, porque payload do alerta não contém `patientId` |

### 5.5 Pacientes prioritários

Card `Pacientes prioritários`.

| Comportamento | Regra real |
|---|---|
| lista base | pacientes com `protocolChip(...).tone === "danger"` |
| limite visual | 6 primeiros (`slice(0, 6)`) |
| vazio | `Nenhum paciente com protocolo crítico.` |
| clique linha | `onNavigate?.(p.id)` |
| acessibilidade teclado | `Enter` e `Space` disparam navegação |
| subtítulo da linha | `{catLabel(templates, p.careCategory)} · {acsName}` |

### 5.6 Equipe ativa

Card `Equipe ativa`.

| Comportamento | Regra real |
|---|---|
| chip cabeçalho | `{users.length} membros` |
| lista visual | `users.slice(0, 6)` |
| vazio | `Nenhum membro na equipe.` |
| avatar | `Avatar name={u.name}` |
| papel textual | `roleLabel(u.role)` |
| chip lateral | mapeamento manual para `ACS`, `Médico`, `Téc. Enf.`, `Farmac.`, fallback `Enf.` |

---

## 6. Modais, formulários, filtros, tabelas

| Item | Existe nesta página? | Evidência |
|---|---|---|
| Modal próprio | não | `Dashboard.jsx` não abre modal |
| Formulário | não | nenhum `input`, `select`, `textarea`, submit ou estado de formulário |
| Filtro | não | nenhum filtro local |
| Tabela | não | renderiza cards e listas (`ul/li`) |
| Drawer | não | inexistente nesta página |
| Toast | não localizado em `Dashboard.jsx` |

Observação: modais globais (`AppModals`, `SessionTimeoutModal`) existem na aplicação, mas não são acionados por ação própria do Painel.

---

## 7. Dicionário de campos visíveis

## 7.1 Header e ações

| Nome | Tipo | Origem | Obrigatório | Validação | Regra | Mensagem de erro | LGPD | Comportamento |
|---|---|---|---|---|---|---|---|---|
| `Abrir gestão à vista` | botão | `Dashboard.jsx` | sim | nenhuma | chama `onNavigate?.("gestor")` | n/a | sem dado pessoal | navega para tab `gestor` |
| `Ir para pacientes` | botão | `Dashboard.jsx` | sim | nenhuma | chama `onNavigate?.("patients")` | n/a | sem dado pessoal | ver nota de navegação na seção 9 |

## 7.2 KPIs

| Nome | Tipo | Origem | Obrigatório | Validação | Regra | Mensagem de erro | LGPD | Comportamento |
|---|---|---|---|---|---|---|---|---|
| `Pacientes ativos` | número | `patients.length` | sim | array pode ser vazio | exibe total carregado | não há | dado agregado | card sempre renderiza |
| `Com ACS definido` | número | filtro por `assignedAcsId` | sim | string trim truthy | conta pacientes vinculados a ACS | não há | dado agregado | helper exibe `Sem ACS: N` |
| `Protocolos críticos` | número | `protocolByPatient` | sim | depende de resumo por paciente | conta `tone === "danger"` | não há | dado agregado | card muda classe visual por severidade |
| `Profissionais` | número | `users.length` | sim | array pode ser vazio | helper mostra contagem ACS e médico | não há | dado agregado | card sempre renderiza |

## 7.3 Demanda programada

| Nome | Tipo | Origem | Obrigatório | Validação | Regra | Mensagem de erro | LGPD | Comportamento |
|---|---|---|---|---|---|---|---|---|
| `Percentual programado` | número ou traço | `demandMonthly.totals` | não | só aparece para `nurse_manager` | `Math.round((scheduled / total) * 100)` se `total > 0` | não há | dado agregado | sem dados mostra `—` |
| `Status demanda` | badge | cálculo local | não | depende de `dmPct` | `Na meta`, `Abaixo da meta`, `Acima da meta`, `Sem dados` | não há | dado agregado | badge acompanha tom semântico |
| `Rodapé demanda` | texto | cálculo local | não | n/a | mostra quantidades ou mensagem de ausência | não há | dado agregado | sem dados: `Nenhum atendimento registrado.` |

## 7.4 Alertas

| Nome | Tipo | Origem | Obrigatório | Validação | Regra | Mensagem de erro | LGPD | Comportamento |
|---|---|---|---|---|---|---|---|---|
| `title` | texto | alerta calculado | sim | string | exibido em `<strong>` | não há | pode conter nome do paciente | aparece em todos alertas |
| `detail` | texto | alerta calculado | sim | string | exibido em linha secundária | não há | pode conter nome do paciente | aparece em todos alertas |
| `patientId` | identificador interno | alerta calculado | não | precisa existir para navegação | habilita clique | botão desabilitado se ausente | identificador não visível | sem `patientId`, alerta fica sem navegação |

## 7.5 Pacientes prioritários e equipe

| Nome | Tipo | Origem | Obrigatório | Validação | Regra | Mensagem de erro | LGPD | Comportamento |
|---|---|---|---|---|---|---|---|---|
| `Nome do paciente` | texto | `p.name` | sim | string | exibido na lista prioritária | não há | dado pessoal direto | clique navega |
| `Categoria de cuidado` | texto | `catLabel(templates, p.careCategory)` | sim | fallback interno | deriva label de template/categoria | não há | dado clínico resumido | mostrado com ACS |
| `ACS responsável` | texto | `users.find(...assignedAcsId)` | sim | fallback `Sem ACS` | se não encontrar usuário, usa fallback | não há | dado profissional | mostrado na subtarefa |
| `Status protocolo` | chip | `protocolChip(summary)` | sim | depende de sumário | tom/label conforme alertas do protocolo | não há | dado clínico agregado | mostrado no lado direito |
| `Nome do usuário` | texto | `u.name` | sim | string | exibido em equipe ativa | não há | dado pessoal de colaborador | até 6 itens |
| `Role do usuário` | texto | `roleLabel(u.role)` | sim | mapeamento em `roles.js` | label amigável do papel | não há | dado funcional | linha secundária |

---

## 8. Regras de negócio encontradas no código

| ID | Gatilho | Condição | Resultado | Bloqueio | Mensagem |
|---|---|---|---|---|---|
| RN-PAINEL-001 | abrir app autenticado | `uiState.tab` ausente | tab inicial = `dashboard` | nenhuma | n/a |
| RN-PAINEL-002 | login bem-sucedido | `role === "gestor"` | `setTab("gestor")` | não entra no Painel por padrão | n/a |
| RN-PAINEL-003 | autenticação | `role === "receptionist" && !isAdmin(user)` | renderiza `ReceptionistApp` no lugar do shell/tab | Painel não acessível por fluxo principal | n/a |
| RN-PAINEL-004 | autenticação | `role === "support_admin"` | renderiza `PlatformConsolePage` | Painel não acessível | n/a |
| RN-PAINEL-005 | montar KPIs | paciente com `assignedAcsId` preenchido | conta em `Com ACS definido` | nenhuma | n/a |
| RN-PAINEL-006 | montar KPIs de protocolo | `protocolChip(summary).tone === "danger"` | incrementa críticos | depende de `protocolByPatient` | n/a |
| RN-PAINEL-007 | montar KPIs de protocolo | `tone === "warn"` | incrementa atenção | depende de `protocolByPatient` | n/a |
| RN-PAINEL-008 | montar KPI profissionais | `u.role === "acs"` ou `doctor` | conta subtotais no helper | nenhuma | n/a |
| RN-PAINEL-009 | render card demanda | `currentUser.role === "nurse_manager"` | card é exibido | outros perfis não veem card | n/a |
| RN-PAINEL-010 | calcular demanda | `dmTotal > 0` | calcula `dmPct` arredondado | sem total gera `null` | `Nenhum atendimento registrado.` |
| RN-PAINEL-011 | classificar meta demanda | `dmPct >= 50 && dmPct <= 70` | status `Na meta`, tom `success` | nenhuma | n/a |
| RN-PAINEL-012 | classificar meta demanda | `dmPct < 50` | status `Abaixo da meta`, tom `warning` | nenhuma | n/a |
| RN-PAINEL-013 | classificar meta demanda | `dmPct > 70` | status `Acima da meta`, tom `danger` | nenhuma | n/a |
| RN-PAINEL-014 | gerar alerta DPP | paciente `pregnant` com DPP vencida | cria alerta `danger` | depende de `expectedDeliveryDate` válida | n/a |
| RN-PAINEL-015 | gerar alerta protocolo | `protocolChip(...).tone === "danger"` | cria alerta `danger` por paciente | depende de `protocolByPatient` | n/a |
| RN-PAINEL-016 | gerar alerta farmácia | `qty === 0` | cria `Medicamento zerado` | depende de estoque carregado | n/a |
| RN-PAINEL-017 | gerar alerta farmácia | `qty <= minQty` e `qty !== 0` | cria `Estoque baixo` | depende de estoque carregado | n/a |
| RN-PAINEL-018 | gerar alerta agenda | `date === hoje && status === "scheduled"` | cria `Consulta hoje` | depende de agenda carregada | n/a |
| RN-PAINEL-019 | listar alertas na tela | alertas calculados > 0 | mostra no máximo 6 | zero alertas oculta seção inteira | n/a |
| RN-PAINEL-020 | clicar alerta | `a.patientId` existe | chama `onNavigate(a.patientId)` | sem `patientId`, botão desabilitado | n/a |
| RN-PAINEL-021 | listar pacientes prioritários | `protocolChip(...).tone === "danger"` | mostra até 6 pacientes | sem críticos mostra vazio | `Nenhum paciente com protocolo crítico.` |
| RN-PAINEL-022 | clicar paciente prioritário | clique ou `Enter` ou `Space` | chama `onNavigate(p.id)` | nenhuma | n/a |
| RN-PAINEL-023 | listar equipe | `users.length > 0` | mostra até 6 usuários | zero usuários mostra vazio | `Nenhum membro na equipe.` |

---

## 9. Navegação real

## 9.1 Origens da página

| Origem | Ação | Destino | Parâmetros | Permissões |
|---|---|---|---|---|
| abertura do app principal | tab padrão | `dashboard` | `tab` local | usuário autenticado que não seja roteado para outra experiência |
| sidebar | clique item `Painel` | `dashboard` | `setTab("dashboard")` | conforme `buildNavItems` |

## 9.2 Saídas da página

| Origem | Ação | Destino | Parâmetros | Permissões |
|---|---|---|---|---|
| header | clicar `Abrir gestão à vista` | tab `patients` | `selectedPatientId = "gestor"` por implementação atual de `navigatePatient` | sem guarda local adicional |
| header | clicar `Ir para pacientes` | tab `patients` | `selectedPatientId = "patients"` por implementação atual de `navigatePatient` | sem guarda local adicional |
| card alerta com `patientId` | clique | tab `patients` | `selectedPatientId = patientId` | acesso ao tab `patients` |
| lista de prioritários | clique / `Enter` / `Space` | tab `patients` | `selectedPatientId = patientId` | acesso ao tab `patients` |

### 9.3 Observação crítica de implementação

Em `TabContent.jsx`, `Dashboard` recebe `onNavigate={navigatePatient}` e `navigatePatient` sempre executa:

- `setTab("patients")`
- `setSelectedPatientId(id)`

Isto significa:

- botão `Abrir gestão à vista` **não** abre tab `gestor`; envia string `"gestor"` para seleção de paciente
- botão `Ir para pacientes` abre tab `patients`, mas também grava `selectedPatientId = "patients"`

Documentação acima reflete comportamento real implementado, não intenção aparente do label.

---

## 10. Permissões e visibilidade

## 10.1 Capability base

Capability relacionada: `dashboard.read`.

### 10.2 Regras de visibilidade do menu

`buildNavItems(user, canManageUser)` define:

| Perfil / condição | Comportamento real |
|---|---|
| `gestor` não admin | menu especial; não mostra item `dashboard`; fluxo prioriza `gestor` |
| `receptionist` não admin | retorna lista vazia; app dedicado fora do shell |
| `pharmacist` / `pharmacy_tech` não admin | item `dashboard` bloqueado por `!isPharmacist(user)` |
| demais perfis com `canReadDashboard` | item `Painel` exibido |
| `break_glass_admin` | item exibido |

### 10.3 Roles permitidas/bloqueadas na prática

| Role | Situação prática no código |
|---|---|
| `nurse_manager` | acessa |
| `doctor` | acessa |
| `dentist` | acessa |
| `acs` | acessa |
| `nursing_tech` | acessa |
| `gestor` | capability existe, mas fluxo padrão e menu priorizam `gestor`, não `Painel` |
| `pharmacist` | capability existe no RBAC, mas menu bloqueia Painel |
| `pharmacy_tech` | capability existe no RBAC, mas menu bloqueia Painel |
| `receptionist` | capability existe no RBAC, mas interface real é `ReceptionistApp` |
| `developer_readonly` | acessa se shell principal for carregado |
| `support_operator` | acessa se shell principal for carregado |
| `qa_operator` | acessa se shell principal for carregado |
| `security_auditor` | acessa |
| `break_glass_admin` | acessa |
| `support_admin` | bloqueado por redirecionamento para `PlatformConsolePage` |

---

## 11. Estados da página

| Estado | Evidência | Comportamento |
|---|---|---|
| loading da tab | `Suspense fallback` em `TabContent.jsx` | mostra `<div className="loading-spinner" aria-label="Carregando..." />` |
| erro global de carregamento | `error && tab !== "ai"` em `TabContent.jsx` | banner `error error-banner` com botão de fechar |
| sem alertas | `alerts.length === 0` | seção `Alertas proativos` não renderiza |
| sem pacientes críticos | `!critical.length` | mostra `Nenhum paciente com protocolo crítico.` |
| sem membros de equipe | `!users.length` | mostra `Nenhum membro na equipe.` |
| sem dados de demanda | `dmPct === null` | mostra `—`, badge `Sem dados`, rodapé `Nenhum atendimento registrado.` |
| sessão expirada | via `useIdleTimeout` / refresh 401 | modal global `SessionTimeoutModal` ou erro de sessão |
| offline | `OfflineBanner` em `App.jsx` | banner global, não específico do Painel |

---

## 12. Auditoria

## 12.1 Evento identificado

| Evento | Origem | Entidade | Quando |
|---|---|---|---|
| `admin.bootstrap_read` | `backend/src/routes/admin.js` | `bootstrap` | cada `GET /bootstrap` bem-sucedido |

### 12.2 Payload auditado

Evento `admin.bootstrap_read` registra:

- `teamId`
- `patientCount`
- `userCount`
- `taskCount`
- `requestMeta` do ator via `buildAdminAuditActor(req)`

### 12.3 Sem auditoria específica de clique local

Não há emissão de evento dedicada para:

- clique em KPI
- clique em alerta
- clique em paciente prioritário
- clique em botões do header

---

## 13. Dependências técnicas

| Tipo | Item |
|---|---|
| frontend | `frontend-react/src/pages/Dashboard.jsx` |
| navegação | `frontend-react/src/components/TabContent.jsx`, `frontend-react/src/config/nav.jsx`, `frontend-react/src/components/layout/Sidebar.jsx` |
| hooks | `useBootstrap`, `useAgenda`, `usePharmacy`, `useAuth` |
| backend | `GET /bootstrap`, `GET /patients/protocol-summaries`, `GET /agenda`, `GET /pharmacy/stock` |
| utilitários | `buildProactiveAlerts`, `protocolChip`, `catLabel`, `roleLabel` |
| estilos | `frontend-react/src/styles/05-patterns/dashboard.css` |

Sem feature flag específica localizada no código da página.

---

## 14. Critérios de aceite baseados no código

### Cenário 1 — carregamento da tab
**Dado** usuário autenticado no shell principal  
**Quando** `tab === "dashboard"`  
**Então** `Dashboard.jsx` deve ser renderizado dentro de `TabContent`

### Cenário 2 — KPIs básicos
**Dado** resposta válida de `GET /bootstrap`  
**Quando** o Painel carregar  
**Então** a tela deve exibir 4 KPIs com base em `patients`, `users` e `protocolByPatient`

### Cenário 3 — demanda programada visível só para enfermeira gestora
**Dado** usuário com `role === "nurse_manager"`  
**Quando** o Painel carregar  
**Então** o card `Demanda programada` deve ser renderizado

### Cenário 4 — demanda programada oculta para outros perfis
**Dado** usuário com role diferente de `nurse_manager`  
**Quando** o Painel carregar  
**Então** o card `Demanda programada` não deve ser renderizado

### Cenário 5 — alerta sem paciente não navega
**Dado** alerta de estoque ou agenda sem `patientId`  
**Quando** a seção de alertas for exibida  
**Então** o botão correspondente deve estar desabilitado

### Cenário 6 — clique em paciente prioritário
**Dado** paciente crítico listado em `Pacientes prioritários`  
**Quando** usuário clicar item da lista  
**Então** a aplicação deve trocar para tab `patients` e definir `selectedPatientId` com `p.id`

### Cenário 7 — vazio de críticos
**Dado** nenhum paciente com `protocolChip(...).tone === "danger"`  
**Quando** o Painel carregar  
**Então** deve exibir `Nenhum paciente com protocolo crítico.`

### Cenário 8 — erro global de bootstrap
**Dado** falha não recuperada em `useBootstrap.loadAll()`  
**Quando** `setError(...)` for acionado  
**Então** `TabContent` deve mostrar banner `error-banner`

### Cenário 9 — menu por perfil
**Dado** usuário `receptionist` sem privilégios admin  
**Quando** autenticar  
**Então** não deve acessar Painel via shell principal e sim `ReceptionistApp`

### Cenário 10 — auditoria de leitura
**Dado** chamada bem-sucedida de `GET /bootstrap`  
**Quando** backend responder  
**Então** deve registrar evento `admin.bootstrap_read`

---

## 15. Cenários de teste

| ID | Tipo | Cenário | Resultado esperado |
|---|---|---|---|
| CT-PAINEL-01 | sucesso | abrir tab `dashboard` com bootstrap completo | KPIs, listas e header carregam |
| CT-PAINEL-02 | sucesso | usuário `nurse_manager` com `demandMonthly` válido | card de demanda aparece com badge correto |
| CT-PAINEL-03 | sucesso | alerta `protocol` com `patientId` | clique leva para tab `patients` |
| CT-PAINEL-04 | erro | `GET /bootstrap` retorna erro final | banner global de erro aparece |
| CT-PAINEL-05 | erro | `GET /agenda` falha silenciosamente no hook | painel segue sem alertas de agenda, sem crash local identificado |
| CT-PAINEL-06 | permissão | login como `receptionist` | shell principal não abre Painel |
| CT-PAINEL-07 | permissão | login como `support_admin` | usuário vai para `PlatformConsolePage` |
| CT-PAINEL-08 | navegação | clicar `Abrir gestão à vista` | comportamento real atual: abre tab `patients` com `selectedPatientId = "gestor"` |
| CT-PAINEL-09 | navegação | clicar `Ir para pacientes` | comportamento real atual: abre tab `patients` com `selectedPatientId = "patients"` |
| CT-PAINEL-10 | validação implícita | alerta sem `patientId` | botão desabilitado |
| CT-PAINEL-11 | vazio | sem usuários em `users` | card `Equipe ativa` mostra mensagem de vazio |
| CT-PAINEL-12 | vazio | `demandMonthly.totals.total === 0` | percentual `—` e mensagem `Nenhum atendimento registrado.` |

---

## 16. Gaps observados no comportamento real

Itens abaixo **não são invenção**; são divergências entre label/intenção aparente e implementação atual.

| ID | Evidência | Impacto |
|---|---|---|
| GAP-01 | `onNavigate` do `Dashboard` recebe `navigatePatient`, não função genérica de tab | botões do header não cumprem label atual |
| GAP-02 | `allUsers` é prop recebida em `Dashboard` mas não usada | presença online carregada não aparece no Painel |
| GAP-03 | `dataQuality` é calculado no backend bootstrap mas não é retornado/consumido visualmente no Painel | dado disponível sem uso local |
| GAP-04 | `Consulta hoje` gera alerta sem `patientId` | alerta operacional sem navegação direta |
| GAP-05 | `dashboard.read` existe para farmacêuticos e recepção no RBAC, mas UX real bloqueia ou desvia esses perfis | desalinhamento entre capability e experiência final |

