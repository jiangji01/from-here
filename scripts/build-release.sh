#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(node -p "require('$ROOT/bridge/package.json').version")
OUT_BASE="${1:-$ROOT/dist}"
SUFFIX="${FROM_HERE_RELEASE_SUFFIX:-}"
NAME="From-Here-v$VERSION-macOS${SUFFIX:+-$SUFFIX}"
APP="$OUT_BASE/$NAME"
rm -rf "$APP"
mkdir -p "$APP/.from-here/bridge/prompts" "$APP/.from-here/bridge/providers" "$APP/.from-here/scripts" "$APP/.from-here/runtime" "$APP/Chrome Extension" "$APP/Support"

# User-facing launchers/templates.
cp "$ROOT/release-templates/Install.command" "$APP/Install.command"
cp "$ROOT/release-templates/Start.command" "$APP/Start.command"
cp "$ROOT/release-templates/README-FIRST.txt" "$APP/README-FIRST.txt"
cp "$ROOT/release-templates/Support/"*.command "$APP/Support/"

# Extension runtime only.
cp -R "$ROOT/extension/." "$APP/Chrome Extension/"

# Hidden runtime engine: no tests, docs, CI or developer-only artifacts.
for f in server.js package.json media-memory.js music-map.js listening-judgment.js local-ai-config.js import-ai-config.js now-playing-jxa.js; do cp "$ROOT/bridge/$f" "$APP/.from-here/bridge/$f"; done
cp "$ROOT/bridge/prompts/music-semantic.js" "$APP/.from-here/bridge/prompts/"
cp "$ROOT/bridge/providers/"*.js "$APP/.from-here/bridge/providers/"
cp "$ROOT/configure-ai.command" "$APP/.from-here/configure-ai.command"
cp "$ROOT/diagnose.command" "$APP/.from-here/diagnose.command"
cp "$ROOT/scripts/install-core.sh" "$APP/.from-here/scripts/install-core.sh"
cp "$ROOT/scripts/runtime-env.sh" "$APP/.from-here/scripts/runtime-env.sh"
cp "$ROOT/scripts/configure-netease.sh" "$APP/.from-here/scripts/configure-netease.sh"
cp "$ROOT/THIRD_PARTY_NOTICES.md" "$APP/.from-here/THIRD_PARTY_NOTICES.md"
mkdir -p "$APP/.from-here/bridge/.data"

# Optional self-contained runtime. Official releases bundle architecture-specific
# Node + ncm-cli payloads. Building ncm-cli on the target architecture avoids
# silently shipping a Linux-built dependency tree into a macOS release.
if [ -n "${FROM_HERE_BUNDLED_NODE_ARM64_DIR:-}" ]; then
  [ -x "$FROM_HERE_BUNDLED_NODE_ARM64_DIR/bin/node" ] || { echo 'Bundled arm64 Node directory is invalid.' >&2; exit 1; }
  mkdir -p "$APP/.from-here/runtime/node"; cp -R "$FROM_HERE_BUNDLED_NODE_ARM64_DIR" "$APP/.from-here/runtime/node/arm64"
fi
if [ -n "${FROM_HERE_BUNDLED_NODE_X64_DIR:-}" ]; then
  [ -x "$FROM_HERE_BUNDLED_NODE_X64_DIR/bin/node" ] || { echo 'Bundled x64 Node directory is invalid.' >&2; exit 1; }
  mkdir -p "$APP/.from-here/runtime/node"; cp -R "$FROM_HERE_BUNDLED_NODE_X64_DIR" "$APP/.from-here/runtime/node/x64"
fi
NCM_ARM64_DIR="${FROM_HERE_BUNDLED_NCM_ARM64_DIR:-${FROM_HERE_BUNDLED_NCM_DIR:-}}"
NCM_X64_DIR="${FROM_HERE_BUNDLED_NCM_X64_DIR:-${FROM_HERE_BUNDLED_NCM_DIR:-}}"
if [ -n "$NCM_ARM64_DIR" ]; then
  [ -x "$NCM_ARM64_DIR/node_modules/.bin/ncm-cli" ] || { echo 'Bundled arm64 ncm-cli directory is invalid.' >&2; exit 1; }
  mkdir -p "$APP/.from-here/runtime/ncm"; cp -R "$NCM_ARM64_DIR" "$APP/.from-here/runtime/ncm/arm64"
fi
if [ -n "$NCM_X64_DIR" ]; then
  [ -x "$NCM_X64_DIR/node_modules/.bin/ncm-cli" ] || { echo 'Bundled x64 ncm-cli directory is invalid.' >&2; exit 1; }
  mkdir -p "$APP/.from-here/runtime/ncm"; cp -R "$NCM_X64_DIR" "$APP/.from-here/runtime/ncm/x64"
fi
if [ "${FROM_HERE_REQUIRE_BUNDLED_RUNTIME:-0}" = "1" ]; then
  [ -x "$APP/.from-here/runtime/node/arm64/bin/node" ] || { echo 'Official release requires arm64 Node.' >&2; exit 1; }
  [ -x "$APP/.from-here/runtime/node/x64/bin/node" ] || { echo 'Official release requires x64 Node.' >&2; exit 1; }
  [ -x "$APP/.from-here/runtime/ncm/arm64/node_modules/.bin/ncm-cli" ] || { echo 'Official release requires arm64 ncm-cli.' >&2; exit 1; }
  [ -x "$APP/.from-here/runtime/ncm/x64/node_modules/.bin/ncm-cli" ] || { echo 'Official release requires x64 ncm-cli.' >&2; exit 1; }
fi

chmod +x "$APP/Install.command" "$APP/Start.command" "$APP/Support/"*.command "$APP/.from-here/"*.command "$APP/.from-here/scripts/"*.sh

# Runtime package must never contain local secrets or runtime cache.
if find "$APP" -type f \( -name 'config.local.json' -o -name '.env' -o -name '*.key' -o -name '*.pem' -o -name 'track-cache.json' -o -name 'media-state.json' \) | grep -q .; then echo 'Refusing release: secret/runtime file found.' >&2; exit 1; fi
if grep -RIlE 'sk-[A-Za-z0-9]{10,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' "$APP" >/dev/null 2>&1; then echo 'Refusing release: possible private provider/secret material found.' >&2; exit 1; fi

mkdir -p "$OUT_BASE"
(cd "$OUT_BASE" && rm -f "$NAME.zip" && zip -qry "$NAME.zip" "$NAME")
echo "$APP"
echo "$OUT_BASE/$NAME.zip"
