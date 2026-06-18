# Processo de Atendimento a Direitos dos Titulares

**VITRAS APS — v1.0-draft**  
**Data:** 2026-06-18  
**Classificação:** Interno — Operacional  
**Owner:** DPO

---

## 1. Base Legal

Art. 18 da LGPD — Direitos do Titular:

- Confirmação da existência de tratamento
- Acesso aos dados
- Correção de dados incompletos, inexatos ou desatualizados
- Anonimização, bloqueio ou eliminação (quando aplicável)
- Portabilidade (quando regulamentado)
- Eliminação dos dados tratados com base em consentimento
- Informação sobre compartilhamento
- Informação sobre possibilidade de não fornecer consentimento e consequências
- Revogação do consentimento
- Oposição ao tratamento

---

## 2. Canal de Recebimento

**Canal oficial:** TODO_USER: e-mail do DPO  
**Prazo legal de resposta:** 15 dias corridos (Art. 18, §3º LGPD)  
**Prazo interno (SLA):** 10 dias úteis (margem de segurança)  
**Horário de atendimento:** Dias úteis

---

## 3. Fluxo de Atendimento

```
RECEBIMENTO
  │  Solicitação chega por e-mail / formulário / protocolo formal
  │
  ▼
REGISTRO (D+0)
  │  Registrar: data, canal, solicitante, tipo de solicitação, ID (DSR-YYYYMMDD-NNN)
  │
  ▼
VALIDAÇÃO DE IDENTIDADE (D+1 a D+3)
  │  (vide seção 4)
  │
  ▼
CLASSIFICAÇÃO (D+3)
  │  (vide seção 5)
  │  ┌─ Competência VITRAS → tratar internamente
  │  └─ Competência do Controlador → encaminhar
  │
  ▼
PROCESSAMENTO (D+4 a D+8)
  │  Executar a solicitação ou formalizar recusa fundamentada
  │
  ▼
RESPOSTA AO TITULAR (até D+10)
  │
  ▼
REGISTRO DE EVIDÊNCIA
     Arquivar: solicitação, validação de identidade, ação tomada, resposta enviada
```

---

## 4. Validação de Identidade

O titular deve comprovar sua identidade antes do atendimento da solicitação. Isso protege o próprio titular de terceiros solicitando dados em seu nome.

| Tipo de titular | Documentos aceitos |
|----------------|-------------------|
| Paciente adulto | Nome completo + CPF + data de nascimento confirmados no sistema |
| Responsável por paciente menor | Documento do responsável + documento do menor (quando aplicável) |
| Profissional de saúde | E-mail institucional cadastrado + nome + CNS |
| Representante legal | Procuração + documento do representante |

**Canais de validação:**
- E-mail com confirmação de dados não públicos (data de nascimento, nome da mãe)
- Formulário digital com campos de verificação

**Atenção:** Não solicitar mais dados do que o necessário para a validação.

---

## 5. Classificação das Solicitações

### 5.1 Competência do VITRAS (Operador)

| Tipo | Ação |
|------|------|
| Confirmação de existência de tratamento | Confirmar se dados existem no sistema |
| Informação sobre compartilhamento | Informar quais sistemas recebem dados (PEC, suboperadores) |
| Informação sobre a política de privacidade | Direcionar para URL pública |
| Contato com o DPO | Responder diretamente |

### 5.2 Competência do Controlador (Município/Secretaria)

| Tipo | Ação VITRAS |
|------|-------------|
| Acesso aos dados assistenciais | Encaminhar ao Controlador em até 5 dias úteis |
| Correção de dados | Encaminhar ao Controlador (gestor da UBS tem acesso para editar) |
| Eliminação de dados de saúde | Encaminhar ao Controlador — sujeito a exceções legais |
| Portabilidade de prontuário | Encaminhar ao Controlador |
| Oposição ao tratamento para fins assistenciais | Encaminhar ao Controlador |

**Mensagem padrão de encaminhamento:**

```
Prezado(a) [nome do titular],

Agradecemos sua solicitação (protocolo DSR-[ID]).

A gestão dos dados assistenciais registrados no sistema VITRAS APS é de
responsabilidade do Controlador dos seus dados, que é a Secretaria Municipal
de Saúde de [Município].

Encaminhamos sua solicitação ao(à) responsável do Controlador para que
possam atendê-la no prazo legal. Você receberá retorno em até 15 dias corridos.

Contato do Controlador: TODO_USER: e-mail/telefone do gestor municipal

Caso tenha dúvidas adicionais, entre em contato com nosso DPO:
TODO_USER: e-mail do DPO

Atenciosamente,
VITRAS APS
```

---

## 6. Exceções em Saúde Pública

Certas solicitações podem ser recusadas ou limitadas com fundamento legal:

| Direito solicitado | Exceção possível | Base |
|-------------------|-----------------|------|
| Eliminação de dados de saúde | Obrigação legal de retenção (ex: mínimo 20 anos, CFM Res. 2.299/2021) | Art. 16, II LGPD |
| Anonimização de dados de notificação compulsória | Prejudica interesse público em saúde | Art. 11, II, "b" LGPD |
| Oposição ao tratamento de dados para vigilância epidemiológica | Interesse público na saúde pública | Art. 11, II, "b" e "f" |

**Em caso de recusa:** o DPO deve comunicar ao titular por escrito, indicando o fundamento legal da recusa e informando que pode reclamar à ANPD.

---

## 7. Quando Escalar ao Controlador Municipal

Escalar sempre que:

- A solicitação envolver dados assistenciais registrados por profissionais da UBS
- O titular solicitar acesso ao prontuário eletrônico
- Houver divergência entre dados no sistema e o que o titular afirma ser correto
- A solicitação envolver eliminação de dados de saúde (requer análise jurídica do controlador)
- O titular contestar o uso de seus dados para exportação CDS

**Prazo de encaminhamento ao Controlador:** 5 dias úteis após a validação da identidade.

---

## 8. SLA Interno

| Marco | Prazo |
|-------|-------|
| Acuse de recebimento ao titular | D+1 (1 dia útil) |
| Validação de identidade concluída | D+3 (3 dias úteis) |
| Encaminhamento ao Controlador (quando aplicável) | D+5 (5 dias úteis) |
| Resposta final ao titular (competência VITRAS) | D+10 (10 dias úteis) |
| Prazo legal máximo | D+15 dias corridos |

---

## 9. Registro de Evidências

Para cada solicitação, arquivar:

- [x] Protocolo DSR com ID único
- [x] Data de recebimento
- [x] Tipo de solicitação
- [x] Documento(s) de validação de identidade (hash/referência, não cópia de documento)
- [x] Ação tomada (descrição)
- [x] Resposta enviada ao titular (cópia do e-mail)
- [x] Data de encerramento
- [x] Eventual reclamação à ANPD (se titular exerceu esse direito)

**Retenção do registro:** 5 anos.

---

## 10. Relatório Periódico ao DPO

O DPO deve revisar mensalmente:

- Total de solicitações recebidas no período
- Por tipo de direito exercido
- Taxa de atendimento dentro do SLA
- Solicitações encaminhadas ao Controlador vs. resolvidas internamente
- Reclamações à ANPD envolvendo o VITRAS

---

*VITRAS APS · Processo de Direitos do Titular v1.0-draft · 2026-06-18*
