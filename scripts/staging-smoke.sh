#!/usr/bin/env bash
# Smoke-test staging API endpoints (Phases 0–7). No device required.
set -euo pipefail

API_URL="${API_URL:-https://pingme.hostyler.cloud/v1}"

echo "=== Health ==="
curl -sf "$API_URL/health" | head -c 200
echo

echo "=== Admin login ==="
ADMIN_TOKEN=$(curl -sf -X POST "$API_URL/admin/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@pingme.test","password":"AdminPass123!"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))")
if [ -z "$ADMIN_TOKEN" ]; then echo "FAIL: admin login"; exit 1; fi
echo "Admin token OK (${#ADMIN_TOKEN} chars)"

echo "=== Dashboard stats ==="
curl -sf -H "Authorization: Bearer $ADMIN_TOKEN" "$API_URL/admin/dashboard/stats" | head -c 120
echo

echo "=== User login ==="
USER_RESP=$(curl -sf -X POST "$API_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"user1@pingme.test","password":"Password123!"}')
USER_TOKEN=$(echo "$USER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))")
if [ -z "$USER_TOKEN" ]; then echo "FAIL: user login"; exit 1; fi
echo "User token OK"

echo "=== User me ==="
curl -sf -H "Authorization: Bearer $USER_TOKEN" "$API_URL/users/me" | head -c 120
echo

echo "=== Presence status ==="
curl -sf -H "Authorization: Bearer $USER_TOKEN" "$API_URL/presence/status" | head -c 120
echo

echo "=== Wall posts ==="
curl -sf -H "Authorization: Bearer $USER_TOKEN" "$API_URL/wall/posts" | head -c 120
echo

echo "=== All smoke checks passed ==="
