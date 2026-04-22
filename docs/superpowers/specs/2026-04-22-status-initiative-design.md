# `atomic-skills:status` — Canonical Per-Initiative Status Tracking

**Status:** Approved (pending implementation plan)
**Date:** 2026-04-22
**Scope:** New skill that maintains a canonical, AI-optimized project-status file per initiative, enforced via hooks and CLAUDE.md/AGENTS.md hard-gate.

---

## 1. Problem

During long-running coding work, users and AI agents lose the macro view. The pattern is consistent:

1. User starts task A (part of a planned N-task initiative)
2. Working on A reveals need to expand → sub-tasks A.1, A.2
3. A.1 requires research R → research performed
4. R sparks discussion about topic T → T is discussed
5. T reveals concern C → C is discussed
6. By end of session, both user and AI have lost:
   - What was the original goal?
   - What's the breadcrumb back?
   - What surfaced that still needs handling?
   - What scope has expanded vs. what emerged as a different initiative?

Existing tooling addresses parts:
- **TodoWrite/TaskCreate** — ephemeral, dies on compaction, does not survive sessions
- **`.ai/memory/MEMORY.md`** — durable *learnings*, not operational status
- **`superpowers:writing-plans`** — written-once design, no living status
- **`ck` (everything-claude-code)** — session-scope continuity, not initiative-scope
- **ADRs** — architectural decisions, orthogonal to execution progress

**Gap:** No canonical source for *living, per-initiative execution status* that survives across sessions, branches, and worktrees — and that is *forced* to be read and written, not merely recommended.

## 2. Design Principles

1. **AI-native storage, human-secondary** — format optimized for LLM read/write efficiency; human rendering is a separate concern deferred to a future skill.
2. **Defense in depth** — three independent enforcement layers (skill + rule file + hooks). Any one by itself fails; together they hold.
3. **Multi-IDE first, Claude Code amplified** — skill + CLAUDE.md/AGENTS.md work everywhere; hooks add Claude-Code-specific amplification.
4. **Depth-first workflow, not scope-creep policing** — the user legitimately explores deeper. The skill must make the *breadcrumb visible*, not prevent exploration.
5. **Composable with existing skills** — `init-memory`, `save-and-push`, `writing-plans`, `ck` remain; this skill fills a specific gap and references them.
6. **Research-backed format** — Markdown + YAML frontmatter + embedded JSON block, with Kanban swimlanes and call-stack metaphor (sources: Anthropic harness research, Chroma context rot, Liu et al. lost-in-the-middle, TICK paper, Cursor Memory Bank).
7. **Opt-in enforcement intensity** — setup offers levels (passive / soft / strict). User controls friction.

## 3. Non-Goals

- **Not a planning tool.** `superpowers:writing-plans` owns initial plan creation. This skill links to plans; it does not replace them.
- **Not a learning repository.** `save-and-push` and `init-memory` own `.ai/memory/`. This skill does not write learnings.
- **Not a human dashboard.** No rendering UI, no HTML, no terminal TUI. Storage only. A future `atomic-skills:status-render` skill can consume the files.
- **Not cross-repository.** One status tree per repo. Cross-repo coordination is explicitly out of scope.
- **Not a task manager.** It is a canonical state file that happens to contain tasks. No assignee, due date, or external integrations.

## 4. Architecture Overview

### File layout

```
/PROJECT-STATUS.md                    ← index: active initiatives + last 10 archived links + last 5 ad-hoc sessions
/initiatives/
  ├── <slug>.md                        ← Stack + Kanban + Next Action per active initiative
  └── archive/
       └── <YYYY-MM>-<slug>.md         ← archived initiatives, preserved
/AGENTS.md                             ← auto-created if missing, redirects to CLAUDE.md
/CLAUDE.md                             ← HARD-GATE block injected automatically by setup
/.claude/settings.local.json          ← hook registration (Claude Code only)
/.claude/hooks/atomic-status/
  ├── session-start.sh                 ← Layer 2b script
  ├── stop.sh                          ← Layer 3 script
  ├── config.json                      ← source-code globs, strict mode toggle
  └── stop.log                         ← dry-run decision log (gitignored)
```

### Three enforcement layers

| Layer | Mechanism | Setup cost | IDE scope | Strength |
|-------|-----------|------------|-----------|----------|
| **L1** | `atomic-skills:status` skill invocation | Install atomic-skills (skill is usable immediately; no per-project setup) | All | Soft — requires user to invoke |
| **L2a** | `<HARD-GATE>` in CLAUDE.md + AGENTS.md redirect | Auto-installed via skill setup | All (any IDE reading CLAUDE.md/AGENTS.md) | Soft — prompt-level, decays with context |
| **L2b** | `SessionStart` hook injecting current status via `additionalContext` | Auto-installed via skill setup | Claude Code | Medium — guaranteed injection each session |
| **L3** | `Stop` hook with predicate check (dry-run → strict) | Auto-installed via skill setup | Claude Code | Strong — forces continuation; requires tuning |

## 5. Initiative Lifecycle

```
[none] --start--> [active] --archive--> [archived]
                      |
                      +--stack-push--> deeper frame active
                      +--stack-pop---> parent frame active (or archive if root popped)
                      +--parking-add--> item captured for later (same initiative)
                      +--emerged-add--> item captured (different initiative, separate file)
                      +--promote----> parking-lot item → In Progress task
```

States are implicit in the file contents; no external DB. The `status` field in the YAML frontmatter is authoritative for machine queries; everything else reads the Markdown.

## 6. The `atomic-skills:status` Skill

### Iron Law

`NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE.`

Every code-modifying session must either (a) be anchored to an active initiative file on disk, or (b) be explicitly declared ad-hoc by the user. "Anchored" means: the initiative's slug is known, its file exists, and the current stack frame reflects reality.

### Context-aware modes

The skill detects state on invocation and offers the appropriate actions. No subcommands; one entry point.

| Detected state | Offered actions |
|---|---|
| No setup (no `PROJECT-STATUS.md`, no hooks) | Run setup: create `PROJECT-STATUS.md`, inject CLAUDE.md HARD-GATE, create AGENTS.md if missing, install hooks, offer strict-mode choice |
| Setup done, no active initiative | Start new initiative, resume archived, or declare ad-hoc mode |
| Active initiative, branch/worktree matches | Push stack frame, pop stack frame, add to parking lot, add to emerged (different initiative), promote parking → In Progress, mark task Done, archive initiative |
| Active initiative, branch/worktree does NOT match (or multiple candidates) | Disambiguation prompt: `(a) continue X, (b) lateral expansion of X, (c) new initiative, (d) ad-hoc` |
| Setup done but CLAUDE.md HARD-GATE missing or stale | Offer to re-inject |

### Announcement on invocation

"Detecting current status context..." followed by either the detected state summary and available actions, or setup offer if first run.

### Setup flow

1. Check for existing `PROJECT-STATUS.md`. If present, skip creation step.
2. Check for `CLAUDE.md`. If absent, create minimal one (just the HARD-GATE block + note). If present, append HARD-GATE between markers:
   ```html
   <!-- atomic-skills:status-gate:start -->
   ...
   <!-- atomic-skills:status-gate:end -->
   ```
   Idempotent — re-running detects markers, replaces content if changed, skips if identical.
3. Check for `AGENTS.md`. If absent, create with `@CLAUDE.md` redirect (see §8). If present and doesn't reference CLAUDE.md, *suggest* addition but do not force.
4. Check for `.claude/` directory. If Claude Code (has `.claude/`), offer to install hooks. If another IDE, skip silently.
5. Hook installation offers three levels (user picks; default **Soft**):
   - **Passive**: only L2a (CLAUDE.md HARD-GATE). No hooks installed.
   - **Soft** (recommended default): L2a + L2b (SessionStart injection). No Stop hook.
   - **Strict**: L2a + L2b + L3. The L3 Stop hook is **always installed in dry-run mode initially** regardless of the user's final intent; after a 7-day grace window the skill offers promotion to real enforcement (see §10). "Strict" at setup time = "install L3 now, auto-dry-run, review later".
6. Create `PROJECT-STATUS.md` skeleton if missing.
7. Create `/initiatives/` directory.
8. Report what was installed with file paths and rollback instructions.

## 7. File Formats

### 7.1 `PROJECT-STATUS.md` (root index)

```markdown
# Project Status Index

Canonical entry point. Read this first every session.

## Active Initiatives

| Slug | Status | Started | Branch | Next Action |
|------|--------|---------|--------|-------------|
| migrar-auth-oidc | active | 2026-04-22 | feat/oidc | Validate state param CSRF |
| fix-cors-prod | blocked | 2026-04-20 | fix/cors | Waiting on SRE approval |

## Recently Archived (last 10)

- 2026-04-18 — [installer-redesign](./initiatives/archive/2026-04-installer-redesign.md)

## Ad-Hoc Sessions Log (last 5)

- 2026-04-21 — quick typo fix in README (no initiative)

---

<!-- atomic-skills:status last-updated: 2026-04-22T14:00Z -->
```

**Constraints:**
- Kept under 200 lines (compatible with auto-memory truncation rules even if placed there)
- Updated automatically by the `status` skill; manual edits allowed but skill detects and preserves them
- Last-updated marker is the source of truth for freshness

### 7.2 `/initiatives/<slug>.md`

```markdown
---
initiative_id: migrar-auth-oidc
status: active
started: 2026-04-22
branch: feat/oidc-migration
worktree: .trees/oidc-migration
plan_link: docs/superpowers/plans/2026-04-22-migrar-auth-oidc.md
wip_limit: 2
---

# Current Stack (active frame = deepest line)

1. [initiative] Migrar auth para OIDC
   2. [task T-042] Configurar Dex IDP
      3. [research] RFC 6749 §10 — redirect URI security
         4. [discussion] state param vs session cookie storage  ← ACTIVE

# Next Action

Validate state param CSRF + decide cookie vs session storage, then pop back to T-042 implementation.

## In Progress (WIP=2)

- [ ] **T-042-dex-config** — configure Dex IDP
  - Files: `infra/dex/config.yaml`, `services/api/auth/oidc.go`
  - Verify: `go test ./services/api/auth/...`
- [ ] **T-043-session-cookie** — swap JWT cookie impl

## Blocked

- [ ] T-044-frontend-login — waiting on T-042

## Parking Lot — same initiative, deferred

- [ ] Refresh token rotation handling (surfaced from RFC §10.4)
- [ ] Audit-log redaction for id_token payloads

## Emerged — different initiative (captured, not worked here)

- [ ] Webhook delivery retries in billing service → new initiative candidate

## Done (archive when > 20 entries)

- [x] T-041-spike-dex-vs-keycloak (2026-04-18)

---

```json
{
  "tasks": {
    "T-041": {"status": "done", "closed_at": "2026-04-18"},
    "T-042": {"status": "in_progress"},
    "T-043": {"status": "pending"},
    "T-044": {"status": "blocked", "blocker": "T-042"}
  },
  "stack_depth": 4,
  "last_checkpoint": "2026-04-22T14:00Z",
  "last_commit": "a318978"
}
```
```

**Format rationale (research references inline):**
- YAML frontmatter — stable ID, parseable; matches Anthropic skill spec convention.
- Current Stack at top — exploits primacy bias (Liu et al. 2024, lost-in-the-middle).
- Next Action as single line — recovery pointer for session resume.
- Kanban swimlanes — Parking Lot and Emerged explicitly separate "same initiative" from "different initiative" (matches user's explicit Q1 decision).
- `- [ ]` checkboxes — TICK paper (Cook et al. 2024) +5.8pp adherence.
- Done at bottom — exploits recency; keeps middle of file clean.
- Embedded JSON block — Anthropic harness research: models less likely to inappropriately overwrite JSON than Markdown; authoritative state lives here.
- Stable task IDs (`T-042-slug`) — addressable from PRs, commits, subagent spawns.

**Constraints:**
- Target < 10k tokens for reread efficiency (Chroma context rot guidance)
- Auto-archive Done section entries when > 20 (moves to archive file with date prefix)
- Stack depth warning: skill flags when depth > 6 ("are you sure this is still the same initiative?")

**Slug format convention:**
- Lowercase kebab-case only (`migrar-auth-oidc`, `fix-cors-prod`)
- Max 40 characters, no dates (dates live in frontmatter)
- Unique per `/initiatives/` directory (skill rejects duplicates during setup)
- Must match regex `^[a-z][a-z0-9-]{1,39}$`

**Branch match rule:**
- Primary: exact match on `branch:` field in frontmatter vs. `git rev-parse --abbrev-ref HEAD`
- Fallback if no exact match: prefix-match (e.g., current branch `feat/oidc-migration-v2` matches frontmatter `branch: feat/oidc-migration`). Multiple prefix matches → disambiguation (§11).
- No match → disambiguation flow.

## 8. Layer 2a — CLAUDE.md HARD-GATE + AGENTS.md Redirect

### CLAUDE.md block (injected idempotently)

```markdown
<!-- atomic-skills:status-gate:start -->
## Status Tracking (atomic-skills:status)

<HARD-GATE>
BEFORE any Write/Edit operation in source code:

1. Read `/PROJECT-STATUS.md`. Determine which initiative this work fits.
2. Resolution rules:
   - Exact match with an active initiative → read `/initiatives/<slug>.md` and report current stack frame
   - Multiple candidate initiatives, or new/ambiguous context → ASK the user:
     "Is this (a) continuation of <X>, (b) lateral expansion of <X>, (c) new initiative, or (d) ad-hoc work?"
   - No active initiative and context is new → ask: "Does this require a new initiative, or is it ad-hoc?"
3. Before the edit, announce which stack frame you are in.
4. If the edit opens a new depth (research, discussion, expansion), push a stack frame BEFORE the edit.
5. If the edit closes a frame (done, parked, emerged), update the file AFTER the edit in the same turn.

VIOLATION = code written without anchor = the exact problem this skill exists to prevent.
</HARD-GATE>

Invoke `atomic-skills:status` whenever a frame is pushed/popped, an item is parked, a task is promoted, or the initiative reaches a natural checkpoint.
<!-- atomic-skills:status-gate:end -->
```

**Idempotency:** re-running setup detects markers. If content between markers differs from current template version, offers diff and asks permission to update.

**Version tracking:** hard-gate content includes `<!-- version: X.Y.Z -->` for skill-level template evolution.

### AGENTS.md redirect logic

**If `AGENTS.md` absent:**

Create with:

```markdown
# AI Agent Instructions

This project follows Claude Code conventions. Read and follow @CLAUDE.md for all instructions, including status tracking requirements.

Additional project context:
- Memory: `.ai/memory/MEMORY.md` (see `atomic-skills:init-memory`)
- Status: `/PROJECT-STATUS.md` (see `atomic-skills:status`)
```

**If `AGENTS.md` exists:**

1. Check for any reference to `CLAUDE.md` (literal string or `@CLAUDE.md`).
2. If present → skip, AGENTS.md already links.
3. If absent → *suggest* (with a diff shown to user) adding a reference line. Do not force; the user may have intentional reasons.

**Cross-skill insight (to extract later):** This AGENTS.md-aware pattern should be reused by any atomic-skill that modifies CLAUDE.md. Recorded as follow-up in §16 and TODO.md.

## 9. Layer 2b — SessionStart Hook

### Script: `.claude/hooks/atomic-status/session-start.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

STATUS_FILE="${CLAUDE_PROJECT_DIR:-$PWD}/PROJECT-STATUS.md"
INITIATIVES_DIR="${CLAUDE_PROJECT_DIR:-$PWD}/initiatives"

context=""

# Index (top 20 lines)
if [[ -f "$STATUS_FILE" ]]; then
  context+="## Active Project Status (from /PROJECT-STATUS.md)\n"
  context+="$(head -20 "$STATUS_FILE")\n\n"
fi

# Detect active initiative by branch match
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [[ -n "$branch" && -d "$INITIATIVES_DIR" ]]; then
  match=$(grep -l "branch: $branch" "$INITIATIVES_DIR"/*.md 2>/dev/null | head -1)
  if [[ -n "$match" ]]; then
    slug=$(basename "$match" .md)
    context+="## Current Initiative: $slug\n"
    context+="$(head -40 "$match")\n"
  fi
fi

# Emit as JSON with additionalContext
jq -n \
  --arg ctx "$context" \
  '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'

exit 0
```

**Cost:** ~50–100 tokens per session depending on initiative file length. Re-fires automatically after `/compact` (Claude Code docs verified).

**Failure modes handled:**
- Missing `PROJECT-STATUS.md` → skip silently (session proceeds without status context)
- Outside git → skip branch detection
- No matching initiative → inject only index, not specific initiative
- Missing `jq` → fallback to printf-based JSON emission (installer checks and warns)

### Registration in `.claude/settings.local.json`

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/atomic-status/session-start.sh"
          }
        ]
      }
    ]
  }
}
```

## 10. Layer 3 — Stop Hook (Dry-Run → Strict)

### Script: `.claude/hooks/atomic-status/stop.sh`

Pseudocode (actual: ~80–120 lines of robust bash):

```bash
#!/usr/bin/env bash
set -euo pipefail

CONFIG="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/atomic-status/config.json"
LOG="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/atomic-status/stop.log"

# Parse stdin payload
payload=$(cat)
transcript_path=$(echo "$payload" | jq -r '.transcript_path // empty')
stop_hook_active=$(echo "$payload" | jq -r '.stop_hook_active // false')

# Safety: if Claude Code signals stop_hook_active, exit 0 immediately (avoid loops)
[[ "$stop_hook_active" == "true" ]] && exit 0

# Load config
strict_mode=$(jq -r '.strict_mode // false' "$CONFIG")
source_globs=$(jq -r '.source_globs[]' "$CONFIG")

# Determine active initiative
active=$(find initiatives -name '*.md' -not -path '*/archive/*' \
         | xargs grep -l "status: active" \
         | xargs -I {} grep -l "branch: $(git rev-parse --abbrev-ref HEAD)" {} \
         | head -1)

# No active initiative → skip
[[ -z "$active" ]] && exit 0

# Check: were Write/Edit tools used on source code this turn?
last_user_ts=$(tail -r "$transcript_path" | jq -r 'select(.role == "user") | .timestamp' | head -1)
code_edits=$(jq -r --arg ts "$last_user_ts" \
  'select(.timestamp > $ts and (.tool_use.name == "Write" or .tool_use.name == "Edit")) | .tool_use.input.file_path' \
  "$transcript_path" | grep -E "$(echo "$source_globs" | tr '\n' '|')" || true)

[[ -z "$code_edits" ]] && exit 0

# Check: was initiative file updated this turn?
initiative_mtime=$(stat -c %Y "$active")
turn_start_ts=$(date -d "$last_user_ts" +%s)

if [[ "$initiative_mtime" -lt "$turn_start_ts" ]]; then
  msg="Code edited without updating $active. Update stack/parking lot/tasks before ending the turn."

  if [[ "$strict_mode" == "true" ]]; then
    echo "$msg" >&2
    exit 2
  else
    echo "[$(date -Iseconds)] DRY-RUN would-block: $msg" >> "$LOG"
    exit 0
  fi
fi

exit 0
```

### Config: `.claude/hooks/atomic-status/config.json`

```json
{
  "strict_mode": false,
  "dry_run_started": "2026-04-22",
  "source_globs": [
    "src/**/*",
    "lib/**/*",
    "app/**/*",
    "services/**/*",
    "pkg/**/*",
    "internal/**/*"
  ],
  "max_stack_depth_warning": 6,
  "auto_archive_done_threshold": 20
}
```

### Mitigations for known risks

1. **Loop prevention** — respects `stop_hook_active` flag from payload (Anthropic-recommended).
2. **False-positive reduction via config** — user declares source globs; non-source edits (docs, configs, tests) don't trigger.
3. **Dry-run default** — 7-day grace period logs would-blocks; user reviews log before promoting to strict.
4. **Promotion prompt** — after 7 days in dry-run, next skill invocation offers: "Review the log? Promote to strict?"
5. **Emergency disable** — `touch .claude/hooks/atomic-status/SKIP` silences hook for 24h (skill documents this escape hatch prominently).
6. **Missing initiative file** — exits 0 silently (not every session is initiative-scoped).

### Evidence disclosure

**Documented primitives (verified):**
- Stop hook exit 2 blocks turn end and feeds stderr back to the model (Claude Code hooks docs).
- Hook receives `transcript_path` in stdin payload (verified).
- `stop_hook_active` flag prevents infinite loops (Anthropic documented).
- Pre-commit "doc-drift" detection is a real pattern ([dev.to reference](https://dev.to/mossrussell/your-ai-agent-is-coding-against-fiction-how-i-fixed-doc-drift-with-a-pre-commit-hook-1acn)).

**Synthesis (author's composition, not benchmarked):**
- The specific predicate "Write/Edit touched source AND initiative file mtime unchanged" is a novel composition for this skill. Working example at this level of specificity was not found in surveyed literature.
- Hence the dry-run-first design: we treat the predicate as a hypothesis to validate empirically before enforcing.

## 11. Disambiguation Flow

Triggered when: session starts in a branch that doesn't match any active initiative, OR multiple active initiatives match, OR user explicitly asks.

Presented as Structured Options:

```
Detected context:
- Branch: feat/new-work
- Last commit: "Add X"
- No matching active initiative in /PROJECT-STATUS.md

Active initiatives:
  1. migrar-auth-oidc (branch feat/oidc-migration, last updated 2026-04-22)
  2. fix-cors-prod (branch fix/cors, blocked)

Is this work:
  (a) Continuation of an existing initiative (pick: 1 or 2)
  (b) Lateral expansion of an existing initiative (pick: 1 or 2, add frame to its stack)
  (c) A new initiative (skill will prompt for name, goal, etc.)
  (d) Ad-hoc work (no initiative; session runs without status anchor)
```

User picks; skill proceeds:
- (a): loads the selected file, asks where in the stack to land
- (b): loads the selected file, pushes a new stack frame for this lateral work
- (c): scaffolds new initiative file, updates `PROJECT-STATUS.md`, stops to confirm details
- (d): logs to `PROJECT-STATUS.md` ad-hoc sessions list with timestamp + one-line description

## 12. Composition with Existing Skills

| Skill | Relationship |
|-------|-------------|
| `atomic-skills:init-memory` | Parallel, non-competing. `init-memory` owns `.ai/memory/` (learnings, decisions). `status` owns `/PROJECT-STATUS.md` + `/initiatives/` (operational state). Both can coexist; setup of one does not affect the other. |
| `atomic-skills:save-and-push` | Optional integration: `save-and-push` can call `atomic-skills:status` to mark current stack frame as Done before commit. Not required; skill works without. |
| `superpowers:writing-plans` | Initiative frontmatter has `plan_link` pointing to plan file. Plan = static design; initiative = living execution. Linked but independent. |
| `everything-claude-code:ck` | Orthogonal. CK is session-scope ("what was I doing last time"); `status` is initiative-scope ("where is this feature in its lifecycle"). Both can be installed. |
| `superpowers:brainstorming` / `writing-plans` | These feed INTO `status`. After brainstorming produces a plan, `status-init` creates the initiative file linking to the plan. |
| Future `atomic-skills:install-project-instruction` | **Follow-up.** Extract the CLAUDE.md injection + AGENTS.md redirect logic into a helper shared across any skill that modifies project instruction files. |

## 13. Deliverables

### Skill files

- `skills/pt/core/status.md` — Portuguese skill (primary for this user, matches atomic-skills:pt convention)
- `skills/en/core/status.md` — English translation
- `meta/skills.yaml` — register under `core.status` with description

### Setup assets (templates)

- `skills/shared/status-assets/CLAUDE.md-gate.template.md` — template for the HARD-GATE block
- `skills/shared/status-assets/AGENTS.md.template.md` — template for new AGENTS.md
- `skills/shared/status-assets/PROJECT-STATUS.md.template.md` — empty index skeleton
- `skills/shared/status-assets/initiative.template.md` — empty initiative file skeleton with instructions

### Hook scripts

- `skills/shared/status-assets/hooks/session-start.sh`
- `skills/shared/status-assets/hooks/stop.sh`
- `skills/shared/status-assets/hooks/config.json` (defaults)
- `skills/shared/status-assets/hooks/README.md` (how to debug, how to disable)

### Tests

- `tests/status.test.js`:
  - Render test: skill renders correctly for each IDE profile (claude-code, gemini, generic)
  - Setup idempotency: running setup twice doesn't duplicate HARD-GATE block
  - AGENTS.md creation: absent file → created; existing file → not overwritten
  - Marker detection: modified content between markers → diff offered
  - Hook config parsing: invalid JSON → graceful fallback
- `tests/install.test.js` and `tests/detect.test.js`: update expected core skill count

### Documentation

- `README.md` — add `status` row to overview table + full section
- `README.pt-BR.md` — mirror Portuguese
- `CLAUDE.md` (project CLAUDE.md of atomic-skills repo) — note new skill convention
- `TODO.md` — add follow-up: extract `install-project-instruction` helper

### Design artifact

- This spec file (`docs/superpowers/specs/2026-04-22-status-initiative-design.md`)
- Implementation plan (produced next by `superpowers:writing-plans`)

## 14. Testing Strategy

### Unit tests (render + setup)

- Skill renders to all supported IDE profiles without `{{BASH_TOOL}}` etc. leaking
- YAML frontmatter markers correctly placed in templates
- Setup idempotency: running N times converges on same file state

### Integration tests (skill behavior)

- Fresh project: setup creates expected files
- Existing CLAUDE.md: HARD-GATE appended, not overwriting other content
- Existing AGENTS.md without CLAUDE.md reference: suggestion offered, not forced
- Active initiative + matching branch: status skill enters "active mode"
- Active initiative + non-matching branch: disambiguation flow presented

### Hook tests (script-level)

- `session-start.sh` with missing PROJECT-STATUS.md: exits 0, no error
- `session-start.sh` in non-git dir: exits 0, emits only index
- `stop.sh` in dry-run mode: writes to log, never exits 2
- `stop.sh` with `stop_hook_active=true`: exits 0 immediately
- `stop.sh` with missing transcript: exits 0 (degraded mode, does not crash session)
- `stop.sh` with SKIP sentinel file: exits 0 silently

### Manual QA checklist

- Install in a fresh Claude Code project; run a mini-initiative end-to-end
- Test each disambiguation path
- Simulate worktree switch mid-session
- Trigger compaction; verify SessionStart re-fires with status context
- Enable strict mode; verify predicate triggers on real missed update and does NOT trigger on legitimate ad-hoc edits

## 15. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Stop hook false positives cause user frustration | High | Dry-run default; 7-day grace; configurable source globs; SKIP escape hatch |
| Stop hook infinite loop | Medium | Respect `stop_hook_active` payload flag; also hard upper-bound on stderr retry messages |
| HARD-GATE in CLAUDE.md bloats context | Low | ~25 lines; within atomic-skills pattern norms; single block |
| AGENTS.md auto-creation surprises user | Low | Setup flow shows preview and asks confirmation; creation only if absent |
| Initiative file > 10k tokens → context rot | Medium | Auto-archive Done > 20 entries; depth warning at stack > 6; doc recommends splitting if overloaded |
| Multi-worktree desync on same initiative | Medium | Status file is git-tracked; worktrees share object DB; conflict on merge is visible. Skill warns if initiative `branch:` doesn't match current worktree |
| User disables hooks but skill still expected to work | Low | L1 (skill) is fully functional without L2b/L3. Document clearly |
| User runs skill in non-atomic-skills project | Low | Skill checks for atomic-skills install; runs anyway if user confirms |
| CLAUDE.md doesn't exist in project | Low | Setup creates minimal CLAUDE.md with just the HARD-GATE + pointer note |
| Skill conflicts with `ck` or similar | Low | Orthogonal scopes; tested to coexist; document in §12 |

## 16. Open Questions & Follow-ups

### Follow-ups (not blocking this skill)

1. **Extract `atomic-skills:install-project-instruction` helper** — the CLAUDE.md injection + AGENTS.md redirect logic is cross-cutting. Today we embed it in `status` setup; future skills (`init-memory`, `save-and-push`, any new skill modifying CLAUDE.md) should delegate. Add to TODO.md.
2. **Human rendering skill (`atomic-skills:status-render`)** — converts initiative files to a terminal dashboard or HTML report. Separate skill; out of scope here.
3. **Strict mode promotion ritual** — after 7-day dry-run, the skill should offer a structured review of the log and ask for promotion. Fine-tune prompts during implementation.
4. **Integration with `save-and-push`** — optional wiring once both skills are in place.

### Deferred decisions (flagged; resolve during implementation)

1. **Hook script language** — bash for portability, or Node.js for consistency with atomic-skills CLI? Leaning bash (zero dep, universally available); revisit if bash becomes painful.
2. **Exact source-globs defaults** — current list is language-agnostic heuristic. Consider language detection (JS → `src/`, Go → `internal/`, Python → per `pyproject.toml`, etc.) as a stretch goal.
3. **Archive retention** — should `/initiatives/archive/` have retention policy? Default: keep everything. Revisit if repo bloats.

## 17. References

### Research sources

- Chroma Research — "Context Rot" (https://www.trychroma.com/research/context-rot)
- Liu et al. 2024 — "Lost in the Middle" (https://arxiv.org/abs/2307.03172)
- Anthropic — "Effective context engineering for AI agents" (https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Anthropic — "Effective harnesses for long-running agents" (https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Cook et al. 2024 — TICK: Towards Improving Checklist-based LLM Evaluation (https://arxiv.org/html/2410.03608v1)
- Packer et al. 2023 — MemGPT (https://arxiv.org/abs/2310.08560)
- Xu et al. 2025 — A-MEM Zettelkasten agentic memory (https://arxiv.org/abs/2502.12110)

### Tool / pattern references

- Claude Code hooks — https://code.claude.com/docs/en/hooks
- Claude Code memory — https://code.claude.com/docs/en/memory
- Claude Code settings — https://code.claude.com/docs/en/settings
- AGENTS.md standard — https://agents.md/
- Cursor Memory Bank pattern — https://github.com/vanzan01/cursor-memory-bank
- OpenSpec — https://github.com/Fission-AI/OpenSpec/
- GitHub Spec Kit — https://github.com/github/spec-kit
- Kiro steering docs — https://kiro.dev/docs/steering/
- Doc-drift pre-commit hook — https://dev.to/mossrussell/your-ai-agent-is-coding-against-fiction-how-i-fixed-doc-drift-with-a-pre-commit-hook-1acn
- Agentic Gatekeeper pre-commit — https://community.openai.com/t/agentic-gatekeeper-an-autonomous-pre-commit-hook-powered-by-openai/1374788

### Internal references

- `atomic-skills:init-memory` — `/home/henry/atomic-skills/skills/pt/modules/memory/init-memory.md`
- `atomic-skills:save-and-push` — `/home/henry/atomic-skills/skills/pt/core/save-and-push.md`
- `atomic-skills:parallel-dispatch` — design reference for structured HARD-GATEs
- `superpowers:writing-plans` — `/home/henry/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/writing-plans/SKILL.md`
- Project CLAUDE.md — `/home/henry/atomic-skills/CLAUDE.md`
- Multi-IDE compatibility — `/home/henry/atomic-skills/docs/kb/gemini-cli-compatibility.md`
