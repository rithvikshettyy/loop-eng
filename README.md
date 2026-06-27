# loop-eng

Turn a goal description into a loop-ready spec, install it into your AI coding tool, then verify, run, audit, and cost-estimate the loop — all from one CLI.

```bash
npx loop-eng install
```

No goal description converts cleanly into something an autonomous agent loop can terminate correctly on its own. "Make it look good" has no pass/fail check; a loop built on it either declares false victory or never stops. This package gives your agent a skill that refuses to start looping until the goal has five real things: a concrete end state, a verification command, termination conditions (success + cap + no-progress exit), scope, and an escalation path — then gives you a small CLI to check, run, score, and estimate that loop mechanically, without trusting the agent's own promise to behave.

## Install the skill into your tool

```bash
npx loop-eng install                   # auto-detects what's in your project, installs there
npx loop-eng install --tool all        # installs for every supported tool
npx loop-eng install --tool claude-code  # installs for one specific tool
```

Supported tools:

| Tool | Install path | Detection signal |
|---|---|---|
| Claude Code | `.claude/skills/loop-engineering/` + `~/.claude/skills/loop-engineering/` | `.claude/` exists |
| Codex | `.agents/skills/loop-engineering/` + `~/.codex/skills/loop-engineering/` | `.agents/skills/` exists |
| Windsurf | `.windsurf/skills/loop-engineering/` | `.windsurf/` exists |
| Cursor | `.cursor/commands/loop.md` + `.loop/scripts/` | `.cursor/` exists |
| Kiro | `.kiro/steering/loop-engineering.md` + `.loop/scripts/` | `.kiro/` exists |
| Trae | `.trae/rules/loop-engineering.md` + `.loop/scripts/` | `.trae/` exists |
| OpenCode | `.opencode/skills/loop-engineering/` + `~/.config/opencode/skills/loop-engineering/` | `.opencode/` exists |
| Rovodev | `.rovodev/skills/loop-engineering/` + `~/.rovodev/skills/loop-engineering/` | `.rovodev/` exists |
| Qoder | `.qoder/skills/loop-engineering/` + `~/.qoder/skills/loop-engineering/` | `.qoder/` exists |
| Antigravity | `~/.gemini/antigravity/skills/loop/` (global only) | `--tool antigravity` |

Auto-detection is presence-based — if the tool's config directory exists in your project, it's detected. Antigravity is global-only so it's never auto-detected; use `--tool antigravity` or `--tool all` explicitly.

Claude Code installs to both project-local and global (`~/.claude/`) so the desktop app loads the skill in any project without a per-project install.

## Skill commands (inside your agent)

Once installed, invoke with `/loop` inside Claude Code, Cursor, Kiro, Antigravity, etc.:

| Command | What it does |
|---|---|
| `/loop init` | One-time setup — captures test command, build command, forbidden paths into `LOOP_CONTEXT.md` so future specs don't re-ask |
| `/loop new <goal>` | Interviews you, converts a vague goal into a complete `LOOP_SPEC.md` with all 5 required sections |
| `/loop harden` | Runs the linter on an existing spec, fixes exactly what it flags |
| `/loop verify` | Checks if `LOOP_SPEC.md` is loop-ready — exits 0 or lists what's broken |
| `/loop run` | Executes the loop: runs the verification command, tracks iterations, enforces the cap, reports `success` / `continue` / `stop-escalate` |
| `/loop status` | Reads iteration history without running anything |

Start with `/loop init` on a new project, then `/loop new <your goal>`.

## CLI commands

```bash
npx loop-eng verify [path]    # checks LOOP_SPEC.md has all 5 required sections, non-placeholder
npx loop-eng run [path]       # runs one verification pass, tracks iteration + no-progress state
npx loop-eng status [path]    # reads iteration history, no execution
npx loop-eng audit            # scores a project's loop-readiness 0-100
npx loop-eng cost [path]      # rough token cost estimate before committing to a run
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
