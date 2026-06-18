# Go / No-Go Runbook — Homologação PEC VITRAS APS

**Versão:** 1.0  
**Data:** 2026-06-18  
**Escopo:** sessão de homologação real com município parceiro e PEC >= 5.4.36

---

## Visão Geral do Fluxo

```
PRÉ-HOMOLOGAÇÃO          HOMOLOGAÇÃO              PÓS-HOMOLOGAÇÃO
─────────────────        ─────────────────        ──────────────────
Gate 1: Município  →     Gate 3: Export    →      Gate 5: Validação
Gate 2: VITRAS           Gate 4: Import           Gate 6: Sign-off
```

---

## FASE 1 — Pré-homologação

### Gate 1 — Município pronto

Verificar com técnico municipal antes de agendar sessão.

| Critério | Responsável | Status |
|----------|-------------|--------|
| PEC >= 5.4.36 instalado | Técnico municipal | |
| Ambiente definido (hom/prod) | Gestor municipal | |
| CNES ativo e confirmado | Técnico municipal | |
| INE ativo e vinculado | Técnico municipal | |
| CNS profissional disponível | Operador PEC | |
| Perfil de importação CDS habilitado | Técnico municipal | |
| Janela de 4h agendada | Ambas partes | |

**Go:** todos ✅  
**No-Go:** qualquer ❌ → reagendar, registrar motivo

### Gate 2 — VITRAS pronto

Verificar antes da sessão (dia anterior).

| Critério | Responsável | Status |
|----------|-------------|--------|
| CNES configurado no VITRAS (staging/prod) | Dev VITRAS | |
| INE configurado no VITRAS | Dev VITRAS | |
| Pacientes de teste cadastrados | Operador VITRAS | |
| Atendimentos de teste registrados | Operador VITRAS | |
| CDS Export funcional (validação local) | Dev VITRAS | |
| Script de validação `validate-esus.ps1` disponível | Dev VITRAS | |
| Evidence package template preparado | Operador VITRAS | |

**Go:** todos ✅  
**No-Go:** qualquer ❌ → corrigir antes da sessão

---

## FASE 2 — Homologação (dia da sessão)

### Gate 3 — Export

**Executar antes de compartilhar arquivo com município.**

1. Gerar export CDS no VITRAS com pacientes de teste
2. Executar `validate-esus.ps1` (ou equivalente)
3. Confirmar:
   - PASS no script de validação
   - CNES e INE batem com os fornecidos pelo município
   - Fichas FCI/FCD/FAI presentes conforme cenários selecionados
   - Tamanho > 0 bytes

**Go:** validação PASS + campos corretos  
**No-Go (parada):** validação FAIL → não enviar arquivo ao município, corrigir e regerar

**Tempo máximo:** 30 min. Se export não funcionar em 30 min → PARAR, registrar, reagendar.

### Gate 4 — Import PEC

**Executar junto com técnico municipal.**

1. Técnico municipal faz upload do arquivo no PEC
2. Aguardar processamento (máx 5 min)
3. Registrar mensagens de resultado
4. Preencher seção 3 do evidence package

**Go:** PEC aceita o arquivo, zero erros críticos  
**No-Go (parada imediata):**
- Erro de formato (arquivo rejeitado na entrada)
- Crash ou timeout do PEC
- Mensagem "CNES/INE não encontrado"

**No-Go (continua com aviso):**
- Warnings não bloqueantes → documentar e continuar para Gate 5

**Tempo máximo Gate 4:** 15 min incluindo upload + processamento.

---

## FASE 3 — Pós-homologação

### Gate 5 — Validação pós-import

**Executar no PEC após confirmação de import.**

1. Verificar Cadastro Individual: paciente Alpha e Beta visíveis
2. Verificar nome social: Carla Mendes aparece para João Carlos Mendes
3. Verificar Cadastro Domiciliar: domicílio Alpha vinculado
4. Verificar Atendimento Individual: data e CID/CIAP corretos
5. Conferir contagem: registros PEC == registros VITRAS exportados

Preencher tabela da seção 6 do evidence package.

**Go:** todos os itens obrigatórios do checklist = PASS  
**No-Go (reprovação):** qualquer item crítico = FAIL (ver seção 7 do checklist)

**Tempo máximo Gate 5:** 60 min.

### Gate 6 — Sign-off

1. Preencher veredicto no evidence package
2. Assinar (operador VITRAS + gestor UBS + técnico PEC)
3. Commit do evidence package preenchido no repo:
   ```
   docs/homologacao/evidence-{municipio}-{data}.md
   ```
4. Comunicar resultado formal ao município

---

## Critérios de Parada (Stop Conditions)

Parar a sessão imediatamente se:

| Condição | Ação |
|----------|------|
| PEC derruba dados de produção | Parar, escalar para gestor municipal |
| Dados reais de pacientes aparecem no arquivo de teste | Parar, acionar DPO, registrar incidente |
| CNES/INE recusado — dados inválidos confirmados | Parar, reagendar após correção cadastral |
| Técnico PEC indisponível por > 30 min | Reagendar |
| Falha de conectividade irrecuperável | Reagendar |
| Qualquer dúvida de LGPD em ambiente de produção | Parar, consultar DPO antes de continuar |

---

## Critérios de Aprovação Final

**APROVADO** quando:
- Gates 1 a 6 todos PASS
- Evidence package assinado por todas as partes
- Zero divergência de contagem FCI/FCD/FAI
- Nome social preservado ✅
- Nenhum dado perdido ✅

**APROVADO CONDICIONAL** quando:
- Warnings não bloqueantes documentados
- Plano de resolução definido
- Todas as partes concordam

**REPROVADO** quando:
- Qualquer gate crítico FAIL sem resolução
- Divergência de contagem > 0
- Dados corrompidos ou ausentes no PEC

---

## Contatos de Escalação

| Papel | Responsabilidade |
|-------|-----------------|
| DPO VITRAS | Questões LGPD — lgpd@vitras.com.br |
| Tech Lead VITRAS | Problemas técnicos export |
| Gestor Municipal | Acesso PEC, escopo piloto |
| Suporte DATASUS/PEC | Bugs PEC — suporte e-SUS AB |

---

## Checklist Rápido — Dia da Sessão

```
[ ] Gate 1 PASS (município)
[ ] Gate 2 PASS (VITRAS)
[ ] Export gerado
[ ] validate-esus.ps1 PASS
[ ] Arquivo enviado ao técnico
[ ] Import realizado no PEC
[ ] Gate 4 PASS
[ ] Validação pós-import completa
[ ] Gate 5 PASS
[ ] Evidence package preenchido
[ ] Assinado por todas as partes
[ ] Commit no repo
[ ] Município notificado
```

---

*VITRAS APS — docs/homologacao/go-no-go.md*
