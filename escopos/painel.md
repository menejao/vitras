# Painel

## Objetivo e contexto

Permitir que a equipe tenha uma visão rápida da situação operacional da unidade logo ao entrar no sistema.

O Painel funciona como uma tela de leitura e direcionamento. Ele resume:

- volume atual de pacientes
- situação dos protocolos
- composição da equipe
- alertas que exigem atenção
- equilíbrio entre demanda programada e espontânea

É uma tela de apoio à rotina da UBS. A intenção é ajudar o profissional a entender, em poucos segundos, onde estão os principais pontos de atenção do dia e para qual módulo deve seguir em seguida.

Localização da tela: menu principal > `Painel`.

---

## Dependências funcionais

| Item | Descrição |
|---|---|
| Pacientes | Base para os indicadores principais da tela |
| Protocolos | Base para criticidade, atenção e situação clínica resumida |
| Agenda | Base para alertas de consultas previstas para o dia |
| Farmácia | Base para alertas de ruptura ou estoque baixo |
| Usuários da equipe | Base para o bloco de equipe ativa |

---

## Visão geral da tela

### Cabeçalho

Apresenta o contexto da tela com título institucional e dois botões de ação rápida.

### Indicadores principais

O Painel apresenta quatro KPIs resumidos:

| Indicador | O que mostra |
|---|---|
| Pacientes ativos | Total de pacientes disponíveis no escopo do usuário |
| Com ACS definido | Quantos pacientes já possuem ACS vinculado |
| Protocolos críticos | Quantos pacientes estão em situação mais sensível dentro dos protocolos |
| Profissionais | Quantidade de profissionais carregados para o escopo da tela |

### Card de demanda programada

Quando disponível para o perfil, mostra a proporção entre atendimentos programados e espontâneos no período, com leitura simples de situação:

- na meta
- abaixo da meta
- acima da meta
- sem dados

Além do percentual, o bloco também exibe a quantidade de atendimentos programados e espontâneos.

### Alertas proativos

Mostra avisos que precisam de atenção imediata. O objetivo não é detalhar tudo, e sim destacar o que merece ação mais rápida.

Os alertas podem representar, por exemplo:

- paciente com situação gestacional vencida
- paciente com protocolo em situação crítica
- medicamento zerado
- estoque baixo
- consulta prevista para o dia

Quando o alerta estiver ligado a um paciente específico, ele deve permitir abertura do contexto do paciente.

### Pacientes prioritários

Exibe uma lista curta dos pacientes em situação mais crítica, para facilitar priorização rápida pela equipe.

Cada item traz:

- nome do paciente
- categoria de cuidado
- ACS responsável, quando houver
- chip de situação do protocolo

### Equipe ativa

Exibe um resumo dos profissionais carregados na tela, com nome e papel funcional, permitindo leitura rápida da composição da equipe disponível.

---

## Ações da tela

| Ação | Função esperada |
|---|---|
| Abrir gestão à vista | Levar o usuário para visão mais gerencial |
| Ir para pacientes | Levar o usuário para lista de pacientes |
| Clicar em alerta relacionado a paciente | Abrir o contexto do paciente correspondente |
| Clicar em paciente prioritário | Abrir o contexto do paciente correspondente |

Observação funcional importante:

Hoje existe indício de desalinhamento entre o texto de alguns botões do cabeçalho e o comportamento efetivamente realizado pela navegação. Isso deve ser tratado como ponto de ajuste funcional.

---

## Comportamento esperado

### Ao abrir a tela

O sistema deve carregar os dados necessários para montar o panorama operacional da unidade e exibir a tela já pronta para leitura rápida.

### Ao não existir dado suficiente

O Painel não deve aparentar erro quando o problema for apenas ausência de informação.

Exemplos:

- se não houver pacientes críticos, mostrar mensagem clara de vazio
- se não houver alertas, ocultar a seção ou exibir estado neutro
- se não houver base para cálculo de demanda, mostrar “Sem dados”

### Ao existir alerta crítico

O Painel deve priorizar visualmente o alerta ou o paciente que precisa de atenção primeiro.

### Ao existir navegação disponível

A tela deve servir como ponto de saída para módulos mais operacionais, principalmente pacientes e visão gerencial.

---

## Dicionário de campos

O dicionário abaixo descreve o que aparece para o usuário, qual a função do item e, quando necessário, como ele é identificado internamente para rastreabilidade.

| Campo | Função | Identificação interna | Observações |
|---|---|---|---|
| Painel | Nome funcional da tela | `dashboard` | Nome usado para navegação interna |
| Pacientes ativos | Mostrar total de pacientes no escopo carregado | `patients.length` | Indicador de volume |
| Com ACS definido | Mostrar quantos pacientes possuem ACS vinculado | `assignedAcsId` | Ajuda a identificar cobertura operacional |
| Protocolos críticos | Mostrar pacientes em situação mais crítica nos protocolos | `protocolByPatient` / `protocolChip` | Indicador de prioridade clínica |
| Profissionais | Mostrar total de profissionais considerados na tela | `users.length` | Visão rápida da equipe |
| Demanda programada | Mostrar percentual de demanda programada | `demandMonthly` | Aparece conforme disponibilidade do dado |
| Alertas proativos | Destacar situações de atenção | `alerts` | Lista resumida e priorizada |
| Pacientes prioritários | Listar pacientes mais sensíveis | `critical` | Lista curta para ação rápida |
| Equipe ativa | Resumir profissionais disponíveis | `users` | Exibição simplificada |
| Abrir gestão à vista | Atalho para visão gerencial | ação de navegação | Precisa estar alinhado com comportamento real |
| Ir para pacientes | Atalho para lista de pacientes | ação de navegação | Precisa estar alinhado com comportamento real |

---

## Regras de negócio

| Regra | Descrição |
|---|---|
| RN-01 | O Painel deve ser tratado como tela de visão geral, não de edição |
| RN-02 | Os indicadores devem refletir somente dados permitidos ao usuário no seu escopo |
| RN-03 | Pacientes em situação crítica devem receber destaque no Painel |
| RN-04 | Alertas devem ser resumidos e priorizados, evitando excesso de ruído |
| RN-05 | O bloco de demanda programada deve comunicar claramente se a unidade está na meta, abaixo, acima ou sem dados |
| RN-06 | Alertas sem vínculo direto com paciente podem ser exibidos apenas como sinalização operacional |
| RN-07 | Pacientes prioritários devem funcionar como atalho para aprofundamento |
| RN-08 | O Painel deve deixar claro quando não há dados suficientes para determinado bloco |

---

## Permissões de acesso

| Perfil | Comportamento esperado |
|---|---|
| Perfis assistenciais | Devem acessar o Painel como visão operacional inicial |
| Gestor | Pode ter acesso, mas tende a seguir para visão mais gerencial |
| Recepção | Possui fluxo próprio e não usa o Painel principal como experiência padrão |
| Perfis de suporte e auditoria | Podem acessar conforme política da plataforma |
| Perfis sem experiência operacional nesta tela | Não devem depender do Painel para executar rotina principal |

Observação:

Há pontos de desalinhamento entre capability técnica e experiência real de alguns perfis. Isso deve ser tratado como ajuste de produto/permissão, não como regra definitiva do escopo funcional.

---

## Auditoria das interações

| Evento | O que precisa ficar rastreável |
|---|---|
| Leitura inicial do painel | Abertura da visão operacional da unidade |
| Uso de atalhos do cabeçalho | Navegação iniciada a partir do Painel |
| Abertura de paciente via alerta | Uso de alerta como gatilho de aprofundamento |
| Abertura de paciente prioritário | Uso da lista de priorização |

Observação:

A carga inicial da visão já possui rastreabilidade identificada. Eventos mais finos de clique ainda pedem amadurecimento de auditoria funcional.

---

## Estados da tela

| Estado | Comportamento esperado |
|---|---|
| Carregando | Exibir estado de loading até os blocos principais ficarem disponíveis |
| Com dados | Exibir KPIs, listas e alertas normalmente |
| Sem alertas | Não sugerir erro; apenas ausência de sinalização |
| Sem pacientes críticos | Exibir mensagem neutra e clara |
| Sem equipe | Exibir mensagem neutra e clara |
| Sem dados de demanda | Exibir “Sem dados” e não forçar leitura enganosa |
| Erro de carga | Exibir erro claro, sem confundir com estado vazio |
| Sessão expirada | Solicitar renovação de sessão antes de continuar |

---

## Critérios de aceitação

| Dado | Quando | Então |
|---|---|---|
| Usuário com acesso ao Painel | Abrir sistema | Deve visualizar panorama operacional resumido da unidade |
| Dados de pacientes e protocolos disponíveis | Tela carregar | KPIs devem refletir o cenário carregado |
| Existirem pacientes críticos | Tela montar lista prioritária | Pacientes prioritários devem aparecer com destaque |
| Existirem alertas relevantes | Tela montar alertas | Alertas devem aparecer de forma resumida e acionável |
| Não houver base para demanda programada | Tela carregar bloco de demanda | Sistema deve mostrar “Sem dados” |
| Usuário clicar em paciente prioritário | Ação for executada | Sistema deve abrir contexto do paciente |
| Usuário de recepção acessar sistema | Fluxo iniciar | Deve seguir para experiência própria de recepção |

---

## Cenários de teste

| Cenário | Resultado esperado |
|---|---|
| Abertura do Painel com dados completos | Tela carrega panorama geral sem inconsistência |
| Abertura do Painel sem pacientes críticos | Mensagem de vazio aparece no bloco correspondente |
| Abertura do Painel sem alertas | Seção não deve aparentar falha |
| Abertura com demanda programada disponível | Percentual e status aparecem corretamente |
| Abertura sem demanda programada disponível | Estado “Sem dados” é exibido |
| Clique em alerta vinculado a paciente | Sistema leva ao contexto do paciente |
| Clique em paciente prioritário | Sistema leva ao contexto do paciente |
| Fluxo de recepção | Usuário não depende do Painel principal |

---

## Gaps e pontos de atenção

| Item | Leitura funcional |
|---|---|
| Ações rápidas do cabeçalho | Há indício de comportamento diferente do texto exibido ao usuário |
| Dados de presença/equipe | Nem toda informação carregada parece estar sendo aproveitada na tela |
| Qualidade de dados | Existe oportunidade de usar melhor essa informação no Painel |
| Perfis com acesso | Alguns perfis possuem permissão técnica, mas não usam a experiência principal da tela |
| Alertas sem destino | Parte dos alertas apenas sinaliza, sem aprofundamento direto |

---

## Direcionamento de melhoria

- alinhar texto e comportamento real dos botões de ação rápida
- ampliar valor operacional do Painel com indicadores de qualidade de dados
- revisar coerência entre perfis com acesso técnico e experiência funcional
- melhorar ligação entre alerta operacional e destino prático de ação
- reforçar o Painel como leitura rápida, sem excesso de informação
