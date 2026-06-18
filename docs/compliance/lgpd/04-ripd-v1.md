# Relatório de Impacto à Proteção de Dados Pessoais (RIPD)

**VITRAS APS — v1.0-draft**  
**Data:** 2026-06-18  
**Classificação:** Interno — Confidencial  
**DPO:** TODO_USER: nome do DPO  
**Aprovação:** Pendente (TODO_USER: data de aprovação)

---

## 1. Identificação

| Campo | Valor |
|-------|-------|
| Empresa | TODO_USER: razão social |
| CNPJ | TODO_USER |
| Sistema | VITRAS APS |
| Versão do sistema | Sprint 5A+ |
| Papel LGPD | Operador (principal) / Controlador (dados admin internos) |
| Escopo deste RIPD | Tratamentos em nome de Municípios/UBS contratantes |

---

## 2. Descrição Geral dos Tratamentos

O VITRAS APS é uma plataforma de Atenção Primária à Saúde que viabiliza:

1. **Cadastro Individual** — registro de pacientes com dados cadastrais e de saúde
2. **Cadastro Domiciliar** — registro de domicílios e condições habitacionais
3. **Atendimento Individual** — registro de consultas e procedimentos clínicos
4. **Exportação CDS/e-SUS** — serialização de fichas para importação no PEC e-SUS APS (LEDI 7.4.x)
5. **Auditoria** — cadeia de auditoria SHA-256 para rastreabilidade de todos os eventos
6. **Controle de acesso** — RBAC por perfil de usuário
7. **Suporte operacional** — diagnóstico técnico em nome do Controlador

---

## 3. Análise de Necessidade e Proporcionalidade

| Tratamento | É necessário? | É proporcional? | Alternativa menos invasiva? |
|-----------|--------------|-----------------|----------------------------|
| CPF + CNS | Sim — identificação única do paciente no SUS | Sim | Não — CNS exigido pelo SISAB |
| CID-10 / CIAP-2 | Sim — obrigação de notificação SISAB | Sim | Não — exigência federal |
| HIV gestante / sífilis | Sim — vigilância epidemiológica obrigatória | Sim — minimizado em audit | Não — notificação compulsória |
| Nome social | Sim — atendimento humanizado e não-discriminatório | Sim | — |
| Condições de moradia | Sim — territorialidade e saúde da família | Sim | Não — exigência CDS |
| Audit chain | Sim — rastreabilidade e accountability | Sim | — |
| Break-glass log | Sim — controle de acesso emergencial | Sim | — |

---

## 4. Bases Legais

| Tratamento | Base legal LGPD | Dispositivo |
|-----------|----------------|-------------|
| Dados cadastrais assistenciais | Obrigação legal / Tutela da saúde | Art. 7º, II; Art. 11, II, "a" e "f" |
| Dados sensíveis de saúde (CID, CIAP, HIV, sífilis) | Tutela da saúde / Obrigação legal | Art. 11, II, "f"; Lei 6.259/75 (notificação) |
| Exportação CDS para SISAB/PEC | Obrigação legal | Art. 7º, II; Portaria MS 1.412/2013 |
| Logs de auditoria | Legítimo interesse do controlador / Obrigação legal | Art. 7º, IX; Art. 11, II |
| Controle de acesso | Execução de contrato / Legítimo interesse | Art. 7º, V |
| Dados do profissional de saúde | Execução de contrato | Art. 7º, V |
| Suporte técnico | Execução de contrato | Art. 7º, V |

---

## 5. Inventário de Riscos

### RISCO-01: Acesso indevido por usuário interno

| Campo | Valor |
|-------|-------|
| Descrição | Usuário com credencial válida acessa dados de pacientes fora do escopo de sua função |
| Probabilidade | Média |
| Impacto | Alto — dados de saúde sensíveis |
| Mitigação existente | RBAC por perfil, territorialidade por unidade, audit chain, capability gate cds.export |
| Risco residual | Baixo |
| Ação adicional recomendada | Alertas de anomalia de acesso (volume fora do padrão) |

---

### RISCO-02: Exportação CDS indevida

| Campo | Valor |
|-------|-------|
| Descrição | Usuário não autorizado exporta ficheiro .esus contendo dados de saúde |
| Probabilidade | Baixa |
| Impacto | Alto |
| Mitigação existente | `cds.export` restrito a gestor + break_glass_admin; log forçado de toda exportação; campo exportedBy auditado |
| Risco residual | Muito baixo |
| Ação adicional recomendada | Alerta por e-mail ao gestor na exportação (opcional) |

---

### RISCO-03: Vazamento de dados de saúde por brecha técnica

| Campo | Valor |
|-------|-------|
| Descrição | Exploração de vulnerabilidade na API ou banco de dados expõe dados de pacientes |
| Probabilidade | Baixa |
| Impacto | Muito alto — dados sensíveis em massa |
| Mitigação existente | Criptografia AES-256-GCM em campos sensíveis, HTTPS, JWT, isolamento multi-tenant |
| Risco residual | Médio (depende de maturidade do processo de patch e pentest) |
| Ação adicional recomendada | Pentest anual, SAST no CI/CD, monitoramento de anomalias |

---

### RISCO-04: Exposição de nome civil de pessoa trans

| Campo | Valor |
|-------|-------|
| Descrição | Nome civil (retificado ou não) de paciente trans é exibido em interface operacional |
| Probabilidade | Baixa — controle implementado |
| Impacto | Alto — discriminação, constrangimento, dano moral |
| Mitigação existente | Nome social como identidade operacional; nome civil oculto em superfícies operacionais |
| Risco residual | Muito baixo |
| Ação adicional recomendada | Teste de regressão específico para garantia do controle a cada release |

---

### RISCO-05: Uso indevido do break-glass

| Campo | Valor |
|-------|-------|
| Descrição | Administrador usa acesso break-glass fora de situação de emergência real |
| Probabilidade | Baixa |
| Impacto | Alto — acesso privilegiado sem supervisão |
| Mitigação existente | Restrito a `break_glass_admin`; todo acesso gera log imutável; audit chain SHA-256 |
| Risco residual | Baixo |
| Ação adicional recomendada | Revisão periódica dos logs break-glass pelo DPO (mensal) |

---

### RISCO-06: Dados sensíveis em logs de auditoria

| Campo | Valor |
|-------|-------|
| Descrição | CID-10, CIAP-2, HIV gestante ou sífilis aparecem em `details.before`/`after` de eventos de auditoria |
| Probabilidade | Baixa — controle implementado |
| Impacto | Médio — dados sensíveis em log acessível a administradores |
| Mitigação existente | `SPECIAL_CATEGORY_FIELDS` redactados em todos os eventos de auditoria |
| Risco residual | Muito baixo |
| Ação adicional recomendada | Teste de regressão do redaction a cada release que altere campos de saúde |

---

### RISCO-07: Erro na importação CDS no PEC (dados incorretos no SISAB)

| Campo | Valor |
|-------|-------|
| Descrição | Ficheiro .esus com dados incorretos é importado no PEC, gerando registros equivocados no SISAB federal |
| Probabilidade | Média (enquanto não houver homologação com PEC real) |
| Impacto | Médio — impacto em indicadores de saúde pública |
| Mitigação existente | Audit log de toda exportação; campo fichaUuid rastreável; conformidade IDL LEDI 7.4.x validada (A-04) |
| Risco residual | Médio — depende de homologação M-07/M-08/M-09 |
| Ação adicional recomendada | Completar homologação M-05 a M-10 antes do piloto produtivo |

---

### RISCO-08: Incidente em infraestrutura cloud

| Campo | Valor |
|-------|-------|
| Descrição | Falha, brecha ou incidente no provedor cloud expõe ou perde dados |
| Probabilidade | Baixa |
| Impacto | Muito alto |
| Mitigação existente | Backups periódicos; staging isolado de produção |
| Risco residual | Médio |
| Ação adicional recomendada | DPA com provedor cloud; backup fora da região primária; RTO/RPO definidos |

---

### RISCO-09: Acesso por usuário municipal indevido (multi-tenant)

| Campo | Valor |
|-------|-------|
| Descrição | Usuário de um município acessa dados de outro município |
| Probabilidade | Baixa — isolamento por design |
| Impacto | Alto |
| Mitigação existente | Isolamento multi-tenant por workspace; RBAC por unidade; territorialidade |
| Risco residual | Baixo |
| Ação adicional recomendada | Teste de penetração de isolamento entre tenants |

---

## 6. Matriz de Risco Consolidada

| ID | Risco | Probabilidade | Impacto | Risco Bruto | Risco Residual |
|----|-------|--------------|---------|-------------|---------------|
| R-01 | Acesso indevido interno | Média | Alto | Alto | Baixo |
| R-02 | Exportação CDS indevida | Baixa | Alto | Médio | Muito baixo |
| R-03 | Vazamento por brecha técnica | Baixa | Muito alto | Alto | Médio |
| R-04 | Exposição nome civil trans | Baixa | Alto | Médio | Muito baixo |
| R-05 | Uso indevido break-glass | Baixa | Alto | Médio | Baixo |
| R-06 | Dados sensíveis em logs | Baixa | Médio | Baixo | Muito baixo |
| R-07 | Erro importação CDS | Média | Médio | Médio | Médio* |
| R-08 | Incidente cloud | Baixa | Muito alto | Alto | Médio |
| R-09 | Vazamento multi-tenant | Baixa | Alto | Médio | Baixo |

*R-07: risco residual reduz para Baixo após conclusão de M-07/M-08/M-09.

---

## 7. Aprovação

| Papel | Nome | Data | Assinatura |
|-------|------|------|-----------|
| DPO | TODO_USER | TODO_USER | |
| CEO / Representante Legal | TODO_USER | TODO_USER | |
| Revisão prevista | — | TODO_USER (anual ou em mudança de escopo) | — |

---

*VITRAS APS · RIPD v1.0-draft · 2026-06-18*
