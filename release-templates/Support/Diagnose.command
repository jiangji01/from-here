#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/.from-here/scripts/runtime-env.sh"
exec "$ROOT/.from-here/diagnose.command"
