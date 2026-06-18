# Pacote de Parceria Municipal — VITRAS APS / Piloto CDS

**Documento:** Apresentação executiva para município parceiro  
**Versão:** 1.0  
**Data:** 2026-06-18  
**Contato:** lgpd@vitras.com.br

---

## O que é o VITRAS APS

O VITRAS APS é uma plataforma integrada para gestão da Atenção Primária à Saúde, desenvolvida para equipes de Unidades Básicas de Saúde. A plataforma cobre os principais fluxos operacionais da UBS — cadastro de pacientes, atendimentos, prescrições, vacinas e farmácia — com rastreabilidade completa e conformidade com a LGPD.

O VITRAS opera como **Operador de dados**, nos termos da Lei Geral de Proteção de Dados, sob a direção do Município como **Controlador dos dados de saúde**.

---

## Objetivo do Piloto

Validar a integração entre o VITRAS e o sistema e-SUS PEC do Ministério da Saúde por meio da exportação de fichas CDS (Coleta de Dados Simplificada) no formato `.esus`.

O piloto busca confirmar que:

- Os dados cadastrais e de atendimento gerados no VITRAS chegam corretamente ao PEC
- O fluxo de importação funciona de ponta a ponta sem perda de informação
- A integração atende às especificações técnicas do DATASUS para o e-SUS AB

---

## Escopo do Piloto

**Incluído:**

- Exportação de Fichas de Cadastro Individual (FCI)
- Exportação de Fichas de Cadastro Domiciliar (FCD)
- Exportação de Fichas de Atendimento Individual (FAI)
- Importação no e-SUS PEC da UBS parceira
- Validação dos registros importados

**Não incluído nesta fase:**

- Integração automática ou em tempo real com o PEC
- Transmissão direta à RNDS
- Outros tipos de ficha CDS (BPA, FCA, etc.)
- Alterações no fluxo operacional existente da UBS

---

## Duração

O piloto de homologação tem duração de **uma sessão de até 4 horas**, conduzida presencialmente ou por videoconferência com suporte da equipe VITRAS.

Após a homologação aprovada, o município recebe um relatório de evidências assinado.

---

## Responsabilidades

### Município (UBS parceira)

- Disponibilizar acesso ao e-SUS PEC versão >= 5.4.36
- Informar CNES, INE e CNS do profissional operador
- Disponibilizar técnico com perfil de importação CDS no PEC
- Definir se o piloto ocorre em ambiente de homologação ou produção do PEC
- Assinar o relatório de evidências ao final

### VITRAS

- Configurar o ambiente com CNES e INE da UBS parceira
- Gerar o arquivo de exportação `.esus` com dados de teste
- Conduzir a sessão de homologação
- Prover suporte técnico durante a sessão
- Emitir o relatório final de evidências

---

## Critérios de Sucesso

O piloto é considerado aprovado quando:

1. O arquivo `.esus` é aceito pelo PEC sem erros críticos
2. As fichas exportadas aparecem corretamente no PEC
3. Os dados dos pacientes de teste estão íntegros (nome, data de nascimento, CNS, endereço)
4. A contagem de registros importados bate com a contagem exportada
5. O relatório de evidências é assinado por ambas as partes

---

## Proteção de Dados (LGPD)

O piloto de homologação utiliza **exclusivamente dados sintéticos** (fictícios). Nenhum dado real de paciente é utilizado nesta etapa.

Após aprovação do piloto, o uso em produção com dados reais será regido por:

- **Acordo de Processamento de Dados (DPA)** entre o Município (Controlador) e a VITRAS (Operador)
- Política de Privacidade publicada em vitras.com.br/privacidade
- Encarregado de Dados (DPO): João Pedro Menegucci Benedito — lgpd@vitras.com.br

A infraestrutura VITRAS opera integralmente no Brasil (AWS sa-east-1 — São Paulo), em conformidade com os requisitos da LGPD para dados sensíveis de saúde.

---

## Suporte durante o piloto

A equipe VITRAS estará disponível durante toda a sessão de homologação para:

- Auxiliar na configuração do CNES/INE
- Regenerar o arquivo de exportação se necessário
- Investigar qualquer inconsistência encontrada no PEC
- Responder dúvidas técnicas sobre o formato CDS

Contato técnico durante o piloto: lgpd@vitras.com.br

---

## Próximos Passos para o Município

Para iniciar o piloto, o município precisa:

1. **Confirmar versão do PEC** — verificar se o PEC está na versão >= 5.4.36
2. **Informar CNES e INE** — da UBS que participará da homologação
3. **Indicar técnico responsável** — com perfil de importação CDS no PEC
4. **Escolher o ambiente** — homologação ou produção do PEC
5. **Agendar a sessão** — enviar data e horário de preferência para lgpd@vitras.com.br

A equipe VITRAS coordenará todos os demais preparativos técnicos.

---

## Perguntas Frequentes

**O piloto altera algum dado no PEC de produção?**  
Não, se realizado no ambiente de homologação PEC. Se realizado em produção, os registros sintéticos inseridos poderão ser removidos pelo técnico municipal após a validação.

**O VITRAS precisa de acesso ao PEC do município?**  
Não. O upload do arquivo `.esus` é realizado pelo próprio técnico municipal no painel do PEC. O VITRAS fornece o arquivo e acompanha o resultado.

**O piloto implica contrato de uso?**  
Não. A homologação é uma etapa técnica de validação. A decisão de adotar o VITRAS é independente.

**Quanto tempo leva para ter o resultado?**  
O resultado é comunicado ao final da sessão, no mesmo dia. O relatório formal é emitido em até 2 dias úteis.

---

*VITRAS APS — docs/homologacao/pilot-municipal-package.md*
