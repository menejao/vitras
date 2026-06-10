# Instrumento Jurídico — Vitras × Prefeitura Municipal

**Tipo sugerido:** Termo de Cooperação Técnica ou Contrato de Prestação de Serviços de TI  
**Base legal:** Lei 14.133/2021 (contratos administrativos) ou Lei 11.107/2005 (consórcios públicos, se aplicável)  
**Versão do template:** v1.0 — 2026-06-10  
**Status:** PENDENTE PREENCHIMENTO — todos os campos `[...]_PENDENTE` dependem de constituição formal da Vitras e identificação da Prefeitura contratante

> **INSTRUÇÃO:** Este template deve ser revisado por advogado antes de assinatura.
> Substituir todos os placeholders `[...]_PENDENTE` com dados reais.
> Não assinar sem revisão jurídica qualificada.
> Arquivar o documento assinado fora do repositório (vault seguro ou sistema de gestão documental da Prefeitura).

---

## TERMO DE COOPERAÇÃO TÉCNICA Nº [NUMERO_INSTRUMENTO_PENDENTE]

**PARA IMPLANTAÇÃO E OPERAÇÃO DO SISTEMA VITRAS NA REDE MUNICIPAL DE SAÚDE**

---

## CLÁUSULA 1 — IDENTIFICAÇÃO DAS PARTES

**CONTRATANTE (Controlador de Dados LGPD):**

| Campo | Valor |
|-------|-------|
| Razão social | Prefeitura Municipal de [MUNICIPIO_UBS] |
| CNPJ | [CNPJ_PREFEITURA_PENDENTE] |
| Endereço | [ENDERECO_PREFEITURA_PENDENTE] |
| Representante legal | [NOME_PREFEITO_PENDENTE], Prefeito(a) Municipal |
| CPF do representante | [CPF_REPRESENTANTE_PENDENTE] |
| Secretaria gestora | Secretaria Municipal de Saúde |
| Responsável na Secretaria | [NOME_SECRETARIO_SAUDE_PENDENTE] |
| Contato | [EMAIL_SECRETARIA_PENDENTE] |

**CONTRATADA (Operadora de Dados LGPD):**

| Campo | Valor |
|-------|-------|
| Razão social | [RAZAO_SOCIAL_PENDENTE] |
| Nome fantasia | VITRAS |
| CNPJ | [CNPJ_PENDENTE_FORMALIZACAO] |
| Endereço | [ENDERECO_PENDENTE] |
| Representante legal | João Pedro [SOBRENOME_PENDENTE] |
| CPF do representante | [CPF_JOAO_PEDRO_PENDENTE] |
| Contato técnico | joaoomenegucci@gmail.com |

---

## CLÁUSULA 2 — OBJETO

O presente instrumento tem por objeto a **implantação e operação em regime de piloto controlado** do sistema VITRAS (Sistema de Gestão de Unidade Básica de Saúde), versão v1.0-pilot-governed, na(s) UBS indicada(s) no Anexo I, com as seguintes finalidades:

1. Digitalização do prontuário eletrônico de pacientes da rede básica de saúde municipal
2. Gestão de agenda e fila de atendimento
3. Geração de audit logs de acesso e rastreabilidade clínica
4. Suporte à gestão operacional das equipes de saúde da família (ESF)

**Escopo do piloto:**
- UBS: [NOME_UBS] — [MUNICIPIO_UBS], [ESTADO_UBS]
- Período: [DATA_INICIO_PENDENTE] a [DATA_FIM_PILOTO_PENDENTE]
- Número máximo de usuários no piloto: [NUM_USUARIOS_PENDENTE]
- Número estimado de pacientes: [NUM_PACIENTES_PENDENTE]

---

## CLÁUSULA 3 — RESPONSABILIDADES DA CONTRATADA (VITRAS)

A CONTRATADA se compromete a:

3.1 Disponibilizar o sistema VITRAS em ambiente de produção seguro (AWS Elastic Beanstalk, região sa-east-1) com disponibilidade mínima de [SLA_PENDENTE — ex: 99%] durante horário de atendimento da UBS.

3.2 Realizar o treinamento inicial da equipe técnica e coordenação da UBS conforme procedimento de onboarding documentado.

3.3 Prover suporte técnico em horário comercial com tempo de resposta ≤ [SLA_P1_PENDENTE — ex: 1 hora] para incidentes críticos (P0/P1) e ≤ 4 horas para incidentes não críticos durante o período do piloto.

3.4 Manter a segurança dos dados conforme LGPD, incluindo:
- Criptografia de dados sensíveis em repouso e em trânsito
- Controle de acesso por equipe e unidade de saúde
- Audit logs completos de todas as operações clínicas
- Procedimentos documentados de resposta a incidentes

3.5 Notificar a CONTRATANTE em até **1 (uma) hora** após confirmação de qualquer incidente de segurança que envolva dados de pacientes, para fins de notificação à ANPD em até 72 horas (LGPD Art. 48 §1).

3.6 Não realizar qualquer operação de anonimização, exclusão ou portabilidade de dados de pacientes sem autorização expressa da CONTRATANTE e do DPO designado.

3.7 Realizar backup automático dos dados com retenção mínima de [BACKUP_RETENTION_PENDENTE — ex: 7 dias] e manter capacidade de restauração conforme procedimento de DR documentado (RTO ≤ 240 min, RPO ≤ 24h).

3.8 Não subcontratar processamento de dados de pacientes sem comunicação prévia à CONTRATANTE, exceto pelos suboperadores já declarados no RIPD (AWS, Upstash).

---

## CLÁUSULA 4 — RESPONSABILIDADES DA CONTRATANTE (PREFEITURA)

A CONTRATANTE se compromete a:

4.1 Designar formalmente um Encarregado de Dados (DPO) conforme LGPD Art. 41, comunicando os dados do DPO à CONTRATADA antes do início da operação com pacientes reais.

4.2 Garantir que todos os profissionais de saúde que acessarão o sistema sejam orientados sobre os termos de uso, sigilo de senha e responsabilidades sobre os dados de pacientes.

4.3 Designar um Coordenador UBS responsável pelo ponto de contato operacional com a CONTRATADA durante o piloto.

4.4 Garantir conectividade de internet adequada nas estações de trabalho da UBS para acesso ao sistema.

4.5 Não exigir que a CONTRATADA processe dados de pacientes para finalidades distintas das descritas na Cláusula 2 e no RIPD sem aditivo contratual.

4.6 Notificar a CONTRATADA com antecedência mínima de [PRAZO_NOTIFICACAO_PENDENTE — ex: 30 dias] sobre qualquer intenção de encerrar o piloto ou expandir para novas UBS.

4.7 Reconhecer que a CONTRATADA atua como **operadora** de dados nos termos da LGPD, sendo a CONTRATANTE a **controladora** responsável pela legalidade, adequação e finalidade do tratamento.

---

## CLÁUSULA 5 — PROTEÇÃO DE DADOS PESSOAIS (LGPD)

5.1 **Controlador:** A CONTRATANTE (Prefeitura) é a controladora dos dados pessoais de pacientes e profissionais de saúde tratados pelo VITRAS.

5.2 **Operador:** A CONTRATADA (Vitras) é operadora, processando os dados exclusivamente conforme instruções da CONTRATANTE e nos termos do RIPD anexo.

5.3 **Base legal:** O tratamento de dados de saúde tem como base legal o Art. 11, II, f da LGPD (tutela da saúde, por profissionais de saúde ou por entidades sanitárias).

5.4 **DPA:** As condições de processamento de dados estão formalizadas no RIPD (Relatório de Impacto à Proteção de Dados) elaborado em conjunto, que integra este instrumento como Anexo II.

5.5 **Notificação de incidentes:** A CONTRATADA notificará a CONTRATANTE em até 1 (uma) hora após confirmação de incidente de segurança envolvendo dados pessoais. A CONTRATANTE é responsável pela notificação à ANPD no prazo legal de 72 horas.

5.6 **Direitos dos titulares:** Solicitações de acesso, correção, portabilidade ou eliminação de dados por parte dos pacientes devem ser direcionadas ao DPO da CONTRATANTE.

5.7 **Suboperadores:** A CONTRATADA poderá utilizar os seguintes suboperadores, declarados no RIPD: Amazon Web Services (AWS), Upstash. Qualquer novo suboperador requer comunicação prévia e aditivo ao RIPD.

5.8 **Encerramento:** Ao término deste instrumento, a CONTRATADA dará acesso à CONTRATANTE para exportação completa dos dados e, após confirmação da exportação pela CONTRATANTE, procederá à exclusão segura dos dados nos sistemas da CONTRATADA em prazo não superior a [PRAZO_EXCLUSAO_PENDENTE — ex: 30 dias].

---

## CLÁUSULA 6 — CONFIDENCIALIDADE

6.1 Ambas as partes comprometem-se a manter sigilo sobre informações confidenciais trocadas em razão deste instrumento.

6.2 São consideradas confidenciais: dados de pacientes, credenciais de acesso ao sistema, configurações de infraestrutura, código-fonte proprietário da CONTRATADA, e estratégias comerciais de ambas as partes.

6.3 A obrigação de confidencialidade persiste por [PRAZO_CONFIDENCIALIDADE_PENDENTE — ex: 5 anos] após o término deste instrumento.

6.4 Não é considerada violação de confidencialidade a divulgação por força de ordem judicial ou determinação de autoridade competente, desde que a parte notifique a outra previamente quando permitido por lei.

---

## CLÁUSULA 7 — PROPRIEDADE DOS DADOS

7.1 Os dados de pacientes inseridos no VITRAS pertencem exclusivamente à CONTRATANTE (Prefeitura Municipal) e aos próprios titulares (pacientes).

7.2 A CONTRATADA não adquire qualquer direito sobre os dados de pacientes processados em razão deste instrumento.

7.3 A CONTRATADA é titular do código-fonte, algoritmos, modelos e documentação técnica do sistema VITRAS.

7.4 Em caso de encerramento deste instrumento, a CONTRATANTE tem direito a exportar a totalidade dos dados em formato aberto (JSON ou CSV) por meio da funcionalidade de backup do sistema.

---

## CLÁUSULA 8 — VIGÊNCIA

8.1 Este instrumento entra em vigor na data de sua assinatura por ambas as partes e tem duração de [VIGENCIA_PENDENTE — ex: 12 meses], podendo ser prorrogado por igual período mediante aditivo.

8.2 O período de piloto controlado (UBS #1) encerra-se após [PERIODO_PILOTO_PENDENTE — ex: 90 dias] da data de go-live, conforme definido no cronograma de onboarding.

8.3 A expansão para novas UBS requer aditivo contratual específico, não sendo automaticamente coberta por este instrumento.

---

## CLÁUSULA 9 — ENCERRAMENTO E RESCISÃO

9.1 O presente instrumento poderá ser encerrado:

a) Por término natural da vigência, sem prorrogação  
b) Por acordo mútuo entre as partes, mediante notificação com antecedência mínima de [PRAZO_NOTIFICACAO_PENDENTE] dias  
c) Por inadimplemento de qualquer das obrigações essenciais, após notificação formal e prazo de cura de [PRAZO_CURA_PENDENTE — ex: 15 dias úteis]  
d) Por determinação judicial ou administrativa  

9.2 Em caso de encerramento antecipado, a CONTRATADA deve garantir a continuidade do serviço por [PRAZO_TRANSICAO_PENDENTE — ex: 30 dias] para permitir migração de dados e transição para outro sistema.

9.3 Os dados de pacientes devem ser exportados e entregues à CONTRATANTE antes da exclusão pelos sistemas da CONTRATADA.

---

## CLÁUSULA 10 — DISPOSIÇÕES GERAIS

10.1 Este instrumento representa o acordo integral entre as partes sobre seu objeto, substituindo quaisquer entendimentos anteriores.

10.2 Qualquer alteração deve ser formalizada por aditivo escrito e assinado por ambas as partes.

10.3 Fica eleito o foro da Comarca de [MUNICIPIO_UBS], [ESTADO_UBS], para dirimir eventuais litígios oriundos deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

10.4 Integram este instrumento como Anexos:
- **Anexo I:** Identificação das UBS participantes do piloto
- **Anexo II:** RIPD — Relatório de Impacto à Proteção de Dados (`lgpd-dpo-ripd-guide.md`)
- **Anexo III:** SLA e procedimentos de suporte (`incident-response.md`, `operational-routines.md`)

---

## ASSINATURAS

Assinado em [MUNICIPIO_UBS], [DATA_ASSINATURA_PENDENTE].

---

**Pela CONTRATANTE — Prefeitura Municipal de [MUNICIPIO_UBS]:**

```
Nome:       [NOME_PREFEITO_PENDENTE]
Cargo:      Prefeito(a) Municipal
CPF:        [CPF_REPRESENTANTE_PENDENTE]
Assinatura: _________________________________
Data:       _____ / _____ / _______
```

**Pela Secretaria Municipal de Saúde:**

```
Nome:       [NOME_SECRETARIO_SAUDE_PENDENTE]
Cargo:      Secretário(a) Municipal de Saúde
Assinatura: _________________________________
Data:       _____ / _____ / _______
```

---

**Pela CONTRATADA — [RAZAO_SOCIAL_PENDENTE]:**

```
Nome:       João Pedro [SOBRENOME_PENDENTE]
Cargo:      Representante Legal / Tech Lead
CPF:        [CPF_JOAO_PEDRO_PENDENTE]
CNPJ:       [CNPJ_PENDENTE_FORMALIZACAO]
Assinatura: _________________________________
Data:       _____ / _____ / _______
```

---

**Testemunhas (recomendado para validade extra-judicial):**

```
Testemunha 1:
Nome:       _________________________________
CPF:        _________________________________
Assinatura: _________________________________

Testemunha 2:
Nome:       _________________________________
CPF:        _________________________________
Assinatura: _________________________________
```

---

## ANEXO I — UBS Participantes do Piloto

| # | Nome da UBS | Endereço | Código CNES | Data prevista go-live |
|---|-------------|----------|-------------|----------------------|
| 1 | [NOME_UBS] | [ENDERECO_UBS_PENDENTE] | [CNES_PENDENTE] | [DATA_GO_LIVE] |

---

*Template versão v1.0 — criado 2026-06-10*  
*Revisão jurídica obrigatória antes de uso — este template não constitui aconselhamento jurídico*  
*Placeholders `_PENDENTE` devem ser substituídos antes de qualquer assinatura*
