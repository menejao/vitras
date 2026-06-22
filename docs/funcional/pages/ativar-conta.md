# Ativar Conta (Deprecated) — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/ActivateAccountPage.jsx`  
**Rotas:** `/activate`, `/primeiro-acesso`

---

## 1. Objetivo e contexto

**DEPRECIADO desde IAM-01A.** Esta página existia para ativar conta via token de e-mail no primeiro acesso. Foi substituída pelo fluxo `forcePasswordChange` implementado em `ChangePasswordRequiredPage`.

**Status:** Rotas mantidas por compatibilidade, mas a página redireciona para Login (`/`) ou exibe aviso de que o acesso deve ser feito via Login normal.

**Usuários:** Nenhum — fluxo migrado.

---

## 2. Substituição

| Fluxo antigo | Fluxo atual |
|---|---|
| `/activate?token=X` → ActivateAccountPage | Login → `forcePasswordChange: true` → ChangePasswordRequiredPage |

---

## 3. Regra de negócio

| Código | Gatilho | Ação |
|---|---|---|
| RN-ACT-01 | Acessar `/activate` ou `/primeiro-acesso` | Exibe ActivateAccountPage (desabilitada) |
| RN-ACT-02 | Renderizar | Redireciona para Login ou exibe aviso de rota deprecada |

---

## 4. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial — marcado como DEPRECATED |
