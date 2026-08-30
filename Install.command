#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
export FROM_HERE_ROOT="$ROOT"
export FROM_HERE_BRIDGE_DIR="$ROOT/bridge"
export FROM_HERE_EXTENSION_DIR="$ROOT/extension"
export FROM_HERE_CONFIGURE_CMD="$ROOT/configure-ai.command"
exec bash "$ROOT/scripts/install-core.sh"
