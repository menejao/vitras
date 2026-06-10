# Vitras Design System · `styles/`

Implementação CSS oficial do Vitras Design System. **Light-first**, com dark mode derivado. Arquitetura em camadas inspirada em ITCSS.

Drop-in para `frontend-react/src/styles/`.

---

## Estrutura

```
styles/
├── index.css                  ← entrada única · importa tudo na ordem
├── README.md                  ← este arquivo
│
├── 01-tokens/                 PRIMITIVOS · valores brutos, sem semântica
│   ├── colors.css                escalas de cor (teal, slate, semantic)
│   ├── typography.css            fontes, escala tipográfica, line-heights
│   ├── spacing.css               escala 4pt (--s-1 ... --s-24)
│   ├── radii.css                 raios (--r-xs ... --r-pill)
│   ├── elevation.css             shadows + focus-ring
│   ├── motion.css                easing + durations
│   ├── z-index.css               z-index scale
│   └── index.css
│
├── 02-foundations/            SEMÂNTICOS · compõem tokens em significado
│   ├── surface.css               --bg, --surface, --surface-2, --border…
│   ├── text.css                  --text, --text-muted, --text-dim…
│   ├── accent.css                --accent, --accent-soft, --accent-grad
│   ├── status.css                --success, --warning, --danger, --info
│   ├── focus.css                 --focus-ring + .focus-visible base
│   └── index.css
│
├── 03-layout/                 GLOBAL · reset + estruturas de página
│   ├── reset.css                 box-sizing, scrollbars, body
│   ├── app-shell.css             .app, .app-body, .topbar, .main-area
│   ├── containers.css            .page, .container, grids
│   └── index.css
│
├── 04-components/             COMPONENTES · UI atômica
│   ├── button.css                .btn + modifiers
│   ├── input.css                 .input, .field, .field__label
│   ├── tabs.css                  .tabs, .tab (sempre retas)
│   ├── card.css                  .card + .kpi
│   ├── badge.css                 .badge + .dot
│   ├── table.css                 .table
│   ├── nav.css                   .nav, .sidebar (dark)
│   ├── avatar.css                .avatar
│   ├── modal.css                 .modal, .modal-backdrop
│   ├── alert.css                 .alert
│   ├── hero.css                  .hero + .hero--compact + .hero--light
│   └── index.css
│
├── 05-patterns/               COMPOSTOS · layouts montados
│   ├── dashboard.css             sidebar+topbar+main grid
│   ├── form.css                  layouts de form, field-grid
│   ├── empty-state.css           .empty
│   ├── auth.css                  .auth-screen, .auth-left, .auth-right
│   └── index.css
│
└── 06-themes/                 TEMAS · overrides de tokens semânticos
    ├── light.css                 default (já em :root)
    ├── dark.css                  [data-theme="dark"]
    └── index.css
```

## Como usar

No `main.jsx` ou no entrypoint:

```js
import './styles/index.css';
```

E pronto. Tudo carrega na ordem certa.

Para alternar tema:

```js
document.documentElement.dataset.theme = 'dark';  // ativa dark
document.documentElement.dataset.theme = '';      // volta para light (default)
```

---

## Convenções de nomenclatura

### Tokens (CSS variables)

```
--{categoria}-{nome}            primitivos: --teal-500, --slate-900
--{categoria}                   semânticos: --accent, --text, --surface
--{categoria}-{variant}         semânticos qualificados: --text-muted, --surface-2
--{categoria}-{state}           estados: --accent-hover, --accent-soft
```

| Categoria | Prefixo | Exemplo |
|-----------|---------|---------|
| Cores raw | escala | `--teal-500`, `--slate-900` |
| Superfícies | `--bg`, `--surface`, `--surface-N` | `--surface-2` |
| Texto | `--text`, `--text-*` | `--text-muted` |
| Bordas | `--border`, `--border-*` | `--border-strong` |
| Accent | `--accent`, `--accent-*` | `--accent-soft` |
| Status | `--success`, `--warning`, `--danger`, `--info` | `--success-soft` |
| Tipografia | `--t-*`, `--lh-*`, `--ls-*`, `--font-*` | `--t-md`, `--font-sans` |
| Espaçamento | `--s-N` (escala 4pt) | `--s-4` = 16px |
| Raios | `--r-{xs\|sm\|md\|lg\|xl\|2xl\|pill}` | `--r-md` = 8px |
| Sombra | `--shadow-{xs\|sm\|md\|lg}` + `--shadow-glow` | `--shadow-md` |
| Motion | `--ease*`, `--d-*` | `--ease`, `--d-fast` |
| Z-index | `--z-*` | `--z-modal` |

### Classes (BEM-light)

```
.block                          base do componente: .btn, .card, .tab
.block__element                 parte do bloco:     .card__header, .field__label
.block--modifier                variação visual:    .btn--primary, .hero--compact
.is-state                       estado dinâmico:    .is-active, .is-selected
```

| Tipo | Prefixo | Exemplo |
|------|---------|---------|
| Componente | sem prefixo | `.btn`, `.input`, `.card` |
| Elemento interno | `__` | `.card__header`, `.kpi__value` |
| Modificador visual | `--` | `.btn--primary`, `.btn--sm` |
| Estado dinâmico (JS) | `is-` | `.is-active`, `.is-disabled` |
| Helper / utility | `.{nome}` minúsculo | `.muted`, `.mono`, `.eyebrow` |

**Não usar prefixos externos** — o sistema é o único; namespacing pesado polui markup. Conflitos com libs externas raros e tratáveis caso a caso.

---

## Tema dual

```
:root                       light (default · identidade principal)
[data-theme="dark"]         dark   (opcional · derivado)
```

Componentes em `04-components/` **não devem hardcodar valores** — sempre via variáveis. Assim dark mode "simplesmente funciona" via override de tokens em `06-themes/dark.css`.

Para overrides específicos por tema em componentes que precisam (ex: card ganha glass no dark), usar seletor encadeado:

```css
.card { box-shadow: var(--shadow-xs); }
[data-theme="dark"] .card { box-shadow: none; backdrop-filter: blur(14px); }
```

---

## Tokens-chave para lembrar

| Pergunta | Token |
|----------|-------|
| Fundo geral | `var(--bg)` |
| Card | `var(--surface)` |
| Linha alternada / hover | `var(--surface-hover)` |
| Texto principal | `var(--text)` |
| Texto secundário (labels) | `var(--text-muted)` |
| Texto auxiliar (placeholders) | `var(--text-dim)` |
| Borda padrão | `var(--border)` |
| Cor da marca / ações | `var(--accent)` |
| Texto sobre accent | `var(--text-on-accent)` |
| Anel de foco | `var(--focus-ring)` |
| Botão padrão · altura | `32px` |
| Input padrão · altura | `34px` |
| Card padding | `var(--s-5)` (20px) |
| Raio padrão (card) | `var(--r-lg)` (12px) |
| Raio button/input | `var(--r-md)` (8px) |
| Sombra padrão | `var(--shadow-xs)` |

---

## Atualizações

- **v1.0** — sistema inicial light-first, derivado da arquitetura existente em `frontend-react/src/styles.css`. Mantém IBM Plex Sans + IBM Plex Mono, Signal Cyan #5DD5E8, slate-900 navy. Padroniza tabs (sempre retas), hover states, hero, KPI cards, sidebar dark.
- **v1.1** — rebranding para Vitras Design System. Inter substituído por IBM Plex Sans (300/400/500/600). Cor de marca teal substituída por Signal Cyan (#5DD5E8). Símbolo Facet substitui cruz inline.
