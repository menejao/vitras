# Plano de Comunicação — UBS #1

## Stakeholders

- Coordenador UBS: principal contato operacional
- Equipe clínica: usuários finais
- TI prefeitura: responsável por dispositivos e rede
- Secretaria de Saúde: informada sobre implantação
- Tech Lead VITRAS: responsável técnico

## Mensagens por fase

### 1 semana antes

**Para:** Coordenador UBS + TI Prefeitura

> "A implantação do VITRAS na [UBS] está confirmada para [data]. Precisamos garantir:
> - Acesso à internet estável nas estações de trabalho
> - Teste de acesso ao sistema em [URL staging]
> - Lista de profissionais que precisam de acesso
>
> Por favor confirmar recebimento até [data]."

### Dia anterior ao deploy

**Para:** Coordenador UBS

> "Amanhã às [hora] iniciaremos a implantação. O sistema ficará em manutenção por até 4 horas. Os atendimentos em andamento devem ser finalizados antes de [hora]. Qualquer dúvida, entre em contato: [contato]."

### Início do deploy (T-0)

**Para:** TI Prefeitura

> "Iniciando deploy VITRAS [hora]. Qualquer problema de rede ou acesso, favor reportar imediatamente para [contato]."

### GO-LIVE confirmado (T+30min se smoke test OK)

**Para:** Coordenador UBS + equipe clínica

> "VITRAS está operacional em [URL]. Acesso disponível. Suporte técnico disponível até [hora] hoje e via [canal] a partir de amanhã."

### Em caso de incidente

Ver docs/operations/incident-response.md para templates de comunicação de incidente.

### Em caso de rollback

Ver docs/rollout/ubs-001/rollback-plan.md para mensagem de comunicação de rollback.

## Canal de suporte contínuo

- **Período D+0 a D+14:** [WhatsApp/e-mail grupo de suporte]
- **Após D+14:** [canal regular de suporte]
