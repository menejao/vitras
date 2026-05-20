# Checklist de Go-live (UBS)

## A. Infra
- [ ] Backend online no Render.
- [ ] Banco online (Neon).
- [ ] Frontend publicado.
- [ ] `FRONTEND_ORIGINS` configurado corretamente.

## B. Seguranca
- [ ] `JWT_SECRET` forte configurado.
- [ ] `DATA_ENCRYPTION_KEY` forte configurado.
- [ ] `NODE_ENV=production`.
- [ ] 2FA ativado em enfermeira e medica.
- [ ] Senhas iniciais trocadas.

## C. Operacao clinica
- [ ] Cadastro de paciente funcionando.
- [ ] Registro clinico atualiza alertas.
- [ ] Regras por perfil validadas (ACS/Medica/Enfermeira).
- [ ] Exclusao com confirmacao critica testada.

## D. Governanca
- [ ] Politica LGPD interna aprovada.
- [ ] Rotina semanal definida (responsavel + horario).
- [ ] Processo de incidente acordado.
- [ ] Backup semanal definido.

## E. Homologacao final
- [ ] Login e refresh sem cair sessao.
- [ ] Navegacao sem precisar F5.
- [ ] Mobile usavel em telas principais.
- [ ] Auditoria exportavel (JSON/CSV).
