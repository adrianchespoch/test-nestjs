#!/usr/bin/env bash
# Smoke test post-deploy. Ejercita endpoints críticos sin estado.
# Falla con exit 1 si algo no responde 2xx esperado.
#
# Uso: ./scripts/smoke.sh <base-url>

set -euo pipefail

BASE="${1:?base URL required}"
BASE="${BASE%/}"

ok() { printf "  ✓ %s\n" "$1"; }
fail() { printf "  ✗ %s — %s\n" "$1" "${2:-}"; exit 1; }

echo "[smoke] $BASE"

# ----- /api/health/live -----
status=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/health/live")
[ "$status" = "200" ] || fail "health/live" "got $status"
ok "GET /api/health/live → 200"

# ----- /api/health/ready -----
body=$(curl -sS "$BASE/api/health/ready" -w "\n%{http_code}")
status="${body##*$'\n'}"
[ "$status" = "200" ] || fail "health/ready" "got $status"
ok "GET /api/health/ready → 200"

# ----- /api/docs (Swagger UI) -----
status=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/docs")
[ "$status" = "200" ] || fail "swagger docs" "got $status"
ok "GET /api/docs → 200"

# ----- /api/auth/login con cuerpo inválido (esperamos 400) -----
status=$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'content-type: application/json' \
  -X POST "$BASE/api/auth/login" \
  --data '{}')
[ "$status" = "400" ] || fail "auth/login validation" "got $status (esperado 400)"
ok "POST /api/auth/login (empty) → 400"

# ----- /api/auth/refresh sin cookie (esperamos 401) -----
status=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/refresh")
[ "$status" = "401" ] || fail "auth/refresh missing cookie" "got $status (esperado 401)"
ok "POST /api/auth/refresh (no cookie) → 401"

echo "[smoke] all checks passed"
