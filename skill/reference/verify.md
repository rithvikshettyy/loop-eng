# `verify` — lint-only check, no execution

Triggered by: `/loop verify [path]`, "is this spec ready?", "check my loop spec."

## Flow

1. Run:

```bash
node <skill-dir>/scripts/lint_spec.mjs <path, default LOOP_SPEC.md>
```

2. Report the result verbatim-ish to the user:
   - **Exit 0**: spec is loop-ready. Tell the user plainly, and ask if they want to `run` it now.
   - **Exit 1**: relay the itemized issue list exactly as the script reported it — don't summarize it into something vaguer. If the user wants it fixed now, switch to `reference/harden.md`; if they just wanted the check, stop here.

## What this command does NOT do

- Does not execute the verification command from the spec (that's `run`).
- Does not modify the spec file (that's `harden`).
- Does not touch `.loop/state.json`.

This is a read-only check. If the user wanted execution, they'll say so — don't assume `verify` implies `run`.
