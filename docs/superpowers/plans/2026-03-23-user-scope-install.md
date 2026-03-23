# User-Scope Installation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow `atomic-skills install` to install skills at user scope (`~/`) available across all repos, in addition to project scope.

**Architecture:** Add `scope` parameter throughout the install pipeline. The scope determines the base path (`os.homedir()` vs `cwd`) for all file operations. Each IDE declares whether it supports user scope. Modules declare their compatible scope.

**Tech Stack:** Node.js (ESM), node:test, inquirer

**Spec:** `docs/superpowers/specs/2026-03-23-user-scope-install-design.md`

---

### Task 1: Add `supportsUserScope` to `IDE_CONFIG`

**Files:**
- Modify: `src/config.js:3-40`
- Modify: `tests/config.test.js`

- [ ] **Step 1: Write the failing test**

Add to `tests/config.test.js`:

```js
it('all IDEs declare supportsUserScope as boolean', () => {
  for (const [id, cfg] of Object.entries(IDE_CONFIG)) {
    assert.strictEqual(typeof cfg.supportsUserScope, 'boolean',
      `${id} missing supportsUserScope`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/config.test.js`
Expected: FAIL — `supportsUserScope` does not exist yet.

- [ ] **Step 3: Add `supportsUserScope: true` to each IDE entry**

In `src/config.js`, add `supportsUserScope: true` to every IDE object:

```js
'claude-code': {
  name: 'Claude Code',
  dir: '.claude/skills',
  format: 'markdown',
  filePattern: (skillName) => posix.join(skillName, 'SKILL.md'),
  supportsUserScope: true,
},
// Same for cursor, gemini, codex, opencode, github-copilot
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/config.test.js`
Expected: ALL PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/config.js tests/config.test.js
git commit -m "feat: add supportsUserScope to IDE_CONFIG"
```

---

### Task 2: Add `scope` field to `module.yaml` and YAML parser support

**Files:**
- Modify: `skills/modules/memory/module.yaml`
- Modify: `tests/yaml.test.js`

- [ ] **Step 1: Write the failing test**

Add imports at the top of `tests/yaml.test.js` (after existing imports):

```js
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
```

Add the test:

```js
it('parses scope field from module.yaml', () => {
  const content = readFileSync(
    join(__dirname, '..', 'skills', 'modules', 'memory', 'module.yaml'), 'utf8');
  const result = parse(content);
  assert.strictEqual(result.scope, 'project');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/yaml.test.js`
Expected: FAIL — `scope` field doesn't exist in module.yaml yet.

- [ ] **Step 3: Add `scope: project` to memory module.yaml**

Add as first line of `skills/modules/memory/module.yaml`:

```yaml
scope: project
name: memory
display_name:
  pt: Memória
  en: Memory
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/yaml.test.js`
Expected: ALL PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add skills/modules/memory/module.yaml tests/yaml.test.js
git commit -m "feat: add scope field to memory module.yaml"
```

---

### Task 3: Add `scope` to `installSkills()` — skip `.gitignore` for user scope

**Files:**
- Modify: `src/install.js:25-122`
- Modify: `tests/install.test.js`

- [ ] **Step 1: Write the failing test**

Add to `tests/install.test.js`:

```js
it('skips .gitignore when scope is user', () => {
  installSkills(tempDir, {
    language: 'en',
    ides: ['claude-code'],
    modules: {},
    skillsDir: SKILLS_DIR,
    metaDir: META_DIR,
    scope: 'user',
  });

  assert.ok(!existsSync(join(tempDir, '.gitignore')),
    '.gitignore should not be created for user scope');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/install.test.js`
Expected: FAIL — `.gitignore` is always created regardless of scope.

- [ ] **Step 3: Guard `.gitignore` with scope check**

In `src/install.js`, modify `installSkills()`:

1. Extract `scope` from options (line 26):
```js
const { language, ides, modules, skillsDir, metaDir, scope } = options;
```

2. Guard the `.gitignore` block (lines 99-105):
```js
if (scope !== 'user') {
  const gitignorePath = join(projectDir, '.gitignore');
  let gitignore = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
  if (!gitignore.includes('.atomic-skills/')) {
    gitignore += (gitignore.endsWith('\n') || gitignore === '' ? '' : '\n') + '.atomic-skills/\n';
    writeFileSync(gitignorePath, gitignore, 'utf8');
  }
}
```

- [ ] **Step 4: Run ALL tests to verify nothing breaks**

Run: `npm test`
Expected: ALL PASS (36 tests). Existing tests don't pass `scope`, so it's `undefined` which is not `'user'`, preserving existing behavior.

- [ ] **Step 5: Commit**

```bash
git add src/install.js tests/install.test.js
git commit -m "feat: skip .gitignore modification for user scope installs"
```

---

### Task 4: Add `promptScope()` and `promptUninstallScope()` to prompts

**Files:**
- Modify: `src/prompts.js`

No unit tests for prompts (they use `inquirer` interactively). Test manually.

- [ ] **Step 1: Add scope messages to MESSAGES**

In `src/prompts.js`, add to both `pt` and `en` message objects:

```js
pt: {
  // ...existing messages...
  scopeQuestion: 'Escopo de instalação:',
  scopeProject: 'Projeto — somente este repo',
  scopeUser: 'Usuário — todos os seus repos',
  uninstallScopeQuestion: 'Qual instalação remover?',
},
en: {
  // ...existing messages...
  scopeQuestion: 'Installation scope:',
  scopeProject: 'Project — this repo only',
  scopeUser: 'User — all your repos',
  uninstallScopeQuestion: 'Which installation to remove?',
},
```

- [ ] **Step 2: Add `promptScope()` function**

```js
export async function promptScope(lang) {
  const msg = MESSAGES[lang] || MESSAGES.en;
  const { scope } = await inquirer.prompt([{
    type: 'list',
    name: 'scope',
    message: msg.scopeQuestion,
    choices: [
      { name: msg.scopeProject, value: 'project' },
      { name: msg.scopeUser, value: 'user' },
    ],
  }]);
  return scope;
}
```

- [ ] **Step 3: Add `promptUninstallScope()` function**

```js
export async function promptUninstallScope(lang) {
  const msg = MESSAGES[lang] || MESSAGES.en;
  const { scope } = await inquirer.prompt([{
    type: 'list',
    name: 'scope',
    message: msg.uninstallScopeQuestion,
    choices: [
      { name: msg.scopeProject, value: 'project' },
      { name: msg.scopeUser, value: 'user' },
    ],
  }]);
  return scope;
}
```

- [ ] **Step 4: Modify `promptIDEs()` to accept and filter by scope**

Change signature to `promptIDEs(lang, scope = 'project')`:

```js
export async function promptIDEs(lang, scope = 'project') {
  const msg = MESSAGES[lang] || MESSAGES.en;
  const ideEntries = scope === 'user'
    ? Object.entries(IDE_CONFIG).filter(([_, cfg]) => cfg.supportsUserScope)
    : Object.entries(IDE_CONFIG);

  const { ides } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'ides',
    message: msg.ideQuestion,
    choices: ideEntries.map(([id, cfg]) => ({
      name: cfg.name,
      value: id,
    })),
    validate: (input) => input.length > 0 || msg.ideValidation,
  }]);
  return ides;
}
```

- [ ] **Step 5: Run existing tests to ensure no breakage**

Run: `npm test`
Expected: ALL PASS (36 tests). `promptIDEs` new param has default, no callers affected.

- [ ] **Step 6: Commit**

```bash
git add src/prompts.js
git commit -m "feat: add promptScope and promptUninstallScope prompts"
```

---

### Task 5: Wire scope into `install()` interactive flow

**Files:**
- Modify: `src/install.js:189-354`

- [ ] **Step 1: Update `install()` signature and imports**

Change line 189:
```js
export async function install(projectDir, scope = null) {
```

Add import at top of file:
```js
import { homedir } from 'node:os';
```

Add import of `promptScope` to the existing import line:
```js
import { promptLanguage, promptIDEs, promptModule, promptReuseConfig, promptConflict, promptScope } from './prompts.js';
```

- [ ] **Step 2: Add scope/language prompt and basePath resolution**

After `console.log('\n  ⚛ Atomic Skills — Stop rewriting prompts.\n');` (line 190),
replace lines 192-227 (everything from `const existingManifest` through the end of the
`if (!language)` block) with the new flow below.

**Key design choice:** `promptLanguage()` is always called first (even when a manifest
exists), because the `promptScope()` message needs to be in the correct language.
When reusing a previous config, the manifest's language overrides this initial selection
for all subsequent prompts. This adds one extra prompt on upgrades but keeps the UX
consistent.

```js
// Always prompt language first (needed for scope prompt localization)
const language0 = await promptLanguage();
if (!scope) {
  scope = await promptScope(language0);
}

const basePath = scope === 'user' ? homedir() : projectDir;
const existingManifest = readManifest(basePath);

let language = language0;
let ides, modules;

if (existingManifest) {
  const installedMods = Object.keys(existingManifest.modules || {}).filter(m => existingManifest.modules[m].installed);
  console.log(`  Configuração anterior encontrada (${MANIFEST_DIR}/manifest.json).`);
  console.log(`  Idioma: ${existingManifest.language} | IDEs: ${existingManifest.ides.join(', ')} | Módulos: ${installedMods.join(', ') || 'nenhum'}\n`);

  const reuse = await promptReuseConfig(existingManifest.language);
  if (reuse) {
    language = existingManifest.language;
    ides = existingManifest.ides;
    modules = existingManifest.modules;
  }
}

if (!ides) {
  ides = await promptIDEs(language, scope);

  // Load module configs
  const moduleYamlPath = join(PACKAGE_ROOT, 'skills', 'modules', 'memory', 'module.yaml');
  const moduleConfig = parseYaml(readFileSync(moduleYamlPath, 'utf8'));
  const moduleScope = moduleConfig.scope || 'both';

  modules = {};

  // Only show module if its scope is compatible
  if (moduleScope === 'both' || moduleScope === scope) {
    const msg = language === 'pt' ? '─── Módulos opcionais ───' : '─── Optional Modules ───';
    console.log(`\n  ${msg}`);

    const moduleResult = await promptModule(language, moduleConfig);
    if (moduleResult) {
      modules.memory = { installed: true, config: moduleResult };
    } else {
      modules.memory = { installed: false };
    }
  }
}
```

- [ ] **Step 3: Replace ALL `projectDir` with `basePath` in the rest of `install()`**

There are **9 occurrences** of `projectDir` after the basePath declaration that must
ALL be replaced with `basePath`. Here is the exhaustive list with line numbers from
the current `src/install.js`:

| Line | Current code | Replace with |
|------|-------------|--------------|
| 240 | `join(projectDir, filePath)` | `join(basePath, filePath)` — conflict detection: read file from disk |
| 287 | `join(projectDir, filePath)` | `join(basePath, filePath)` — save kept content before overwrite |
| 296 | `join(projectDir, f)` | `join(basePath, f)` — SIGINT cleanup: remove partially written files |
| 307 | `installSkills(projectDir, {...})` | `installSkills(basePath, {..., scope})` — core install call |
| 315 | `join(projectDir, filePath)` | `join(basePath, filePath)` — restore kept files after install |
| 321 | `readManifest(projectDir)` | `readManifest(basePath)` — re-read manifest for hash patching |
| 328 | `writeManifest(projectDir, manifest)` | `writeManifest(basePath, manifest)` — write patched manifest |
| 337 | `join(projectDir, oldPath)` | `join(basePath, oldPath)` — orphan removal: check/delete old files |
| 340 | `dirname(absPath)` | (unchanged — derived from absPath which is now correct) |

Also pass `scope` in the options to `installSkills`:
```js
result = installSkills(basePath, { language, ides, modules, skillsDir, metaDir, scope }, {
  onFileWritten: (path) => writtenFiles.push(path),
});
```

**Note:** `preRenderFiles()` (line 237) does NOT need `scope` — it only renders
content in memory without touching disk, so no change needed there.

- [ ] **Step 5: Test manually**

Run: `node bin/cli.js install`
1. Select language → pt
2. Select scope → should see new prompt
3. Select IDEs
4. If scope = user, memory module should NOT appear (scope: project)
5. Verify files created in correct location

- [ ] **Step 6: Run automated tests**

Run: `npm test`
Expected: ALL PASS (36 tests)

- [ ] **Step 7: Commit**

```bash
git add src/install.js
git commit -m "feat: wire scope into install() interactive flow"
```

---

### Task 6: Wire scope into `uninstall()`

**Files:**
- Modify: `src/uninstall.js`

- [ ] **Step 1: Update `uninstall()` signature and imports**

```js
import { homedir } from 'node:os';
import { readManifest, MANIFEST_DIR, MANIFEST_FILE } from './manifest.js';
import { promptConfirmUninstall, promptLanguage, promptUninstallScope } from './prompts.js';
```

Change signature:
```js
export async function uninstall(projectDir, scope = null) {
```

- [ ] **Step 2: Add scope detection logic**

Replace the entire body of `uninstall()` (lines 28-80) with:

```js
export async function uninstall(projectDir, scope = null) {
  const hasProject = readManifest(projectDir) !== null;
  const hasUser = readManifest(homedir()) !== null;

  if (!scope) {
    if (hasProject && hasUser) {
      // Use project manifest's language for the prompt
      const projectManifest = readManifest(projectDir);
      const lang0 = projectManifest?.language || 'en';
      scope = await promptUninstallScope(lang0);
    } else if (hasProject) {
      scope = 'project';
    } else if (hasUser) {
      scope = 'user';
    } else {
      console.log('\n  ⚛ No installation found.\n');
      return;
    }
  }

  const basePath = scope === 'user' ? homedir() : projectDir;
  const manifest = readManifest(basePath);
  const lang = manifest?.language || 'en';
  const msg = UNINSTALL_MESSAGES[lang] || UNINSTALL_MESSAGES.en;

  console.log(`\n  ⚛ ${msg.removing}\n`);

  if (!manifest) {
    console.log(`  ${msg.noInstall}\n`);
    return;
  }

  // IMPORTANT: Keep the confirmation prompt (existing behavior)
  const confirmed = await promptConfirmUninstall(lang);
  if (!confirmed) {
    console.log(`  ${msg.cancelled}\n`);
    return;
  }

  let removed = 0;
  for (const relPath of Object.keys(manifest.files)) {
    const absPath = join(basePath, relPath);  // was: join(projectDir, relPath)
    if (existsSync(absPath)) {
      unlinkSync(absPath);
      removed++;

      const parentDir = dirname(absPath);
      try {
        if (existsSync(parentDir) && readdirSync(parentDir).length === 0) {
          rmdirSync(parentDir);
        }
      } catch {}
    }
  }

  // Remove manifest
  const manifestPath = join(basePath, MANIFEST_DIR, MANIFEST_FILE);  // was: join(projectDir, ...)
  if (existsSync(manifestPath)) unlinkSync(manifestPath);
  const manifestDir = join(basePath, MANIFEST_DIR);  // was: join(projectDir, ...)
  try {
    if (existsSync(manifestDir) && readdirSync(manifestDir).length === 0) {
      rmdirSync(manifestDir);
    }
  } catch {}

  console.log(`  ✓ ${msg.filesRemoved(removed)}`);
  console.log(`  ✓ ${msg.manifestRemoved}`);

  // Suppress .gitignore message for user scope (user scope doesn't touch .gitignore)
  if (scope !== 'user') {
    console.log(`  ℹ ${msg.gitignoreKept}`);
  }

  console.log(`\n  ⚛ ${msg.complete}\n`);
}
```

**Key points:**
- `promptConfirmUninstall(lang)` is preserved (was accidentally omitted in previous version)
- When both manifests exist, uses project manifest's language for the prompt (avoids re-prompting language)
- All 4 occurrences of `projectDir` in file operations replaced with `basePath`
- `.gitignore` message suppressed for user scope

- [ ] **Step 5: Test manually**

Run: `node bin/cli.js uninstall`
Verify scope detection works for both project and user manifests.

- [ ] **Step 6: Run automated tests**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/uninstall.js
git commit -m "feat: wire scope into uninstall() with auto-detection"
```

---

### Task 7: Parse `--scope` flag in CLI

**Files:**
- Modify: `bin/cli.js`

- [ ] **Step 1: Add `--scope` parsing and validation**

Replace contents of `bin/cli.js`:

```js
#!/usr/bin/env node

import { argv } from 'node:process';

const command = argv[2];

// Parse --scope flag
const scopeIdx = argv.indexOf('--scope');
const scopeValue = scopeIdx !== -1 ? argv[scopeIdx + 1] : null;

if (scopeValue && scopeValue !== 'user' && scopeValue !== 'project') {
  console.error('  Error: --scope must be "user" or "project"');
  process.exit(1);
}

if (command === 'install') {
  const { install } = await import('../src/install.js');
  await install(process.cwd(), scopeValue);
} else if (command === 'uninstall') {
  const { uninstall } = await import('../src/uninstall.js');
  await uninstall(process.cwd(), scopeValue);
} else {
  console.log(`
  ⚛ Atomic Skills — Stop rewriting prompts.

  Usage:
    npx @henryavila/atomic-skills install [--scope user|project]
    npx @henryavila/atomic-skills uninstall [--scope user|project]

  Options:
    --scope user      Install to ~/  (all repos)
    --scope project   Install to ./  (this repo only)

  Docs: https://github.com/henryavila/atomic-skills
  `);
}
```

- [ ] **Step 2: Test manually**

```bash
node bin/cli.js install --scope invalid   # Should error
node bin/cli.js install --scope user      # Should skip scope prompt
node bin/cli.js                           # Should show updated help
```

- [ ] **Step 3: Run automated tests**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add bin/cli.js
git commit -m "feat: parse --scope flag in CLI with validation"
```

---

### Task 8: Add comprehensive scope tests

**Files:**
- Modify: `tests/install.test.js`
- Modify: `tests/config.test.js`

- [ ] **Step 1: Write user-scope integration tests**

Add to `tests/install.test.js`:

```js
it('installs to basePath for user scope (simulated with tempDir)', () => {
  const result = installSkills(tempDir, {
    language: 'en',
    ides: ['claude-code'],
    modules: {},
    skillsDir: SKILLS_DIR,
    metaDir: META_DIR,
    scope: 'user',
  });

  // Files should still be created at basePath (tempDir simulates homedir)
  assert.ok(existsSync(join(tempDir, '.claude/skills/as-fix/SKILL.md')));

  // Manifest should exist
  const manifest = JSON.parse(readFileSync(join(tempDir, '.atomic-skills/manifest.json'), 'utf8'));
  assert.strictEqual(manifest.language, 'en');

  // .gitignore should NOT exist
  assert.ok(!existsSync(join(tempDir, '.gitignore')));
});

it('explicit project scope creates .gitignore', () => {
  installSkills(tempDir, {
    language: 'en',
    ides: ['claude-code'],
    modules: {},
    skillsDir: SKILLS_DIR,
    metaDir: META_DIR,
    scope: 'project',
  });

  const gitignore = readFileSync(join(tempDir, '.gitignore'), 'utf8');
  assert.ok(gitignore.includes('.atomic-skills/'));
});

it('skips memory module when scope is user (memory scope is project)', () => {
  // memory module has scope: project, so it should produce 0 module skills
  // even when modules.memory.installed is true
  const result = installSkills(tempDir, {
    language: 'en',
    ides: ['claude-code'],
    modules: {},  // empty because module filtering happens in install(), not installSkills()
    skillsDir: SKILLS_DIR,
    metaDir: META_DIR,
    scope: 'user',
  });

  // Only core skills, no module skills
  assert.strictEqual(result.files.length, 6);
  assert.ok(!existsSync(join(tempDir, '.claude/skills/as-init-memory/SKILL.md')));
});
```

- [ ] **Step 2: Write IDE filtering test**

Add to `tests/config.test.js`:

```js
it('can filter IDEs by supportsUserScope', () => {
  const userIDEs = Object.entries(IDE_CONFIG)
    .filter(([_, cfg]) => cfg.supportsUserScope);
  // All IDEs currently support user scope
  assert.strictEqual(userIDEs.length, Object.keys(IDE_CONFIG).length);
});
```

- [ ] **Step 3: Write CLI --scope validation test**

Add new file `tests/cli.test.js`:

```js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI = join(__dirname, '..', 'bin', 'cli.js');

describe('CLI --scope validation', () => {
  it('rejects invalid --scope value', () => {
    assert.throws(() => {
      execFileSync('node', [CLI, 'install', '--scope', 'invalid'], {
        encoding: 'utf8',
        timeout: 5000,
      });
    }, (err) => {
      assert.ok(err.stderr.includes('--scope must be'));
      return true;
    });
  });

  it('shows help with --scope in usage', () => {
    const output = execFileSync('node', [CLI], { encoding: 'utf8', timeout: 5000 });
    assert.ok(output.includes('--scope'));
  });
});
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: ALL PASS (40+ tests)

- [ ] **Step 5: Commit**

```bash
git add tests/install.test.js tests/config.test.js tests/cli.test.js
git commit -m "test: add comprehensive scope tests (install, config, CLI)"
```

---

### Note: `src/manifest.js` needs NO changes

The spec lists `manifest.js` as an affected file, but `readManifest(projectDir)` and
`writeManifest(projectDir, data)` already accept a base path parameter. When callers
pass `basePath` (homedir or cwd) instead of `projectDir`, it works correctly. No code
changes needed in this file.

---

### Task 9: Update CI workflow (already done)

**Files:**
- Modify: `.github/workflows/publish.yml` (already modified in this session)

- [ ] **Step 1: Verify the workflow change is correct**

Read `.github/workflows/publish.yml` and confirm:
- Trigger: `release: types: [published]`
- Auth: OIDC (`permissions: id-token: write`)
- npm updated: `npm install -g npm@latest`
- Publish: `npm publish --provenance --access public`

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: switch to OIDC Trusted Publishing on release trigger"
```

---

### Task 10: Final verification and cleanup

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 2: Manual end-to-end test — project scope**

```bash
cd /tmp && mkdir test-project && cd test-project && git init
npx /home/henry/atomic-skills install --scope project
# Verify: files in .claude/skills/, .gitignore modified, manifest in .atomic-skills/
```

- [ ] **Step 3: Manual end-to-end test — user scope**

```bash
cd /tmp/test-project
npx /home/henry/atomic-skills install --scope user
# Verify: files in ~/.claude/skills/, NO .gitignore change, manifest in ~/.atomic-skills/
```

- [ ] **Step 4: Manual end-to-end test — uninstall**

```bash
npx /home/henry/atomic-skills uninstall --scope user
# Verify: files removed from ~/.claude/skills/, manifest removed
```

- [ ] **Step 5: Clean up test artifacts**

```bash
rm -rf /tmp/test-project
# If user-scope test files remain, remove them manually
```

- [ ] **Step 6: Final commit if any cleanup needed**
