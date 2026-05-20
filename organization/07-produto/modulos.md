# Módulos da Plataforma

**[NOME_DA_EMPRESA]**  
**Versão:** 1.0 · Maio de 2026  
**Classificação:** Institucional — Uso Externo Autorizado

---

## Visão Geral

A **[NOME_FINAL_DO_PRODUTO]** é estruturada em módulos funcionais integrados, que cobrem os principais processos assistenciais e administrativos de uma rede de saúde pública. Os módulos são implantados progressivamente conforme a maturidade e necessidade de cada cliente.

---

## Módulos Disponíveis

---

### Módulo 1 — Gestão de Pacientes e Cadastro

**Descrição:** Cadastro centralizado de pacientes, com gestão de dados pessoais, endereço, responsáveis e documentos. Integra-se com todos os demais módulos como base do histórico clínico.

**Funcionalidades principais:**
- Cadastro completo de pacientes (dados pessoais, endereço, contato, documentos)
- Busca e deduplicação de pacientes por CPF, CNS e dados pessoais
- Vínculo familiar e cadastro de responsável
- Histórico de atendimentos centralizado
- Impressão de comprovante de cadastro e documentos

**Perfis de acesso:** Recepção, Enfermagem, Médico, Administrador

---

### Módulo 2 — Agenda e Agendamento

**Descrição:** Gestão de agendamentos por unidade, profissional e especialidade. Suporte a agendamentos avulsos, por demanda espontânea e por encaminhamento.

**Funcionalidades principais:**
- Agenda por profissional e unidade
- Configuração de vagas, horários e tipos de atendimento
- Agendamento manual e por demanda espontânea
- Cancelamento, reagendamento e confirmação de consultas
- Lista de espera
- Relatório de produtividade e ocupação da agenda

**Perfis de acesso:** Recepção, Gestor, Administrador

---

### Módulo 3 — Fila e Recepção

**Descrição:** Gestão do fluxo de atendimento na unidade — da chegada do paciente à consulta. Suporte a triagem e classificação de risco.

**Funcionalidades principais:**
- Check-in de pacientes e criação de fila de atendimento
- Triagem com registro de queixa principal, sinais vitais e classificação de risco
- Gerenciamento do fluxo de atendimento por ordem e prioridade
- Painel de chamada (display ou monitor)
- Registro de tempo de espera
- Dashboard de fluxo em tempo real

**Perfis de acesso:** Recepção, Técnico de Enfermagem, Enfermeiro, Gestor

---

### Módulo 4 — Prontuário Eletrônico

**Descrição:** Registro clínico completo do atendimento. Histórico integrado do paciente, com acesso ao histórico de consultas, prescrições, exames e encaminhamentos.

**Funcionalidades principais:**
- SOAP (Subjetivo, Objetivo, Avaliação, Plano) e registro livre
- CID-10 integrado para registro de diagnóstico
- Histórico completo de atendimentos do paciente na rede
- Registro de alergias, medicamentos em uso e antecedentes
- Prescrição de medicamentos integrada à farmácia
- Assinatura digital de registros clínicos
- Impressão de documentos clínicos (atestados, receitas, relatórios)

**Perfis de acesso:** Médico, Enfermeiro, Técnico de Enfermagem

---

### Módulo 5 — Farmácia e Dispensação

**Descrição:** Gestão de estoque de medicamentos, dispensação ao paciente e controle de movimentação. Integrado ao prontuário para dispensação vinculada à prescrição.

**Funcionalidades principais:**
- Cadastro de medicamentos e apresentações farmacêuticas
- Controle de estoque por lote e validade
- Dispensação manual e vinculada à prescrição médica
- Entrada de estoque (recebimento e ajustes)
- Alertas de estoque mínimo e medicamentos próximos do vencimento
- Relatórios de consumo, movimentação e inventário

**Perfis de acesso:** Farmacêutico, Técnico de Farmácia, Administrador

---

### Módulo 6 — Imunização e Vacinação

**Descrição:** Gestão do calendário vacinal do paciente, aplicação de vacinas e controle de estoque de imunobiológicos.

**Funcionalidades principais:**
- Cadastro e aplicação de vacinas por dose e lote
- Calendário vacinal por faixa etária (conforme PNI)
- Histórico de vacinação do paciente
- Alertas de vacinas atrasadas ou em atraso
- Controle de estoque de imunobiológicos
- Relatórios de cobertura vacinal por unidade e período

**Perfis de acesso:** Enfermeiro, Técnico de Enfermagem, Administrador

---

### Módulo 7 — Encaminhamentos e Referência/Contrarreferência

**Descrição:** Gestão de encaminhamentos para especialistas, serviços de média e alta complexidade. Acompanhamento do paciente na jornada entre os níveis de atenção.

**Funcionalidades principais:**
- Geração de guias de encaminhamento com dados clínicos do paciente
- Registro de especialidade e justificativa clínica
- Acompanhamento do status do encaminhamento
- Registro de contrarreferência (resposta do especialista)
- Histórico de encaminhamentos por paciente

**Perfis de acesso:** Médico, Enfermeiro, Recepção (consulta)

---

### Módulo 8 — Diagnósticos e Laudos

**Descrição:** Registro e gestão de resultados de exames diagnósticos. Integração com o prontuário para acesso ao histórico de laudos do paciente.

**Funcionalidades principais:**
- Solicitação de exames integrada ao prontuário
- Registro e armazenamento de resultados de exames
- Anexo de laudos e imagens digitalizadas
- Visualização de histórico de exames por paciente
- Alertas de exames pendentes de resultado

**Perfis de acesso:** Médico, Enfermeiro, Técnico (inserção de resultados), Recepção (consulta)

---

### Módulo 9 — Relatórios e Indicadores Gerenciais

**Descrição:** Dashboards e relatórios para gestores, com indicadores de saúde, produtividade e operação da rede.

**Funcionalidades principais:**
- Dashboard gerencial com indicadores em tempo real
- Relatórios de produção por unidade, profissional e período
- Indicadores de saúde (vacinação, doenças crônicas, pré-natal)
- Relatório de BPA (Boletim de Produção Ambulatorial) compatível com e-SUS
- Exportação de relatórios em PDF e Excel
- Filtros por unidade, período, tipo de atendimento e profissional

**Perfis de acesso:** Gestor, Secretário, Administrador

---

### Módulo 10 — Inteligência Artificial (Módulo Assistivo)

**Descrição:** Recursos de IA para suporte ao profissional de saúde e à gestão. Em desenvolvimento progressivo.

**Funcionalidades disponíveis ou em desenvolvimento:**
- Sugestão de CID com base na descrição da queixa principal
- Alertas de interações medicamentosas na prescrição
- Análise preditiva de demanda por tipo de atendimento
- Resumo clínico automatizado do histórico do paciente

**Perfis de acesso:** Médico, Enfermeiro, Gestor

---

## Matriz de Módulos por Fase de Implantação

| Módulo | Fase 1 (Essencial) | Fase 2 (Expansão) | Fase 3 (Avançado) |
|--------|:------------------:|:-----------------:|:-----------------:|
| Gestão de Pacientes | ✓ | — | — |
| Agenda e Agendamento | ✓ | — | — |
| Fila e Recepção | ✓ | — | — |
| Prontuário Eletrônico | ✓ | — | — |
| Farmácia e Dispensação | ✓ | — | — |
| Imunização e Vacinação | ✓ | — | — |
| Encaminhamentos | — | ✓ | — |
| Diagnósticos e Laudos | — | ✓ | — |
| Relatórios Gerenciais | ✓ | — | — |
| Inteligência Artificial | — | — | ✓ |

---

*[NOME_DA_EMPRESA] · [NOME_FINAL_DO_PRODUTO] · Módulos da Plataforma v1.0*  
*Classificação: Institucional — Uso Externo Autorizado · Maio de 2026*
