# `run` — execute the loop end-to-end

Triggered by: `/loop run [path]`, "start the loop," "iterate until this passes."

## Precondition

**Never run a spec that hasn't passed the linter.** Run `node <skill-dir>/scripts/lint_spec.mjs <path>` first if it hasn't been checked in this conversation already. If it fails, stop and go to `reference/harden.md` — do not run a loop against an incomplete spec; the no-progress and cap logic only mean something if Goal/Verification/Termination are real.

## The loop

This is the actual cycle. The script (`run_loop.mjs`) only runs the verifier and tracks state — it does not write code. That's the agent's job, every iteration, between script calls:

1. **Check current state** (skip on the very first iteration of a fresh run):
   ```bash
   node <skill-dir>/scripts/run_loop.mjs check LOOP_SPEC.md
   ```
   Read the JSON output's `status` field. Three possible values:
   - `"success"` → stop. Report success to the user with the iteration count. Done.
   - `"continue"` → an attempt was made and failed, but under cap and making progress. Proceed to step 2.
   - `"stop-escalate"` → stop immediately. Do not run the verifier again, do not make another edit "just to see." Report the `reason` field to the user verbatim, along with the iteration history (`node <skill-dir>/scripts/run_loop.mjs status LOOP_SPEC.md`), and wait for human input per the spec's Escalation section.

2. **If `continue` (or this is iteration 1): make a real change.** Read the spec's Goal and the last failure's `stderr` (included in the JSON). Make a genuine attempt to close the gap — actually edit files, don't just re-run the check hoping for a different result. This is the step the script cannot do for you.

3. **Loop back to step 1.** Re-run `check`. The script re-evaluates from the new state.

## Critical: don't fight the script's verdict

If `run_loop.mjs` reports `stop-escalate` for no-progress, that means the verifier output AND the working tree were identical to the previous attempt — i.e., either nothing was actually changed, or a change was made and then reverted to the same state. Do not:
- Re-run the check again manually outside the loop hoping it now reads differently — it won't, the inputs haven't changed.
- Argue that "this time it'll work" and bypass the script by running the verification command directly instead of through `run_loop.mjs check` — that's circumventing the cap, not satisfying it.

If you genuinely believe the no-progress detection is wrong (e.g. the change was real but doesn't show in git status because it touched a file outside the repo), say so to the user explicitly and let them decide whether to `reset` and continue — don't silently route around the script.

## Reporting

After every iteration, give the user a one-line status: iteration N/cap, pass/fail, what changed. Don't go silent for multiple iterations and then dump a wall of history — that's how a stuck loop goes unnoticed.

## On success

Report the final iteration count and what changed across the run. Don't immediately suggest more changes unless asked — the loop's job was to hit the stated goal, not to keep improving indefinitely.

## On escalation

Don't soften it. State plainly: cap reached / no-progress detected, here's the last error, here's what was tried, your call on next steps. Offer concrete next steps (raise the cap and retry, change the verification method, manually intervene) rather than just reporting failure and stopping.
