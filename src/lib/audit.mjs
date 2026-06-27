// audit.mjs — scores a project's loop-readiness 0-100 against this skill's spec format.
//
// Rubric (documented here, not just in code, so the score is explainable):
//   20 pts — LOOP_SPEC.md exists
//   30 pts — spec passes lint_spec.mjs (5 pts removed per category of issue: missing
//            section, placeholder content, weak verification, weak termination, weak
//            scope, weak escalation — capped at 0)
//   15 pts — at least one run has been recorded in .loop/state.json
//   15 pts — most recent run did not end in an unresolved stop-escalate
//            (i.e. either it succeeded, or a later run after it succeeded)
//   10 pts — skill is installed for at least one supported tool in this project
//   10 pts — project is a git repo (no-progress detection is more reliable with
//            real git-diff signal than the content-hash fallback)

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { TOOLS } from "./detect.mjs";

function scoreSpecExists(root) {
  const specPath = join(root, "LOOP_SPEC.md");
  return { points: existsSync(specPath) ? 20 : 0, max: 20, label: "LOOP_SPEC.md exists", specPath };
}

function scoreLint(root, lintModulePath) {
  const specPath = join(root, "LOOP_SPEC.md");
  if (!existsSync(specPath)) {
    return { points: 0, max: 30, label: "Spec passes lint", detail: "no spec to lint" };
  }
  try {
    execSync(`node "${lintModulePath}" "${specPath}"`, { stdio: "pipe" });
    return { points: 30, max: 30, label: "Spec passes lint", detail: "PASS" };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : "";
    const issueCount = (stderr.match(/^\s+-/gm) || []).length || 1;
    const deduction = Math.min(30, issueCount * 5);
    return {
      points: Math.max(0, 30 - deduction),
      max: 30,
      label: "Spec passes lint",
      detail: `${issueCount} issue(s) reported by linter`,
    };
  }
}

function scoreRunHistory(root) {
  const statePath = join(root, ".loop", "state.json");
  if (!existsSync(statePath)) {
    return { points: 0, max: 15, label: "Run history exists", detail: "no .loop/state.json" };
  }
  try {
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    const hasAnyRun = Object.values(state).some((entry) => entry.iterations && entry.iterations.length > 0);
    return {
      points: hasAnyRun ? 15 : 0,
      max: 15,
      label: "Run history exists",
      detail: hasAnyRun ? "at least one recorded run" : "state file present but empty",
    };
  } catch {
    return { points: 0, max: 15, label: "Run history exists", detail: "state.json unreadable" };
  }
}

function scoreResolvedRuns(root) {
  const statePath = join(root, ".loop", "state.json");
  if (!existsSync(statePath)) {
    return { points: 0, max: 15, label: "Last run resolved cleanly", detail: "no run history" };
  }
  try {
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    const entries = Object.values(state);
    if (entries.length === 0) {
      return { points: 0, max: 15, label: "Last run resolved cleanly", detail: "no run history" };
    }
    // "Resolved cleanly" here means: the most recent iteration recorded for any tracked
    // spec exited 0. We can't see an explicit "escalated" flag in state.json (run_loop.mjs
    // determines that at decision time, not storage time), so exitCode 0 on the latest
    // iteration is the best proxy available from stored state alone.
    const allResolved = entries.every((entry) => {
      const last = entry.iterations[entry.iterations.length - 1];
      return last && last.exitCode === 0;
    });
    return {
      points: allResolved ? 15 : 0,
      max: 15,
      label: "Last run resolved cleanly",
      detail: allResolved ? "most recent iteration succeeded" : "most recent iteration did not succeed",
    };
  } catch {
    return { points: 0, max: 15, label: "Last run resolved cleanly", detail: "state.json unreadable" };
  }
}

function scoreToolInstalled(root) {
  let anyInstalled = false;
  const found = [];
  for (const [id, tool] of Object.entries(TOOLS)) {
    const paths = tool.installPaths(root);
    for (const p of paths) {
      const checkPath = typeof p === "string" ? p : p.path;
      if (existsSync(checkPath)) {
        anyInstalled = true;
        found.push(id);
      }
    }
  }
  return {
    points: anyInstalled ? 10 : 0,
    max: 10,
    label: "Skill installed for at least one tool",
    detail: found.length > 0 ? found.join(", ") : "none found",
  };
}

function scoreGitRepo(root) {
  try {
    execSync("git rev-parse --is-inside-work-tree", { cwd: root, stdio: "pipe" });
    return { points: 10, max: 10, label: "Project is a git repo", detail: "git detected — reliable no-progress signal" };
  } catch {
    return { points: 0, max: 10, label: "Project is a git repo", detail: "no git — falls back to content-hash signal" };
  }
}

export function auditProject(root, lintModulePath) {
  const checks = [
    scoreSpecExists(root),
    scoreLint(root, lintModulePath),
    scoreRunHistory(root),
    scoreResolvedRuns(root),
    scoreToolInstalled(root),
    scoreGitRepo(root),
  ];
  const total = checks.reduce((sum, c) => sum + c.points, 0);
  const max = checks.reduce((sum, c) => sum + c.max, 0);
  return { score: total, max, checks };
}
