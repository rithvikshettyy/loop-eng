// install.mjs — copies the skill payload to wherever a given tool expects it.

import { existsSync, mkdirSync, cpSync, copyFileSync, chmodSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOLS } from "./detect.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
// This file lives at <package>/src/lib/install.mjs — the skill payload is at <package>/skill.
const SKILL_SRC = join(__dirname, "..", "..", "skill");

function copySkillDir(destDir) {
  if (existsSync(destDir)) {
    return { installed: false, path: destDir, reason: "already exists" };
  }
  mkdirSync(dirname(destDir), { recursive: true });
  cpSync(SKILL_SRC, destDir, { recursive: true });
  const scriptsDir = join(destDir, "scripts");
  if (existsSync(scriptsDir)) {
    for (const f of readdirSync(scriptsDir)) {
      if (f.endsWith(".mjs")) chmodSync(join(scriptsDir, f), 0o755);
    }
  }
  return { installed: true, path: destDir };
}

function installScriptsOnly(destDir) {
  if (existsSync(destDir)) {
    return { installed: false, path: destDir, reason: "already exists" };
  }
  mkdirSync(destDir, { recursive: true });
  for (const f of readdirSync(join(SKILL_SRC, "scripts"))) {
    copyFileSync(join(SKILL_SRC, "scripts", f), join(destDir, f));
    chmodSync(join(destDir, f), 0o755);
  }
  return { installed: true, path: destDir };
}

function installSingleFile(srcFile, destFile) {
  if (existsSync(destFile)) {
    return { installed: false, path: destFile, reason: "already exists" };
  }
  mkdirSync(dirname(destFile), { recursive: true });
  copyFileSync(srcFile, destFile);
  return { installed: true, path: destFile };
}

function installKiro(root) {
  const steeringFile = join(root, ".kiro", "steering", "loop-engineering.md");
  const scriptsDir = join(root, ".loop", "scripts");
  return [
    installSingleFile(join(SKILL_SRC, "SKILL.md"), steeringFile),
    installScriptsOnly(scriptsDir),
  ];
}

function installTrae(root) {
  const ruleFile = join(root, ".trae", "rules", "loop-engineering.md");
  const scriptsDir = join(root, ".loop", "scripts");
  return [
    installSingleFile(join(SKILL_SRC, "SKILL.md"), ruleFile),
    installScriptsOnly(scriptsDir),
  ];
}

function installCursor(root) {
  const results = [];
  const commandPath = join(root, ".cursor", "commands", "loop.md");
  const cursorSrcCommand = join(__dirname, "..", "..", "patterns", "cursor-loop.md");
  if (existsSync(commandPath)) {
    results.push({ installed: false, path: commandPath, reason: "already exists" });
  } else {
    mkdirSync(dirname(commandPath), { recursive: true });
    copyFileSync(cursorSrcCommand, commandPath);
    results.push({ installed: true, path: commandPath });
  }

  const scriptsDestDir = join(root, ".loop", "scripts");
  if (existsSync(scriptsDestDir)) {
    results.push({ installed: false, path: scriptsDestDir, reason: "already exists" });
  } else {
    mkdirSync(scriptsDestDir, { recursive: true });
    for (const f of readdirSync(join(SKILL_SRC, "scripts"))) {
      copyFileSync(join(SKILL_SRC, "scripts", f), join(scriptsDestDir, f));
      chmodSync(join(scriptsDestDir, f), 0o755);
    }
    results.push({ installed: true, path: scriptsDestDir });
  }
  return results;
}

/**
 * Install the skill for a single tool id. Returns an array of result objects
 * ({ installed, path, reason? }) — most tools produce one, cursor produces two.
 */
export function installTool(toolId, root) {
  if (toolId === "cursor") return installCursor(root);
  if (toolId === "kiro") return installKiro(root);
  if (toolId === "trae") return installTrae(root);
  const tool = TOOLS[toolId];
  if (!tool) throw new Error(`Unknown tool: ${toolId}`);
  const paths = tool.installPaths(root);
  return paths.map((p) => copySkillDir(p));
}

export function installTools(toolIds, root) {
  const report = {};
  for (const id of toolIds) {
    report[id] = installTool(id, root);
  }
  return report;
}
