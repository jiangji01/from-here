#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/bridge" || exit 1
printf '\n● From Here v1.0.0 · Mock Mode\n\n'
MOCK_NCM=1 node server.js
