# Tabletop — Agenda de Execução (2h)

**Para:** Coordenador UBS + Responsável TI Prefeitura + Tech Lead  
**Formato:** Reunião presencial ou vídeo — máx. 3–5 participantes  
**Duração:** 2h (pode ser feito em sessão única ou duas sessões de 1h)  
**Documentos de suporte:** `tabletop-exercise-report.md`, `tabletop-final-report.md`  
**Registro:** Preencher scores em `tabletop-final-report.md` ao final de cada cenário

> **Meta:** Equipe deve saber o que fazer nas 5 situações abaixo sem consultar documentação. Score mínimo: 3/5 em cada cenário.

---

## Preparação (10 min antes)

Conductor (João Pedro) garante:
- [ ] `contatos.md` aberto (mesmo que incompleto — identificar lacunas)
- [ ] URL do sistema: `http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com`
- [ ] Acesso ao CloudWatch Insights (João Pedro)
- [ ] Acesso ao EB Console (João Pedro)
- [ ] Papéis impressos de contingência disponíveis na UBS
- [ ] Horário de início registrado: _____ : _____

---

## Bloco 1 — Sistema fora do ar (30 min)

### Cenário 1A: Sistema retorna 503 para todos os usuários (15 min)

**Situação narrada pelo conductor:**
> São 10h de uma terça-feira. A recepcionista da UBS abre o sistema para registrar um paciente e vê: "503 Serviço temporariamente indisponível". Ela tenta de novo — mesmo erro. Outros computadores, mesmo erro.

**Perguntas para a equipe (deixar responder antes de revelar resposta):**

| # | Pergunta | Resposta esperada |
|---|----------|------------------|
| 1 | Quem recebe o primeiro relato? | Coordenador UBS recebe da recepcionista |
| 2 | O Coordenador liga para quem primeiro? | João Pedro — celular (contatos.md Seção A) |
| 3 | O que fazer com pacientes que chegam enquanto o sistema está fora? | Registrar em papel + lançar no sistema quando voltar |
| 4 | Como saber se é problema no sistema ou na rede local? | TI Prefeitura testa outro site — se funcionar, problema é no sistema |
| 5 | Quando acionar o DPO? | Apenas se houver suspeita de dados expostos — 503 sozinho não aciona DPO |

**João Pedro demonstra (5 min):**
```bash
# Verificar se sistema está up
curl http://vitras-drill-sa-3.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com/health
# Se postgres=ok mas redis=error → é o circuit breaker (Upstash)
# Se /readyz retorna 503 → sistema em restart ou crash loop
```

**Score do cenário 1A:** _____ / 5

---

### Cenário 1B: Sistema não responde de jeito nenhum (15 min)

**Situação narrada:**
> O sistema não abre nem a página de login. Timeout. João Pedro verifica: `/readyz` retorna 503 e o EB Console mostra instância "Degraded".

**Perguntas:**

| # | Pergunta | Resposta esperada |
|---|----------|------------------|
| 1 | Quanto tempo esperar antes de acionar rollback? | Tech Lead decide — alvo é < 30 min para P1, imediato para P0 |
| 2 | O rollback apaga dados dos pacientes? | NÃO — rollback é de código, não de banco |
| 3 | Quem autoriza o rollback? | João Pedro (Tech Lead) |
| 4 | Quanto tempo leva o rollback? | ~10–20 min até /readyz 200 novamente |
| 5 | O que a UBS comunica para os pacientes durante o downtime? | "Sistema em manutenção, atendimento continua com papel" |

**Score do cenário 1B:** _____ / 5

---

## Bloco 2 — Acesso e usuários (20 min)

### Cenário 2: Usuário não consegue logar (10 min)

**Situação narrada:**
> Enfermeira da equipe 2 não consegue fazer login. Ela tem certeza da senha. Outros usuários da mesma equipe conseguem.

**Perguntas:**

| # | Pergunta | Resposta esperada |
|---|----------|------------------|
| 1 | Quem ela aciona primeiro? | Coordenador UBS |
| 2 | O Coordenador pode resetar a senha? | Depende do perfil — gestor pode criar novo usuário |
| 3 | O João Pedro pode resetar a senha remotamente? | Sim — via break_glass_admin tem acesso administrativo |
| 4 | Quanto tempo esperar para escalação? | Se bloquear atendimento clínico → P1, escalar imediatamente |
| 5 | O que registrar no log de incidentes? | Usuário afetado, hora, ação tomada, resolução |

**Score:** _____ / 5

---

### Cenário 3: Paciente duplicado suspeito (10 min)

**Situação narrada:**
> Recepcionista tenta cadastrar paciente que já existe. Sistema aceita — agora há dois registros com o mesmo nome e data de nascimento.

**Perguntas:**

| # | Pergunta | Resposta esperada |
|---|----------|------------------|
| 1 | Isso é um P0, P1 ou P2? | P2 (nenhum dado exposto, não é falha de segurança) |
| 2 | O que fazer imediatamente? | Não registrar atendimento no duplicado errado — reportar ao João Pedro |
| 3 | O João Pedro pode unificar os registros remotamente? | Sim — mas requer análise antes de agir |
| 4 | Isso precisa acionar o DPO? | Não — sem exposição de dados de outro paciente |
| 5 | A UBS pode continuar operando? | Sim — usar apenas o registro mais completo/correto |

**Score:** _____ / 5

---

## Bloco 3 — Privacidade e segurança (30 min)

### Cenário 4: Suspeita de vazamento de dados LGPD (20 min)

**Situação narrada:**
> Uma ACS da equipe 1 relata que está vendo na lista dela um paciente que ela não reconhece — nunca atendeu, não é da sua microárea. O nome do paciente parece ser de outra equipe.

**Este é o cenário mais crítico. Conduzir com atenção.**

**Perguntas:**

| # | Pergunta | Resposta esperada |
|---|----------|------------------|
| 1 | Qual a primeira coisa a fazer? | Parar de usar a tela atual, não clicar em mais nada, reportar imediatamente |
| 2 | Quem acionar e em que ordem? | João Pedro IMEDIATAMENTE (P0) → DPO (se confirmar exposição) |
| 3 | O que João Pedro faz primeiro? | Verificar audit log: essa ACS realmente acessou dados de outra equipe? |
| 4 | Quando acionar o DPO? | Assim que confirmar que dados de paciente de outra equipe foram acessados |
| 5 | O DPO tem obrigação legal de notificar? | Sim — ANPD em até 72h se for breach confirmado |
| 6 | O sistema continua funcionando durante a investigação? | Depende — João Pedro decide se rollback imediato é necessário |

**O conductor revela:**
- Sistema tem audit log de cada acesso (`GET /patients/{id}` → registrado)
- Isolamento por `canAccessPatient()` é verificado no backend
- Se ACS viu paciente de outra equipe = bug grave ou manipulação = rollback imediato

**Perguntas pós-revelação:**
- O DPO desta UBS já foi contato? → Verificar `contatos.md` Seção C
- Prazo ANPD de 72h é conhecido? → Resposta deve ser SIM

**Score:** _____ / 5

---

### Cenário 5: Rollback de emergência (10 min)

**Situação narrada:**
> São 20h30 do dia do go-live. 30 min após o deploy, João Pedro detecta via CloudWatch que 40% das requisições estão retornando 500. Ele decide fazer rollback.

**Perguntas:**

| # | Pergunta | Resposta esperada |
|---|----------|------------------|
| 1 | Quem João Pedro notifica antes de fazer rollback? | Coordenador UBS — sistema vai ter ~10–20 min de indisponibilidade |
| 2 | O rollback apaga os atendimentos já registrados nos 30 min? | NÃO — dados ficam no banco; rollback é de código |
| 3 | Após rollback, o que a UBS faz? | Confirma acesso, relata qualquer inconsistência |
| 4 | Quem escreve o relatório de incidente? | João Pedro — `docs/operations/incidents.md` |
| 5 | Quando o sistema pode ser re-deployado (com o fix)? | Após QA confirmar o fix + janela acordada com UBS |

**Score:** _____ / 5

---

## Fechamento (20 min)

### Perguntas abertas para a equipe

1. **Qual cenário a equipe se sentiu menos preparada?**  
   Resposta: ___________________________________

2. **Falta algum contato em `contatos.md` para lidar com qualquer desses cenários?**  
   Resposta: ___________________________________

3. **A equipe sabe onde está o documento de contingência em papel?**  
   Resposta: ___________________________________

4. **O Coordenador UBS sabe o que é o "break glass admin" e quando é usado?**  
   Resposta: ___________________________________

5. **A equipe tem número de WhatsApp do João Pedro?**  
   Resposta: ___________________________________

---

## Pontuação final

| Cenário | Score (1–5) | Observação |
|---------|-------------|------------|
| 1A — Sistema 503 | _____ | _____________ |
| 1B — Sistema não responde | _____ | _____________ |
| 2 — Usuário sem acesso | _____ | _____________ |
| 3 — Paciente duplicado | _____ | _____________ |
| 4 — Suspeita LGPD | _____ | _____________ |
| 5 — Rollback emergencial | _____ | _____________ |
| **Média** | _____ | _____________ |

**Resultado:** [ ] PASS (média ≥ 3.0 e nenhum cenário < 2)  /  [ ] FAIL (requer segundo tabletop)

**Data de execução:** _____ / _____ / _______  
**Duração real:** _____ min  
**Participantes presentes:**
- [ ] João Pedro (conductor)
- [ ] Coordenador UBS: _________________________
- [ ] TI Prefeitura: ____________________________
- [ ] Médico responsável: _______________________ (opcional)
- [ ] Outro: ___________________________________

**Lacunas identificadas durante o tabletop:**
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

**Conductor:** João Pedro — Assinatura: ___________________  
**Coordenador UBS:** __________________ — Assinatura: ___________________  
**Data:** _____ / _____ / _______
