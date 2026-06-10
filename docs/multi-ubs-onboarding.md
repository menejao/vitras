# Onboarding Multi-UBS — VITRAS

> **Revisão:** Sprint 4 — Maio 2026

---

## 1. Pré-condições

Antes de iniciar o onboarding de uma nova UBS, verificar:

- [ ] `unitId` definido e único (ex: `ubs-centro-sp-01`)
- [ ] `unitName` definido e descritivo (ex: `UBS Centro São Paulo — Unidade 01`)
- [ ] Usuário gestor criado com `role = "gestor"` via `POST /auth/register`
- [ ] Gestor não está associado a outra unidade
- [ ] Token `break_glass_admin` disponível para executar bootstrap
- [ ] Ambiente de produção saudável: `/readyz` retorna 200

---

## 2. SOP de Onboarding

### Passo 1: Criar o Gestor

```bash
# Criar gestor via registro (se self-register habilitado para gestor em prod)
# ou via seed admin

POST /auth/register
{
  "email": "gestor@ubs-nova.local",
  "password": "SenhaForte@2026",
  "name": "Dr. João Silva",
  "role": "gestor",
  "councilType": "CRM",
  "councilNumber": "123456",
  "councilUf": "SP"
}
```

### Passo 2: Anotar o gestorUserId

```bash
GET /admin/bootstrap
Authorization: Bearer $ADMIN_TOKEN
# Encontrar o userId do gestor recém-criado no array `users`
```

### Passo 3: Bootstrap da Unidade

```bash
POST /admin/units/bootstrap
Authorization: Bearer $BREAK_GLASS_TOKEN
Content-Type: application/json

{
  "unitId": "ubs-centro-sp-01",
  "unitName": "UBS Centro São Paulo — Unidade 01",
  "gestorUserId": "uuid-do-gestor"
}
```

**Resposta esperada (201/200):**
```json
{
  "ok": true,
  "unitId": "ubs-centro-sp-01",
  "gestorUserId": "uuid-do-gestor",
  "message": "Unidade 'ubs-centro-sp-01' criada e gestor associado com sucesso"
}
```

### Passo 4: Criar Equipe para a Unidade

```bash
POST /admin/teams (ou via seed)
{
  "name": "Equipe Azul",
  "unitId": "ubs-centro-sp-01",
  "managerUserId": "uuid-do-gestor"
}
```

### Passo 5: Convidar Profissionais

Registrar ACS, enfermeiros, médicos com o `teamId` correto.

### Passo 6: Validação

Executar checklist de isolamento (seção 3).

---

## 3. Checklist de Validação de Isolamento

Após bootstrap, verificar isolamento multi-UBS:

- [ ] Gestor da nova unidade consegue logar e ver apenas pacientes da sua unidade
- [ ] Gestor da unidade existente NÃO vê pacientes da nova unidade
- [ ] ACS da nova equipe NÃO vê pacientes de outras equipes
- [ ] `GET /audit-logs` de um usuário da nova unidade retorna apenas eventos da sua unidade
- [ ] `GET /audit-logs/reports/cross-team-access` não mostra vazamentos

**Teste de isolamento automatizado:**
```bash
# Login como gestor da nova unidade
TOKEN=$(curl -s -X POST /auth/login -d '{"email":"gestor@ubs-nova.local","password":"..."}' | jq -r .accessToken)

# Buscar pacientes — deve retornar apenas da nova unidade
curl -H "Authorization: Bearer $TOKEN" /patients | jq '.patients | length'

# Tentar acessar paciente de outra unidade — deve retornar 403
curl -H "Authorization: Bearer $TOKEN" /patients/ID_PACIENTE_OUTRA_UNIDADE
```

---

## 4. Dados Mínimos de Seed

Para uma UBS funcional, o seed mínimo inclui:

| Entidade | Mínimo | Propósito |
|----------|--------|-----------|
| Unit | 1 | Âncora de isolamento |
| Team | 1 | Atribuição de pacientes e usuários |
| Gestor | 1 | Administração clínica |
| Nurse/Doctor | 1 | Consultas e registros |
| ACS | 1 | Visitas domiciliares |

---

## 5. Procedimento de Offboarding (Rollback)

Para remover uma UBS em caso de erro ou cancelamento:

**ATENÇÃO:** Não há endpoint de remoção automática — dados clínicos têm retenção obrigatória (CFM 20 anos).

### Passos Manuais

1. Marcar usuários da unidade como `inactive = true` (via admin)
2. Registrar decisão em audit log com `break_glass_admin`
3. NÃO deletar pacientes ou registros clínicos (CFM 1821/2007)
4. Manter unidade no banco como "inativa" por 20 anos
5. Exportar dados via `/admin/backup/export` antes de qualquer ação

### Exclusão Lógica (Futura)

Sprint 5+ recomendação: adicionar campo `status: "active"|"inactive"` em `units` e filtrar unidades inativas das views normais.

---

## 6. Referências

- `src/routes/admin.js` — `POST /admin/units/bootstrap`
- `src/utils/domain.js` — `validateUnitBootstrap()`
- `docs/lgpd-cfm-considerations.md` — Retenção de dados
- `docs/operational-governance.md` — Relatórios e isolamento
