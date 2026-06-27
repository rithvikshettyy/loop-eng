#!/usr/bin/env node
// run_loop.mjs — runs one iteration of a loop spec's verification command, updates state,
// and reports whether the loop should continue, stop-success, or stop-escalate.
//
// This script enforces caps itself rather than trusting the calling agent to count correctly.
// It does NOT make code changes — that's the agent's job between iterations. This script's
// only responsibilities: run the verifier, hash the result, compare to history, decide status.
//
// Usage:
//   node run_loop.mjs check [path/to/LOOP_SPEC.md]   — run one verification pass, report status
//   node run_loop.mjs reset [path/to/LOOP_SPEC.md]   — clear iteration history for a fresh run
//   node run_loop.mjs status [path/to/LOOP_SPEC.md]  — print current state without running anything
//
// State file: .loop/state.json (relative to cwd), one entry per spec path.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const STATE_DIR = resolve(".loop");
const STATE_FILE = resolve(STATE_DIR, "state.json");

const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_NO_PROGRESS_LIMIT = 2; // consecutive identical results before stopping

function loadState() {
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveState(state) {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function extractVerificationCommand(specContent) {
  const re = /(?:^|\n)##\s+Verification\s*\n([\s\S]*?)(?=\n##\s+|$)/;
  const m = specContent.match(re);
  if (!m) return null;
  const fenceMatch = m[1].match(/```(?:[a-z]*\n)?([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const inlineMatch = m[1].match(/`([^`]+)`/);
  if (inlineMatch) return inlineMatch[1].trim();
  return null;
}

function extractMaxIterations(specContent) {
  const re = /(?:^|\n)##\s+Termination\s*\n([\s\S]*?)(?=\n##\s+|$)/;
  const m = specContent.match(re);
  if (!m) return DEFAULT_MAX_ITERATIONS;
  const numMatch = m[1].match(/max\s+iterations?\s*:?\s*(\d+)/i);
  return numMatch ? parseInt(numMatch[1], 10) : DEFAULT_MAX_ITERATIONS;
}

function hashResult(stdout, stderr, exitCode) {
  return createHash("sha256").update(`${exitCode}:${stdout}:${stderr}`).digest("hex").slice(0, 16);
}

function hashWorkingTree() {
  // Prefer git: a diff of tracked+untracked changes against HEAD. Falls back to a
  // mtime+size snapshot of the cwd if not in a git repo. This exists because many
  // verification commands (assert/test-style) print identical generic failure text
  // regardless of *why* they failed — without this, two genuinely different failed
  // attempts would hash identically and falsely trigger no-progress.
  try {
    const diff = execSync("git diff HEAD --stat 2>/dev/null && git status --porcelain 2>/dev/null", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (diff && diff.trim().length > 0) {
      return createHash("sha256").update(diff).digest("hex").slice(0, 16);
    }
    // Empty diff in a real git repo is meaningful (truly unchanged) — keep it, don't fall through.
    return createHash("sha256").update("git-clean").digest("hex").slice(0, 16);
  } catch {
    // Not a git repo (or git unavailable) — fall back to a content hash of tracked files.
    // mtime+size was tried first but is too coarse: same-second edits that don't change a
    // file's byte count (e.g. "x1" -> "x2") are invisible to it. Content hash is slower but correct.
    try {
      const snapshot = execSync(
        "find . -type f -not -path './.git/*' -not -path './node_modules/*' -not -path './.loop/*' -print0 2>/dev/null | sort -z | xargs -0 md5sum 2>/dev/null",
        { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
      );
      return createHash("sha256").update(snapshot).digest("hex").slice(0, 16);
    } catch {
      return "no-tree-signal";
    }
  }
}

function runVerification(command) {
  try {
    const stdout = execSync(command, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    return { exitCode: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: err.stdout ? err.stdout.toString() : "",
      stderr: err.stderr ? err.stderr.toString() : String(err.message || err),
    };
  }
}

function cmdCheck(specPath) {
  if (!existsSync(specPath)) {
    console.error(`FAIL: ${specPath} not found. Author a spec first (run the 'new' command).`);
    process.exit(1);
  }
  const specContent = readFileSync(specPath, "utf-8");
  const command = extractVerificationCommand(specContent);
  if (!command) {
    console.error(`FAIL: could not extract a runnable command from the Verification section of ${specPath}.`);
    console.error("Either add a fenced/backtick command, or this spec is LLM-judge-based and must be checked manually, not via run_loop.mjs.");
    process.exit(1);
  }
  const maxIterations = extractMaxIterations(specContent);

  const state = loadState();
  const key = resolve(specPath);
  const entry = state[key] || { iterations: [], maxIterations };
  entry.maxIterations = maxIterations; // always refresh from current spec in case it changed

  const completedCount = entry.iterations.length;
  if (completedCount >= maxIterations) {
    console.log(JSON.stringify({
      status: "stop-escalate",
      reason: `Iteration cap reached (${completedCount}/${maxIterations}) without success.`,
      iterations: completedCount,
    }, null, 2));
    process.exit(2);
  }

  console.error(`Running verification (iteration ${completedCount + 1}/${maxIterations}): ${command}`);
  const result = runVerification(command);
  const resultHash = hashResult(result.stdout, result.stderr, result.exitCode);
  const treeHash = hashWorkingTree();
  const compositeHash = `${resultHash}:${treeHash}`;
  const iterationRecord = {
    n: completedCount + 1,
    exitCode: result.exitCode,
    hash: compositeHash,
    timestamp: new Date().toISOString(),
  };
  entry.iterations.push(iterationRecord);
  state[key] = entry;
  saveState(state);

  if (result.exitCode === 0) {
    console.log(JSON.stringify({
      status: "success",
      reason: "Verification command exited 0.",
      iterations: entry.iterations.length,
      stdout: result.stdout.slice(-2000),
    }, null, 2));
    process.exit(0);
  }

  // No-progress check: look at the last N hashes (including this one).
  const recentHashes = entry.iterations.slice(-DEFAULT_NO_PROGRESS_LIMIT).map((it) => it.hash);
  const allSame = recentHashes.length === DEFAULT_NO_PROGRESS_LIMIT && recentHashes.every((h) => h === recentHashes[0]);
  if (allSame) {
    console.log(JSON.stringify({
      status: "stop-escalate",
      reason: `No-progress: last ${DEFAULT_NO_PROGRESS_LIMIT} iterations produced an identical result AND an unchanged working tree (no files were modified, or the change reverted to the same state). Stopping to avoid burning budget on a repeated failure.`,
      iterations: entry.iterations.length,
      stderr: result.stderr.slice(-2000),
    }, null, 2));
    process.exit(2);
  }

  if (entry.iterations.length >= maxIterations) {
    console.log(JSON.stringify({
      status: "stop-escalate",
      reason: `Iteration cap reached (${entry.iterations.length}/${maxIterations}) without success.`,
      iterations: entry.iterations.length,
      stderr: result.stderr.slice(-2000),
    }, null, 2));
    process.exit(2);
  }

  console.log(JSON.stringify({
    status: "continue",
    reason: "Verification failed but under cap and making progress (result differs from immediately preceding attempt). Make a change and check again.",
    iterations: entry.iterations.length,
    maxIterations,
    stderr: result.stderr.slice(-2000),
  }, null, 2));
  process.exit(1);
}

function cmdReset(specPath) {
  const state = loadState();
  const key = resolve(specPath);
  delete state[key];
  saveState(state);
  console.log(`Reset iteration history for ${specPath}.`);
}

function cmdStatus(specPath) {
  const state = loadState();
  const key = resolve(specPath);
  const entry = state[key];
  if (!entry) {
    console.log(JSON.stringify({ status: "no-history", specPath }, null, 2));
    return;
  }
  console.log(JSON.stringify({
    specPath,
    maxIterations: entry.maxIterations,
    completed: entry.iterations.length,
    history: entry.iterations,
  }, null, 2));
}

function main() {
  const [, , subcommand, specPathArg] = process.argv;
  const specPath = resolve(specPathArg || "LOOP_SPEC.md");

  switch (subcommand) {
    case "check":
      cmdCheck(specPath);
      break;
    case "reset":
      cmdReset(specPath);
      break;
    case "status":
      cmdStatus(specPath);
      break;
    default:
      console.error("Usage: node run_loop.mjs <check|reset|status> [path/to/LOOP_SPEC.md]");
      process.exit(1);
  }
}

main();
