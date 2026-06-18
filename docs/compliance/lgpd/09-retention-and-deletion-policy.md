# Política de Retenção e Descarte de Dados

**VITRAS APS — v1.0-draft**  
**Data:** 2026-06-18  
**Classificação:** Interno — Operacional  
**Owner:** DPO + Tech Lead

---

## 1. Princípio Geral

O VITRAS retém dados pessoais **pelo tempo mínimo necessário** para cumprimento da finalidade do tratamento, da obrigação legal ou contratual aplicável.

**Regra mínima:** Nenhum dado é retido além dos prazos definidos nesta política sem justificativa documentada e aprovação do DPO.

**Regra de precedência:** O prazo mais longo entre obrigação legal, contratual e técnica prevalece.

---

## 2. Dados Assistenciais de Pacientes

### Fundamentação

Dados de saúde registrados no sistema VITRAS APS são de titularidade e responsabilidade do Controlador (Município/Secretaria de Saúde). O VITRAS os trata como Operador.

A retenção de prontuários e registros de saúde segue obrigações legais do Controlador, em especial:

- **CFM Resolução 2.299/2021** — prontuário médico: mínimo **20 anos** após último atendimento (adultos)
- **Portaria MS 1.412/2013** — obrigações SISAB
- Eventual legislação estadual ou municipal aplicável ao Controlador

### Regras

| Tipo de dado | Retenção mínima | Quem decide a eliminação |
|-------------|----------------|--------------------------|
| Cadastro individual do paciente | 20 anos após último contato | Controlador |
| Cadastro domiciliar | 20 anos ou duração do vínculo com o ACS | Controlador |
| Registros de atendimento | 20 anos após o atendimento | Controlador |
| Dados exportados para PEC | Sob governança do Ministério da Saúde após importação | MS / Fora do escopo VITRAS |

**O VITRAS não elimina dados assistenciais por solicitação direta de titular ou terceiro sem autorização expressa do Controlador** e avaliação da obrigação de retenção legal aplicável.

---

## 3. Audit Logs (Cadeia de Auditoria)

| Item | Retenção | Justificativa |
|------|----------|---------------|
| Eventos de auditoria SHA-256 | **Mínimo 5 anos** | Rastreabilidade, suporte a incidentes, exercício de direitos |
| Logs de exportação CDS (`cds.export.*`) | **Mínimo 5 anos** | Rastreabilidade de exportações ao SISAB |
| Eventos break-glass | **Mínimo 5 anos** | Controle de acesso privilegiado |

Após o prazo, os logs podem ser eliminados ou anonimizados, mantendo estatísticas agregadas sem dados pessoais.

---

## 4. Backups

| Tipo | Frequência | Retenção |
|------|-----------|----------|
| Backup completo do banco de dados | TODO_USER: diário/semanal | **Mínimo 30 dias** (aumentar para 90 dias recomendado) |
| Backup pré-migration | Por evento de migration | 90 dias ou até validação da migration |
| Snapshot de recuperação de desastre | TODO_USER: frequência | TODO_USER: prazo — ex: 7 dias |

Backups eliminados automaticamente após o prazo, salvo instrução do DPO para preservação (ex: investigação de incidente).

---

## 5. Dados de Suporte Técnico

| Tipo | Retenção |
|------|----------|
| Tickets e registros de suporte | **2 anos** após encerramento do ticket |
| Logs de sessão de suporte remoto (se houver) | **90 dias** |
| Capturas de tela de erro reportadas | **90 dias** após resolução |

Dados de pacientes eventualmente contidos em logs de suporte devem ser pseudonimizados ou eliminados assim que o diagnóstico for concluído.

---

## 6. Logs Técnicos de Sistema

| Tipo | Retenção |
|------|----------|
| Logs de acesso HTTP / API | **90 dias** |
| Logs de erro de aplicação | **90 dias** |
| Logs de infraestrutura (CloudWatch ou equivalente) | **90 dias** (padrão cloud) |
| Logs de deploy e CI/CD | **30 dias** |

---

## 7. Dados de Autenticação e Usuários

| Tipo | Retenção |
|------|----------|
| Dados de usuário ativo | Enquanto durar o vínculo contratual do usuário |
| Hash de senha | Eliminado na desativação do usuário |
| JWT (sessão ativa) | Expiração natural do token |
| Registro histórico de usuários desativados | **2 anos** após desativação |

---

## 8. Encerramento Contratual

Quando o contrato entre VITRAS e o Controlador é encerrado:

1. **D+0 (término contratual):** VITRAS notifica o Controlador e inicia o processo de devolução
2. **D+30:** VITRAS disponibiliza exportação completa dos dados do Controlador em formato JSON (ou equivalente acordado)
3. **D+60:** Após confirmação de recebimento pelo Controlador (ou decorrido o prazo), VITRAS inicia eliminação dos dados operacionais do Controlador
4. **D+90:** Eliminação segura concluída; certificado de eliminação emitido
5. **Audit logs:** Retidos por 5 anos conforme seção 3, mesmo após encerramento

---

## 9. Eliminação Segura

**Método:** Eliminação lógica com sobrescrita ou exclusão de chaves de criptografia (crypto-shredding), conforme capacidade da infraestrutura.

**Dados criptografados (CPF, CNS, NIS):** A eliminação da chave de criptografia torna o dado irrecuperável (crypto-shredding — equivalente à eliminação para fins práticos).

**Backups:** Eliminação do backup fisicamente ou via sobreposição do ciclo de retenção.

**Certificado de eliminação:** Emitido pelo Tech Lead + DPO, arquivado por 5 anos.

---

## 10. Exceções Legais à Eliminação

A eliminação pode ser diferida ou recusada quando:

| Exceção | Base |
|---------|------|
| Obrigação de retenção de prontuário (20 anos, CFM) | CFM Res. 2.299/2021 |
| Processo judicial ou administrativo em curso | Art. 16, IV, LGPD |
| Investigação de incidente de segurança em andamento | Legítimo interesse + obrigação processual |
| Obrigação de notificação compulsória | Lei 6.259/75 e legislação de vigilância epidemiológica |
| Solicitação da ANPD | Competência regulatória |

Em todos os casos de exceção, o DPO deve documentar a justificativa e o prazo esperado para eliminação.

---

## 11. Aprovação e Revisão

| Papel | Nome | Data |
|-------|------|------|
| DPO | TODO_USER | TODO_USER |
| Tech Lead | TODO_USER | TODO_USER |
| Revisão prevista | — | TODO_USER (anual) |

---

*VITRAS APS · Política de Retenção e Descarte v1.0-draft · 2026-06-18*
