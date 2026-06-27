# `harden` — fix an existing weak spec

Triggered by: `/loop harden [path]`, or "this spec isn't good enough" / "fix my loop spec" / intent that clearly means improving an existing spec rather than writing one.

## Flow

1. **Run the linter first, always.** Do not read the spec and guess what's wrong — run it:

```bash
node <skill-dir>/scripts/lint_spec.mjs LOOP_SPEC.md
```

(or whatever path the user gave). This produces a specific, itemized list of what's missing or weak. That list is your TODO list — not your own read of the document.

2. **Fix exactly what's flagged, in the order reported.** Common fixes:
   - Missing section header → add it with real content, not a placeholder.
   - Placeholder text still present (`<...>`, `TBD`, `...`) → replace with the actual concrete answer; ask the user if you don't know it.
   - Verification has no command and doesn't flag LLM-judge → either find the actual test/build/lint command for this project (check `package.json` scripts, a Makefile, CI config) or explicitly write the LLM-judge rubric and flag it as the weakest link.
   - Termination missing success/cap/no-progress → add whichever is missing; don't just add a stub, make it match the actual goal (e.g. cap of 3 for a destructive task, not the generic default of 8).
   - Scope has no forbidden action → ask the user for at least one real boundary; don't invent a generic one if you can ask.
   - Escalation doesn't describe a stop behavior → default to "stop, summarize, wait for human" unless told otherwise.

3. **Re-run the linter after every fix pass.** Don't fix all 5 issues blind and assume it's clean — re-run:

```bash
node <skill-dir>/scripts/lint_spec.mjs LOOP_SPEC.md
```

Iterate until it exits 0. Report the before/after issue list to the user so they can see what changed.

4. If the user provided a goal description instead of a path (no existing file), this is actually a `new` request — load `reference/new.md` instead.
