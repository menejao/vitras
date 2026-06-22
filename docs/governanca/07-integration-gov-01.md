# INTEGRATION-GOV-01 — Governança Nacional de Ingestão de Dados

**Status:** ATIVO  
**Vigência:** A partir de 2026-06-22  
**Aplicação:** Obrigatório antes de qualquer integração, migração ou importação de dados externos no VITRAS APS

---

## 1. Objetivo

Estabelecer o processo oficial e obrigatório para entrada de dados externos no VITRAS APS.

Este documento **não autoriza** nenhuma implementação técnica.

Este documento **define** o processo que toda futura integração deverá seguir.

---

## 2. Escopo

### 2.1 Aplica-se a

- Migração de dados históricos
- Importação de dados em lote
- Sincronização com sistemas externos
- Integrações via API
- Conectores com sistemas municipais
- Cargas iniciais de dados

### 2.2 Não se aplica a

- Cadastro manual de pacientes, domicílios ou famílias
- Uso operacional normal da UBS
- Operação clínica diária
- CDS Export (fluxo de saída — regido por regras próprias)

---

## 3. Contexto

O VITRAS APS é um produto nacional multi-tenant.

Cada município pode operar com sistemas distintos:

- PEC / e-SUS APS
- Sistemas próprios municipais
- Sistemas de fornecedores privados
- Planilhas legadas
- Bancos de dados históricos
- APIs de terceiros

O VITRAS APS não assume compatibilidade automática com nenhum sistema externo.

Toda integração é tratada como projeto formal de homologação.

**Estado atual (2026-06-22):**
- Nenhuma integração ativa
- Nenhuma origem de dados aprovada
- Nenhum conector homologado

A governança é criada antes da primeira solicitação real para garantir que nenhuma integração seja tratada como ad hoc.

---

## 4. Regra fundamental

> **O VITRAS APS não importa dados. O VITRAS APS homologa integrações.**
>
> Somente integrações homologadas podem importar dados para produção.

---

## 5. Critérios de bloqueio

Uma importação é **automaticamente bloqueada** se qualquer condição abaixo for NÃO:

| # | Critério | Obrigatório |
|---|---|---|
| 1 | Origem dos dados identificada e documentada | SIM |
| 2 | Dicionário de dados da origem recebido e aprovado | SIM |
| 3 | Mapeamento campo a campo validado | SIM |
| 4 | Dry-run executado com relatório | SIM |
| 5 | Homologação em ambiente de staging concluída | SIM |
| 6 | Relatório de validação emitido | SIM |
| 7 | Aprovação técnica formal registrada | SIM |
| 8 | Trilha de auditoria LGPD configurada | SIM |

**Um único NÃO bloqueia a importação integralmente.**

---

## 6. Processo de homologação

### FASE 1 — Cadastro da origem

Antes de qualquer ação técnica, registrar formalmente:

| Campo | Descrição |
|---|---|
| Nome do sistema | Ex: PEC e-SUS APS |
| Fornecedor | Ex: DATASUS |
| Município | Ex: Recife — PE |
| Versão | Ex: 5.2.31 |
| Responsável técnico | Nome e contato |
| Tipo de integração | CSV / XLSX / API REST / Banco de dados / Arquivo proprietário |

Resultado esperado: **origem formalmente identificada e registrada**.

---

### FASE 2 — Dicionário de dados

Receber documentação completa da origem.

Para cada campo, documentar:

| Atributo | Descrição |
|---|---|
| Nome do campo | Ex: `PAC_NOME` |
| Tipo | String / Integer / Date / Boolean |
| Tamanho | Ex: VARCHAR(255) |
| Obrigatoriedade | Obrigatório / Opcional |
| Significado funcional | Ex: Nome completo do cidadão |
| Regras de preenchimento | Ex: Sem abreviações, grafado por extenso |

Resultado esperado: **dicionário de dados aprovado pela equipe técnica**.

---

### FASE 3 — Mapeamento semântico

Mapear cada campo da origem para o modelo VITRAS APS.

Formato obrigatório:

```
[Campo Origem]  →  [Campo VITRAS]  →  [Regra de transformação]

Exemplos:

PAC_NOME         →  patient.name      →  Preservar capitalização original
PAC_CNS          →  patient.cns       →  Validar dígito verificador (algoritmo Módulo 11)
PAC_CPF          →  patient.cpf       →  Remover máscara. Validar CPF. Armazenar 11 dígitos.
PAC_NASCIMENTO   →  patient.birthDate →  Converter DD/MM/YYYY → ISO 8601 (YYYY-MM-DD)
PAC_SEXO         →  patient.sex       →  M → male | F → female | I → indeterminate
```

**Proibido:** mapeamento automático sem validação humana.

**Proibido:** importar campos sem correspondência no modelo VITRAS.

Resultado esperado: **mapeamento campo a campo aprovado e versionado**.

---

### FASE 4 — Catálogo de regras de validação

Definir para cada campo mapeado:

| Atributo | Exemplos |
|---|---|
| Obrigatório | SIM / NÃO |
| Formato esperado | Regex, enum, range |
| Validação | CPF válido, CNS válido, data no passado |
| Transformação | Remover máscara, normalizar encoding, converter fuso |
| Ação em caso de erro | Rejeitar registro / Registrar como inválido / Usar valor padrão |

Resultado esperado: **catálogo de regras aprovado**.

---

### FASE 5 — Ambiente de homologação

Toda integração deve ser executada primeiro no ambiente de staging.

**Proibido:** importar diretamente para produção sem homologação prévia.

O ambiente de homologação deve conter:

- Dados fictícios representativos (sem dados reais de pacientes)
- Schema idêntico ao de produção
- Mesmas regras de RBAC e LGPD

Resultado esperado: **validação em staging concluída**.

---

### FASE 6 — Dry-run obrigatório

Executar importação simulada sem gravação de dados.

O relatório de dry-run deve conter:

| Métrica | Descrição |
|---|---|
| Total de registros | Quantidade lida da origem |
| Válidos | Registros que passaram em todas as validações |
| Inválidos | Registros rejeitados — listar motivo por campo |
| Duplicados | Registros já existentes no VITRAS (por CPF, CNS ou outro identificador) |
| Inconsistentes | Registros com dados conflitantes internamente |
| Taxa de aprovação | Percentual de registros válidos sobre o total |

**Taxa mínima de aprovação para prosseguir:** definida caso a caso, mínimo recomendado 95%.

Resultado esperado: **relatório de dry-run emitido e revisado**.

---

### FASE 7 — Aprovação técnica

A carga só pode prosseguir após aprovação explícita e formal.

Registrar obrigatoriamente:

| Campo | Descrição |
|---|---|
| Responsável | Nome do aprovador técnico |
| Data da aprovação | ISO 8601 |
| UBS destino | Nome e CNES |
| Lote | Identificador único do lote |
| Resultado do dry-run | Resumo das métricas |

Resultado esperado: **aprovação formal registrada antes da carga em produção**.

---

### FASE 8 — Commit controlado

Importar apenas registros aprovados no dry-run.

Registrar obrigatoriamente:

| Campo | Descrição |
|---|---|
| Quantidade importada | Registros gravados com sucesso |
| Quantidade rejeitada | Registros não importados |
| Tempo de execução | Duração total da carga |
| Hash do lote | SHA-256 do arquivo ou conjunto de dados |
| Timestamp | Data e hora do commit em UTC |

Resultado esperado: **carga rastreável e reversível**.

---

### FASE 9 — Auditoria LGPD

Registrar obrigatoriamente para conformidade com a Lei Geral de Proteção de Dados:

| Campo | Descrição |
|---|---|
| Sistema de origem | Nome e versão |
| Operador | Quem executou a importação |
| UBS destino | Nome e CNES |
| Data e hora | UTC |
| Volume de dados | Quantidade de registros por categoria |
| Categoria dos dados | Pessoais / Sensíveis / Clínicos |
| Base legal | Art. da LGPD que autoriza o tratamento |

**Dado clínico:** nunca pode aparecer em log operacional. Apenas em trilha de auditoria cifrada.

Resultado esperado: **rastreabilidade completa, conformidade LGPD documentada**.

---

### FASE 10 — Catálogo nacional de conectores

Após homologação bem-sucedida, a integração torna-se um **Conector Homologado**.

Registrar no catálogo:

| Campo | Descrição |
|---|---|
| Nome do conector | Ex: PEC e-SUS APS → VITRAS APS |
| Sistema de origem | Nome e versão |
| Data de homologação | ISO 8601 |
| UBS piloto | Primeira UBS que utilizou o conector |
| Compatibilidade | Versões do sistema de origem compatíveis |
| Responsável técnico | Quem homologou |
| Status | Ativo / Depreciado / Em revisão |

Novas UBS que utilizarem o mesmo sistema poderão reutilizar o conector sem repetir o processo de homologação, sujeito à verificação de versão.

Resultado esperado: **reuso nacional. Homologar uma vez, reutilizar nacionalmente.**

---

## 7. Responsabilidades

| Papel | Responsabilidade |
|---|---|
| Support Admin | Executa o processo de homologação |
| Tech Lead de Implantação | Aprova mapeamento semântico e catálogo de regras |
| Responsável da UBS | Fornece dados de origem e assina termo de responsabilidade |
| Fornecedor do sistema de origem | Fornece dicionário de dados e suporte técnico |
| VITRAS (equipe produto) | Mantém este documento e aprova conectores nacionais |

---

## 8. Gatilho para implementação técnica

**A existência deste documento não autoriza nenhuma implementação técnica.**

Implementações futuras (dry-run engine, catálogo de conectores, APIs de importação) somente poderão ocorrer mediante:

1. Origem real identificada e documentada
2. Necessidade operacional comprovada
3. Abertura de iniciativa própria com GOV-01 aprovado

Exemplos de iniciativas futuras:

- `INTEGRATION-01A` — Conector PEC e-SUS APS → VITRAS APS
- `INTEGRATION-01B` — Importador de planilhas XLSX (formato padrão VITRAS)
- `INTEGRATION-02` — API de sincronização bidirecional

Estas iniciativas não existem até que uma origem real as justifique.

---

## 9. Histórico de versões

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documento inicial — processo nacional de governança de ingestão de dados |
