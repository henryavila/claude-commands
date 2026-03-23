---
name: npm-publish-pattern
description: Padrão correto para publicação npm via GitHub Actions usando OIDC Trusted Publishing
type: reference
---

O padrão correto de CI para publicar no npm está em `~/codeguard/.github/workflows/publish.yml`:

- Trigger: `release: types: [published]` (não `push: tags`)
- Auth: OIDC Trusted Publishing (sem NPM_TOKEN secret)
- Permissions: `id-token: write`
- npm atualizado: `npm install -g npm@latest` (OIDC requer ≥11.5.1)
- Publish: `npm publish --provenance --access public`

**Configuração no npmjs.com:** Settings > Publishing access > Add GitHub Actions
(repository owner, name, workflow filename, environment vazio)

**Bug encontrado:** `package.json` com `"bin": {"atomic-skills": "./bin/cli.js"}` causa warning.
O `./` precisa ser removido — usar `"bin/cli.js"` sem prefixo. `npm pkg fix` corrige isso.
