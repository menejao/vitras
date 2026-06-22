# Login / Autenticação — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/AuthScreen.jsx`  
**Rota:** `/login` (exibida quando não há sessão ativa)

---

## 1. Objetivo e contexto

Autenticar o usuário no VITRAS APS. Página de entrada do sistema — exibida automaticamente quando não há sessão válida. Suporta três fluxos: login, redefinição de senha e solicitação de acesso.

**Usuários:** Todos os perfis do sistema.

**Frequência de uso:** A cada início de sessão.

---

## 2. Localização

| Atributo | Valor |
|---|---|
| Rota SPA | `/login` (ou raiz sem sessão) |
| Componente principal | `AuthScreen.jsx` |
| Acessado via | Redirecionamento automático quando sem sessão ativa |
| Pré-condição | Nenhuma — página pública |

---

## 3. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| POST | `/auth/login` | Autenticação com e-mail + senha + cargo |
| POST | `/auth/password-reset/request` | Solicitar token de redefinição de senha |
| POST | `/auth/password-reset/confirm` | Confirmar nova senha com token |
| POST | `/auth/access-request` | Solicitar acesso ao sistema |

---

## 4. Elementos da página

### 4.1 Estrutura

- Logo VITRAS (BrandLockup)
- Subtítulo: "Plataforma integrada para gestão da saúde pública"
- Abas: **Entrar** / **Redefinir senha** / **Solicitar acesso**

### 4.2 Aba "Entrar" (login)

- Campo: E-mail
- Campo: Senha
- Select: Cargo / função
- Botão: "Entrar"
- Link: (na aba adjacente) Esqueci a senha

### 4.3 Aba "Redefinir senha"

**Passo 1 — solicitar:**
- Campo: E-mail institucional
- Botão: "Solicitar redefinição"

**Passo 2 — confirmar (após receber token):**
- Campo: Token de redefinição
- Campo: Nova senha
- Campo: Confirmar senha
- Botão: "Redefinir senha"

**Passo 3 — concluído:**
- Mensagem de confirmação: "Senha redefinida com sucesso. Faça login com a nova senha."

### 4.4 Aba "Solicitar acesso"

- Campo: Nome completo
- Campo: E-mail
- Select: Cargo
- Botão: "Enviar solicitação"

### 4.5 Estados especiais

- **Loading:** botão desabilitado + texto "Entrando..." / "Enviando..." / "Redefinindo..."
- **Erro:** Alert vermelho com mensagem abaixo do formulário
- **Sucesso (redefinição):** Alert verde + transição para passo 2

---

## 5. Dicionário de campos

### Login

| Campo | Nome técnico | Tipo | Obrig | Validação | Mensagem de erro |
|---|---|---|---|---|---|
| E-mail | `email` | email | S | Formato RFC 5322 | "Informe e-mail institucional." |
| Senha | `password` | password | S | Mínimo 1 char | — |
| Cargo | `role` | select | S | Um dos valores CARGO_OPTIONS | — |

**Valores do select Cargo:**

| Valor | Label |
|---|---|
| `doctor` | Médico(a) |
| `nurse_manager` | Enfermeiro(a) |
| `nursing_tech` | Técnico(a) de Enfermagem |
| `dentist` | Dentista |
| `pharmacist` | Farmacêutico(a) |
| `pharmacy_tech` | Técnico(a) de Farmácia |
| `receptionist` | Recepção / Administrativo |
| `acs` | ACS - Agente Comunitário de Saúde |
| `gestor` | Gestor(a) |
| `coordinator` | Coordenador(a) |

> `support_admin` não aparece no select — acessa apenas via URL específica ou interface própria.

### Redefinição de senha

| Campo | Nome técnico | Tipo | Obrig | Validação | Mensagem de erro |
|---|---|---|---|---|---|
| E-mail | `email` | email | S | Não vazio | "Informe e-mail institucional." |
| Token | `token` | text | S | Não vazio | "Informe token válido." |
| Nova senha | `newPassword` | password | S | ≥ 8 chars | "Senha deve ter pelo menos 8 caracteres." |
| Confirmar senha | `newPasswordConfirm` | password | S | Igual nova senha | "Senhas não coincidem." |

### Solicitação de acesso

| Campo | Nome técnico | Tipo | Obrig | Validação | Mensagem de erro |
|---|---|---|---|---|---|
| Nome | `name` | text | S | Não vazio | "Nome, e-mail e cargo são obrigatórios." |
| E-mail | `email` | email | S | Não vazio | "Nome, e-mail e cargo são obrigatórios." |
| Cargo | `jobTitle` | select | S | Não vazio | "Nome, e-mail e cargo são obrigatórios." |

---

## 6. Regras de negócio

| Código | Gatilho | Condição | Ação do sistema | Mensagem exibida |
|---|---|---|---|---|
| RN-LOGIN-01 | Clicar "Entrar" | Credenciais corretas + `forcePasswordChange: true` | Redireciona para `ChangePasswordRequiredPage` | — |
| RN-LOGIN-02 | Clicar "Entrar" | Credenciais corretas + `forcePasswordChange: false` | Carrega aplicação conforme perfil | — |
| RN-LOGIN-03 | Clicar "Entrar" | Credenciais inválidas | Mantém na tela de login | Mensagem retornada pela API |
| RN-LOGIN-04 | Clicar "Entrar" | `support_admin` seleciona qualquer cargo clínico | Bloqueado — API retorna erro | Mensagem de credencial inválida |
| RN-LOGIN-05 | Passo 1 redefinição | E-mail não cadastrado | API retorna resposta genérica (sem enumerar usuários) | "Verifique seu e-mail para continuar." |
| RN-LOGIN-06 | Passo 2 redefinição | Senhas não coincidem | Bloqueio client-side antes de chamar API | "As senhas não coincidem." |
| RN-LOGIN-07 | Passo 2 redefinição | Nova senha < 8 chars | Bloqueio client-side | "Senha deve ter pelo menos 8 caracteres." |

---

## 7. Ações e comportamentos

| Ação | Gatilho | API | Resultado sucesso | Resultado erro |
|---|---|---|---|---|
| Login | "Entrar" | `POST /auth/login` | Sessão criada → App carregada ou `forcePasswordChange` | Alert vermelho |
| Solicitar redefinição | "Solicitar redefinição" | `POST /auth/password-reset/request` | Step 2 ativado + token (dev: retornado na resposta) | Alert vermelho |
| Confirmar redefinição | "Redefinir senha" | `POST /auth/password-reset/confirm` | Tela de conclusão | Alert vermelho |
| Solicitar acesso | "Enviar solicitação" | `POST /auth/access-request` | Tela de confirmação | Alert vermelho |

---

## 8. Navegação entre páginas

| Elemento | Condição | Destino |
|---|---|---|
| Login com `forcePasswordChange: true` | Sempre | `ChangePasswordRequiredPage` |
| Login com `forcePasswordChange: false` + role clínico | Sempre | `Dashboard` (ou página de entrada do perfil) |
| Login com `forcePasswordChange: false` + `support_admin` | Sempre | `PlatformConsolePage` |

---

## 9. Permissões

Página pública — sem autenticação necessária para acesso.

Após login, `support_admin` é bloqueado de todas as rotas clínicas (via `blockSupportAdminFromClinical` middleware).

---

## 10. Auditoria

| Ação | Evento | Dados registrados |
|---|---|---|
| Login bem-sucedido | `AUTH_LOGIN_SUCCESS` | userId, role, timestamp |
| Login falho | `AUTH_LOGIN_FAILURE` | email, role tentado, timestamp |
| Redefinição de senha | `AUTH_PASSWORD_RESET_CONFIRMED` | userId, timestamp |

---

## 11. Critérios de aceite

- [ ] Login com credenciais válidas redireciona para o contexto correto por perfil
- [ ] Login com `forcePasswordChange: true` redireciona para `ChangePasswordRequiredPage` antes de qualquer outra tela
- [ ] Credenciais inválidas exibem mensagem de erro sem revelar qual campo falhou
- [ ] Select de cargo exibe todos os perfis clínicos (não exibe `support_admin`)
- [ ] Botão "Entrar" fica desabilitado durante a requisição
- [ ] Redefinição: senhas diferentes são bloqueadas antes de chamar API
- [ ] Redefinição: senha < 8 chars bloqueada antes de chamar API
- [ ] Solicitação de acesso: campos obrigatórios validados antes de chamar API

---

## 12. Cenários de teste

| # | Cenário | Perfil | Entrada | Esperado |
|---|---|---|---|---|
| 01 | Login válido ACS | `acs` | Email/senha corretos | Dashboard ACS carregado |
| 02 | Login válido gestor | `gestor` | Email/senha corretos | Dashboard gestor carregado |
| 03 | Login support_admin | `support_admin` | Email/senha corretos | Console Nacional carregado |
| 04 | Login com `forcePasswordChange` | qualquer | Email/senha corretos, `forcePasswordChange: true` | Redirecionado para troca obrigatória |
| 05 | Credencial inválida | qualquer | Senha errada | Alert de erro, sem acesso |
| 06 | Senhas redefinição divergem | — | Nova ≠ Confirmar | Erro client-side, sem API call |
| 07 | Nova senha curta | — | 7 chars | Erro client-side, sem API call |
| 08 | Solicitação sem cargo | — | Nome + email, sem cargo | Erro de validação |

---

## 13. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
