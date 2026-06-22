# Console Nacional — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/PlatformConsolePage.jsx`  
**Rota:** `/platform` (renderizada pela condição `role === "support_admin"` em `App.jsx`)

---

## 1. Objetivo e contexto

Central de operação nacional do VITRAS APS para o perfil `support_admin`. Permite visualizar o panorama de todas as UBS do país, criar novas unidades, e navegar para o detalhe individual de cada unidade. É a página inicial exclusiva do `support_admin` — nenhuma rota clínica é acessível a partir dela.

**Usuários:** `support_admin` exclusivamente.

**Frequência de uso:** Diária — durante implantação ativa; pontual — após estabilização.

---

## 2. Localização

| Atributo | Valor |
|---|---|
| Rota SPA | `/platform` |
| Componente principal | `PlatformConsolePage.jsx` |
| Acessado via | Redirecionamento automático pós-login para `support_admin` |
| Pré-condição | Sessão ativa com `role === "support_admin"` |

---

## 3. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/platform/summary` | Indicadores nacionais (totais por status) |
| GET | `/platform/units` | Lista paginada de UBS com filtros e ordenação |
| POST | `/platform/units` | Criar nova UBS |

---

## 4. Elementos da página

### 4.1 Header

- Logo VITRAS (BrandLockup)
- Botão: "Sair" — encerra sessão

### 4.2 Resumo Nacional (NationalSummary)

Painel de 5 cards com métricas nacionais em tempo real:

| Card | Dado | Fonte |
|---|---|---|
| Total de UBS | `data.totalUnits` | `GET /platform/summary` |
| Em implantação | `data.onboarding` | `GET /platform/summary` |
| Operacionais | `data.active` | `GET /platform/summary` |
| Gestores | `data.totalGestors` | `GET /platform/summary` |
| Usuários ativos | `data.totalUsers` | `GET /platform/summary` |

### 4.3 Toolbar

- Título: "Unidades de Saúde"
- Botão: "+ Nova UBS" → abre formulário de criação (substitui lista na mesma tela)

### 4.4 Filtros

- Campo de busca texto (debounce 300ms): busca por nome, CNES, município ou gestor
- Select: UF (27 estados + DF)
- Select: Status (5 estados do ciclo de vida)

### 4.5 Tabela de UBS

Colunas:

| Coluna | Campo | Ordenável | Formato |
|---|---|---|---|
| Nome da UBS | `name` | Sim | bold |
| CNES | `cnes` | Sim | monospace |
| Município/UF | `municipalityName` + `uf` | Sim (municipalityName) | "Recife SP" |
| Status | `status` | Sim | StatusBadge colorido |
| Gestores | `gestorCount` | Não | número |
| Usuários | `userCount` | Não | número |
| Equipes | `teamCount` | Não | número |
| Criado em | `createdAt` | Sim | dd/mm/aaaa |

Clicar em linha → navega para Detalhe da UBS.

Cabeçalho clicável por coluna ordenável — alterna asc/desc.

### 4.6 Paginação

- 25 UBS por página (PAGE_SIZE = 25)
- Controles: "← Anterior" / "Próxima →"
- Contador: "{total} UBS no total — página {page} de {pages}"

### 4.7 Estados especiais

- **Loading lista:** mensagem "Carregando..." na tabela (linha única)
- **Lista vazia sem filtro:** "Nenhuma UBS cadastrada. Clique em \"+ Nova UBS\" para começar."
- **Lista vazia com filtro:** "Nenhuma UBS encontrada para os filtros aplicados."
- **Loading summary:** "Carregando indicadores..."
- **Erro summary:** summary silenciado (`null` → nada renderizado)

### 4.8 StatusBadge — cores por status

| Status | Fundo | Texto | Label exibido |
|---|---|---|---|
| `draft` | #f3f4f6 (cinza) | #374151 | Rascunho |
| `onboarding` | #fef3c7 (amarelo) | #92400e | Em implantação |
| `homologation` | #dbeafe (azul) | #1d4ed8 | Homologação |
| `active` | #d1fae5 (verde) | #065f46 | Operacional |
| `suspended` | #fee2e2 (vermelho) | #991b1b | Suspensa |

---

## 5. Dicionário de campos

### Filtros da lista

| Campo | Nome técnico | Tipo | Padrão | Comportamento |
|---|---|---|---|---|
| Busca | `search` | text | "" | Debounce 300ms — busca nome, CNES, município, gestor |
| UF | `filterUf` | select | "" (todos) | Filtra imediatamente ao alterar |
| Status | `filterStatus` | select | "" (todos) | Filtra imediatamente ao alterar |

### Colunas exibidas por UBS

| Campo exibido | Campo técnico | Tipo | Origem |
|---|---|---|---|
| Nome da UBS | `name` | string | `GET /platform/units` |
| CNES | `cnes` | string (7 dígitos) | `GET /platform/units` |
| Município | `municipalityName` | string | `GET /platform/units` |
| UF | `uf` | enum (27 UFs) | `GET /platform/units` |
| Status | `status` | enum (5 valores) | `GET /platform/units` |
| Gestores | `gestorCount` | number | calculado pela API |
| Usuários | `userCount` | number | calculado pela API |
| Equipes | `teamCount` | number | calculado pela API |
| Criado em | `createdAt` | ISO date | `GET /platform/units` |

---

## 6. Regras de negócio

| Código | Gatilho | Condição | Ação | Mensagem |
|---|---|---|---|---|
| RN-CON-01 | Acessar `/platform` | Usuário sem `support_admin` | Bloqueado por middleware `blockSupportAdminFromClinical` (backend) + gate em App.jsx | Redirecionado para Login |
| RN-CON-02 | Digitar busca | A cada keystroke com debounce | Aguarda 300ms sem digitação → dispara `GET /platform/units?search=` | — |
| RN-CON-03 | Alterar UF ou Status | Sempre | Dispara `GET /platform/units` imediatamente | — |
| RN-CON-04 | Clicar coluna ordenável | Mesma coluna: inverte direção; coluna diferente: asc | Dispara `GET /platform/units?sortBy=&sortDir=` | — |
| RN-CON-05 | Navegar página | Clicar "Anterior" ou "Próxima" | `load(page ± 1)` — mantém filtros e ordenação | — |
| RN-CON-06 | Clicar linha de UBS | Sempre | Exibe `UnitDetail` no lugar da lista | — |
| RN-CON-07 | Clicar "+ Nova UBS" | Sempre | Exibe `UnitForm` no lugar da lista | — |
| RN-CON-08 | UBS criada com sucesso | — | Volta para lista + recarrega | — |

---

## 7. Ações e comportamentos

| Ação | Gatilho | API | Resultado sucesso | Resultado erro |
|---|---|---|---|---|
| Carregar indicadores | Montar componente | `GET /platform/summary` | Cards exibidos | Cards ocultados silenciosamente |
| Carregar lista | Montar / filtrar / paginar | `GET /platform/units` | Tabela preenchida | Alert vermelho inline |
| Abrir detalhe | Clicar linha | — (local) | `UnitDetail` renderizado | — |
| Abrir formulário | "+ Nova UBS" | — (local) | `UnitForm` renderizado | — |
| Criar UBS | Submeter `UnitForm` | `POST /platform/units` | Lista recarregada | Alert no formulário |

---

## 8. Navegação entre páginas

| Elemento | Condição | Destino | Parâmetros |
|---|---|---|---|
| Clicar linha UBS | Sempre | [Detalhe da UBS](detalhe-ubs.md) | `unitId` (via state — não URL) |
| "+ Nova UBS" | Sempre | [Formulário de criação](detalhe-ubs.md#formulario-criacao) | — |
| "← Voltar" no detalhe | Sempre | Console Nacional (lista) | — |
| "Sair" | Sempre | Login | — |

---

## 9. Permissões

| Capability | Perfis | Se não tiver |
|---|---|---|
| `support_admin` (role verificado em App.jsx) | `support_admin` | Redirecionado para Login |

**Bloqueado para:** todos os perfis clínicos (`acs`, `gestor`, `doctor`, `nurse_manager`, etc.)

---

## 10. Auditoria

| Ação | Evento | Dados |
|---|---|---|
| Criação de UBS | `UNIT_CREATED` | unitId, name, cnes, createdBy, timestamp |
| Visualização de lista | — (não auditado) | — |

---

## 11. Critérios de aceite

- [ ] `support_admin` vê Console Nacional após login
- [ ] Perfil clínico não acessa `/platform` (redirecionado)
- [ ] Cards de resumo nacional exibem contadores corretos
- [ ] Busca retorna resultado após 300ms de inatividade
- [ ] Filtro UF e Status filtram imediatamente
- [ ] Paginação mantém filtros e ordenação ativos
- [ ] Colunas ordenáveis alternam asc/desc ao clicar
- [ ] Clicar linha abre detalhe da UBS correta
- [ ] "← Voltar" retorna para lista com filtros intactos
- [ ] "+ Nova UBS" abre formulário

---

## 12. Cenários de teste

| # | Cenário | Perfil | Entrada | Esperado |
|---|---|---|---|---|
| 01 | Acesso support_admin | `support_admin` | Login válido | Console Nacional exibido |
| 02 | Acesso clínico bloqueado | `gestor` | Tentar URL `/platform` | Redirecionado |
| 03 | Busca por nome | `support_admin` | Digitar nome de UBS | Lista filtrada após 300ms |
| 04 | Busca por CNES | `support_admin` | Digitar 7 dígitos | UBS correspondente exibida |
| 05 | Filtro por UF | `support_admin` | Selecionar "PE" | Somente UBS do PE |
| 06 | Filtro por status | `support_admin` | Selecionar "Operacional" | Somente UBS ativas |
| 07 | Ordenar por nome | `support_admin` | Clicar coluna "Nome da UBS" | Lista ordenada A-Z |
| 08 | Lista vazia | `support_admin` | Busca sem resultado | Mensagem de lista vazia |
| 09 | Criar UBS | `support_admin` | "+ Nova UBS" + campos válidos | UBS criada, lista recarregada |
| 10 | Abrir detalhe | `support_admin` | Clicar linha | Detalhe da UBS exibido |

---

## 13. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
