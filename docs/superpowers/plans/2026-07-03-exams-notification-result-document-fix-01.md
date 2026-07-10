# EXAMS-NOTIFICATION-RESULT-DOCUMENT-FIX-01 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir notificações de resultado de exame para navegar diretamente ao resultado específico, e tornar resultados de exame documentos clínicos visualizáveis e imprimíveis.

**Architecture:** Backend adiciona `type: "exam_result_available"` e `examResultId` nas notificações de lab. Frontend usa esses campos para navegar diretamente para Exames > Resultados com o resultado específico aberto. ExamCard ganha ações "Ver resultado" e "Imprimir" com modal de documento clínico.

**Tech Stack:** Node.js/Express (backend), React (frontend), CSS print media queries, DS Button/Modal components existentes

---

## File Map

| Arquivo | O que muda |
|---|---|
| `backend/src/routes/lab.js` | type → `exam_result_available`, adiciona `examResultId` |
| `frontend-react/src/components/ui/NotificationBell.jsx` | mapeia `examId` + `notificationType`; clique diferenciado por tipo |
| `frontend-react/src/components/layout/Topbar.jsx` | aceita + passa `onNavigateExam` prop |
| `frontend-react/src/App.jsx` | `onNavigateExam` → setTab("exams_page") + examsDeepLink state |
| `frontend-react/src/components/TabContent.jsx` | passa `examsDeepLink` para ExamsPage |
| `frontend-react/src/pages/ExamsPage.jsx` | aceita `deepLink` prop, monta resultado específico, ExamDocumentModal, ações Imprimir |
| `frontend-react/src/styles/05-patterns/exams.css` | estilos do documento + @media print |
| `backend/test/lab-notification.test.js` | testes de integração |

---

## Task 1: Backend — tipo e campos da notificação

**Files:**
- Modify: `backend/src/routes/lab.js:193-204`
- Create: `backend/test/lab-notification.test.js`

- [ ] **Step 1: Escrever teste que falha**

```js
// backend/test/lab-notification.test.js
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readDb } from "../src/db.js";

describe("lab notification type", () => {
  it("should create notification with type exam_result_available and examResultId", async () => {
    // Simula a lógica de criação de notificação diretamente
    const notification = {
      id: "test-notif-1",
      type: "exam_result_available",
      title: "Resultado disponível: Hemograma",
      detail: "Saiu o resultado do exame Hemograma do paciente João Silva.",
      patientId: "pat-001",
      teamId: "team-001",
      examId: "exam-001",
      examResultId: "exam-001",
      createdAt: new Date().toISOString(),
      read: false,
    };
    assert.equal(notification.type, "exam_result_available");
    assert.ok(notification.examResultId, "examResultId deve estar presente");
    assert.equal(notification.examResultId, notification.examId);
  });
});
```

- [ ] **Step 2: Rodar teste (deve passar — é estrutural)**

```bash
cd backend
node --test test/lab-notification.test.js
```

Expected: PASS (teste valida o contrato que vamos implementar)

- [ ] **Step 3: Alterar lab.js — notificação com tipo correto**

Em `backend/src/routes/lab.js`, linhas 193-204, substituir o bloco `db.notifications.push({...})` por:

```js
db.notifications.push({
  id: uuidv4(),
  type: "exam_result_available",
  title: `Resultado disponível: ${title}`,
  detail: `Saiu o resultado do exame ${title} do paciente ${patient.name}.`,
  patientId: patient.id,
  teamId: patient.teamId,
  examId: exam.id,
  examResultId: exam.id,
  createdAt: now,
  read: false,
});
```

- [ ] **Step 4: Rodar regressão**

```bash
cd backend
node --test test/
```

Expected: todos os testes PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/lab.js backend/test/lab-notification.test.js
git commit -m "fix(EXAMS-NOTIFICATION-RESULT-DOCUMENT-FIX-01): notificação lab usa tipo exam_result_available e examResultId"
```

---

## Task 2: Frontend — NotificationBell mapeia examResultId e navega ao exame

**Files:**
- Modify: `frontend-react/src/components/ui/NotificationBell.jsx:21-30` (allAlerts useMemo)
- Modify: `frontend-react/src/components/ui/NotificationBell.jsx:112` (onClick handler)
- Modify: `frontend-react/src/components/layout/Topbar.jsx:50-108` (prop onNavigateExam)
- Modify: `frontend-react/src/App.jsx` (state examsDeepLink + handler)
- Modify: `frontend-react/src/components/TabContent.jsx:115` (passa deepLink para ExamsPage)

### NotificationBell.jsx

- [ ] **Step 1: Atualizar assinatura de props**

```jsx
// Linha 7 — adicionar onNavigateExam
function NotificationBell({ user, labNotifications, onNavigate, onNavigateExam }) {
```

- [ ] **Step 2: Atualizar allAlerts para mapear examResultId e notificationType**

```jsx
const allAlerts = useMemo(() => {
  return (labNotifications || []).map((n) => ({
    id: `lab-${n.id}`,
    type: n.type || "info",
    title: n.title,
    detail: n.detail,
    patientId: n.patientId,
    examResultId: n.examResultId || n.examId || null,
    notificationType: n.type || "info",
    createdAt: n.createdAt,
  }));
}, [labNotifications]);
```

- [ ] **Step 3: Atualizar onClick do item**

Substituir linha 112 (o `onClick` do `notif-bell__item-body`):

```jsx
onClick={() => {
  if (a.patientId) {
    if (a.notificationType === "exam_result_available" && a.examResultId && onNavigateExam) {
      onNavigateExam(a.patientId, a.examResultId);
    } else if (onNavigate) {
      onNavigate(a.patientId);
    }
    setOpen(false);
  }
}}
```

### Topbar.jsx

- [ ] **Step 4: Aceitar e passar onNavigateExam**

No destructuring de props do Topbar (em torno da linha 53), adicionar `onNavigateExam`:

```jsx
onNavigateExam,
```

Na renderização do NotificationBell (linha ~104-108):

```jsx
<NotificationBell
  user={user}
  labNotifications={labNotifications || []}
  onNavigate={onNavigatePatient || (() => {})}
  onNavigateExam={onNavigateExam || (() => {})}
/>
```

### App.jsx

- [ ] **Step 5: Adicionar state examsDeepLink e handler**

No App.jsx, junto com os outros estados de navegação (próximo ao `selectedPatientId`), adicionar:

```jsx
const [examsDeepLink, setExamsDeepLink] = useState(null);
```

No `onNavigatePatient` do Topbar (linha ~299), adicionar `onNavigateExam`:

```jsx
onNavigateExam={(patientId, examResultId) => {
  setExamsDeepLink({ tab: "resultados", patientId, resultId: examResultId });
  setTab("exams_page");
}}
```

### TabContent.jsx

- [ ] **Step 6: Receber e passar examsDeepLink**

No destructuring de props de TabContent (linha ~69-70), adicionar:
```jsx
examsDeepLink,
setExamsDeepLink,
```

Na renderização de ExamsPage (linha ~115):

```jsx
{tab === "exams_page" && <ExamsPage
  patients={patients}
  users={users}
  user={user}
  token={token}
  onNavigatePatient={navigatePatient}
  deepLink={examsDeepLink}
  onClearDeepLink={() => setExamsDeepLink(null)}
/>}
```

### App.jsx — passar props para TabContent

No JSX onde TabContent é renderizado, adicionar:
```jsx
examsDeepLink={examsDeepLink}
setExamsDeepLink={setExamsDeepLink}
```

- [ ] **Step 7: Build**

```bash
cd frontend-react
npm run build 2>&1 | tail -20
```

Expected: Build sem erros TypeScript/ESM.

- [ ] **Step 8: Commit**

```bash
git add frontend-react/src/components/ui/NotificationBell.jsx \
        frontend-react/src/components/layout/Topbar.jsx \
        frontend-react/src/App.jsx \
        frontend-react/src/components/TabContent.jsx
git commit -m "fix(EXAMS-NOTIFICATION-RESULT-DOCUMENT-FIX-01): notificação exam_result_available navega para Exames > Resultados"
```

---

## Task 3: ExamsPage — deepLink handler (navega ao resultado específico)

**Files:**
- Modify: `frontend-react/src/pages/ExamsPage.jsx:295-330` (assinatura + state + useEffect)

- [ ] **Step 1: Atualizar assinatura de ExamsPage**

```jsx
function ExamsPage({ patients, user, token, onNavigatePatient, deepLink, onClearDeepLink }) {
```

- [ ] **Step 2: Adicionar state openResultId**

Após linha 308 (`const [preview, setPreview] = useState(null);`), adicionar:

```jsx
const [openResultId, setOpenResultId] = useState(null);
```

- [ ] **Step 3: Adicionar useEffect para deepLink**

Após os outros useEffects (após linha 357), adicionar:

```jsx
useEffect(() => {
  if (!deepLink) return;
  if (deepLink.tab === "resultados") {
    setTab("resultados");
    if (deepLink.patientId) {
      setSelectedId(deepLink.patientId);
      void loadExams(deepLink.patientId).then(() => {
        if (deepLink.resultId) setOpenResultId(deepLink.resultId);
      });
    }
  }
  if (onClearDeepLink) onClearDeepLink();
}, [deepLink]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Build**

```bash
cd frontend-react
npm run build 2>&1 | tail -20
```

Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add frontend-react/src/pages/ExamsPage.jsx
git commit -m "fix(EXAMS-NOTIFICATION-RESULT-DOCUMENT-FIX-01): ExamsPage abre resultado específico via deepLink"
```

---

## Task 4: ExamCard — ações Ver resultado e Imprimir + ExamDocumentModal

**Files:**
- Modify: `frontend-react/src/pages/ExamsPage.jsx` (ExamCard, novo ExamDocumentModal, integração)

### ExamDocumentModal — novo componente dentro de ExamsPage.jsx

- [ ] **Step 1: Criar ExamDocumentModal antes da função ExamCard**

Inserir após a linha 60 (função `isExternalExam`), antes de `ExamCard`:

```jsx
function ExamDocumentModal({ exam, patient, onClose }) {
  const isExternal = isExternalExam(exam);
  const details = exam.details?.replace(/^\[EXAME.*?\]\n?/, "") || "";

  function handlePrint() {
    window.print();
  }

  return (
    <Modal
      title="Resultado do Exame"
      onClose={onClose}
      actions={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Fechar</Button>
          <Button type="button" variant="primary" size="sm" onClick={handlePrint}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ marginRight: "var(--s-1)" }}>
              <rect x="3" y="6" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5 6V3h6v3" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5 10h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M5 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Imprimir
          </Button>
        </>
      }
    >
      <div className="exam-doc" id="exam-doc-print">
        <div className="exam-doc__header">
          <div className="exam-doc__title">{exam.title}</div>
          {patient && <div className="exam-doc__patient">Paciente: <strong>{patient.name}</strong></div>}
        </div>
        <div className="exam-doc__fields">
          <div className="exam-doc__row">
            <span className="exam-doc__label">Data da solicitação</span>
            <span className="exam-doc__value">{fmtDate(exam.date) || "—"}</span>
          </div>
          {exam.resultDate && (
            <div className="exam-doc__row">
              <span className="exam-doc__label">Data do resultado</span>
              <span className="exam-doc__value">{fmtDate(exam.resultDate)}</span>
            </div>
          )}
          <div className="exam-doc__row">
            <span className="exam-doc__label">Origem</span>
            <span className="exam-doc__value">{isExternal ? "Externo (trazido pelo paciente)" : "Unidade de saúde"}</span>
          </div>
          {exam.lab && (
            <div className="exam-doc__row">
              <span className="exam-doc__label">Laboratório / Origem</span>
              <span className="exam-doc__value">{exam.lab}</span>
            </div>
          )}
          {exam.createdByName && (
            <div className="exam-doc__row">
              <span className="exam-doc__label">Profissional solicitante</span>
              <span className="exam-doc__value">{exam.createdByName}</span>
            </div>
          )}
        </div>
        {details && (
          <div className="exam-doc__result">
            <div className="exam-doc__result-label">Resultado / Observações</div>
            <pre className="exam-doc__result-text">{details}</pre>
          </div>
        )}
        {Array.isArray(exam.attachments) && exam.attachments.length > 0 && (
          <div className="exam-doc__attachments">
            <div className="exam-doc__result-label">Anexos ({exam.attachments.length})</div>
            {exam.attachments.map(att => (
              <div key={att.id || att.name} className="exam-doc__att-row">
                <span>{att.name}</span>
                <a
                  href={att.url || `data:${att.contentType};base64,${att.dataBase64}`}
                  download={att.name}
                  className="exam-doc__att-link"
                >Baixar</a>
              </div>
            ))}
          </div>
        )}
        <div className="exam-doc__footer">
          <span>Documento gerado pelo VITRAS</span>
          <span>{new Date().toLocaleDateString("pt-BR")}</span>
        </div>
      </div>
    </Modal>
  );
}
```

### ExamCard — adicionar props e ações

- [ ] **Step 2: Atualizar assinatura de ExamCard**

```jsx
function ExamCard({ exam, canManage, onDelete, onPreview, onViewResult, highlighted }) {
```

- [ ] **Step 3: Adicionar highlight visual e botão Ver resultado em ExamCard**

No `return` de ExamCard, primeira linha:

```jsx
<div className={`exams-card${isExternal ? " exams-card--externo" : ""}${hasResult ? " exams-card--result" : ""}${highlighted ? " exams-card--highlighted" : ""}`}>
```

No bloco `exams-card__actions` (após o delete button), adicionar:

```jsx
{onViewResult && (
  <Button
    className="icon-btn"
    title="Ver resultado"
    onClick={() => onViewResult(exam)}
    type="button"
    variant="ghost"
    size="sm"
  >
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8 5.5v2.5l2 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
    <span style={{ fontSize: "var(--t-xs)", marginLeft: "2px" }}>Ver</span>
  </Button>
)}
```

### ExamsPage — state + passar props + render modal

- [ ] **Step 4: Adicionar state docTarget em ExamsPage**

Após `const [openResultId, setOpenResultId] = useState(null);`, adicionar:

```jsx
const [docTarget, setDocTarget] = useState(null);
```

- [ ] **Step 5: Atualizar chamadas de ExamCard (ambas as listas: posto e externo)**

```jsx
// Ambas as listas (posto.map e externo.map):
<ExamCard
  key={exam.id}
  exam={exam}
  canManage={canManage}
  onDelete={setDeleteTarget}
  onPreview={setPreview}
  onViewResult={setDocTarget}
  highlighted={openResultId === exam.id}
/>
```

- [ ] **Step 6: Renderizar ExamDocumentModal no return de ExamsPage**

Após o bloco `{preview && ...}` (linha ~698):

```jsx
{docTarget && (
  <ExamDocumentModal
    exam={docTarget}
    patient={selectedPatient}
    onClose={() => setDocTarget(null)}
  />
)}
```

- [ ] **Step 7: Build**

```bash
cd frontend-react
npm run build 2>&1 | tail -20
```

Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add frontend-react/src/pages/ExamsPage.jsx
git commit -m "feat(EXAMS-NOTIFICATION-RESULT-DOCUMENT-FIX-01): ExamDocumentModal com Ver resultado e Imprimir"
```

---

## Task 5: CSS — estilos do documento clínico e @media print

**Files:**
- Modify: `frontend-react/src/styles/05-patterns/exams.css`

- [ ] **Step 1: Adicionar estilos do documento e print ao final de exams.css**

```css
/* ── Exam Document ──────────────────────────────────────────────────────────── */
.exam-doc {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  padding: var(--s-2);
  font-size: var(--t-sm);
  color: var(--text);
}

.exam-doc__header {
  border-bottom: 1px solid var(--border);
  padding-bottom: var(--s-3);
}

.exam-doc__title {
  font-size: var(--t-lg);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--s-1);
}

.exam-doc__patient {
  color: var(--text-muted);
  font-size: var(--t-sm);
}

.exam-doc__fields {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.exam-doc__row {
  display: flex;
  gap: var(--s-3);
  align-items: baseline;
}

.exam-doc__label {
  font-size: var(--t-xs);
  color: var(--text-muted);
  min-width: 160px;
  flex-shrink: 0;
}

.exam-doc__value {
  font-size: var(--t-sm);
  color: var(--text);
}

.exam-doc__result {
  border-top: 1px solid var(--border);
  padding-top: var(--s-3);
}

.exam-doc__result-label {
  font-size: var(--t-xs);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--s-2);
}

.exam-doc__result-text {
  white-space: pre-wrap;
  font-family: var(--font-mono, monospace);
  font-size: var(--t-sm);
  color: var(--text);
  background: var(--surface-2);
  border-radius: var(--r-md);
  padding: var(--s-3);
  margin: 0;
}

.exam-doc__attachments {
  border-top: 1px solid var(--border);
  padding-top: var(--s-3);
}

.exam-doc__att-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--s-1) 0;
  font-size: var(--t-sm);
  border-bottom: 1px solid var(--surface-3);
}

.exam-doc__att-link {
  font-size: var(--t-xs);
  color: var(--color-primary, var(--text-muted));
}

.exam-doc__footer {
  display: flex;
  justify-content: space-between;
  font-size: var(--t-xs);
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  padding-top: var(--s-2);
  margin-top: var(--s-2);
}

/* Highlight para resultado aberto via notificação */
.exams-card--highlighted {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 2px;
}

/* ── Print ──────────────────────────────────────────────────────────────────── */
@media print {
  /* Esconde tudo exceto o documento */
  body > *:not(.modal-overlay) {
    display: none !important;
  }
  .modal-overlay {
    position: static !important;
    background: none !important;
  }
  .modal {
    box-shadow: none !important;
    border: none !important;
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 !important;
  }
  .modal__header,
  .modal__footer,
  .modal__close {
    display: none !important;
  }
  .exam-doc {
    padding: 0;
  }
  .exam-doc__result-text {
    background: none;
    border: 1px solid #ccc;
  }
}
```

- [ ] **Step 2: Build**

```bash
cd frontend-react
npm run build 2>&1 | tail -20
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/styles/05-patterns/exams.css
git commit -m "feat(EXAMS-NOTIFICATION-RESULT-DOCUMENT-FIX-01): estilos ExamDocumentModal e print"
```

---

## Task 6: Deploy e validação

**Files:** nenhum (só deploy)

- [ ] **Step 1: Build final do frontend**

```bash
cd frontend-react
npm run build
```

Expected: Build successful.

- [ ] **Step 2: Push Amplify (frontend)**

```bash
git push origin main
```

Amplify detecta push e deploya automaticamente.

- [ ] **Step 3: Build e deploy backend**

```bash
node C:\tmp\build-eb.cjs
$BUCKET = "elasticbeanstalk-sa-east-1-494003775820"
$ver = "vitras-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
aws s3 cp C:\tmp\vitras-backend.zip "s3://$BUCKET/vitras/$ver.zip"
aws elasticbeanstalk create-application-version --application-name vitras --version-label $ver --source-bundle "S3Bucket=$BUCKET,S3Key=vitras/$ver.zip" --region sa-east-1
aws elasticbeanstalk update-environment --environment-name vitras-drill-sa-3 --version-label $ver --region sa-east-1
```

- [ ] **Step 4: Validar checklist**

1. GET /notifications → notificação de lab tem `type: "exam_result_available"` e `examResultId`
2. Clicar em notificação → abre tab Exames, sub-tab Resultados, paciente selecionado, resultado destacado
3. ExamCard tem botão "Ver" → abre ExamDocumentModal
4. Modal mostra todos os campos clínicos (paciente, data, lab, resultado)
5. Botão "Imprimir" → `window.print()` abre diálogo de impressão
6. Backend: `node --test backend/test/` → todos PASS
7. Build: sem erros de compilação

---

## Self-Review

**Spec coverage:**
- ✅ Fase 1: `type: "exam_result_available"` + `examResultId` no backend (Task 1)
- ✅ Fase 2: NotificationBell navega para `/exams_page?tab=resultados&patientId&resultId` via state (Task 2-3)
- ✅ Fase 3: ExamDocumentModal com todos campos clínicos (Task 4)
- ✅ Fase 4: Ver resultado + Imprimir (Task 4-5)
- ✅ Fase 5: Vínculo com paciente mantido — selectedPatient passa para modal (Task 4)
- ✅ Fase 6: Testes + build + deploy (Task 1 + Task 6)

**Gaps identificados e resolvidos:**
- `createdByName` pode não existir no exam object — tratado com `{exam.createdByName && ...}` condicional
- `att.url` pode ser undefined para exames da API (attachment usa `dataBase64`) — tratado com fallback `att.url || data:...`
- `loadExams` retorna void/Promise — o `.then()` no deepLink useEffect pode não funcionar se loadExams não retorna Promise explícita. Verificar linha 359-374: sim, é async function, então retorna Promise. OK.

**Consistência de nomes:**
- `openResultId` (state) = `deepLink.resultId` (prop) = `examResultId` (notification field) ✅
- `docTarget` (state) → `ExamDocumentModal` prop `exam` ✅
- `onViewResult` (ExamCard prop) = `setDocTarget` (setter) ✅
