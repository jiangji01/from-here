const http = require('http');
const assert = require('assert');
const { createProviderRuntime } = require('./providers');

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}/v1`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

(async () => {
  await withServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/v1/models' && req.headers.authorization === 'Bearer test-key') return res.end(JSON.stringify({ data: [{ id: 'gpt-5-mini' }, { id: 'gpt-5' }] }));
    if (req.url === '/v1/chat/completions') return res.end(JSON.stringify({ choices: [{ message: { content: '[{"i":0}]' } }] }));
    res.statusCode = 404; res.end('{}');
  }, async baseUrl => {
    const runtime = createProviderRuntime({ provider: 'openai-compatible', baseUrl, apiKey: 'test-key', model: '', autoDiscover: true });
    const discovered = await runtime.discover(true);
    assert.equal(discovered.status, 'ready');
    assert.equal(discovered.provider, 'openai-compatible');
    assert.equal(discovered.model, 'gpt-5');
    assert.equal(await runtime.complete('system', 'prompt'), '[{"i":0}]');
  });

  await withServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/v1/models' && req.headers['x-api-key'] === 'test-key') return res.end(JSON.stringify({ data: [{ id: 'claude-haiku-4' }, { id: 'claude-sonnet-4' }] }));
    if (req.url === '/v1/messages') return res.end(JSON.stringify({ content: [{ type: 'text', text: '[{"i":1}]' }] }));
    res.statusCode = 401; res.end('{"error":"wrong protocol"}');
  }, async baseUrl => {
    const runtime = createProviderRuntime({ provider: 'auto', baseUrl, apiKey: 'test-key', model: '', autoDiscover: true });
    const discovered = await runtime.discover(true);
    assert.equal(discovered.status, 'ready');
    assert.equal(discovered.provider, 'anthropic');
    assert.equal(discovered.model, 'claude-sonnet-4');
    assert.equal(await runtime.complete('system', 'prompt'), '[{"i":1}]');
  });

  await withServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/v1/models') return res.end(JSON.stringify({ data: [{ id: 'some-other-model' }] }));
    if (req.url === '/v1/chat/completions') return res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
    res.statusCode = 404; res.end('{}');
  }, async baseUrl => {
    const runtime = createProviderRuntime({ provider: 'openai-compatible', baseUrl, apiKey: 'test-key', model: 'my-local-model-alias', autoDiscover: true });
    const discovered = await runtime.discover(true);
    assert.equal(discovered.model, 'my-local-model-alias');
    assert.equal(await runtime.complete('system', 'prompt'), 'ok');
  });

  console.log('✓ provider adapters + explicit/local model precedence');
})().catch(error => { console.error(error); process.exitCode = 1; });
