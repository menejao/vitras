# Painel Gestor — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/GestorPage.jsx`  
**Tab:** `gestor`

---

## 1. Objetivo e contexto

Painel de gestão à vista da UBS. Consolida indicadores de produção ACS (APS-01F), distribuição de pacientes por protocolo, gauge de cumprimento de metas, equipe ativa e visão de demanda. Usado pelo gestor para monitoramento operacional contínuo.

**Usuários:** `gestor`, `coordinator`. Tab inicial automático para `role === "gestor"`.

**Frequência de uso:** Diária — início e fim de turno.

---

## 2. Localização

| Atributo | Valor |
|---|---|
| Tab | `gestor` |
| Auto-tab | Sim — login com role=gestor inicia neste tab |

---

## 3. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/production/acs-metrics` | Produção dos ACS (APS-01F) |
| GET | `/production/metrics?period=` | Métricas gerais por período |
| Dados | bootstrap | patients, users, templates, protocolByPatient, agenda, referrals, pharmacyStock |

---

## 4. Elementos da página

### 4.1 Header

- Título: painel de gestão
- Botões de período: Mês / Trimestre / Semana / Hoje

### 4.2 Painel de Produção ACS (`AcsProductionPanel`)

Para cada ACS da equipe:
- Nome e avatar
- Visitas realizadas no período
- Buscas ativas
- Tarefas concluídas
- Barra de progresso visual

### 4.3 Gauges de protocolo

- Gauge circular (pie chart SVG) para cada categoria de protocolo
- Percentual de cumprimento
- Cor: verde (OK), amarelo (atenção), vermelho (crítico)

### 4.4 Indicadores operacionais

- Total de pacientes por protocolo
- Distribuição por categoria
- Meta de demanda agendada vs espontânea (50-70%)
- Referências ativas

### 4.5 Estoque crítico

- Itens com `pharmacyStock` abaixo do mínimo
- Cor vermelha para itens em alerta

---

## 5. Dicionário de campos

| Dado | Origem | Tipo |
|---|---|---|
| Produção ACS | `GET /production/acs-metrics` | Array por ACS |
| Período | UI state local | enum: mes/trimestre/semana/hoje |
| `protocolChip(summary).tone` | `protocolByPatient` | danger/warn/ok |
| `demandMonthly.totals` | bootstrap | object |
| `pharmacyStock[].quantity` | hook pharmacy | number |

---

## 6. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-GES-01 | Login | `role === "gestor"` | Tab inicial = "gestor" |
| RN-GES-02 | Gauge | `value/max >= 0.8` | Cor verde |
| RN-GES-03 | Gauge | `0.5 <= value/max < 0.8` | Cor amarela |
| RN-GES-04 | Gauge | `value/max < 0.5` | Cor vermelha |
| RN-GES-05 | Estoque | `quantity < minimo` | Badge vermelho no item |

---

## 7. Ações

| Ação | Gatilho | API | Resultado |
|---|---|---|---|
| Mudar período | Botão de período | `GET /production/metrics?period=X` | Gauges e produção atualizados |

---

## 8. Permissões

Acessível a todos os perfis (sem restrição de capability). Dados de produção são aggregados — sem dados individuais de pacientes expostos sem contexto clínico.

---

## 9. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
