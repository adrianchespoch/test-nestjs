#!/usr/bin/env bash
# Deploy script — referencia. Adáptalo a tu orquestador (k8s, ECS, Fly, etc.).
#
# Uso: ./scripts/deploy.sh <env> <image>
#
# Sigue el patrón Expand-Migrate-Contract:
#   1) Aplicar migrations en init container / job aparte (NO en runtime).
#   2) Esperar éxito.
#   3) Rollout incremental del deployment.
#   4) Smoke test post-deploy.
#   5) Si smoke falla → rollout undo automático.
#
# Ver AGENTS/prod/04-incident-runbook.md para el flujo de rollback.
set -euo pipefail

ENV="${1:?env required (staging|production)}"
IMAGE="${2:?image (registry/name:sha) required}"

echo "[deploy] env=$ENV image=$IMAGE"

# ----- 1. Migrations -----
echo "[deploy] applying migrations..."
# Ejemplo k8s:
#   kubectl apply -f k8s/migrate-job.yaml
#   kubectl wait --for=condition=complete --timeout=10m job/migrate
# Ejemplo manual desde el host del ambiente:
#   DATABASE_URL=$(...) pnpm prisma migrate deploy

# ----- 2. Rollout -----
echo "[deploy] rolling out app..."
# Ejemplo k8s:
#   kubectl set image deployment/api api="$IMAGE" -n "$ENV"
#   kubectl rollout status deployment/api -n "$ENV" --timeout=10m

# ----- 3. Smoke -----
SMOKE_URL="${SMOKE_URL:-https://api.${ENV}.example.com}"
echo "[deploy] running smoke against $SMOKE_URL"
"$(dirname "$0")/smoke.sh" "$SMOKE_URL" || {
  echo "[deploy] SMOKE FAILED — initiating rollback"
  # kubectl rollout undo deployment/api -n "$ENV"
  exit 2
}

echo "[deploy] success"
