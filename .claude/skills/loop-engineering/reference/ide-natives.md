# IDE-native loop primitives

Use this once a spec passes `verify` — to decide whether to run the loop via this skill's `run` command, or hand off to the IDE's own native autonomous-loop mechanism, if it has one.

| Tool | Native loop primitive | Notes |
|---|---|---|
| **Codex CLI / IDE ext** | `/goal` (enable via `features.goals` in config.toml if not listed) | Paste this spec's Goal + Verification straight in. Codex treats goal text as both prompt and completion criteria, with its own progress UI (pause/resume/edit). If available, prefer it over this skill's `run` — it's native and has better UI for it. |
| **Claude Code** | No single built-in `/goal`. This skill's `run` command (backed by `<skill-dir>/scripts/run_loop.mjs`) is the recommended mechanism — it persists state across turns the way a bare conversation loop can't. | Keep `LOOP_SPEC.md` and `.loop/state.json` in the repo; reference the spec each turn rather than re-describing the goal. |
| **Cursor** | No first-class autonomous-until-done primitive as of mid-2026. Multi-task agent runs exist but aren't goal-gated. | Use `/loop` (the Cursor command in `integrations/cursor/`) to author/harden the spec; run iterations by re-invoking manually or scripting `run_loop.mjs` externally. |
| **Windsurf (Cascade)** | Workflows (`.windsurf/workflows/*.md`, `/workflow-name`) run once per invocation, not autonomously until a goal is met. | Chain workflow steps and use this spec's Verification command as the explicit gate between them. |
| **Antigravity** | Skill-triggered, single-shot per invocation like Windsurf, as of mid-2026. | Same approach — the spec governs each invocation; verify current docs before assuming an autonomous mode exists. |
| **Generic / scripted (any CLI agent)** | Plain wrapper: call the agent CLI non-interactively, then `run_loop.mjs check`, branch on `status`, repeat. | Most portable. Works with any CLI-capable agent regardless of native support. |

This table reflects mid-2026 product behavior and changes fast. If a native `/goal`-style mode exists and works well, prefer it — this skill's job is producing the spec either way, not insisting on its own runner.
