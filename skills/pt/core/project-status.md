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
