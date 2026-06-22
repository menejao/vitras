# Relatórios — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/ReportsPage.jsx`  
**Tab:** `reports`

---

## 1. Objetivo e contexto

Módulo de relatórios operacionais e gerenciais da UBS. Consolida dados de produção, atendimentos, vacinas, protocolos e farmácia em visualizações exportáveis. Suporta tomada de decisão do gestor.

**Usuários:** Gestores, coordinadores, e perfis com acesso a relatórios.

---

## 2. Dependências técnicas

Dados via bootstrap (sem API específica de relatórios — agrega dados já carregados):

| Dado | Fonte |
|---|---|
| `patients` | bootstrap |
| `users` | bootstrap |
| `templates` | bootstrap |
| `protocolByPatient` | bootstrap |
| `agenda` | hook useAgenda |
| `referrals` | hook useReferrals |
| `pharmacyStock` | hook usePharmacy |
| `pharmacyLog` | hook usePharmacy |

---

## 3. Elementos da página

### 3.1 Relatório de produção

- Total de atendimentos por tipo
- Agendados vs espontâneos
- Por profissional
- Por período

### 3.2 Relatório de protocolos

- Distribuição de pacientes por status de protocolo
- Críticos / atenção / OK / não avaliados
- Por categoria de paciente

### 3.3 Relatório de vacinação

- Cobertura vacinal por faixa etária
- Vacinas pendentes / atrasadas

### 3.4 Relatório de farmácia

- Movimentação de estoque
- Dispensações por período
- Itens com estoque crítico

### 3.5 Relatório de ACS

- Produção por ACS
- Visitas realizadas
- Buscas ativas

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-REL-01 | Gerar relatório | Dados de bootstrap ausentes | Exibe estado vazio |
| RN-REL-02 | Exportar | Botão disponível | Gera arquivo (CSV/PDF) quando implementado |

---

## 5. Permissões

Acessível a todos. Dados sensíveis (pacientes individualmente) não são expostos em relatórios consolidados.

---

## 6. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
