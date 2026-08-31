const fs = require('fs');
const path = require('path');
const os = require('os');

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function first(...values) { for (const value of values) if (typeof value === 'string' && value.trim()) return value.trim(); return ''; }
function normalizeBase(value) {
  let base = String(value || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  try {
    const url = new URL(base);
    if (!url.pathname || url.pathname === '/') return `${base}/v1`;
  } catch {}
  return base;
}

const KEY_NAMES = new Set(['ANTHROPIC_AUTH_TOKEN','ANTHROPIC_API_KEY','OPENAI_API_KEY','LL_AI_API_KEY']);
const BASE_NAMES = new Set(['ANTHROPIC_BASE_URL','OPENAI_BASE_URL','LL_AI_BASE_URL']);
const MODEL_NAMES = [
  'LL_AI_MODEL','ANTHROPIC_MODEL','OPENAI_MODEL','CLAUDE_MODEL',
  'model','defaultModel','preferredModel','activeModel','default_model','preferred_model'
];

function scanObject(obj, found = {}, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 10) return found;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      if (!found.apiKey && KEY_NAMES.has(key)) found.apiKey = value.trim();
      if (!found.baseUrl && BASE_NAMES.has(key)) found.baseUrl = value.trim();
      if (!found.model && MODEL_NAMES.includes(key) && value.trim()) found.model = value.trim();
      if (!found.provider && /ANTHROPIC_(AUTH_TOKEN|API_KEY)/.test(key)) found.provider = 'anthropic';
      if (!found.provider && key === 'OPENAI_API_KEY') found.provider = 'openai-compatible';
    } else if (value && typeof value === 'object') scanObject(value, found, depth + 1);
  }
  return found;
}

function discoverLocalAI() {
  if (process.env.FROM_HERE_DISABLE_LOCAL_AI === '1') {
    return { apiKey: '', baseUrl: '', model: '', provider: '', source: 'disabled-for-test' };
  }
  const found = {
    apiKey: first(process.env.LL_AI_API_KEY, process.env.ANTHROPIC_AUTH_TOKEN, process.env.ANTHROPIC_API_KEY, process.env.OPENAI_API_KEY),
    baseUrl: first(process.env.LL_AI_BASE_URL, process.env.ANTHROPIC_BASE_URL, process.env.OPENAI_BASE_URL),
    model: first(process.env.LL_AI_MODEL, process.env.ANTHROPIC_MODEL, process.env.OPENAI_MODEL, process.env.CLAUDE_MODEL),
    provider: first(process.env.LL_AI_PROVIDER),
    source: 'environment'
  };
  if (!found.provider) {
    if (first(process.env.ANTHROPIC_AUTH_TOKEN, process.env.ANTHROPIC_API_KEY)) found.provider = 'anthropic';
    else if (process.env.OPENAI_API_KEY) found.provider = 'openai-compatible';
  }

  const home = os.homedir();
  const files = [
    path.join(home, '.claude', 'settings.json'),
    path.join(home, '.claude', 'settings.local.json'),
    path.join(home, '.claude.json'),
    path.join(home, '.config', 'claude-code', 'settings.json')
  ];
  for (const file of files) {
    const obj = readJson(file);
    if (!obj) continue;
    const beforeModel = found.model;
    scanObject(obj, found);
    if ((!beforeModel && found.model) || (!found.baseUrl && obj)) found.source = file;
  }

  // These variables describe Claude Code's model aliases. They are weaker than
  // an explicit active model, so only use the Sonnet default as a final hint.
  if (!found.model) found.model = first(process.env.ANTHROPIC_DEFAULT_SONNET_MODEL);

  if (!found.baseUrl && found.apiKey) {
    if (found.provider === 'anthropic') found.baseUrl = 'https://api.anthropic.com/v1';
    else if (found.provider === 'openai-compatible') found.baseUrl = 'https://api.openai.com/v1';
  }

  found.baseUrl = normalizeBase(found.baseUrl);
  return found;
}

module.exports = { discoverLocalAI, normalizeBase };
