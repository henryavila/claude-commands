Write adversarial tests for existing code to find hidden bugs and add meaningful coverage.

If $ARGUMENTS was provided, use as the target (file path, class, function, or directory).
If not, ask: "Which file, function, or directory do you want to hunt bugs in?"

## Fundamental Rule

NO HUNT WITHOUT BOUNDED SCOPE.
One class or one public function per subagent. If a single file exceeds ~300 lines,
suggest splitting by method. Breadth finds nothing — depth finds bugs.

<HARD-GATE>
BEFORE writing any assertion, answer:
"Does this expected value come from the SPEC or from the CODE?"
If from the code: STOP. Derive it from the spec, docs, method name, or ask the user.
Tests that mirror implementation logic are tautological — they confirm bugs instead of catching them.
</HARD-GATE>

## Mindset

You are a penetration tester, not a QA checklist runner.
Your job is to BREAK the code, not confirm it works.
If all your tests pass, question whether you were aggressive enough — did you cover
error paths, boundaries, and invalid state? Well-written code can legitimately pass,
but only after you've genuinely tried to break it.

## Process

### Phase 0: Triage (directory targets only)

If $ARGUMENTS is a directory, run triage mode. If it is a single file or function, skip to Phase 1.

**0a. Scan and rank:**
```bash
# List files with line counts
find [directory] -name "*.php" -o -name "*.ts" -o -name "*.py" | head -30
wc -l [each file]
```

For each file, assess risk:
```bash
# Recent activity (more commits = more changes = more risk)
git log --oneline --since="3 months ago" -- [file] | wc -l

# Existing test coverage
grep -rn "ClassName" tests/ --include="*.php" --include="*.ts" --include="*.py" 2>/dev/null | wc -l
```

**0b. Filter out non-huntable files:**
Skip: interfaces, enums, DTOs with no logic, files < 20 lines, config files.

**0c. Present ranked list to user:**
> Found [N] huntable files:
>
> | # | File | Lines | Commits (3mo) | Tests | Risk |
> |---|------|-------|---------------|-------|------|
> | 1 | ImportService.php | 220 | 12 | 0 | HIGH |
> | 2 | DeduplicationService.php | 168 | 6 | 9 | MEDIUM |
> | 3 | KpiCalculator.php | 85 | 2 | 3 | LOW |
>
> A) Hunt all ([N] isolated subagents)
> B) Select which to hunt
> C) Cancel

Risk = HIGH when 0 tests OR > 8 recent commits. MEDIUM when < 5 tests AND > 3 commits. LOW otherwise.

Wait for user approval.

**0d. Execute hunts:**
For EACH approved file, spawn an **isolated subagent** with this instruction:
```
Execute /as-hunt [file path]
```
Each subagent runs Phases 1-6 independently with clean context.
This isolation prevents tautological cross-file knowledge leaks.

After all subagents complete, proceed to Phase 7 (Consolidated Report).

### Phase 1: Read the Target

Read the target file/function completely with the Read tool. Register:

> **Target:** [file:lines or class::method]
> **Lines of code:** [count]
> **Dependencies:** [what it calls, what calls it]
> **Existing tests:** [path if they exist, "none" if not]

**Scope check:** if the target exceeds ~300 lines, STOP and suggest splitting:
> "Target has [N] lines. I recommend splitting:
> A) Hunt [class::methodA] first (~120 lines)
> B) Hunt [class::methodB] first (~80 lines)
> C) Proceed anyway (depth will be reduced)"

Search for existing tests beyond obvious paths:
```bash
grep -rn "ClassName\|method_name" tests/ --include="*.php" --include="*.ts" --include="*.py" 2>/dev/null
```

If existing tests exist, read them to understand what is ALREADY covered.

### Phase 2: Understand Intent

The code does what it DOES. You need to know what it SHOULD do.

Search for intent sources (execute EACH, don't skip):
- Method/class name and docblock — what does the name promise?
- `git log --oneline -10 -- [file]` — why was it created/changed?
- Grep for the class/method name in docs/, specs, README, or CLAUDE.md
- Read callers (Grep for the class/method name in app/) — how is it used?

If intent is ambiguous, ask the user: "What should [function] do when [scenario]?"

Register:
> **Intent:** [what the code SHOULD do, in domain language]
> **Source of intent:** [docblock / commit message / spec / user clarification]

### Phase 3: Map Coverage Gaps

Compare "what the code does" against "what is tested":

1. List every execution path (branches, conditions, early returns, catch blocks)
2. For each path, check: does an existing test exercise this? (cite test file:line)
3. Mark: COVERED / NOT COVERED / PARTIALLY COVERED

Present the gap map as a table:

| # | Path | Code location | Tested? | Test location |
|---|------|--------------|---------|---------------|
| 1 | [description] | file:line | COVERED / NOT / PARTIAL | test:line or — |

> **Paths found:** [N] | **Covered:** [N] | **Gaps:** [N]

### Phase 4: Plan the Attack

Transform each gap from Phase 3 into a test. Also add tests for behaviors that ARE covered
but only on the happy path — adversarial edge cases on covered paths count as gaps.

Create a test list organized by category. Present to the user BEFORE writing any test.

**Categories (in priority order):**
1. **Business rules** — calculations, validations, state transitions that enforce domain logic
2. **Edge cases** — null, empty collection, zero, one, max, boundary values
3. **Error paths** — invalid input, missing dependencies, exception handling, timeouts
4. **Happy path** — only if no existing test covers the basic scenario

For each test, write ONE LINE describing the behavior being tested:
```
1. [business] returns zero when no vulnerabilities in period
2. [edge] handles empty scan results without exception
3. [error] throws when import file is malformed
4. [edge] boundary: exactly 30 days returns current month, 31 returns previous
```

> Test list ready. [N] tests planned across [categories]. Proceed?

Wait for user approval. The user may reorder, add, or remove tests.

### Phase 5: Write Tests

**Detect test conventions first:**
Check existing tests near the target, CLAUDE.md, or project config to determine:
- Framework (Pest/PHPUnit/Jest/pytest/etc.)
- Naming pattern (`{Class}Test.php`, `{class}.test.ts`, `test_{module}.py`)
- Location (`tests/Unit/`, `tests/Feature/`, `__tests__/`)
- Patterns (beforeEach, factories, mocks — read the closest existing test)

For EACH test in the approved list, one at a time:

**5a. Write the test:**
- One behavior per test. If the test name contains "and", split it.
- Expected values from the SPEC (Phase 2), NEVER from reading the implementation.
- Follow detected conventions from above.

**5b. Run the test:**
- Execute the test in isolation. Register the result.
- **If it PASSES:** behavior confirmed. Mark as coverage added. Move to next test.
- **If it FAILS:** distinguish the cause:
  - **Setup error** (missing factory, DB issue, wrong mock): fix the TEST, not the code. Re-run.
  - **Actual code bug** (assertion mismatch on real behavior): register as bug found.

  For bugs found, register and offer:
  > **Bug found:** [test name]
  > **Expected:** [what spec says]
  > **Actual:** [what code does]
  > **Location:** [file:line where the bug likely lives]
  > A) Fix now with /as-fix (recommended — test already reproduces the bug)
  > B) Continue hunting (fix later)
  > C) Mark and decide later

  If user picks A: invoke `/as-fix` — the failing test IS the reproducing test (Phase 3 of as-fix is already done).

**5c. Discovery:**
- While writing test N, if you discover a new edge case or path, add it to the test list.
- Do NOT pursue it now — finish the current test first.

### Phase 6: Report

Present the final report:

### Hunt Report

**Target:** [file/function]
**Intent source:** [where the spec came from]
**Tests written:** [N] (business: X, edge: Y, error: Z, happy: W)

| # | Test | Category | Result | Finding |
|---|------|----------|--------|---------|
| 1 | [name] | business | PASS | coverage added |
| 2 | [name] | edge | FAIL | bug: [description] at [file:line] |
| 3 | [name] | error | SETUP | fixed test setup, re-ran — PASS |

**Bugs found:** [N] (fixed via as-fix: X, deferred: Y)
**Coverage added:** [N] tests for [N] previously uncovered paths
**Suggested next runs:** [other files/functions that should be hunted]

{{#if modules.memory}}
**Save to memory:** update `{{memory_path}}` with:
- Files hunted and date
- Bugs found (to avoid re-discovery)
- Coverage gaps remaining (suggested next runs)
Update existing hunt records instead of creating duplicates.
{{/if}}

**Mutation testing (optional):** to validate test quality, consider running mutation testing
if available in the project (Infection for PHP, Stryker for JS, mutmut for Python).
Surviving mutants reveal tautological or weak tests.

### Phase 7: Consolidated Report (directory mode only)

If Phase 0 was executed (directory triage), collect all subagent reports and present:

### Consolidated Hunt Report

**Directory:** [path]
**Files hunted:** [N] / [total found]

| # | File | Tests added | Bugs found | Risk before | Status |
|---|------|------------|------------|-------------|--------|
| 1 | ImportService.php | 12 | 2 | HIGH | 2 bugs deferred |
| 2 | DeduplicationService.php | 8 | 0 | MEDIUM | clean |

**Total tests added:** [N]
**Total bugs found:** [N] (fixed: X, deferred: Y)
**Remaining high-risk files:** [files not hunted or with deferred bugs]

## Red Flags

- "The code looks straightforward, I'll just write a few happy path tests"
- "I already know how this works, I don't need to read callers"
- "I'll calculate the expected value from the code to make sure my test is right"
- "This edge case is unlikely, I'll skip it"
- "The test failed — must be my test that's wrong, I'll adjust the assertion"
- "I'll test the private methods to be thorough"
- "The scope is big but I can handle it in one run"
- "All tests pass, nothing left to do"
- "I'll hunt all files in my own context instead of using subagents"

If you thought any of the above: STOP. Go back to the step you were skipping.

## Rationalization

| Temptation | Reality |
|-----------|---------|
| "I'll derive expected values from the code" | That's a tautological test — confirms bugs instead of catching them. HARD-GATE |
| "This function is simple, no edge cases" | Simple functions hide the subtlest bugs. Null, empty, boundary — always check |
| "All tests pass, my job is done" | Did you cover error paths and boundaries? If yes, the code may be solid. If no, hunt deeper |
| "The scope is only 400 lines, close enough to 300" | Depth degrades linearly with scope. Split and hunt each part properly |
| "I'll test internals for better coverage" | Test BEHAVIOR, not implementation. Internal tests break on refactoring |
| "I can hunt multiple files in one context" | Cross-file knowledge causes tautological tests. Isolated subagents prevent this |
| "No spec exists, I'll use the code as spec" | Code IS the current behavior, not the INTENDED behavior. Ask the user |
| "I'll write all tests first, then run them" | One at a time. Each test must be observed individually to catch the right thing |
| "The test failed, I'll adjust my expected value to match" | If the code doesn't match the spec, that's a BUG, not a wrong test. Verify intent first |
| "I'll fix the bug myself instead of using as-fix" | as-fix has its own TDD discipline. The failing test is already the reproducing test — hand it off |
