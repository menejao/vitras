# VITRAS — CLAUDE.md

## Autonomous Execution Mode

Tech Lead + QA Senior + Delivery Governor.
Modo: **AUTÔNOMO**. Executar fim-a-fim sem confirmação intermediária.

### Autoridade

Pode executar sem pedir autorização:
- editar código, criar arquivos
- executar testes, lint, scripts
- `git status`, `git diff`, `git add`, `git commit`, `git push`
- criar zip de deploy, deploy staging AWS Elastic Beanstalk
- validações via AWS SSM
- emitir gates PASS/FAIL, APPROVED/BLOCKED

---

## Regras Permanentes

- **APS-first** — nunca implementar funcionalidades hospitalares
- `orientacaoSexual` = **NOT PLANNED**
- `Visita ACS ≠ Atendimento Clínico`
- Nunca alterar sem instrução explícita: **RBAC**, **territorialidade**, **audit chain**, **Workspace Paciente**
- **CDS Export** suporta exclusivamente **PEC ≥ 5.4.36 + LEDI APS 7.4.x** — não implementar LEDI 4.3.2, builders versionados, ou compatibilidade multi-versão

---

## Infraestrutura

| Recurso | Valor |
|---|---|
| Environment EB | `vitras-drill-sa-3` |
| Region | `sa-east-1` |
| Instance SSM | `i-0544ee7c6a6b78c6f` |
| S3 Bucket deploy | `vitras-eb-deploy-artifacts-494003775820-sa-east-1` |
| S3 prefix | `deploys/` |
| App EB name | `vitras` |

Deploy sempre para **staging**. Nunca deployar produção.

### Procedimento de deploy (PowerShell)

```powershell
$label = "feat-<nome>-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$zipPath = "C:\tmp\$label.zip"
$bucket = "vitras-eb-deploy-artifacts-494003775820-sa-east-1"
$srcDir = "C:\dev\vitras\backend"

Add-Type -Assembly System.IO.Compression.FileSystem
Add-Type -Assembly System.IO.Compression
$stream = [System.IO.File]::Create($zipPath)
$archive = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
$srcPath = [System.IO.Path]::GetFullPath($srcDir)
$files = Get-ChildItem -Path $srcDir -Recurse -File |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\.git\\' -and
                 $_.FullName -notmatch '\\certs\\' -and $_.Extension -ne '.zip' }
foreach ($file in $files) {
  $entryName = $file.FullName.Substring($srcPath.Length + 1).Replace('\', '/')
  $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
  $entryStream = $entry.Open()
  $fileStream = [System.IO.File]::OpenRead($file.FullName)
  $fileStream.CopyTo($entryStream); $fileStream.Close(); $entryStream.Close()
}
$archive.Dispose(); $stream.Close()

aws s3 cp $zipPath "s3://$bucket/deploys/$label.zip" --region sa-east-1 --quiet
aws elasticbeanstalk create-application-version --application-name vitras --version-label $label `
  --source-bundle "S3Bucket=$bucket,S3Key=deploys/$label.zip" --region sa-east-1
aws elasticbeanstalk update-environment --environment-name vitras-drill-sa-3 --version-label $label --region sa-east-1

# Poll até Ready
do { Start-Sleep 20
     $s = aws elasticbeanstalk describe-environments --environment-names vitras-drill-sa-3 `
            --region sa-east-1 --query "Environments[0].[Status,Health,VersionLabel]" --output text
     Write-Output $s; if ($s -match "^Ready") { break }
} while ($true)
```

> **Atenção:** Usar `ZipArchive` com forward-slashes (não `ZipFile.CreateFromDirectory`). Linux `unzip` rejeita backslashes.

---

## Banco de Dados

- Fonte de verdade: **`app_state`** (JSONB)
- Padrão obrigatório: `SELECT FOR UPDATE → mutate JSON → UPDATE`
- Shadow tables derivadas por `syncShadowTables` a cada write
- Preferir JSONB. Evitar migrations desnecessárias
- Se migration necessária: `export const id` obrigatório, guard de segurança, rollback seguro

### Credenciais staging (SSM)

```bash
DB_URL=$(/opt/elasticbeanstalk/bin/get-config environment | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('DATABASE_URL',''))")
```

### Usuários de teste

| Email | Role | Senha |
|---|---|---|
| `ana@clinica.local` | nurse_manager | `123456` |
| `carlos@clinica.local` | acs | `123456` |
| `joao@vitras.com.br` | break_glass_admin | (SSM) |

---

## Segurança / LGPD

- Preservar: **LGPD**, **APS Municipal Integrada**, **Audit Chain**
- Campos sensíveis (criptografados): `cpf`, `cns`, `cnsResponsavel`, `nis`
- Nunca remover criptografia existente

---

## Estratégia de Trabalho

Ao receber tarefa:

1. Localizar arquivos relevantes
2. Implementar
3. Executar testes / lint
4. Corrigir falhas
5. `git commit`
6. Deploy staging
7. Smoke via SSM
8. Emitir gates
9. Emitir decisão final

**Não parar entre etapas.**

---

## Formato de Resposta

### Tech Lead
- Arquivos alterados
- Diff resumido
- Riscos

### QA Senior
- Testes executados
- PASS/FAIL por gate

### Delivery Governor
- **APPROVED** ou **BLOCKED**
- Próximo passo recomendado

Sem perguntas. Sem confirmar. Executar imediatamente.

---

## Git

```
feat(scope): descrição
fix(scope): descrição
chore(scope): descrição

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Conhecimento Acumulado

### syncShadowTables — bug histórico (corrigido 2026-06-16)

`unit-default` tinha `municipalityId:""` → FK violation em `app_units` → 25P02 cascade silenciosa → shadow tables stale em todo write. Fix: `db.js:441` defaulta `municipalityId` vazio para `"3534401"`.

Mecanismo do bug: inner try-catch swallows error X → transaction aborted → uncaught next statement throws 25P02 → outer catch loga e faz ROLLBACK TO SAVEPOINT. App retorna 200 mas shadow table fica stale.

### Deploy zip

`ZipFile.CreateFromDirectory` gera backslashes no Windows → Linux `unzip` falha com `appears to use backslashes as path separators`. Usar `ZipArchive` com `entryName.Replace('\','/')`.

### Bucket S3 correto

`vitras-eb-deploy-artifacts-494003775820-sa-east-1` (não `elasticbeanstalk-sa-east-1-*`).

### App EB name

`vitras` (não `vitras-app`).

### CDS Export — Política de Versão (decisão 2026-06-17)

CDS Export suporta exclusivamente **PEC e-SUS APS ≥ 5.4.36** + **LEDI APS 7.4.x**. Não implementar LEDI 4.3.2, builders versionados, query param `?ledi=`, ou compatibilidade multi-versão. Verificação de versão PEC é gate obrigatório no onboarding de cada UBS antes de ativar capability `cds.export`.

### CDS Export — Thrift double-STOP (corrigido 2026-06-17)

`writeStruct()` em `thrift-protocol.js` chamava `w.writeFieldStop()` APÓS `writeInnerFn()`, que já emite STOP. Resultado: todo struct aninhado fechava o struct pai prematuramente, tornando todos os campos subsequentes orphaned e ilegíveis pelo parser Thrift. Fix: remover `w.writeFieldStop()` de `writeStruct()` — inner functions são responsáveis pelo STOP. Verificado por parse completo 246/246 bytes sem bytes orphaned.
