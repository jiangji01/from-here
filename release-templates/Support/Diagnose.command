#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/.from-here/diagnose.command"
