const openai = require('./openai-compatible');
const anthropic = require('./anthropic');
const { normalizeBaseUrl, chooseModel } = require('./common');

const adapters = { [openai.id]: openai, [anthropic.id]: anthropic };

function providerOrder(provider) {
  const value = String(provider || 'auto').toLowerCase();
  if (value === 'anthropic') return ['anthropic'];
  if (value === 'openai' || value === 'openai-compatible') return ['openai-compatible'];
  return ['openai-compatible', 'anthropic'];
}

function publicProviderLabel(baseUrl, provider) {
  try {
    const host = new URL(baseUrl).hostname;
    if (/anthropic\.com$/i.test(host)) return 'Anthropic';
    if (/openai\.com$/i.test(host)) return 'OpenAI';
    if (/deepseek\.com$/i.test(host)) return 'DeepSeek';
    if (/openrouter\.ai$/i.test(host)) return 'OpenRouter';
    return host || provider;
  } catch { return provider || ''; }
}

function createProviderRuntime(config = {}) {
  const state = {
    status: config.apiKey ? 'discovering' : 'unconfigured',
    provider: null,
    model: String(config.model || ''),
    models: [],
    lastError: null,
    discoveredAt: 0
  };

  const normalized = {
    provider: String(config.provider || config.protocol || 'auto').toLowerCase(),
    baseUrl: normalizeBaseUrl(config.baseUrl),
    apiKey: String(config.apiKey || ''),
    model: String(config.model || ''),
    autoDiscover: config.autoDiscover !== false
  };

  async function discover(force = false) {
    if (!normalized.apiKey) {
      Object.assign(state, { status: 'unconfigured', provider: null, model: '', models: [], lastError: null });
      return state;
    }
    if (!normalized.baseUrl) {
      Object.assign(state, { status: 'error', lastError: 'AI baseUrl 未配置' });
      return state;
    }
    if (!force && state.discoveredAt && Date.now() - state.discoveredAt < 5 * 60 * 1000 && (state.model || state.status === 'error')) return state;

    state.status = 'discovering';
    state.lastError = null;
    const errors = [];
    let models = [];
    let selectedProvider = null;

    if (!normalized.autoDiscover && normalized.model && normalized.provider !== 'auto') {
      state.provider = normalized.provider === 'openai' ? 'openai-compatible' : normalized.provider;
      state.model = normalized.model;
      state.status = 'ready';
      state.discoveredAt = Date.now();
      return state;
    }

    for (const providerId of providerOrder(normalized.provider)) {
      const adapter = adapters[providerId];
      try {
        models = await adapter.listModels(normalized);
        if (models.length) { selectedProvider = providerId; break; }
        errors.push(`${providerId}: 模型列表为空`);
      } catch (error) {
        errors.push(`${providerId}: ${error.message}`);
      }
    }

    state.models = models;
    state.model = chooseModel(models, normalized.model);
    // Some compatible gateways intentionally do not expose /models. If the
    // user pinned a model, keep the runtime usable and let the first real
    // completion determine whether the protocol works.
    if (!selectedProvider && normalized.model) selectedProvider = normalized.provider || 'auto';
    state.provider = selectedProvider || (normalized.provider === 'auto' ? null : normalized.provider);
    state.discoveredAt = Date.now();
    if (!state.model || !state.provider) {
      state.status = 'error';
      state.lastError = `没有发现可用聊天模型。${errors.join('；')}`;
    } else {
      state.status = 'ready';
      state.lastError = errors.length ? errors.join('；') : null;
    }
    return state;
  }

  async function complete(system, prompt) {
    const runtime = await discover();
    if (runtime.status !== 'ready' || !runtime.model || !runtime.provider) return null;
    const order = normalized.provider === 'auto'
      ? [...new Set([runtime.provider, 'openai-compatible', 'anthropic'].filter(Boolean))]
      : providerOrder(runtime.provider);
    const errors = [];
    for (const providerId of order) {
      const adapter = adapters[providerId];
      if (!adapter) continue;
      try {
        const output = await adapter.complete({ ...normalized, model: runtime.model, system, prompt });
        if (output) {
          state.provider = providerId;
          state.status = 'ready';
          state.lastError = null;
          return output;
        }
        errors.push(`${providerId}: 空响应`);
      } catch (error) {
        errors.push(`${providerId}: ${error.message}`);
      }
    }
    state.status = 'error';
    state.lastError = errors.join('；');
    throw new Error(`AI Provider 调用失败：${state.lastError}`);
  }

  function view() {
    return {
      configured: Boolean(normalized.apiKey),
      status: state.status,
      provider: state.provider,
      providerLabel: publicProviderLabel(normalized.baseUrl, state.provider),
      baseUrl: normalized.baseUrl,
      model: state.model,
      modelCount: state.models.length,
      error: state.lastError
    };
  }

  return { discover, complete, view, state };
}

module.exports = { createProviderRuntime };
