# Fila / Recepção

> **Produto:** VITRAS  
> **Tipo de documento:** Especificação Funcional de Tela  
> **Módulo:** Recepção / Fila de Atendimento / Triagem inicial / Agenda operacional do dia  
> **Tab/Rota:** `queue` no shell principal + app dedicada `ReceptionistApp` para `receptionist`  
> **Status do escopo:** Aprovado para refinamento técnico  
> **Última atualização:** 27/05/2026  
> **Base de código analisada:** `frontend-react/src/pages/QueuePage.jsx`, `frontend-react/src/pages/ReceptionistApp.jsx`, `frontend-react/src/hooks/useQueue.js`, `backend/src/routes/queue.js`, `backend/src/schemas.js`

---

## 1. Objetivo da Tela

### Qual problema resolve
- Centraliza chegada de pacientes do dia em fluxo único, ordenado e auditável.
- Reduz uso informal de papel, memória da recepção e recados verbais entre recepção, triagem e assistência.
- Diminui erro operacional de chamar paciente fora de prioridade clínica ou social.
- Dá visibilidade imediata de espera, atendimento em curso e volume diário.

### Setor que usa
- Recepção
- Técnico de enfermagem
- Enfermagem gestora
- Apoio operacional da UBS

### Impacto operacional
- Reduz tempo entre chegada e encaminhamento para atendimento.
- Padroniza classificação inicial de prioridade de recepção.
- Evita duplicidade de entrada do mesmo paciente na fila ativa.
- Melhora rastreabilidade de quem colocou, chamou, concluiu ou removeu paciente da fila.
- Suporta convivência entre demanda agendada e espontânea no mesmo fluxo operacional.

### Contexto UBS
- Usada na chegada do paciente à unidade e durante todo turno de atendimento.
- Recepção usa visão simplificada em `ReceptionistApp`; equipe técnica usa `QueuePage` com mais contexto clínico-operacional.
- Fluxo depende de paciente previamente cadastrado ou cadastro rápido durante entrada.
- Fila pertence à equipe do usuário autenticado. Sem `teamId`, acesso deve falhar por segurança.

---

## 2. Perfis com Acesso

| Perfil | Acesso | Escopo | Restrições | Observações |
|---|---|---|---|---|
| `receptionist` | leitura e escrita | própria equipe / própria unidade operacional | sem escrita clínica, sem triagem com sinais vitais, sem cross-team | usa app dedicada de recepção |
| `nursing_tech` | leitura e escrita | própria equipe | pode avançar status e registrar contexto de triagem via fluxo posterior | principal operador de fila clínica |
| `nurse_manager` | sem capability direta de fila no código atual | n/a | não acessa `queue.read/write` hoje | gap de produto/código se desejar acesso futuro |
| `doctor` | sem capability direta de fila no código atual | n/a | sem acesso direto à fila | recebe paciente via agenda/atendimento |
| `gestor` | sem capability direta de fila no código atual | n/a | sem uso operacional da fila | visão indireta via indicadores |
| `acs` | sem acesso | n/a | não atua em balcão/fila da UBS | |
| `pharmacist` | sem acesso | n/a | módulo fora do escopo | |
| `pharmacy_tech` | sem acesso | n/a | módulo fora do escopo | |
| `security_auditor` | sem acesso operacional | n/a | acompanha somente por logs e auditoria | não usa tela para operação |
| `break_glass_admin` | leitura e escrita | global emergencial, sujeito a contexto de sessão | acesso elevado temporário, auditado | uso excepcional |

### Capabilities e guards esperados
- Leitura: `queue.read` ou `queue.write`
- Escrita: `queue.write`
- Filtro de escopo backend: entrada deve ter `entry.teamId === req.user.teamId`
- Paciente só pode entrar na fila se `patient.teamId === req.user.teamId`
- `team.manage` permite atualização/remoção fora da equipe apenas para casos administrativos elevados

### Observação crítica
- Código atual não concede `queue.read/write` para `nurse_manager`, embora negócio pudesse demandar supervisão operacional. Manter como risco/gap até decisão explícita.

---

## 3. Fluxo Principal do Usuário

1. Usuário autenticado acessa módulo de fila.
2. Sistema valida sessão, capability e `teamId`.
3. Frontend carrega fila via `GET /queue` e inicia polling a cada 15 segundos.
4. Usuário visualiza KPIs de `Aguardando`, `Em atendimento` e `Total hoje`.
5. Usuário aciona `Dar entrada`.
6. Usuário busca paciente existente por nome, CPF ou telefone.
7. Se paciente não existir e estiver no shell principal `QueuePage`, usuário pode cadastrar novo paciente e retornar ao fluxo.
8. Sistema sugere prioridade automática conforme categoria do cuidado e idade:
   - `pregnant` → `pregnant`
   - idade >= 60 → `elderly`
   - idade < 12 → `child`
   - demais → `normal`
9. Usuário informa tipo de demanda:
   - `scheduled`
   - `spontaneous`
10. Se demanda for espontânea, usuário define destino:
   - `doctor`
   - `nurse`
11. Usuário informa motivo/queixa principal, quando necessário.
12. Sistema valida duplicidade na fila ativa.
13. Sistema cria entrada com status inicial `waiting`.
14. Fila é reordenada por prioridade e horário de chegada.
15. Operador de fluxo altera status conforme atendimento:
   - `waiting` → `triage`
   - `triage` → `ready`
   - `ready` → `attending`
   - `attending` → `done`
16. Ao fim do turno ou do ciclo, usuário pode limpar concluídos via `POST /queue/clear-done`.

### Comportamento esperado
- Tela deve permitir operação com baixa latência percebida e leitura imediata da fila.
- Lista deve sempre mostrar pacientes não concluídos primeiro.
- Ordem deve respeitar prioridade clínica/social antes da ordem cronológica.
- Remoção da fila não deve apagar registro; deve trocar status para `removed`.

---

## 4. Fluxos Alternativos

### 4.1 Paciente não encontrado
- Em `QueuePage`, operador pode cadastrar paciente novo sem sair do fluxo.
- Em `ReceptionistApp`, fluxo atual não cadastra paciente novo dentro da modal; depende de paciente já existente.
- Se busca não retornar resultados, UI deve informar claramente ausência de cadastro.

### 4.2 Paciente já está na fila ativa
- Backend retorna `409` com mensagem `Paciente já está na fila ativa`.
- Frontend deve impedir nova entrada silenciosa.
- Operador deve localizar entrada existente em vez de duplicar.

### 4.3 Paciente fora da equipe atual
- Backend retorna `403` com mensagem `Paciente fora da equipe atual`.
- Operador não deve conseguir enfileirar paciente de outra equipe.
- Caso operacional legítimo exige fluxo separado e auditado; não usar fila comum.

### 4.4 Entrada da fila não encontrada
- Em `PATCH` ou `DELETE`, backend retorna `404`.
- Frontend deve recarregar fila e informar que item já foi alterado/removido por outro operador.

### 4.5 Sem permissão
- Se usuário não possuir `queue.read/write`, backend retorna `403`.
- Tela não deve oferecer ação escondida por CSS apenas; permissão deve ser efetiva no backend.

### 4.6 Timeout / indisponibilidade da API
- Polling falho não deve travar interface inteira.
- Exibir banner de erro e manter última visão estável quando possível.
- Escrita crítica deve falhar com mensagem clara e exigir nova tentativa explícita.

### 4.7 Concorrência operacional
- Dois operadores podem atualizar mesmo item quase ao mesmo tempo.
- Código atual não usa controle explícito de versão na fila.
- Sistema depende de refresh após mutação e estado final persistido em backend.
- Risco: sobrescrita de campo não status, especialmente `reason`, `priority`, `vitals`, `triage*`.

### 4.8 Sessão expirada
- Qualquer tentativa de criar/editar/remover deve falhar por autenticação.
- Frontend deve redirecionar para novo login conforme estratégia global do app.

### 4.9 Degraded mode
- Se backend estiver degradado mas `ready`, leitura pode continuar disponível.
- Se rate limit/Redis estiver indisponível em produção, política fail-closed pode devolver `503`.
- Tela deve informar indisponibilidade temporária e evitar falsa sensação de persistência.

### 4.10 Offline parcial
- Banner de offline global deve aparecer.
- Polling deve falhar silenciosamente com feedback visível ao usuário.
- Operações de entrada, remoção ou mudança de status devem ficar bloqueadas até reconexão.

### 4.11 Rate limit
- Picos de clique em balcão podem disparar limitação.
- Mensagem deve orientar aguardar alguns instantes e evitar reenvio múltiplo.

### 4.12 Limpeza de concluídos
- Operação não apaga linhas; marca `done` como `cleared`.
- Deve afetar apenas equipe do usuário.
- Deve registrar auditoria com quantidade limpa.

---

## 5. Componentes da Tela

| Componente | Tipo | Obrigatório | Comportamento | Observações |
|---|---|---|---|---|
| `PageHeader` / topo da recepção | cabeçalho | Sim | Exibe contexto da tela e CTA principal | título muda conforme shell |
| KPIs | cards | Sim | mostram `waiting`, `attending`, `total` | atualização por polling |
| Lista da fila | lista ordenada | Sim | renderiza posição, nome, horário, espera, badges e ações | ordenação por prioridade + chegada |
| Modal `Dar entrada` | modal | Sim | cria nova entrada na fila | em `QueuePage` inclui busca avançada |
| Busca de paciente | input/autocomplete/select | Sim | localiza paciente elegível | no app de recepção é `Select`; na página principal é busca livre |
| Cadastro rápido de paciente | formulário modal/passo | Condicional | disponível no `QueuePage` | ausente no app simplificado |
| Botão `Chamar` | ação primária | Condicional | transiciona status | no app simplificado faz `waiting -> attending`; no principal depende de `ready` |
| Botão `Concluir` | ação primária | Condicional | marca `done` | |
| Botão remover | ação destrutiva leve | Condicional | marca `removed` | precisa confirmação futura |
| Botão `Limpar concluídos` | ação coletiva | Condicional | marca itens `done` como `cleared` | somente se houver concluídos |
| Banner de erro | feedback | Sim | mostra falha de API/operação | não some silenciosamente |
| Empty state | estado vazio | Sim | comunica fila vazia | CTA para primeira entrada |

---

## 6. Campos

| Campo | Tipo | Obrigatório | Validação | Máscara | Origem | Observações |
|---|---|---|---|---|---|---|
| `patientId` | referência | Sim | UUID válido, paciente existente, mesma equipe | n/a | usuário/API | obrigatório em criação |
| `patientName` | texto | Automático | derivado do cadastro do paciente | n/a | backend | não digitado manualmente |
| `priority` | enum | Sim | `urgent`, `elderly`, `pregnant`, `child`, `normal` | n/a | usuário/sistema | pode ser inferido automaticamente |
| `reason` | texto curto | Não | até 1000 caracteres | n/a | usuário | queixa principal operacional |
| `demandType` | enum | Não | `scheduled` ou `spontaneous` | n/a | usuário | default normalizado para `scheduled` |
| `destination` | enum | Condicional | `doctor` ou `nurse` | n/a | usuário | obrigatório em demanda espontânea no fluxo UX |
| `agendaRef` | referência | Não | até 100 caracteres | n/a | sistema/API | hoje existe no schema; pouco explorado no frontend |
| `status` | enum | Automático/edição operacional | `waiting`, `triage`, `ready`, `attending`, `done` | n/a | sistema/usuário | `removed` e `cleared` existem no backend, mas fora do patch schema público |
| `arrivedAt` | datetime | Automático | ISO válido | n/a | backend | usado em ordenação e tempo de espera |
| `triageStart` | datetime | Condicional | ISO válido | n/a | sistema/usuário | setado no início da triagem |
| `triageDone` | datetime | Condicional | ISO válido | n/a | sistema/usuário | setado quando vai para `ready` |
| `vitals` | objeto | Condicional | estrutura livre hoje | n/a | usuário/API | risco: schema permissivo demais |

### Campos do cadastro rápido em `QueuePage`

| Campo | Tipo | Obrigatório | Validação | Máscara | Origem | Observações |
|---|---|---|---|---|---|---|
| nome completo | texto | Sim | mínimo 1 caractere | n/a | usuário | base para seleção posterior |
| CPF | texto | Não | formatação + unicidade no backend de pacientes | `000.000.000-00` | usuário | sensível |
| CNS | texto | Não | formatação + unicidade | parcial | usuário | sensível |
| data de nascimento | data | Não | data válida | `dd/mm/aaaa` | usuário | usada na inferência de prioridade |
| telefone | texto | Não | telefone válido | `(99) 99999-9999` | usuário | |
| categoria de cuidado | select | Sim | categoria válida | n/a | usuário | influencia prioridade |
| endereço/CEP/UF | texto | Não | validações básicas | parcial em outros contextos | usuário | dados territoriais |
| alergias/comorbidades/medicações | texto | Não | tamanho suportado | sem log detalhado | usuário | sensíveis; cuidado LGPD |

---

## 7. Regras de Negócio

**RN-QUEUE-001**  
**Descrição:** Somente usuários com `queue.read` ou `queue.write` podem visualizar fila.  
**Impacto:** Controle de acesso de tela e API.  
**Exceção:** Nenhuma.

**RN-QUEUE-002**  
**Descrição:** Somente usuários com `queue.write` podem criar, atualizar, remover ou limpar fila.  
**Impacto:** Ações de mutação bloqueadas para leitura apenas.  
**Exceção:** Nenhuma.

**RN-QUEUE-003**  
**Descrição:** Fila é sempre filtrada por `teamId` do usuário autenticado.  
**Impacto:** Isolamento multi-tenant intraunidade/equipe.  
**Exceção:** `team.manage` em operação administrativa elevada.

**RN-QUEUE-004**  
**Descrição:** Paciente só pode entrar na fila se pertencer à mesma equipe do usuário.  
**Impacto:** Evita mistura de fluxo operacional entre equipes.  
**Exceção:** Não implementada para acesso cross-team comum.

**RN-QUEUE-005**  
**Descrição:** Paciente não pode possuir duas entradas simultâneas na fila ativa.  
**Impacto:** Backend rejeita duplicidade com `409`.  
**Exceção:** Nenhuma.

**RN-QUEUE-006**  
**Descrição:** Ordenação da fila deve obedecer prioridade (`urgent`, `elderly`, `pregnant`, `child`, `normal`) e, em empate, horário de chegada.  
**Impacto:** Lista exibida e percepção operacional.  
**Exceção:** Itens `done` vão para fim da lista.

**RN-QUEUE-007**  
**Descrição:** Status `removed` e `cleared` não devem aparecer em listagem ativa.  
**Impacto:** UX limpa e histórico preservado em backend/auditoria.  
**Exceção:** Nenhuma.

**RN-QUEUE-008**  
**Descrição:** Entrada nova deve começar em `waiting`.  
**Impacto:** Uniformiza começo do fluxo assistencial.  
**Exceção:** Nenhuma.

**RN-QUEUE-009**  
**Descrição:** Ao mudar status para `triage`, sistema preenche `triageBy` e `triageStart` se ausente.  
**Impacto:** Rastreabilidade da triagem.  
**Exceção:** Nenhuma.

**RN-QUEUE-010**  
**Descrição:** Ao mudar status para `ready`, sistema preenche `triageDone` se ausente.  
**Impacto:** Permite medir duração de triagem.  
**Exceção:** Nenhuma.

**RN-QUEUE-011**  
**Descrição:** `demandType` deve ser normalizado para `scheduled` quando valor vier vazio ou inválido.  
**Impacto:** Consistência de métrica de demanda programada vs espontânea.  
**Exceção:** Valores equivalentes a espontânea são mapeados para `spontaneous`.

**RN-QUEUE-012**  
**Descrição:** Para demanda espontânea, destino assistencial deve ser explícito no frontend (`doctor` ou `nurse`).  
**Impacto:** Evita encaminhamento verbal ambíguo.  
**Exceção:** Não se aplica a demanda agendada.

**RN-QUEUE-013**  
**Descrição:** Remoção da fila não exclui fisicamente registro; troca status para `removed`.  
**Impacto:** Rastreabilidade e auditoria preservadas.  
**Exceção:** Nenhuma.

**RN-QUEUE-014**  
**Descrição:** Limpeza de concluídos deve afetar apenas entradas `done` da equipe atual, convertendo-as para `cleared`.  
**Impacto:** Encerramento operacional do turno sem perda de histórico.  
**Exceção:** Nenhuma.

**RN-QUEUE-015**  
**Descrição:** App simplificada da recepção não deve expor ações clínicas além do fluxo operacional de balcão.  
**Impacto:** Proteção de escopo e redução de erro humano.  
**Exceção:** Nenhuma.

**RN-QUEUE-016**  
**Descrição:** Prioridade pode ser inferida automaticamente pelo cadastro do paciente, mas operador pode ajustá-la manualmente.  
**Impacto:** Velocidade operacional com possibilidade de correção contextual.  
**Exceção:** Nenhuma.

**RN-QUEUE-017**  
**Descrição:** Conteúdo de `vitals` é aceito no backend, mas deve ser preenchido apenas por fluxo de triagem autorizado.  
**Impacto:** Evita captura clínica indevida na recepção.  
**Exceção:** Nenhuma.

---

## 8. Auditoria e Logs

### O que precisa ser auditado
- criação de entrada na fila
- atualização de status
- alteração de prioridade
- remoção da fila
- limpeza de concluídos
- tentativa negada por equipe ou permissão
- acesso em sessão `break_glass`

### Eventos reais identificados
- `queue.entry_created`
- `queue.entry_updated`
- `queue.entry_removed`
- `queue.done_cleared`

### Dados auditados mínimos
- `patientId`
- `teamId`
- `before`
- `after`
- `changedFields`
- `actor`
- `createdAt`
- `request context`

### Dados proibidos em logs
- CPF completo
- CNS completo
- telefone completo
- endereço completo
- texto clínico sensível além do mínimo operacional
- tokens/cookies/TOTP

### Ações críticas
- qualquer uso de fila por `break_glass_admin`
- qualquer remoção de paciente da fila
- qualquer limpeza coletiva de concluídos
- qualquer alteração manual de prioridade de urgência

---

## 9. Integrações

| Sistema | Objetivo | Tipo | Dados trafegados | Observações |
|---|---|---|---|---|
| API interna `/queue` | CRUD da fila | REST | paciente, prioridade, motivo, demanda, status | principal integração |
| API interna `/patients` | busca/cadastro rápido de paciente | REST | identificação e dados cadastrais | usada em `QueuePage` |
| API interna `/agenda` | associar chegada a demanda programada | REST | data, hora, profissional, tipo | usada como contexto, não vínculo forte |
| serviço de auditoria | registrar ações | serviço interno | snapshots before/after | obrigatório |
| Redis / rate limit | proteção operacional | infraestrutura | contadores de requisição | fail-closed em produção |
| logs/métricas | observabilidade | log estruturado | erros, duração, abuso | usar `requestId` |

---

## 10. Estados da Tela

### Loading
- `useQueue` carrega lista ao abrir e faz polling a cada 15s.
- Se não houver itens e `loading=true`, mostrar estado de carregamento explícito.

### Vazio
- Mostrar `Nenhum paciente na fila`.
- CTA principal: `Dar entrada` ou `Dar entrada no primeiro paciente`.

### Erro
- Mostrar banner com mensagem operacional clara.
- Não perder completamente contexto visual da tela.

### Sucesso
- Atualizar lista após mutação.
- Fechar modal e limpar formulário quando criação for concluída.

### Degraded
- Exibir indisponibilidade temporária e bloquear escrita se backend não estiver confiável.

### Sem permissão
- Usuário sem `queue.read/write` não deve acessar fluxo operacional.

### Sessão expirada
- Reautenticar antes de nova operação.

### Concorrência
- Se item sumir ou mudar entre ações, recarregar fila e informar operador.

### Offline parcial
- Manter visualização estática mais recente quando possível.
- Bloquear mutações até retorno de conectividade.

---

## 11. Critérios de Aceite

### Cenário 1 — Entrada de paciente agendado
**Dado** que um `receptionist` autenticado possui `queue.write`  
**E** o paciente pertence à mesma equipe  
**Quando** o operador der entrada com `demandType = scheduled`  
**Então** o sistema deve criar entrada com status `waiting`  
**E** ordenar paciente corretamente na fila  
**E** registrar evento `queue.entry_created`

### Cenário 2 — Entrada de demanda espontânea
**Dado** que um operador autorizado selecionou paciente da própria equipe  
**Quando** informar `demandType = spontaneous` e destino `doctor` ou `nurse`  
**Então** o sistema deve salvar destino escolhido  
**E** exibir badge de encaminhamento adequado  
**E** manter rastreabilidade do motivo informado

### Cenário 3 — Bloqueio de duplicidade
**Dado** que o paciente já possui entrada com status `waiting`, `triage`, `ready` ou `attending`  
**Quando** o operador tentar criar nova entrada  
**Então** o backend deve retornar `409`  
**E** a interface deve informar que paciente já está na fila ativa

### Cenário 4 — Isolamento por equipe
**Dado** que o paciente pertence a equipe diferente da equipe do operador  
**Quando** o operador tentar enfileirá-lo  
**Então** o sistema deve negar a operação com `403`  
**E** não criar entrada na fila

### Cenário 5 — Avanço de status para triagem
**Dado** que uma entrada da fila está em `waiting`  
**Quando** operador autorizado atualiza para `triage`  
**Então** o sistema deve registrar `triageBy`  
**E** preencher `triageStart` se estiver vazio  
**E** registrar `queue.entry_updated`

### Cenário 6 — Conclusão do atendimento
**Dado** que uma entrada está em `attending`  
**Quando** operador clicar em `Concluir`  
**Então** o sistema deve mudar status para `done`  
**E** mover item para fim da ordenação ativa  
**E** manter item elegível para `Limpar concluídos`

### Cenário 7 — Limpeza de concluídos
**Dado** que existem itens `done` na equipe atual  
**Quando** operador autorizado acionar `Limpar concluídos`  
**Então** o sistema deve converter tais itens em `cleared`  
**E** removê-los da visualização ativa  
**E** registrar `queue.done_cleared` com quantidade afetada

### Cenário 8 — Remoção de paciente da fila
**Dado** que uma entrada ativa existe  
**Quando** operador autorizado remove entrada  
**Então** o sistema deve marcar status `removed`  
**E** não excluir fisicamente registro  
**E** registrar `queue.entry_removed`

### Cenário 9 — LGPD em busca e exibição
**Dado** que a recepção busca pacientes por nome, CPF ou CNS  
**Quando** resultados forem exibidos  
**Então** o sistema deve exibir somente dados necessários para identificação operacional  
**E** evitar exposição excessiva de dados sensíveis

### Cenário 10 — Falha de API
**Dado** que a API de fila está indisponível  
**Quando** a tela tentar carregar ou salvar  
**Então** deve exibir mensagem clara de erro  
**E** não confirmar persistência inexistente  
**E** permitir nova tentativa após recuperação

### Cenário 11 — Break glass
**Dado** que `break_glass_admin` está em sessão elevada  
**Quando** atuar na fila  
**Então** ações devem ser auditadas com severidade alta  
**E** uso deve ser visível e excepcional

---

## 12. Riscos Operacionais

### Riscos humanos
- recepção chamar paciente errado por nomes parecidos
- recepção deixar paciente duplicado por tentativa repetida
- alteração manual indevida de prioridade sem protocolo local

### Riscos técnicos
- ausência de controle forte de concorrência em `PATCH`
- polling de 15s pode deixar percepção de fila desatualizada por alguns segundos
- schema de `vitals` permissivo demais

### Riscos clínicos
- atalho `waiting -> attending` na app simplificada pode pular triagem quando triagem for obrigatória
- prioridade automática pode não refletir gravidade real da queixa

### Riscos LGPD
- exibição ampla de identificação na recepção em tela compartilhada
- cadastro rápido incluir dados clínicos sensíveis demais para balcão

### Riscos de dados
- cadastro incompleto no fluxo rápido
- divergência entre chegada agendada e agenda real por falta de vínculo forte com `agendaRef`

### Riscos de treinamento
- equipe confundir `remover`, `concluir` e `limpar concluídos`
- recepção usar app simplificada para fluxo clínico que pertence à triagem

---

## 13. Métricas e Observabilidade

### Métricas de produto/operação
- tempo médio entre `arrivedAt` e `attending`
- tempo médio entre `arrivedAt` e `done`
- quantidade diária de pacientes por prioridade
- proporção `scheduled` vs `spontaneous`
- quantidade de removidos da fila
- quantidade de duplicidades bloqueadas

### Métricas técnicas
- latência `GET /queue`
- latência `POST /queue`
- erros `4xx/5xx` do módulo
- volume de polling por sessão
- taxa de `409` em criação

### Alertas
- pico anormal de `409` na fila
- pico de `403` para mesma unidade
- falhas repetidas de `POST /queue`
- crescimento incomum de tempo médio de espera
- alto uso de `break_glass_admin` em recepção

### Logs necessários
- requestId por mutação
- actorId por ação
- teamId e unitId
- status anterior e novo
- contagem de concluídos limpos

---

## 14. Dependências Técnicas

### Endpoints reais
- `GET /queue`
- `POST /queue`
- `PATCH /queue/:id`
- `DELETE /queue/:id`
- `POST /queue/clear-done`
- `POST /patients` no fluxo de cadastro rápido
- `GET /agenda` no fluxo contextual

### Hooks / componentes
- `useQueue`
- `QueuePage`
- `ReceptionistApp`
- `EmptyState`
- `Modal`
- `Input`
- `Select`
- `Button`
- `KPI`

### Permissões
- `queue.read`
- `queue.write`
- `team.manage` para casos administrativos elevados

### Feature flags
- nenhuma específica identificada para fila

### Migrations
- nenhuma específica identificada para fila

### Seeds / dados de homologação
- pacientes de múltiplas categorias: gestante, criança, idoso, geral
- equipes distintas para validar isolamento
- agenda do dia com paciente já marcado
- fila com status variados para smoke test

### Variáveis / infraestrutura
- autenticação e sessão válidas
- PostgreSQL ou file-mode em dev
- Redis/rate limit em produção
- auditoria ativa

---

## 15. Considerações UX Operacionais

### Comportamento esperado na UBS
- recepção precisa registrar chegada em poucos segundos
- lista deve ser legível à distância curta e sob pressão de atendimento
- ações principais devem ficar visíveis sem rolagem excessiva

### Redução de cliques
- sugestão automática de prioridade ajuda operação
- CTA `Dar entrada` sempre visível
- busca de paciente deve reduzir necessidade de navegação entre módulos

### Velocidade operacional
- polling de 15s atende atualização básica, mas pode ser insuficiente em pico
- feedback após criação/atualização deve ser imediato

### Acessibilidade
- badges devem combinar texto + cor
- botões críticos devem ter rótulo explícito
- estados vazios e erros precisam ser legíveis por operador não técnico

### Prevenção de erro humano
- diferenciar visualmente `Aguardando triagem`, `Em triagem`, `Em atendimento`, `Concluído`
- destacar prioridade e tempo de espera
- ideal futuro: confirmação antes de remover entrada

### Mobile / responsividade operacional
- deve funcionar em terminais menores e tablets
- lista precisa preservar nome, prioridade e tempo sem truncar informação crítica

---

## 16. Gaps Identificados

- `nurse_manager` não possui acesso de fila no RBAC atual, embora operação possa demandar.
- `ReceptionistApp` pula status `triage/ready` e chama diretamente `attending`; precisa decisão de produto.
- Controle de concorrência é fraco para mutações simultâneas.
- `vitals` aceita estrutura aberta no backend; falta contrato explícito.
- Falta confirmação de remoção de entrada.
- Cadastro rápido em recepção principal coleta campos clínicos sensíveis demais para alguns cenários de balcão.
- `agendaRef` existe no schema, mas não está bem explorado no fluxo de negócio.

---

## 17. Melhorias Recomendadas

- criar modo explícito `recepção pura` vs `triagem` no fluxo
- adicionar confirmação com motivo para remoção da fila
- incluir lock otimista por `updatedAt`
- reforçar vínculo entre entrada agendada e `agendaRef`
- limitar dados do cadastro rápido conforme papel operacional
- incluir evento de auditoria para tentativa de duplicidade e negação por equipe
- avaliar atualização near-real-time por SSE/WebSocket se volume crescer

