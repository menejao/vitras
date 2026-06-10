# Aceite Operacional — UBS #1

**Versão implantada:** v1.0-pilot-governed  
**Data de implantação:** _____ / _____ / _______  
**UBS:** ___________________________________  
**Ambiente:** vitras-drill-sa-3 (sa-east-1)

> **INSTRUÇÃO:** Preencher durante ou imediatamente após o go-live assistido.
> Tech Lead preenche Seção A. UBS Coordinator preenche Seção B.
> Assinaturas ao final obrigatórias para encerrar o aceite formal.

---

## Seção A — Critérios de aceite técnico
*Verificar e assinar: Tech Lead (João Pedro)*

| # | Critério | Método de verificação | Resultado | Verificado em | OK? |
|---|----------|----------------------|-----------|---------------|-----|
| A-01 | Deploy completado sem erros | `aws eb describe-environment-health` → Green | ____________ | __:__ | [ ] |
| A-02 | `/readyz` retorna HTTP 200 com `ok: true` | `curl /readyz` | ____________ | __:__ | [ ] |
| A-03 | `/health` mostra `postgres=ok, migrations=ok` | `curl /health` | ____________ | __:__ | [ ] |
| A-04 | 11/11 migrations aplicadas (001–011) | `/health subsystems.migrations=ok` + `SELECT COUNT(*) FROM schema_migrations` = 11 | ____________ | __:__ | [ ] |
| A-05 | Login breakglass operacional | `POST /auth/login` → role=break_glass_admin | ____________ | __:__ | [ ] |
| A-06 | Audit log registrando eventos | `GET /audit-logs` → eventos presentes | ____________ | __:__ | [ ] |
| A-07 | EB health check = HTTP:/readyz | AWS Console → EB Configuration | ____________ | __:__ | [ ] |
| A-08 | RDS backup habilitado | `aws rds describe-db-instances` → backup ≥ 1 dia | ____________ | __:__ | [ ] |
| A-09 | Rollback disponível (versão anterior existe) | `aws eb describe-application-versions` | ____________ | __:__ | [ ] |
| A-10 | ACS não acessa paciente de outra equipe | GET /patients/[id-outra-equipe] com token ACS → 403 | ____________ | __:__ | [ ] |

**Critério de GO técnico:** A-01 a A-07 todos marcados OK. A-08 e A-09 documentados mesmo se não OK (aceite com risco registrado).

---

## Seção B — Critérios de aceite operacional (UBS)
*Verificar e assinar: Coordenador UBS*

| # | Critério | Como verificar | Resultado | Verificado em | OK? |
|---|----------|---------------|-----------|---------------|-----|
| B-01 | Sistema acessível pelo navegador da recepção | Abrir URL no computador da recepção → login | ____________ | __:__ | [ ] |
| B-02 | Login funciona para todos os perfis presentes | Teste com gestor + enfermeiro + ACS se disponível | ____________ | __:__ | [ ] |
| B-03 | Paciente criado com sucesso | Criar paciente de teste no sistema | ____________ | __:__ | [ ] |
| B-04 | Agenda acessível | Abrir lista de agendamentos | ____________ | __:__ | [ ] |
| B-05 | Fila acessível | Abrir fila de atendimento | ____________ | __:__ | [ ] |
| B-06 | Equipe sabe o que fazer se sistema ficar fora | Perguntar: "O que você faz se aparecer erro 503?" | ____________ | __:__ | [ ] |
| B-07 | Canal de suporte conhecido | Equipe sabe como acionar João Pedro | ____________ | __:__ | [ ] |
| B-08 | Protocolo de papel confirmado | Papel disponível + equipe sabe quando usar | ____________ | __:__ | [ ] |
| B-09 | `contatos.md` preenchido e impresso | Cópia física na UBS ou acesso digital | ____________ | __:__ | [ ] |
| B-10 | Tabletop executado (score ≥ 3/5) | `tabletop-final-report.md` preenchido | ____________ | __:__ | [ ] |

**Critério de GO operacional:** B-01 a B-07 todos marcados OK. B-08 a B-10 documentados.

---

## Seção C — Riscos aceitos (registrar formalmente)

| Risco | Aceito por | Data | Observação |
|-------|-----------|------|------------|
| **B-07** RDS backup retention = 1 dia (Free Tier) — ver aceite formal abaixo | João Pedro + Coordenador UBS + Médico Resp. | ________ | **Upgrade AWS obrigatório antes de UBS #2** — ver condições abaixo |
| CORS_ALLOW_ALL=true (temporário) | ____________ | ________ | Substituir quando domínio HTTPS definido |
| COOKIE_SECURE=false (HTTP-only) | ____________ | ________ | Ativar quando HTTPS ativado |
| Upstash não configurado (single-instance) | ____________ | ________ | Provisionar antes de UBS #2 |
| Sem Multi-AZ no RDS | ____________ | ________ | Failover manual aceitável no piloto |
| LGPD anonymization bloqueada (KI-02) | ____________ | ________ | Endpoint desabilitado até Sprint 5A |

---

### ACEITE FORMAL — RISCO B-07: RDS BACKUP RETENTION

O risco de janela de PITR limitada a 24 horas é reconhecido e aceito para o piloto controlado UBS-001 com as seguintes condições ativas: (1) protocolo de papel paralelo ativo; (2) snapshots manuais antes de cada deploy; (3) Tech Lead on-call D+0–D+7 com RTO comprovado de 100 min 35 seg (medido em DR Drill 2026-06-09); (4) volume reduzido de pacientes torna re-lançamento manual viável em caso de restore necessário.

**Causa raiz:** `FreeTierRestrictionError` — conta AWS Free Tier limita `--backup-retention-period` a 1 dia. Evidência: `go-final-readiness-report.md` BT-02 (requalificado em 2026-05-26).

**Comprometimento irrevogável:** Upgrade AWS e execução de `aws rds modify-db-instance --db-instance-identifier vitras-drill-sa-3 --backup-retention-period 7 --apply-immediately` obrigatórios antes de qualquer expansão (UBS #2, novos municípios, ou aumento de volume além do piloto UBS-001). **Sem upgrade confirmado e documentado, UBS #2 não recebe GO.**

**Aceito por:**
- João Pedro — Tech Lead VITRAS: _________________________ Data: _____ / _____ / _______
- Coordenador UBS-001: _________________________ Data: _____ / _____ / _______
- Médico Responsável (CRM): _________________________ Data: _____ / _____ / _______

---

## Declaração de aceite

Confirmamos que o sistema VITRAS versão **v1.0-pilot-governed** foi implantado com sucesso, os critérios técnicos e operacionais foram verificados conforme descrito acima, e a equipe está preparada para operar o sistema com suporte da equipe técnica VITRAS durante o período de observação de 14 dias.

---

**Tech Lead VITRAS:**  
Nome: João Pedro  
Assinatura: _________________________  
Data: _____ / _____ / _______  
Hora da declaração de GO: _____ : _____ UTC

---

**Coordenador UBS:**  
Nome: _________________________________  
Cargo: _________________________________  
Assinatura: _____________________________  
Data: _____ / _____ / _______

---

**Médico responsável (CFM) — responsabilidade pelo prontuário eletrônico:**  
Nome: _________________________________  
CRM: ___________________________________  
Assinatura: _____________________________  
Data: _____ / _____ / _______

---

## Período de observação (D+0 a D+14)

Início: _____ / _____ / _______ (data do aceite)  
Fim previsto: _____ / _____ / _______

Durante este período:
- Sem novas features ou mudanças de schema
- Suporte intensivo João Pedro D+0 a D+7 (on-call)
- Revisão diária conforme `docs/operations/operational-routines.md`
- Qualquer P0 ou P1 paralisa planejamento de UBS #2
- Relatório D+14 (`d14-report.md`) obrigatório para encerramento

Critérios de encerramento do período de observação:
- Zero P0/P1 nos últimos 7 dias
- Rotina operacional estabelecida (equipe autônoma nas tarefas diárias)
- `d14-report.md` assinado por Tech Lead e Coordenador UBS
