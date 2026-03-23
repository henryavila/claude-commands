# User-Scope Installation Support

**Date:** 2026-03-23
**Status:** Approved

## Summary

Add support for installing skills at user scope (`~/`) in addition to the existing
project scope (`./`). This makes skills available across all repositories without
re-installing per project.

## Motivation

Currently `atomic-skills install` only installs into the project directory. Users who
want the same skills in every repo must run the installer in each one. Most AI IDEs
support user-level skills (e.g. `~/.claude/skills/`), so the installer should leverage
this.

## Design Decisions

- **Scope selection via interactive prompt** — first prompt after language selection
- **CLI override** — `--scope user` or `--scope project` skips the prompt
- **No "Both" option** — user runs the installer twice if they want both scopes;
  avoids precedence confusion
- **Modules declare their supported scope** — `scope` field in `module.yaml`
  (`project`, `user`, or `both`; default `both`)
- **Independent manifests** — `~/.atomic-skills/manifest.json` for user scope,
  `.atomic-skills/manifest.json` for project scope
- **IDEs declare user-scope support** — `supportsUserScope` in `IDE_CONFIG`;
  IDEs without support are hidden when scope = user

## Affected Files

### `bin/cli.js`

Parse `--scope` from argv:

```js
const scopeIdx = argv.indexOf('--scope')
const scope = scopeIdx !== -1 ? argv[scopeIdx + 1] : null

if (scope && scope !== 'user' && scope !== 'project') {
  console.error('Error: --scope must be "user" or "project"')
  process.exit(1)
}

// null = interactive prompt; 'user' or 'project' = skip prompt
```

Pass `scope` to `install()` and `uninstall()`.

### `src/config.js`

Add `supportsUserScope` to each IDE entry. Remove `userDir` — it is derived from
`ide.dir` resolved against `os.homedir()` instead of `cwd`, so no separate field
is needed.

```js
'claude-code': {
  dir: '.claude/skills/',
  format: 'markdown',
  filePattern: (skillName) => posix.join(skillName, 'SKILL.md'),  // unchanged (function)
  supportsUserScope: true,
},
// same pattern for cursor, gemini, codex, opencode, github-copilot
```

**`getSkillPath()` changes:**

Current signature: `getSkillPath(ideId, skillName)` — always uses `ide.dir`.

New: no change needed. `getSkillPath` returns a relative path like
`.claude/skills/as-fix/SKILL.md`. The caller (`installSkills`) joins it with
`basePath` which is either `cwd` (project) or `homedir` (user). Since `ide.dir`
is the same relative segment in both scopes (e.g. `.claude/skills/`), joining with
homedir produces the correct absolute path (`/home/user/.claude/skills/as-fix/SKILL.md`).

If a future IDE requires a different user-level path (e.g. `~/.config/ide/skills/`
instead of `~/.ide/skills/`), a `userDir` field can be added at that point.

### `src/prompts.js`

**New prompt — `promptScope()`:**

```
? Installation scope:      |  ? Escopo de instalação:
  ❯ Project — this repo    |    ❯ Projeto — somente este repo
    User — all your repos  |      Usuário — todos os seus repos
```

**New prompt — `promptUninstallScope()`:**

For uninstall when both manifests exist:

```
? Which installation to remove?  |  ? Qual instalação remover?
  ❯ Project — this repo          |    ❯ Projeto — somente este repo
    User — all your repos        |      Usuário — todos os seus repos
```

**Flow order changes:**

```
1. promptLanguage()        (unchanged)
2. promptScope()           (NEW)
3. promptReuseConfig()     (reads manifest from scope-appropriate path)
4. promptIDEs()            (filters by supportsUserScope when scope = user)
5. promptModule()          (filters by module.scope vs chosen scope)
```

### `src/install.js`

**Function signatures:**

`install()` (interactive, line ~189) — new signature:

```js
async function install(projectDir, scope = null)
// scope: null = prompt, 'user' | 'project' = skip prompt
// When scope is determined (via prompt or arg), compute basePath:
//   basePath = scope === 'user' ? os.homedir() : projectDir
```

`installSkills()` (core non-interactive, line ~25) — new signature:

```js
async function installSkills(basePath, selectedIDEs, language, modules, existingManifest, scope)
// basePath: already resolved (homedir or cwd)
// scope: needed for .gitignore guard and module filtering
```

**Base path resolution:**

```js
const basePath = scope === 'user' ? os.homedir() : projectDir
```

All path operations use `basePath`:
- Skill file paths: `path.join(basePath, getSkillPath(ideId, skillName))`
- Manifest: `path.join(basePath, '.atomic-skills')`
- `.gitignore`: only modified when `scope === 'project'`

**Module filtering:**

Currently module discovery is hardcoded to load only `memory`. The filtering
integrates at the existing loading point (line ~214):

```js
// Load module.yaml
const moduleYaml = loadModuleYaml('memory')
const moduleScope = moduleYaml.scope || 'both'

// Skip module if scope is incompatible
if (moduleScope !== 'both' && moduleScope !== scope) {
  // Don't prompt for this module
} else {
  // Existing promptModule() flow
}
```

When new modules are added, this becomes a loop over discovered modules with the
same filter logic.

**IDE filtering:**

When scope = `user`, filter `IDE_CONFIG` before presenting to `promptIDEs()`:

```js
const availableIDEs = scope === 'user'
  ? Object.entries(IDE_CONFIG).filter(([_, cfg]) => cfg.supportsUserScope)
  : Object.entries(IDE_CONFIG)
```

Everything else (rendering, conflict detection, 3-hash system, orphan cleanup)
remains unchanged — already works with absolute paths internally.

### `src/manifest.js`

`readManifest()` and `writeManifest()` accept a `basePath` parameter instead of
assuming `process.cwd()`:

```js
function readManifest(basePath = process.cwd()) {
  const dir = path.join(basePath, MANIFEST_DIR)
  // ...
}

function writeManifest(basePath, data) {
  const dir = path.join(basePath, MANIFEST_DIR)
  // ...
}
```

Manifest stores relative paths (e.g. `.claude/skills/as-fix/SKILL.md`) in both
scopes. The basePath is used to resolve them to absolute paths at read/write time.
This keeps manifests portable and consistent.

### `src/uninstall.js`

**Function signature:**

```js
async function uninstall(projectDir, scope = null)
```

**Scope detection (when `scope` is null):**

1. Check if manifest exists in `projectDir` → `hasProject = true`
2. Check if manifest exists in `os.homedir()` → `hasUser = true`
3. If both → `promptUninstallScope()` (new prompt)
4. If only one → use that scope
5. If neither → error message and exit

**`.gitignore` message:** Suppress the "keeping .gitignore entry" message when
scope = `user` (user-scope install does not touch `.gitignore`).

Rest of the flow is identical to current behavior with the resolved basePath.

### `skills/modules/memory/module.yaml`

Add `scope: project`:

```yaml
scope: project
display_name:
  pt: Memória persistente
  en: Persistent memory
# ...rest unchanged
```

## Files NOT Changed

- `src/render.js` — rendering is scope-agnostic
- `src/hash.js` — hashing is scope-agnostic
- `src/yaml.js` — parsing is scope-agnostic
- `skills/**/*.md` — skill source files unchanged

## Backwards Compatibility

- Default behavior unchanged: without `--scope`, the prompt asks; existing scripts
  using `atomic-skills install` continue to work
- `installSkills()` parameter list changes but is not part of the public API;
  existing tests call it with positional args that need updating for the new
  `scope` parameter (add `'project'` as last arg to maintain current behavior)
- Existing manifests remain valid (they're project-scope by definition)
- Modules without `scope` field default to `both`

## Testing

- Existing tests need minor update: pass `scope = 'project'` to `installSkills()`
- New tests for:
  - `--scope` validation (invalid values error)
  - Scope prompt selection
  - Path resolution for user scope (basePath = homedir)
  - Module filtering by scope (memory hidden when scope = user)
  - IDE filtering by supportsUserScope
  - Uninstall scope detection (both manifests exist case)
  - Manifest read/write with custom basePath
  - `.gitignore` not modified for user scope

## Also Included (Separate Commit)

- `.github/workflows/publish.yml` updated to use OIDC Trusted Publishing and
  `release: published` trigger (matching codeguard pattern)
