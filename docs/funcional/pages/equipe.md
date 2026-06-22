# Equipe — Escopo Funcional

**Versão:** 1.0  
**Atualizado:** 2026-06-22  
**Arquivo React:** `frontend-react/src/pages/EquipePage.jsx`  
**Tab:** `equipe`

---

## 1. Objetivo e contexto

Diretório da equipe da UBS. Exibe todos os membros da equipe agrupados por categoria profissional. Permite ao usuário editar seus próprios dados (via ProfileModal). Gestor pode editar dados de outros membros. Exibe informações de conselho profissional (CRM, CRO, COREN).

**Usuários:** Todos os perfis.

**Frequência de uso:** Pontual — para consultar contatos ou editar perfil.

---

## 2. Dependências técnicas

| Método | Endpoint | Finalidade |
|---|---|---|
| GET | `/teams/:id` | Dados da equipe (nome, INE, tipo) |
| PATCH | `/teams/:id` | Editar nome/tipo da equipe (gestor) |
| Dados | `allUsers` (bootstrap) | Lista de membros |

---

## 3. Elementos da página

### 3.1 Header

- Título: nome da equipe
- Tipo de equipe (ESF, NASF, CEO, etc.)
- INE da equipe
- Botão editar equipe (se gestor)

### 3.2 Grupos por categoria profissional

| ID | Label | Roles incluídas |
|---|---|---|
| `medicos` | Médicos | `doctor` |
| `dentistas` | Dentistas | `dentist` |
| `enfermagem` | Enfermagem | `nurse_manager`, `nursing_tech` |
| `acs` | Agentes Comunitários (ACS) | `acs` |
| `farmacia` | Farmácia | `pharmacist`, `pharmacy_tech` |
| `recepcao` | Recepção | `receptionist` |
| `gestao` | Gestão | `gestor` |
| `suporte` | Suporte & TI | `developer_readonly`, `support_operator`, etc. |

### 3.3 MemberCard

Para cada membro:
- Avatar (iniciais)
- Nome
- Cargo (`roleLabel(role)`)
- Nome da equipe
- E-mail
- Número de conselho profissional (se preenchido)
- Botão "Editar meus dados" (somente para o próprio usuário)

### 3.4 Tipos de equipe disponíveis

| Valor | Label |
|---|---|
| `ESF` | ESF — Estratégia Saúde da Família |
| `NASF` | NASF — Núcleo Ampliado de Saúde da Família |
| `CEO` | CEO — Centro de Especialidades Odontológicas |
| (outros) | Conforme lista TIPO_EQUIPE_OPTIONS |

---

## 4. Regras de negócio

| Código | Gatilho | Condição | Ação |
|---|---|---|---|
| RN-EQP-01 | Renderizar cards | Sempre | "Você" badge no card do usuário logado |
| RN-EQP-02 | Botão "Editar meus dados" | `isSelf === true` | Abre ProfileModal |
| RN-EQP-03 | Role desconhecida | Não encontrada em ROLE_GROUPS | Agrupada em "outros" |

---

## 5. Ações

| Ação | Gatilho | Resultado |
|---|---|---|
| Editar meu perfil | "Editar meus dados" | ProfileModal aberto |
| Editar nome da equipe | Botão editar (gestor) | `PATCH /teams/:id` |

---

## 6. Permissões

| Ação | Requer |
|---|---|
| Ver lista | Qualquer perfil |
| Editar próprio perfil | Usuário autenticado |
| Editar dados da equipe | `gestor` ou `hasCapability("team.write")` |

---

## 7. Histórico

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documentação inicial |
