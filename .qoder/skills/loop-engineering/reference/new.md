# `new` — author a fresh loop spec

Triggered by: `/loop new <goal description>`, or any goal description with no existing `LOOP_SPEC.md` in the working directory.

## Flow

1. **Read what's given.** If the user's goal description already implies an answer for one of the 5 components, don't ask about it again — extract it.

2. **Interview for the 2 components that are usually actually missing** — Goal precision and Verification. Don't interrogate all 5 one by one; most users can state scope/escalation defaults fine once asked once, but goal vagueness and verification are where real gaps live.

   - If the goal is a vague adjective ("better," "cleaner," "more polished," "looks good"): ask what observable, checkable thing would prove it's done. Push past the first vague answer if needed — "looks good" → "what would make it look good?" → "consistent spacing" → "is there a lint rule or visual diff that catches inconsistent spacing, or do we need a human eyeball each time?"
   - If no verification method is stated: ask what command (test, build, lint, type-check) would return pass/fail. If genuinely nothing mechanical exists, say so and propose an LLM-judge rubric explicitly, flagged as the weakest link — never silently assume one exists.

3. **Default the other 3 unless the user has opinions:**
   - Termination: max iterations default 8–10 for a build task, lower (3–5) for anything touching production data or external services. No-progress default: 2 consecutive identical results. State these defaults explicitly so the user can override, don't just silently pick them.
   - Scope: ask "anything definitely off-limits?" if not stated — at minimum forbid editing test files to force a pass.
   - Escalation: default to "stop, summarize attempts, wait for human" unless the user wants something else (e.g. auto-revert on cap).

4. **Write `LOOP_SPEC.md`** in the working directory using this exact shape:

```markdown
# Loop: <short name>

## Goal
<concrete, observable end state — not an adjective>

## Verification
```
<exact command, e.g. npm run test && npm run build>
```
(or, if no deterministic check exists: state the LLM-judge rubric explicitly here, and say so)

## Termination
- Success: verification exits 0
- Max iterations: <N>
- No-progress: stop if 2 consecutive iterations produce identical result + unchanged working tree
- Budget: <optional>

## Scope
- Allowed: <paths/stack>
- Forbidden: <at least one explicit thing>

## Escalation
On cap or no-progress: stop, summarize attempts + last error, wait for human review.
```

5. **Run the linter immediately after writing the file.** Do not skip this because you just wrote it carefully:

```bash
node <skill-dir>/scripts/lint_spec.mjs LOOP_SPEC.md
```

If it fails, fix exactly what it reports and re-run — do not guess at what else might be wrong.

6. Once it passes, tell the user the spec is ready and ask whether they want to `run` it now, hand it to their IDE's native loop primitive (see `reference/ide-natives.md`), or just keep the spec for later.
