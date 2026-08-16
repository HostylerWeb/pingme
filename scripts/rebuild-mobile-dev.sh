#!/usr/bin/env bash
# Rebuild the PingMe dev client so splash/icon assets from app.json appear on device.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/mobile"

echo "Rebuilding PingMe dev client (splash + app icon require a native rebuild)."
echo "Platform: ${1:-android}"

case "${1:-android}" in
  android)
    pnpm exec expo run:android
    ;;
  ios)
    pnpm exec expo run:ios
    ;;
  *)
    echo "Usage: bash scripts/rebuild-mobile-dev.sh [android|ios]"
    exit 1
    ;;
esac
