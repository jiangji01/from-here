#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
export FROM_HERE_ROOT="$ROOT"
export FROM_HERE_BRIDGE_DIR="$ROOT/.from-here/bridge"
export FROM_HERE_EXTENSION_DIR="$ROOT/Chrome Extension"
export FROM_HERE_CONFIGURE_CMD="$ROOT/Support/Configure AI.command"
exec bash "$ROOT/.from-here/scripts/install-core.sh"
