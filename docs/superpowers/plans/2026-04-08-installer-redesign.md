# Installer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sequential-prompt installer with a dashboard-first UX that auto-detects defaults and installs with one keypress.

**Architecture:** The core `installSkills()` and `preRenderFiles()` functions remain untouched, along with all downstream systems (manifest, render, hash, config, yaml). Only the interactive layer changes: new auto-detection module, @clack-based prompts replacing inquirer, CLI flag parsing via `node:util parseArgs`, and a new `status` command.

**Tech Stack:** `@clack/prompts` (interactive prompts), `picocolors` (terminal colors), `node:util parseArgs` (CLI flags)

---

## Design Decisions

1. **@clack/prompts, not @clack/core:** The spec mentions @clack/core for a custom dashboard component. We use @clack/prompts' `select()` with config info printed above — achieves "one screen, all defaults visible, Enter to install" with far less complexity. A custom @clack/core component can be added later.

2. **IDE display:** Only 6 primary IDEs shown to users (`claude-code`, `cursor`, `gemini`, `codex`, `opencode`, `github-copilot`). The `gemini-commands` entry is internal — auto-applied when both Gemini CLI and Codex are selected.

3. **Non-interactive conflicts:** In `--yes` mode, all conflicts default to "keep local" (safe). Unmodified orphans are removed silently, modified orphans are kept.

4. **API verification:** Before implementing, use context7 to resolve `@clack/prompts` and query the latest API for `select`, `multiselect`, `confirm`, `text`, `intro`, `outro`, `log`, `isCancel`, and `note`.

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/detect.js` | Create | Language detection from `LANG`/`Intl`, IDE detection from directories, skill counting |
| `src/ui.js` | Create | All prompts (dashboard, action, IDEs, lang, modules, conflicts, uninstall) + post-install output + i18n |
| `src/status.js` | Create | `status` command: read manifest, verify files on disk, report health |
| `bin/cli.js` | Rewrite | `parseArgs` flag parsing + command routing to install/uninstall/status |
| `src/install.js` | Modify | Refactor `install()` for dashboard loop + `--yes` mode; export `getPackageVersion()`; `installSkills()` and `preRenderFiles()` untouched |
| `src/uninstall.js` | Modify | Replace 2 inquirer prompt imports with ui.js equivalents |
| `src/prompts.js` | Delete | Fully replaced by `src/ui.js` |
| `tests/detect.test.js` | Create | Auto-detection unit tests |
| `tests/status.test.js` | Create | Status command data verification tests |
| `tests/cli.test.js` | Rewrite | New flag parsing + status command tests |
| `package.json` | Modify | `+@clack/prompts +picocolors -inquirer` (remove inquirer last) |

**Unchanged (must still pass all existing tests):** `src/config.js`, `src/hash.js`, `src/manifest.js`, `src/render.js`, `src/yaml.js`, `tests/install.test.js`, `tests/update.test.js`, `tests/config.test.js`, `tests/hash.test.js`, `tests/manifest.test.js`, `tests/render.test.js`, `tests/yaml.test.js`, `tests/compatibility.test.js`.

---

### Task 1: Dependencies + Auto-Detection Module

**Files:**
- Modify: `package.json`
- Create: `src/detect.js`
- Create: `tests/detect.test.js`

- [ ] **Step 1: Install new dependencies (keep inquirer for now)**

```bash
cd /home/henry/atomic-skills
npm install @clack/prompts picocolors
```

Expected: `package.json` now lists both `@clack/prompts` and `picocolors` in dependencies alongside `inquirer`.

- [ ] **Step 2: Write tests/detect.test.js**

```js
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectLanguage, detectIDEs, countSkills } from '../src/detect.js';

describe('detectLanguage', () => {
  const originalLang = process.env.LANG;

  afterEach(() => {
    if (originalLang !== undefined) {
      process.env.LANG = originalLang;
    } else {
      delete process.env.LANG;
    }
  });

  it('returns pt when LANG starts with pt', () => {
    process.env.LANG = 'pt_BR.UTF-8';
    assert.strictEqual(detectLanguage(), 'pt');
  });

  it('returns en when LANG is en_US', () => {
    process.env.LANG = 'en_US.UTF-8';
    assert.strictEqual(detectLanguage(), 'en');
  });

  it('returns en when LANG is empty', () => {
    process.env.LANG = '';
    assert.strictEqual(detectLanguage(), 'en');
  });

  it('returns en when LANG is unset', () => {
    delete process.env.LANG;
    assert.strictEqual(detectLanguage(), 'en');
  });
});

describe('detectIDEs', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-detect-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects claude-code from .claude directory', () => {
    mkdirSync(join(tempDir, '.claude'));
    const result = detectIDEs(tempDir);
    assert.ok(result.includes('claude-code'));
  });

  it('detects cursor from .cursor directory', () => {
    mkdirSync(join(tempDir, '.cursor'));
    const result = detectIDEs(tempDir);
    assert.ok(result.includes('cursor'));
  });

  it('detects multiple IDEs', () => {
    mkdirSync(join(tempDir, '.claude'));
    mkdirSync(join(tempDir, '.cursor'));
    mkdirSync(join(tempDir, '.gemini'));
    const result = detectIDEs(tempDir);
    assert.strictEqual(result.length, 3);
    assert.ok(result.includes('claude-code'));
    assert.ok(result.includes('cursor'));
    assert.ok(result.includes('gemini'));
  });

  it('returns empty array when no IDEs detected', () => {
    const result = detectIDEs(tempDir);
    assert.deepStrictEqual(result, []);
  });

  it('detects codex from .agents directory', () => {
    mkdirSync(join(tempDir, '.agents'));
    const result = detectIDEs(tempDir);
    assert.ok(result.includes('codex'));
  });

  it('detects github-copilot from .github directory', () => {
    mkdirSync(join(tempDir, '.github'));
    const result = detectIDEs(tempDir);
    assert.ok(result.includes('github-copilot'));
  });
});

describe('countSkills', () => {
  const metaDir = join(process.cwd(), 'meta');

  it('counts core skills with no modules', () => {
    const result = countSkills(metaDir, {});
    assert.strictEqual(result, '6 core');
  });

  it('counts core + module skills when memory is enabled', () => {
    const result = countSkills(metaDir, { memory: { installed: true } });
    assert.strictEqual(result, '6 core + 1 module');
  });

  it('ignores disabled modules', () => {
    const result = countSkills(metaDir, { memory: { installed: false } });
    assert.strictEqual(result, '6 core');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
node --test tests/detect.test.js
```

Expected: FAIL — `Cannot find module '../src/detect.js'`

- [ ] **Step 4: Write src/detect.js**

```js
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from './yaml.js';

const IDE_DETECT_DIRS = {
  'claude-code': '.claude',
  'cursor': '.cursor',
  'gemini': '.gemini',
  'codex': '.agents',
  'opencode': '.opencode',
  'github-copilot': '.github',
};

export function detectLanguage() {
  const langEnv = process.env.LANG || '';
  if (langEnv.startsWith('pt')) return 'pt';
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (locale && locale.startsWith('pt')) return 'pt';
  } catch {}
  return 'en';
}

export function detectIDEs(basePath) {
  const detected = [];
  for (const [ideId, dir] of Object.entries(IDE_DETECT_DIRS)) {
    if (existsSync(join(basePath, dir))) {
      detected.push(ideId);
    }
  }
  return detected;
}

export function countSkills(metaDir, modules) {
  const meta = parseYaml(readFileSync(join(metaDir, 'skills.yaml'), 'utf8'));
  const coreCount = Object.keys(meta.core || {}).length;
  let moduleCount = 0;
  for (const [modName, modConfig] of Object.entries(modules)) {
    if (modConfig.installed && meta.modules?.[modName]) {
      moduleCount += Object.keys(meta.modules[modName]).length;
    }
  }
  return moduleCount > 0 ? `${coreCount} core + ${moduleCount} module` : `${coreCount} core`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
node --test tests/detect.test.js
```

Expected: All 10 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/detect.js tests/detect.test.js package.json package-lock.json
git commit -m "feat: add auto-detection module and install new dependencies"
```

---

### Task 2: UI Module

**Files:**
- Create: `src/ui.js`

**Note:** Before implementing, verify @clack/prompts API via context7. Resolve the library ID for `@clack/prompts` and query for: `select`, `multiselect`, `confirm`, `text`, `intro`, `outro`, `log`, `isCancel`, `note`.

- [ ] **Step 1: Create src/ui.js with all prompt functions and i18n**

```js
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { IDE_CONFIG, SKILL_NAMESPACE } from './config.js';

// Only show these in IDE selection (gemini-commands is internal)
const PRIMARY_IDES = ['claude-code', 'cursor', 'gemini', 'codex', 'opencode', 'github-copilot'];

function ideDisplayName(ideId) {
  const name = IDE_CONFIG[ideId]?.name || ideId;
  return name.replace(/ \(Skills\)$/, '').replace(/ \(Commands\)$/, '');
}

const MESSAGES = {
  pt: {
    installDefaults: 'Instalar com esses padrões',
    updateDefaults: 'Atualizar com essas configurações',
    customizeLang: 'Alterar idioma',
    customizeIDEs: 'Alterar IDEs',
    customizeModules: 'Alterar módulos',
    viewConflicts: 'Ver conflitos',
    quit: 'Sair',
    detected: 'detectado',
    selectIDEs: 'Selecione as IDEs:',
    selectLang: 'Idioma:',
    confirmUninstall: 'Remover todos os arquivos instalados?',
    uninstallScope: 'Qual instalação remover?',
    scopeProject: 'Projeto — somente este repo',
    scopeUser: 'Usuário — todos os seus repos',
    conflictOverwrite: 'Sobrescrever (perder mudanças locais)',
    conflictKeep: 'Manter versão local',
    conflictDiff: 'Ver diff',
    orphanRemove: 'Remover (não faz mais parte da configuração)',
    orphanKeep: 'Manter versão modificada (ficará órfão)',
    nextSteps: 'Próximos passos:',
    restart: 'Reinicie sua IDE ou inicie uma nova conversa',
    trySkills: 'Experimente: /fix, /hunt, /prompt',
    updateCmd: 'Atualizar: npx @henryavila/atomic-skills install',
    removeCmd: 'Remover:     npx @henryavila/atomic-skills uninstall',
    cancelled: 'Cancelado.',
    moduleInstall: 'Instalar',
    moduleSkip: 'Não instalar',
    moduleCustomPath: 'Caminho customizado',
    memoryDir: 'Diretório da memória:',
    noIDEsDetected: 'Nenhuma IDE detectada. Selecione manualmente.',
    done: 'Pronto.',
    installingMsg: (v) => `Instalando atomic-skills v${v}...`,
  },
  en: {
    installDefaults: 'Install with these defaults',
    updateDefaults: 'Update with these settings',
    customizeLang: 'Change language',
    customizeIDEs: 'Change IDEs',
    customizeModules: 'Change modules',
    viewConflicts: 'View conflicts',
    quit: 'Quit',
    detected: 'detected',
    selectIDEs: 'Select IDEs:',
    selectLang: 'Language:',
    confirmUninstall: 'Remove all installed files?',
    uninstallScope: 'Which installation to remove?',
    scopeProject: 'Project — this repo only',
    scopeUser: 'User — all your repos',
    conflictOverwrite: 'Overwrite (lose local changes)',
    conflictKeep: 'Keep local version',
    conflictDiff: 'View diff',
    orphanRemove: 'Remove (no longer part of config)',
    orphanKeep: 'Keep modified version (will stay unmanaged)',
    nextSteps: 'Next steps:',
    restart: 'Restart your IDE or start a new conversation',
    trySkills: 'Try: /fix, /hunt, /prompt',
    updateCmd: 'Update later: npx @henryavila/atomic-skills install',
    removeCmd: 'Remove:       npx @henryavila/atomic-skills uninstall',
    cancelled: 'Cancelled.',
    moduleInstall: 'Install',
    moduleSkip: 'Do not install',
    moduleCustomPath: 'Custom path',
    memoryDir: 'Memory directory:',
    noIDEsDetected: 'No IDEs detected. Select manually.',
    done: 'Done.',
    installingMsg: (v) => `Installing atomic-skills v${v}...`,
  },
};

export function msg(lang) {
  return MESSAGES[lang] || MESSAGES.en;
}

// ─── Dashboard Display ───

export function showIntro(config, { isUpdate, pkgVersion }) {
  const title = isUpdate
    ? `${pc.bold('atomic-skills')} v${config.existingVersion} → v${pkgVersion}`
    : `${pc.bold('atomic-skills')} v${pkgVersion}`;
  p.intro(title);
}

export function printConfig(config, conflictCount) {
  const m = msg(config.language);
  const langLabel = config.languageDetected
    ? `${config.language} (${m.detected})`
    : config.language;
  const scopeLabel = config.project ? 'project (./)' : 'user (~/)';
  const ideNames = config.ides.map(id => `◉ ${ideDisplayName(id)}`).join('  ');

  const lines = [
    `  Language    ${langLabel}`,
    `  Scope       ${scopeLabel}`,
    `  IDEs        ${ideNames || pc.dim('none')}`,
  ];

  for (const [name, mod] of Object.entries(config.modules)) {
    if (mod.installed) {
      lines.push(`  Modules     ◉ ${name[0].toUpperCase() + name.slice(1)} → ${mod.config?.memory_path || ''}`);
    }
  }

  lines.push(`  Skills      ${config.skillCount}`);

  if (conflictCount > 0) {
    lines.push(`  Conflicts   ${pc.yellow(`${conflictCount} files modified locally`)}`);
  }

  p.log.message(lines.join('\n'));
}

// ─── Interactive Prompts ───

export async function promptAction(lang, { isUpdate, hasConflicts }) {
  const m = msg(lang);
  const options = [
    { value: 'install', label: isUpdate ? m.updateDefaults : m.installDefaults },
    { value: 'lang', label: m.customizeLang },
    { value: 'ides', label: m.customizeIDEs },
    { value: 'modules', label: m.customizeModules },
  ];
  if (hasConflicts) {
    options.push({ value: 'conflicts', label: m.viewConflicts });
  }
  options.push({ value: 'quit', label: m.quit });

  const action = await p.select({ message: '', options, initialValue: 'install' });
  if (p.isCancel(action)) return 'quit';
  return action;
}

export async function promptIDESelection(lang, currentIDEs) {
  const m = msg(lang);
  const options = PRIMARY_IDES.map(id => ({
    value: id,
    label: ideDisplayName(id),
  }));
  // Map gemini-commands back to gemini for display
  const displayCurrent = currentIDEs.map(id => id === 'gemini-commands' ? 'gemini' : id);

  const selected = await p.multiselect({
    message: m.selectIDEs,
    options,
    initialValues: displayCurrent,
    required: true,
  });
  if (p.isCancel(selected)) return currentIDEs;
  return selected;
}

export async function promptLanguageSelection(lang) {
  const m = msg(lang);
  const selected = await p.select({
    message: m.selectLang,
    options: [
      { value: 'pt', label: 'Português (BR)' },
      { value: 'en', label: 'English' },
    ],
    initialValue: lang,
  });
  if (p.isCancel(selected)) return lang;
  return selected;
}

export async function promptModuleConfig(lang, currentModules, moduleYamlConfig) {
  const m = msg(lang);
  const display = moduleYamlConfig.display_name[lang] || moduleYamlConfig.display_name.en;
  const defaultPath = moduleYamlConfig.variables.memory_path.default;
  const currentMod = currentModules.memory || {};

  const choice = await p.select({
    message: `📦 ${display}`,
    options: [
      { value: 'default', label: `${m.moduleInstall} (${currentMod.config?.memory_path || defaultPath})` },
      { value: 'custom', label: m.moduleCustomPath },
      { value: 'skip', label: m.moduleSkip },
    ],
    initialValue: currentMod.installed ? 'default' : 'skip',
  });

  if (p.isCancel(choice) || choice === 'skip') {
    return { memory: { installed: false } };
  }

  if (choice === 'custom') {
    const customPath = await p.text({
      message: m.memoryDir,
      defaultValue: defaultPath,
      placeholder: defaultPath,
    });
    if (p.isCancel(customPath)) return { memory: { installed: false } };
    return { memory: { installed: true, config: { memory_path: customPath } } };
  }

  return { memory: { installed: true, config: { memory_path: currentMod.config?.memory_path || defaultPath } } };
}

// ─── Conflict Resolution ───

export async function promptConflict(lang, filePath) {
  const m = msg(lang);
  const action = await p.select({
    message: `⚠ ${filePath}`,
    options: [
      { value: 'overwrite', label: m.conflictOverwrite },
      { value: 'keep', label: m.conflictKeep },
      { value: 'diff', label: m.conflictDiff },
    ],
  });
  if (p.isCancel(action)) return 'keep';
  return action;
}

export async function promptOrphanConflict(lang, filePath) {
  const m = msg(lang);
  const action = await p.select({
    message: `⚠ ${filePath}`,
    options: [
      { value: 'remove', label: m.orphanRemove },
      { value: 'keep', label: m.orphanKeep },
      { value: 'diff', label: m.conflictDiff },
    ],
  });
  if (p.isCancel(action)) return 'keep';
  return action === 'remove' ? 'overwrite' : action;
}

// ─── Uninstall Prompts ───

export async function promptConfirmUninstall(lang) {
  const m = msg(lang);
  const confirmed = await p.confirm({ message: m.confirmUninstall, initialValue: false });
  if (p.isCancel(confirmed)) return false;
  return confirmed;
}

export async function promptUninstallScope(lang) {
  const m = msg(lang);
  const scope = await p.select({
    message: m.uninstallScope,
    options: [
      { value: 'project', label: m.scopeProject },
      { value: 'user', label: m.scopeUser },
    ],
  });
  if (p.isCancel(scope)) return null;
  return scope;
}

// ─── Post-Install Output ───

export function showPostInstall(result, ides, lang, isFirstInstall) {
  const m = msg(lang);

  for (const ideId of ides) {
    const ideCfg = IDE_CONFIG[ideId];
    const ideFiles = result.files.filter(f => f.path.startsWith(ideCfg.dir));
    p.log.success(`${ideDisplayName(ideId)}  ${ideFiles.length} skills → ~/${ideCfg.dir}/${SKILL_NAMESPACE}/`);
  }

  if (isFirstInstall) {
    console.log(`\n  ${m.nextSteps}`);
    console.log(`    • ${m.restart}`);
    console.log(`    • ${m.trySkills}`);
    console.log(`    • ${m.updateCmd}`);
    console.log(`    • ${m.removeCmd}`);
  }

  p.outro(m.done);
}

export function showNonInteractiveResult(result, ides, lang) {
  for (const ideId of ides) {
    const ideCfg = IDE_CONFIG[ideId];
    const ideFiles = result.files.filter(f => f.path.startsWith(ideCfg.dir));
    console.log(`${pc.green('✓')} ${ideDisplayName(ideId)}  ${ideFiles.length} skills`);
  }
  console.log(`◇ Done. ${result.files.length} files installed.`);
}
```

- [ ] **Step 2: Verify the module loads without errors**

```bash
node -e "import('./src/ui.js').then(() => console.log('OK'))"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/ui.js
git commit -m "feat: add @clack-based UI module with dashboard and prompts"
```

---

### Task 3: Status Command

**Files:**
- Create: `src/status.js`
- Create: `tests/status.test.js`

- [ ] **Step 1: Write tests/status.test.js**

```js
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installSkills } from '../src/install.js';
import { readManifest } from '../src/manifest.js';

const SKILLS_DIR = join(process.cwd(), 'skills');
const META_DIR = join(process.cwd(), 'meta');

describe('status data verification', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'as-status-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('all installed files exist on disk', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    const manifest = readManifest(tempDir);
    assert.ok(manifest);
    for (const filePath of Object.keys(manifest.files)) {
      assert.ok(existsSync(join(tempDir, filePath)), `${filePath} should exist`);
    }
  });

  it('detects missing files after deletion', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    unlinkSync(join(tempDir, '.claude/commands/atomic-skills/fix.md'));

    const manifest = readManifest(tempDir);
    let missingCount = 0;
    for (const filePath of Object.keys(manifest.files)) {
      if (!existsSync(join(tempDir, filePath))) missingCount++;
    }
    assert.strictEqual(missingCount, 1);
  });

  it('returns null manifest when not installed', () => {
    const manifest = readManifest(tempDir);
    assert.strictEqual(manifest, null);
  });

  it('groups files by IDE correctly', () => {
    installSkills(tempDir, {
      language: 'en',
      ides: ['claude-code', 'cursor'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });

    const manifest = readManifest(tempDir);
    const claudeFiles = Object.keys(manifest.files).filter(f => f.startsWith('.claude/'));
    const cursorFiles = Object.keys(manifest.files).filter(f => f.startsWith('.cursor/'));
    assert.ok(claudeFiles.length > 0);
    assert.ok(cursorFiles.length > 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass (these test data, not UI)**

```bash
node --test tests/status.test.js
```

Expected: All 4 tests PASS (they test data logic using existing installSkills).

- [ ] **Step 3: Write src/status.js**

```js
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import { readManifest } from './manifest.js';
import { IDE_CONFIG } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');

function getPackageVersion() {
  return JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;
}

export function status(projectDir) {
  const userManifest = readManifest(homedir());
  const projectManifest = readManifest(projectDir);
  const manifest = userManifest || projectManifest;

  if (!manifest) {
    p.intro(pc.bold('atomic-skills'));
    p.log.error('Not installed.');
    p.log.message(`Run ${pc.cyan('npx @henryavila/atomic-skills install')} to install.`);
    p.outro('');
    return;
  }

  const basePath = userManifest ? homedir() : projectDir;
  const scope = userManifest ? 'user (~/)' : 'project (./)';
  const version = manifest.version || 'unknown';

  p.intro(`${pc.bold('atomic-skills')} v${version}`);

  const lines = [
    `  Scope       ${scope}`,
    `  Language    ${manifest.language}`,
  ];

  // Group files by IDE and check existence
  const ideStatus = {};
  for (const ideId of manifest.ides || []) {
    ideStatus[ideId] = { total: 0, missing: [] };
  }

  for (const filePath of Object.keys(manifest.files || {})) {
    for (const ideId of manifest.ides || []) {
      const ideCfg = IDE_CONFIG[ideId];
      if (ideCfg && filePath.startsWith(ideCfg.dir)) {
        ideStatus[ideId].total++;
        if (!existsSync(join(basePath, filePath))) {
          ideStatus[ideId].missing.push(filePath);
        }
        break;
      }
    }
  }

  lines.push('  IDEs');
  for (const ideId of manifest.ides || []) {
    const name = (IDE_CONFIG[ideId]?.name || ideId).replace(/ \(Skills\)$/, '').replace(/ \(Commands\)$/, '');
    const s = ideStatus[ideId];
    if (s.missing.length === 0) {
      lines.push(`              ◉ ${name}  ${pc.green('✓')} ${s.total} skills OK`);
    } else {
      lines.push(`              ◉ ${name}  ${pc.red('✗')} ${s.missing.length} files missing`);
    }
  }

  const installedMods = Object.entries(manifest.modules || {}).filter(([, m]) => m.installed);
  if (installedMods.length > 0) {
    lines.push('  Modules');
    for (const [name, mod] of installedMods) {
      lines.push(`              ◉ ${name[0].toUpperCase() + name.slice(1)}  ${pc.green('✓')} ${mod.config?.memory_path || ''}`);
    }
  }

  p.log.message(lines.join('\n'));

  const allMissing = Object.values(ideStatus).flatMap(s => s.missing);
  if (allMissing.length > 0) {
    p.log.warn('Missing files:');
    for (const f of allMissing) {
      console.log(`    ${f}`);
    }
    p.log.message(`Run ${pc.cyan('npx @henryavila/atomic-skills install')} to repair.`);
  } else {
    if (manifest.updated_at) {
      console.log(`\n  Last updated: ${manifest.updated_at.split('T')[0]}`);
    }
    const pkgVersion = getPackageVersion();
    if (pkgVersion === version) {
      console.log(`  ${pc.green('All skills are up to date.')}`);
    } else {
      console.log(`  ${pc.yellow(`Update available: v${version} → v${pkgVersion}`)}`);
    }
  }

  p.outro('');
}
```

- [ ] **Step 4: Verify status.js loads without errors**

```bash
node -e "import('./src/status.js').then(() => console.log('OK'))"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add src/status.js tests/status.test.js
git commit -m "feat: add status command for installation verification"
```

---

### Task 4: Core Rewrite — install.js + cli.js

**Files:**
- Modify: `src/install.js:1-11` (imports), `src/install.js:151-154` (export getPackageVersion), `src/install.js:222-463` (install function)
- Rewrite: `bin/cli.js`
- Rewrite: `tests/cli.test.js`

This task rewrites the interactive `install()` function and the CLI entry point together, because they share the function signature.

**Important:** `installSkills()` (lines 32-149), `preRenderFiles()` (lines 159-218), and `generateNamespaceRoot()` (lines 20-24) remain **exactly unchanged**.

- [ ] **Step 1: Update imports at top of src/install.js**

Replace lines 1-11 (the import block) with:

```js
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, rmdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import { IDE_CONFIG, getSkillPath, getSkillFormat, SKILL_NAMESPACE, getNamespaceRootPath } from './config.js';
import { hashContent } from './hash.js';
import { renderTemplate, renderForIDE } from './render.js';
import { readManifest, writeManifest, MANIFEST_DIR } from './manifest.js';
import { parse as parseYaml } from './yaml.js';
import { detectLanguage, detectIDEs, countSkills } from './detect.js';
import {
  showIntro, printConfig, promptAction, promptIDESelection,
  promptLanguageSelection, promptModuleConfig, promptConflict,
  promptOrphanConflict, showPostInstall, showNonInteractiveResult, msg,
} from './ui.js';
```

- [ ] **Step 2: Export getPackageVersion and add dedup helper**

Change `function getPackageVersion()` (line ~151) to `export function getPackageVersion()`.

Add below it:

```js
function deduplicateGeminiCodex(ides) {
  if (ides.includes('gemini') && ides.includes('codex')) {
    const result = [...ides];
    result[result.indexOf('gemini')] = 'gemini-commands';
    return result;
  }
  return ides;
}
```

- [ ] **Step 3: Rewrite install() function**

Replace everything from `export async function install(...)` to the end of the file with:

```js
/**
 * Interactive install entry point.
 */
export async function install(projectDir, options = {}) {
  const { yes = false, project = false, ide: cliIDEs = null, lang: cliLang = null } = options;

  const basePath = project ? projectDir : homedir();
  const existingManifest = readManifest(basePath);
  const isFirstInstall = !existingManifest;
  const isUpdate = !!existingManifest;
  const pkgVersion = getPackageVersion();
  const skillsDir = join(PACKAGE_ROOT, 'skills');
  const metaDir = join(PACKAGE_ROOT, 'meta');

  // Build initial config: CLI overrides > manifest > auto-detection > defaults
  let language = cliLang || existingManifest?.language || detectLanguage();
  const languageDetected = !cliLang && !existingManifest?.language;

  let ides = cliIDEs || existingManifest?.ides?.slice() || detectIDEs(basePath);
  ides = deduplicateGeminiCodex(ides);

  let modules = existingManifest?.modules ? JSON.parse(JSON.stringify(existingManifest.modules)) : {};
  if (isFirstInstall && !Object.values(modules).some(m => m.installed)) {
    const moduleYaml = parseYaml(readFileSync(join(skillsDir, 'modules', 'memory', 'module.yaml'), 'utf8'));
    modules = { memory: { installed: true, config: { memory_path: moduleYaml.variables.memory_path.default } } };
  }

  const scope = project ? 'project' : 'user';

  // ─── Non-interactive mode (--yes) ───
  if (yes) {
    if (ides.length === 0) {
      console.error(`  ${pc.red('Error:')} No IDEs detected. Use --ide to specify.`);
      process.exit(1);
    }

    console.log(`◇ ${msg(language).installingMsg(pkgVersion)}`);

    const keepFiles = new Set();
    if (existingManifest) {
      const newRendered = preRenderFiles({ language, ides, modules, skillsDir, metaDir });
      for (const [filePath, manifestEntry] of Object.entries(existingManifest.files)) {
        const absPath = join(basePath, filePath);
        const newContent = newRendered.get(filePath);
        if (!newContent || !existsSync(absPath)) continue;
        const currentHash = hashContent(readFileSync(absPath, 'utf8'));
        const localChanged = currentHash !== manifestEntry.installed_hash;
        if (localChanged) keepFiles.add(filePath);
      }
    }

    const savedContent = new Map();
    for (const filePath of keepFiles) {
      const absPath = join(basePath, filePath);
      if (existsSync(absPath)) savedContent.set(filePath, readFileSync(absPath, 'utf8'));
    }

    const result = installSkills(basePath, { language, ides, modules, skillsDir, metaDir, scope });

    for (const [filePath, content] of savedContent) {
      writeFileSync(join(basePath, filePath), content, 'utf8');
    }

    if (keepFiles.size > 0) {
      const manifest = readManifest(basePath);
      for (const filePath of keepFiles) {
        const keptContent = savedContent.get(filePath);
        if (keptContent && manifest.files[filePath]) {
          manifest.files[filePath].installed_hash = hashContent(keptContent);
        }
      }
      writeManifest(basePath, manifest);
    }

    // Orphan removal (auto-remove unmodified, keep modified)
    if (existingManifest) {
      const newPaths = new Set(result.files.map(f => f.path));
      for (const [oldPath, manifestEntry] of Object.entries(existingManifest.files)) {
        if (newPaths.has(oldPath)) continue;
        const absPath = join(basePath, oldPath);
        if (!existsSync(absPath)) continue;
        const currentHash = hashContent(readFileSync(absPath, 'utf8'));
        if (currentHash === manifestEntry.installed_hash) {
          unlinkSync(absPath);
          let parent = dirname(absPath);
          while (parent !== basePath && parent !== '.') {
            try {
              if (readdirSync(parent).length === 0) { rmdirSync(parent); parent = dirname(parent); }
              else break;
            } catch { break; }
          }
        }
      }
    }

    showNonInteractiveResult(result, ides, language);
    return;
  }

  // ─── Interactive mode (dashboard) ───
  const config = {
    language,
    languageDetected,
    ides: [...ides],
    modules,
    project,
    existingVersion: existingManifest?.version,
    skillCount: countSkills(metaDir, modules),
  };

  const moduleYaml = parseYaml(readFileSync(join(skillsDir, 'modules', 'memory', 'module.yaml'), 'utf8'));

  // Pre-compute conflict count for dashboard display
  let conflictCount = 0;
  if (existingManifest) {
    const newRendered = preRenderFiles({ language: config.language, ides: config.ides, modules: config.modules, skillsDir, metaDir });
    for (const [filePath, manifestEntry] of Object.entries(existingManifest.files)) {
      const absPath = join(basePath, filePath);
      const newContent = newRendered.get(filePath);
      if (!newContent || !existsSync(absPath)) continue;
      const currentHash = hashContent(readFileSync(absPath, 'utf8'));
      const newHash = hashContent(newContent);
      if (currentHash !== manifestEntry.installed_hash && manifestEntry.installed_hash !== newHash) {
        conflictCount++;
      }
    }
  }

  showIntro(config, { isUpdate, pkgVersion });

  // If no IDEs detected, force selection
  if (config.ides.length === 0) {
    p.log.warn(msg(config.language).noIDEsDetected);
    config.ides = await promptIDESelection(config.language, []);
    if (config.ides.length === 0) {
      p.outro(msg(config.language).cancelled);
      return;
    }
    config.ides = deduplicateGeminiCodex(config.ides);
  }

  let action;
  do {
    printConfig(config, conflictCount);
    action = await promptAction(config.language, { isUpdate, hasConflicts: conflictCount > 0 });

    if (action === 'lang') {
      config.language = await promptLanguageSelection(config.language);
      config.languageDetected = false;
    } else if (action === 'ides') {
      config.ides = await promptIDESelection(config.language, config.ides);
      config.ides = deduplicateGeminiCodex(config.ides);
    } else if (action === 'modules') {
      config.modules = await promptModuleConfig(config.language, config.modules, moduleYaml);
      config.skillCount = countSkills(metaDir, config.modules);
    } else if (action === 'conflicts') {
      // Show conflict details
      const newRendered = preRenderFiles({ language: config.language, ides: config.ides, modules: config.modules, skillsDir, metaDir });
      for (const [filePath, manifestEntry] of Object.entries(existingManifest.files)) {
        const absPath = join(basePath, filePath);
        const newContent = newRendered.get(filePath);
        if (!newContent || !existsSync(absPath)) continue;
        const currentHash = hashContent(readFileSync(absPath, 'utf8'));
        const newHash = hashContent(newContent);
        if (currentHash !== manifestEntry.installed_hash && manifestEntry.installed_hash !== newHash) {
          p.log.warn(`${filePath}\n  ${config.language === 'pt' ? 'Mudanças locais serão sobrescritas' : 'Local changes will be overwritten'}`);
        }
      }
    }
  } while (action !== 'install' && action !== 'quit');

  if (action === 'quit') {
    p.outro(msg(config.language).cancelled);
    return;
  }

  // ─── 3-hash conflict detection ───
  const keepFiles = new Set();
  if (existingManifest) {
    const newRendered = preRenderFiles({ language: config.language, ides: config.ides, modules: config.modules, skillsDir, metaDir });

    for (const [filePath, manifestEntry] of Object.entries(existingManifest.files)) {
      const absPath = join(basePath, filePath);
      const newContent = newRendered.get(filePath);
      if (!newContent) continue;
      if (!existsSync(absPath)) continue;

      const newHash = hashContent(newContent);
      const installedHash = manifestEntry.installed_hash;
      const currentContent = readFileSync(absPath, 'utf8');
      const currentHash = hashContent(currentContent);

      const localUnchanged = currentHash === installedHash;
      const packageUnchanged = installedHash === newHash;

      if (localUnchanged) continue;
      if (!localUnchanged && packageUnchanged) {
        keepFiles.add(filePath);
        continue;
      }

      // Both changed — conflict, ask user
      let conflictAction = await promptConflict(config.language, filePath);
      while (conflictAction === 'diff') {
        console.log('\n  --- Current (on disk) ---');
        console.log(currentContent);
        console.log('\n  --- New (from package) ---');
        console.log(newContent);
        conflictAction = await promptConflict(config.language, filePath);
      }
      if (conflictAction === 'keep') keepFiles.add(filePath);
    }
  }

  // Save content of files user wants to keep
  const savedContent = new Map();
  for (const filePath of keepFiles) {
    const absPath = join(basePath, filePath);
    if (existsSync(absPath)) savedContent.set(filePath, readFileSync(absPath, 'utf8'));
  }

  // SIGINT handler
  const writtenFiles = [];
  const cleanup = () => {
    for (const f of writtenFiles) {
      try { unlinkSync(join(basePath, f)); } catch {}
    }
    console.log(config.language === 'pt'
      ? '\n  ⚛ Instalação cancelada. Nenhum arquivo mantido.\n'
      : '\n  ⚛ Installation cancelled. No files kept.\n');
    process.exitCode = 1;
    process.kill(process.pid, 'SIGINT');
  };
  process.on('SIGINT', cleanup);

  let result;
  try {
    result = installSkills(basePath, {
      language: config.language,
      ides: config.ides,
      modules: config.modules,
      skillsDir,
      metaDir,
      scope,
    }, {
      onFileWritten: (path) => writtenFiles.push(path),
    });
  } finally {
    process.removeListener('SIGINT', cleanup);
  }

  // Restore files user chose to keep
  for (const [filePath, content] of savedContent) {
    writeFileSync(join(basePath, filePath), content, 'utf8');
  }

  // Patch manifest hashes for kept files
  if (keepFiles.size > 0) {
    const manifest = readManifest(basePath);
    for (const filePath of keepFiles) {
      const keptContent = savedContent.get(filePath);
      if (keptContent && manifest.files[filePath]) {
        manifest.files[filePath].installed_hash = hashContent(keptContent);
      }
    }
    writeManifest(basePath, manifest);
  }

  // Orphan removal
  if (existingManifest) {
    const newPaths = new Set(result.files.map(f => f.path));
    const orphanEntries = Object.entries(existingManifest.files).filter(([path]) => !newPaths.has(path));

    for (const [oldPath, manifestEntry] of orphanEntries) {
      const absPath = join(basePath, oldPath);
      if (!existsSync(absPath)) continue;

      const currentContent = readFileSync(absPath, 'utf8');
      const currentHash = hashContent(currentContent);
      const wasModified = currentHash !== manifestEntry.installed_hash;

      let shouldRemove = true;
      if (wasModified) {
        let orphanAction = await promptOrphanConflict(config.language, oldPath);
        while (orphanAction === 'diff') {
          console.log('\n  --- Current (orphan on disk) ---');
          console.log(currentContent);
          orphanAction = await promptOrphanConflict(config.language, oldPath);
        }
        if (orphanAction === 'keep') shouldRemove = false;
      }

      if (shouldRemove) {
        unlinkSync(absPath);
        let parent = dirname(absPath);
        while (parent !== basePath && parent !== '.') {
          try {
            if (readdirSync(parent).length === 0) { rmdirSync(parent); parent = dirname(parent); }
            else break;
          } catch { break; }
        }
      }
    }
  }

  showPostInstall(result, config.ides, config.language, isFirstInstall);
}
```

- [ ] **Step 4: Rewrite bin/cli.js**

Replace the entire file with:

```js
#!/usr/bin/env node

import { parseArgs } from 'node:util';

let values, positionals;
try {
  ({ values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      yes: { type: 'boolean', short: 'y', default: false },
      project: { type: 'boolean', default: false },
      ide: { type: 'string' },
      lang: { type: 'string' },
      scope: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  }));
} catch (err) {
  console.error(`  Error: ${err.message}`);
  process.exit(1);
}

const command = positionals[0];

// Backward compat: --scope project → --project
if (values.scope === 'project') values.project = true;
if (values.scope && values.scope !== 'user' && values.scope !== 'project') {
  console.error('  Error: --scope must be "user" or "project"');
  process.exit(1);
}

if (command === 'install') {
  const { install } = await import('../src/install.js');
  await install(process.cwd(), {
    yes: values.yes,
    project: values.project,
    ide: values.ide ? values.ide.split(',') : null,
    lang: values.lang,
  });
} else if (command === 'uninstall') {
  const { uninstall } = await import('../src/uninstall.js');
  const scope = values.project ? 'project' : (values.scope || null);
  await uninstall(process.cwd(), scope);
} else if (command === 'status') {
  const { status } = await import('../src/status.js');
  status(process.cwd());
} else {
  console.log(`
  ⚛ Atomic Skills — Stop rewriting prompts.

  Usage:
    npx @henryavila/atomic-skills install    [--yes] [--project] [--ide <ids>] [--lang <code>]
    npx @henryavila/atomic-skills status
    npx @henryavila/atomic-skills uninstall  [--project]

  Options:
    --yes, -y     Accept auto-detected defaults (non-interactive)
    --project     Install to ./ instead of ~/ (default: user scope)
    --ide <ids>   Comma-separated: claude-code,cursor,gemini,codex,opencode,github-copilot
    --lang <code> Language: en, pt

  Docs: https://github.com/henryavila/atomic-skills
  `);
}
```

- [ ] **Step 5: Rewrite tests/cli.test.js**

```js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI = join(__dirname, '..', 'bin', 'cli.js');

describe('CLI flag parsing', () => {
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

  it('shows help when no command given', () => {
    const output = execFileSync('node', [CLI], { encoding: 'utf8', timeout: 5000 });
    assert.ok(output.includes('--yes'));
    assert.ok(output.includes('--project'));
    assert.ok(output.includes('--ide'));
    assert.ok(output.includes('--lang'));
    assert.ok(output.includes('status'));
  });

  it('shows help with -h flag', () => {
    const output = execFileSync('node', [CLI, '-h'], { encoding: 'utf8', timeout: 5000 });
    assert.ok(output.includes('Atomic Skills'));
  });

  it('runs status command without error when not installed', () => {
    const output = execFileSync('node', [CLI, 'status'], {
      encoding: 'utf8',
      timeout: 5000,
      cwd: '/tmp',
    });
    // Should mention "not installed" or similar
    assert.ok(output.length > 0);
  });
});
```

- [ ] **Step 6: Run all existing installSkills tests to verify core is untouched**

```bash
node --test tests/install.test.js tests/update.test.js
```

Expected: All 16 tests PASS (13 install + 3 update). The `installSkills()` function was not modified.

- [ ] **Step 7: Run all tests**

```bash
node --test tests/*.test.js
```

Expected: All tests pass EXCEPT those that still import from `./prompts.js` via uninstall.js. The cli.test.js and new tests should pass. If uninstall tests fail (because uninstall.js still imports from prompts.js and inquirer is still installed), that's expected — fixed in Task 5.

- [ ] **Step 8: Commit**

```bash
git add bin/cli.js src/install.js tests/cli.test.js
git commit -m "feat: dashboard-first install flow with auto-detection and --yes flag"
```

---

### Task 5: Migrate Uninstall + Delete prompts.js

**Files:**
- Modify: `src/uninstall.js:5` (import line)
- Delete: `src/prompts.js`
- Modify: `package.json` (remove inquirer)

- [ ] **Step 1: Update uninstall.js imports**

In `src/uninstall.js`, replace line 5:

```js
import { promptConfirmUninstall, promptUninstallScope } from './prompts.js';
```

with:

```js
import { promptConfirmUninstall, promptUninstallScope } from './ui.js';
```

No other changes to uninstall.js — the function signatures are identical.

- [ ] **Step 2: Delete src/prompts.js**

```bash
rm /home/henry/atomic-skills/src/prompts.js
```

- [ ] **Step 3: Remove inquirer dependency**

```bash
cd /home/henry/atomic-skills && npm uninstall inquirer
```

- [ ] **Step 4: Run full test suite**

```bash
node --test tests/*.test.js
```

Expected: ALL tests pass. No file imports from `inquirer` or `prompts.js` anymore.

- [ ] **Step 5: Commit**

```bash
git add src/uninstall.js package.json package-lock.json
git rm src/prompts.js
git commit -m "refactor: remove inquirer, migrate all prompts to @clack"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run complete test suite**

```bash
node --test tests/*.test.js
```

Expected: All tests pass (73+ existing + new detect + status + cli tests).

- [ ] **Step 2: Verify no references to old prompts.js or inquirer remain**

```bash
cd /home/henry/atomic-skills && grep -r "inquirer" src/ bin/ --include="*.js"
grep -r "prompts\.js" src/ bin/ --include="*.js"
```

Expected: No matches.

- [ ] **Step 3: Test non-interactive install in temp directory**

```bash
cd /tmp && node /home/henry/atomic-skills/bin/cli.js install --yes --ide claude-code --lang en
```

Expected: Installs without prompts, shows `✓ Claude Code  6 skills`.

- [ ] **Step 4: Test status command**

```bash
node /home/henry/atomic-skills/bin/cli.js status
```

Expected: Shows installed skills summary (from user home manifest if exists, or "Not installed").

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A && git commit -m "fix: address issues found during final verification"
```

Only run if Step 1-4 revealed issues to fix.
