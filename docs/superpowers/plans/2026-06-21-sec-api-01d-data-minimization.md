# SEC-API-01D — Data Minimization + Screen-Scoped GetById

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar over-fetching e endpoints inexistentes no frontend; adicionar `GET /tasks/:id` no backend; garantir que cada tela busque apenas os dados que usa.

**Architecture:** Três mudanças independentes: (1) fix crítico no AcsTasksPage — N+1 loop chamando endpoint inexistente → single scoped call; (2) PATCH de tarefa apontando para rota errada → corrigir para rota existente; (3) adicionar `GET /tasks/:id` no backend com RBAC + team scope. Sem novos componentes, sem nova UX.

**Tech Stack:** Node.js + Express (backend), React + Vite (frontend), `api()` wrapper em `frontend-react/src/api.js`

---

## Matriz Tela → Endpoint (resultado da auditoria)

| Tela | Endpoint atual | Problema | Endpoint correto | Status |
|------|---------------|----------|-----------------|--------|
| AcsTasksPage (TasksTab) | `GET /patients/:id/tasks` × N | Endpoint não existe; N+1 por paciente | `GET /tasks?assigneeId=:userId` × 1 | ❌ CRÍTICO |
| AcsTasksPage (TasksTab) | `PATCH /patients/:id/tasks/:taskId` | Endpoint não existe | `PATCH /tasks/:taskId` | ❌ CRÍTICO |
| AcsTasksPage (TasksTab) | `GET /tasks?assigneeId=X` | Faltando wrapper em api.js | Adicionar `listTasksByAssignee()` | ⚠️ |
| Backend | `GET /tasks/:id` | Endpoint ausente | Criar com RBAC + team scope | ❌ |
| Outros (PatientsPage, Dashboard) | props via parent | Sem API calls diretos | Sem mudança | ✅ |
| PatientDetailPanel | `getHouseholds()`, create/patch | Corretos, team-scoped | Sem mudança | ✅ |
| `/acs-visits` list | `GET /acs-visits` (sem paginação) | N visitas ilimitadas | Fora de escopo SEC-01D (não altera UX) | 🔵 BACKLOG |

---

## Arquivos Modificados

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `backend/src/routes/tasks.js` | Modificar | Adicionar `GET /tasks/:id` com RBAC + team scope |
| `backend/test/tasks.test.js` | Criar | Testes GET /tasks/:id: 200, 403, 404, team-scope |
| `frontend-react/src/api.js` | Modificar | Adicionar `listTasksByAssignee(token, assigneeId)` |
| `frontend-react/src/pages/AcsTasksPage.jsx` | Modificar | Linhas 3341-3400: fix N+1 + fix PATCH errado |
| `docs/openapi.yaml` | Modificar | Adicionar `GET /tasks/{id}` |

---

## Task 1: Backend — GET /tasks/:id

**Files:**
- Modify: `backend/src/routes/tasks.js` (após linha 42, antes de `router.post`)
- Create: `backend/test/tasks.test.js`

- [ ] **Step 1: Escrever teste que falha**

Criar `backend/test/tasks.test.js`:

```javascript
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { withTestServer } from "./helpers/test-server.js";
import { seedTestDb, clearTestDb } from "./helpers/seed.js";

describe("GET /tasks/:id", () => {
  let server, gestor, acs, otherTeamAcs, taskId, patientId;

  before(async () => {
    await clearTestDb();
    const seed = await seedTestDb();
    gestor = seed.gestor;
    acs = seed.acs;
    otherTeamAcs = seed.otherTeamAcs;
    taskId = seed.task.id;
    patientId = seed.task.patientId;
    server = await withTestServer();
  });

  it("gestor gets task by id", async () => {
    const res = await fetch(`${server.url}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${gestor.token}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, taskId);
    assert.equal(body.patientId, patientId);
  });

  it("acs gets own assigned task", async () => {
    const res = await fetch(`${server.url}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${acs.token}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, taskId);
  });

  it("acs from other team gets 404", async () => {
    const res = await fetch(`${server.url}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${otherTeamAcs.token}` }
    });
    assert.equal(res.status, 404);
  });

  it("unknown task id returns 404", async () => {
    const res = await fetch(`${server.url}/tasks/nonexistent-id`, {
      headers: { Authorization: `Bearer ${gestor.token}` }
    });
    assert.equal(res.status, 404);
  });
});
```

- [ ] **Step 2: Rodar teste para confirmar falha**

```
cd backend
node --test test/tasks.test.js
```

Esperado: FAIL — `GET /tasks/:id` não existe.

> **Nota:** Se `test/helpers/test-server.js` ou `seed.js` não existirem, use o padrão dos outros arquivos de teste existentes em `backend/test/`. Os testes existentes em `backend/test/patients.test.js` e `backend/test/health.test.js` mostram o padrão correto de helpers.

- [ ] **Step 3: Implementar GET /tasks/:id**

Em `backend/src/routes/tasks.js`, adicionar após a linha 42 (após `router.get("/tasks", ...)`):

```javascript
router.get("/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  ensureDbShape(db);

  const task = db.tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });

  // team scope: ACS vê apenas tarefas atribuídas a si; gestor/doctor vê da equipe
  const patient = db.patients.find(p => p.id === task.patientId);
  if (!patient) return res.status(404).json({ error: "Tarefa não encontrada" });

  const allowedIds = new Set(getAllowedPatients(db, req.user, {}).map(p => p.id));
  if (!allowedIds.has(patient.id)) {
    return res.status(404).json({ error: "Tarefa não encontrada" });
  }

  // ACS só vê tarefa atribuída a si
  if (isAcs(req.user) && task.assigneeId !== req.user.id) {
    return res.status(404).json({ error: "Tarefa não encontrada" });
  }

  return res.json(task);
});
```

- [ ] **Step 4: Rodar testes**

```
cd backend
node --test test/tasks.test.js
node --test test/health.test.js
node --test test/patients.test.js
node --test test/schema-validation.test.js
```

Esperado: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/tasks.js backend/test/tasks.test.js
git commit -m "feat(tasks): add GET /tasks/:id with RBAC and team scope"
```

---

## Task 2: Backend — Documentar GET /tasks/:id no OpenAPI

**Files:**
- Modify: `docs/openapi.yaml`

- [ ] **Step 1: Localizar seção /tasks em openapi.yaml**

Abrir `docs/openapi.yaml` e buscar por `/tasks`. Encontrar a entrada existente para `GET /tasks` (com parâmetros `patientId`, `assigneeId`).

- [ ] **Step 2: Adicionar entrada GET /tasks/{id}**

Após a entrada de `GET /tasks`, adicionar:

```yaml
  /tasks/{id}:
    get:
      summary: Get task by ID
      description: |
        Returns a single task. Team-scoped: ACS sees only own assigned tasks;
        gestor/doctor sees any task in their team.
      tags: [Tasks]
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Task found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Task'
        '404':
          description: Task not found or out of scope
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```

> **Nota:** Se `Task` schema não existir em `components/schemas`, adicionar seção mínima ou referenciar schema inline conforme padrão dos outros endpoints existentes no arquivo.

- [ ] **Step 3: Commit**

```bash
git add docs/openapi.yaml
git commit -m "docs(openapi): document GET /tasks/{id}"
```

---

## Task 3: Frontend api.js — listTasksByAssignee wrapper

**Files:**
- Modify: `frontend-react/src/api.js` (após linha 437, após `listTasks`)

- [ ] **Step 1: Adicionar função**

Em `frontend-react/src/api.js`, após a linha:
```javascript
export async function listTasks(token, patientId) {
  return api(`/tasks?patientId=${encodeURIComponent(patientId)}`, { method: "GET", retryCount: 2 }, token);
}
```

Adicionar:
```javascript
export async function listTasksByAssignee(token, assigneeId) {
  return api(`/tasks?assigneeId=${encodeURIComponent(assigneeId)}`, { method: "GET", retryCount: 2 }, token);
}
```

- [ ] **Step 2: Verificar build**

```
cd frontend-react
npm run build 2>&1
```

Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/api.js
git commit -m "feat(api): add listTasksByAssignee helper"
```

---

## Task 4: Frontend AcsTasksPage — Fix N+1 e PATCH errado (CRÍTICO)

**Files:**
- Modify: `frontend-react/src/pages/AcsTasksPage.jsx` linhas 3341–3400

**Contexto:** O componente `TasksTab` (seção de tarefas dentro de AcsTasksPage) tem dois bugs críticos:
1. **N+1**: loop `Promise.all(myPatients.map(p => fetch(/patients/${p.id}/tasks)))` — endpoint não existe; deveria ser uma única chamada `GET /tasks?assigneeId=userId`
2. **PATCH errado**: `fetch(/patients/${task.patientId}/tasks/${task.id})` — endpoint não existe; deveria ser `PATCH /tasks/${task.id}`

- [ ] **Step 1: Localizar imports no topo de AcsTasksPage.jsx**

Confirmar que `listTasksByAssignee` e `updateTaskStatus` já estão importados. Se não, encontrar a linha de import de `api.js` e adicionar.

Buscar no topo do arquivo por:
```javascript
import { ... } from "../api.js";
```
ou
```javascript
import { API_URL } from "../api.js";
```

Adicionar `listTasksByAssignee` e `updateTaskStatus` ao import existente (se ainda não estiverem).

- [ ] **Step 2: Substituir useEffect com N+1 (linhas 3341–3360)**

Localizar o bloco:
```javascript
  useEffect(() => {
    if (!token) return;
    const myPatients = patients.filter(p => p.assignedAcsId === user?.id);
    if (!myPatients.length) { setAllTasks([]); setLoading(false); return; }
    setLoading(true);
    Promise.all(myPatients.map(p =>
      fetch(`${API_URL}/patients/${p.id}/tasks`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then(tasks => (Array.isArray(tasks) ? tasks : []).map(t => ({
          ...t,
          patientId: p.id,
          patientName: p.name,
          patientBirth: p.birthDate,
          patientCareCategory: p.careCategory,
        })))
        .catch(() => [])
    ))
      .then(results => { setAllTasks(results.flat()); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, patients, user?.id]);
```

Substituir por:
```javascript
  useEffect(() => {
    if (!token || !user?.id) return;
    setLoading(true);
    listTasksByAssignee(token, user.id)
      .then(tasks => {
        if (!Array.isArray(tasks)) { setAllTasks([]); return; }
        // Enrich with patient data from already-loaded patients prop
        const patientMap = Object.fromEntries(patients.map(p => [p.id, p]));
        const enriched = tasks.map(t => ({
          ...t,
          patientName: patientMap[t.patientId]?.name || "",
          patientBirth: patientMap[t.patientId]?.birthDate || "",
          patientCareCategory: patientMap[t.patientId]?.careCategory || "",
        }));
        setAllTasks(enriched);
      })
      .catch(() => setAllTasks([]))
      .finally(() => setLoading(false));
  }, [token, user?.id, patients]);
```

- [ ] **Step 3: Substituir changeStatus PATCH errado (linhas 3391–3400)**

Localizar o bloco:
```javascript
  async function changeStatus(task, status) {
    try {
      await fetch(`${API_URL}/patients/${task.patientId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setAllTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t));
    } catch {}
  }
```

Substituir por:
```javascript
  async function changeStatus(task, status) {
    try {
      await updateTaskStatus(token, task.id, status);
      setAllTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t));
    } catch {}
  }
```

- [ ] **Step 4: Verificar build**

```
cd frontend-react
npm run build 2>&1
```

Esperado: zero erros. Se houver erro de import não encontrado, verificar nome exato das funções em `api.js`.

- [ ] **Step 5: Verificar lint (se disponível)**

```
cd frontend-react
npm run lint 2>&1
```

Se `lint` não existir no `package.json`, pular.

- [ ] **Step 6: Commit**

```bash
git add frontend-react/src/pages/AcsTasksPage.jsx
git commit -m "fix(tasks): replace N+1 loop and broken PATCH with correct api calls

- listTasksByAssignee(userId) replaces Promise.all per-patient loop
- updateTaskStatus() replaces raw fetch to non-existent endpoint
- Single GET /tasks?assigneeId=X instead of N calls to missing route"
```

---

## Task 5: Deploy

- [ ] **Step 1: git push (Amplify)**

```bash
git push origin main
```

Amplify build automático ativado.

- [ ] **Step 2: EB deploy (backend)**

```powershell
$version = "sec-api-01d-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
cd C:\dev\vitras\backend
Compress-Archive -Path * -DestinationPath ..\eb-deploy.zip -Force
aws s3 cp ..\eb-deploy.zip "s3://vitras-eb-deploy-artifacts-494003775820-sa-east-1/$version.zip" --region sa-east-1
aws elasticbeanstalk create-application-version --application-name vitras --version-label $version --source-bundle "S3Bucket=vitras-eb-deploy-artifacts-494003775820-sa-east-1,S3Key=$version.zip" --region sa-east-1 | Out-Null
aws elasticbeanstalk update-environment --application-name vitras --environment-name vitras-drill-sa-3 --version-label $version --region sa-east-1 | Out-Null
Write-Host "Deployed: $version"
```

- [ ] **Step 3: Confirmar deploy EB**

```powershell
aws elasticbeanstalk describe-environment-health --environment-name vitras-drill-sa-3 --attribute-names All --region sa-east-1 | ConvertFrom-Json | Select-Object HealthStatus, Status
```

Esperado: `HealthStatus: "Ok"`, `Status: "Ready"`

---

## Relatório Final Esperado

**SEC-API-01D PASS** quando:

1. Cada tela carrega apenas endpoints necessários? **SIM** — TasksTab usa 1 chamada em vez de N
2. Backend retorna apenas dados necessários? **SIM** — GET /tasks/:id retorna um recurso com scope
3. Endpoints globais indevidos em telas específicas? **NÃO** — N+1 removido
4. Testes passando? **SIM** — tasks.test.js + health + patients + schema

---

## Fora de Escopo (Backlog pós-piloto)

- Paginação em `GET /acs-visits` (altera fluxo UX — fora de SEC-01D)
- Paginação em `listPatients()` (requer mudança de UX)
- `GET /family-groups/:id` field projection (altera contrato com FamilyGroupWorkspace)
- Consolidar raw `fetch()` em `AcsTasksPage` para `api()` wrapper (melhoria isolada, sem bug funcional)
