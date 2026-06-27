---
name: loop-engineering
description: Turn a goal description into a loop spec an AI agent can iterate against autonomously, then optionally run that loop with enforced caps. Use when the user invokes /loop or any sub-command (new, harden, verify, run, status), asks to "build until done" or "iterate until X passes," describes a goal they want an agent to work toward without manual re-prompting each turn, or asks for a spec/PRD meant to drive an autonomous coding agent (Claude Code, Codex, Cursor, Windsurf, Antigravity). Also trigger when a goal description is vague, untestable, or missing a stop condition — hardening weak goal descriptions into loop-ready specs is this skill's primary job, and it refuses to hand a vague goal to an agent loop without fixing it first.
version: 1.1.0
user-invocable: true
argument-hint: "[new|harden|verify|run|status] [goal description or path to LOOP_SPEC.md]"
license: MIT
---

# Loop Engineering

Converts a goal description into a **loop spec**: Goal, Verification, Termination, Scope, Escalation. Then, optionally, runs the loop — act, verify, decide continue/stop — with caps enforced by a script, not by the agent's own promise to behave.

## Why this exists

Old model: human types a prompt, agent responds, human reads and re-prompts. Human is the loop.

Loop engineering: human writes the goal once; a system prompts the agent, checks the result, and decides whether to continue — without the human in the cycle. The loop's quality is bottlenecked entirely on the goal description. A vague goal makes a loop that either declares false victory or never stops.

**Most "loop engineering" failures are goal-description failures, not model failures.** This skill's job is to catch that before iteration 1, and to make the cap/no-progress/escalation logic mechanical rather than a promise the agent makes to itself.

## Setup (run before any sub-command)

1. **Resolve the scripts directory once per session.** The two scripts this skill depends on (`lint_spec.mjs`, `run_loop.mjs`) live alongside this SKILL.md, but their absolute path depends on which tool installed them. Check, in order, and use the first that exists: `.claude/skills/loop-engineering/scripts/`, `.agents/skills/loop-engineering/scripts/`, `.windsurf/skills/loop-engineering/scripts/`, `.loop/scripts/` (Cursor installs here), `~/.codex/skills/loop-engineering/scripts/`, `~/.gemini/antigravity/skills/loop-engineering/scripts/`. Every reference file in this skill writes commands as `node <skill-dir>/scripts/lint_spec.mjs` — substitute the real resolved path for `<skill-dir>/scripts/`, don't run `node scripts/...` relative to an assumed cwd.
2. Check whether `LOOP_SPEC.md` (or a user-specified spec path) exists in the working directory.
3. If a sub-command was given (`new`, `harden`, `verify`, `run`, `status`), read `reference/<command>.md` next — non-optional, it defines that command's exact flow.
4. Never skip the linter. The lint script is the actual gate, not a suggestion — see "The hard rule" below.

## The hard rule

**A spec is never "loop-ready" because the agent says so. It is loop-ready when `node <skill-dir>/scripts/lint_spec.mjs <path>` exits 0.** Do not eyeball a spec and decide it looks fine. Do not skip the lint step because the spec "seems complete." Run the script, read its actual output, fix exactly what it flags. This is the difference between a skill that's foolproof and one that's just well-written prose — prose can be rationalized past; a non-zero exit code cannot.

Same for running a loop: **iteration counts, the no-progress check, and the cap are tracked by `<skill-dir>/scripts/run_loop.mjs`, not by the agent counting in its head.** The script persists state to `.loop/state.json` specifically so a model can't lose count, restart the count by accident, or talk itself into "just one more try" past the cap.

## Commands

| Command | Category | Description | Reference |
|---|---|---|---|
| `new [goal]` | Build | Interview the user, author a fresh `LOOP_SPEC.md` from a goal description | [reference/new.md](reference/new.md) |
| `harden [path]` | Build | Take an existing weak/incomplete spec and fix exactly what the linter flags | [reference/harden.md](reference/harden.md) |
| `verify [path]` | Evaluate | Run the lint check only — confirm a spec is loop-ready without executing anything | [reference/verify.md](reference/verify.md) |
| `run [path]` | Iterate | Actually execute the loop: verify, report, decide continue/stop/escalate, repeat | [reference/run.md](reference/run.md) |
| `status [path]` | Evaluate | Read `.loop/state.json` and report iteration history without running anything | [reference/status.md](reference/status.md) |

### Routing rules

1. **No argument**: ask what goal they want to loop, or if a `LOOP_SPEC.md` already exists in the working directory, ask whether they want to `verify`, `run`, or `harden` it. Don't guess — a missing argument here means genuine ambiguity between "I have no spec yet" and "I have one, do something with it."
2. **First word matches a command** (table above): load its reference file, treat everything after the command name as its argument, follow the reference's flow exactly.
3. **First word doesn't match, but intent clearly maps to one command** (e.g. "is this spec actually ready?" → `verify`; "just start building and don't stop till tests pass" → `new` then `run`; "this spec sucks, fix it" → `harden`): load that reference and proceed as if invoked. If genuinely two could fit (e.g. they want both `new` and `run`), do `new` first, confirm the spec passes `verify`, then ask before `run`.
4. **A goal description with no command word, and no existing spec in the working directory**: treat as `new`.
5. **A goal description with no command word, and a spec already exists**: ask whether they mean to replace it (`new`) or check it (`verify`) — don't silently overwrite an existing spec.

## Absolute bans

Match-and-refuse. If you're about to do any of these, stop and do the alternative instead.

- **Never mark a spec loop-ready without running `lint_spec.mjs`.** Reading it and thinking "looks complete" is not verification. Run the script.
- **Never mark a loop iteration "success" without the verification command's actual exit code being 0.** Not "the code looks right," not "this should pass" — the literal exit code from `run_loop.mjs check`.
- **Never silently exceed the stated iteration cap.** If `run_loop.mjs` reports `stop-escalate`, stop. Do not run "just one more" manually outside the script to see if it would have worked — that defeats the entire point of a mechanical cap.
- **Never write a Scope section with no forbidden actions**, and never let a user's "just do whatever it takes" stand unchallenged — ask for at least one explicit boundary (untouched files, no force-push, no editing tests to force a pass).
- **Never propose LLM-as-judge as the verification method without saying out loud that it's the weakest link.** It's sometimes the only option; it must never be presented as equivalent to a deterministic check.
- **Never accept a goal phrased only as a vague adjective** ("better," "polished," "cleaner") without converting it to an observable end state during `new` or `harden`. That conversion is most of the actual work — see `reference/examples.md`.

## Reference files

- `reference/new.md` — interview flow for authoring a fresh spec
- `reference/harden.md` — fixing an existing spec against linter output
- `reference/verify.md` — running the lint check, reporting results
- `reference/run.md` — executing the loop end-to-end, including how to act between iterations
- `reference/status.md` — reading and reporting iteration history
- `reference/ide-natives.md` — which native loop primitive to hand off to per IDE (Codex's `/goal`, Windsurf Workflows, etc.)
- `reference/examples.md` — worked weak-goal → loop-ready-spec conversions

## Scripts

- `<skill-dir>/scripts/lint_spec.mjs` — the hard gate; validates a spec has all 5 sections, non-placeholder, with section-specific deep checks (verification has a real command or flags LLM-judge; termination has all three exits; scope names a forbidden action; escalation names a stop behavior)
- `<skill-dir>/scripts/run_loop.mjs check|reset|status` — executes one verification pass, tracks iteration + no-progress state via a composite hash of (verifier output) + (working tree changes), enforces the cap, never trusts the calling agent's own iteration count
