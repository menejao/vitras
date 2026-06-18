# Support Runbook — Piloto VITRAS APS

**Versão:** 1.0  
**Data:** 2026-06-18  
**Escopo:** fluxo de suporte durante o piloto municipal (primeiros 30 dias)

---

## Contatos de Suporte

| Papel | Contato | Disponibilidade |
|-------|---------|----------------|
| Suporte operacional | lgpd@vitras.com.br | Seg–Sex 8h–18h |
| Tech Lead VITRAS | Via e-mail prioritário | SEV1 qualquer hora |
| DPO (incidentes LGPD) | lgpd@vitras.com.br | Imediato em incidentes |
| Gestor municipal | (definir no onboarding) | Horário comercial |

---

## Classificação de Severidade

### SEV1 — Crítico (resposta em 1h)

Impacto imediato em segurança de dados, perda de dados, ou sistema completamente inoperante.

Exemplos:
- Sistema fora do ar (HTTP 5xx em todas as requisições)
- Perda ou corrupção de dados de pacientes
- Incidente LGPD (dados expostos, acesso não autorizado)
- Autenticação quebrada — nenhum usuário consegue logar
- Break-glass ativado de forma não autorizada

**Fluxo SEV1:**
```
Incidente identificado
↓
Notificar tech lead VITRAS (e-mail + WhatsApp)
↓ (< 15 min)
Avaliar: dados comprometidos?
  SIM → Acionar DPO. Não acessar sistema até resolução.
  NÃO → Tentar rollback EB (< 15 min)
↓
Comunicar município: "Identificamos instabilidade. Trabalhando na resolução."
↓
Resolver ou escalar para DR runbook
↓
Comunicar resolução + root cause ao município (< 2h do início)
↓
Post-mortem em até 48h
```

**SLA:** Comunicação inicial em 1h · Resolução ou plano em 4h

---

### SEV2 — Alto (resposta em 4h, em horário comercial)

Funcionalidade importante inoperante, mas sistema parcialmente operacional.

Exemplos:
- CDS Export falhando sistematicamente
- Módulo de agenda inoperante
- Erro de login para perfil específico
- Dados de paciente não salvando (erro intermitente)
- 2FA bloqueando usuários

**Fluxo SEV2:**
```
Incidente reportado
↓
Registrar no log de incidentes (data/hora/relato/perfil afetado)
↓ (< 1h)
Reproduzir o problema em staging
↓
Identificar workaround (ex: usar outro perfil, outro fluxo)
↓
Comunicar workaround ao município
↓
Desenvolver fix e fazer deploy
↓
Confirmar resolução com o município
```

**SLA:** Workaround em 4h · Fix em 24h

---

### SEV3 — Baixo (resposta em 24h úteis)

Inconveniência ou bug não crítico sem impacto em operação.

Exemplos:
- Campo de tela mal formatado
- Mensagem de erro genérica (mas ação funciona)
- Sugestão de melhoria de UX
- Dúvida sobre fluxo ("como faço X?")
- Relatório com dado incorreto (sem impacto clínico)

**Fluxo SEV3:**
```
Dúvida / relato recebido
↓
Classificar: dúvida ou bug?
  Dúvida → Responder com orientação
  Bug → Registrar, priorizar no próximo ciclo
↓
Feedback ao usuário dentro de 24h
```

**SLA:** Resposta em 24h · Resolução no próximo ciclo de desenvolvimento

---

## Log de Incidentes

Manter registro em planilha ou documento durante o piloto:

| # | Data/Hora | Severidade | Descrição | Perfil afetado | Workaround | Resolução | Duração |
|---|-----------|-----------|-----------|---------------|-----------|-----------|---------|
| | | | | | | | |

---

## Fluxo de Comunicação com o Município

### Abertura de incidente

O usuário municipal deve reportar via:
1. E-mail para lgpd@vitras.com.br com assunto: `[SUPORTE] {SEV} — {Descrição breve}`
2. Incluir: perfil, horário, passos realizados, mensagem de erro (screenshot se possível)

### Resposta padrão SEV1
```
Olá [nome],

Confirmamos o recebimento do relato [descrição]. Nossa equipe técnica está atuando.

Status atual: Em investigação.
Próxima atualização: [hora].

Equipe VITRAS
```

### Confirmação de resolução
```
Olá [nome],

O problema reportado foi resolvido. [Descrição da causa e solução].

Por favor, confirme se o sistema está operando normalmente.

Obrigado pela paciência.
Equipe VITRAS
```

---

## Procedimentos Rápidos

### Reiniciar instância EB (quando não resolve por deploy)
1. AWS Console → Elastic Beanstalk → ambiente `vitras-prod`
2. Actions → Restart App Servers
3. Aguardar health = OK (~ 2 min)
4. Confirmar `/health` retorna 200

### Rollback para versão anterior
1. AWS Console → Elastic Beanstalk → Application Versions
2. Selecionar versão anterior confirmada como estável
3. Deploy → aguardar
4. Testar login + fluxo básico
5. Comunicar município

### Verificar logs de erro
1. AWS Console → CloudWatch → Log Groups → `/aws/elasticbeanstalk/vitras-prod/`
2. Filtrar por `ERROR` ou `500`
3. Identificar stack trace

---

## Critérios para Escalonamento DR

Ativar `docs/disaster-recovery.md` se:
- Sistema fora do ar > 2h sem resolução
- Dados corrompidos em banco de produção
- Falha de backup por > 24h

---

*VITRAS APS — docs/pilot/support-runbook.md*
