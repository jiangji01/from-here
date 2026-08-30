#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(node -p "require('$ROOT/bridge/package.json').version")
OUT="${1:-$ROOT/dist}"
APP="$OUT/From-Here-v$VERSION-macOS"
ZIP="$OUT/From-Here-v$VERSION-macOS.zip"
[ -d "$APP" ] || "$ROOT/scripts/build-release.sh" "$OUT" >/dev/null
[ -f "$ZIP" ]

for required in 'Install.command' 'Start.command' 'README-FIRST.txt' 'Chrome Extension' 'Support' '.from-here'; do [ -e "$APP/$required" ] || { echo "missing release item: $required"; exit 1; }; done
for forbidden in README.md CONTRIBUTING.md SECURITY.md CHANGELOG.md docs brand .github; do [ ! -e "$APP/$forbidden" ] || { echo "developer artifact leaked into runtime: $forbidden"; exit 1; }; done
if find "$APP/.from-here/bridge" -type f -name '*test*.js' | grep -q .; then echo 'test file leaked into runtime'; exit 1; fi
if find "$APP" -type f \( -name 'config.local.json' -o -name '.env' -o -name '*.key' -o -name '*.pem' -o -name 'track-cache.json' -o -name 'media-state.json' \) | grep -q .; then echo 'secret/runtime file leaked'; exit 1; fi
bash -n "$APP/Install.command" "$APP/Start.command" "$APP/Support/Configure AI.command" "$APP/Support/Diagnose.command" "$APP/Support/Stop.command" "$APP/.from-here/configure-ai.command" "$APP/.from-here/diagnose.command" "$APP/.from-here/scripts/install-core.sh"
node --check "$APP/.from-here/bridge/server.js"
node --check "$APP/Chrome Extension/sidepanel.js"
node --check "$APP/Chrome Extension/background.js"

# Hidden runtime must boot independently of Source-only files.
LOG="$OUT/runtime-smoke.log"
PORT=19429 MOCK_NCM=1 node "$APP/.from-here/bridge/server.js" >"$LOG" 2>&1 & PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT
OK=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS --max-time 1 http://127.0.0.1:19429/api/health >/dev/null 2>&1; then OK=1; break; fi
  sleep 0.25
done
[ "$OK" -eq 1 ] || { cat "$LOG"; echo 'runtime smoke boot failed'; exit 1; }
kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true
trap - EXIT
printf '✓ release structure + syntax + hidden-runtime smoke test\n'
