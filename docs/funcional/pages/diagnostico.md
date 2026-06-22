# Diagnóstico do Sistema — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/DiagnosticsPage.jsx`  
**Tab:** `diagnostics`

---

## 1. Objetivo e contexto

Painel técnico de diagnóstico do sistema. Exibe saúde da API, status de conectividade, últimas cargas de dados, contagens de entidades e informações de sessão. Usado por suporte técnico e desenvolvedores.

**Usuários:** Perfis técnicos (developer_readonly, support_operator, admin).

---

## 2. Dependências técnicas

| Dado | Fonte |
|---|---|
| `apiHealth` | Hook `useApiHealth` → polling do backend |
| `lastLoadAt` | Bootstrap (timestamp da última carga) |
| `demandMonthly` | Bootstrap |
| `patients`, `users`, `templates` | Bootstrap |

---

## 3. Elementos da página

### 3.1 Status da API

- Latência (ms)
- Status: online / offline / degradado
- Timestamp da última verificação

### 3.2 Status de autenticação

- Token presente
- Usuário logado
- Sessão válida até

### 3.3 Contagens de dados

- Total de pacientes carregados
- Total de usuários
- Total de templates
- Timestamp da última carga

### 3.4 Informações de ambiente

- Versão do frontend
- Modo de DB (JSON file / Postgres)
- User-agent

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-DGN-01 | API health | Latência > 1000ms | Badge amarelo |
| RN-DGN-02 | API health | Offline | Badge vermelho |
| RN-DGN-03 | API health | OK < 300ms | Badge verde |

---

## 5. Permissões

Acessível a todos os perfis autenticados (sem restrição formal). Não expõe dados de pacientes individualmente.

---

## 6. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
