#!/bin/bash
# Runtime discovery for packaged From Here releases.
# Official GitHub releases bundle architecture-specific Node + ncm-cli payloads,
# so end users do not need Homebrew, Node, npm or a global ncm-cli.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FH_RUNTIME_HOME="${FROM_HERE_RUNTIME_HOME:-$(cd "$SCRIPT_DIR/.." && pwd)}"

ARCH="$(uname -m 2>/dev/null || true)"
case "$ARCH" in
  arm64|aarch64) FH_ARCH="arm64" ;;
  x86_64|amd64) FH_ARCH="x64" ;;
  *) FH_ARCH="$ARCH" ;;
esac
FH_NODE_DIR="$FH_RUNTIME_HOME/runtime/node/$FH_ARCH"
FH_NCM_DIR="$FH_RUNTIME_HOME/runtime/ncm/$FH_ARCH"

if [ -x "$FH_NODE_DIR/bin/node" ]; then
  PATH="$FH_NODE_DIR/bin:$PATH"
  export FROM_HERE_NODE_BIN="$FH_NODE_DIR/bin/node"
  export FROM_HERE_BUNDLED_RUNTIME=1
fi
if [ -x "$FH_NCM_DIR/node_modules/.bin/ncm-cli" ]; then
  PATH="$FH_NCM_DIR/node_modules/.bin:$PATH"
  export FROM_HERE_NCM_BIN="$FH_NCM_DIR/node_modules/.bin/ncm-cli"
  export FROM_HERE_BUNDLED_RUNTIME=1
fi
export PATH
