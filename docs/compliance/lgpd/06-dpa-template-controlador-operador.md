# Contrato de Processamento de Dados (DPA)

**Data Processing Agreement — Controlador × Operador**  
**Conforme Art. 39 da Lei nº 13.709/2018 (LGPD)**

**Template v1.0-draft · 2026-06-18**  
**Classificação:** Interno — Confidencial (preencher antes de assinar)

---

## Partes

**CONTROLADOR:**  
Nome/Razão Social: TODO_USER: razão social do município ou secretaria  
CNPJ: TODO_USER  
Endereço: TODO_USER  
Representante legal: TODO_USER  
Cargo: TODO_USER  
("**Controlador**")

**OPERADOR:**  
TODO_USER: razão social da VITRAS  
CNPJ: TODO_USER  
Endereço: TODO_USER  
Representante legal: TODO_USER  
Cargo: TODO_USER  
("**Operador**" ou "**VITRAS**")

---

## Cláusula 1 — Objeto

1.1 O presente Contrato de Processamento de Dados ("DPA") rege o tratamento de dados pessoais realizado pelo Operador em nome e sob instruções do Controlador, no âmbito do contrato principal de prestação de serviços da plataforma VITRAS APS ("Contrato Principal").

1.2 O DPA é parte integrante do Contrato Principal e prevalece sobre suas disposições gerais em matéria de proteção de dados pessoais.

---

## Cláusula 2 — Papéis e Responsabilidades

2.1 O **Controlador** define as finalidades e os meios do tratamento de dados pessoais de pacientes, profissionais de saúde e responsáveis familiares vinculados à sua rede de saúde.

2.2 O **Operador** trata os dados pessoais exclusivamente conforme as instruções documentadas do Controlador, o Contrato Principal e este DPA, salvo obrigação legal em contrário, caso em que o Operador notificará o Controlador previamente quando possível.

2.3 Cada parte é responsável pelo cumprimento das obrigações que lhe cabem sob a LGPD no âmbito de seu respectivo papel.

---

## Cláusula 3 — Instruções do Controlador

3.1 O Controlador instrui o Operador a tratar dados pessoais para as seguintes finalidades:

- Registro e gestão de cadastros individuais de pacientes
- Registro e gestão de cadastros domiciliares
- Registro de atendimentos clínicos individuais
- Exportação de fichas CDS para o PEC e-SUS APS (alimentação do SISAB), quando habilitado pelo Controlador
- Controle de acesso de profissionais de saúde à plataforma
- Suporte técnico operacional

3.2 O Operador não tratará os dados para nenhuma outra finalidade sem instrução prévia e documentada do Controlador, salvo obrigação legal.

3.3 Modificações nas instruções devem ser formalizadas por escrito (e-mail com confirmação ou aditivo contratual).

---

## Cláusula 4 — Confidencialidade

4.1 O Operador garantirá que as pessoas autorizadas a tratar os dados pessoais assumiram compromissos de confidencialidade, seja por cláusula contratual, seja por obrigação legal.

4.2 O acesso aos dados é restrito ao mínimo necessário para a execução das finalidades previstas (princípio da necessidade, Art. 6º, III, LGPD).

---

## Cláusula 5 — Medidas de Segurança

5.1 O Operador implementa e mantém medidas técnicas e organizacionais adequadas ao risco, incluindo:

| Medida | Detalhe |
|-------|--------|
| Criptografia em trânsito | HTTPS/TLS em todas as comunicações |
| Criptografia em repouso | AES-256-GCM em campos sensíveis (CPF, CNS, NIS, CNS responsável) |
| Controle de acesso | RBAC por perfil; capability gate para exportação CDS |
| Auditoria | Cadeia de auditoria SHA-256 imutável |
| Minimização em logs | Dados sensíveis redactados em audit logs |
| Gestão de identidade | JWT com expiração; break-glass com log forçado |

5.2 O Operador notificará o Controlador de qualquer incidente de segurança que afete dados do Controlador conforme Cláusula 8.

5.3 Mediante solicitação, o Operador fornecerá ao Controlador documentação razoável sobre suas medidas de segurança.

---

## Cláusula 6 — Suboperadores

6.1 O Controlador autoriza o Operador a contratar suboperadores listados no Registro de Suboperadores (documento `10-subprocessors-register.md`).

6.2 O Operador notificará o Controlador com antecedência mínima de **15 dias corridos** sobre qualquer alteração (adição ou substituição) de suboperador relevante, concedendo ao Controlador o direito de se opor fundamentadamente.

6.3 O Operador imporá aos suboperadores obrigações de proteção de dados equivalentes às deste DPA.

6.4 O Operador permanece responsável perante o Controlador pelo cumprimento dos suboperadores.

---

## Cláusula 7 — Exportação CDS / e-SUS

7.1 O módulo de Exportação CDS permite ao Controlador gerar ficheiros no formato LEDI APS 7.4.x (.esus) para importação no PEC e-SUS APS do Ministério da Saúde.

7.2 A exportação é realizada exclusivamente por usuários com capability `cds.export` atribuída pelo próprio Controlador.

7.3 Toda exportação é registrada no audit log da plataforma com: fichaUuid, exportedBy, recordDate, tipo de ficha.

7.4 Após a importação no PEC, os dados ficam sob a governança do Ministério da Saúde, fora do escopo de operação do VITRAS.

7.5 É pré-requisito para ativação do módulo CDS Export: **PEC e-SUS APS versão ≥ 5.4.36** instalado na UBS. O Controlador é responsável por manter o PEC atualizado.

---

## Cláusula 8 — Incidentes de Segurança

8.1 O Operador notificará o Controlador sobre qualquer incidente de segurança que afete dados pessoais do Controlador no prazo de **72 horas** após ter ciência do incidente, na medida do possível.

8.2 A notificação incluirá, no mínimo:

- Descrição da natureza do incidente
- Categorias e volume aproximado de dados e titulares afetados
- Medidas de contenção adotadas ou em curso
- Nome e contato do ponto focal para a gestão do incidente

8.3 O Controlador é responsável por avaliar a necessidade de comunicação à ANPD (prazo de 2 dias úteis após ciência, conforme resolução ANPD) e aos titulares afetados.

8.4 O Operador apoiará o Controlador no fornecimento de informações adicionais necessárias para a comunicação à ANPD e aos titulares.

---

## Cláusula 9 — Auditoria

9.1 O Operador manterá documentação suficiente para demonstrar o cumprimento das obrigações deste DPA.

9.2 Mediante solicitação fundamentada do Controlador com antecedência mínima de **30 dias**, o Operador concederá acesso às informações necessárias para verificação do cumprimento, podendo realizar auditoria por conta e risco do Controlador, mediante NDA prévio dos auditores.

9.3 As auditorias não poderão comprometer a segurança de outros clientes do Operador.

---

## Cláusula 10 — Direitos dos Titulares

10.1 O Operador auxiliará o Controlador, na medida do possível, no atendimento das solicitações dos titulares de dados relativas ao exercício dos direitos previstos no Art. 18 da LGPD.

10.2 Caso o Operador receba diretamente uma solicitação de titular que seja de competência do Controlador, redirecionará ao Controlador no prazo de **5 dias úteis**.

10.3 O Controlador reconhece que algumas solicitações (como eliminação de dados assistenciais) podem estar sujeitas a exceções legais (Art. 16 LGPD) e que o Operador não eliminará dados assistenciais sem validação expressa do Controlador.

---

## Cláusula 11 — Retenção e Devolução/Eliminação de Dados

11.1 Ao término do Contrato Principal, o Operador disponibilizará ao Controlador, no prazo de **30 dias**, exportação de todos os dados do Controlador em formato legível (JSON ou equivalente).

11.2 Após a confirmação de recebimento pelo Controlador ou decorrido o prazo de **60 dias** do término contratual, o Operador procederá à eliminação segura dos dados do Controlador em seus sistemas, salvo obrigação legal de retenção.

11.3 O Operador manterá logs de auditoria por no mínimo **5 anos**, mesmo após a eliminação dos dados operacionais.

11.4 Mediante solicitação, o Operador fornecerá certificado de eliminação.

---

## Cláusula 12 — Transferência Internacional de Dados

12.1 TODO_USER: verificar se infraestrutura está integralmente no Brasil.

*Premissa atual:* Se toda a infraestrutura estiver no Brasil, não há transferência internacional e esta cláusula é inaplicável.

*Caso haja infraestrutura fora do Brasil:* O Operador garantirá que a transferência internacional se dê apenas para países com grau adequado de proteção reconhecido pela ANPD ou mediante garantias adequadas (Art. 33 LGPD), e notificará o Controlador.

---

## Cláusula 13 — Cooperação com a ANPD

13.1 Cada parte cooperará com a ANPD no exercício de suas competências, respondendo às suas solicitações no prazo legal.

13.2 O Operador notificará o Controlador sobre qualquer comunicação recebida da ANPD que envolva dados do Controlador, salvo proibição legal.

---

## Cláusula 14 — Logs e Evidências

14.1 O Operador mantém cadeia de auditoria imutável (hash SHA-256 encadeado) de todos os eventos da plataforma.

14.2 Esses logs são disponibilizados ao Controlador através das funcionalidades de exportação de auditoria da plataforma.

14.3 O Controlador pode solicitar cópia dos logs referentes aos seus dados mediante justificativa documentada.

---

## Cláusula 15 — Vigência

15.1 Este DPA entra em vigor na data de assinatura e permanece vigente enquanto durar o Contrato Principal.

15.2 As obrigações de confidencialidade e as cláusulas de retenção/eliminação sobrevivem ao término contratual pelos prazos nelas estabelecidos.

---

## Assinaturas

**CONTROLADOR:**  
Nome: TODO_USER  
Cargo: TODO_USER  
Data: TODO_USER  
Assinatura: ___________________________

---

**OPERADOR (VITRAS):**  
Nome: TODO_USER  
Cargo: TODO_USER  
Data: TODO_USER  
Assinatura: ___________________________

---

*VITRAS APS · DPA Template v1.0-draft · 2026-06-18*
