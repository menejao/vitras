# Protocolos — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/components/ProtocolsTab.jsx`  
**Tab:** `protocols`

---

## 1. Objetivo e contexto

Gestão dos templates de protocolo clínico da UBS. Protocolos definem categorias de pacientes e critérios de acompanhamento. São usados por `evaluateGroup()` para calcular o score de risco e gerar alertas proativos.

**Usuários:** Usuários com `canManageUser` (gestor, admin).

---

## 2. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/templates` | Listar templates (bootstrap) |
| POST | `/templates` | Criar template |
| PATCH | `/templates/:id` | Editar template |
| DELETE | `/templates/:id` | Excluir template |

---

## 3. Elementos da página

### 3.1 Lista de protocolos

Para cada template:
- Label (nome)
- Categoria
- Descrição
- Critérios de risco
- Botões: editar, excluir

### 3.2 TemplateModal (criar/editar)

Campos:
- Label (nome do protocolo)
- Categoria (ex: hipertensão, diabetes, gestante)
- Critérios de inclusão
- Indicadores de acompanhamento
- Score de risco

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-PRO-01 | Acessar tab | `canManageUser === false` | Tab não exibido |
| RN-PRO-02 | Excluir template | Sempre | Confirmação via DeleteTemplateModal |
| RN-PRO-03 | Template em uso | Pacientes com esse template | Alerta antes de excluir |

---

## 5. Permissões

| Ação | Requer |
|---|---|
| Ver | `canManageUser` |
| Criar/editar/excluir | `canManageUser` |

---

## 6. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
