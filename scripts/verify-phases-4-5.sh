#!/usr/bin/env bash
# API smoke test for Phases 4–5 (icebreaker, matches, chat, safety).
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000/v1}"
EMAIL_A="phase4-a-$(date +%s)@pingme.test"
EMAIL_B="phase4-b-$(date +%s)@pingme.test"
PASSWORD="Password123!"
DOB="1995-01-01"

echo "==> Health check"
curl -sf "$API_URL/health" | grep -q '"status":"ok"'

register() {
  local email=$1
  curl -sf -X POST "$API_URL/auth/register" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\",\"dateOfBirth\":\"$DOB\"}"
}

echo "==> Register two users"
REG_A=$(register "$EMAIL_A")
REG_B=$(register "$EMAIL_B")
TOKEN_A=$(echo "$REG_A" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).accessToken')
TOKEN_B=$(echo "$REG_B" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).accessToken')
USER_A=$(echo "$REG_A" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).user.id')
USER_B=$(echo "$REG_B" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).user.id')

echo "==> Presence ping within icebreaker radius (~25m apart)"
curl -sf -X POST "$API_URL/presence/ping" -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{"latitude":41.7151,"longitude":44.8271}' >/dev/null
curl -sf -X POST "$API_URL/presence/ping" -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d '{"latitude":41.7153,"longitude":44.8273}' >/dev/null

echo "==> Wall reply match request (Phase 4 wall path)"
POST=$(curl -sf -X POST "$API_URL/wall/posts" -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{"content":"Phase 4 wall match test","latitude":41.7151,"longitude":44.8271}')
POST_ID=$(echo "$POST" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.id')
REPLY=$(curl -sf -X POST "$API_URL/wall/posts/$POST_ID/replies" -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d '{"content":"Interested!"}')
REPLY_ID=$(echo "$REPLY" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.id')
MATCH_WALL=$(curl -sf -X POST "$API_URL/matches/request" -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d "{\"source\":\"wall_reply\",\"sourceReferenceId\":\"$REPLY_ID\"}")
MATCH_WALL_ID=$(echo "$MATCH_WALL" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.id')
MATCH_WALL_ACTIVE=$(curl -sf -X POST "$API_URL/matches/$MATCH_WALL_ID/accept" -H "Authorization: Bearer $TOKEN_A")
CHAT_WALL_ID=$(echo "$MATCH_WALL_ACTIVE" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.chatId')
test -n "$CHAT_WALL_ID"

echo "==> Chat messaging (Phase 5)"
MSG=$(curl -sf -X POST "$API_URL/chats/$CHAT_WALL_ID/messages" -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{"content":"Hello from phase 5 test"}')
echo "$MSG" | grep -q 'Hello from phase 5 test'
curl -sf "$API_URL/chats/$CHAT_WALL_ID/messages" -H "Authorization: Bearer $TOKEN_B" | grep -q 'Hello from phase 5 test'

echo "==> Block + report safety endpoints"
curl -sf -X POST "$API_URL/blocks" -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$USER_B\"}" >/dev/null
curl -sf "$API_URL/blocks" -H "Authorization: Bearer $TOKEN_A" | grep -q "$USER_B"
curl -sf -X DELETE "$API_URL/blocks/$USER_B" -H "Authorization: Bearer $TOKEN_A" >/dev/null
curl -sf -X POST "$API_URL/reports" -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d "{\"reportedUserId\":\"$USER_B\",\"targetType\":\"user\",\"targetId\":\"$USER_B\",\"reason\":\"spam\"}" >/dev/null

echo "==> Icebreaker start + worker wait (Phase 4 icebreaker path)"
curl -sf -X POST "$API_URL/icebreaker/start" -H "Authorization: Bearer $TOKEN_A" >/dev/null
curl -sf -X POST "$API_URL/icebreaker/start" -H "Authorization: Bearer $TOKEN_B" >/dev/null
echo "    Waiting for icebreaker match (up to 75s)..."
MATCH_ICE_ID=""
for _ in $(seq 1 15); do
  sleep 5
  MATCHES_A=$(curl -sf "$API_URL/matches" -H "Authorization: Bearer $TOKEN_A")
  MATCH_ICE_ID=$(echo "$MATCHES_A" | node -e '
    const data = JSON.parse(require("fs").readFileSync(0,"utf8")).data;
    const m = data.find((x) => x.source === "icebreaker" && x.status === "pending");
    if (m) process.stdout.write(m.id);
  ' || true)
  if [ -n "$MATCH_ICE_ID" ]; then break; fi
done
test -n "$MATCH_ICE_ID"
curl -sf -X POST "$API_URL/matches/$MATCH_ICE_ID/accept" -H "Authorization: Bearer $TOKEN_A" >/dev/null
curl -sf -X POST "$API_URL/matches/$MATCH_ICE_ID/accept" -H "Authorization: Bearer $TOKEN_B" >/dev/null || true
curl -sf "$API_URL/matches/$MATCH_ICE_ID" -H "Authorization: Bearer $TOKEN_A" | grep -q '"status":"active"'

echo "==> All Phase 4–5 API checks passed"
