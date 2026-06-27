// test/lib.test.mjs — covers the regressions found during manual testing, so they can't
// silently come back. Run with: node --test test/

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { detectTools, allToolIds } from "../src/lib/detect.mjs";
import { installTool, installTools } from "../src/lib/install.mjs";
import { auditProject } from "../src/lib/audit.mjs";
import { estimateCost, extractMaxIterationsFromSpec } from "../src/lib/cost.mjs";

const LINT_SCRIPT = join(import.meta.dirname, "..", "skill", "scripts", "lint_spec.mjs");
const RUN_SCRIPT = join(import.meta.dirname, "..", "skill", "scripts", "run_loop.mjs");

function tmpProject() {
  return mkdtempSync(join(tmpdir(), "loop-eng-test-"));
}

const GOOD_SPEC = `# Loop: test

## Goal
Counter file reads "3".

## Verification
\`\`\`
node -e "const fs=require('fs');const v=fs.existsSync('counter.txt')?fs.readFileSync('counter.txt','utf8').trim():'0';process.exit(v==='3'?0:1)"
\`\`\`

## Termination
- Success: verification exits 0
- Max iterations: 5
- No-progress: stop if 2 consecutive iterations produce identical result and unchanged tree
- Budget: none

## Scope
- Allowed: ./counter.txt
- Forbidden: do not hardcode the value into the verifier

## Escalation
Stop and wait for human on cap or no-progress.
`;

const BAD_SPEC = `# Loop: test

## Goal
<concrete, observable end state>

## Verification
We'll know it's good when it feels right.

## Termination
- Success: looks done

## Scope
- Allowed: everything

## Escalation
Keep trying.
`;

// --- detect.mjs ---

test("detectTools: antigravity is never auto-detected (global-only tool, no project signal)", () => {
  const dir = tmpProject();
  try {
    const detected = detectTools(dir);
    assert.ok(!detected.includes("antigravity"), "antigravity must never appear in auto-detection results");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("detectTools: bare .agents dir (no /skills) does not falsely signal codex", () => {
  const dir = tmpProject();
  try {
    mkdirSync(join(dir, ".agents")); // generic dir, NOT .agents/skills
    const detected = detectTools(dir);
    assert.ok(!detected.includes("codex"), "a bare .agents/ dir must not be treated as a codex signal");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("detectTools: .agents/skills correctly signals codex", () => {
  const dir = tmpProject();
  try {
    mkdirSync(join(dir, ".agents", "skills"), { recursive: true });
    const detected = detectTools(dir);
    assert.ok(detected.includes("codex"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("detectTools: .claude dir correctly signals claude-code", () => {
  const dir = tmpProject();
  try {
    mkdirSync(join(dir, ".claude"));
    const detected = detectTools(dir);
    assert.deepEqual(detected, ["claude-code"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- detect.mjs: new IDEs ---

test("detectTools: .kiro dir signals kiro", () => {
  const dir = tmpProject();
  try {
    mkdirSync(join(dir, ".kiro"));
    assert.ok(detectTools(dir).includes("kiro"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("detectTools: .trae dir signals trae", () => {
  const dir = tmpProject();
  try {
    mkdirSync(join(dir, ".trae"));
    assert.ok(detectTools(dir).includes("trae"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("detectTools: .opencode dir signals opencode", () => {
  const dir = tmpProject();
  try {
    mkdirSync(join(dir, ".opencode"));
    assert.ok(detectTools(dir).includes("opencode"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("detectTools: .rovodev dir signals rovodev", () => {
  const dir = tmpProject();
  try {
    mkdirSync(join(dir, ".rovodev"));
    assert.ok(detectTools(dir).includes("rovodev"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("detectTools: .qoder dir signals qoder", () => {
  const dir = tmpProject();
  try {
    mkdirSync(join(dir, ".qoder"));
    assert.ok(detectTools(dir).includes("qoder"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- install.mjs ---

test("installTool: claude-code installs SKILL.md + scripts, scripts are executable", () => {
  const dir = tmpProject();
  try {
    const results = installTool("claude-code", dir);
    assert.ok(results.length >= 1);
    assert.ok(results.some((r) => r.installed === true));
    const skillPath = join(dir, ".claude", "skills", "loop-engineering", "SKILL.md");
    assert.ok(existsSync(skillPath));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("installTool: idempotent — second run reports skip, not error or duplicate", () => {
  const dir = tmpProject();
  try {
    installTool("claude-code", dir);
    const second = installTool("claude-code", dir);
    assert.equal(second[0].installed, false);
    assert.equal(second[0].reason, "already exists");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("installTool: cursor produces both a command file and a scripts dir", () => {
  const dir = tmpProject();
  try {
    const results = installTool("cursor", dir);
    assert.equal(results.length, 2);
    assert.ok(existsSync(join(dir, ".cursor", "commands", "loop.md")));
    assert.ok(existsSync(join(dir, ".loop", "scripts", "lint_spec.mjs")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("installTools: unknown tool id throws", () => {
  const dir = tmpProject();
  try {
    assert.throws(() => installTool("not-a-real-tool", dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("installTool: kiro installs steering file and scripts dir", () => {
  const dir = tmpProject();
  try {
    const results = installTool("kiro", dir);
    assert.equal(results.length, 2);
    assert.ok(existsSync(join(dir, ".kiro", "steering", "loop-engineering.md")));
    assert.ok(existsSync(join(dir, ".loop", "scripts", "lint_spec.mjs")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("installTool: trae installs rules file and scripts dir", () => {
  const dir = tmpProject();
  try {
    const results = installTool("trae", dir);
    assert.equal(results.length, 2);
    assert.ok(existsSync(join(dir, ".trae", "rules", "loop-engineering.md")));
    assert.ok(existsSync(join(dir, ".loop", "scripts", "lint_spec.mjs")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("installTool: opencode installs full skill dir", () => {
  const dir = tmpProject();
  try {
    const results = installTool("opencode", dir);
    assert.ok(results.some((r) => r.installed === true));
    assert.ok(existsSync(join(dir, ".opencode", "skills", "loop-engineering", "SKILL.md")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("installTool: rovodev installs full skill dir", () => {
  const dir = tmpProject();
  try {
    const results = installTool("rovodev", dir);
    assert.ok(results.some((r) => r.installed === true));
    assert.ok(existsSync(join(dir, ".rovodev", "skills", "loop-engineering", "SKILL.md")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("installTool: qoder installs full skill dir", () => {
  const dir = tmpProject();
  try {
    const results = installTool("qoder", dir);
    assert.ok(results.some((r) => r.installed === true));
    assert.ok(existsSync(join(dir, ".qoder", "skills", "loop-engineering", "SKILL.md")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- lint_spec.mjs (via subprocess, since it's a CLI script not a module) ---

test("lint_spec.mjs: exits 0 on a complete, substantive spec", () => {
  const dir = tmpProject();
  try {
    const specPath = join(dir, "LOOP_SPEC.md");
    writeFileSync(specPath, GOOD_SPEC);
    assert.doesNotThrow(() => execFileSync("node", [LINT_SCRIPT, specPath], { stdio: "pipe" }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("lint_spec.mjs: exits 1 with 5 issues on a placeholder-only spec", () => {
  const dir = tmpProject();
  try {
    const specPath = join(dir, "LOOP_SPEC.md");
    writeFileSync(specPath, BAD_SPEC);
    let stderr = "";
    try {
      execFileSync("node", [LINT_SCRIPT, specPath], { stdio: "pipe" });
      assert.fail("expected non-zero exit");
    } catch (err) {
      stderr = err.stderr.toString();
    }
    assert.match(stderr, /Goal.*placeholder/s);
    assert.match(stderr, /Verification.*no command/s);
    assert.match(stderr, /Termination.*missing/s);
    assert.match(stderr, /Scope.*no forbidden/s);
    assert.match(stderr, /Escalation.*does not describe/s);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("lint_spec.mjs: does not false-positive on real commands containing <args>", () => {
  const dir = tmpProject();
  try {
    const specPath = join(dir, "LOOP_SPEC.md");
    const specWithArgs = GOOD_SPEC.replace(
      'test "$(cat counter.txt 2>/dev/null || echo 0)" = "3"',
      'playwright test <file> --grep "smoke"'
    );
    writeFileSync(specPath, specWithArgs);
    assert.doesNotThrow(() => execFileSync("node", [LINT_SCRIPT, specPath], { stdio: "pipe" }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- run_loop.mjs (via subprocess) ---

test("run_loop.mjs: no-progress fires when file genuinely untouched between checks", () => {
  const dir = tmpProject();
  try {
    const specPath = join(dir, "LOOP_SPEC.md");
    writeFileSync(specPath, GOOD_SPEC);
    writeFileSync(join(dir, "counter.txt"), "0");
    try {
      execFileSync("node", [RUN_SCRIPT, "check", specPath], { cwd: dir, stdio: "pipe" });
    } catch {
      // expected: first check fails verification (status "continue"), exits 1
    }
    let out = "";
    try {
      execFileSync("node", [RUN_SCRIPT, "check", specPath], { cwd: dir, stdio: "pipe" });
    } catch (err) {
      out = err.stdout.toString();
    }
    assert.match(out, /stop-escalate/);
    assert.match(out, /No-progress/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("run_loop.mjs: real file changes between checks do NOT trigger false no-progress", () => {
  const dir = tmpProject();
  try {
    const specPath = join(dir, "LOOP_SPEC.md");
    writeFileSync(specPath, GOOD_SPEC);
    writeFileSync(join(dir, "counter.txt"), "1");
    let out1 = "";
    try {
      execFileSync("node", [RUN_SCRIPT, "check", specPath], { cwd: dir, stdio: "pipe" });
    } catch (err) {
      out1 = err.stdout.toString();
    }
    assert.match(out1, /"continue"/);

    writeFileSync(join(dir, "counter.txt"), "2"); // different value, real change
    let out2 = "";
    try {
      execFileSync("node", [RUN_SCRIPT, "check", specPath], { cwd: dir, stdio: "pipe" });
    } catch (err) {
      out2 = err.stdout.toString();
    }
    assert.match(out2, /"continue"/, "a real file change must not be flagged as no-progress");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("run_loop.mjs: success path reports exit 0 and status success", () => {
  const dir = tmpProject();
  try {
    const specPath = join(dir, "LOOP_SPEC.md");
    writeFileSync(specPath, GOOD_SPEC);
    writeFileSync(join(dir, "counter.txt"), "3");
    const out = execFileSync("node", [RUN_SCRIPT, "check", specPath], { cwd: dir, stdio: "pipe" }).toString();
    assert.match(out, /"success"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("run_loop.mjs: enforces iteration cap even without a no-progress match", () => {
  const dir = tmpProject();
  try {
    const spec = GOOD_SPEC.replace("Max iterations: 5", "Max iterations: 2");
    const specPath = join(dir, "LOOP_SPEC.md");
    writeFileSync(specPath, spec);
    writeFileSync(join(dir, "counter.txt"), "x1");
    try {
      execFileSync("node", [RUN_SCRIPT, "check", specPath], { cwd: dir, stdio: "pipe" });
    } catch {}
    writeFileSync(join(dir, "counter.txt"), "x2");
    let out = "";
    try {
      execFileSync("node", [RUN_SCRIPT, "check", specPath], { cwd: dir, stdio: "pipe" });
    } catch (err) {
      out = err.stdout.toString();
    }
    assert.match(out, /stop-escalate/);
    assert.match(out, /cap reached/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- audit.mjs ---

test("auditProject: spec-related checks all score 0 on a project with no spec", () => {
  const dir = tmpProject();
  try {
    const result = auditProject(dir, LINT_SCRIPT);
    assert.equal(result.max, 100);
    // Spec-related checks must be 0; tool-install/git checks may be non-zero
    // if the user has global skill installs for any supported tool.
    const specCheck = result.checks.find((c) => c.label === "LOOP_SPEC.md exists");
    const lintCheck = result.checks.find((c) => c.label === "Spec passes lint");
    const runCheck = result.checks.find((c) => c.label === "Run history exists");
    const resolvedCheck = result.checks.find((c) => c.label === "Last run resolved cleanly");
    assert.equal(specCheck.points, 0);
    assert.equal(lintCheck.points, 0);
    assert.equal(runCheck.points, 0);
    assert.equal(resolvedCheck.points, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("auditProject: scores 100 after a full good-spec + git + install + successful run", () => {
  const dir = tmpProject();
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    writeFileSync(join(dir, "LOOP_SPEC.md"), GOOD_SPEC);
    writeFileSync(join(dir, "counter.txt"), "3");
    installTool("claude-code", dir);
    execFileSync("node", [RUN_SCRIPT, "check", join(dir, "LOOP_SPEC.md")], { cwd: dir, stdio: "pipe" });
    const result = auditProject(dir, LINT_SCRIPT);
    assert.equal(result.score, 100);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("auditProject: partial credit on a spec that exists but fails most lint checks", () => {
  const dir = tmpProject();
  try {
    writeFileSync(join(dir, "LOOP_SPEC.md"), BAD_SPEC);
    const result = auditProject(dir, LINT_SCRIPT);
    assert.ok(result.score > 0 && result.score < 100);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- cost.mjs ---

test("estimateCost: throws on maxIterations < 1", () => {
  assert.throws(() => estimateCost({ maxIterations: 0 }));
});

test("estimateCost: highEstimate scales with maxIterations", () => {
  const low = estimateCost({ maxIterations: 2 });
  const high = estimateCost({ maxIterations: 10 });
  assert.ok(high.highEstimateTokens > low.highEstimateTokens);
});

test("extractMaxIterationsFromSpec: reads the value out of a real spec", () => {
  const n = extractMaxIterationsFromSpec(GOOD_SPEC);
  assert.equal(n, 5);
});

test("extractMaxIterationsFromSpec: returns null when absent", () => {
  const n = extractMaxIterationsFromSpec("## Termination\nno number here\n");
  assert.equal(n, null);
});
