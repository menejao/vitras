# Painel

> **Produto:** VITRAS  
> **Tipo de documento:** Especificação Funcional de Tela  
> **Módulo:** Dashboard / Visão Operacional da Unidade  
> **Tab/Rota:** `dashboard`  
> **Status do escopo:** Aprovado para refinamento técnico  
> **Última atualização:** 27/05/2026  
> **Base de código analisada:** `frontend-react/src/pages/Dashboard.jsx`, `frontend-react/src/hooks/useBootstrap.js`, `frontend-react/src/utils/clinical.js`, `backend/src/routes/admin.js`

---

## 1. Objetivo da Tela

### Qual problema resolve
- Consolidar visão operacional da UBS em uma única tela de entrada.
- Reduzir navegação entre módulos para identificar pacientes críticos, alertas e estado geral da equipe.
- Transformar dados dispersos de pacientes, protocolos, agenda e farmácia em briefing operacional rápido.
- Ajudar coordenação clínica a agir antes que atraso de protocolo, consulta do dia ou ruptura de estoque virem incidente.

### Setor que usa
- Enfermagem gestora
- Médico
- Dentista
- Técnico de enfermagem
- ACS
- Farmácia
- Gestão
- Perfis de suporte somente leitura, quando autorizados

### Impacto operacional
- Redução de tempo de briefing de abertura de turno.
- Priorização de pacientes em risco sem exigir busca manual.
- Visibilidade imediata de cobertura assistencial e gargalos.
- Apoio à meta de demanda programada para coordenação de equipe.

### Contexto UBS
- Tela é ponto de entrada padrão para quase todos usuários autenticados.
- Exceções:
  - `receptionist` entra em app dedicada de recepção
  - `gestor` é redirecionado para tab `gestor`, não necessariamente usa `dashboard` como landing
- Dados são carregados majoritariamente por bootstrap de sessão, reduzindo round-trips na navegação inicial.

---

## 2. Perfis com Acesso

| Perfil | Acesso | Escopo | Restrições | Observações |
|---|---|---|---|---|
| `nurse_manager` | leitura | própria equipe/unidade conforme bootstrap | sem escrita direta no painel | vê card de demanda programada |
| `doctor` | leitura | própria equipe/unidade | sem escrita direta no painel | pode navegar para pacientes/gestão |
| `dentist` | leitura | própria equipe/unidade | sem escrita direta no painel | sem card exclusivo de demanda |
| `gestor` | leitura | unidade | fluxo principal tende a abrir `gestor`, não `dashboard` | capability existe |
| `acs` | leitura | escopo restrito de pacientes permitido | não acessa pacientes fora do escopo | visão operacional resumida |
| `nursing_tech` | leitura | própria equipe/unidade | sem escrita direta no painel | usa painel como radar do turno |
| `pharmacist` | leitura | própria equipe/unidade | sem escrita no painel | alertas de estoque podem aparecer |
| `pharmacy_tech` | leitura | própria equipe/unidade | sem escrita no painel | alertas de estoque podem aparecer |
| `receptionist` | capability existe, mas fluxo real usa `ReceptionistApp` | n/a na UI principal | não usa painel principal no fluxo padrão | importante para alinhamento produto/código |
| `developer_readonly` | leitura | escopo permitido pelo backend | sem escrita | uso suporte |
| `support_operator` | leitura | escopo permitido pelo backend | sem escrita | uso suporte |
| `qa_operator` | leitura | escopo permitido pelo backend | sem escrita | uso QA |
| `security_auditor` | leitura | escopo permitido | sem escrita operacional | uso excepcional |
| `break_glass_admin` | leitura | global temporário | sessão elevada auditada | uso excepcional |

### Capabilities e guards esperados
- Capability base: `dashboard.read`
- Dados usados no painel respeitam escopo do bootstrap:
  - pacientes via `getAllowedPatients()`
  - usuários filtrados por escopo de leitura do perfil
- Navegação para entidades sensíveis deve continuar sujeita às permissões do módulo de destino

---

## 3. Fluxo Principal do Usuário

1. Usuário autenticado entra no sistema.
2. Frontend executa `bootstrap(token)`.
3. Backend retorna contexto mínimo operacional:
   - `user`
   - `patients`
   - `users`
   - `tasks`
   - `protocolTemplates`
   - `demandMonthly` quando perfil é `nurse_manager` ou `doctor`
   - `dataQuality` quando perfil é `nurse_manager` ou `doctor`
4. Frontend busca resumos de protocolo por paciente e monta `protocolByPatient`.
5. Dashboard renderiza KPIs principais:
   - pacientes ativos
   - pacientes com ACS definido
   - protocolos críticos/atenção/em dia
   - profissionais da equipe
6. Se perfil atual for `nurse_manager`, tela exibe card executivo de demanda programada.
7. Sistema calcula alertas proativos com base em:
   - gravidez com DPP ultrapassada
   - protocolos críticos
   - estoque de farmácia zerado ou baixo
   - consultas agendadas para hoje
8. Usuário consulta lista de pacientes prioritários.
9. Usuário clica em alerta ou paciente prioritário para navegar ao contexto detalhado.
10. Usuário pode usar ações rápidas:
    - `Abrir gestão à vista`
    - `Ir para pacientes`

### Comportamento esperado
- Painel deve ser compreensível em até 5 segundos.
- Conteúdo crítico deve aparecer antes de blocos secundários.
- Ações rápidas devem reduzir mudança manual de módulo.
- Painel não deve exigir escrita para entregar valor operacional.

---

## 4. Fluxos Alternativos

### 4.1 Bootstrap falha
- Se `bootstrap` falhar, sistema deve exibir erro claro e impedir falsa leitura do estado operacional.
- Frontend pode usar fallback parcial para alguns dados, mas painel não deve mascarar ausência de contexto.

### 4.2 Sem dados de demanda mensal
- Se `demandMonthly` vier `null`, card executivo deve mostrar:
  - valor `—`
  - estado `Sem dados`
  - explicação `Nenhum atendimento registrado.`
- Fluxo não deve quebrar.

### 4.3 Sem pacientes críticos
- Lista de prioritários mostra estado vazio explícito: `Nenhum paciente com protocolo crítico`.

### 4.4 Sem alertas proativos
- Se `alerts.length === 0`, seção de alertas não deve renderizar.
- Ausência deve significar ausência de alertas relevantes, não erro de carregamento.

### 4.5 Agenda/farmácia vazias
- Alertas derivados dessas fontes simplesmente não aparecem.
- Painel segue funcional com outras fontes.

### 4.6 Sessão expirada
- Nova carga do painel deve falhar em autenticação.
- Usuário deve ser redirecionado para novo login conforme fluxo global.

### 4.7 Permissão insuficiente no destino
- Usuário pode ver resumo no painel, mas ao navegar para outro módulo, módulo de destino ainda valida capability própria.
- Exemplo: ver alerta não garante acesso irrestrito ao detalhe clínico.

### 4.8 Dados inconsistentes
- Se `protocolByPatient` não contiver algum paciente, `protocolChip` deve retornar fallback seguro.
- KPIs e listas não devem quebrar por ausência de resumo pontual.

### 4.9 Degraded mode / backend parcial
- Se backend estiver degradado, painel pode carregar visão parcial.
- UI deve comunicar indisponibilidade ou desatualização quando houver impacto visível.

### 4.10 Offline parcial
- Sem rede, painel não deve simular atualização.
- Último contexto pode permanecer visível, mas usuário precisa feedback de desconexão.

---

## 5. Componentes da Tela

| Componente | Tipo | Obrigatório | Comportamento | Observações |
|---|---|---|---|---|
| `PageHeader` | cabeçalho | Sim | mostra título, subtítulo e ações rápidas | contexto institucional |
| KPIs | cards | Sim | exibem contagens operacionais principais | leitura imediata |
| Card de demanda programada | card executivo | Condicional | só para `nurse_manager` | usa badge + medidor |
| Seção de alertas proativos | grid de cards | Condicional | mostra alertas priorizados | clicável quando possui `patientId` |
| Lista de pacientes prioritários | lista interativa | Sim | destaca até 6 pacientes críticos | navega para detalhe |
| Lista de equipe ativa | lista | Sim | mostra até 6 usuários da equipe | leitura contextual |
| `Chip` / `Badge` | feedback visual | Sim | sinalizam tom, risco e status | não depender só de cor |
| Botões de navegação | ações | Sim | levam para `gestor` e `patients` | atalhos principais |

---

## 6. Campos

| Campo | Tipo | Obrigatório | Validação | Máscara | Origem | Observações |
|---|---|---|---|---|---|---|
| `patients.length` | número derivado | Sim | inteiro >= 0 | n/a | bootstrap | pacientes ativos no escopo |
| `assignedAcsId` | referência | Condicional | vínculo válido | n/a | pacientes | usado para KPI de ACS definido |
| `protocolByPatient` | mapa | Sim | resumo por `patientId` | n/a | API + cálculo | base de criticidade |
| `demandMonthly.totals.total` | número | Condicional | inteiro >= 0 | n/a | bootstrap | só para perfis autorizados |
| `demandMonthly.totals.scheduled` | número | Condicional | inteiro >= 0 | n/a | bootstrap | compõe percentual |
| `demandMonthly.totals.spontaneous` | número | Condicional | inteiro >= 0 | n/a | bootstrap | compõe percentual |
| `agenda[].date` | data | Condicional | data válida | n/a | agenda | usada em alertas do dia |
| `pharmacyStock[].qty` | número | Condicional | inteiro >= 0 | n/a | farmácia | usada em alertas de estoque |
| `pharmacyStock[].minQty` | número | Condicional | inteiro >= 0 | n/a | farmácia | compara risco de estoque |
| `currentUser.role` | enum | Sim | role válida | n/a | sessão | altera renderização |
| `patient.name` | texto | Sim | string existente | parcial no restante do sistema | bootstrap | exibido em listas e alertas |

### Observações de LGPD
- Painel evita exibir CPF/CNS completos.
- Priorização usa contexto clínico/operacional resumido, não histórico completo.
- Navegação para detalhe sensível deve respeitar política do módulo de destino.

---

## 7. Regras de Negócio

**RN-DASH-001**  
**Descrição:** Todo usuário com `dashboard.read` pode acessar visão geral do painel.  
**Impacto:** Tela de entrada ampla para operação.  
**Exceção:** `receptionist` possui capability, mas fluxo real abre `ReceptionistApp`.

**RN-DASH-002**  
**Descrição:** Dados do painel devem respeitar escopo do usuário definido no bootstrap.  
**Impacto:** KPIs, listas e alertas não podem expor dados fora da equipe/unidade/escopo.  
**Exceção:** Sessão `break_glass` ativa e auditada.

**RN-DASH-003**  
**Descrição:** Card de demanda programada só deve aparecer para `nurse_manager`.  
**Impacto:** Customização por perfil e foco operacional.  
**Exceção:** Nenhuma no frontend atual.

**RN-DASH-004**  
**Descrição:** `demandMonthly` só vem do backend quando usuário é `nurse_manager` ou `doctor`.  
**Impacto:** Backoffice e UI precisam suportar ausência do dado.  
**Exceção:** Nenhuma.

**RN-DASH-005**  
**Descrição:** Criticidade de protocolo deve ser calculada por `protocolChip(protocolByPatient[patientId])`.  
**Impacto:** KPIs e lista de pacientes prioritários derivam da mesma regra.  
**Exceção:** Paciente sem resumo usa fallback seguro.

**RN-DASH-006**  
**Descrição:** Alertas proativos devem combinar, no mínimo, gestação em atraso, protocolo crítico, estoque crítico e consultas do dia.  
**Impacto:** Painel atua como radar institucional.  
**Exceção:** Alertas não aparecem quando não houver dado correspondente.

**RN-DASH-007**  
**Descrição:** Pacientes prioritários exibem no máximo 6 registros críticos.  
**Impacto:** Preserva leitura rápida.  
**Exceção:** Nenhuma.

**RN-DASH-008**  
**Descrição:** Alertas clicáveis devem navegar para detalhe apenas quando existir `patientId`.  
**Impacto:** Evita ação quebrada para alertas de estoque ou agenda sem detalhe direto.  
**Exceção:** Nenhuma.

**RN-DASH-009**  
**Descrição:** Percentual de demanda programada deve ser classificado como:
- `Na meta` entre 50% e 70%
- `Abaixo da meta` abaixo de 50%
- `Acima da meta` acima de 70%
- `Sem dados` quando total = 0 ou ausente  
**Impacto:** suporte a coordenação e meta operacional PNAB.  
**Exceção:** Nenhuma.

**RN-DASH-010**  
**Descrição:** Ausência de alertas ou criticidade não deve ser tratada como erro.  
**Impacto:** estados vazios corretos e confiáveis.  
**Exceção:** Nenhuma.

**RN-DASH-011**  
**Descrição:** Acesso a destino sensível após clique no painel continua condicionado à permissão do módulo de destino.  
**Impacto:** painel não pode virar bypass de segurança.  
**Exceção:** Nenhuma.

**RN-DASH-012**  
**Descrição:** Leitura do painel deve gerar rastreabilidade mínima de bootstrap no backend.  
**Impacto:** auditoria de carregamento institucional.  
**Exceção:** nenhuma.

---

## 8. Auditoria e Logs

### O que precisa ser auditado
- leitura de bootstrap do painel
- navegação para detalhe de paciente a partir do painel, quando aplicável via módulo seguinte
- uso de sessão `break_glass`
- eventuais acessos cross-team refletidos em módulos subsequentes

### Eventos reais identificados
- `admin.bootstrap_read`

### Eventos recomendados para evolução
- `dashboard.alert_clicked`
- `dashboard.patient_priority_opened`
- `dashboard.quick_action_triggered`

### Dados proibidos em logs
- CPF completo
- CNS completo
- endereço completo
- texto clínico detalhado desnecessário
- tokens/cookies/TOTP

---

## 9. Integrações

| Sistema | Objetivo | Tipo | Dados trafegados | Observações |
|---|---|---|---|---|
| `GET /bootstrap` | carregar contexto inicial do painel | REST | usuário, pacientes, usuários, tarefas, templates, demanda, qualidade | principal integração |
| `getProtocolSummaries()` | gerar mapa de protocolos | REST | summaries por paciente | base de criticidade |
| Agenda | alertas do dia | contexto de bootstrap/estado | consultas agendadas | usada em `buildProactiveAlerts` |
| Farmácia | alertas de estoque | contexto de bootstrap/estado | `qty`, `minQty`, nome do item | usada em `buildProactiveAlerts` |
| Presença de usuários | contexto da equipe | API interna | status online e dados de equipe | lista de equipe ativa depende de usuários carregados |

---

## 10. Estados da Tela

### Loading
- Tela depende de bootstrap inicial.
- Deve mostrar carregamento global antes de renderizar visão operacional confiável.

### Vazio
- Pacientes prioritários: mensagem explícita quando não houver críticos.
- Alertas: seção pode nem aparecer se não houver conteúdo.
- Demanda: estado `Sem dados` sem quebrar card.

### Erro
- Falha de bootstrap ou de resumo de protocolos deve ser comunicada claramente.
- Não mostrar números parciais como se fossem oficiais sem aviso.

### Sucesso
- KPIs, alertas e listas refletem contexto carregado da sessão.

### Degraded
- Quando backend estiver degradado, painel pode carregar parcialmente.
- Usuário deve entender limitação operacional.

### Sem permissão
- Usuário sem `dashboard.read` não deve acessar a tela.

### Sessão expirada
- Reautenticar antes de novo carregamento.

### Offline parcial
- Exibir banner de desconexão.
- Evitar impressão de atualização em tempo real.

---

## 11. Critérios de Aceite

### Cenário 1 — Carregamento padrão do painel
**Dado** que usuário autenticado possui `dashboard.read`  
**Quando** acessa sistema  
**Então** o painel deve carregar KPIs, listas e ações rápidas compatíveis com seu escopo  
**E** backend deve registrar `admin.bootstrap_read`

### Cenário 2 — Card de demanda para enfermeira gestora
**Dado** que usuária é `nurse_manager`  
**Quando** painel renderiza  
**Então** card de demanda programada deve aparecer  
**E** classificar percentual conforme faixa operacional definida

### Cenário 3 — Ausência de demanda registrada
**Dado** que `demandMonthly.total = 0` ou nulo  
**Quando** painel renderiza card executivo  
**Então** deve exibir `Sem dados`  
**E** não quebrar layout nem cálculo

### Cenário 4 — Paciente crítico no protocolo
**Dado** que paciente possui resumo com `protocolChip(...).tone = danger`  
**Quando** painel renderiza lista prioritária  
**Então** paciente deve aparecer entre prioritários  
**E** clique deve permitir navegação ao detalhe permitido

### Cenário 5 — Sem pacientes críticos
**Dado** que nenhum paciente está crítico  
**Quando** painel renderiza  
**Então** lista prioritária deve mostrar estado vazio claro  
**E** não aparentar erro de integração

### Cenário 6 — Alerta de estoque baixo
**Dado** que item da farmácia possui `qty <= minQty`  
**Quando** alertas proativos são calculados  
**Então** painel deve exibir alerta correspondente  
**E** alerta sem `patientId` não deve oferecer navegação inválida

### Cenário 7 — Consultas do dia
**Dado** que existem agendas `scheduled` para data atual  
**Quando** painel renderiza alertas  
**Então** deve apresentar avisos de `Consulta hoje`

### Cenário 8 — Multi-tenant e escopo
**Dado** que usuário possui escopo restrito  
**Quando** bootstrap retorna pacientes e usuários  
**Então** painel deve refletir somente dados autorizados  
**E** não expor paciente fora do escopo

### Cenário 9 — Receptionist no fluxo real
**Dado** que usuário é `receptionist`  
**Quando** autentica no app  
**Então** sistema deve abrir `ReceptionistApp`  
**E** não usar painel principal como fluxo padrão

### Cenário 10 — Sessão break glass
**Dado** que `break_glass_admin` está em sessão elevada  
**Quando** acessa painel  
**Então** leitura deve respeitar escopo elevado temporário  
**E** uso deve permanecer auditável

---

## 12. Riscos Operacionais

### Riscos humanos
- coordenação confiar em painel desatualizado sem perceber falha de carga
- interpretação incorreta de ausência de alertas como “tudo certo”

### Riscos técnicos
- bootstrap concentra muitas responsabilidades em uma chamada
- falha em summaries pode distorcer criticidade do painel
- dados de agenda/farmácia podem não estar sincronizados no mesmo instante

### Riscos clínicos
- atraso de protocolo não identificado por summary inconsistente
- equipe deixar de agir por excesso ou falta de alertas

### Riscos LGPD
- painel ampliar superfície de leitura de dados sensíveis se resumo crescer demais
- navegação para detalhe sem guardas adequados no destino

### Riscos de dados
- números do KPI não refletirem realidade por carga parcial
- diferença entre `dashboard` e `gestor` gerar leituras divergentes do mesmo cenário

### Riscos de treinamento
- usuário não entender diferença entre `Painel` e `Gestão à vista`
- usuário confundir alerta informativo com urgência clínica

---

## 13. Métricas e Observabilidade

### Métricas de produto/operação
- tempo até primeira ação a partir do painel
- taxa de clique em alertas proativos
- taxa de clique em pacientes prioritários
- percentual de sessões que usam `Abrir gestão à vista`
- percentual de sessões com demanda na meta

### Métricas técnicas
- latência de `GET /bootstrap`
- latência de `getProtocolSummaries`
- taxa de falha do bootstrap
- taxa de painel com `Sem dados`

### Alertas
- aumento de falha em `admin.bootstrap_read`
- tempo elevado de bootstrap
- crescimento anormal de protocolos críticos
- crescimento anormal de alertas de estoque zerado

### Logs necessários
- requestId do bootstrap
- actorId
- contagem de pacientes, usuários e tarefas retornadas
- modo break glass/impersonation quando aplicável

---

## 14. Dependências Técnicas

### Endpoints reais
- `GET /bootstrap`
- `getProtocolSummaries(patientIds)`

### Hooks / componentes
- `useBootstrap`
- `Dashboard`
- `PageLayout`
- `PageHeader`
- `KPI`
- `Card`
- `Chip`
- `Badge`
- `Avatar`
- `Button`

### Permissões
- `dashboard.read`
- permissões herdadas dos módulos de destino

### Feature flags
- nenhuma específica identificada para painel

### Migrations
- nenhuma específica do painel

### Seeds / dados de homologação
- pacientes com múltiplos resumos de protocolo
- farmácia com item zerado e item em estoque baixo
- agenda com consulta marcada para hoje
- equipe com perfis variados
- cenário com e sem `demandMonthly`

### Infraestrutura
- autenticação e CSRF válidos
- bootstrap do backend
- resumos de protocolo disponíveis
- agenda e farmácia carregadas no contexto do app

---

## 15. Considerações UX Operacionais

### Comportamento esperado na UBS
- painel deve funcionar como radar do turno
- leitura deve ser rápida, densa e institucional

### Redução de cliques
- ações rápidas devem levar direto ao módulo relevante
- clique em paciente/alerta deve reduzir busca manual

### Velocidade operacional
- bootstrap deve entregar contexto suficiente para abrir turno sem espera excessiva
- painel não deve exigir consulta manual a relatórios para responder “o que precisa de atenção agora?”

### Acessibilidade
- chips e badges precisam combinar cor + texto
- listas clicáveis devem ser claras também por teclado

### Prevenção de erro humano
- distinção visual entre `Crítico`, `Atenção`, `Em dia`, `Sem dados`
- alertas proativos devem priorizar relevância real e evitar ruído excessivo

### Mobile / responsividade operacional
- KPIs e listas precisam se reorganizar sem esconder conteúdo crítico
- leitura mínima viável em tablets de uso institucional

---

## 16. Gaps Identificados

- `allUsers` é passado ao componente, mas não é usado no `Dashboard` atual.
- `dataQuality` é retornado no bootstrap, mas não é explorado no painel atual.
- `receptionist` possui `dashboard.read` em RBAC, mas fluxo real ignora painel principal.
- painel depende de `getProtocolSummaries` extra após bootstrap; oportunidade de consolidação.
- alertas de estoque e agenda não possuem sempre destino navegável direto.

---

## 17. Melhorias Recomendadas

- incorporar `dataQuality` no painel para visão mais completa da unidade
- explicitar timestamp de última carga no painel
- mostrar badge de degradado/desatualizado quando bootstrap parcial ocorrer
- revisar necessidade de `dashboard.read` para `receptionist`
- consolidar summaries de protocolo no próprio bootstrap para reduzir round-trip
- permitir drill-down estruturado por tipo de alerta

