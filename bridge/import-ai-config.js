const fs = require('fs');
const path = require('path');
const { discoverLocalAI } = require('./local-ai-config');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'config.local.json');
const quiet = process.argv.includes('--quiet');
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }

const found = discoverLocalAI();
if (found.apiKey && found.baseUrl) {
  const previous = readJson(OUT) || {};
  const previousAI = previous.ai || previous.llm || {};
  const next = {
    port: Number(previous.port || 19428),
    queueSize: Number(previous.queueSize || 5),
    ai: {
      ...previousAI,
      provider: found.provider || previousAI.provider || 'auto',
      baseUrl: found.baseUrl,
      apiKey: found.apiKey,
      model: found.model || '',
      modelMode: 'follow-local',
      autoDiscover: true
    }
  };
  fs.writeFileSync(OUT, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  if (!quiet) console.log(`已导入本机 AI 配置：${found.baseUrl} · ${found.model || '模型跟随本机/自动发现'}（Key 未显示）`);
  process.exit(0);
}
if (!quiet) console.log('没有自动发现完整的本机 AI Provider 配置。');
process.exit(2);
