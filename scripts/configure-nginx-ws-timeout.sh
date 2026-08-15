#!/usr/bin/env bash
# Apply WebSocket timeout overrides on the VPS nginx site for PingMe.
# Must run AFTER any include that sets proxy_read_timeout (e.g. proxy-analytics.conf).
set -euo pipefail

SITE_DIR="${SITE_DIR:-/var/www/sites/pingme}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/pingme.hostyler.cloud}"
TIMEOUT_SNIPPET="${SITE_DIR}/infrastructure/nginx/ws-timeouts.conf"

if [[ ! -f "$NGINX_SITE" ]]; then
  echo "nginx site not found: $NGINX_SITE" >&2
  exit 1
fi

if [[ ! -f "$TIMEOUT_SNIPPET" ]]; then
  echo "timeout snippet not found: $TIMEOUT_SNIPPET" >&2
  exit 1
fi

# Idempotent: replace any previous ws-timeouts include, then ensure it follows proxy-analytics.
if grep -q 'ws-timeouts.conf' "$NGINX_SITE"; then
  sed -i '\|include .*/ws-timeouts.conf;|d' "$NGINX_SITE"
fi

# Insert ws-timeouts include immediately after proxy-analytics inside socket.io location only.
awk -v snippet="include ${TIMEOUT_SNIPPET};" '
  /location \/socket\.io\// { in_socket=1 }
  in_socket && /include .*proxy-analytics\.conf;/ {
    print
    print "        " snippet
    next
  }
  in_socket && /^[[:space:]]*}/ { in_socket=0 }
  { print }
' "$NGINX_SITE" > "${NGINX_SITE}.tmp"
mv "${NGINX_SITE}.tmp" "$NGINX_SITE"

nginx -t
systemctl reload nginx
echo "nginx WebSocket timeouts configured (3600s read/send on /socket.io/)"
