function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) throw new Error(`${response.status} ${String(text).slice(0, 260)}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function modelIds(data) {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
        ? data.models
        : [];
  return [...new Set(rows
    .map(item => typeof item === 'string' ? item : (item?.id || item?.name || item?.model))
    .filter(Boolean)
    .map(String))];
}

function modelScore(id) {
  const s = String(id || '').toLowerCase();
  if (/(embed|embedding|rerank|image|vision-only|audio|tts|transcribe|whisper|moderation)/.test(s)) return -1000;
  let score = 10;
  if (s.includes('sonnet')) score += 100;
  else if (s.includes('claude')) score += 88;
  if (/gpt[-_]?5/.test(s)) score += 92;
  else if (/gpt[-_]?4\.1|gpt[-_]?4o/.test(s)) score += 78;
  if (/deepseek[-_](chat|v3|v4)/.test(s)) score += 76;
  if (/qwen.*(plus|max|turbo)/.test(s)) score += 70;
  if (/kimi|moonshot/.test(s)) score += 66;
  if (/gemini.*(pro|flash)/.test(s)) score += 62;
  if (/mini|haiku|flash/.test(s)) score -= 8;
  return score;
}

function chooseModel(ids, configuredModel = '') {
  const requested = String(configuredModel || '').trim();
  // Explicit/local model always wins. A gateway may hide aliases from /models,
  // so model discovery must never silently override the user's existing choice.
  if (requested) return requested;
  return [...ids].sort((a, b) => modelScore(b) - modelScore(a))[0] || requested || '';
}

module.exports = { normalizeBaseUrl, fetchJson, modelIds, chooseModel };
