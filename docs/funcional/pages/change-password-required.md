# Troca Obrigatória de Senha — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/ChangePasswordRequiredPage.jsx`  
**Rota:** Sem rota dedicada — renderizada como gate em `App.jsx` quando `forcePasswordChange: true`

---

## 1. Objetivo e contexto

Forçar troca de senha no primeiro acesso do usuário. Usuários criados pelo gestor recebem senha temporária. Antes de acessar qualquer funcionalidade do sistema, devem definir senha definitiva. Nenhuma navegação é permitida antes de concluir.

**Usuários:** Todos os perfis. Tipicamente gestores no primeiro acesso após criação por `support_admin`.

**Frequência de uso:** Uma vez por conta criada com senha temporária.

---

## 2. Localização

| Atributo | Valor |
|---|---|
| Rota SPA | N/A — componente gate renderizado sobre toda a aplicação |
| Componente principal | `ChangePasswordRequiredPage.jsx` |
| Acessado via | Redirecionamento automático pós-login quando `user.forcePasswordChange === true` |
| Pré-condição | Usuário autenticado com flag `forcePasswordChange: true` |

**Lógica em `App.jsx`:**
```
if (user && user.forcePasswordChange) → renderiza <ChangePasswordRequiredPage>
else → renderiza aplicação normal
```

---

## 3. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| POST | `/auth/change-password-required` | Troca senha temporária por definitiva |

**Nota de implementação:** usa `api()` helper (não `fetch` direto) para suportar tanto Bearer token quanto cookie-session sentinel `"__cookie_session__"` com X-CSRF-Token automático.

---

## 4. Elementos da página

### 4.1 Estrutura

- Logo VITRAS (BrandLockup, tamanho `md`)
- Título: "Troca de Senha Obrigatória"
- Subtítulo: "Este é seu primeiro acesso. Defina uma senha definitiva para continuar."

### 4.2 Formulário

- Campo: Senha temporária (atual)
- Campo: Nova senha
- Hint: "Mínimo 8 caracteres, 1 maiúscula, 1 número, 1 símbolo."
- Campo: Confirmar nova senha
- Botão: "Definir nova senha"

### 4.3 Link de saída

- Botão texto: "Sair do sistema" — chama `onLogout`

### 4.4 Estados especiais

- **Loading:** botão desabilitado + texto "Alterando..."
- **Erro:** Alert vermelho acima do formulário
- **Sucesso:** callback `onSuccess(data)` — App.jsx atualiza estado de sessão e redireciona

---

## 5. Dicionário de campos

| Campo | Nome técnico | Tipo | Obrig | Validação | LGPD | Mensagem de erro |
|---|---|---|---|---|---|---|
| Senha temporária | `currentPassword` | password | S | Não vazio | — | (via API) |
| Nova senha | `newPassword` | password | S | ≥ 8 chars, client-side | — | "As senhas não coincidem." (se diferir do confirm) |
| Confirmar senha | `newPasswordConfirm` | password | S | Igual a `newPassword` | — | "As senhas não coincidem." |

**Validação client-side antes de chamar API:**
```javascript
if (newPassword !== newPasswordConfirm) throw new Error("As senhas não coincidem.")
```

---

## 6. Regras de negócio

| Código | Gatilho | Condição | Ação do sistema | Mensagem exibida |
|---|---|---|---|---|
| RN-CPR-01 | Montar App.jsx | `user.forcePasswordChange === true` | Bloqueia toda a aplicação — renderiza somente esta página | — |
| RN-CPR-02 | Submeter formulário | `newPassword !== newPasswordConfirm` | Bloqueio client-side, sem API call | "As senhas não coincidem." |
| RN-CPR-03 | Submeter formulário | Campos válidos | Chama `POST /auth/change-password-required` | — |
| RN-CPR-04 | API retorna sucesso | — | `onSuccess(data)` → App atualiza sessão, `forcePasswordChange` vira `false` | — |
| RN-CPR-05 | Clicar "Sair" | Qualquer estado | `onLogout()` → sessão encerrada, redireciona para Login | — |

---

## 7. Ações e comportamentos

| Ação | Gatilho | API | Resultado sucesso | Resultado erro |
|---|---|---|---|---|
| Trocar senha | "Definir nova senha" | `POST /auth/change-password-required` | `onSuccess(data)` — sessão atualizada | Alert vermelho com mensagem da API |
| Sair | "Sair do sistema" | — (local) | Sessão encerrada → Login | — |

---

## 8. Navegação entre páginas

| Elemento | Condição | Destino |
|---|---|---|
| Troca bem-sucedida | `onSuccess()` retorna | App normal para o perfil do usuário |
| "Sair do sistema" | Sempre | Login |

---

## 9. Permissões

Acessível a qualquer usuário autenticado com `forcePasswordChange: true`.

Não requer capability específica — gate aplicado antes do carregamento de qualquer rota.

---

## 10. Auditoria

| Ação | Evento | Dados registrados |
|---|---|---|
| Troca de senha concluída | `AUTH_PASSWORD_CHANGED_REQUIRED` | userId, timestamp |

**Crítico:** senha temporária nunca registrada em log de auditoria (nem a nova).

---

## 11. Critérios de aceite

- [ ] Usuário com `forcePasswordChange: true` não consegue acessar nenhuma outra tela antes de trocar senha
- [ ] Senhas divergentes bloqueadas client-side antes de chamar API
- [ ] Botão desabilitado durante requisição
- [ ] Sucesso redireciona para contexto normal do perfil
- [ ] "Sair" encerra sessão corretamente
- [ ] Senha temporária nunca aparece em log, console ou resposta de API

---

## 12. Cenários de teste

| # | Cenário | Perfil | Entrada | Esperado |
|---|---|---|---|---|
| 01 | Primeiro acesso gestor | `gestor` | `forcePasswordChange: true` | Tela de troca exibida antes de qualquer outra |
| 02 | Senhas divergem | qualquer | `newPassword ≠ newPasswordConfirm` | Erro client-side, sem API call |
| 03 | Troca válida | qualquer | Senha atual correta + nova senha forte | Redirecionado para aplicação |
| 04 | Senha atual errada | qualquer | Senha temporária incorreta | Alert vermelho da API |
| 05 | Sair sem trocar | qualquer | Clicar "Sair" | Sessão encerrada, volta para Login |
| 06 | Acesso direto por URL | qualquer com `forcePasswordChange: true` | Tentar `/dashboard` | Redirecionado para troca obrigatória |

---

## 13. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
