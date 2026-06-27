#!/usr/bin/env node
// scripts/build.mjs — generates per-IDE pre-built directories at the repo root from the
// canonical skill/ template. Output is committed so the GitHub repo is browsable as a demo.
//
// Usage: node scripts/build.mjs

import { cpSync, copyFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SKILL_SRC = join(ROOT, "skill");
const PATTERNS_SRC = join(ROOT, "patterns");

const targets = [
  // Full skill dir copies — tools that support a structured skills directory
  { kind: "dir",     dest: join(ROOT, ".claude",   "skills",   "loop-engineering"), label: "Claude Code" },
  { kind: "dir",     dest: join(ROOT, ".agents",   "skills",   "loop-engineering"), label: "Codex" },
  { kind: "dir",     dest: join(ROOT, ".windsurf", "skills",   "loop-engineering"), label: "Windsurf" },
  { kind: "dir",     dest: join(ROOT, ".opencode", "skills",   "loop-engineering"), label: "OpenCode" },
  { kind: "dir",     dest: join(ROOT, ".rovodev",  "skills",   "loop-engineering"), label: "Rovodev" },
  { kind: "dir",     dest: join(ROOT, ".qoder",    "skills",   "loop-engineering"), label: "Qoder" },

  // Cursor — no native skills folder: command file + scripts copy
  { kind: "file",    src: join(PATTERNS_SRC, "cursor-loop.md"),
                     dest: join(ROOT, ".cursor", "commands", "loop.md"),            label: "Cursor command" },

  // Kiro — Steering: single markdown file in .kiro/steering/ + shared scripts
  { kind: "file",    src: join(SKILL_SRC, "SKILL.md"),
                     dest: join(ROOT, ".kiro", "steering", "loop-engineering.md"),  label: "Kiro steering" },

  // Trae — Rules: single markdown file in .trae/rules/ + shared scripts
  { kind: "file",    src: join(SKILL_SRC, "SKILL.md"),
                     dest: join(ROOT, ".trae", "rules",    "loop-engineering.md"),  label: "Trae rule" },

  // Shared scripts dir used by Cursor, Kiro, Trae (and any tool without a native scripts home)
  { kind: "scripts", dest: join(ROOT, ".loop", "scripts"),                          label: "Shared scripts (.loop/scripts)" },
];

function buildTarget(t) {
  switch (t.kind) {
    case "dir":
      if (existsSync(t.dest)) rmSync(t.dest, { recursive: true, force: true });
      mkdirSync(t.dest, { recursive: true });
      cpSync(SKILL_SRC, t.dest, { recursive: true });
      break;
    case "file":
      mkdirSync(dirname(t.dest), { recursive: true });
      copyFileSync(t.src, t.dest);
      break;
    case "scripts":
      if (existsSync(t.dest)) rmSync(t.dest, { recursive: true, force: true });
      mkdirSync(t.dest, { recursive: true });
      for (const f of readdirSync(join(SKILL_SRC, "scripts"))) {
        copyFileSync(join(SKILL_SRC, "scripts", f), join(t.dest, f));
      }
      break;
  }
  console.log(`  [${t.label}] ${t.dest}`);
}

console.log("Building per-IDE skill directories...");
for (const t of targets) buildTarget(t);
console.log("\nDone. Commit the generated directories to make the repo browsable as a demo.");
