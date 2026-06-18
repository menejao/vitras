# TEMPLATE PADRÃO — ESCOPO FUNCIONAL DE TELA

> **Produto:** VITRAS  
> **Tipo de documento:** Especificação Funcional de Tela  
> **Objetivo:** Padronizar escopo funcional, regras, permissões, integrações, auditoria, observabilidade e critérios de aceite para qualquer tela do sistema  
> **Versão do template:** v1.0  
> **Baseado em:** `VITRAS_Dashboard_Escopo_Funcional.docx`, `docs/ai/system-context.md`, `docs/ai/rbac-matrix.md`, `docs/ai/frontend-pages-map.md`, `docs/lgpd/LGPD_OPERATIONS.md`

---

# [NOME DA TELA]

> **Módulo:** [ex.: Pacientes / Agenda / Fila / Farmácia / Gestão]  
> **Tab/Rota:** [ex.: `patients`, `agenda`, `/activate`]  
> **Perfis principais:** [ex.: nurse_manager, doctor, receptionist]  
> **Status do escopo:** [Rascunho / Em validação / Aprovado para execução]  
> **Última atualização:** [dd/mm/aaaa]  
> **Responsáveis:** [Produto] / [UX] / [Tech Lead] / [QA]

---

## 1. Objetivo da Tela

### Qual problema resolve
- [Descrever dor operacional principal.]
- [Descrever gargalo atual sem tela.]
- [Descrever impacto se tela falhar ou não existir.]

### Setor que usa
- [Recepção / ACS / Enfermagem / Médico / Farmácia / Coordenação / Auditoria / Admin]

### Impacto operacional
- [Descrever redução de tempo.]
- [Descrever redução de erro humano.]
- [Descrever ganho de rastreabilidade.]
- [Descrever impacto em conformidade LGPD/auditoria.]

### Contexto UBS
- [Explicar em que momento do turno/fluxo assistencial a tela é usada.]
- [Indicar se uso é de balcão, consultório, farmácia, visita domiciliar ou gestão.]
- [Indicar dependência de internet, dados sincronizados, fila ou integrações externas.]

---

## 2. Perfis com Acesso

| Perfil | Acesso | Escopo | Restrições | Observações |
|---|---|---|---|---|
| `receptionist` | [nenhum/leitura/escrita] | [própria unidade / própria fila / pacientes vinculados] | [sem acesso clínico, sem LGPD avançado, etc.] | [observações] |
| `acs` | [nenhum/leitura/escrita] | [microárea / equipe] | [não acessa cross-team; somente `visit`, etc.] | [observações] |
| `nursing_tech` | [nenhum/leitura/escrita] | [equipe / unidade] | [sem prescrição, sem gestão de usuários, etc.] | [observações] |
| `nurse_manager` | [nenhum/leitura/escrita] | [equipe / unidade] | [respeitar teamId, unitId e regras clínicas] | [observações] |
| `doctor` | [nenhum/leitura/escrita] | [equipe / unidade / cross-team auditado] | [prescrição permitida; ações sensíveis auditadas] | [observações] |
| `dentist` | [nenhum/leitura/escrita] | [equipe / unidade] | [restrições específicas do módulo] | [observações] |
| `pharmacist` | [nenhum/leitura/escrita] | [farmácia da equipe/unidade] | [sem escrita clínica] | [observações] |
| `pharmacy_tech` | [nenhum/leitura/escrita] | [farmácia da equipe/unidade] | [sem escrita clínica] | [observações] |
| `gestor` | [nenhum/leitura/escrita] | [unidade] | [sem escrita clínica, salvo regra explícita] | [observações] |
| `security_auditor` | [nenhum/leitura/exportação] | [logs, integridade, relatórios] | [sem dados clínicos sem justificativa] | [observações] |
| `break_glass_admin` | [acesso elevado temporário] | [global, multi-tenant controlado] | [sessão temporária, auditoria mandatória, banner de alerta] | [observações] |

### Capabilities e guards esperados
- Mapear capability exata por rota/tela.
- Validar combinação de capability + restrição de escopo (`teamId`, `unitId`, microárea, vínculo do paciente).
- Registrar explicitamente se tela permite acesso cross-team e em quais condições.
- Registrar explicitamente se tela fica disponível em sessão de impersonation ou break glass.

---

## 3. Fluxo Principal do Usuário

1. Usuário acessa tela a partir de [origem].
2. Sistema valida sessão, capability, escopo de unidade/equipe e contexto operacional.
3. Sistema carrega dados iniciais com feedback visível de loading.
4. Usuário aplica filtros/seleciona contexto operacional.
5. Sistema apresenta dados consolidados e ações permitidas para perfil.
6. Usuário executa ação principal.
7. Sistema valida regra de negócio, concorrência, integridade e LGPD.
8. Sistema persiste alteração, emite eventos, atualiza UI e registra auditoria.
9. Sistema exibe confirmação clara de sucesso, parcial ou falha tratável.

### Comportamento esperado
- Tela deve ficar compreensível em até 5 segundos para operador acostumado ao fluxo UBS.
- Ação principal deve exigir menor número de cliques possível sem sacrificar segurança.
- Dados sensíveis devem ser mascarados quando visualização completa não for necessária.
- Operações críticas devem ter confirmação, justificativa ou dupla validação quando aplicável.

---

## 4. Fluxos Alternativos

### 4.1 Erro de carregamento inicial
- Se API falhar, exibir estado de erro com mensagem institucional clara, código amigável e ação de tentar novamente.
- Não exibir stack trace ou detalhe interno.

### 4.2 Timeout de backend / Redis / integração
- Se ocorrer timeout, manter contexto preenchido pelo usuário quando possível.
- Exibir feedback: "Não foi possível concluir agora. Tente novamente em instantes."
- Se timeout impactar auditoria, bloquear conclusão da ação.

### 4.3 Dados inconsistentes
- Se dados retornarem com conflito de versão, status inválido ou vínculo inexistente, bloquear ação e orientar recarregamento.
- Registrar evento de inconsistência para análise operacional.

### 4.4 Permissão insuficiente
- Se usuário não tiver capability, retornar estado `403` com mensagem sem expor regra interna.
- Se capability existir mas escopo falhar, mensagem deve informar que registro não pertence ao contexto autorizado.

### 4.5 Concorrência
- Se dois usuários alterarem mesmo registro, sistema deve detectar `updatedAt`/versão e evitar sobrescrita silenciosa.
- Mensagem deve orientar recarregamento antes de salvar nova tentativa.

### 4.6 Duplicidade
- Para CPF, CNS, agenda, encaminhamento, dispensação ou filas: validar duplicidade antes de persistir.
- Em duplicidade, mostrar o que já existe e oferecer próxima ação segura.

### 4.7 Degraded mode
- Se subsistema estiver degradado, manter apenas operações seguras de leitura ou modo restrito definido para tela.
- Exibir banner institucional com impacto funcional real.

### 4.8 Offline parcial
- Se navegador perder conexão, mostrar banner persistente.
- Bloquear escrita crítica até reconexão.
- Se leitura local ainda existir, deixar claro que dados podem estar desatualizados.

### 4.9 Rate limit
- Ao atingir limite, exibir mensagem objetiva sem linguagem técnica excessiva.
- Sugerir aguardar intervalo e não repetir clique múltiplo.

### 4.10 Sessão expirada
- Exibir modal de expiração com ação para novo login.
- Preservar rascunho local somente se política de segurança permitir.

---

## 5. Componentes da Tela

| Componente | Tipo | Obrigatório | Comportamento | Observações |
|---|---|---|---|---|
| Cabeçalho funcional | bloco de contexto | Sim | Exibe título, escopo atual, status operacional | Sem branding redundante |
| Filtros principais | form controls | Sim | Filtram dataset sem ambiguidade | Persistência de filtros recomendada |
| Tabela/lista/cards | visualização | Sim | Exibe dados primários da tela | Paginação, ordenação, empty state |
| Modal principal | modal | Se aplicável | Criação/edição com validação | Fechamento seguro |
| Drawer lateral | drawer | Se aplicável | Exibe detalhe sem perder contexto | Bom para operação rápida |
| Tabs internas | navegação local | Se aplicável | Segmentam subfluxos da mesma entidade | Não esconder ações críticas |
| Autocomplete | input avançado | Se aplicável | Busca pacientes, usuários, equipes, itens | Debounce, loading, empty state |
| Badge/Chip | feedback visual | Sim | Exibe status, prioridade, protocolo | Nunca depender só de cor |
| Timeline | histórico | Se aplicável | Exibe eventos clínicos ou operacionais | Ordenação cronológica clara |
| Accordion | expansão contextual | Se aplicável | Condensa detalhes secundários | Não esconder risco crítico |
| Toast | feedback transitório | Sim | Sucesso/erro não bloqueante | Não substituir erro crítico |
| Banner institucional | alerta persistente | Se aplicável | Exibe degraded mode, break glass, offline | Alta visibilidade |
| Skeleton loader | loading | Sim | Evita percepção de tela travada | Deve refletir layout real |
| Empty state | estado vazio | Sim | Explica ausência de dados e próximo passo | Não usar texto genérico |

---

## 6. Campos

| Campo | Tipo | Obrigatório | Validação | Máscara | Origem | Observações |
|---|---|---|---|---|---|---|
| [campo] | [texto/select/data/CPF/CNS/etc.] | [Sim/Não/Condicional] | [regras] | [ex.: `999.999.999-99`] | [usuário/API/calculado] | [detalhes] |
| CPF | texto | Condicional | CPF válido, único por paciente ativo | `***.***.***-**` em leitura parcial | cadastro / API | Nunca logar valor completo |
| CNS | texto | Condicional | CNS válido, único quando informado | parcial quando fora de contexto clínico | cadastro / integração | Deduplicação obrigatória |
| Data | data | Condicional | não aceitar data impossível; validar faixas | `dd/mm/aaaa` | usuário | timezone institucional |
| Telefone | texto | Condicional | DDD + número válidos | `(99) 99999-9999` | usuário | mascarar em contextos não clínicos |
| Equipe | select | Geralmente Sim | deve pertencer à unidade do usuário | n/a | API interna | respeitar multi-tenant |
| Unidade | select/read-only | Condicional | deve refletir escopo autorizado | n/a | sessão/API | não permitir troca indevida |
| Motivo/Justificativa | textarea | Condicional | mínimo de caracteres quando ação crítica | n/a | usuário | exigido para ações sensíveis |

### Regras obrigatórias de preenchimento
- Campos sensíveis devem ter mascaramento em visualização e logs.
- Campos derivados não devem poder ser editados manualmente sem permissão explícita.
- Campos de relacionamento devem validar existência, vínculo ativo e escopo.
- Autocomplete deve informar loading, sem resultados e erro.
- Campos críticos devem suportar deduplicação e prevenção de dupla submissão.

---

## 7. Regras de Negócio

### Modelo de registro

**RN-001**  
**Descrição:** [Regra objetiva.]  
**Impacto:** [O que muda na UI, API, fluxo ou dados.]  
**Exceção:** [Quando não se aplica.]

### Regras mínimas que devem ser avaliadas em toda tela

**RN-BASE-001**  
**Descrição:** Usuário só pode visualizar e agir dentro do escopo autorizado por role, capability, `teamId` e `unitId`.  
**Impacto:** Filtragem de dados, bloqueio de ações, visibilidade condicional de componentes.  
**Exceção:** Sessão `break_glass` ativa com auditoria reforçada.

**RN-BASE-002**  
**Descrição:** Ações sensíveis em dados de saúde exigem auditoria completa com ator, contexto, motivo, antes/depois e origem da requisição.  
**Impacto:** Toda mutação relevante deve emitir evento auditável.  
**Exceção:** Nenhuma.

**RN-BASE-003**  
**Descrição:** CPF e CNS devem ser tratados como dados sensíveis e nunca exibidos completos fora de necessidade operacional legítima.  
**Impacto:** Máscara, restrição de logs e controle de exportação.  
**Exceção:** Contexto clínico autorizado com justificativa implícita do fluxo.

**RN-BASE-004**  
**Descrição:** Registro clínico não pode ser fisicamente removido quando política regulatória exigir retenção; usar inativação lógica.  
**Impacto:** Fluxos de exclusão devem virar inativação com justificativa.  
**Exceção:** Somente dados auxiliares não clínicos quando política formal permitir.

**RN-BASE-005**  
**Descrição:** Sistema deve operar em modo fail-closed para componentes críticos de segurança.  
**Impacto:** Redis/rate-limit indisponível em produção pode bloquear operação ao invés de liberar acesso.  
**Exceção:** Nenhuma.

**RN-BASE-006**  
**Descrição:** Acesso cross-team deve ser minimizado e, quando permitido, explicitamente auditado.  
**Impacto:** Geração de evento `cross_team_patient_access` ou equivalente.  
**Exceção:** Sem exceção fora de sessão emergencial autorizada.

**RN-BASE-007**  
**Descrição:** Ação destrutiva ou irreversível deve exigir confirmação e, quando aplicável, justificativa.  
**Impacto:** Modal de confirmação, logging e rastreabilidade.  
**Exceção:** Nenhuma.

**RN-BASE-008**  
**Descrição:** Sessão expirada, token inválido, CSRF inválido ou contexto de autenticação inconsistente devem interromper escrita imediatamente.  
**Impacto:** Redirecionamento para reautenticação e bloqueio seguro.  
**Exceção:** Nenhuma.

### Regras específicas da tela
- RN-[XXX]: [preencher]
- RN-[XXX]: [preencher]
- RN-[XXX]: [preencher]

---

## 8. Auditoria e Logs

### O que precisa ser auditado
- Abertura da tela quando envolver dados sensíveis ou painéis gerenciais críticos.
- Aplicação de filtros com potencial de acesso a dado sensível, quando aplicável.
- Criação, edição, inativação, cancelamento, reativação, exportação e impressão.
- Acesso cross-team.
- Ativação e uso de sessão `break_glass`.
- Tentativa negada por permissão ou escopo.
- Execução em degraded mode de ação parcialmente permitida.

### Eventos sugeridos
- `[modulo].screen_opened`
- `[modulo].filter_applied`
- `[modulo].record_created`
- `[modulo].record_updated`
- `[modulo].record_inactivated`
- `[modulo].record_deleted_blocked`
- `[modulo].export_requested`
- `[modulo].cross_team_access`
- `[modulo].permission_denied`
- `[modulo].concurrency_conflict`
- `[modulo].duplicate_detected`

### Quais ações são críticas
- Qualquer leitura ampliada de paciente fora da equipe.
- Qualquer exportação.
- Qualquer ação com dados LGPD.
- Qualquer ação feita por `break_glass_admin`.
- Qualquer alteração com impacto clínico, fila, agenda, farmácia ou prontuário.

### Quais dados não podem ir para logs
- CPF completo
- CNS completo
- telefone completo
- endereço completo
- conteúdo clínico livre em texto aberto sem necessidade formal
- tokens, segredos, cookies, TOTP, payload criptográfico
- dados de menores em formato identificável fora do evento mínimo necessário

---

## 9. Integrações

| Sistema | Objetivo | Tipo | Dados trafegados | Regras/Observações |
|---|---|---|---|---|
| API interna VITRAS | Carregar e persistir dados da tela | REST | entidades do módulo | autenticação por cookie/token + CSRF |
| Redis / Rate Limit | Proteção operacional | infraestrutura | contadores e janelas | fail-closed em produção |
| Auditoria interna | Rastreabilidade | serviço interno | eventos, before/after, actor, hash chain | obrigatório para mutações |
| SISS | [se aplicável] | integração externa | cadastro / produção assistencial | validar contrato e retry |
| CADSUS | [se aplicável] | integração externa | identificação cidadã | deduplicação e máscara |
| CNES | [se aplicável] | integração externa | dados de unidade/profissional | cache e consistência |
| Notificações | Avisos operacionais | fila/evento | mensagens e alertas | evitar PII em payload |
| CloudWatch / Logs | Observabilidade | log/metric | métricas e eventos | correlação por requestId |

### Estratégia de falha de integração
- Definir se falha bloqueia fluxo ou apenas gera alerta.
- Definir timeout por integração.
- Definir retry idempotente quando permitido.
- Definir fallback visual e mensagem ao usuário.

---

## 10. Estados da Tela

### Loading
- Skeleton compatível com layout final.
- Bloquear apenas ações dependentes de dados ainda não carregados.

### Vazio
- Mensagem clara sobre ausência de registros.
- Ação sugerida: cadastrar, ajustar filtro ou aguardar integração.

### Erro
- Mensagem institucional.
- Botão de tentar novamente.
- `requestId` exibível apenas quando útil para suporte.

### Sucesso
- Toast ou feedback persistente conforme criticidade.
- Atualização de lista/detalhe sem exigir recarga manual sempre que possível.

### Degraded
- Banner persistente informando impacto real.
- Desabilitar ações afetadas.

### Sem permissão
- Estado `403` claro, sem vazar regra interna.
- Oferecer caminho alternativo quando existir.

### Sessão expirada
- Modal ou redirecionamento com preservação segura do contexto permitido.

### Offline parcial
- Banner persistente.
- Bloqueio de escrita crítica.

### Concorrência
- Mensagem de conflito de atualização.
- Opção de recarregar dados antes de nova tentativa.

---

## 11. Critérios de Aceite

### Cenário 1 — Fluxo feliz
**Dado** que [perfil autorizado] acessa a tela com sessão válida  
**Quando** [ação principal] é executada com dados válidos  
**Então** o sistema deve [resultado esperado]  
**E** registrar auditoria correspondente  
**E** atualizar a interface sem ambiguidade

### Cenário 2 — Permissão insuficiente
**Dado** que [perfil sem capability] tenta acessar ou agir  
**Quando** a operação é iniciada  
**Então** o sistema deve negar acesso com mensagem adequada  
**E** não expor dados fora do escopo  
**E** registrar tentativa negada quando aplicável

### Cenário 3 — Multi-tenant
**Dado** que usuário pertence à unidade/equipe A  
**Quando** tenta acessar registro da unidade/equipe B  
**Então** o sistema deve bloquear ou auditar acesso conforme regra definida  
**E** nunca misturar dados entre tenants indevidamente

### Cenário 4 — LGPD
**Dado** que tela exibe dado sensível  
**Quando** usuário sem necessidade operacional completa acessa tela  
**Então** CPF/CNS/telefone devem estar mascarados  
**E** exportação deve respeitar perfil e rastreabilidade

### Cenário 5 — Concorrência
**Dado** que registro foi alterado por outro usuário  
**Quando** usuário tenta salvar versão desatualizada  
**Então** sistema deve bloquear sobrescrita silenciosa  
**E** orientar recarga do registro

### Cenário 6 — Duplicidade
**Dado** que já existe registro equivalente ativo  
**Quando** usuário tenta criar duplicado  
**Então** sistema deve impedir persistência  
**E** informar registro já existente

### Cenário 7 — Rate limit / segurança operacional
**Dado** que limite operacional foi atingido  
**Quando** usuário repete requisições rapidamente  
**Então** sistema deve retornar feedback amigável  
**E** não executar operação além do permitido

### Cenário 8 — Degraded mode
**Dado** que subsistema crítico está degradado  
**Quando** usuário acessa a tela  
**Então** sistema deve exibir banner institucional  
**E** desabilitar funções impactadas  
**E** manter apenas operações seguras

### Cenário 9 — Sessão expirada
**Dado** que sessão expirou  
**Quando** usuário tenta salvar ação  
**Então** sistema deve interromper operação  
**E** solicitar novo login  
**E** não perder integridade do dado

### Cenário 10 — Break glass
**Dado** que `break_glass_admin` ativou acesso elevado  
**Quando** executa ação na tela  
**Então** sistema deve destacar visualmente sessão elevada  
**E** auditar ação com severidade alta  
**E** respeitar TTL da sessão emergencial

---

## 12. Riscos Operacionais

### Riscos humanos
- Operador salvar registro no paciente errado.
- Recepção duplicar entrada em fila por clique repetido.
- Coordenação interpretar vazio como erro ou erro como vazio.

### Riscos técnicos
- Timeout em integração crítica.
- Rate limit excessivo em horário de pico.
- Conflito de concorrência em edição simultânea.

### Riscos clínicos
- Prioridade incorreta em fila.
- Exibição tardia de alerta crítico.
- Alteração de status assistencial sem confirmação.

### Riscos LGPD
- Exposição de CPF/CNS em tela compartilhada.
- Exportação excessiva sem justificativa.
- Cross-team sem auditoria adequada.

### Riscos de dados
- Duplicidade de cadastro.
- Atualização perdida por sobrescrita.
- Inconsistência entre tela e backend por cache curto.

### Riscos de treinamento
- Usuário não entender degraded mode.
- Usuário não diferenciar inativação de exclusão.
- Equipe não compreender limitações por perfil.

---

## 13. Métricas e Observabilidade

### Métricas de produto/operação
- tempo médio para concluir ação principal
- taxa de erro por ação
- taxa de abandono do fluxo
- volume por perfil e por unidade
- uso de filtros principais
- taxa de duplicidade evitada
- taxa de conflitos de concorrência

### Métricas técnicas
- `request_duration_ms`
- `db_write_duration_ms`
- `deadlock_retry`
- `rate_limit_hit`
- `circuit_breaker_opened`
- `auth_failure`

### Alertas recomendados
- aumento anormal de `403` em tela crítica
- aumento anormal de `409` por duplicidade/conflito
- picos de `429`
- falha repetida de integração externa
- quebra de cadeia de auditoria
- uso elevado de break glass

### Indicadores operacionais
- volume diário por UBS
- tempo de resposta percebido
- quantidade de ações críticas auditadas
- backlog operacional decorrente de erro/degraded mode

---

## 14. Dependências Técnicas

### Endpoints
- `GET [endpoint de listagem]`
- `GET [endpoint de detalhe]`
- `POST [endpoint de criação]`
- `PATCH/PUT [endpoint de atualização]`
- `DELETE/PATCH [endpoint de inativação/cancelamento]`
- `GET [endpoint de auditoria/relatório, se aplicável]`

### Serviços
- [service/hook/store/provider envolvidos]

### Permissões
- [capabilities obrigatórias]
- [guards de role]
- [restrições de escopo]

### Feature flags
- [listar flags, se houver]

### Migrations
- [listar migrations necessárias, se houver impacto em schema]

### Seeds
- [dados mínimos para homologação/QA]

### Variáveis de ambiente
- [ex.: `VITE_API_BASE_URL`, `RUN_MIGRATIONS`, integrações]

### Dependências de infraestrutura
- PostgreSQL / `app_state`
- Redis rate limit
- logs estruturados
- health checks

---

## 15. Considerações UX Operacionais

### Comportamento esperado na UBS
- Tela deve favorecer operação rápida com atenção dividida.
- Conteúdo crítico deve aparecer antes de blocos analíticos secundários.
- Ações de uso frequente devem estar visíveis sem navegação excessiva.

### Redução de cliques
- Priorizar ação direta a partir de alertas, listas e filtros já aplicados.
- Evitar que usuário repita busca para voltar ao contexto anterior.

### Velocidade operacional
- Loading deve comunicar progresso real.
- Atualizações devem refletir imediatamente quando seguras.
- Evitar refresh completo quando mutação local resolver.

### Acessibilidade
- Não depender apenas de cor.
- Navegação por teclado em modais e ações principais.
- Contraste institucional mínimo AA.
- Labels claros, sem jargão interno para usuário final.

### Fluxo rápido
- Campos e decisões mais frequentes primeiro.
- Confirmação apenas onde risco justificar.
- Mensagens objetivas, acionáveis e sem ambiguidade.

### Prevenção de erro humano
- Confirmação para ações irreversíveis.
- Destaque de paciente/contexto atual.
- Deduplicação, bloqueio de clique duplo e validação de escopo.

### Mobile / Responsividade operacional
- Uso mínimo viável em tablet.
- Conteúdo crítico acima da dobra.
- Ações principais acessíveis com toque.
- Sem truncar status, prioridade ou identificação essencial.

---

## 16. Gaps a Preencher Antes de Aprovar Escopo

- Nome final da tela e módulo.
- Perfis exatos com capability real do código.
- Fluxo principal validado com operação UBS.
- Regras específicas da entidade/tela.
- Lista final de campos e validações.
- Endpoints reais ou novos contratos necessários.
- Dependência de integração externa e política de fallback.
- Critérios de aceite aprovados por Produto + QA + Tech.

---

## 17. Melhorias Operacionais Recomendadas

- Incluir sempre seção de "ações rápidas" para fluxos de alto volume.
- Documentar explicitamente quando estado vazio é operacionalmente esperado.
- Incluir regra de concorrência otimista em toda tela com edição.
- Padronizar nomenclatura de eventos de auditoria por módulo.
- Padronizar mensagens institucionais de erro, permissão e degraded mode.
- Padronizar tabela de perfis usando RBAC real do projeto, não papel informal.

---

## 18. Instruções de Uso do Template

1. Duplicar este documento para tela alvo.
2. Substituir placeholders por contexto real da tela.
3. Validar seção de perfis contra `docs/ai/rbac-matrix.md`.
4. Validar fluxo e endpoints contra `docs/ai/frontend-pages-map.md` e código-fonte.
5. Validar LGPD, auditoria e multi-tenant contra `docs/ai/system-context.md` e `docs/lgpd/LGPD_OPERATIONS.md`.
6. Converter regras genéricas em regras numeradas específicas da tela.
7. Fechar aprovação com Produto, UX, Backend e QA antes de execução.

---

## 19. Checklist de Qualidade do Escopo

- [ ] objetivo operacional claro
- [ ] perfil e escopo definidos sem ambiguidade
- [ ] fluxo principal completo
- [ ] fluxos alternativos cobertos
- [ ] componentes listados
- [ ] campos e validações completos
- [ ] regras de negócio numeradas
- [ ] requisitos de auditoria definidos
- [ ] integrações e fallback definidos
- [ ] estados da tela cobertos
- [ ] critérios BDD cobrindo feliz, erro, permissão, concorrência, LGPD e multi-tenant
- [ ] riscos operacionais mapeados
- [ ] métricas e alertas definidos
- [ ] dependências técnicas listadas
- [ ] UX operacional validada

