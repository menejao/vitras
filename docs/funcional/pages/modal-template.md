# Modal de Template / Protocolo — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/components/modals/TemplateModal.jsx`  
**Acionado por:** `AppModals` → `showTemplateModal`

---

## 1. Objetivo e contexto

Modal de criação e edição de templates de protocolo clínico. Templates definem categorias de acompanhamento de pacientes e são usados por `evaluateGroup()` para calcular scores de risco e gerar alertas proativos no Dashboard.

**Usuários:** `canManageUser` (gestor, admin).

---

## 2. Acionadores

| Ação | Local |
|---|---|
| Criar template | ProtocolsTab |
| Editar template | ProtocolsTab |

---

## 3. Campos do formulário

| Campo | Nome técnico | Tipo | Obrig |
|---|---|---|---|
| Nome / Label | `label` | text | S |
| Categoria | `category` | text/select | S |
| Descrição | `description` | textarea | N |
| Critérios de inclusão | `criteria` | textarea / lista | N |

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-MTL-01 | Salvar | Label vazio | Bloqueado |
| RN-MTL-02 | Excluir template | Via ProtocolsTab | DeleteTemplateModal de confirmação primeiro |

---

## 5. Auditoria

Não há evento de auditoria específico para templates (operação administrativa).

---

## 6. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
