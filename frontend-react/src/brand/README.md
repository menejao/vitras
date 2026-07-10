# VITRAS · /motion
Motion Identity v1.0 · production assets

## Estrutura
```
/motion
├ /svg       Animações SVG self-contained (drop-in, sem dependências)
├ /css       Keyframes CSS reutilizáveis (motion.css)
├ /js        Helpers Web Animations API (motion.js)
├ /lottie    Lottie JSON para iOS/Android nativo
└ README.md
```

## Usar em web (mais simples)

### Opção A · SVG animado direto
```html
<img src="/brand/motion/svg/04-pulse-operational.svg" width="120" alt="">
<!-- ou embed inline para controle de cor via CSS -->
<object data="/brand/motion/svg/01-logo-reveal.svg" type="image/svg+xml"></object>
```

### Opção B · CSS keyframes
```html
<link rel="stylesheet" href="/brand/motion/css/motion.css">

<!-- Logo reveal -->
<svg class="vt-reveal-mark" viewBox="0 0 32 32">...</svg>
<span class="vt-reveal-letter vt-l-1">v</span>
<span class="vt-reveal-letter vt-l-2">i</span>
<span class="vt-reveal-letter vt-l-3">t</span>
<span class="vt-reveal-letter vt-l-4">r</span>
<span class="vt-reveal-letter vt-l-5">a</span>
<span class="vt-reveal-letter vt-l-6">s</span>
<span class="vt-reveal-letter vt-l-7" style="color:var(--vt-accent)">.</span>

<!-- Pulse operational -->
<div class="vt-pulse-wrap">
  <svg viewBox="0 0 32 32">...</svg>
  <div class="vt-ring"></div>
  <div class="vt-ring vt-r2"></div>
  <div class="vt-ring vt-r3"></div>
</div>

<!-- Loading bar -->
<div class="vt-loading"></div>
```

### Opção C · JavaScript (Web Animations API)
```js
import { vtRevealLogo, vtPulseOperational } from '/brand/motion/js/motion.js';

vtRevealLogo(
  document.querySelector('.mark'),
  document.querySelectorAll('.wm .letter')
);

vtPulseOperational(document.querySelectorAll('.ring'));
```

## Usar em iOS / Android nativo

```swift
// iOS (Lottie-ios)
import Lottie
let animation = LottieAnimationView(name: "04-pulse-operational")
animation.loopMode = .loop
animation.play()
```

```kotlin
// Android (Lottie-android)
val view: LottieAnimationView = findViewById(R.id.pulse)
view.setAnimation("04-pulse-operational.json")
view.repeatCount = LottieDrawable.INFINITE
view.playAnimation()
```

## Catálogo · 8 animações canônicas

| #  | Nome                  | Duração | Easing            | Loop | Uso                                 |
|----|----------------------|---------|-------------------|------|-------------------------------------|
| 01 | Logo reveal          | 880ms   | expo·out          | uma vez | Splash · onboarding · app launch  |
| 02 | Construção           | 1.6s    | inOut·sine        | uma vez | About · explainer técnico          |
| 03 | Loading              | 1.6s    | inOut·quart       | infinito | Conexão · sync inicial            |
| 04 | Pulse operacional    | 3.2s    | expo·out          | infinito | Heartbeat · "sistema ativo"       |
| 05 | CLI startup          | 2.88s   | snap (steps)      | infinito | Terminal · DevOps · admin         |
| 06 | Sync / convergência  | 2.4s    | inOut·sine        | infinito | Tenant sync · cluster join        |
| 07 | Notification         | 2.4s    | inOut·quart       | infinito | Alerta · badge · novo evento      |
| 08 | Favicon animado      | 3.2s    | inOut·sine        | infinito | Browser tab · processamento ativo |

## Easings · quatro curvas

| Nome           | cubic-bezier              | Uso                              |
|----------------|---------------------------|----------------------------------|
| expo·out       | (0.16, 1, 0.30, 1)        | 80% das entradas · padrão        |
| inOut·sine     | (0.45, 0, 0.55, 1)        | Loops · breathing                |
| inOut·quart    | (0.65, 0, 0.35, 1)        | Loading · sync                   |
| steps / linear | —                         | CLI · counters · cursors         |

**Easings expressivos (bounce, elastic, back) são proibidos.** Não fazem parte do vocabulário VITRAS.

## Timings · seis durações

| Nome    | ms    | Uso                                  |
|---------|-------|--------------------------------------|
| instant | 80    | Hover · feedback tátil · stagger     |
| snap    | 220   | Botões · toggles · pop               |
| calm    | 440   | Drawer · modal                       |
| reveal  | 880   | Logo reveal · onboarding             |
| cycle   | 1600  | Loading · construction               |
| breath  | 3200  | Operational pulse · heartbeat        |

**Valores intermediários estão proibidos.** Quebram a coerência do sistema.

## Performance & Acessibilidade

- Target **60 fps** · compositing GPU only
- Apenas propriedades `transform` + `opacity` (sem layout thrash)
- Sem `filter: blur()` em loop
- Sem flashing > 3Hz
- Respeita `prefers-reduced-motion: reduce` (já incluído em motion.css)
- Sem dependência de motion para informação crítica

## Princípios

1. **Inevitável** — Movimento é confirmação, não anúncio.
2. **Direcional** — Tudo converge ou propaga.
3. **Calmo** — Sem bounce, sem overshoot.
4. **Geométrico** — Linhas retas, formas duras.

**Em dúvida, não anime.**

## Notas sobre os arquivos Lottie

Os JSONs em `/lottie` são construídos manualmente e cobrem as 4 animações
mais críticas (reveal, loading, pulse, favicon). Para variações ou animações
adicionais (construction, CLI, sync, notification), recomenda-se exportar
do After Effects via plugin Bodymovin com o storyboard documentado em
`VITRAS Motion Identity.html` como referência.
