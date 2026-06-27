# `status` — report iteration history, read-only

Triggered by: `/loop status [path]`, "how's the loop going," "what happened last run."

## Flow

```bash
node <skill-dir>/scripts/run_loop.mjs status <path, default LOOP_SPEC.md>
```

Report:
- `"no-history"` → no run has happened yet for this spec. Suggest `run` if they want to start one.
- Otherwise → completed iterations vs max, and a short read of the history: did it trend toward passing, or stall? Look at consecutive hashes in `history` — if the last two `hash` values match, the loop is (or was) one `check` away from no-progress escalation.

This command never executes the verifier or modifies state — it only reads `.loop/state.json`. If the user wants to clear history and start fresh, that's `node <skill-dir>/scripts/run_loop.mjs reset <path>`, not part of `status` — confirm with them before running `reset`, since it discards the record of what was already tried.
