# Worked examples: weak goal → loop-ready spec

The actual work of loop engineering is converting a subjective adjective into something `lint_spec.mjs` and `run_loop.mjs` can both act on mechanically. These are full conversions, both passing the linter.

## Example 1 — UI build

**Weak (fails `verify` immediately):**
> "Build me a landing page that looks good and works well."

Problems: no verifier, no termination, "looks good" is unjudgeable mechanically. `lint_spec.mjs` would report missing Verification command, missing Termination, missing Scope forbidden-action, missing Escalation.

**Loop-ready (passes `verify`):**
```markdown
# Loop: landing page build

## Goal
Landing page at /index.html: hero, 3-feature grid, signup form. Mobile-responsive at 375px and 1440px widths.

## Verification
```
npm run build && npm run lint && npx playwright test tests/landing.spec.ts
```
(visual check folded in: Lighthouse mobile score >= 90, captured via `npx lighthouse --output=json`)

## Termination
- Success: all commands above exit 0 AND Lighthouse score >= 90
- Max iterations: 8
- No-progress: stop if 2 consecutive iterations produce identical result + unchanged working tree
- Budget: none

## Scope
- Allowed: /src, /tests, /public
- Forbidden: do not edit playwright config to skip failing assertions; do not touch /api

## Escalation
On cap: write attempts.md summarizing each iteration's score + diff, stop, wait for human review.
```

## Example 2 — Bug fix / refactor

**Weak:**
> "Fix the flaky tests."

**Loop-ready:**
```markdown
# Loop: stabilize integration tests

## Goal
All tests in /tests/integration pass on 5 consecutive runs (currently ~30% flake rate).

## Verification
```
for i in 1 2 3 4 5; do npm test -- tests/integration || exit 1; done
```

## Termination
- Success: loop above exits 0
- Max iterations: 10
- No-progress: stop if same test name fails with the same error message 2 iterations in a row with no code change
- Budget: none

## Scope
- Allowed: /src, /tests/integration
- Forbidden: do not increase timeouts as the only fix; do not mark tests as skip/pending to "pass"

## Escalation
On cap: report which test(s) still flake + last 3 stack traces, stop.
```

## Pattern to notice

Both conversions turn a subjective adjective ("looks good," "flaky tests") into something a shell command returns pass/fail on. If you can't find a command that returns pass/fail, you're stuck with LLM-as-judge — say so explicitly in the Verification section rather than hiding it, and expect `lint_spec.mjs` to accept it only because it was named, not because it's as trustworthy as a real test command.
