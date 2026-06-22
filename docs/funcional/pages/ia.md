# IA — Análise — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/AiTab.jsx`  
**Tab:** `ai`

---

## 1. Objetivo e contexto

Módulo de análise assistida por IA. Oferece três modos: priorização de pacientes críticos, análise de qualidade dos dados e relatório narrativo. Permite também perguntas livres sobre os dados da unidade.

**Usuários:** Gestores, administradores.

**Importante:** Não processa dados individualmente identificáveis em prompts — dados agregados apenas.

---

## 2. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| POST | `/ai/priorities` | Análise de prioridades |
| POST | `/ai/quality` | Análise de qualidade |
| POST | `/ai/report` | Relatório narrativo |
| POST | `/ai/ask` | Pergunta livre |

---

## 3. Elementos da página

### 3.1 Botões de análise

- "Ver prioridades" → `loadAiPriorities()`
- "Ver qualidade" → `loadAiQuality()`
- "Ver relatório" → `loadAiReport()`

### 3.2 Campo de pergunta livre

- Input texto
- Botão "Perguntar"

### 3.3 Painel de resultado

- `aiView`: tipo de análise exibida
- `aiData`: conteúdo da resposta da IA
- Loading durante análise

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-IA-01 | Análise | Sem dados carregados | Estado vazio / erro |
| RN-IA-02 | Pergunta livre | Vazia | Botão desabilitado |
| RN-IA-03 | Erro de API | Sem dados | `setError` exibe mensagem |

---

## 5. Permissões

Sem restrição de capability específica. Dados enviados à IA são aggregados — sem PII individual.

---

## 6. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
