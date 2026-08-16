#!/usr/bin/env bash
# Fix Metro ENOSPC "System limit for number of file watchers reached" on Linux.
# Run once with sudo; then restart Expo/Metro.
set -euo pipefail

WATCHES="${INOTIFY_MAX_USER_WATCHES:-524288}"

echo "Current fs.inotify.max_user_watches: $(cat /proc/sys/fs/inotify/max_user_watches)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Re-run with sudo:"
  echo "  sudo INOTIFY_MAX_USER_WATCHES=${WATCHES} bash scripts/fix-inotify-watches.sh"
  exit 1
fi

CONF="/etc/sysctl.d/99-pingme-inotify.conf"
cat > "$CONF" <<EOF
# PingMe / Expo Metro — monorepo file watching
fs.inotify.max_user_watches=${WATCHES}
EOF

sysctl --system >/dev/null
echo "Updated ${CONF}"
echo "fs.inotify.max_user_watches=$(cat /proc/sys/fs/inotify/max_user_watches)"
