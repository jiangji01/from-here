const { fetchJson, modelIds } = require('./common');

const id = 'openai-compatible';

async function listModels({ baseUrl, apiKey }) {
  const data = await fetchJson(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  }, 8000);
  return modelIds(data);
}

async function complete({ baseUrl, apiKey, model, system, prompt }) {
  const data = await fetchJson(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ]
    })
  }, 20000);
  return data?.choices?.[0]?.message?.content || '';
}

module.exports = { id, listModels, complete };
