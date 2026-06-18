# Política de Privacidade e Proteção de Dados — VITRAS APS

**Versão:** 1.0-draft  
**Data de vigência:** TODO_USER: data de publicação  
**URL pública:** TODO_USER: https://...  
**Classificação:** Público

---

## 1. Quem Somos

**TODO_USER: razão social completa** ("VITRAS" ou nome comercial), inscrita no CNPJ **TODO_USER: XX.XXX.XXX/XXXX-XX**, com sede em **TODO_USER: endereço completo**, é a empresa responsável pelo desenvolvimento e operação da plataforma **VITRAS APS** — solução de gestão para Atenção Primária à Saúde (APS) destinada a Municípios, Secretarias de Saúde e Unidades Básicas de Saúde (UBS).

---

## 2. Papéis na Lei Geral de Proteção de Dados (LGPD)

O VITRAS APS opera dentro de uma cadeia de responsabilidades definida pela LGPD (Lei nº 13.709/2018):

| Papel LGPD | Quem é | O que faz |
|-----------|--------|-----------|
| **Controlador** | Município / Secretaria de Saúde / UBS contratante | Define as finalidades e os meios do tratamento de dados dos pacientes e profissionais |
| **Operador** | VITRAS (TODO_USER: razão social) | Trata dados pessoais em nome e sob instruções do Controlador |
| **Titular** | Pacientes, profissionais de saúde, responsáveis familiares | Pessoas a quem os dados se referem |

Para fins de gestão administrativa interna da própria empresa (dados de funcionários, billing, suporte), o VITRAS atua como Controlador.

---

## 3. Dados Pessoais Tratados

### 3.1 Dados de Pacientes (tratados como Operador)

| Categoria | Exemplos |
|-----------|----------|
| Identificação | Nome completo, nome social, data de nascimento, sexo, raça/cor |
| Documentos | CPF, CNS (Cartão Nacional de Saúde), NIS |
| Contato | Telefone, e-mail |
| Endereço | Logradouro, complemento, CEP, município, microárea |
| Família | Nome da mãe, CNS do responsável familiar, CPF do responsável |
| Cadastro domiciliar | Tipo de imóvel, condições de moradia, número de moradores |

### 3.2 Dados Sensíveis de Pacientes (Art. 11 LGPD)

Os dados abaixo são considerados **dados sensíveis** e recebem tratamento diferenciado:

- Condições de saúde (diagnósticos CID-10, problemas CIAP-2)
- Indicadores de HIV em gestante
- Indicadores de sífilis
- Raça/cor
- Deficiência
- Situação de rua
- Identidade de gênero (nome social como identidade operacional)

### 3.3 Dados de Profissionais de Saúde

CNS do profissional, CBO, vínculo com unidade (CNES/INE), horário de atendimento, registros de acesso e auditoria.

### 3.4 Dados Exportados para e-SUS / PEC / DATASUS

Quando o módulo CDS Export está habilitado, dados dos pacientes e atendimentos são exportados no formato LEDI APS 7.4.x (ficheiro .esus) para importação no **PEC e-SUS APS** do Ministério da Saúde. Essa exportação:

- É realizada exclusivamente por usuários autorizados (gestor ou administrador)
- É integralmente auditada no log da plataforma
- Visa o cumprimento da obrigação legal de alimentação do SISAB/DATASUS
- Segue a base legal de **obrigação legal** (art. 7º, II e art. 11, II, "a" da LGPD)

O PEC e-SUS APS é sistema do Ministério da Saúde — após a importação, os dados ficam sob governança federal, fora do escopo de operação do VITRAS.

---

## 4. Finalidades do Tratamento

| Finalidade | Base legal provável (LGPD) |
|-----------|--------------------------|
| Registro e gestão de pacientes na APS | Obrigação legal (art. 7º, II) / Tutela da saúde (art. 11, II, "f") |
| Registro de atendimentos clínicos | Obrigação legal / Tutela da saúde |
| Exportação CDS para e-SUS | Obrigação legal (alimentação SISAB) |
| Controle de acesso e autenticação | Legítimo interesse / Obrigação legal |
| Auditoria e rastreabilidade | Legítimo interesse do controlador / Obrigação legal |
| Suporte técnico | Execução de contrato (art. 7º, V) |

---

## 5. Dados Sensíveis — Proteções Específicas

Por força do Art. 11 da LGPD, adotamos as seguintes proteções específicas para dados sensíveis:

- **Criptografia AES-256-GCM** em campos CPF, CNS, CNS do responsável e NIS
- **Redaction em logs de auditoria**: CID-10, CIAP-2, HIV gestante, sífilis, identidade de gênero não aparecem em `before`/`after` de eventos de auditoria
- **Nome civil oculto**: o nome civil de pacientes que declaram nome social é ocultado em todas as interfaces operacionais; profissionais de saúde veem apenas o nome social
- **Minimização**: dados sensíveis são coletados apenas quando necessários para a finalidade assistencial

---

## 6. Compartilhamento de Dados

| Destinatário | Finalidade | Base |
|-------------|-----------|------|
| PEC e-SUS APS (Ministério da Saúde) | Exportação CDS — obrigação SISAB | Obrigação legal |
| Infraestrutura cloud (TODO_USER: confirmar fornecedor) | Hospedagem da plataforma | Contrato — como suboperador |
| Equipe de suporte VITRAS | Diagnóstico de incidentes | Contrato + mínimo necessário |

O VITRAS **não vende, não compartilha para fins comerciais e não cede** dados pessoais de pacientes ou profissionais a terceiros fora dos casos acima.

---

## 7. Segurança

Adotamos medidas técnicas e organizacionais proporcionais ao risco:

- Comunicações criptografadas via HTTPS/TLS
- Autenticação com JWT e controle de sessão
- Controle de acesso baseado em perfil (RBAC) com granularidade por capability
- Criptografia de campos sensíveis em repouso (AES-256-GCM)
- Cadeia de auditoria imutável com hash encadeado SHA-256
- Modo de somente-leitura em emergências operacionais
- Acesso de emergência (break-glass) com registro automático e restrito

---

## 8. Retenção de Dados

| Tipo de dado | Retenção |
|-------------|----------|
| Dados assistenciais de pacientes | Conforme obrigação legal do controlador municipal (mínimo 20 anos, CFM) |
| Logs de auditoria | Mínimo 5 anos |
| Logs técnicos de sistema | 90 dias |
| Dados de suporte | Enquanto durar o contrato + 2 anos |
| Backups | Conforme política contratual — mínimo 30 dias |

Após encerramento do contrato, dados assistenciais são devolvidos ao Controlador em formato exportável e eliminados dos sistemas VITRAS em prazo a acordar no DPA.

---

## 9. Direitos dos Titulares

Os titulares têm os seguintes direitos previstos na LGPD (Art. 18):

- Confirmação da existência de tratamento
- Acesso aos dados
- Correção de dados incompletos, inexatos ou desatualizados
- Anonimização, bloqueio ou eliminação (sujeito a exceções legais em saúde pública)
- Portabilidade (quando regulamentado pela ANPD)
- Eliminação dos dados tratados com base no consentimento
- Informação sobre compartilhamento
- Revogação do consentimento (quando aplicável)
- Oposição ao tratamento

**Importante:** Como o VITRAS atua como Operador, a maioria das solicitações de titulares deve ser direcionada ao **Controlador** (Município/Secretaria de Saúde). O VITRAS apoiará o Controlador no atendimento das solicitações dentro de seus sistemas.

**Canal de atendimento a titulares:** TODO_USER: e-mail ou formulário dedicado

---

## 10. Encarregado de Proteção de Dados (DPO)

O VITRAS designou um Encarregado de Proteção de Dados conforme o Art. 41 da LGPD:

- **Nome:** TODO_USER: nome do DPO
- **E-mail:** TODO_USER: e-mail do DPO
- **Disponibilidade:** dias úteis, resposta em até 5 dias úteis

---

## 11. Transferência Internacional de Dados

TODO_USER: confirmar se há transferência internacional (ex: infraestrutura cloud fora do Brasil).

*Premissa atual:* se a infraestrutura estiver integralmente no Brasil, não há transferência internacional. Caso contrário, aplicar garantias adequadas conforme Art. 33 da LGPD.

---

## 12. Atualizações desta Política

Esta política pode ser atualizada a qualquer momento. Alterações relevantes serão comunicadas aos Controladores contratantes com antecedência mínima de 15 dias. A versão vigente sempre estará disponível em **TODO_USER: URL pública**.

---

## 13. Contato

**TODO_USER: razão social**  
CNPJ: **TODO_USER: XX.XXX.XXX/XXXX-XX**  
Endereço: **TODO_USER: endereço**  
E-mail geral: **TODO_USER: e-mail geral**  
DPO: **TODO_USER: e-mail do DPO**

---

*Política de Privacidade VITRAS APS · Versão 1.0-draft · 2026-06-18*
