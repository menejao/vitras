# Import Validation — Verificação Pré-PEC do Arquivo .esus

**Versão:** 1.0  
**Data:** 2026-06-18  
**Objetivo:** verificar rapidamente o arquivo `.esus` gerado pelo VITRAS antes de submetê-lo ao PEC, sem depender do PEC estar disponível.

---

## 1. Validação Manual Rápida (sem ferramentas)

### 1.1 Verificar extensão e existência

O arquivo deve ter extensão `.esus`.  
Tamanho > 0 bytes.  
Se o arquivo estiver vazio ou a extensão for `.zip`, o export falhou silenciosamente — verificar logs.

### 1.2 Verificar que é um ZIP válido

O arquivo `.esus` é um ZIP renomeado.  
Windows: renomear para `.zip` → tentar abrir no Explorador.  
Se "Arquivo corrompido" → problema no export.

### 1.3 Estrutura esperada dentro do ZIP

```
lote-{uuid}.esus/
  headerTransport.json
  fichas/
    fci-{uuid}.json        ← Cadastro Individual (um por paciente)
    fcd-{uuid}.json        ← Cadastro Domiciliar (um por domicílio)
    fai-{uuid}.json        ← Atendimento Individual (um por atendimento)
```

Abrir o ZIP e confirmar que `headerTransport.json` existe e `fichas/` não está vazio.

---

## 2. Script PowerShell — Validação Automatizada

Salvar como `validate-esus.ps1` e executar localmente (não precisa de PEC):

```powershell
param(
    [Parameter(Mandatory=$true)]
    [string]$EsusFile
)

$ErrorActionPreference = "Stop"
$tempDir = Join-Path $env:TEMP "esus-validate-$(Get-Random)"

Write-Host "`n=== VITRAS — validacao .esus ===" -ForegroundColor Cyan
Write-Host "Arquivo: $EsusFile"
Write-Host "Tamanho: $((Get-Item $EsusFile).Length) bytes"

# 1. Extrair
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Copy-Item $EsusFile "$tempDir\lote.zip"
Expand-Archive "$tempDir\lote.zip" $tempDir -Force

# 2. headerTransport
$header = Get-Content "$tempDir\headerTransport.json" -Raw | ConvertFrom-Json
Write-Host "`n--- headerTransport ---"
Write-Host "CNES   : $($header.cnes)"
Write-Host "INE    : $($header.ine)"
Write-Host "Origem : $($header.origem)"
Write-Host "Versao : $($header.versaoLote)"
Write-Host "DataEnv: $($header.dataHoraEnvio)"

# 3. Fichas
$fichas = Get-ChildItem "$tempDir\fichas" -Filter "*.json"
$fci = ($fichas | Where-Object { $_.Name -like "fci*" }).Count
$fcd = ($fichas | Where-Object { $_.Name -like "fcd*" }).Count
$fai = ($fichas | Where-Object { $_.Name -like "fai*" }).Count
$total = $fichas.Count

Write-Host "`n--- Fichas ---"
Write-Host "FCI : $fci"
Write-Host "FCD : $fcd"
Write-Host "FAI : $fai"
Write-Host "Total: $total"

# 4. UUIDs duplicados
$uuids = $fichas | ForEach-Object { $_.BaseName -replace '^[a-z]+-', '' }
$dup = $uuids | Group-Object | Where-Object { $_.Count -gt 1 }
if ($dup) {
    Write-Host "`n[FAIL] UUIDs duplicados encontrados:" -ForegroundColor Red
    $dup | ForEach-Object { Write-Host "  $($_.Name)" }
} else {
    Write-Host "`n[PASS] Nenhum UUID duplicado" -ForegroundColor Green
}

# 5. Validações básicas
$issues = @()
if (-not $header.cnes) { $issues += "CNES ausente no headerTransport" }
if (-not $header.ine)  { $issues += "INE ausente no headerTransport" }
if ($total -eq 0)      { $issues += "Nenhuma ficha encontrada em fichas/" }

if ($issues.Count -eq 0) {
    Write-Host "`n[PASS] Arquivo valido para submissao ao PEC" -ForegroundColor Green
} else {
    Write-Host "`n[FAIL] Problemas encontrados:" -ForegroundColor Red
    $issues | ForEach-Object { Write-Host "  - $_" }
}

# Limpar
Remove-Item $tempDir -Recurse -Force
Write-Host "`n=== fim ===" -ForegroundColor Cyan
```

**Uso:**
```powershell
.\validate-esus.ps1 -EsusFile "C:\Downloads\vitras-export-20260618.esus"
```

---

## 3. Script Bash/Linux — Validação Automatizada

```bash
#!/usr/bin/env bash
set -euo pipefail

ESUS_FILE="${1:?Uso: ./validate-esus.sh arquivo.esus}"
TMP=$(mktemp -d)

echo ""
echo "=== VITRAS — validacao .esus ==="
echo "Arquivo : $ESUS_FILE"
echo "Tamanho : $(wc -c < "$ESUS_FILE") bytes"

# Extrair
cp "$ESUS_FILE" "$TMP/lote.zip"
unzip -q "$TMP/lote.zip" -d "$TMP"

# headerTransport
echo ""
echo "--- headerTransport ---"
python3 -c "
import json, sys
h = json.load(open('$TMP/headerTransport.json'))
print('CNES   :', h.get('cnes','AUSENTE'))
print('INE    :', h.get('ine','AUSENTE'))
print('Origem :', h.get('origem','AUSENTE'))
print('Versao :', h.get('versaoLote','AUSENTE'))
"

# Fichas
echo ""
echo "--- Fichas ---"
FCI=$(find "$TMP/fichas" -name "fci*.json" | wc -l)
FCD=$(find "$TMP/fichas" -name "fcd*.json" | wc -l)
FAI=$(find "$TMP/fichas" -name "fai*.json" | wc -l)
TOTAL=$(find "$TMP/fichas" -name "*.json" | wc -l)
echo "FCI   : $FCI"
echo "FCD   : $FCD"
echo "FAI   : $FAI"
echo "Total : $TOTAL"

# UUIDs
echo ""
DUPS=$(find "$TMP/fichas" -name "*.json" | xargs -I{} basename {} .json \
  | sed 's/^[a-z]*-//' | sort | uniq -d)
if [ -n "$DUPS" ]; then
    echo "[FAIL] UUIDs duplicados:"
    echo "$DUPS"
else
    echo "[PASS] Nenhum UUID duplicado"
fi

rm -rf "$TMP"
echo ""
echo "=== fim ==="
```

---

## 4. Checklist Manual Rápido (campo a campo)

| Verificação | Como checar | Esperado |
|-------------|-------------|---------|
| Arquivo existe | `ls -lh arquivo.esus` | Size > 0 |
| É ZIP válido | Renomear para .zip, abrir | Sem erro |
| headerTransport.json | Abrir no ZIP | Existe |
| fichas/ não vazia | Ver conteúdo da pasta | >= 1 JSON |
| CNES presente | Abrir headerTransport.json | String não vazia |
| INE presente | Abrir headerTransport.json | String não vazia |
| Origem = VITRAS | Abrir headerTransport.json | `"VITRAS"` |
| Sem UUIDs duplicados | Listar nomes de arquivo em fichas/ | Todos únicos |

---

## 5. Log de Validação

Preencher após cada export:

| Data | Arquivo | Tamanho | FCI | FCD | FAI | CNES OK | INE OK | UUID OK | Resultado |
|------|---------|---------|-----|-----|-----|---------|--------|---------|-----------|
| | | | | | | | | | |

---

*VITRAS APS — docs/homologacao/import-validation.md*
