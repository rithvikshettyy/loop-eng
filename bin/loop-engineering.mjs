#!/usr/bin/env node
// bin/loop-engineering.mjs — CLI entry point.
//
// Subcommands:
//   install [--tool <id>|all] [--target <path>]
//   verify  [path]
//   run     [path]
//   status  [path]
//   audit   [--target <path>]
//   cost    [path] [--edit-tokens N] [--verify-tokens N] [--max-iterations N]
//
// Deliberately dependency-free (no commander/yargs): the command surface is small enough
// that hand-rolled parsing is more auditable than pulling in a flag-parsing dependency for
// a tool whose whole pitch is "minimal, mechanical, no magic."

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

import { detectTools, allToolIds, TOOLS } from "../src/lib/detect.mjs";
import { installTools } from "../src/lib/install.mjs";
import { auditProject } from "../src/lib/audit.mjs";
import { estimateCost, extractMaxIterationsFromSpec } from "../src/lib/cost.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_SCRIPTS_DIR = join(__dirname, "..", "skill", "scripts");
const LINT_SCRIPT = join(SKILL_SCRIPTS_DIR, "lint_spec.mjs");
const RUN_SCRIPT = join(SKILL_SCRIPTS_DIR, "run_loop.mjs");

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function cmdInstall(argv) {
  const { flags, positional } = parseFlags(argv);
  const target = resolve(flags.target || process.cwd());
  let toolIds;

  if (flags.tool === "all" || (!flags.tool && positional.length === 0)) {
    const detected = detectTools(target);
    toolIds = detected.length > 0 ? detected : allToolIds();
    console.log(
      detected.length > 0
        ? `Detected: ${detected.join(", ")}. Installing for detected tools only. Use --tool all to install everywhere.`
        : `No tool config detected in ${target}. Installing for all supported tools as a safe default.`
    );
  } else if (flags.tool) {
    toolIds = [flags.tool];
  } else {
    toolIds = positional; // allow: loop-engineering install claude-code cursor
  }

  const unknown = toolIds.filter((id) => !allToolIds().includes(id));
  if (unknown.length > 0) {
    console.error(`Unknown tool id(s): ${unknown.join(", ")}. Valid: ${allToolIds().join(", ")}`);
    process.exit(1);
  }

  const report = installTools(toolIds, target);
  for (const [id, results] of Object.entries(report)) {
    const label = TOOLS[id].label;
    for (const r of results) {
      const status = r.installed ? "installed" : `skipped (${r.reason})`;
      console.log(`[${label}] ${status}: ${r.path}`);
    }
  }
  console.log("\nDone. Restart your tool / start a new session to load the skill.");
}

function resolveSpecPath(positional) {
  return resolve(positional[0] || "LOOP_SPEC.md");
}

function cmdVerify(argv) {
  const { positional } = parseFlags(argv);
  const specPath = resolveSpecPath(positional);
  try {
    execFileSync("node", [LINT_SCRIPT, specPath], { stdio: "inherit" });
    process.exit(0);
  } catch (err) {
    process.exit(err.status ?? 1);
  }
}

function cmdRun(argv) {
  const { positional } = parseFlags(argv);
  const specPath = resolveSpecPath(positional);
  try {
    execFileSync("node", [RUN_SCRIPT, "check", specPath], { stdio: "inherit" });
    process.exit(0);
  } catch (err) {
    process.exit(err.status ?? 1);
  }
}

function cmdStatus(argv) {
  const { positional } = parseFlags(argv);
  const specPath = resolveSpecPath(positional);
  try {
    execFileSync("node", [RUN_SCRIPT, "status", specPath], { stdio: "inherit" });
  } catch (err) {
    process.exit(err.status ?? 1);
  }
}

function cmdAudit(argv) {
  const { flags } = parseFlags(argv);
  const target = resolve(flags.target || process.cwd());
  const result = auditProject(target, LINT_SCRIPT);
  console.log(`Loop Readiness Score: ${result.score}/${result.max}\n`);
  for (const check of result.checks) {
    const mark = check.points === check.max ? "✓" : check.points > 0 ? "~" : "✗";
    console.log(`  ${mark} ${check.label}: ${check.points}/${check.max}${check.detail ? ` — ${check.detail}` : ""}`);
  }
  if (flags.badge) {
    const color = result.score >= 80 ? "brightgreen" : result.score >= 50 ? "yellow" : "red";
    const url = `https://img.shields.io/badge/Loop%20Readiness-${result.score}%2F100-${color}`;
    console.log(`\nBadge markdown:\n![Loop Readiness](${url})`);
  }
}

function cmdCost(argv) {
  const { flags, positional } = parseFlags(argv);
  const specPath = resolveSpecPath(positional);
  let maxIterations = flags["max-iterations"] ? parseInt(flags["max-iterations"], 10) : null;

  if (!maxIterations) {
    if (!existsSync(specPath)) {
      console.error(`${specPath} not found, and no --max-iterations given. Either point at a spec or pass --max-iterations N.`);
      process.exit(1);
    }
    const content = readFileSync(specPath, "utf-8");
    maxIterations = extractMaxIterationsFromSpec(content);
    if (!maxIterations) {
      console.error(`Could not find "Max iterations: N" in ${specPath}'s Termination section. Pass --max-iterations N explicitly.`);
      process.exit(1);
    }
  }

  const opts = { maxIterations };
  if (flags["edit-tokens"]) opts.agentEditTokensPerIteration = parseInt(flags["edit-tokens"], 10);
  if (flags["verify-tokens"]) opts.verifierOutputTokens = parseInt(flags["verify-tokens"], 10);

  const result = estimateCost(opts);
  console.log(`Estimated token cost for up to ${result.maxIterations} iterations:`);
  console.log(`  Best case (succeeds iteration 1):  ~${result.lowEstimateTokens.toLocaleString()} tokens`);
  console.log(`  Worst case (runs full cap):         ~${result.highEstimateTokens.toLocaleString()} tokens`);
  console.log(`  Per-iteration:                      ~${result.perIterationTokens.toLocaleString()} tokens`);
  console.log(`\nAssumptions (override with --edit-tokens / --verify-tokens):`);
  console.log(`  ${JSON.stringify(result.assumptions)}`);
  console.log(`\n${result.note}`);
}

function printHelp() {
  console.log(`loop-engineering — turn a goal description into a loop-ready spec, then run it.

Usage:
  npx loop-engineering install [--tool <id>|all] [--target <path>]
  npx loop-engineering verify  [path]                 (default path: ./LOOP_SPEC.md)
  npx loop-engineering run     [path]
  npx loop-engineering status  [path]
  npx loop-engineering audit   [--target <path>] [--badge]
  npx loop-engineering cost    [path] [--max-iterations N] [--edit-tokens N] [--verify-tokens N]

Tool ids for install: ${allToolIds().join(", ")}, or "all"

Writing the spec itself (the "new" and "harden" workflows) happens inside your AI coding
tool, not on this CLI — install the skill, then ask your agent to author or fix a spec.
This CLI handles the mechanical parts: installing, linting, running, scoring, estimating.
`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case "install":
      cmdInstall(rest);
      break;
    case "verify":
      cmdVerify(rest);
      break;
    case "run":
      cmdRun(rest);
      break;
    case "status":
      cmdStatus(rest);
      break;
    case "audit":
      cmdAudit(rest);
      break;
    case "cost":
      cmdCost(rest);
      break;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      process.exit(1);
  }
}

main();
