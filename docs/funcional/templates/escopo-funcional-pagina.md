# [NOME DA PÁGINA] — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** YYYY-MM-DD  
**Arquivo React:** `frontend-react/src/pages/[NomeDaPagina].jsx`  
**Rota:** `/[rota]`

---

## 1. Objetivo e contexto

> [Descreva em 2–4 frases o que essa página faz, por que existe, e qual problema operacional resolve.]

**Usuários:** [Perfis que acessam esta página — ex: `acs`, `gestor`, `support_admin`]

**Frequência de uso:** [Diária / Semanal / Por evento — ex: "Uma vez por implantação de UBS"]

---

## 2. Localização

| Atributo | Valor |
|---|---|
| Rota SPA | `/[rota]` |
| Componente principal | `[NomeDaPagina].jsx` |
| Acessado via | [Menu lateral / Botão em outra página / Redirecionamento automático] |
| Pré-condição | [O que deve existir para o usuário chegar aqui] |

---

## 3. Dependências técnicas e funcionais

**APIs consumidas:**

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/[endpoint]` | [Para que serve] |
| POST | `/[endpoint]` | [Para que serve] |

**Dependências funcionais:**

- [O que precisa estar configurado antes de usar esta página]
- Ex: "UBS deve existir antes de abrir detalhe"

---

## 4. Elementos da página

> Liste todos os elementos visuais presentes.

### 4.1 Cabeçalho / Header

- [Logo / título / subtítulo]
- [Botões de ação global]

### 4.2 Seção principal

- [Formulário / Tabela / Cards / Lista]
- [Campos, colunas, itens]

### 4.3 Seções secundárias

- [Nome da seção: o que contém]

### 4.4 Modais / Drawers

- [Nome do modal: quando aparece, o que contém]

### 4.5 Estados especiais

- [Loading: o que é exibido]
- [Vazio: mensagem exibida]
- [Erro: mensagem e ação disponível]

---

## 5. Dicionário de campos

> Para cada campo input, filtro ou dado exibido.

| Campo | Nome técnico | Tipo | Origem | Obrig | Padrão | Máscara | Validação | LGPD | CDS | Mensagem de erro |
|---|---|---|---|---|---|---|---|---|---|---|
| [Nome exibido] | `[nomeTecnico]` | [text/number/select/date/checkbox] | [API/Estado local] | [S/N] | [valor ou —] | [máscara ou —] | [regra] | [PD/SC/—] | [S/N] | "[mensagem]" |

---

## 6. Regras de negócio

> Código: RN-[PÁGINA]-[NÚMERO]

| Código | Gatilho | Condição | Ação do sistema | Mensagem exibida |
|---|---|---|---|---|
| RN-[PG]-01 | [Evento — ex: "Clicar em Salvar"] | [Condição — ex: "Campo nome vazio"] | [O que o sistema faz] | "[Mensagem ao usuário]" |
| RN-[PG]-02 | | | | |

---

## 7. Ações e comportamentos

> Para cada botão, link ou ação interativa.

| Ação | Gatilho | API chamada | Resultado sucesso | Resultado erro |
|---|---|---|---|---|
| [Nome da ação] | [Clicar em "Botão X"] | `[METHOD /endpoint]` | [O que acontece] | [Mensagem de erro] |

---

## 8. Navegação entre páginas

| Elemento clicado | Condição | Destino | Parâmetros enviados |
|---|---|---|---|
| [Elemento] | [Sempre / Se X] | [Página destino — ou nome do arquivo .md] | [params / —] |

---

## 9. Permissões de acesso

| Capability necessária | Perfis | Comportamento se não tiver |
|---|---|---|
| `[capability.name]` | [perfis] | [Redirecionamento / Botão oculto / Erro 403] |

**Acesso bloqueado para:** [perfis que não devem ver esta página]

---

## 10. Auditoria

| Ação | Evento registrado | Dados no log |
|---|---|---|
| [Ação] | `[DOMAIN_ENTITY_ACTION]` | [campos registrados] |

---

## 11. Critérios de aceite

- [ ] [Critério objetivo e verificável — ex: "Campo CNES aceita apenas 7 dígitos numéricos"]
- [ ] [Critério — ex: "Usuário sem `support_admin` não acessa a página"]
- [ ] [Critério — ex: "Botão 'Salvar' fica desabilitado com campos obrigatórios vazios"]

---

## 12. Cenários de teste

| # | Cenário | Perfil | Entrada | Resultado esperado |
|---|---|---|---|---|
| 01 | [Nome do cenário] | [perfil] | [dados de entrada] | [resultado] |
| 02 | [Cenário de erro] | [perfil] | [dados inválidos] | [mensagem de erro] |
| 03 | [Cenário de bloqueio] | [perfil sem permissão] | — | [comportamento de bloqueio] |

---

## 13. Histórico de alterações

| Versão | Data | Autor | Descrição |
|---|---|---|---|
| 1.0 | [YYYY-MM-DD] | [Quem documentou] | Documentação inicial |
