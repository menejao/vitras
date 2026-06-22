# Auditoria — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/AuditLogPanel.jsx`  
**Tab:** `audit_log`

---

## 1. Objetivo e contexto

Trilha de auditoria do VITRAS APS. Exibe todos os eventos registrados no sistema com possibilidade de filtro por ação, categoria, usuário e período. Permite exportação e, para admins, expurgo por retenção. Implementa chain hash (AUD-01) — cada registro tem hash encadeado com o anterior.

**Usuários:** `support_admin`, admins com `audit.read`.

**Frequência de uso:** Sob demanda — investigações de incidentes, auditorias LGPD.

---

## 2. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/audit/logs` | Listar logs com filtros |
| GET | `/audit/logs/export` | Exportar logs (CSV/JSON) |
| DELETE | `/audit/logs/prune` | Expurgo por retenção (admin) |

---

## 3. Elementos da página

### 3.1 Filtros

- Busca texto (userId, ação, descrição)
- Select: Categoria (auth, read, write, export, privacy, etc.)
- Select: Ação (listagem de ACTION_LABELS)
- Date range: período de início e fim
- Select: Usuário (se admin)

### 3.2 Tabela de logs

Colunas: Timestamp / Usuário / Ação / Categoria / Descrição / Hash status

### 3.3 Badge de hash (AUD-01)

- Verde: `hashVersion === "v2"` — hash válido
- Amarelo: `legacy_incompatible` — log migrado, hash incompatível
- Vermelho: hash inválido (alerta de integridade)

### 3.4 Ações administrativas

- Botão "Exportar" → `GET /audit/logs/export`
- Botão "Expurgo" (somente admin) → `DELETE /audit/logs/prune`

---

## 4. Dicionário de eventos (ACTION_LABELS)

| Evento | Label | Tone |
|---|---|---|
| `LOGIN` | Login | success |
| `LOGIN_FAILED` | Tentativa falha | danger |
| `LOGOUT` | Logout | neutral |
| `USUARIO_CADASTRADO` | Usuário cadastrado | info |
| `USUARIO_EDITADO` | Usuário editado | warning |
| `USUARIO_EXCLUIDO` | Usuário excluído | danger |
| `PACIENTE_CADASTRADO` | Paciente cadastrado | accent |
| `PACIENTE_EDITADO` | Paciente editado | accent |
| `PACIENTE_EXCLUIDO` | Paciente excluído | danger |
| `ATENDIMENTO_REGISTRADO` | Atendimento | info |
| `TAREFA_CRIADA` | Tarefa criada | warning |
| `MENSAGEM_ENVIADA` | Mensagem | info |
| `ACESSO_PRONTUARIO` | Acesso prontuário | info |
| `LANCAMENTO_REGISTRO` | Lançamento prontuário | info |
| `INATIVACAO_REGISTRO` | Inativação prontuário | warning |
| `PEDIDO_EXAME` | Pedido de exame | accent |
| `PRESCRICAO_EMITIDA` | Prescrição emitida | success |
| `ENCAMINHAMENTO_INTERNO` | Encaminhamento | info |
| `DISPENSACAO_FARMACIA` | Dispensação | accent |
| `ESTOQUE_AJUSTADO` | Ajuste de estoque | warning |
| `RESET_SENHA_SOLICITADO` | Reset de senha | warning |
| `audit.export` | Exportação de auditoria | warning |
| `audit.retention_prune` | Expurgo por retenção | danger |

---

## 5. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-AUD-01 | Exibir hash | `hashVersion === "v2"` | Badge verde |
| RN-AUD-02 | Exibir hash | `legacy_incompatible` | Badge amarelo |
| RN-AUD-03 | Exibir hash | Falha na verificação | Badge vermelho + alerta |
| RN-AUD-04 | Dados clínicos | Sempre | Não são registrados em logs operacionais (LGPD) |
| RN-AUD-05 | Expurgo | `isAdmin(user)` | Somente admin pode executar |

---

## 6. Permissões

| Ação | Requer |
|---|---|
| Ler logs | `audit.read` ou `isAdmin` |
| Exportar | `audit.read` ou `isAdmin` |
| Expurgo | `isAdmin` |

---

## 7. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
