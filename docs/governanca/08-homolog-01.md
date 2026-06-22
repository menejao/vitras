# HOMOLOG-01 — Critérios Nacionais de Homologação de UBS

**Status:** ATIVO  
**Vigência:** A partir de 2026-06-22  
**Aplicação:** Obrigatório para todas as UBS implantadas no VITRAS APS

---

## 1. Objetivo

Definir os critérios nacionais, auditáveis e reproduzíveis para que uma UBS avance entre os estados do ciclo de implantação.

**Regra fundamental:** Nenhuma UBS é ativada com base em decisão subjetiva. Toda ativação exige cumprimento formal destes critérios.

---

## 2. Ciclo de vida

| Estado | Significado |
|---|---|
| **DRAFT** | UBS criada. Nenhuma implantação iniciada. |
| **ONBOARDING** | Configuração inicial em andamento. |
| **HOMOLOGATION** | Configuração concluída. Aguardando validação operacional. |
| **ACTIVE** | UBS liberada para operação. |
| **SUSPENDED** | UBS temporariamente suspensa. |

### Transições de estado

```
DRAFT → ONBOARDING        (automática ao criar gestor inicial)
ONBOARDING → HOMOLOGATION (manual — exige critérios abaixo)
HOMOLOGATION → ACTIVE     (manual — exige checklist completo + aprovação)
ACTIVE → SUSPENDED        (manual)
SUSPENDED → ACTIVE        (manual)
```

Transições para trás permitidas: ONBOARDING → DRAFT, HOMOLOGATION → ONBOARDING.

---

## 3. Critérios para ONBOARDING → HOMOLOGATION

Todos os itens abaixo devem ser **SIM** para avançar:

| # | Critério | Verificação |
|---|---|---|
| 1 | Gestor inicial criado | Pelo menos 1 usuário com role=gestor ativo na UBS |
| 2 | Gestor realizou primeiro acesso | `forcePasswordChange = false` em pelo menos 1 gestor |
| 3 | Pelo menos uma equipe cadastrada | Pelo menos 1 equipe vinculada à UBS |
| 4 | Pelo menos um usuário ativo | Pelo menos 1 usuário não-inativo vinculado à UBS |
| 5 | Dados institucionais preenchidos | `cnes`, `name`, `municipalityName`, `uf` todos não-vazios |

**Verificação:** automática pelo sistema no momento da transição de status.

---

## 4. Checklist de homologação (obrigatório para ACTIVE)

O checklist abaixo deve ser marcado explicitamente pelo suporte técnico durante validação operacional em staging:

| # | Item | Verificação |
|---|---|---|
| 1 | Autenticação funcionando | Login/logout funcionando para todos os perfis |
| 2 | RBAC funcionando por perfil | ACS, enfermeiro e gestor com permissões corretas |
| 3 | Equipe configurada e ativa | ESF ou NASF cadastrada e com membros |
| 4 | Usuário operacional criado | Pelo menos 1 usuário além do gestor |
| 5 | Cadastro de cidadão funcionando | CRUD de paciente funcionando |
| 6 | Cadastro domiciliar funcionando | CRUD de domicílio funcionando |
| 7 | Cadastro individual funcionando | Ficha individual preenchível e persistente |
| 8 | Trilha de auditoria funcionando | Ações registradas em `auditLogs` |

**Verificação:** marcação explícita pelo support_admin no Console Nacional.

---

## 5. Critérios para HOMOLOGATION → ACTIVE

Além de todos os critérios de onboarding (seção 3):

| # | Critério | Verificação |
|---|---|---|
| 1–8 | Todos os itens do checklist de homologação | Marcados como SIM pelo suporte |
| 9 | Aprovação técnica registrada | `homologationApprovedBy` e `homologationApprovedAt` preenchidos |

**Regra:** checklist só pode ser preenchido quando a UBS está no estado HOMOLOGATION.

---

## 6. Auditoria

Toda transição de estado registra:

| Campo | Valor registrado |
|---|---|
| `action` | `PLATFORM_UNIT_UPDATED` |
| `actor` | `req.user.id` (support_admin responsável) |
| `previousStatus` | Estado anterior |
| `newStatus` | Estado resultante |
| `changedFields` | Campos alterados |
| `outcome` | `success` |

Atualização do checklist registra:

| Campo | Valor registrado |
|---|---|
| `action` | `PLATFORM_HOMOLOGATION_CHECKLIST_UPDATED` |
| `actor` | `req.user.id` |
| `updatedItems` | Itens alterados nesta atualização |
| `allChecked` | `true` quando todos os itens preenchidos |

---

## 7. Garantias nacionais

Estes critérios são:

1. **Iguais para toda e qualquer UBS** — sem exceções por município, estado ou fornecedor.
2. **Verificados automaticamente pelo sistema** — sem margem para bypass manual.
3. **Auditáveis** — cada transição gera trilha rastreável.
4. **Independentes de decisão subjetiva** — o sistema bloqueia a transição até que todos os critérios sejam cumpridos.

---

## 8. Responsabilidades

| Papel | Responsabilidade |
|---|---|
| Support Admin | Executa configuração da UBS, preenche checklist de homologação, aprova transição para ACTIVE |
| Gestor da UBS | Realiza primeiro acesso, muda senha obrigatória, cria equipe e usuários |
| VITRAS (produto) | Mantém este documento e os critérios programáticos |

---

## 9. Histórico de versões

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-22 | Documento inicial — critérios nacionais de homologação |
