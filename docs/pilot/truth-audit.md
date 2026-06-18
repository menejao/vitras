# Truth Audit — M-05B-09

**Versão:** 1.0  
**Data:** 2026-06-18  
**Auditor:** Análise estática do repositório git + código fonte  
**Premissa:** "Quais funcionalidades aparentam estar prontas mas ainda não sobreviveram a uso real?"  
**Metodologia:** Sem filtro político. Sem maquiagem. Sem otimismo.

---

## 1. CDS Export — CRÍTICO

**Aparência:** A-04 PASS. FCI/FCD/FAI validados. M-05A concluído.  
**Realidade:** `cds-export.js` e `households.js` foram deletados do repositório git no commit `b562ec7` (343 arquivos deletados). `app.js` ainda importa ambos — backend **local não inicia**.

**Evidência direta:**
```
git ls-files backend/src/routes/
# cds-export.js → AUSENTE
# households.js → AUSENTE

# app.js linhas ~29-30:
import householdsRouter from "./routes/households.js";
import cdsExportRouter from "./routes/cds-export.js";
```

**O que isso significa:**
- CDS Export funciona apenas a partir dos deploy zips (`deploy8a-infra.zip`, `deploy7d-esus-fields.zip`)
- O repositório git está dessincronizado com a versão em produção
- Qualquer desenvolvedor que clonar o repositório e tentar iniciar o backend receberá `Cannot find module './routes/cds-export.js'`
- Não há como auditar, testar ou modificar o CDS Export sem acessar os zips de deploy

**Severidade:** Alta  
**Recomendação:** Restaurar os arquivos do git history:
```bash
git show 8adf5b1:backend/src/routes/cds-export.js > backend/src/routes/cds-export.js
git show ac90a93:backend/src/routes/households.js > backend/src/routes/households.js
git add backend/src/routes/cds-export.js backend/src/routes/households.js
git commit -m "restore: reintegrate cds-export and households routes to git"
```

---

## 2. Banco de Dados — Modo Dual Não Documentado

**Aparência:** Backend conecta ao PostgreSQL RDS.  
**Realidade:** Backend opera em dois modos distintos baseados na variável `DATABASE_URL`:
- `DATABASE_URL` presente → driver Postgres (produção, staging)
- `DATABASE_URL` ausente → driver arquivo JSON (`data/db.json`) (local, dev)

**O que isso significa:**
- `data/db.json` e `data/dev-db.json` existem e contêm dados reais/teste da execução local
- Comportamento de queries, transações e concorrência é completamente diferente entre modos
- Testes locais passando em modo JSON não garantem comportamento idêntico no Postgres
- Sem `DATABASE_URL`, o backend inicia com dados do arquivo — risco se arquivo contiver dados sensíveis

**Severidade:** Média  
**Recomendação:** Auditar se `data/db.json` contém dados sensíveis antes de qualquer compartilhamento. Documentar a dualidade de modos para desenvolvedores.

---

## 3. Capabilities — Risco de Onboarding Silencioso

**Aparência:** Agenda, farmácia e referrals funcionam por perfil.  
**Realidade:** Esses módulos são 100% capability-based. Sem a capability correta, o módulo simplesmente não aparece na UI — sem mensagem de erro.

**Evidência:**
```javascript
// App.jsx
const canUseAgenda = Boolean(
  token && user?.teamId &&
  (user?.capabilities?.includes("agenda.read") || user?.capabilities?.includes("agenda.write"))
);
```

**O que isso significa:**
- Se o admin cria um médico sem configurar `agenda.read` e `agenda.write`, o médico não verá o módulo de agenda
- O médico reportará "o sistema não tem agenda" — tecnicamente correto, mas a causa é configuração
- Sem um checklist de capabilities por perfil, onboarding de município pode deixar módulos inacessíveis

**Severidade:** Média  
**Recomendação:** Definir capabilities padrão por role no bootstrap de usuário. Documentar no go-live checklist (já incluído em item 2.03 e na tabela RBAC).

---

## 4. nursing_tech — Acesso Inconsistente

**Aparência:** nursing_tech pode criar registros clínicos.  
**Realidade:** `canWriteRecords(nursing_tech) = true` mas `CHART_ROLES = {doctor, dentist, nurse_manager}`. nursing_tech **cria** mas não **visualiza** o prontuário completo (ChartPage).

**Evidência:**
```javascript
// roles.js
export function canWriteRecords(user) {
  return ["nurse_manager", "doctor", "dentist", "nursing_tech", "acs"].includes(roleValue(user))
    || hasCapability(user, "records.write");
}

// medical-records.js
const CHART_ROLES = new Set(["doctor", "dentist", "nurse_manager"]);
```

**Severidade:** Baixa (workaround disponível — RecordsPage)  
**Recomendação:** Documentar no treinamento. Avaliar se nursing_tech precisa do ChartPage no contexto clínico do piloto.

---

## 5. Validação de CNS — Fraqueza de Dados

**Aparência:** Campo CNS disponível no cadastro de paciente.  
**Realidade:** Não há evidência de validação de dígito verificador do CNS no frontend. Um CNS inválido pode ser salvo silenciosamente e causar rejeição na importação PEC.

**O que isso significa:**
- Profissional digita CNS errado (erro de transcrição) → PEC rejeita a ficha
- Erro só é detectado no momento da homologação — tarde demais
- No-flow de feedback para o usuário

**Severidade:** Média  
**Recomendação:** Adicionar validação de DV do CNS no `PatientModal.jsx` (algoritmo público). Baixo esforço, alto impacto na qualidade dos dados.

---

## 6. Módulo de IA — Produção vs. Desenvolvimento

**Aparência:** AiTab presente, canAccessAI(user) retorna true para doctor/nurse/dentist.  
**Realidade:** O módulo AI usa `backend/src/ai.js` e uma rota `/ai`. A robustez em produção — rate limits, timeouts, fallbacks — não foi auditada nesta análise.

**Severidade:** Baixa (módulo não é crítico para piloto clínico)  
**Recomendação:** Desativar ou esconder módulo de IA no piloto se não for feature central. Evita suporte para funcionalidade ainda não validada.

---

## 7. Service Worker — Offline Mode Não Testado em Campo

**Aparência:** SW registrado via `registerServiceWorker()`.  
**Realidade:** Conectividade instável é risco P2 (R-13 no risk register). O comportamento offline real — quais dados ficam em cache, o que acontece com submissões durante offline — não tem evidência de teste em condições reais de UBS.

**Severidade:** Média  
**Recomendação:** Testar SW explicitamente antes do go-live: desconectar internet → verificar que app carrega → reconectar → verificar sincronização. Documentar resultado no go-live checklist.

---

## 8. Idle Timeout — Comportamento Controlado por ENV

**Aparência:** Idle logout ativo para sessões autenticadas.  
**Realidade:**
```javascript
const idleLogoutEnabled = import.meta.env.VITE_IDLE_LOGOUT_ENABLED !== "false";
```
Se a variável não estiver definida no build de produção, idle logout **está ativo** (padrão). Se estiver `"false"`, **desativado**. Comportamento depende da variável no momento do build.

**Severidade:** Baixa  
**Recomendação:** Confirmar `VITE_IDLE_LOGOUT_ENABLED` no build de produção. Para piloto, manter ativo por segurança.

---

## 9. CNPJ do Controlador — Placeholder Ativo

**Aparência:** Política de privacidade publicada em vitras.com.br/privacidade.  
**Realidade:** CNPJ do controlador (Município) está como placeholder na política. Texto genérico sem CNPJ real.

**Severidade:** Média (LGPD)  
**Recomendação:** Inserir CNPJ real do município piloto antes do go-live em produção. Pode ser parametrizado por instância ou atualizado manualmente na política.

---

## 10. Deploy Zip vs. Git — Dessincronia Estrutural

**Aparência:** Repositório git é a fonte da verdade.  
**Realidade:** Existem múltiplos zips de deploy (`deploy7d-esus-fields.zip`, `deploy8a-infra.zip`, `vitras-pilot-baseline.zip`) que contêm código diferente do HEAD do git. A versão em produção no EB não é rastreável pelo git atual.

**O que isso significa:**
- Impossível saber exatamente o que está rodando em produção sem abrir o zip
- Rollback para versão anterior requer o zip, não o git
- Novos desenvolvedores não conseguem reproduzir o ambiente de produção localmente

**Severidade:** Alta (operacional/manutenção)  
**Recomendação:** Integrar o código dos zips ao git. Criar um processo de CI/CD que garanta git = deploy. Este é o pré-requisito para escalar além do piloto.

---

## Resumo

| # | Item | Severidade | Status |
|---|------|-----------|--------|
| 1 | cds-export.js / households.js deletados do git | Alta | RESOLVIDO — commit 3e56d4c |
| 2 | Modo dual DB (JSON/Postgres) não documentado | Média | ABERTO |
| 3 | Capabilities não configuradas silenciosamente | Média | ABERTO |
| 4 | nursing_tech: cria mas não vê prontuário | Baixa | ABERTO |
| 5 | CNS sem validação de dígito verificador | Média | ABERTO |
| 6 | IA em produção — robustez não auditada | Baixa | MONITORAR |
| 7 | Service worker não testado em condições reais | Média | ABERTO |
| 8 | Idle timeout controlado por ENV de build | Baixa | VERIFICAR |
| 9 | CNPJ placeholder na política de privacidade | Média | ABERTO |
| 10 | Deploy zips desalinhados com git HEAD | Alta | ABERTO |

**Itens bloqueantes antes do piloto:** #3 (capabilities no onboarding), #9 (CNPJ antes de uso em produção com dados reais).  
**Resolvido:** #1 restaurado em commit 3e56d4c — backend local inicia, 17/17 checks B-01 PASS.

---

*VITRAS APS — docs/pilot/truth-audit.md*
