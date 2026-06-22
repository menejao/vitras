# Suprimentos / Insumos — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/InsumoPage.jsx`  
**Tab:** `insumos`

---

## 1. Objetivo e contexto

Controle de insumos e materiais da UBS (não medicamentos). Luvas, seringas, curativos, materiais odontológicos, EPIs. Controla estoque, dispensações e uso contínuo por paciente.

**Usuários:** Todos com `supplies.read` ou `supplies.write`.

---

## 2. Dependências técnicas

Hook: `useSupplies(token, { enabled })`.

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/supplies/stock` | Estoque atual |
| GET | `/supplies/log` | Histórico |
| GET | `/supplies/continuous` | Uso contínuo ativo |
| POST | `/supplies/stock/adjust` | Ajustar estoque |
| POST | `/supplies/dispense` | Dispensar insumo |
| POST | `/supplies/continuous/:id/close` | Encerrar uso contínuo |

---

## 3. Elementos da página

### 3.1 Estoque de insumos

- Lista de itens com quantidade atual e mínima
- Botão ajustar estoque

### 3.2 Dispensação

- Select insumo
- Quantidade
- Paciente (opcional — para uso pessoal)

### 3.3 Uso contínuo

- Pacientes com insumo de uso contínuo ativo (ex: fraldas, sondas)
- Botão encerrar uso contínuo

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-INS-01 | Quantidade < mínimo | Qualquer item | Badge vermelho |
| RN-INS-02 | Acessar tab | Sem capability | Tab bloqueado |

---

## 5. Permissões

| Ação | Requer |
|---|---|
| Ver estoque | `supplies.read` + `teamId` |
| Ajustar / dispensar | `supplies.write` + `teamId` |

---

## 6. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
