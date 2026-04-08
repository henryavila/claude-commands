# Installer Redesign — Dashboard-First UX

**Status:** Approved  
**Date:** 2026-04-08  
**Scope:** Complete rewrite of the interactive installation flow

## Problem

The current installer has poor UX:
- 4-5 sequential prompts (language, scope, IDEs, modules, conflicts) cause decision fatigue
- No visual feedback of what will happen before it happens
- The "user vs project scope" concept confuses users
- Post-install feedback is minimal — unclear what was installed and where
- No non-interactive mode for CI/CD
- No status/verification command

## Design Principle

**One screen, all defaults visible, Enter to install.**

## Stack Migration

| Current | New | Why |
|---|---|---|
| `inquirer` | `@clack/prompts` | Better UI, lighter, fixes Windows arrow key issues (libuv #852) |
| — | `@clack/core` | Custom dashboard prompt component |
| — | `picocolors` | Lightweight terminal colors |

Remove `inquirer` as dependency.

## Commands

```bash
# Interactive (dashboard)
npx @henryavila/atomic-skills install

# Non-interactive (CI/CD)
npx @henryavila/atomic-skills install --yes
npx @henryavila/atomic-skills install --yes --ide claude-code --lang en --project

# Status / verification
npx @henryavila/atomic-skills status

# Removal (unchanged)
npx @henryavila/atomic-skills uninstall
```

## CLI Flags

| Flag | Description | Default |
|---|---|---|
| `--yes`, `-y` | Accept all defaults, no interactive prompts | false |
| `--project` | Install in current directory instead of home | false (user scope) |
| `--ide <ids>` | Comma-separated IDE IDs to install for | auto-detected |
| `--lang <code>` | Language code (en, pt) | auto-detected from system |
| `--scope <value>` | DEPRECATED — kept for backward compat, maps to `--project` | — |

## Flow 1: Fresh Install (Interactive)

### Dashboard Screen

```
 atomic-skills v1.6.0

  Language    pt (detected)
  Scope       user (~/)
  IDEs        ◉ Claude Code  ◉ Cursor
  Modules     ◉ Memory → .ai/memory/
  Skills      6 core + 1 module

  ⏎ install    ↑↓ customize    q quit
```

### Default Detection Logic

| Field | Detection | Fallback |
|---|---|---|
| Language | `process.env.LANG` or `Intl.DateTimeFormat().resolvedOptions().locale` | `en` |
| Scope | Always `user` (~/) | — |
| IDEs | Scan for existing config directories (~/.claude/, ~/.cursor/, etc.) | Ask if none detected |
| Modules | All available modules pre-selected | — |

### IDE Auto-Detection

Check existence of these directories at the scope's base path:

| IDE | Directory to check |
|---|---|
| Claude Code | `.claude/` |
| Cursor | `.cursor/` |
| Gemini CLI | `.gemini/` |
| Codex | `.agents/` |
| OpenCode | `.opencode/` |
| GitHub Copilot | `.github/` |

Only detected IDEs are pre-selected (◉). Non-detected IDEs are shown but unchecked (◯). User can toggle any.

### Interaction

- **Enter** — install with shown defaults (happy path: one keypress)
- **↑↓** — navigate to a field
- **Enter on field** — open inline sub-menu to edit that field
- **q** — quit without changes

### Sub-Menus (When Customizing)

**IDEs:** Multi-select checkbox (clack multiselect)
```
  ◉ Claude Code
  ◉ Cursor
  ◯ Gemini CLI
  ◯ Codex
```

**Modules:** Multi-select with config option
```
  ◉ Memory → .ai/memory/
    (enter to change path)
```

**Language:** Single select
```
  ◉ Português
  ◯ English
```

### Post-Install Output (First Install)

```
  ✓ Claude Code  6 skills → ~/.claude/commands/atomic-skills/
  ✓ Cursor       6 skills → ~/.cursor/skills/atomic-skills/

  Next steps:
    • Restart your IDE or start a new conversation
    • Try: /fix, /hunt, /prompt
    • Update later: npx @henryavila/atomic-skills install
    • Remove:       npx @henryavila/atomic-skills uninstall
```

### Post-Install Output (Subsequent Installs)

```
  ✓ Claude Code  6 skills → ~/.claude/commands/atomic-skills/
  ✓ Cursor       6 skills → ~/.cursor/skills/atomic-skills/
```

No "Next steps" block on updates — the user already knows.

## Flow 2: Update (Interactive)

When a manifest already exists, the dashboard loads from it:

```
 atomic-skills v1.5.0 → v1.6.0    update

  Language    pt
  Scope       user (~/)
  IDEs        ◉ Claude Code  ◉ Cursor
  Modules     ◉ Memory → .ai/memory/
  Conflicts   2 files modified locally

  ⏎ update    ↑↓ customize    c conflicts    q quit
```

### Differences from Fresh Install

- Title shows version transition and "update" label
- All defaults loaded from **existing manifest** (not auto-detect)
- "Conflicts" line only appears when 3-hash detection finds conflicts
- **c** key opens conflict resolution view
- Button label says "update" instead of "install"

### Conflict Resolution View

When user presses **c**:

```
  Modified files (2):

  1. ~/.claude/commands/atomic-skills/fix.md
     Local changes will be overwritten

  2. ~/.cursor/skills/atomic-skills/hunt/SKILL.md
     Local changes will be overwritten

  For each: (k)eep local  (o)verwrite  (d)iff  (s)kip
```

Default behavior (if user just presses Enter on update without resolving): **keep local** — respect user modifications.

## Flow 3: Non-Interactive (`--yes`)

Same default logic, no dashboard rendered:

```
◇ Installing atomic-skills v1.6.0...
✓ Claude Code  6 skills
✓ Cursor       6 skills
◇ Done. 12 files installed.
```

For updates with conflicts and `--yes`: keep local by default (safe).

## Flow 4: Status Command

```bash
npx @henryavila/atomic-skills status
```

```
 atomic-skills v1.5.0

  Scope       user (~/)
  Language    pt
  IDEs        ◉ Claude Code  ✓ 6 skills OK
              ◉ Cursor       ✓ 6 skills OK
  Modules     ◉ Memory       ✓ .ai/memory/

  Last updated: 2026-04-06
  All skills are up to date.
```

### Checks Performed

1. Read manifest from scope's base path
2. For each file in manifest: verify it exists on disk
3. Report missing files as warnings
4. Compare installed version vs package version for "up to date" check

### Error States

```
  IDEs        ◉ Claude Code  ✓ 6 skills OK
              ◉ Cursor       ✗ 2 files missing
  
  Missing files:
    ~/.cursor/skills/atomic-skills/fix/SKILL.md
    ~/.cursor/skills/atomic-skills/hunt/SKILL.md
  
  Run `npx @henryavila/atomic-skills install` to repair.
```

## Backward Compatibility

- `--scope user` → works, maps to default behavior
- `--scope project` → works, maps to `--project` flag
- Existing manifests are read correctly (same format)
- Migration from v1.4/v1.5 file locations handled by existing update logic

## What Stays the Same

- **3-hash conflict detection** — logic unchanged, presentation improved
- **Manifest system** — same structure, same location (`.atomic-skills/manifest.json`)
- **Rendering engine** — `renderTemplate()` + `renderForIDE()` untouched
- **Orphan file cleanup** — same logic
- **Uninstall** — same flow (can improve UI separately later)
- **IDE config definitions** — same `src/config.js`

## What Changes

| Aspect | Before | After |
|---|---|---|
| Prompt library | `inquirer` | `@clack/prompts` + `@clack/core` + `picocolors` |
| Interactive flow | 4-5 sequential prompts | Single dashboard with defaults |
| Language detection | Prompt | Auto-detect from `LANG` env |
| IDE detection | Prompt | Auto-detect from directories |
| Scope | Prompt | Default `user`, `--project` flag |
| CI mode | Does not exist | `--yes` flag |
| Verification | Does not exist | `status` command |
| Post-install feedback | Simple count | Per-IDE summary + Next steps (1st install) |
