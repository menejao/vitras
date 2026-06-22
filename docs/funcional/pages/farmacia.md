# Farmácia — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/PharmacyPage.jsx`  
**Tab:** `pharmacy`

---

## 1. Objetivo e contexto

Gestão do estoque farmacêutico da UBS. Controla medicamentos: cadastro, ajuste de estoque, dispensação para pacientes, histórico de movimentações. Requer `teamId` e capabilities de farmácia.

**Usuários:** `pharmacist`, `pharmacy_tech`. Médicos podem dispensar com `pharmacy.write`.

---

## 2. Dependências técnicas

Hook: `usePharmacy(token, { enabled })`.

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/pharmacy/stock` | Listar estoque |
| GET | `/pharmacy/log` | Histórico de movimentações |
| POST | `/pharmacy/stock` | Cadastrar medicamento |
| PATCH | `/pharmacy/stock/:id` | Editar medicamento |
| POST | `/pharmacy/stock/:id/adjust` | Ajustar estoque (entrada/saída) |
| POST | `/pharmacy/stock/:id/dispense` | Dispensar para paciente |

---

## 3. Elementos da página

### 3.1 Estoque

Para cada item:
- Nome do medicamento
- Forma farmacêutica / concentração
- Quantidade atual
- Quantidade mínima (alerta quando abaixo)
- Lote / validade
- Botões: Ajustar estoque, Dispensar, Editar

### 3.2 Formulário de dispensação

- Select paciente
- Quantidade dispensada
- Prescrição / observação
- Data

### 3.3 Histórico de movimentações

- Data / hora
- Tipo (entrada, saída, dispensação, ajuste)
- Quantidade
- Responsável
- Paciente (se dispensação)

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-FAR-01 | Quantidade < mínimo | Qualquer item | Badge vermelho "Estoque crítico" |
| RN-FAR-02 | Acessar tab | Sem `teamId` ou sem capability | Tab bloqueado |
| RN-FAR-03 | Dispensar | `pharmacy.write` ausente | Botão oculto |
| RN-FAR-04 | Cadastrar/editar | `canWrite === false` | Formulário desabilitado |

---

## 5. Permissões

| Ação | Requer |
|---|---|
| Ver estoque | `pharmacy.read` + `teamId` |
| Dispensar / ajustar | `pharmacy.write` + `teamId` |
| Cadastrar medicamento | `pharmacy.write` |

---

## 6. Auditoria

| Ação | Evento |
|---|---|
| Dispensação | `DISPENSACAO_FARMACIA` |
| Ajuste de estoque | `ESTOQUE_AJUSTADO` |
| Cadastrar medicamento | `MEDICAMENTO_CADASTRADO` |
| Editar medicamento | `MEDICAMENTO_EDITADO` |

---

## 7. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
