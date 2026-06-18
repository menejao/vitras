# Evidence Package — Homologação PEC VITRAS APS

**Template versão:** 1.0  
**Data criação:** 2026-06-18  
**Instrução:** duplicar este arquivo por sessão de homologação. Renomear: `evidence-{municipio}-{data}.md`

---

## 1. Identificação da Sessão

| Campo | Valor |
|-------|-------|
| Município | |
| UF | |
| UBS | |
| CNES | |
| INE | |
| Data da sessão | |
| Início | |
| Término | |
| Ambiente PEC | ☐ Homologação  ☐ Produção |
| Versão PEC | |
| Operador VITRAS | |
| CNS operador | |
| Técnico PEC | |

---

## 2. Arquivo Exportado

| Campo | Valor |
|-------|-------|
| Nome do arquivo | |
| Tamanho (bytes) | |
| Hash SHA-256 | |
| Data/hora geração | |
| Fichas incluídas | ☐ FCI  ☐ FCD  ☐ FAI |
| Total FCI | |
| Total FCD | |
| Total FAI | |
| Total registros | |

### 2.1 headerTransport extraído

```json
{
  "cnes": "",
  "ine": "",
  "origem": "",
  "versaoLote": ""
}
```

---

## 3. Log de Importação PEC

### 3.1 Status geral

☐ SUCESSO  ☐ SUCESSO COM AVISOS  ☐ FALHA

### 3.2 Mensagens PEC

```
[Colar aqui o texto da tela de resultado do PEC]
```

### 3.3 Contagem PEC pós-importação

| Ficha | Enviados VITRAS | Importados PEC | Divergência |
|-------|----------------|----------------|-------------|
| FCI | | | |
| FCD | | | |
| FAI | | | |

---

## 4. Validação Manual

### 4.1 Cadastro Individual (FCI)

| Campo | Esperado | PEC exibe | OK? |
|-------|----------|-----------|-----|
| Nome completo | | | |
| Nome social | | | |
| Data nascimento | | | |
| CNS | | | |
| CPF (se informado) | | | |
| Logradouro | | | |
| Número | | | |
| Bairro | | | |
| CEP | | | |
| Município | | | |
| Profissional responsável | | | |

### 4.2 Cadastro Domiciliar (FCD)

| Campo | Esperado | PEC exibe | OK? |
|-------|----------|-----------|-----|
| Endereço do domicílio | | | |
| Tipo do imóvel | | | |
| Número de moradores | | | |
| Família principal | | | |

### 4.3 Atendimento Individual (FAI)

| Campo | Esperado | PEC exibe | OK? |
|-------|----------|-----------|-----|
| Data do atendimento | | | |
| Profissional | | | |
| Paciente | | | |
| Tipo de atendimento | | | |
| CID/CIAP informado | | | |

---

## 5. Screenshots

> Anexar como arquivos na pasta `evidence-{municipio}-{data}/` ou colar links:

| # | Descrição | Arquivo/Link |
|---|-----------|-------------|
| 1 | Tela upload arquivo PEC | |
| 2 | Resultado importação | |
| 3 | Cadastro Individual no PEC | |
| 4 | Detalhe nome social | |
| 5 | Atendimento Individual no PEC | |
| 6 | Tela VITRAS export concluído | |

---

## 6. Inconsistências Encontradas

| # | Descrição | Ficha | Campo | Impacto | Resolução |
|---|-----------|-------|-------|---------|-----------|
| | | | | | |

---

## 7. Veredicto

☐ **HOMOLOGAÇÃO APROVADA** — todos os critérios do checklist atendidos.  
☐ **HOMOLOGAÇÃO CONDICIONAL** — aprovada com ressalvas (listar abaixo).  
☐ **HOMOLOGAÇÃO REPROVADA** — falha crítica (descrever abaixo).

### Observações do veredicto

```
[Texto livre]
```

---

## 8. Próximos Passos

- [ ] Comunicar resultado ao município
- [ ] Registrar no LGPD checklist (se aprovado)
- [ ] Abrir issue para cada inconsistência encontrada
- [ ] Agendar sessão de re-homologação (se reprovado)

---

## 9. Assinaturas

| Papel | Nome | Data |
|-------|------|------|
| Operador VITRAS | | |
| Gestor UBS | | |
| Técnico PEC | | |

---

*VITRAS APS — docs/homologacao/evidence-package-template.md*
