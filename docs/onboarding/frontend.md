// Copyright (c) 2026 Vitras. Todos os direitos reservados.

# Onboarding frontend

## Estrutura

- `src/App.jsx`: composição principal
- `src/pages/`: páginas por área funcional
- `src/components/`: UI, layout, modais e blocos de feature
- `src/hooks/`: hooks de dados e interação
- `src/utils/`: helpers do cliente
- `src/styles/`: Design System oficial

## Fluxo do frontend

1. Vite sobe app React.
2. `src/api.js` centraliza comunicação com backend.
3. hooks encapsulam estados e chamadas.
4. páginas compõem fluxo funcional.
5. styles seguem tokens, foundations, components e patterns.

## Como rodar

```bash
cd frontend-react
npm install
cp .env.example .env.development
npm run dev
```

## Convenções

- respeitar Design System;
- evitar componente visual com regra clínica;
- preferir hooks e utilitários reaproveitáveis;
- manter nomes consistentes por domínio.

## Onde adicionar funcionalidade

- nova página: `src/pages/`
- componente compartilhado: `src/components/`
- integração ou helper: `src/hooks/` ou `src/utils/`
- estilo institucional: `src/styles/`

## Como testar e debugar

- validar fluxo manual com backend local
- revisar console do browser e network
- confirmar `VITE_API_URL`
- validar erros de autenticação, CORS e payload
