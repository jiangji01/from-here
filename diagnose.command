#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
BRIDGE="$ROOT/bridge"
printf '\n=== From Here v1.1.0 环境诊断 ===\n'
printf '\n[1] macOS\n'; sw_vers 2>/dev/null || true; uname -m || true
printf '\n[2] Node\n'; node -v || true
printf '\n[3] ncm-cli\n'; ncm-cli --version || true
printf '\n[4] 网易授权\n'; ncm-cli login --check || true
printf '\n[5] 网易播放器\n'; ncm-cli config get player || true
printf '\n[6] macOS 系统 Now Playing\n'
if [ -x /usr/bin/osascript ] && [ -f "$BRIDGE/now-playing-jxa.js" ]; then
  /usr/bin/osascript -l JavaScript "$BRIDGE/now-playing-jxa.js" 2>&1 || true
else
  printf 'system-jxa: unavailable (osascript or adapter script missing)\n'
fi
if command -v nowplaying-cli >/dev/null 2>&1; then
  printf '\n兼容回退 nowplaying-cli：\n'; nowplaying-cli get title artist album 2>&1 || true
fi
printf '\n[7] Bridge health\n'; curl -s http://127.0.0.1:19428/api/health || true; printf '\n'
printf '\n[8] AI（不会显示 Key）\n'; curl -s 'http://127.0.0.1:19428/api/ai?refresh=1' || true; printf '\n'
printf '\n[9] 当前歌曲\n'; curl -s http://127.0.0.1:19428/api/state || true; printf '\n'
printf '\n[10] 当前 Session / Fingerprint\n'; curl -s http://127.0.0.1:19428/api/session || true; printf '\n'
printf '\n[11] ncm-cli 推荐能力\n'; ncm-cli commands 2>/dev/null | grep -E 'recommend|heartbeat|fm|daily|favorite|queue' || true
printf '\n=== 诊断结束 ===\n'
read -n 1 -s -r -p "按任意键关闭"
