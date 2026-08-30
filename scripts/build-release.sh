#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(node -p "require('$ROOT/bridge/package.json').version")
OUT_BASE="${1:-$ROOT/dist}"
APP="$OUT_BASE/From-Here-v$VERSION-macOS"
rm -rf "$APP"
mkdir -p "$APP/.from-here/bridge/prompts" "$APP/.from-here/bridge/providers" "$APP/.from-here/scripts" "$APP/Chrome Extension" "$APP/Support"

# User-facing launchers/templates.
cp "$ROOT/release-templates/Install.command" "$APP/Install.command"
cp "$ROOT/release-templates/Start.command" "$APP/Start.command"
cp "$ROOT/release-templates/README-FIRST.txt" "$APP/README-FIRST.txt"
cp "$ROOT/release-templates/Support/"*.command "$APP/Support/"

# Extension runtime only.
cp -R "$ROOT/extension/." "$APP/Chrome Extension/"

# Hidden runtime engine: no tests, docs, CI, contribution files or examples with secrets.
for f in server.js package.json media-memory.js music-map.js local-ai-config.js import-ai-config.js; do cp "$ROOT/bridge/$f" "$APP/.from-here/bridge/$f"; done
cp "$ROOT/bridge/prompts/music-semantic.js" "$APP/.from-here/bridge/prompts/"
cp "$ROOT/bridge/providers/"*.js "$APP/.from-here/bridge/providers/"
cp "$ROOT/configure-ai.command" "$APP/.from-here/configure-ai.command"
cp "$ROOT/diagnose.command" "$APP/.from-here/diagnose.command"
cp "$ROOT/scripts/install-core.sh" "$APP/.from-here/scripts/install-core.sh"
mkdir -p "$APP/.from-here/bridge/.data"
chmod +x "$APP/Install.command" "$APP/Start.command" "$APP/Support/"*.command "$APP/.from-here/"*.command "$APP/.from-here/scripts/install-core.sh"

# Runtime package must never contain local secrets or runtime cache.
if find "$APP" -type f \( -name 'config.local.json' -o -name '.env' -o -name '*.key' -o -name '*.pem' -o -name 'track-cache.json' -o -name 'media-state.json' \) | grep -q .; then echo 'Refusing release: secret/runtime file found.' >&2; exit 1; fi
if grep -RIlE 'hongqiye|sk-[A-Za-z0-9]{10,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' "$APP" >/dev/null 2>&1; then echo 'Refusing release: possible private provider/secret material found.' >&2; exit 1; fi

mkdir -p "$OUT_BASE"
(cd "$OUT_BASE" && rm -f "From-Here-v$VERSION-macOS.zip" && zip -qry "From-Here-v$VERSION-macOS.zip" "From-Here-v$VERSION-macOS")
echo "$APP"
echo "$OUT_BASE/From-Here-v$VERSION-macOS.zip"
