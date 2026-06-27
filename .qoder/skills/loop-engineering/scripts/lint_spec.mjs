#!/usr/bin/env node
// lint_spec.mjs — validates a LOOP_SPEC.md against the 5 required loop-engineering components.
// Exit 0 = spec is loop-ready. Exit 1 = spec is missing or incomplete, with specific errors.
//
// Usage: node lint_spec.mjs [path/to/LOOP_SPEC.md]
// Default path: ./LOOP_SPEC.md

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(process.argv[2] || "LOOP_SPEC.md");

const REQUIRED_SECTIONS = [
  { key: "Goal", header: /^##\s+Goal\s*$/m },
  { key: "Verification", header: /^##\s+Verification\s*$/m },
  { key: "Termination", header: /^##\s+Termination\s*$/m },
  { key: "Scope", header: /^##\s+Scope\s*$/m },
  { key: "Escalation", header: /^##\s+Escalation\s*$/m },
];

// Phrases that indicate the section is a template placeholder, not real content.
// These match only when the ENTIRE trimmed section is the placeholder — a substring match
// would false-positive on legitimate commands containing <args>, e.g. `playwright test <file>`.
const PLACEHOLDER_WHOLE_SECTION_PATTERNS = [
  /^\.\.\.$/,
  /^<[^>]{2,80}>$/, // section is nothing but a single unfilled template slot like "<concrete, observable end state>"
  /^TBD$/i,
  /^TODO$/i,
  /^N\/A$/i,
];

function isPlaceholder(text) {
  if (!text || text.length === 0) return true;
  const trimmed = text.trim();
  return PLACEHOLDER_WHOLE_SECTION_PATTERNS.some((p) => p.test(trimmed));
}

function extractSection(content, key) {
  // Grab everything between "## Key" and the next "## " heading or end of file.
  // Anchored on "\n##" (not "^##" with the m flag) to avoid $ matching end-of-line
  // instead of end-of-string, which previously truncated every multi-line section
  // at its first line break.
  const re = new RegExp(`(?:^|\\n)##\\s+${key}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`);
  const m = content.match(re);
  return m ? m[1].trim() : null;
}

function checkVerification(text) {
  // Verification section needs either a runnable-looking command (backticks / code fence)
  // or an explicit acknowledgement that it's LLM-judge based (flagged as weakest link).
  const hasCodeFence = /```[\s\S]*?```/.test(text) || /`[^`]+`/.test(text);
  const flagsLLMJudge = /llm[\s-]?judge|llm[\s-]?as[\s-]?judge|rubric/i.test(text);
  if (!hasCodeFence && !flagsLLMJudge) {
    return "Verification section has no command (in backticks/code fence) and does not explicitly name an LLM-judge rubric as fallback. A verifier must be either a runnable check or an explicitly-flagged LLM-judge.";
  }
  return null;
}

function checkTermination(text) {
  const hasSuccess = /success/i.test(text);
  const hasMaxIter = /max\s+iterations?|iteration\s+cap/i.test(text);
  const hasNoProgress = /no-?progress/i.test(text);
  const missing = [];
  if (!hasSuccess) missing.push("success condition");
  if (!hasMaxIter) missing.push("max iterations / iteration cap");
  if (!hasNoProgress) missing.push("no-progress exit");
  if (missing.length > 0) {
    return `Termination section is missing: ${missing.join(", ")}. All three are required — a loop without a no-progress exit can burn its entire budget repeating the same failure.`;
  }
  return null;
}

function checkScope(text) {
  const hasForbidden = /forbidden|not\s+allowed|never|do\s+not/i.test(text);
  if (!hasForbidden) {
    return "Scope section names no forbidden actions. Every loop spec must explicitly forbid at least one destructive shortcut (e.g. editing tests to force a pass, touching migrations, force-pushing).";
  }
  return null;
}

function checkEscalation(text) {
  const hasStop = /stop|halt|wait|escalat|human|review/i.test(text);
  if (!hasStop) {
    return "Escalation section does not describe what happens when the cap is hit. Must explicitly state the loop stops and waits for a human rather than retrying indefinitely.";
  }
  return null;
}

function main() {
  if (!existsSync(target)) {
    console.error(`FAIL: ${target} not found.`);
    console.error("No loop spec exists yet. Run the 'new' command to author one before verifying or running a loop.");
    process.exit(1);
  }

  const content = readFileSync(target, "utf-8");
  const errors = [];
  const sections = {};

  for (const { key, header } of REQUIRED_SECTIONS) {
    if (!header.test(content)) {
      errors.push(`Missing required section: "## ${key}"`);
      continue;
    }
    const text = extractSection(content, key);
    sections[key] = text;
    if (isPlaceholder(text)) {
      errors.push(`Section "## ${key}" is empty or still contains placeholder/template text: ${JSON.stringify((text || "").slice(0, 80))}`);
    }
  }

  // Section-specific deep checks only run if the section exists and isn't a placeholder.
  if (sections.Verification && !isPlaceholder(sections.Verification)) {
    const err = checkVerification(sections.Verification);
    if (err) errors.push(`[Verification] ${err}`);
  }
  if (sections.Termination && !isPlaceholder(sections.Termination)) {
    const err = checkTermination(sections.Termination);
    if (err) errors.push(`[Termination] ${err}`);
  }
  if (sections.Scope && !isPlaceholder(sections.Scope)) {
    const err = checkScope(sections.Scope);
    if (err) errors.push(`[Scope] ${err}`);
  }
  if (sections.Escalation && !isPlaceholder(sections.Escalation)) {
    const err = checkEscalation(sections.Escalation);
    if (err) errors.push(`[Escalation] ${err}`);
  }

  if (errors.length > 0) {
    console.error(`FAIL: ${target} is not loop-ready (${errors.length} issue${errors.length > 1 ? "s" : ""}):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(`PASS: ${target} is loop-ready. All 5 sections present and substantive.`);
  process.exit(0);
}

main();
