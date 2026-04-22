Mantenha o estado canônico de iniciativas em `.atomic-skills/` — ler, criar, atualizar e exibir.

## Regra Fundamental

NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE.

Todo código modificado deve ser ancorado a uma iniciativa ativa em `.atomic-skills/initiatives/<slug>.md`, ou o usuário deve declarar explicitamente "ad-hoc".

## Detecção inicial

Rode com {{BASH_TOOL}}:
- `test -d .atomic-skills/` — se não existe, entre em modo setup
- Se existe, leia `.atomic-skills/PROJECT-STATUS.md` e determine iniciativa ativa

## Modos

Ver seções abaixo conforme os args recebidos em {{ARG_VAR}}.

## Setup (quando `.atomic-skills/` não existe)

Anuncie: "Vou configurar project-status neste repo."

### 1. Detectar ambiente
- `test -d .claude/` → Claude Code
- `test -d .cursor/` → Cursor
- `test -d .gemini/` → Gemini CLI
- Caso contrário → IDE genérica; pule passo 5

### 2. Verificar/criar CLAUDE.md
- Se CLAUDE.md ausente: pergunte "Criar CLAUDE.md mínimo com hard-gate? (y/n)" — se sim, crie com um título + template hard-gate
- Se CLAUDE.md existe: prepare-se para injetar bloco entre markers

### 3. Injetar hard-gate em CLAUDE.md (idempotente)
Leia `skills/shared/project-status-assets/CLAUDE.md-gate.template.md` (assets empacotados com a skill).
Verifique se markers `<!-- atomic-skills:status-gate:start -->` já existem:
- Se sim e conteúdo idêntico: pule
- Se sim e conteúdo diferente: apresente diff, pergunte se atualiza
- Se não: append ao final de CLAUDE.md

### 4. AGENTS.md redirect
- Se AGENTS.md ausente: crie a partir de `skills/shared/project-status-assets/AGENTS.md.template.md`
- Se AGENTS.md existe e referencia CLAUDE.md: pule
- Se AGENTS.md existe sem referência: apresente diff sugerindo adição, peça confirmação (não force)

### 5. Instalar hooks (apenas Claude Code)
Apresente Structured Options:
> Qual nível de enforcement?
> (a) Passive — só hard-gate em CLAUDE.md, sem hooks
> (b) Soft (recomendado) — hard-gate + SessionStart hook
> (c) Strict — hard-gate + SessionStart + Stop hook (dry-run 7d antes de strict real)

Para (b) e (c): copie scripts para `.atomic-skills/status/hooks/`, registre em `.claude/settings.local.json`.
Para (c): copie `config.json` com `strict_mode: false` e `dry_run_started: $(date -I)`.

### 6. Criar estrutura

Use {{BASH_TOOL}}:
```bash
mkdir -p .atomic-skills/initiatives/archive
mkdir -p .atomic-skills/status/hooks
```

Copie `PROJECT-STATUS.md.template.md` para `.atomic-skills/PROJECT-STATUS.md`, substituindo `REPLACE_ISO_TIMESTAMP` pelo timestamp atual.

### 7. Atualizar .gitignore
Append (se não existente):
```
.atomic-skills/status/stop.log
.atomic-skills/status/SKIP
.atomic-skills/initiatives/*.rendered.md
```

### 8. Reportar
Liste tudo que foi criado e dê instruções de rollback (`git status` + `git restore`).

## Modos de exibição

### Default (sem args, estrutura existe)

Se há uma iniciativa ativa cuja `branch:` bate com `git rev-parse --abbrev-ref HEAD`:
- Leia `.atomic-skills/initiatives/<slug>.md`, parse frontmatter YAML
- Renderize no terminal:
  1. Header: `▸ <slug> · <status> · depth <N> · updated <timestamp-humano>`
  2. STACK (árvore com box-drawing): cada frame do `stack:` indentado; marque último com ` ◉ HERE`
  3. TASKS (tabela): ID | Title | State-com-ícone | Updated
  4. PARKED + EMERGED lado a lado (2 colunas)
  5. NEXT: `<next_action>` do frontmatter

Ícones Unicode:
- `✓` done, `◉` active, `·` pending, `⊘` blocked, `⌂` parked, `⇥` emerged
- `◉ HERE` marca frame ativo
- `←` ou `waits X` para dependências

Cores ANSI (respeitando `$NO_COLOR`):
- done → verde, active/HERE → ciano, pending/— → cinza, blocked → amarelo, parked → magenta

### `--list`

Tabela de todas iniciativas com `status: active`:

```
┌────────────────┬─────────┬─────────────┬──────────────┬────────────────────────┐
│ Slug           │ Status  │ Started     │ Branch       │ Next Action            │
├────────────────┼─────────┼─────────────┼──────────────┼────────────────────────┤
│ <slug>         │ active  │ YYYY-MM-DD  │ <branch>     │ <next_action>          │
└────────────────┴─────────┴─────────────┴──────────────┴────────────────────────┘
```

### `--stack`

Apenas a seção STACK da iniciativa ativa. 3-8 linhas. Para check rápido mid-session.

### `--archived`

Últimas 10 entradas de `.atomic-skills/initiatives/archive/`, tabular.

## Parsing YAML do frontmatter

Use `src/yaml.js` do repo atomic-skills via {{BASH_TOOL}}:

```bash
node -e "import('./node_modules/@henryavila/atomic-skills/src/yaml.js').then(({parse}) => { const fs = require('fs'); const content = fs.readFileSync('.atomic-skills/initiatives/<slug>.md','utf8'); const fm = content.match(/^---\\n([\\s\\S]*?)\\n---/); console.log(JSON.stringify(parse(fm[1]))); })"
```

Na prática: você (LLM) pode parsear o YAML direto já que é texto; use `src/yaml.js` como referência de robustness quando necessário.
