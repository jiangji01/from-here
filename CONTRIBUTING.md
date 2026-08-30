# Contributing

Thanks for helping From Here explore session-aware recommendation.

## Before opening a PR

Please preserve these product constraints:

1. Music services own catalog recall and playback whenever practical.
2. AI may plan recall directions and rank real candidates; it must not invent final playback results outside the music-service catalog.
3. Session state is temporary by default.
4. New provider implementations belong behind `bridge/providers/`.
5. New music services should be adapters, not special cases inside the Session Engine.
6. Do not commit credentials, tokens, cookies, private keys or local caches.

## Development

```bash
cd bridge
npm test
```

The test suite must pass without network access, music-service credentials or an AI key.

Before submitting:

```bash
node --check bridge/server.js
node --check bridge/providers/index.js
npm test --prefix bridge
```

## Areas where contributions are especially useful

- more robust `ncm-cli` response adapters;
- provider adapters (Ollama / local models are especially interesting);
- Windows / Linux current-playing adapters;
- Spotify / Apple Music / YouTube Music recall + playback adapters;
- accessibility and keyboard interaction in the Side Panel;
- better session-aware ranking without requiring an LLM.

## Maintainer

Created and maintained by **Jipeng Song / 宋吉鹏**.

- Blog: https://nclcat.com
- Email: jiangji628@gmail.com
