Write adversarial tests for existing code to find hidden bugs and add meaningful coverage.

If $ARGUMENTS was provided, use as the target (file path, class, or function).
If not, ask: "Which file or function do you want to hunt bugs in? Be specific — one class or function per run."

## Fundamental Rule

NO HUNT WITHOUT BOUNDED SCOPE.
One class or one public function per run. If the target covers more than ~300 lines
of source code, break into multiple runs. Breadth finds nothing — depth finds bugs.

<HARD-GATE>
If $ARGUMENTS points to a directory, a module, or more than ~3 files:
DO NOT start working. Ask the user to narrow the scope to a specific file or function.
Suggest the most critical/complex file as a starting point.
</HARD-GATE>

<HARD-GATE>
BEFORE writing any assertion, answer:
"Does this expected value come from the SPEC or from the CODE?"
If from the code: STOP. Derive it from the spec, docs, method name, or ask the user.
Tests that mirror implementation logic are tautological — they confirm bugs instead of catching them.
</HARD-GATE>

## Mindset

You are a penetration tester, not a QA checklist runner.
Your job is to BREAK the code, not confirm it works.
If all your tests pass, you weren't aggressive enough.

## Process

### Phase 1: Read the Target

Read the target file/function completely with the Read tool. Register:

> **Target:** [file:lines or class::method]
> **Lines of code:** [count]
> **Dependencies:** [what it calls, what calls it]
> **Existing tests:** [path if they exist, "none" if not]

If existing tests exist, read them to understand what is ALREADY covered.

### Phase 2: Understand Intent

The code does what it DOES. You need to know what it SHOULD do.

Search for intent sources (execute EACH, don't skip):
- Method/class name and docblock — what does the name promise?
- `git log --oneline -10 -- [file]` — why was it created/changed?
- Grep for references in docs, specs, or CLAUDE.md
- Read callers (Grep for the class/method name) — how is it used?

If intent is ambiguous, ask the user: "What should [function] do when [scenario]?"

Register:
> **Intent:** [what the code SHOULD do, in domain language]
> **Source of intent:** [docblock / commit message / spec / user clarification]

### Phase 3: Map Coverage Gaps

Compare "what the code does" against "what is tested":

1. List every execution path (branches, conditions, early returns, catch blocks)
2. For each path, check: does an existing test exercise this? (cite test file:line)
3. Mark: COVERED / NOT COVERED / PARTIALLY COVERED

Present the gap map:
> **Paths found:** [N]
> **Already covered:** [N] (by existing tests)
> **Gaps:** [list the uncovered paths with file:line]

### Phase 4: Plan the Attack

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

For EACH test in the approved list, one at a time:

**5a. Write the test:**
- One behavior per test. If the test name contains "and", split it.
- Expected values from the SPEC (Phase 2), NEVER from reading the implementation.
- Use the project's test conventions (check existing tests or CLAUDE.md for patterns).

**5b. Run the test:**
- Execute the test in isolation. Register the result.
- **If it PASSES:** behavior confirmed. Mark as coverage added. Move to next test.
- **If it FAILS:** potential bug found. Do NOT fix. Register:
  > **Bug found:** [test name]
  > **Expected:** [what spec says]
  > **Actual:** [what code does]
  > **Location:** [file:line where the bug likely lives]

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

**Bugs found:** [N]
**Coverage added:** [N] tests for [N] previously uncovered paths
**Suggested next runs:** [other files/functions that should be hunted]

## Red Flags

- "The code looks straightforward, I'll just write a few happy path tests"
- "I already know how this works, I don't need to read callers"
- "I'll calculate the expected value from the code to make sure my test is right"
- "This edge case is unlikely, I'll skip it"
- "The test failed but it's probably my test that's wrong, not the code"
- "I'll test the private methods to be thorough"
- "The scope is big but I can handle it in one run"
- "All tests pass, the code is solid"

If you thought any of the above: STOP. Go back to the step you were skipping.

## Rationalization

| Temptation | Reality |
|-----------|---------|
| "I'll derive expected values from the code" | That's a tautological test — confirms bugs instead of catching them. HARD-GATE |
| "This function is simple, no edge cases" | Simple functions hide the subtlest bugs. Null, empty, boundary — always check |
| "All tests pass, my job is done" | 100% pass rate means you weren't aggressive enough. Did you test error paths? |
| "The scope is only 400 lines, close enough to 300" | Depth degrades linearly with scope. Split and hunt each part properly |
| "I'll test internals for better coverage" | Test BEHAVIOR, not implementation. Internal tests break on refactoring |
| "I'll fix the bug I found while I'm here" | Hunting and fixing are different tasks. Report the bug, let the user decide |
| "No spec exists, I'll use the code as spec" | Code IS the current behavior, not the INTENDED behavior. Ask the user |
| "I'll write all tests first, then run them" | One at a time. Each test must be observed individually to catch the right thing |
