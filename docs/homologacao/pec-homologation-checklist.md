# PEC Homologation Checklist — VITRAS APS / CDS Export V1

**Versão:** 1.0  
**Data:** 2026-06-18  
**Responsável:** Operador VITRAS + Gestor Municipal  
**PEC mínimo:** 5.4.36  

---

## Como usar

Preencher cada item com **PASS**, **FAIL** ou **N/A**.  
Todo FAIL bloqueia a homologação até resolução documentada.  
N/A exige justificativa registrada na coluna Obs.

---

## 1. Pré-requisitos de Cadastro

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 1.01 | CNES da UBS | CNES ativo no SCNES nacional | | |
| 1.02 | CNES corresponde à UBS real | Nome e município batem com SCNES | | |
| 1.03 | INE da equipe | INE ativo e vinculado ao CNES | | |
| 1.04 | INE no CNES | Equipe aparece na consulta CNES | | |
| 1.05 | CNS profissional (operador PEC) | CNS válido no CADSUS | | |
| 1.06 | CNS profissional tem perfil no PEC | Login PEC funcional | | |
| 1.07 | CNPJ da SMS/Prefeitura | Disponível para preenchimento docs | | |

---

## 2. Ambiente PEC

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 2.01 | Versão PEC | >= 5.4.36 | | |
| 2.02 | Ambiente | Homologação ou Produção (documentar qual) | | |
| 2.03 | Acesso ao módulo CDS | Perfil permite importação CDS | | |
| 2.04 | Módulo de importação visível | Menu Importar CDS acessível | | |
| 2.05 | Conectividade RNDS (se aplicável) | Sem bloqueio de firewall | | |
| 2.06 | Espaço em disco PEC | > 500 MB disponível | | |

---

## 3. Configuração VITRAS

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 3.01 | CNES configurado no VITRAS | Campo CNES preenchido na UBS | | |
| 3.02 | INE configurado no VITRAS | Campo INE preenchido na equipe | | |
| 3.03 | CNS dos profissionais cadastrados | Todos profissionais têm CNS | | |
| 3.04 | Município configurado corretamente | Código IBGE correto | | |
| 3.05 | Dados de pacientes com CNS/CPF | Pelo menos 1 paciente com CNS válido | | |
| 3.06 | Módulo e-SUS ativo | Feature flag CDS Export habilitada | | |

---

## 4. Export .esus

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 4.01 | Geração do arquivo | Export conclui sem erro | | |
| 4.02 | Extensão do arquivo | Arquivo termina em `.esus` | | |
| 4.03 | Tamanho do arquivo | > 0 bytes | | |
| 4.04 | Arquivo é ZIP válido | Descompactável (ZIP interno) | | |
| 4.05 | FCI presente | `fichas/` contém FCI JSON | | |
| 4.06 | FCD presente | `fichas/` contém FCD JSON (se aplicável) | | |
| 4.07 | FAI presente | `fichas/` contém FAI JSON (se aplicável) | | |
| 4.08 | UUIDs únicos | Nenhum UUID duplicado entre fichas | | |
| 4.09 | headerTransport.cnes | Igual ao CNES da UBS | | |
| 4.10 | headerTransport.ine | Igual ao INE da equipe | | |
| 4.11 | headerTransport.origem | "VITRAS" | | |
| 4.12 | Versão do lote | Compatível com PEC 5.4.36 | | |

---

## 5. Importação PEC

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 5.01 | Upload do arquivo | PEC aceita o arquivo sem erro de formato | | |
| 5.02 | Processamento sem timeout | Importação conclui em < 5 min | | |
| 5.03 | Ausência de erro crítico | Nenhum erro vermelho na tela PEC | | |
| 5.04 | Avisos documentados | Warnings registrados (não bloqueantes) | | |
| 5.05 | Relatório de importação disponível | PEC exibe sumário de processamento | | |

---

## 6. Validação Pós-importação

| # | Item | Critério | Status | Obs |
|---|------|----------|--------|-----|
| 6.01 | FCI importada com sucesso | Cadastro Individual visível no PEC | | |
| 6.02 | FCD importada com sucesso | Cadastro Domiciliar visível (se enviado) | | |
| 6.03 | FAI importada com sucesso | Atendimento Individual visível (se enviado) | | |
| 6.04 | Nome social preservado | Campo nome social aparece no PEC | | |
| 6.05 | CNS do paciente preservado | CNS visível no cadastro PEC | | |
| 6.06 | Data de nascimento correta | Sem inversão dia/mês | | |
| 6.07 | Endereço completo | Logradouro, número, bairro, CEP | | |
| 6.08 | Profissional responsável correto | CNS do profissional bate com o enviado | | |
| 6.09 | Data de atendimento correta | Não nula, formato correto | | |
| 6.10 | Quantidade de registros | Conta PEC == conta VITRAS exportada | | |

---

## 7. Critérios de Aprovação

**APROVADO** se:
- Todos os itens obrigatórios (1.xx, 2.xx, 3.xx, 4.xx, 5.xx, 6.xx) = PASS ou N/A documentado
- Zero FAILs em 4.08, 4.09, 4.10, 5.01, 5.03, 6.01, 6.02, 6.03, 6.09

**REPROVADO** se:
- Qualquer item obrigatório = FAIL sem plano de resolução
- Divergência de contagem > 0 entre VITRAS e PEC (6.10)
- Erro de importação crítico (5.03)

---

## Assinaturas

| Papel | Nome | Data | Assinatura |
|-------|------|------|------------|
| Operador VITRAS | | | |
| Gestor UBS | | | |
| Técnico PEC Municipal | | | |

---

*VITRAS APS — docs/homologacao/pec-homologation-checklist.md*
