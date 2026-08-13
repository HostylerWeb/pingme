#!/usr/bin/env bash
# API smoke test for Phases 0–3 acceptance criteria.
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000/v1}"
EMAIL_A="phase-test-a-$(date +%s)@pingme.test"
EMAIL_B="phase-test-b-$(date +%s)@pingme.test"
PASSWORD="Password123!"
DOB="1995-01-01"

echo "==> Health check (Phase 0)"
curl -sf "$API_URL/health" | grep -q '"status":"ok"'

register() {
  local email=$1
  curl -sf -X POST "$API_URL/auth/register" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\",\"dateOfBirth\":\"$DOB\"}"
}

echo "==> Register two users (Phase 1)"
REG_A=$(register "$EMAIL_A")
REG_B=$(register "$EMAIL_B")
TOKEN_A=$(echo "$REG_A" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).accessToken')
TOKEN_B=$(echo "$REG_B" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).accessToken')

echo "==> Presence ping near each other (Phase 2)"
# ~25m apart in Tbilisi area test coords
curl -sf -X POST "$API_URL/presence/ping" -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{"latitude":41.7151,"longitude":44.8271}' >/dev/null
curl -sf -X POST "$API_URL/presence/ping" -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d '{"latitude":41.7153,"longitude":44.8273}' >/dev/null

echo "==> User A posts to wall"
POST=$(curl -sf -X POST "$API_URL/wall/posts" -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{"content":"Phase 2 test post","latitude":41.7151,"longitude":44.8271}')
POST_ID=$(echo "$POST" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.id')

echo "==> User B sees post and replies"
curl -sf "$API_URL/wall/posts" -H "Authorization: Bearer $TOKEN_B" | grep -q "$POST_ID"
curl -sf -X POST "$API_URL/wall/posts/$POST_ID/replies" -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d '{"content":"Hello nearby!"}' >/dev/null

echo "==> Available mode + nearby count (Phase 3)"
curl -sf -X POST "$API_URL/presence/available" -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' -d '{"isAvailable":true}' >/dev/null
curl -sf -X POST "$API_URL/presence/available" -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' -d '{"isAvailable":true}' >/dev/null
NEARBY=$(curl -sf "$API_URL/presence/nearby-count" -H "Authorization: Bearer $TOKEN_A")
echo "$NEARBY" | grep -q '"count"'

echo "==> All API phase checks passed"
