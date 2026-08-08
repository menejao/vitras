# Console Nacional — Arquitetura v1.0

**Freeze:** 2026-08-08

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js + Express (ESM) |
| Frontend | React + Vite |
| DB | JSON file (`data/db.json`) via `withDb()` / `readDb()` |
| Auth | JWT + cookie CSRF |
| Deploy backend | Render (git push → deploy automático) |
| Deploy frontend | Vercel (git push → deploy automático) |
| DB produção | Neon PostgreSQL (migrations 001–033) |

---

## Estrutura de arquivos — Console Nacional

```
backend/
  src/
    routes/
      platform.js          ← 121 endpoints, ~5000 linhas
    services/
      release.js           ← ERP-07
      backup.js            ← ERP-08
      governance.js        ← ERP-09
      cmdb.js              ← ERP-10
  test/
    platform-municipalities.test.mjs
    platform-deployments.test.mjs
    platform-licenses.test.mjs
    platform-incidents.test.mjs
    platform-observability.test.mjs
    platform-releases.test.mjs    ← 45 tests
    platform-backup.test.mjs      ← 45 tests
    platform-governance.test.mjs  ← 55 tests
    platform-cmdb.test.mjs        ← 55 tests

frontend-react/
  src/pages/
    PlatformConsolePage.jsx  ← Console Nacional completo (~6000 linhas)
```

---

## Padrões arquiteturais

### DB mutations
```javascript
const result = await withDb((db) => {
  ensureXxx(db);     // lazy-init das coleções
  // mutações
  addAuditLog(...);  // sempre auditado
  return { entity };
});
```

### DB reads
```javascript
const db = await readDb();
ensureXxx(db);
// filtros, paginação, retorno
```

### RBAC em cada handler
```javascript
if (!hasCapability(req.user, "platform.unit.read"))
  return res.status(403).json({ error: "Sem permissão" });
```

### Audit chain
```javascript
addAuditLog(db, req.user, "action.verb", "entity_type", entity.id, { detail });
```

### Sequência de código
```javascript
const code = nextSeq(db.collection, "PREFIX");  // PREFIX-YYYY-NNNN
```

---

## Fronteiras de isolamento clínico

O Console Nacional opera em namespace completamente separado do sistema clínico:

- Rotas: `/api/platform/*` (Console) vs `/api/patients/*`, `/api/visits/*`, etc. (clínico)
- Serviços: `release.js`, `backup.js`, `governance.js`, `cmdb.js` não importam serviços clínicos
- DB: coleções ERP nunca leem `patients`, `acsVisits`, `familyGroups`, `households`
- Frontend: `PlatformConsolePage.jsx` não importa componentes clínicos

---

## Deploy pipeline

```
git push origin HEAD:main
  → Render: backend rebuild + restart (automático)
  → Vercel: frontend rebuild + deploy (automático)
```

Sem staging intermediário. Branch atual: `claude/vitras-p0-blockers-497suw`.  
Para produção: PR → merge em `main`.

---

## Limitações conhecidas (não-blockers)

- `platform.js` tem ~5000 linhas — candidato a split por módulo em sprint futuro (não-prioritário).
- `PlatformConsolePage.jsx` tem ~6000 linhas — candidato a code splitting.
- Bundle `index.js` > 500 KB (aviso de build) — maplibre-gl é o maior contribuidor.
- JSON file DB é suficiente para demo; migração para Postgres real é IMPLANT-01 (feito para dados clínicos, pendente para coleções ERP).
