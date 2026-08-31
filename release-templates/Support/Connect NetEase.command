#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/.from-here/scripts/runtime-env.sh"
export FROM_HERE_ROOT="$ROOT"
exec bash "$ROOT/.from-here/scripts/configure-netease.sh"
