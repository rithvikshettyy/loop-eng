# loop-engineering

npm package. Turns a goal description into a loop-ready spec, installs it into
AI coding tools, verifies/runs/audits/cost-estimates loops.

## Project layout

```
bin/loop-engineering.mjs     CLI entry point (hand-rolled arg parsing)
src/lib/detect.mjs           Tool detection (presence-based, not capability)
src/lib/install.mjs          Skill installer per tool
src/lib/audit.mjs            Loop-readiness scorer 0-100
src/lib/cost.mjs             Token cost estimator
skill/                       Canonical skill payload (source of truth)
  SKILL.md                   Main skill file loaded by AI coding tools
  scripts/lint_spec.mjs      Hard gate: validates LOOP_SPEC.md
  scripts/run_loop.mjs       Loop executor: enforces caps, tracks state
  reference/                 Sub-documents loaded by SKILL.md per command
patterns/cursor-loop.md      Cursor command wrapper (Cursor has no skills mechanism)
scripts/build.mjs            Generates per-IDE pre-built dirs from skill/ for GitHub browsability
test/lib.test.mjs            Node test runner suite
```

## Conventions
- Plain Node.js, no runtime dependencies (deliberate — "minimal, mechanical, no magic" is the pitch)
- ESM modules (`.mjs` everywhere)
- Hand-rolled arg parsing in `bin/`, no commander/yargs
- Tests in `test/`, run with `npm test`

## Commands
- **Test**: `npm test`
- **Build per-IDE dirs**: `node scripts/build.mjs`
- **Pack check**: `npm pack --dry-run`
- **Local install**: `npm install -g ./loop-engineering-*.tgz`

## Tool IDs (src/lib/detect.mjs)
claude-code, codex, windsurf, antigravity, cursor, kiro, trae, opencode, rovodev, qoder

## IDE skill path conventions (researched)
| Tool | Project-local path | Global path |
|---|---|---|
| Claude Code | `.claude/skills/loop-engineering/` | — |
| Codex | `.agents/skills/loop-engineering/` | `~/.codex/skills/loop-engineering/` |
| Windsurf | `.windsurf/skills/loop-engineering/` | — |
| Antigravity | — (global only) | `~/.gemini/antigravity/skills/loop-engineering/` |
| Cursor | `.cursor/commands/loop.md` + `.loop/scripts/` | — |
| Kiro | `.kiro/steering/loop-engineering.md` + `.loop/scripts/` | — |
| Trae | `.trae/rules/loop-engineering.md` + `.loop/scripts/` | — |
| OpenCode | `.opencode/skills/loop-engineering/` | `~/.config/opencode/skills/loop-engineering/` |
| Rovodev | `.rovodev/skills/loop-engineering/` | `~/.rovodev/skills/loop-engineering/` |
| Qoder | `.qoder/skills/loop-engineering/` | `~/.qoder/skills/loop-engineering/` |

## Don't
- Add runtime dependencies without strong justification
- Use `sudo` for global installs
- Break the test suite; if a structural change requires changing tests, change them deliberately
- Add comments explaining WHAT code does (name things well instead)
- Break Windows compatibility — tests must pass on Windows (use Node.js fs APIs, not bash, for cross-platform file operations in scripts)
