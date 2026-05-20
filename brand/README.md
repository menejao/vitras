# SIGUS · Brand Asset Package

Pacote oficial da marca SIGUS · v1.0 · 14 mai 2026

Drop-in para uso em produção (web, app, materiais institucionais).

---

## Estrutura

```
SIGUS/brand/
├── monogram/                  Variantes vetoriais do monograma S
│   ├── sigus-mono-primary.svg     gradiente teal · uso padrão
│   ├── sigus-mono-navy.svg        S branco sobre navy institucional
│   ├── sigus-mono-light.svg       S navy sobre branco com borda
│   ├── sigus-mono-ink.svg         S branco sobre preto · 1 cor
│   ├── sigus-mono-knockout.svg    S knockout (transparente) sobre teal
│   ├── sigus-mono-outline.svg     S em outline · uso restrito
│   ├── sigus-mono-mono-light.svg  S branco sobre transparente
│   └── sigus-mono-mono-dark.svg   S navy sobre transparente
│
├── logos/                     Versões canônicas (atalhos para os SVGs principais)
│
├── exports/png/               Renderizações PNG
│   ├── sigus-mono-primary-{16,32,48,64,128,256,512,1024}.png
│   └── sigus-mono-{variante}-{128,512}.png
│
├── favicon/                   Para o navegador
│   ├── favicon.svg                principal · escala perfeita
│   ├── favicon-{16,32,48,64}.png  fallback PNG
│   └── apple-touch-icon.png       180×180 · iOS home screen
│
├── app-icons/                 PWA · home screen mobile
│   ├── icon-{192,512}.png            regular
│   └── icon-maskable-{192,512}.png   safe area · Android adaptive
│
├── social/                    Compartilhamento e perfis
│   ├── avatar-square.png      400×400 · avatar de redes
│   ├── og-image.png           1200×630 · OpenGraph (LinkedIn, FB, Slack)
│   └── twitter-card.png       1200×600 · Twitter/X summary_large_image
│
└── README.md                  este arquivo
```

---

## Quando usar cada variante

| Variante       | Quando usar |
|----------------|-------------|
| `primary`      | Padrão. Cabeçalhos, marketing, produtos digitais. |
| `navy`         | Sobre superfícies institucionais escuras (hero, sidebar). |
| `light`        | Sobre superfícies muito claras quando o gradiente não for desejado. |
| `ink`          | Impressão preto-e-branco · 1 cor (carimbos, fax, jornal). |
| `knockout`     | Sobre fotografia ou textura visual complexa. |
| `outline`      | Uso restrito · watermarks, marca-d'água, papel timbrado. |
| `mono-light`   | Apenas o S branco — sobre fotos escuras. |
| `mono-dark`    | Apenas o S navy — sobre fotos claras. |

---

## Integração no app (HTML)

```html
<!-- Favicon -->
<link rel="icon" type="image/svg+xml" href="/brand/favicon/favicon.svg"/>
<link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon/favicon-32.png"/>
<link rel="icon" type="image/png" sizes="16x16" href="/brand/favicon/favicon-16.png"/>
<link rel="apple-touch-icon" sizes="180x180" href="/brand/favicon/apple-touch-icon.png"/>

<!-- PWA / manifest.json -->
<!-- icons: [
  { "src": "/brand/app-icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
  { "src": "/brand/app-icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
  { "src": "/brand/app-icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "/brand/app-icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
] -->

<!-- OpenGraph -->
<meta property="og:image" content="https://sigus.app/brand/social/og-image.png"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>

<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:image" content="https://sigus.app/brand/social/twitter-card.png"/>
```

---

## Sobre os SVGs

Os SVGs são **vetoriais puros** — geometria apenas, sem fontes externas. Escalam infinitamente. Editáveis em Illustrator, Figma, Inkscape, Sketch ou qualquer software de design.

Grid base: 32 unidades · margem interna 6u · espessura 4u · raio container 7u · cap das barras 1.6u.

## Sobre os PNGs

Renderizados a partir dos SVGs em resoluções recomendadas para cada uso:

- **16–64 px** · favicons e ícones de UI
- **128–256 px** · avatares e ícones médios
- **512–1024 px** · cabeçalhos, alta densidade (Retina), exportação para slides

Para resoluções intermediárias ou superiores, exporte do SVG diretamente — escalonar PNG para cima degrada qualidade.

## Conversões manuais

**Para .ico (multi-resolução)** · agrupar `favicon-16.png` + `favicon-32.png` + `favicon-48.png` com [icoconvert.com](https://icoconvert.com/) ou `magick convert *.png favicon.ico`.

**Para .pdf vetorial** · abrir o SVG no Illustrator/Inkscape e salvar como PDF.

**Para EPS** · idem · ainda preserva o vetor.

---

## Regras invioláveis

1. **Não distorcer** as proporções. Sempre escalar uniformemente.
2. **Não rotacionar** o monograma fora de 0°.
3. **Não recolorir** — use apenas as variantes oficiais.
4. **Não adicionar contorno** ao container.
5. **Não comprimir** verticalmente o wordmark.
6. **Clearspace mínimo** = ½ da altura do monograma ao redor.
7. **Tamanho mínimo** = 16px (digital) · 8mm (impresso).

Veja o Brand Book completo em `SIGUS Brand Identity.html` (seção 10 · Don'ts) para exemplos visuais do que evitar.

---

## Tipografia (não inclusa no pacote)

A marca usa **Inter** (display/UI) + **IBM Plex Mono** (números/códigos). Ambas disponíveis livres via Google Fonts:

- [Inter](https://fonts.google.com/specimen/Inter)
- [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono)

Wordmark "SIGUS" sempre em Inter 800 · letter-spacing -0.035em.

---

## Versão

- **v1.0** · 14 mai 2026 · primeira release oficial.

Para regenerar este pacote: ver `brand-marks.jsx` no projeto-fonte.
