# Dashboard — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/Dashboard.jsx`  
**Tab:** `dashboard` (padrão ao abrir o App Principal)

---

## 1. Objetivo e contexto

Visão operacional da unidade de saúde. Consolida indicadores clínicos, alertas proativos, produção da equipe e métricas de demanda em uma tela única. É a tela inicial para todos os perfis clínicos.

**Usuários:** Todos os perfis clínicos (médico, enfermeiro, ACS, gestor, etc.)

**Frequência de uso:** Diária — início do turno.

---

## 2. Localização

| Atributo | Valor |
|---|---|
| Tab | `dashboard` |
| Padrão | Sim — exibido ao abrir o app (exceto gestor: `tab = "gestor"`) |
| Acessado via | Sidebar / Menu |

---

## 3. Dependências técnicas

| Dado | Fonte |
|---|---|
| `patients` | Bootstrap (`GET /patients`) |
| `users` | Bootstrap (`GET /users`) |
| `protocolByPatient` | Bootstrap (`GET /protocols`) |
| `demandMonthly` | Bootstrap (`GET /demand/monthly`) |
| `agenda` | Hook `useAgenda` → `GET /agenda` |
| `pharmacyStock` | Hook `usePharmacy` → `GET /pharmacy/stock` |

---

## 4. Elementos da página

### 4.1 Header

- Eyebrow: "Vitras"
- Título: "Visão operacional da unidade"
- Subtítulo descritivo
- Botões: "Abrir gestão à vista" → tab=gestor | "Ir para pacientes" → tab=patients

### 4.2 KPIs — seção `dashboard__kpis`

| KPI | Valor | Helper |
|---|---|---|
| Pacientes ativos | `patients.length` | Total cadastrado |
| Com ACS definido | count com `assignedAcsId` | "Sem ACS: N" |
| Protocolos críticos | count `protocolChip.tone === "danger"` | — |
| ACS ativos | count `role === "acs"` | — |
| Médicos | count `role === "doctor"` | — |

### 4.3 Painel de Demanda Mensal

- Total atendimentos
- Agendados vs espontâneos
- Percentual de agendados (meta: 50-70%)
- Status: "Na meta" (verde) / "Abaixo" (amarelo) / "Acima" (vermelho) / "Sem dados" (neutro)

### 4.4 Alertas Proativos

- Até 6 alertas gerados por `buildProactiveAlerts(patients, protocolByPatient, pharmacyStock, agenda)`
- Cada alerta: ícone, descrição, paciente, ação sugerida
- Tipos: protocolo crítico, gestante em risco, estoque crítico, agenda sem confirmação, etc.

### 4.5 Pacientes Críticos

- Até 6 pacientes com `protocolChip.tone === "danger"`
- Clicar → `onNavigate(patient.id)` → tab=patients + selectedPatientId

### 4.6 Produção por Protocolo

- Chips de status por categoria de protocolo (`ok`, `warn`, `danger`)
- Contagem por tom

---

## 5. Dicionário de campos

| Campo | Tipo | Origem | Descrição |
|---|---|---|---|
| `patients.length` | number | bootstrap | Total de pacientes ativos |
| `assignedAcsId` | string | patient | ACS responsável pelo paciente |
| `protocolChip(summary).tone` | enum | `protocolByPatient` | danger/warn/ok/neutral |
| `demandMonthly.totals.total` | number | bootstrap | Total de atendimentos no mês |
| `demandMonthly.totals.scheduled` | number | bootstrap | Atendimentos agendados |
| `demandMonthly.totals.spontaneous` | number | bootstrap | Atendimentos espontâneos |

---

## 6. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-DASH-01 | Calcular meta demanda | `scheduled / total >= 0.5 && <= 0.7` | Status "Na meta" (verde) |
| RN-DASH-02 | Calcular meta demanda | `scheduled / total < 0.5` | Status "Abaixo da meta" (amarelo) |
| RN-DASH-03 | Calcular meta demanda | `scheduled / total > 0.7` | Status "Acima da meta" (vermelho) |
| RN-DASH-04 | Login gestor | `role === "gestor"` | Tab inicial = "gestor", não "dashboard" |
| RN-DASH-05 | Clicar paciente crítico | Sempre | Navega para tab=patients com ID selecionado |

---

## 7. Ações e comportamentos

| Ação | Gatilho | Resultado |
|---|---|---|
| Navegar para gestão | "Abrir gestão à vista" | tab = "gestor" |
| Navegar para pacientes | "Ir para pacientes" | tab = "patients" |
| Selecionar paciente alerta | Clicar card de alerta | tab = "patients" + selectedPatientId |
| Selecionar paciente crítico | Clicar paciente | tab = "patients" + selectedPatientId |

---

## 8. Navegação

| Elemento | Destino |
|---|---|
| "Abrir gestão à vista" | [Painel Gestor](gestor.md) |
| "Ir para pacientes" | [Lista de Pacientes](lista-pacientes.md) |
| Clicar paciente | [Lista de Pacientes](lista-pacientes.md) com detalhe aberto |

---

## 9. Permissões

Acessível a todos os perfis clínicos. Sem capability específica. `support_admin` não acessa (redirecionado para Console Nacional).

---

## 10. Auditoria

Dashboard não gera eventos de auditoria — somente leitura de dados já auditados.

---

## 11. Critérios de aceite

- [ ] KPIs refletem contagens reais dos dados carregados
- [ ] Meta de demanda exibida com cor correta
- [ ] Pacientes críticos listados (máx. 6) com navegação funcional
- [ ] Alertas proativos exibidos (máx. 6)
- [ ] Gestor ao fazer login vai para tab "gestor", não "dashboard"

---

## 12. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
