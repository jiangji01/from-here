#!/bin/bash
printf '\n=== From Here v1.0.0 环境诊断 ===\n'
printf '\n[1] Node\n'; node -v || true
printf '\n[2] ncm-cli\n'; ncm-cli --version || true
printf '\n[3] 网易登录\n'; ncm-cli login --check || true
printf '\n[4] 播放器\n'; ncm-cli config get player || true
printf '\n[5] macOS Now Playing\n'; nowplaying-cli get title artist album || true
printf '\n[6] Bridge health\n'; curl -s http://127.0.0.1:19428/api/health || true; printf '\n'
printf '\n[7] AI（不会显示 Key）\n'; curl -s 'http://127.0.0.1:19428/api/ai?refresh=1' || true; printf '\n'
printf '\n[8] 当前歌曲\n'; curl -s http://127.0.0.1:19428/api/state || true; printf '\n'
printf '\n[9] 当前 Session / Fingerprint\n'; curl -s http://127.0.0.1:19428/api/session || true; printf '\n'
printf '\n[10] ncm-cli 推荐命令\n'; ncm-cli commands 2>/dev/null | grep -E 'recommend|heartbeat|fm|daily|favorite|queue' || true
printf '\n=== 诊断结束 ===\n'
read -n 1 -s -r -p "按任意键关闭"
