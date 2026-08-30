#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
printf '\nFrom Here · AI 配置\n\n'

if node bridge/import-ai-config.js; then
  printf '\n✓ 已发现本机 AI 配置。From Here 默认跟随你本机正在使用的模型。\n'
  read -r -p "继续使用本机配置？[Y/n] " KEEP
  case "$KEEP" in n|N) ;; *) printf '\n完成。重新启动 From Here 后生效。\n'; read -n 1 -s -r -p "按任意键关闭"; exit 0;; esac
fi

printf '\n自定义 Provider（仅在你不想跟随本机时使用）\n'
printf '  1) 自动检测协议\n'
printf '  2) OpenAI-compatible /chat/completions\n'
printf '  3) Anthropic /messages\n'
printf '  4) 暂不配置 AI\n\n'
read -r -p "选择 [1-4]: " CHOICE
case "$CHOICE" in
  2) PROVIDER="openai-compatible" ;;
  3) PROVIDER="anthropic" ;;
  4) printf '\n已跳过 AI。From Here 仍可使用本地 Session Rank。\n'; read -n 1 -s -r -p "按任意键关闭"; exit 0 ;;
  *) PROVIDER="auto" ;;
esac
read -r -p "Base URL（例如 https://example.com/v1）: " BASE_URL
if [ -z "$BASE_URL" ]; then printf 'Base URL 不能为空。\n'; exit 1; fi
read -s -r -p "API Key（不会显示）: " API_KEY
printf '\n'
if [ -z "$API_KEY" ]; then printf '没有输入 Key，已取消。\n'; exit 1; fi
read -r -p "Model（建议明确填写；留空则自动发现）: " MODEL
LL_PROVIDER="$PROVIDER" LL_BASE_URL="$BASE_URL" LL_API_KEY="$API_KEY" LL_MODEL="$MODEL" node <<'NODE'
const fs = require('fs'); const path = require('path');
const file = path.join(process.cwd(), 'bridge', 'config.local.json');
let previous={}; try{previous=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
const next={
  port:Number(previous.port||19428), queueSize:Number(previous.queueSize||5),
  ai:{provider:process.env.LL_PROVIDER||'auto',baseUrl:String(process.env.LL_BASE_URL||'').replace(/\/+$/,''),apiKey:process.env.LL_API_KEY,model:process.env.LL_MODEL||'',modelMode:'custom',autoDiscover:true}
};
fs.writeFileSync(file,`${JSON.stringify(next,null,2)}\n`,{mode:0o600});
NODE
unset API_KEY LL_API_KEY
printf '\n✓ 自定义配置已保存。模型不会被自动选择逻辑覆盖。\n'
printf '✓ 如果以后想重新跟随本机，再运行本脚本并选择本机配置。\n\n'
read -n 1 -s -r -p "按任意键关闭"
