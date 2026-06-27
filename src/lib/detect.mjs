// detect.mjs — detects which AI coding tool directories exist in a project,
// and maps each supported tool to where this skill should be installed for it.
//
// Detection is presence-based (does the tool's config dir/file already exist?),
// not capability-based — we don't probe whether the tool is actually installed
// on the machine, just whether the project has already been touched by it.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Each entry: id, human label, a "signal" path (relative to project root) that indicates
// the tool is already in use in this project, and the install path(s) for the skill.
export const TOOLS = {
  "claude-code": {
    label: "Claude Code",
    signal: (root) => join(root, ".claude"),
    installPaths: (root) => [join(root, ".claude", "skills", "loop-engineering")],
  },
  codex: {
    label: "Codex",
    // .agents/skills is the specific convention (bare .agents/ is too generic a dirname
    // to safely infer Codex usage from).
    signal: (root) => join(root, ".agents", "skills"),
    installPaths: (root) => [
      join(root, ".agents", "skills", "loop-engineering"),
      join(homedir(), ".codex", "skills", "loop-engineering"),
    ],
  },
  windsurf: {
    label: "Windsurf",
    signal: (root) => join(root, ".windsurf"),
    installPaths: (root) => [join(root, ".windsurf", "skills", "loop-engineering")],
  },
  antigravity: {
    label: "Antigravity",
    // No reliable per-PROJECT signal exists for Antigravity — its skills dir is global
    // (~/.gemini/antigravity), so "does it exist" tells us about the machine, not this
    // project, and would false-positive for any project once Antigravity has been used
    // anywhere. Excluded from auto-detection; only included via explicit --tool or --all.
    signal: () => null,
    installPaths: () => [join(homedir(), ".gemini", "antigravity", "skills", "loop-engineering")],
  },
  cursor: {
    label: "Cursor",
    signal: (root) => join(root, ".cursor"),
    installPaths: (root) => [
      // Cursor has no skills mechanism — command + a script copy live separately.
      { kind: "cursor-command", path: join(root, ".cursor", "commands", "loop.md") },
      { kind: "cursor-scripts", path: join(root, ".loop", "scripts") },
    ],
  },
};

export function detectTools(root) {
  const detected = [];
  for (const [id, tool] of Object.entries(TOOLS)) {
    const signalPath = tool.signal(root);
    if (signalPath && existsSync(signalPath)) detected.push(id);
  }
  return detected;
}

export function allToolIds() {
  return Object.keys(TOOLS);
}
