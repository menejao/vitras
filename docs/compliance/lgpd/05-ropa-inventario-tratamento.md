# Inventário de Tratamento de Dados (ROPA)

**VITRAS APS — Record of Processing Activities**  
**Versão:** 1.0-draft  
**Data:** 2026-06-18  
**DPO:** TODO_USER: nome do DPO  
**Aprovação:** Pendente

---

## Legenda

- **Controlador**: Município/Secretaria de Saúde/UBS contratante
- **Operador**: VITRAS (TODO_USER: razão social)
- **Sensível**: dado de categoria especial (Art. 11 LGPD)
- **Retenção**: prazo mínimo estimado; contrato prevalece se mais restritivo

---

## Processo 1 — Cadastro de Paciente (Cadastro Individual)

| Campo | Valor |
|-------|-------|
| **Processo** | Cadastro Individual de Paciente |
| **Finalidade** | Identificar e registrar pacientes no sistema de APS da UBS |
| **Dados pessoais tratados** | Nome, nome social, data de nascimento, sexo, raça/cor, telefone, e-mail, endereço, microárea, nome da mãe |
| **Dados sensíveis** | Raça/cor, deficiência, situação de rua, HIV gestante, sífilis, identidade de gênero (nome social) |
| **Documentos** | CPF (criptografado), CNS (criptografado), NIS (criptografado), CNS do responsável (criptografado) |
| **Titulares** | Pacientes / cidadãos |
| **Controlador** | Município/Secretaria de Saúde |
| **Operador** | VITRAS |
| **Base legal provável** | Obrigação legal (art. 7º, II); Tutela da saúde (art. 11, II, "f") |
| **Sistemas envolvidos** | app_state (JSONB), app_patients (shadow), banco de dados PostgreSQL |
| **Compartilhamento** | PEC e-SUS (exportação CDS, quando habilitado) |
| **Retenção** | Enquanto durar contrato + obrigação do controlador (mín. 20 anos, CFM) |
| **Controles** | AES-256-GCM em CPF/CNS/NIS, RBAC, audit chain, nome social operacional, redaction em logs |

---

## Processo 2 — Cadastro Domiciliar

| Campo | Valor |
|-------|-------|
| **Processo** | Cadastro Domiciliar |
| **Finalidade** | Registro de domicílios e condições habitacionais para gestão territorial de APS |
| **Dados pessoais tratados** | Endereço do domicílio, número de moradores, condições habitacionais (abastecimento, esgoto, lixo, energia, material) |
| **Dados sensíveis** | Situação de moradia pode inferir vulnerabilidade social |
| **Titulares** | Membros do domicílio / responsável familiar |
| **Controlador** | Município/Secretaria de Saúde |
| **Operador** | VITRAS |
| **Base legal provável** | Obrigação legal / Tutela da saúde |
| **Sistemas envolvidos** | app_state (JSONB), app_households (shadow) |
| **Compartilhamento** | PEC e-SUS (exportação CDS) |
| **Retenção** | Enquanto durar contrato + obrigação do controlador |
| **Controles** | RBAC, audit chain, isolamento por unidade |

---

## Processo 3 — Atendimento Individual

| Campo | Valor |
|-------|-------|
| **Processo** | Registro de Atendimento Clínico Individual |
| **Finalidade** | Documentar consultas, procedimentos e diagnósticos em APS |
| **Dados pessoais tratados** | Identificação do paciente, data, tipo de atendimento, local, turno, profissional responsável |
| **Dados sensíveis** | CID-10 (diagnóstico), CIAP-2 (problema de saúde), HIV gestante, sífilis |
| **Titulares** | Pacientes |
| **Controlador** | Município/Secretaria de Saúde |
| **Operador** | VITRAS |
| **Base legal provável** | Obrigação legal / Tutela da saúde |
| **Sistemas envolvidos** | app_state (JSONB), app_records (shadow) |
| **Compartilhamento** | PEC e-SUS (exportação CDS Atendimento Individual) |
| **Retenção** | Mínimo 20 anos (CFM) — seguir obrigação do controlador |
| **Controles** | RBAC (somente médico/enfermeiro criam registros), redaction em audit, audit chain |

---

## Processo 4 — Exportação CDS/e-SUS

| Campo | Valor |
|-------|-------|
| **Processo** | Exportação de fichas CDS para PEC e-SUS APS |
| **Finalidade** | Cumprir obrigação de alimentação do SISAB (Portaria MS 1.412/2013) |
| **Dados pessoais tratados** | Todos os dados do cadastro e atendimento serializados em LEDI 7.4.x |
| **Dados sensíveis** | CID-10, CIAP-2, condições de saúde, dados domiciliares |
| **Titulares** | Pacientes |
| **Controlador** | Município/Secretaria de Saúde |
| **Operador** | VITRAS |
| **Base legal provável** | Obrigação legal |
| **Sistemas envolvidos** | cds-export (thrift-protocol, cds-structs, esus-packer), PEC e-SUS (Ministério da Saúde) |
| **Compartilhamento** | PEC e-SUS APS (Ministério da Saúde) — dado deixa o ambiente VITRAS após exportação |
| **Retenção** | Log de exportação: mínimo 5 anos; dados no PEC sob governança federal |
| **Controles** | Capability `cds.export` restrito a gestor/break_glass_admin; log com fichaUuid/exportedBy; IDL LEDI 7.4.x validado |

---

## Processo 5 — Login e Autenticação

| Campo | Valor |
|-------|-------|
| **Processo** | Autenticação de usuários (profissionais de saúde e gestores) |
| **Finalidade** | Controle de acesso à plataforma |
| **Dados pessoais tratados** | E-mail, hash de senha, JWT, timestamp de acesso, IP (se registrado) |
| **Dados sensíveis** | Nenhum |
| **Titulares** | Profissionais de saúde, gestores, administradores |
| **Controlador** | VITRAS (dados administrativos internos) / Controlador municipal (usuários da UBS) |
| **Operador** | VITRAS |
| **Base legal provável** | Execução de contrato / Legítimo interesse |
| **Sistemas envolvidos** | app_state (usuários), JWT middleware |
| **Retenção** | Enquanto durar vínculo contratual + 2 anos |
| **Controles** | JWT com expiração, RBAC, hash de senha bcrypt |

---

## Processo 6 — Audit Logs (Cadeia de Auditoria)

| Campo | Valor |
|-------|-------|
| **Processo** | Registro de auditoria de eventos da plataforma |
| **Finalidade** | Rastreabilidade, accountability, detecção de incidentes, suporte a direitos dos titulares |
| **Dados pessoais tratados** | ID do usuário que executou a ação, ID do paciente afetado, timestamp, tipo de evento |
| **Dados sensíveis** | Dados sensíveis redactados (`SPECIAL_CATEGORY_FIELDS`); tipo do evento pode inferir categoria de dado |
| **Titulares** | Pacientes (indiretamente), profissionais de saúde (como atores) |
| **Controlador** | Município/Secretaria de Saúde (para eventos assistenciais) / VITRAS (para eventos técnicos) |
| **Operador** | VITRAS |
| **Base legal provável** | Obrigação legal / Legítimo interesse |
| **Sistemas envolvidos** | app_audit_logs, audit chain SHA-256 v2 |
| **Retenção** | Mínimo 5 anos |
| **Controles** | Hash encadeado SHA-256 (imutabilidade), redaction de campos sensíveis, acesso restrito a break_glass_admin/gestor |

---

## Processo 7 — Suporte Técnico

| Campo | Valor |
|-------|-------|
| **Processo** | Diagnóstico e resolução de incidentes técnicos |
| **Finalidade** | Garantir funcionamento da plataforma; apoiar o controlador na resolução de problemas |
| **Dados pessoais tratados** | Logs técnicos (podem conter IDs de pacientes/usuários), screenshots de erro informados pelo cliente |
| **Dados sensíveis** | Acidental — minimização obrigatória |
| **Titulares** | Pacientes (acidentalmente), profissionais |
| **Controlador** | VITRAS (para dados técnicos internos) |
| **Operador** | VITRAS |
| **Base legal provável** | Execução de contrato / Legítimo interesse |
| **Sistemas envolvidos** | Logs de aplicação, CloudWatch (TODO_USER: confirmar), canais de suporte |
| **Retenção** | 90 dias para logs técnicos; dados de tickets: 2 anos |
| **Controles** | Acesso restrito à equipe técnica; pseudonimização quando possível; NDA dos colaboradores |

---

## Processo 8 — Administração de Usuários

| Campo | Valor |
|-------|-------|
| **Processo** | Criação, edição e desativação de contas de usuários da UBS |
| **Finalidade** | Gestão do acesso à plataforma por perfil e unidade |
| **Dados pessoais tratados** | Nome, e-mail, CNS do profissional (TODO_USER: confirmar), CBO, perfil de acesso, unidade vinculada |
| **Dados sensíveis** | Nenhum |
| **Titulares** | Profissionais de saúde, gestores |
| **Controlador** | Município/Secretaria de Saúde |
| **Operador** | VITRAS |
| **Base legal provável** | Execução de contrato |
| **Retenção** | Enquanto durar vínculo + 2 anos |
| **Controles** | RBAC, audit chain, acesso restrito a gestor/nurse_manager para criação de usuários |

---

## Processo 9 — Break-Glass (Acesso de Emergência)

| Campo | Valor |
|-------|-------|
| **Processo** | Acesso privilegiado em situação de emergência operacional |
| **Finalidade** | Diagnóstico e resolução de incidentes críticos que exigem acesso a dados normalmente restritos |
| **Dados pessoais tratados** | Potencialmente qualquer dado no sistema |
| **Dados sensíveis** | Potencialmente todos |
| **Titulares** | Pacientes, profissionais |
| **Controlador** | VITRAS (uso interno de emergência) |
| **Base legal provável** | Legítimo interesse / Execução de contrato |
| **Sistemas envolvidos** | Perfil break_glass_admin; audit chain |
| **Retenção** | Log de break-glass: 5 anos |
| **Controles** | Restrito a `break_glass_admin`; todo acesso gera log imutável; revisão mensal pelo DPO |

---

## Processo 10 — Read-Only Outage Mode

| Campo | Valor |
|-------|-------|
| **Processo** | Operação em modo somente-leitura durante falha ou manutenção |
| **Finalidade** | Garantir continuidade do acesso a dados históricos sem risco de escrita indevida |
| **Dados pessoais tratados** | Dados em leitura (sem novo tratamento) |
| **Dados sensíveis** | Idem aos processos 1–4 |
| **Base legal provável** | Execução de contrato / Obrigação legal |
| **Controles** | Bloqueio de escrita por design; sem novos dados criados ou modificados |

---

## Aprovação

| Papel | Nome | Data |
|-------|------|------|
| DPO | TODO_USER | TODO_USER |
| Revisão prevista | — | TODO_USER (anual) |

---

*VITRAS APS · ROPA v1.0-draft · 2026-06-18*
