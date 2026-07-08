#!/usr/bin/env bash
# =============================================================================
# VITRAS — Migração de dados EB (RDS) → Neon
# =============================================================================
# Uso:
#   SOURCE_URL="postgres://..." TARGET_URL="postgres://..." bash scripts/neon-migrate.sh
#
# Pré-requisitos: pg_dump e pg_restore instalados (postgres-client)
#   Ubuntu/Debian: sudo apt install postgresql-client
#   Mac:           brew install libpq && brew link --force libpq
# =============================================================================

set -euo pipefail

SOURCE_URL="${SOURCE_URL:-}"
TARGET_URL="${TARGET_URL:-}"

if [[ -z "$SOURCE_URL" || -z "$TARGET_URL" ]]; then
  echo "Erro: SOURCE_URL e TARGET_URL devem estar definidos."
  echo "Exemplo:"
  echo "  SOURCE_URL=\"postgres://user:pass@rds-host:5432/vitras\" \\"
  echo "  TARGET_URL=\"postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require\" \\"
  echo "  bash scripts/neon-migrate.sh"
  exit 1
fi

DUMP_FILE="/tmp/vitras-migration-$(date +%Y%m%d_%H%M%S).dump"

echo "[1/4] Exportando banco atual (pg_dump formato custom)..."
pg_dump \
  --no-owner \
  --no-acl \
  --format=custom \
  --verbose \
  "$SOURCE_URL" \
  --file="$DUMP_FILE"

echo "[2/4] Dump salvo em: $DUMP_FILE ($(du -sh "$DUMP_FILE" | cut -f1))"

echo "[3/4] Importando no Neon (pg_restore)..."
pg_restore \
  --no-owner \
  --no-acl \
  --verbose \
  --dbname="$TARGET_URL" \
  "$DUMP_FILE"

echo "[4/4] Migração concluída."
echo ""
echo "Próximos passos:"
echo "  1. Verificar tabelas no Neon Console"
echo "  2. Executar: psql \"\$TARGET_URL\" -c 'SELECT COUNT(*) FROM app_state'"
echo "  3. Verificar migrations: psql \"\$TARGET_URL\" -c 'SELECT id FROM schema_migrations ORDER BY applied_at'"
echo "  4. Configurar DATABASE_URL no Render com a URL do Neon"
echo ""
echo "Arquivo de dump preservado em: $DUMP_FILE"
echo "Remover após validação: rm $DUMP_FILE"
