# Diretrizes de Conformidade com a LGPD

**[NOME_DA_EMPRESA]**  
**Versão:** 1.0 · Maio de 2026  
**Classificação:** Interno — Referência

---

> **Nota Legal:** Este documento constitui referência interna de diretrizes organizacionais relacionadas à LGPD. Não substitui assessoria jurídica especializada. A implementação formal do programa de conformidade com a LGPD deve ser conduzida ou validada por advogado especializado em proteção de dados.

---

## Sumário

1. Fundamento Legal
2. Papel da [NOME_DA_EMPRESA] no Tratamento de Dados
3. Categorias de Dados Tratados
4. Bases Legais para Tratamento
5. Direitos dos Titulares
6. Medidas de Conformidade
7. Encarregado de Dados (DPO)
8. Transferências e Suboperadores
9. Revisão e Atualização

---

## 1. Fundamento Legal

A **Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)** estabelece regras para coleta, uso, armazenamento e compartilhamento de dados pessoais no Brasil, com ênfase especial em dados sensíveis — categoria que inclui dados relacionados à saúde.

A **[NOME_DA_EMPRESA]**, como desenvolvedora e operadora da plataforma **[NOME_FINAL_DO_PRODUTO]**, opera na interface entre Controladores (os municípios e órgãos públicos clientes) e os titulares dos dados (pacientes e profissionais de saúde). Essa posição exige rigor no cumprimento das obrigações legais pertinentes.

---

## 2. Papel da [NOME_DA_EMPRESA] no Tratamento de Dados

### Como Operadora

Em relação aos dados de pacientes e profissionais de saúde registrados pelos clientes (municípios):

- A **[NOME_DA_EMPRESA]** atua como **Operadora** — trata dados sob as instruções do Controlador
- O município cliente é o **Controlador** — responsável pela finalidade e base legal do tratamento
- O contrato com o cliente deve incluir cláusulas de proteção de dados definindo obrigações de ambas as partes

### Como Controladora

Em relação a dados que a [NOME_DA_EMPRESA] coleta por conta própria:

- Dados de contato e operacionais dos colaboradores do cliente (usuários da plataforma)
- Dados da própria equipe interna
- Dados de prospecção e CRM comercial

---

## 3. Categorias de Dados Tratados

### Dados Sensíveis (Art. 5º, II, LGPD)

| Categoria | Exemplos na plataforma |
|-----------|----------------------|
| Dados de saúde | Prontuários, diagnósticos, prescrições, laudos, vacinas |
| Dados de identificação | Nome, CPF, data de nascimento, endereço do paciente |

**Atenção:** Dados de saúde exigem base legal específica e medidas de proteção reforçadas.

### Dados Pessoais Comuns

| Categoria | Exemplos |
|-----------|---------|
| Profissionais de saúde | Nome, CRM/COREN, contato, cargo |
| Usuários do sistema | Login, e-mail, registro de acesso |
| Responsáveis pelo cliente | Nome, cargo, contato do representante municipal |

---

## 4. Bases Legais para Tratamento

### Dados de pacientes (saúde pública)

Bases legais aplicáveis (conforme contexto):

- **Art. 7º, III** — Execução de políticas públicas (saúde pública municipal)
- **Art. 7º, VIII** — Legítimo interesse, quando aplicável
- **Art. 11, II, b** — Tratamento de dados de saúde para tutela da saúde, por profissional de saúde ou entidade sanitária

### Dados de usuários da plataforma (profissionais do cliente)

- **Art. 7º, V** — Execução de contrato ou procedimentos preliminares a pedido do titular

### Dados comerciais e de CRM

- **Art. 7º, IX** — Legítimo interesse do controlador

---

## 5. Direitos dos Titulares

A LGPD garante aos titulares os seguintes direitos, que a [NOME_DA_EMPRESA] se compromete a suportar:

| Direito | Como é atendido |
|---------|----------------|
| Confirmação de existência de tratamento | Resposta à solicitação do titular em até 15 dias úteis |
| Acesso aos dados | Relatório de dados do titular disponibilizado sob demanda |
| Correção de dados incompletos ou incorretos | Processo de correção mediante solicitação |
| Anonimização, bloqueio ou eliminação | Avaliado conforme base legal vigente; executado quando aplicável |
| Portabilidade | Exportação de dados do titular em formato estruturado |
| Eliminação dos dados | Execução conforme base legal e exigências de retenção |
| Informação sobre compartilhamento | Política de privacidade atualizada e acessível |
| Revogação de consentimento | Processo definido quando consentimento for a base legal |

**Canal para exercício de direitos:** [EMAIL_PRIVACIDADE]  
**Prazo de resposta:** até 15 dias úteis da solicitação

---

## 6. Medidas de Conformidade

### Registro de Atividades de Tratamento

Manutenção de registro documentando:
- Finalidade de cada atividade de tratamento
- Categorias de dados tratados
- Base legal aplicável
- Prazo de retenção
- Medidas de segurança implementadas

### Política de Privacidade

- Política de privacidade pública e atualizada, acessível em [DOMINIO]
- Redigida em linguagem clara e acessível
- Atualizada sempre que houver mudança relevante nas práticas de tratamento

### Contratos com Clientes (DPA)

- Inclusão de cláusulas de proteção de dados (Data Processing Agreement) em todos os contratos com clientes
- Definição clara de papel de Controlador (cliente) e Operador ([NOME_DA_EMPRESA])
- Obrigações mútuas de notificação em caso de incidente

### Contratos com Suboperadores

- Avaliação de conformidade LGPD de fornecedores que acessam dados pessoais
- Cláusulas contratuais de proteção de dados com suboperadores (cloud, infraestrutura)

---

## 7. Encarregado de Dados (DPO)

A LGPD exige a designação formal de um Encarregado de Dados (Data Protection Officer — DPO).

**Situação atual:** A função de Encarregado está sendo exercida provisoriamente pelo CEO até a designação formal ou contratação de serviço especializado de DPO terceirizado.

**Contato do Encarregado:** [EMAIL_PRIVACIDADE]

**Responsabilidades do Encarregado:**
- Receber comunicações dos titulares e da ANPD
- Orientar a organização sobre conformidade com a LGPD
- Atuar como canal de comunicação com a ANPD
- Supervisionar o programa de proteção de dados

---

## 8. Transferências e Suboperadores

Dados pessoais podem ser processados por suboperadores no contexto de:

| Suboperador | Finalidade | Localização |
|-------------|-----------|-------------|
| Provedor de cloud (a definir) | Hospedagem e infraestrutura | Brasil (preferencialmente) |
| Serviços de monitoramento | Logs e alertas | A avaliar |

Transferências internacionais são evitadas sempre que possível. Quando necessárias, devem observar os requisitos da LGPD para transferências internacionais.

---

## 9. Revisão e Atualização

Este documento deve ser revisado:
- Anualmente, como parte do ciclo de conformidade
- Após mudanças relevantes na legislação ou na operação da empresa
- Após incidentes de segurança que envolvam dados pessoais

---

*[NOME_DA_EMPRESA] · [NOME_FINAL_DO_PRODUTO] · Diretrizes LGPD v1.0*  
*Classificação: Interno — Referência · Maio de 2026*
