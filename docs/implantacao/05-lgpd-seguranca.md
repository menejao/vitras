# 05 — LGPD e Segurança

**Versão:** 1.0 | **Produto:** VITRAS APS | **Aplicação:** qualquer UBS do Brasil

---

## Base Legal

O VITRAS APS opera com base legal no **Art. 7º, inciso III da LGPD** (execução de políticas públicas) e **Art. 11º, inciso II, alínea b** (dado de saúde em política pública de saúde).

A responsabilidade pelo tratamento de dados é **compartilhada** entre o fornecedor (VITRAS) e o operador local (UBS/Secretaria Municipal de Saúde).

---

## Checklist LGPD — Obrigatório antes do Go-Live

### A — Estrutura Legal

| # | Item | Obrigatório | Status |
|---|------|-------------|--------|
| A1 | DPO/Encarregado formalmente designado (Art. 41 LGPD) | **SIM** | [ ] |
| A2 | DPA (Data Processing Agreement / Contrato de Responsabilidade Compartilhada) assinado entre UBS/SMS e VITRAS | **SIM** | [ ] |
| A3 | Política de privacidade da UBS publicada ou disponível ao titular | **SIM** | [ ] |
| A4 | Processo de notificação à ANPD em 72h documentado | **SIM** | [ ] |
| A5 | Canal de atendimento para titular exercer direitos definido | **SIM** | [ ] |

---

### B — Controle de Acesso e Identidade

| # | Item | Obrigatório | Status |
|---|------|-------------|--------|
| B1 | 2FA ativo para gestor | **SIM** | [ ] |
| B2 | 2FA ativo para enfermeiro | **SIM** | [ ] |
| B3 | 2FA ativo para médico (se houver) | **SIM** | [ ] |
| B4 | Senhas iniciais trocadas por todos os usuários | **SIM** | [ ] |
| B5 | Senha mínima: 8 caracteres, maiúscula, número, especial | **SIM** | [ ] |
| B6 | Nenhuma senha padrão ou demo em produção | **SIM** | [ ] |
| B7 | Acesso Break Glass documentado e restrito | **SIM** | [ ] |
| B8 | `break_glass_admin` não usado como conta operacional diária | **SIM** | [ ] |

---

### C — Auditoria e Rastreabilidade

| # | Item | Obrigatório | Status |
|---|------|-------------|--------|
| C1 | Auditoria ativa (`/audit-logs` retorna eventos) | **SIM** | [ ] |
| C2 | Retenção configurada (mínimo 2 anos — `AUDIT_LOG_RETENTION_DAYS=730`) | **SIM** | [ ] |
| C3 | Exportação de logs testada (JSON e CSV) | **SIM** | [ ] |
| C4 | `AUDIT_PRUNE_ENABLED=true` na env (prune habilitado, não executa automaticamente) | **SIM** | [ ] |
| C5 | Responsável por revisão mensal de audit logs designado | Recomendado | [ ] |

---

### D — Proteção de Dados em Repouso e Trânsito

| # | Item | Obrigatório | Status |
|---|------|-------------|--------|
| D1 | `DATA_ENCRYPTION_KEY` definido (≥ 32 chars) | **SIM** | [ ] |
| D2 | CPF, CNS, NIS criptografados em repouso (verificado no DB) | **SIM** | [ ] |
| D3 | HTTPS ativo no frontend (Amplify — automático) | **SIM** | [ ] |
| D4 | HTTPS ativo no backend (EB com ALB — verificar certificado) | **SIM** | [ ] |
| D5 | `COOKIE_SECURE=true` em produção | **SIM** | [ ] |
| D6 | CPF/CNS nunca aparecem em logs de auditoria plaintext | **SIM** | [ ] |

---

### E — Direitos do Titular (Art. 18 LGPD)

| # | Direito | Como exercer no VITRAS | Status |
|---|---------|----------------------|--------|
| E1 | Acesso aos dados | `GET /privacy/patient-access-report/[patientId]` | [ ] |
| E2 | Correção de dados | `PATCH /patients/[id]` pelo enfermeiro | [ ] |
| E3 | Anonimização | Endpoint de anonimização (gestor) | [ ] |
| E4 | Portabilidade | Backup export + audit log | [ ] |
| E5 | Oposição ao tratamento | Documentar processo interno; dados de saúde têm restrições legais | [ ] |

> **Nota CFM:** dados clínicos têm retenção obrigatória de 20 anos (CFM 1821/2007). Exclusão completa pode não ser possível — comunicar ao titular.

---

### F — Resposta a Incidente

| # | Item | Obrigatório | Status |
|---|------|-------------|--------|
| F1 | Definição de P0 (dado exposto / sistema indisponível) documentada | **SIM** | [ ] |
| F2 | Definição de P1 (falha funcional crítica) documentada | **SIM** | [ ] |
| F3 | Contatos de escalonamento preenchidos (ver doc 01, Seção G) | **SIM** | [ ] |
| F4 | Prazo de notificação ANPD: 72h após conhecimento do incidente | **SIM** | [ ] |
| F5 | Procedimento de comunicação ao titular documentado | **SIM** | [ ] |
| F6 | Playbook de incidente testado em tabletop exercise | Recomendado | [ ] |

---

## Processo de Notificação de Incidente (Síntese)

```
T+0h  → Identificar incidente → acionar DPO + Tech Lead
T+4h  → Avaliar escopo (dados expostos? quantos titulares?)
T+24h → DPO decide: notificar ANPD? notificar titulares?
T+72h → Limite legal para notificação ANPD (se dado pessoal exposto)
T+?   → Notificar titulares afetados conforme avaliação DPO
```

---

## Checklist de Segurança Técnica

| # | Item | Verificação | Status |
|---|------|-------------|--------|
| S1 | JWT_SECRET único, ≥ 32 chars, não compartilhado | `echo $JWT_SECRET | wc -c` | [ ] |
| S2 | Chaves de criptografia não repetidas entre si | Comparar hashes das chaves | [ ] |
| S3 | Rate limit de login: 10 tentativas / 10 min por IP | Testar manualmente (11 tentativas) | [ ] |
| S4 | CSRF token validado em mutações | `DELETE /patients/X` sem header CSRF → 403 | [ ] |
| S5 | Team scope: ACS não acessa paciente de outra equipe | Testar com token de ACS de equipe B | [ ] |
| S6 | Break Glass auditado: toda ação com `break_glass_admin` aparece em audit log | Executar uma ação; verificar log | [ ] |
| S7 | Secrets não expostos em logs de aplicação | Verificar CloudWatch — buscar por "SECRET" | [ ] |
| S8 | `NODE_ENV=production` ativo | `GET /health` → campo `env: "production"` | [ ] |

---

**Assinatura do Security/LGPD Lead:**  
Data: ______  
Resultado: ______  
Observações: ______
