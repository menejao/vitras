# Política de Privacidade — VITRAS UBS #1

**Controlador:** Prefeitura Municipal de [MUNICÍPIO] — Secretaria Municipal de Saúde  
**Operador:** Vitras Tecnologia (CNPJ: [PREENCHER])  
**Sistema:** VITRAS — Sistema de Gestão de Unidade Básica de Saúde  
**Versão do sistema:** v1.0-pilot-governed  
**Vigência:** A partir de [DATA DE GO-LIVE]  
**Base normativa:** LGPD Lei 13.709/2018 — Art. 9 (informação ao titular)

> **INSTRUÇÃO:** Preencher campos [PREENCHER] antes do go-live. Publicar em local visível na UBS (recepção) e digital (URL do sistema ou página da prefeitura). Deve estar disponível antes do primeiro paciente cadastrado.

---

## 1. Quem trata seus dados

A **Prefeitura Municipal de [MUNICÍPIO]**, por meio da Secretaria Municipal de Saúde, é a **controladora** dos dados coletados e processados pelo VITRAS. A empresa **Vitras Tecnologia** atua como **operadora**, processando os dados conforme instruções da Prefeitura.

**Contato do Encarregado de Dados (DPO):**  
Nome: [PREENCHER — DPO designado]  
E-mail: [PREENCHER — e-mail do DPO]  
Telefone: [PREENCHER]  

---

## 2. Quais dados coletamos e por quê

| Categoria | Dados | Finalidade | Base legal (LGPD) |
|-----------|-------|-----------|-------------------|
| Identificação | Nome completo, CPF, CNS, data de nascimento, filiação | Identificação do paciente e prevenção de duplicidade | Art. 11, II, f |
| Contato | Telefone, endereço, e-mail | Comunicação clínica e agendamento | Art. 11, II, f |
| Dados clínicos | Prontuário, consultas, vacinas, exames, encaminhamentos, prescrições, histórico | Prestação de serviço de saúde, continuidade do cuidado | Art. 11, II, f |
| Dados sensíveis de saúde | Condições crônicas, gravidez, puericultura, alergias, categorias de cuidado | Cuidado clínico individualizado | Art. 11, II, f |
| Atividade no sistema | Logs de acesso (quem acessou, quando, de qual operação) | Segurança, rastreabilidade, prevenção de uso indevido | Art. 11, II, f + obrigação legal |

> Seus dados de saúde **nunca** são vendidos, compartilhados com terceiros para fins comerciais ou usados para treinamento de sistemas de inteligência artificial.

---

## 3. Com quem compartilhamos

| Destinatário | Relação | Dados compartilhados | Localização |
|-------------|---------|---------------------|-------------|
| Vitras Tecnologia | Operador técnico — hospeda e processa o sistema | Todos os dados do sistema | Brasil (AWS sa-east-1) |
| Amazon Web Services (AWS) | Suboperador de infraestrutura — servidores e banco de dados | Todos os dados armazenados no sistema | Brasil (São Paulo) |
| Upstash | Suboperador de controle de acesso — armazena metadados de requisições | Endereço IP e timestamp das requisições (sem conteúdo clínico) | [PREENCHER — verificar região] |

Nenhum dado é transferido para fora do Brasil sem proteção adequada conforme LGPD Art. 33–36.

---

## 4. Por quanto tempo guardamos

| Dado | Período de retenção | Base legal |
|------|--------------------|-----------| 
| Prontuário eletrônico (adulto) | 20 anos após o último atendimento | CFM Res. 1.821/2007 |
| Prontuário eletrônico (menor de idade) | Até 25 anos de idade do paciente ou 5 anos após a maioridade, o que for maior | CFM Res. 1.821/2007 |
| Logs de auditoria do sistema | Mínimo 5 anos | Obrigação legal |
| Dados de profissionais de saúde | Duração do vínculo + 2 anos | Obrigação legal trabalhista |
| Backups de banco de dados | 7 dias (período de recuperação) | Necessidade técnica de continuidade |

---

## 5. Seus direitos (LGPD Art. 18)

Como paciente, você tem os seguintes direitos sobre seus dados:

| Direito | Como exercer |
|---------|-------------|
| Confirmação de que seus dados existem no sistema | Solicitar ao gestor ou coordenador da UBS |
| Acesso a uma cópia dos seus dados | Solicitar formalmente ao DPO ou à UBS |
| Correção de dados incorretos ou desatualizados | Solicitar ao profissional de saúde responsável pelo seu atendimento |
| Informação sobre compartilhamento | Solicitar ao DPO |
| Portabilidade para outro serviço de saúde | Solicitar ao DPO com autorização médica |
| Oposição ao tratamento | Avaliar com DPO — base legal de saúde pública pode limitar este direito |

> **Como entrar em contato:** Dirija-se pessoalmente à recepção da [UBS — PREENCHER] ou entre em contato com o DPO pelo e-mail [PREENCHER].

---

## 6. Segurança dos dados

O VITRAS implementa as seguintes medidas técnicas de proteção:

- **Criptografia em repouso:** CPF e CNS armazenados de forma cifrada no banco de dados
- **Criptografia em trânsito:** HTTPS obrigatório para todas as comunicações
- **Controle de acesso por equipe:** cada profissional acessa apenas os pacientes da sua equipe
- **Logs de auditoria:** toda ação no sistema é registrada com data, hora e usuário responsável
- **Autenticação segura:** acesso por senha com bloqueio automático após tentativas incorretas

---

## 7. Incidentes de segurança

Em caso de incidente que envolva dados de pacientes, a Prefeitura (controladora) e o DPO serão notificados imediatamente. A Autoridade Nacional de Proteção de Dados (ANPD) será notificada em até **72 horas** conforme LGPD Art. 48 §1, quando aplicável. Os titulares afetados serão comunicados em prazo razoável.

---

## 8. Contato e reclamações

**DPO (Encarregado de Dados):**  
[PREENCHER — Nome]  
[PREENCHER — E-mail]  
[PREENCHER — Telefone]

**Autoridade Nacional de Proteção de Dados (ANPD):**  
gov.br/anpd

---

*Documento versão v1.0 — criado em 2026-06-10*  
*Aprovado por: [DPO + Controlador — preencher na assinatura]*  
*Próxima revisão: [DATA GO-LIVE + 1 ano] ou após mudança significativa no tratamento*
