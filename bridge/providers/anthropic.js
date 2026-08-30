const { fetchJson, modelIds } = require('./common');

const id = 'anthropic';

async function listModels({ baseUrl, apiKey }) {
  const data = await fetchJson(`${baseUrl}/models`, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
  }, 8000);
  return modelIds(data);
}

async function complete({ baseUrl, apiKey, model, system, prompt }) {
  const data = await fetchJson(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1800,
      temperature: 0.25,
      system,
      messages: [{ role: 'user', content: prompt }]
    })
  }, 20000);
  return Array.isArray(data?.content)
    ? data.content.filter(item => item?.type === 'text').map(item => item.text).join('\n')
    : '';
}

module.exports = { id, listModels, complete };
