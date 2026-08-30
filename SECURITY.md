# Security

From Here runs a local bridge and may connect to music-service and AI-provider credentials configured on the user's machine.

## Secrets

Never commit or share:

- `bridge/config.local.json`
- `.env` files containing real credentials
- NetEase App private keys / secrets
- API keys, bearer tokens or cookies
- runtime caches copied from a private machine

The default `.gitignore` excludes local configuration and runtime data.

From Here does not need to store NetEase credentials itself; authentication is delegated to `ncm-cli`.

## Local bridge

The bridge binds to `127.0.0.1` by default. Do not change it to `0.0.0.0` or expose it publicly without adding authentication and a proper threat model.

## Reporting a vulnerability

Use GitHub's private security advisory feature instead of opening an issue that contains exploit details or credentials. You can also contact the maintainer at **jiangji628@gmail.com** for security-related reports.
