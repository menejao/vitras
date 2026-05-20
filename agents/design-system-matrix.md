# Matriz de Design System VALENS

Documento de apoio para Design System Guardian.

Objetivo:

- mapear fonte oficial do DS;
- indicar onde cada padrão deve ser buscado;
- evitar UI improvisada;
- acelerar revisão visual com base única.

## Fonte oficial

- `frontend-react/src/styles/README.md`
- `frontend-react/src/styles/index.css`
- `frontend-react/src/styles/SIGUS Design System.html`

## Camadas oficiais

### 01-tokens
- cores primitivas
- tipografia
- spacing
- radii
- elevação
- motion
- z-index

### 02-foundations
- superfícies semânticas
- texto semântico
- accent
- status
- foco

### 03-layout
- reset
- app shell
- containers

### 04-components
- button
- input
- tabs
- card
- badge
- table
- nav
- avatar
- modal
- alert
- hero

### 05-patterns
- dashboard
- form
- empty-state
- auth
- patients
- modals

### 06-themes
- light
- dark

## Mapa de consumo esperado

| Necessidade | Fonte principal |
|---|---|
| botão | `04-components/button.css` |
| campo textual | `04-components/input.css` + `05-patterns/form.css` |
| select | `04-components/input.css` + `05-patterns/form.css` |
| textarea | `04-components/input.css` + `05-patterns/form.css` |
| card / KPI | `04-components/card.css` |
| badge / chip / status | `04-components/badge.css` |
| tabela | `04-components/table.css` |
| tabs | `04-components/tabs.css` |
| modal | `04-components/modal.css` |
| alertas | `04-components/alert.css` |
| shell principal | `03-layout/app-shell.css` + `04-components/nav.css` |
| auth | `05-patterns/auth.css` |
| dashboard | `05-patterns/dashboard.css` |
| pacientes / prontuário | `05-patterns/patients.css` |
| empty state | `05-patterns/empty-state.css` |

## Regras rápidas

- se padrão existe no DS, consumir padrão;
- se componente usa HTML cru, justificar;
- se classe local replica padrão oficial, refatorar;
- se token não existe, documentar decisão antes de criar;
- nunca usar `legacy-compat.css` como fonte de inovação visual.

## Checklist visual rápido

- botão principal com cor default correta
- tabs retas
- sidebar dark institucional
- topbar light-first
- cards com borda/sombra/radius do DS
- inputs com estrutura `.field` e `.input`
- tabelas com estrutura `.table`
- modais com `.modal-backdrop`, `.modal`, `.modal__header/body/footer`

## Uso obrigatório

Antes de alterar UI:

1. localizar padrão na matriz;
2. abrir arquivo oficial correspondente;
3. comparar com HTML de referência;
4. só então alterar componente/tela.
