# Considerações LGPD e CFM 1821/2007 — VITRAS

> **Revisão:** Sprint 4 — Maio 2026
> **Status Legal:** Revisão jurídica necessária antes de produção regulada

---

## 1. Contexto Legal

### 1.1 LGPD — Lei Geral de Proteção de Dados (Lei 13.709/2018)

- **Art. 18, IV:** Direito de erasure (anonimização ou exclusão de dados pessoais desnecessários)
- **Art. 16:** Término do tratamento — dados pessoais devem ser eliminados após o fim da finalidade
- **Art. 48:** Notificação de incidentes à ANPD em até 72 horas

**Base legal para tratamento de dados de saúde:**
- Art. 11, II, f — Proteção da vida e tutela da saúde
- Art. 7, IX — Legítimo interesse

### 1.2 CFM 1821/2007 — Prontuário Eletrônico

- **Prazo mínimo de guarda:** 20 anos a partir do último atendimento
- **Obrigação:** Médicos e instituições devem manter prontuários acessíveis para fins de auditoria, continuidade do cuidado e defesa legal
- **Conteúdo protegido:** Histórico de consultas, prescrições, atestados médicos, encaminhamentos

---

## 2. Tensão Atual — LGPD vs CFM

### 2.1 O Problema

A função `anonymizePatientBundle()` (em `src/utils/patients.js`) implementa erasure LGPD:
- Remove dados identificáveis do paciente (nome, CPF, CNS, endereço)
- **Exclui registros clínicos** (`clinicalRecords`) associados ao paciente

Esta implementação **conflita com CFM 1821/2007**, que exige retenção por 20 anos.

### 2.2 Estado Atual — LGPD Vence

Na implementação atual, LGPD erasure prevalece sobre retenção CFM. Isto pode ser adequado legalmente **somente se**:
1. O paciente exerceu explicitamente o direito de erasure (Art. 18, IV)
2. Não há base legal conflitante que obrigue retenção (ex.: ação judicial em andamento)
3. O médico responsável foi notificado e concordou com a exclusão

### 2.3 Resíduo de PII em Clinical Snapshots

**Atenção:** Registros de tipo `prescription`, `medical_attest`, e `referral` contêm `clinicalSnapshot` com dados do paciente no momento da criação. Estes snapshots ficam em `db.clinicalRecords`, que **é deletado** pela anonymização.

Porém, se o audit log de uma prescrição tiver sido gerado antes da anonymização, o snapshot pode estar presente no audit log (que NÃO é deletado). Isto cria um **resíduo parcial de PII** em:
- `db.auditLogs` — entradas com `details.before` ou `details.after` contendo dados clínicos
- `db.auditPruneExports` — exportações forenses de prune que podem conter dados antigos

---

## 3. Caminho Recomendado

### 3.1 Revisão Jurídica Obrigatória

**Antes de produção regulada**, contratar parecer jurídico sobre:
1. Pode o médico da UBS autorizar erasure de prontuário sob pedido LGPD?
2. Como equilibrar Art. 18 LGPD com CFM 1821/2007 em caso de conflito?
3. Qual o prazo para responder a requisições de erasure quando há retenção obrigatória?

**Posição provisória recomendada:** Substituir exclusão física por anonimização seletiva — remover identificadores pessoais mas manter registros clínicos com ID anonimizado. Esta abordagem satisfaz o espírito do LGPD sem violar CFM.

### 3.2 Anonimização Seletiva (Sprint 5+)

Modificar `anonymizePatientBundle` para:
1. Anonimizar dados identificáveis (nome → "Paciente Anonimizado", CPF → "", CNS → "")
2. **Manter** `clinicalRecords` — substituir `patientId` por UUID anônimo mas preservar conteúdo clínico
3. Registrar mapeamento antigo_id → novo_id em tabela de anonimização (para continuidade de cuidado interna)

---

## 4. Auditoria de Decisões de Anonimização

### 4.1 Pre-flight Audit (Implementado)

Antes de cada chamada a `anonymizePatientBundle()`, um audit log `anonymization_warning_acknowledged` é criado com:

| Campo | Valor |
|-------|-------|
| `action` | `anonymization_warning_acknowledged` |
| `outcome` | `preflight` |
| `requestId` | ID da privacy request (se aplicável) |
| `actorId` | ID do profissional que executou |
| `patientId` | ID do paciente |
| `reason` | Justificativa da anonimização |
| `note` | Acknowledment do resíduo de snapshot CFM |

### 4.2 Post-execution Audit

O audit log `privacy.request_executed_deletion` (existente) registra o resultado.

---

## 5. Exportação para Fins Legais

### 5.1 O Que Pode Ser Exportado

| Dado | Quem Pode Exportar | Requisito |
|------|--------------------|-----------|
| Prontuário completo | Paciente (titular), Médico responsável | Requisição formal + audit |
| Histórico de audit | security_auditor, break_glass_admin | Justificativa documentada |
| Backup completo | break_glass_admin | x-backup-key + audit |

### 5.2 Exportação para Processo Judicial

1. Requisição formal com número do processo
2. Autorização do gestor clínico
3. Executar via `GET /admin/backup/export` com chave administrativa
4. Registrar em audit log com `reason: "exportacao_judicial"` e número do processo
5. Entregar apenas os dados solicitados — minimização de dados (LGPD Art. 6, III)

### 5.3 Retenção de Exportações Judiciais

Manter exportações para fins legais por prazo superior ao processo (mínimo 5 anos após encerramento). Armazenar em local seguro com acesso controlado.

---

## 6. Tipos de Registro CFM e Retenção

| Tipo | Definição | Retenção CFM |
|------|-----------|--------------|
| Consulta médica | `clinicalRecord.type = "consultation"` | 20 anos |
| Prescrição | `clinicalRecord.type = "prescription"` | 20 anos |
| Atestado médico | `clinicalRecord.type = "medical_attest"` | 20 anos |
| Encaminhamento | `clinicalRecord.type = "referral"` | 20 anos |
| Exames | `db.exams` | 20 anos |
| Visita ACS | `clinicalRecord.type = "visit"` | 20 anos (prudência) |

---

## 7. Checklist de Conformidade Pré-Produção

- [ ] Parecer jurídico sobre LGPD vs CFM obtido
- [ ] Política de erasure revisada com advogado especializado em saúde digital
- [ ] DPO (Encarregado LGPD) designado e treinado
- [ ] Formulário de requisição LGPD disponível para pacientes
- [ ] Prazo de resposta a requisições LGPD definido (≤ 15 dias, prorrogável)
- [ ] Procedimento de notificação ANPD documentado (72h)
- [ ] Auditoria interna de dados pessoais realizada (mapeamento Art. 37 LGPD)

---

## 8. Referências

- LGPD: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- CFM 1821/2007: https://sistemas.cfm.org.br/normas/visualizar/resolucoes/BR/2007/1821
- ANPD: https://www.gov.br/anpd
- `src/utils/patients.js` — `anonymizePatientBundle()`
- `src/routes/privacy.js` — endpoints de erasure
- `docs/runbooks/key-rotation.md` — rotação de chaves de criptografia
