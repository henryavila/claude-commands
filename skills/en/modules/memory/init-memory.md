Standardize this project's memory to `{{memory_path}}` (canonical, versioned in git).

Announce when starting: "I will standardize this project's memory to `{{memory_path}}`."

## Fundamental Rule

NO DELETION WITHOUT CONFIRMED BACKUP.
Original memory directories can only be removed AFTER confirming that
ALL files were successfully copied to `{{memory_path}}`.
Confirm = run `ls` on both directories and compare.

## Critical Context — How Claude Code Reads Memory

Claude Code loads auto-memory from `~/.claude/projects/<project>/memory/MEMORY.md` by default.
Moving files to `{{memory_path}}` does NOT make Claude read them automatically.

There are 2 ways to connect `{{memory_path}}` to Claude Code:

**Path A — `autoMemoryDirectory` (recommended):** Configure in `.claude/settings.local.json`:
```json
{ "autoMemoryDirectory": "/absolute/path/to/{{memory_path}}" }
```
Claude reads `{{memory_path}}MEMORY.md` directly. No intermediary.
- Only accepts absolute paths
- Only in settings.local.json or user settings (NOT project settings)
- Each machine needs its own configuration (not shareable)

**Path B — Redirect (fallback):** Create a `MEMORY.md` in `~/.claude/projects/<project>/memory/`
that points to `{{memory_path}}`. Works but is fragile — new memory files
become invisible if the redirect is not updated.

## MEMORY.md Limits

- Only the first **200 lines** (or 25KB) are loaded at startup
- Topic files (files beyond MEMORY.md) are read on demand
- If the index grows too large, content at the end is **silently truncated**
- Keep MEMORY.md as a lean index with links to topic files

## Process

### 1. Detect existing memory

Scan the project by running `ls` and `find` on known locations:
- `{{memory_path}}`
- `.memory/`
- `docs/memory/`
- `~/.claude/projects/*/memory/` — Claude Code's default auto-memory (may have content)
- Any other directory referenced in the project's instructions as memory

Run `grep -r "memory\|autoMemoryDirectory" CLAUDE.md AGENTS.md .claude/settings*.json 2>/dev/null`
to find references and existing configurations.

If you find unexpected directories, list them and ask the user.

### 2. Present findings and request confirmation

List what you found with origin, file count, and total size.

Present as Structured Options:

> Found memory in:
> 1. `.memory/` (8 files, 12KB)
> 2. `~/.claude/projects/.../memory/` (3 files, 4KB) — Claude Code auto-memory
>
> Options:
> A) Migrate everything to `{{memory_path}}`
> B) Select which to migrate
> C) Cancel

Wait for a response before proceeding.

### 3. Migrate files

- Create `{{memory_path}}` if it does not exist
- Copy the approved files to `{{memory_path}}`
- If there are multiple `MEMORY.md` files, merge them into a single index
- Run `ls` on the destination to confirm all files arrived

<HARD-GATE>
DO NOT remove the original directories yet.
Removal only happens in step 8, after ALL validation.
If the user asks to remove now: explain that validation
ensures safety and removal comes at the end.
</HARD-GATE>

### 4. Organize content

- **Already has structure** (multiple thematic files): preserve as-is
- **No memory at all**: create `{{memory_path}}MEMORY.md` with an empty index
- **Single blob** (one giant file with everything mixed): separate into thematic
  files grouped by affinity. Descriptive names matching the domain.
  Only mandatory file: `MEMORY.md` as the index.

Verify that `MEMORY.md` has **less than 200 lines**. If over, move detailed
content to topic files and keep only links in the index.

### 5. Connect to Claude Code

Detect the IDE in use by checking for `.claude/`, `.cursor/`, `.gemini/`, etc.

**If Claude Code (`.claude/` exists):**

Check if `autoMemoryDirectory` is already configured:
```bash
grep -r "autoMemoryDirectory" .claude/settings*.json 2>/dev/null
```

If NOT configured, present:

> Claude Code reads memory from `~/.claude/projects/<project>/memory/` by default.
> To read from `{{memory_path}}` directly, I need to configure `autoMemoryDirectory`.
>
> A) Configure `autoMemoryDirectory` in `.claude/settings.local.json` (recommended)
> B) Create manual redirect in the default directory (fragile, needs maintenance)
> C) Skip — configure later

If option A: add `"autoMemoryDirectory": "<absolute path to {{memory_path}}>"` to `.claude/settings.local.json`.
If option B: create redirect in `~/.claude/projects/<project>/memory/MEMORY.md` pointing to `{{memory_path}}`.

**If other IDE:** skip this step (other IDEs don't have native auto-memory).

### 6. Update project instructions

- If the project's instruction file does NOT exist: create it with a memory section
- If it ALREADY exists AND `autoMemoryDirectory` was configured (step 5A):
  DO NOT add memory instructions to CLAUDE.md — Claude already reads it automatically.
  Every line in CLAUDE.md costs tokens in EVERY session.
- If it ALREADY exists AND using redirect (step 5B) or other IDE:
  Add the minimum:
  ```
  ## Memory
  Consult `{{memory_path}}MEMORY.md` before implementing.
  Update memory when learning something relevant for future sessions.
  ```

### 7. Update broken references

Run `grep -r` on the old memory paths throughout the entire project.

- **Operational files** (project instructions, agent configs):
  update references to `{{memory_path}}`
- **Historical docs** (plans, designs, specs): list the references
  but DO NOT change without asking — they are historical records

### 8. Validation and cleanup

Verify by running each command (not just "verify"):

- Run `ls {{memory_path}}` — should show the migrated files
- Run `wc -l {{memory_path}}MEMORY.md` — should be < 200 lines
- Verify the Claude Code connection:
  - If autoMemoryDirectory: `grep autoMemoryDirectory .claude/settings*.json`
  - If redirect: `cat ~/.claude/projects/*/memory/MEMORY.md 2>/dev/null | head -5`
- Verify that project instructions DO NOT have redundant memory instructions
  (if autoMemoryDirectory was configured)

If EVERYTHING passed: now remove the original directories (the ones that were migrated).
For each directory to remove, list the full path and ask for confirmation:

> Remove original directory `.memory/`? (files are already in `{{memory_path}}`)
> Type "remove" to confirm.

## Closing

Present report:
- Files migrated: [count] from [origin(s)]
- MEMORY.md: [lines] (limit: 200)
- Claude Code connection: [autoMemoryDirectory / redirect / not configured]
- Project instructions: [created/updated/not needed]
- References updated: [which files]
- Directories removed: [which]
- Problems found: [if any]

## Red Flags

- "I'll remove the original directory before validating"
- "The content was probably copied, I don't need to test"
- "The project instructions should already have the reference, I don't need to check"
- "I'll edit a historical doc to update the path"
- "That unexpected memory directory is probably not important"
- "I don't need to check autoMemoryDirectory, Claude will find it"
- "I'll add memory instructions to CLAUDE.md even with autoMemoryDirectory configured"

If you thought any of the above: STOP. Run the verification you were skipping.
