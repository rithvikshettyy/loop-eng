# loop-engineering

Turn a goal description into a loop-ready spec, install it into your AI coding tool, then verify, run, audit, and cost-estimate the loop — all from one CLI.

```bash
npx loop-engineering install
```

No goal description converts cleanly into something an autonomous agent loop can terminate correctly on its own. "Make it look good" has no pass/fail check; a loop built on it either declares false victory or never stops. This package gives your agent a skill that refuses to start looping until the goal has five real things: a concrete end state, a verification command, termination conditions (success + cap + no-progress exit), scope, and an escalation path — then gives you a small CLI to check, run, score, and estimate that loop mechanically, without trusting the agent's own promise to behave.

## Install the skill into your tool

```bash
npx loop-engineering install                  # auto-detects what's in your project, installs there
npx loop-engineering install --tool all        # installs for every supported tool
npx loop-engineering install --tool cursor      # installs for one specific tool
```

Supported: `claude-code`, `codex`, `windsurf`, `antigravity`, `cursor`.

Once installed, ask your agent (inside Claude Code, Codex, Windsurf, etc.) to build a loop spec for your goal — it loads the skill and interviews you for whatever's missing. Authoring the spec (`new`/`harden`) happens inside the agent conversation, not on this CLI; the CLI handles everything mechanical around it.

## CLI commands

```bash
npx loop-engineering verify [path]    # checks LOOP_SPEC.md has all 5 required sections, non-placeholder
npx loop-engineering run [path]       # runs one verification pass, tracks iteration + no-progress state
npx loop-engineering status [path]    # reads iteration history, no execution
npx loop-engineering audit            # scores a project's loop-readiness 0-100
npx loop-engineering cost [path]      # rough token cost estimate before committing to a run
```

### `verify`

Exits 0 if `LOOP_SPEC.md` has a real Goal, a runnable Verification command (or an explicitly-flagged LLM-judge fallback), all three Termination conditions (success / max-iterations / no-progress), a Scope with at least one forbidden action, and an Escalation behavior. Exits 1 with an itemized list otherwise — no partial credit for "looks complete."

### `run`

Runs the spec's verification command once, hashes both its output and the working tree (so two failures that print an identical generic error but came from genuinely different code states aren't wrongly flagged as stuck), and reports `success`, `continue`, or `stop-escalate`. State persists to `.loop/state.json` so the iteration count survives across turns — the calling agent can't lose count or talk itself past the cap.

### `audit`

```
Loop Readiness Score: 70/100

  ✓ LOOP_SPEC.md exists: 20/20
  ✓ Spec passes lint: 30/30 — PASS
  ✗ Run history exists: 0/15 — no .loop/state.json
  ✗ Last run resolved cleanly: 0/15 — no run history
  ✓ Skill installed for at least one tool: 10/10 — claude-code
  ✓ Project is a git repo: 10/10 — git detected — reliable no-progress signal
```

Add `--badge` to print a shields.io badge for your README.

### `cost`

```
Estimated token cost for up to 6 iterations:
  Best case (succeeds iteration 1):  ~4,200 tokens
  Worst case (runs full cap):         ~17,700 tokens
  Per-iteration:                      ~2,700 tokens
```

A rough range, not a prediction — override the dominant term with `--edit-tokens N` if you have a sense of how big the actual code changes will be. The point is catching "this will burn through a plan before lunch" before it happens, not billing precisely.

## The spec format

```markdown
# Loop: <name>

## Goal
<concrete, observable end state — not an adjective>

## Verification
```
<exact command that returns pass/fail>
```

## Termination
- Success: verification exits 0
- Max iterations: <N>
- No-progress: stop if 2 consecutive iterations produce identical result + unchanged tree
- Budget: <optional>

## Scope
- Allowed: <paths/stack>
- Forbidden: <at least one explicit thing>

## Escalation
On cap or no-progress: stop, summarize attempts, wait for human review.
```

## Why a script, not just instructions

Most loop-engineering failures are goal-description failures, not model failures. `skill/scripts/lint_spec.mjs` is the actual gate — it parses the file and checks each section against specific criteria (not "does this look done"). `skill/scripts/run_loop.mjs` is the actual executor — it enforces the cap and no-progress exit itself rather than asking the agent to count correctly. Both are plain Node scripts with no dependencies, auditable in under 200 lines each.

## License

MIT
