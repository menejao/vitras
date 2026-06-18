# Pilot Go-Live Checklist — VITRAS APS / Primeiro Município

**Versão:** 1.0  
**Data:** 2026-06-18  
**Instrução:** preencher PASS / FAIL / N/A. Todo FAIL bloqueia o go-live.

---

## 1. Infraestrutura

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 1.01 | Elastic Beanstalk ativo | Ambiente `vitras-prod` rodando, health = OK | | |
| 1.02 | Banco de dados ativo | PostgreSQL RDS acessível, não em manutenção | | |
| 1.03 | SSL/TLS válido | Certificado não expirado, HTTPS forçado | | |
| 1.04 | Domínio resolvendo | `app.vitras.com.br` responde em < 2s | | |
| 1.05 | Backup automático ativo | RDS automated backups habilitados, retenção >= 7d | | |
| 1.06 | CloudWatch alarmes ativos | CPU, memória, erros 5xx monitorados | | |
| 1.07 | Service worker | SW registrado, app funciona offline básico | | |
| 1.08 | Deploy zip íntegro | Último deploy concluiu sem erro no EB console | | |

---

## 2. Usuários e Perfis

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 2.01 | Usuários criados | Todos profissionais da UBS com conta ativa | | |
| 2.02 | Roles corretos | Médico=doctor, Enfermeira=nurse_manager, ACS=acs, etc. | | |
| 2.03 | Capabilities configuradas | Agenda, farmácia, referrals conforme perfil | | |
| 2.04 | Primeiro acesso testado | Fluxo /activate funciona para cada perfil | | |
| 2.05 | 2FA ativo | Autenticação dois fatores habilitada nos perfis clínicos | | |
| 2.06 | Recepção testada | Perfil receptionist acessa ReceptionistApp sem erro | | |
| 2.07 | Gestor testado | Perfil gestor não vê campos clínicos sensíveis | | |
| 2.08 | Senha forte exigida | Política de senha mínima aplicada (8 chars, maiúsc, símbolo) | | |

---

## 3. Configuração da UBS

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 3.01 | CNES cadastrado | Campo CNES preenchido na UBS | | |
| 3.02 | INE cadastrado | Campo INE preenchido na equipe | | |
| 3.03 | Código IBGE correto | Município correto (7 dígitos) | | |
| 3.04 | Nome UBS correto | Nome corresponde ao SCNES | | |
| 3.05 | Equipe configurada | Profissionais vinculados à equipe | | |
| 3.06 | Microáreas cadastradas | ACS com microáreas atribuídas | | |

---

## 4. LGPD

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 4.01 | DPA assinado | Acordo de Processamento de Dados assinado com o município | | |
| 4.02 | Política de privacidade pública | vitras.com.br/privacidade acessível | | |
| 4.03 | DPO nomeado | João Pedro Menegucci Benedito / lgpd@vitras.com.br | | |
| 4.04 | RIPD elaborado | Relatório de Impacto disponível | | |
| 4.05 | Audit log ativo | Todos os acessos registrados | | |
| 4.06 | Retenção de dados definida | Política de retenção documentada e aplicada | | |
| 4.07 | Gestor sem campos sensíveis | F7-03 ativo — gestor não recebe dados clínicos especiais | | |
| 4.08 | Treinamento LGPD realizado | Profissionais orientados sobre uso dos dados | | |

---

## 5. Backup e Recuperação

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 5.01 | Backup diário confirmado | RDS snapshot gerado no último ciclo | | |
| 5.02 | Restore testado | Procedimento de restore executado em staging | | |
| 5.03 | RTO documentado | Tempo máximo de recuperação definido (ref: DR Drill = 100min) | | |
| 5.04 | Backup versionado | Arquivos de configuração em git | | |
| 5.05 | Runbook DR disponível | docs/disaster-recovery.md acessível | | |

---

## 6. Auditoria

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 6.01 | Audit log ativo em produção | Tabela audit_logs populando | | |
| 6.02 | Eventos críticos auditados | Login, logout, acesso paciente, delete registrado | | |
| 6.03 | Hash chain ativo | AUD-01 v2 hashVersion configurado | | |
| 6.04 | Acesso restrito | Apenas nurse_manager/doctor/gestor/security_auditor | | |
| 6.05 | Export de audit funcional | /audit-logs/export retorna CSV válido | | |

---

## 7. Treinamento

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 7.01 | Médico treinado | Fluxo de atendimento + prescrição demonstrado | | |
| 7.02 | Enfermeira treinada | Triagem + prontuário + protocolo | | |
| 7.03 | ACS treinado | Cadastro Individual + Domiciliar + tarefas | | |
| 7.04 | Recepção treinada | Fila de espera + agendamento | | |
| 7.05 | Gestor treinado | Dashboard + relatórios + gestão de usuários | | |
| 7.06 | Material de suporte disponível | Guia rápido ou vídeo por perfil | | |

---

## 8. Exportação CDS

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 8.01 | Módulo e-SUS visível | Aba CDS Export acessível para perfil autorizado | | |
| 8.02 | Export FCI funcional | Arquivo .esus gerado com FCI | | |
| 8.03 | Export FCD funcional | Arquivo .esus gerado com FCD | | |
| 8.04 | Export FAI funcional | Arquivo .esus gerado com FAI | | |
| 8.05 | Homologação PEC concluída | Pelo menos 1 sessão de homologação PASS | | |
| 8.06 | Operador treinado para export | Sabe gerar e importar arquivo no PEC | | |

---

## 9. Suporte

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 9.01 | Canal de suporte definido | E-mail ou WhatsApp de suporte comunicado | | |
| 9.02 | SLA definido | Tempos de resposta por severidade documentados | | |
| 9.03 | Runbook de incidentes disponível | docs/pilot/support-runbook.md acessível | | |
| 9.04 | War room configurado | Checkpoints primeiras 2 semanas agendados | | |
| 9.05 | Escalonamento definido | Quem acionar em SEV1 — tech lead + gestor municipal | | |

---

## 10. Rollback

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 10.01 | Versão anterior documentada | Deploy anterior identificado e acessível | | |
| 10.02 | Rollback EB testado | Procedimento de rollback EB executável < 15 min | | |
| 10.03 | Critérios de rollback definidos | Quando ativar rollback (SEV1 sem fix em 2h) | | |
| 10.04 | Comunicação de rollback planejada | Mensagem para município pronta | | |

---

## Critério de Go-Live

**GO:** todos os itens 1.xx–10.xx = PASS ou N/A documentado, zero FAIL em 1.01, 1.04, 4.01, 4.02, 8.05, 9.01.  
**NO GO:** qualquer FAIL em item crítico listado acima.

---

*VITRAS APS — docs/pilot/go-live-checklist.md*
