# Registro de Suboperadores (Subprocessadores)

**VITRAS APS — v1.0-draft**  
**Data:** 2026-06-18  
**Classificação:** Interno — Confidencial  
**Owner:** DPO + Tech Lead  
**Revisão:** Sempre que houver adição, substituição ou remoção de suboperador

---

## 1. Definição

Suboperadores são fornecedores terceiros que tratam dados pessoais **em nome do VITRAS** para viabilizar a operação da plataforma. Cada suboperador está sujeito a obrigações contratuais de proteção de dados equivalentes ao DPA principal.

---

## 2. Registro de Suboperadores

### 2.1 Infraestrutura Cloud / Hospedagem

| Campo | Valor |
|-------|-------|
| **Fornecedor** | TODO_USER: confirmar — AWS / Render / Google Cloud / Azure / outro |
| **Serviço** | Hospedagem do backend, banco de dados PostgreSQL, armazenamento |
| **Dados acessíveis** | Todos os dados armazenados na plataforma (criptografados em repouso) |
| **País / Região** | TODO_USER: confirmar — ex: Brasil (sa-east-1) ou outro |
| **DPA com fornecedor** | TODO_USER: confirmar se existe DPA / Data Processing Addendum assinado |
| **Certificações de segurança** | TODO_USER: confirmar — ex: ISO 27001, SOC 2 |
| **URL da política de privacidade do fornecedor** | TODO_USER |

---

### 2.2 Banco de Dados Gerenciado

| Campo | Valor |
|-------|-------|
| **Fornecedor** | TODO_USER: confirmar — ex: Neon (PostgreSQL serverless) / RDS / outro |
| **Serviço** | Banco de dados relacional PostgreSQL |
| **Dados acessíveis** | Todos os dados da app_state, shadow tables, audit logs |
| **País / Região** | TODO_USER: confirmar |
| **DPA com fornecedor** | TODO_USER |

---

### 2.3 Monitoramento e Logs de Infraestrutura

| Campo | Valor |
|-------|-------|
| **Fornecedor** | TODO_USER: confirmar — ex: AWS CloudWatch / Datadog / outro |
| **Serviço** | Logs de aplicação, métricas, alertas |
| **Dados acessíveis** | Logs técnicos — podem conter IPs, IDs de sessão, IDs de usuário |
| **Dados sensíveis de pacientes** | Não deveriam estar presentes nos logs técnicos (redaction implementado) |
| **País / Região** | TODO_USER |
| **DPA com fornecedor** | TODO_USER |

---

### 2.4 E-mail Transacional / Notificações

| Campo | Valor |
|-------|-------|
| **Fornecedor** | TODO_USER: confirmar — ex: SendGrid / SES / Resend / nenhum no momento |
| **Serviço** | Envio de e-mails de sistema (recuperação de senha, notificações) |
| **Dados acessíveis** | E-mail do destinatário, nome (se incluído no template) |
| **País / Região** | TODO_USER |
| **DPA com fornecedor** | TODO_USER |

*Se não houver envio de e-mail transacional ainda: declarar "Nenhum suboperador de e-mail no momento".*

---

### 2.5 Backup e Recuperação

| Campo | Valor |
|-------|-------|
| **Fornecedor** | TODO_USER: confirmar — pode ser o mesmo da infraestrutura cloud |
| **Serviço** | Snapshots e backups do banco de dados |
| **Dados acessíveis** | Cópia integral dos dados, incluindo dados assistenciais criptografados |
| **País / Região** | TODO_USER |
| **DPA com fornecedor** | TODO_USER |

---

### 2.6 CI/CD e Repositório de Código

| Campo | Valor |
|-------|-------|
| **Fornecedor** | TODO_USER: confirmar — ex: GitHub / GitLab |
| **Serviço** | Repositório de código-fonte, pipeline de deploy |
| **Dados de produção acessíveis** | Não — código-fonte não deve conter dados reais de pacientes |
| **Atenção** | Confirmar que variáveis de ambiente de produção não estão em commits |
| **DPA com fornecedor** | TODO_USER |

---

## 3. Suboperadores Explicitamente Ausentes

Os seguintes serviços **não são utilizados** pelo VITRAS APS (declaração afirmativa):

| Serviço | Status |
|---------|--------|
| Plataformas de analytics/marketing com dados pessoais de pacientes | NÃO UTILIZADO |
| CRMs com dados pessoais de pacientes | NÃO UTILIZADO |
| Serviços de IA/ML externos que processam dados de pacientes | NÃO UTILIZADO |
| Ferramentas de gravação de sessão (heatmaps) na interface clínica | NÃO UTILIZADO |

---

## 4. Processo de Adição de Novo Suboperador

1. Tech Lead identifica necessidade de novo fornecedor
2. DPO avalia impacto à privacidade e obrigação de DPA
3. Jurídico / CEO aprova
4. DPA ou cláusulas de proteção de dados negociadas com o fornecedor
5. Controladores afetados notificados com **15 dias de antecedência** (conforme DPA, Cláusula 6)
6. Registro atualizado aqui

---

## 5. Revisão do Registro

| Data | Evento | Responsável |
|------|--------|-------------|
| TODO_USER | Registro inicial — draft | TODO_USER: DPO |
| — | TODO_USER: próxima revisão (semestral recomendado) | DPO |

---

*VITRAS APS · Registro de Suboperadores v1.0-draft · 2026-06-18*
