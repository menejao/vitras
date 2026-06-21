# 06 — Plano de Treinamento

**Versão:** 1.0 | **Produto:** VITRAS APS | **Aplicação:** qualquer UBS do Brasil

---

## Princípio

Treinamento deve acontecer com sistema em staging ou ambiente de treinamento dedicado, **nunca com dados reais de pacientes**.

Formato recomendado: presencial na UBS ou videoconferência. Duração total: 1 dia de treinamento para toda a equipe.

---

## TR-01 — Treinamento ACS

**Objetivo:** ACS consegue registrar visitas domiciliares, cadastros e consultar busca ativa de forma autônoma.

**Duração:** 2 horas  
**Formato:** presencial ou videoconferência  
**Responsável:** Training Lead + APS Specialist  
**Pré-condição:** ACS com login criado, telefone/tablet disponível, conexão com internet

---

### Conteúdo

| # | Tópico | Duração | Método |
|---|--------|---------|--------|
| 1 | Login e navegação básica | 15 min | Demo + prática |
| 2 | Cadastro Individual: criando um paciente | 20 min | Prática guiada |
| 3 | Cadastro Domiciliar: registrando o domicílio | 15 min | Prática guiada |
| 4 | Registro de Visita ACS: motivos, desfecho, acompanhamentos | 30 min | Prática guiada |
| 5 | Busca Ativa: interpretando a lista de prioritários | 15 min | Demo + discussão |
| 6 | Dúvidas e simulação de cenário real | 15 min | Exercício prático |
| 7 | O que fazer quando o sistema travar / sem internet | 10 min | Explicação |

---

### Exercícios Práticos

**Exercício 1 — Cadastro Completo**
> "Cadastre um paciente fictício com nome, data de nascimento, sexo, telefone e endereço. Depois localize o paciente na lista."

**Exercício 2 — Visita ACS**
> "Registre uma visita domiciliar para o paciente cadastrado no exercício 1. Use desfecho 'realizada', motivo 'visita_periodica', acompanhamento 'ac_hipertensao'."

**Exercício 3 — Busca Ativa**
> "Abra a lista de busca ativa e identifique o paciente com score mais alto. O que o score indica?"

---

### Checklist de Aprovação — ACS

Para cada ACS, confirmar antes de liberar para produção:

- [ ] Consegue fazer login sem ajuda
- [ ] Consegue criar paciente com campos obrigatórios
- [ ] Consegue registrar visita domiciliar com pelo menos 1 motivo
- [ ] Conhece o significado do desfecho "não visitado" vs "recusa"
- [ ] Sabe consultar lista de busca ativa
- [ ] Sabe o que fazer se o sistema estiver fora do ar (anotar em papel, registrar depois)
- [ ] Sabe quem acionar em caso de dúvida

---

## TR-02 — Treinamento Enfermeiro

**Objetivo:** Enfermeiro consegue gerenciar equipe, revisar produção, dar suporte ao ACS e entender obrigações LGPD.

**Duração:** 1,5 hora  
**Formato:** presencial ou videoconferência  
**Responsável:** Training Lead + APS Specialist

---

### Conteúdo

| # | Tópico | Duração | Método |
|---|--------|---------|--------|
| 1 | Login, perfil e papel do enfermeiro no VITRAS | 10 min | Demo |
| 2 | Criação e gestão de ACS | 15 min | Prática guiada |
| 3 | Revisão de cadastros individuais e domiciliares | 15 min | Demo + prática |
| 4 | Dashboard de produção: interpretar métricas | 20 min | Demo + discussão |
| 5 | Suporte ao ACS: o que revisar, como corrigir | 15 min | Casos práticos |
| 6 | LGPD básica: o que é dado sensível, quem pode ver o quê | 15 min | Explicação |

---

### Pontos-chave para o Enfermeiro

- **Produção:** `GET /production/acs` mostra visitas por ACS. Enfermeiro é responsável por cobranças mensais.
- **Isolamento de equipe:** enfermeiro só vê pacientes da própria equipe. Não há acesso cross-team.
- **Criação de usuários:** enfermeiro pode criar ACS e recepcionistas, mas não gestores.
- **LGPD:** nunca compartilhar lista de pacientes por WhatsApp. Dados de saúde são categoria especial (LGPD Art. 11).

---

### Checklist de Aprovação — Enfermeiro

- [ ] Consegue criar usuário ACS
- [ ] Consegue ver métricas de produção da equipe
- [ ] Sabe interpretar o dashboard de produção
- [ ] Conhece limitações de acesso (team scope)
- [ ] Entende obrigações básicas de LGPD
- [ ] Sabe quando e como acionar o Tech Lead

---

## TR-03 — Treinamento Gestor

**Objetivo:** Gestor opera com autonomia total: indicadores, produção, exportação CDS, auditoria, responsabilidades LGPD.

**Duração:** 2 horas  
**Formato:** presencial ou videoconferência  
**Responsável:** Training Lead + Tech Lead

---

### Conteúdo

| # | Tópico | Duração | Método |
|---|--------|---------|--------|
| 1 | Papel do gestor: capabilities e responsabilidades | 10 min | Explicação |
| 2 | Gestão de usuários: criar enfermeiro, ACS, revogar acesso | 20 min | Prática guiada |
| 3 | Dashboard de produção consolidado | 15 min | Demo + prática |
| 4 | Auditoria: acessar logs, exportar, o que monitorar | 20 min | Demo + prática |
| 5 | Exportação CDS: passo a passo de cada ficha | 30 min | Prática guiada |
| 6 | Responsabilidades LGPD do gestor | 15 min | Explicação |
| 7 | Plano de continuidade: o que fazer em incidente P0/P1 | 10 min | Explicação |

---

### Passo a Passo — Exportação CDS (para o gestor)

1. Login com credencial de gestor
2. Localizar o paciente ou a visita a exportar
3. `GET /export/cds/[tipo]/[id]` → salvar arquivo `.esus`
4. Acessar PEC → Transmissão de Dados → Importar
5. Selecionar arquivo `.esus`
6. Verificar relatório de importação
7. Registrar resultado (PASS / WARNING / FAIL)

---

### Responsabilidades LGPD do Gestor

- É o responsável operacional pelo tratamento de dados na UBS
- Deve comunicar ao DPO qualquer suspeita de incidente
- Não deve compartilhar senhas ou tokens de acesso
- Deve garantir que ACS e enfermeiros trocaram senhas iniciais
- Deve revisar audit logs mensalmente (rotina mensal)

---

### Checklist de Aprovação — Gestor

- [ ] Consegue criar enfermeiro e ACS
- [ ] Consegue ver produção consolidada
- [ ] Consegue exportar arquivo CDS e importar no PEC
- [ ] Consegue exportar audit logs (JSON e CSV)
- [ ] Conhece o plano de resposta a incidente P0
- [ ] Tem contatos de escalonamento salvos
- [ ] Entende responsabilidades LGPD

---

## Cronograma Sugerido

| Período | Atividade |
|---------|-----------|
| D-7 | Confirmar cadastro de todos os usuários no sistema |
| D-5 | Treinamento ACS (2h) |
| D-4 | Treinamento Enfermeiro (1,5h) |
| D-3 | Treinamento Gestor (2h) |
| D-1 | Revisão e dúvidas (1h) |
| D-0 | Go-live |

---

**Assinatura do Training Lead:**  
Data dos treinamentos: ______  
ACS aprovados: ______ / ______  
Enfermeiros aprovados: ______ / ______  
Gestor aprovado: [ ] SIM / [ ] NÃO  
Resultado global: ______
