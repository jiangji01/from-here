#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
export FROM_HERE_ROOT="$ROOT"
exec bash "$ROOT/scripts/configure-netease.sh"
