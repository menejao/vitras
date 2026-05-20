# Frontend React (migracao)

Esta pasta contem a migracao inicial do frontend para React, sem substituir o frontend legado ainda.

## Rodar local

1. Instale dependencias:

```bash
npm install
```

2. Configure a URL da API:

```bash
cp .env.example .env
```

No Windows (PowerShell), tambem pode usar:

```powershell
$env:VITE_API_URL="http://localhost:3001"
```

3. Inicie:

```bash
npm run dev
```

## Escopo atual

- Login e sessao
- Dashboard
- Pacientes:
  - busca e filtros
  - criar, editar, excluir
  - painel com abas: protocolo, historico, atendimentos, tarefas e mensagens
- Equipe:
  - listar ACS e medicos
  - criar, editar e excluir (com bloqueios do backend)
- Protocolos:
  - listar templates
  - criar, editar e excluir
- IA Assistida da equipe:
  - prioridades do dia
  - qualidade de dados
  - relatorio executivo
  - pergunta livre ao assistente
