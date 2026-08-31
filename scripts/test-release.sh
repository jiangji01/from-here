#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(node -p "require('$ROOT/bridge/package.json').version")
OUT="${1:-$ROOT/dist}"
SUFFIX="${FROM_HERE_RELEASE_SUFFIX:-}"
NAME="From-Here-v$VERSION-macOS${SUFFIX:+-$SUFFIX}"
APP="$OUT/$NAME"
ZIP="$OUT/$NAME.zip"
[ -d "$APP" ] || "$ROOT/scripts/build-release.sh" "$OUT" >/dev/null
[ -f "$ZIP" ]

for required in 'Install.command' 'Start.command' 'README-FIRST.txt' 'Chrome Extension' 'Support' '.from-here'; do [ -e "$APP/$required" ] || { echo "missing release item: $required"; exit 1; }; done
for forbidden in README.md CONTRIBUTING.md SECURITY.md CHANGELOG.md docs brand .github; do [ ! -e "$APP/$forbidden" ] || { echo "developer artifact leaked into runtime: $forbidden"; exit 1; }; done
[ -f "$APP/.from-here/THIRD_PARTY_NOTICES.md" ] || { echo 'third-party notice missing'; exit 1; }
[ -f "$APP/.from-here/bridge/now-playing-jxa.js" ] || { echo 'system media adapter missing'; exit 1; }
[ -f "$APP/.from-here/bridge/listening-judgment.js" ] || { echo 'listening judgment runtime missing'; exit 1; }
[ ! -e "$APP/.from-here/scripts/install-nowplaying-local.sh" ] || { echo 'obsolete media downloader leaked into release'; exit 1; }
if find "$APP/.from-here/bridge" -type f -name '*test*.js' | grep -q .; then echo 'test file leaked into runtime'; exit 1; fi
if find "$APP" -type f \( -name 'config.local.json' -o -name '.env' -o -name '*.key' -o -name '*.pem' -o -name 'track-cache.json' -o -name 'media-state.json' \) | grep -q .; then echo 'secret/runtime file leaked'; exit 1; fi
bash -n "$APP/Install.command" "$APP/Start.command" "$APP/Support/Configure AI.command" "$APP/Support/Connect NetEase.command" "$APP/Support/Diagnose.command" "$APP/Support/Stop.command" "$APP/.from-here/configure-ai.command" "$APP/.from-here/diagnose.command" "$APP/.from-here/scripts/install-core.sh" "$APP/.from-here/scripts/runtime-env.sh" "$APP/.from-here/scripts/configure-netease.sh"
node --check "$APP/.from-here/bridge/server.js"
node --check "$APP/.from-here/bridge/now-playing-jxa.js"
node --check "$APP/Chrome Extension/sidepanel.js"
node --check "$APP/Chrome Extension/background.js"

OWNED_SCAN_PATHS=(
  "$APP/Install.command" "$APP/Start.command" "$APP/README-FIRST.txt"
  "$APP/Support" "$APP/Chrome Extension" "$APP/.from-here/bridge"
  "$APP/.from-here/scripts" "$APP/.from-here/configure-ai.command" "$APP/.from-here/diagnose.command"
)
if grep -RIlE 'formulae\.brew\.sh|ghcr\.io|install-nowplaying-local' "${OWNED_SCAN_PATHS[@]}" >/dev/null 2>&1; then
  echo 'From Here-owned runtime still contains obsolete media-download path'; exit 1
fi
if [ "${FROM_HERE_REQUIRE_BUNDLED_RUNTIME:-0}" = "1" ]; then
  [ -x "$APP/.from-here/runtime/node/arm64/bin/node" ] || { echo 'bundled arm64 Node missing'; exit 1; }
  [ -x "$APP/.from-here/runtime/node/x64/bin/node" ] || { echo 'bundled x64 Node missing'; exit 1; }
  [ -x "$APP/.from-here/runtime/ncm/arm64/node_modules/.bin/ncm-cli" ] || { echo 'bundled arm64 ncm-cli missing'; exit 1; }
  [ -x "$APP/.from-here/runtime/ncm/x64/node_modules/.bin/ncm-cli" ] || { echo 'bundled x64 ncm-cli missing'; exit 1; }
fi


# Official release validation must inspect the exact ZIP users will download, not only
# the pre-archive staging directory. This catches lost permissions/symlinks early.
if [ "${FROM_HERE_REQUIRE_BUNDLED_RUNTIME:-0}" = "1" ]; then
  EXTRACT_ROOT="$(mktemp -d -t from-here-release.XXXXXX)"
  trap 'rm -rf "$EXTRACT_ROOT"; kill "${PID:-}" 2>/dev/null || true' EXIT
  unzip -q "$ZIP" -d "$EXTRACT_ROOT"
  EXTRACTED="$EXTRACT_ROOT/$NAME"
  [ -x "$EXTRACTED/.from-here/runtime/node/arm64/bin/node" ] || { echo 'ZIP lost arm64 Node executable'; exit 1; }
  [ -x "$EXTRACTED/.from-here/runtime/node/x64/bin/node" ] || { echo 'ZIP lost x64 Node executable'; exit 1; }
  [ -x "$EXTRACTED/.from-here/runtime/ncm/arm64/node_modules/.bin/ncm-cli" ] || { echo 'ZIP lost arm64 ncm-cli executable'; exit 1; }
  [ -x "$EXTRACTED/.from-here/runtime/ncm/x64/node_modules/.bin/ncm-cli" ] || { echo 'ZIP lost x64 ncm-cli executable'; exit 1; }
  rm -rf "$EXTRACT_ROOT"
  trap - EXIT
fi

# Hidden runtime must boot independently of Source-only files. MOCK avoids macOS APIs.
LOG="$OUT/runtime-smoke.log"
SMOKE_PORT=$((30000 + RANDOM % 20000))
PORT="$SMOKE_PORT" MOCK_NCM=1 FROM_HERE_DISABLE_LOCAL_AI=1 FROM_HERE_DATA_DIR="$OUT/.smoke-data" node "$APP/.from-here/bridge/server.js" >"$LOG" 2>&1 & PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT
OK=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS --max-time 1 http://127.0.0.1:$SMOKE_PORT/api/health >/dev/null 2>&1; then OK=1; break; fi
  sleep 0.25
done
[ "$OK" -eq 1 ] || { cat "$LOG"; echo 'runtime smoke boot failed'; exit 1; }
kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true
trap - EXIT
printf '✓ release structure + system-media adapter + syntax + hidden-runtime smoke test\n'
