// cost.mjs — rough token cost estimate for running a loop spec, BEFORE committing to a run.
//
// This is deliberately a rough range, not a precise prediction — token usage depends on
// the specific model, how much surrounding context the agent's harness re-reads each
// turn, and how verbose the verification output is. The goal is to catch "this will burn
// through my plan before lunch" before it happens, not to bill accurately.
//
// Model (stated so it can be argued with):
//   per-iteration tokens ≈ SKILL_OVERHEAD (re-reading SKILL.md + the relevant reference
//     file, ~1 time per session, amortized) + SPEC_TOKENS (the spec itself, read every
//     iteration) + VERIFIER_OUTPUT_TOKENS (stdout/stderr fed back, varies a lot by command)
//     + AGENT_EDIT_TOKENS (the actual code-editing turn — by far the most variable and
//     the dominant cost on anything beyond a trivial fix)
//
// Defaults below are deliberately conservative (biased toward overestimating) since the
// failure mode of underestimating is worse (surprise bill) than overestimating (caution).

const DEFAULTS = {
  specTokens: 400, // a loop-ready spec with all 5 sections, read every iteration
  verifierOutputTokens: 300, // typical test/build/lint stdout+stderr on failure
  agentEditTokensPerIteration: 2000, // conservative floor for "read failure, make a real edit"
  skillOverheadTokens: 1500, // SKILL.md + one reference file, paid once per session not per iteration
};

/**
 * @param {object} opts
 * @param {number} opts.maxIterations — from the spec's Termination section
 * @param {number} [opts.specTokens]
 * @param {number} [opts.verifierOutputTokens]
 * @param {number} [opts.agentEditTokensPerIteration]
 * @param {number} [opts.skillOverheadTokens]
 */
export function estimateCost(opts) {
  const {
    maxIterations,
    specTokens = DEFAULTS.specTokens,
    verifierOutputTokens = DEFAULTS.verifierOutputTokens,
    agentEditTokensPerIteration = DEFAULTS.agentEditTokensPerIteration,
    skillOverheadTokens = DEFAULTS.skillOverheadTokens,
  } = opts;

  if (!maxIterations || maxIterations < 1) {
    throw new Error("maxIterations must be a positive integer (read it from the spec's Termination section)");
  }

  const perIteration = specTokens + verifierOutputTokens + agentEditTokensPerIteration;
  // Best case: succeeds on iteration 1. Worst case: runs the full cap.
  const lowEstimate = skillOverheadTokens + perIteration * 1;
  const highEstimate = skillOverheadTokens + perIteration * maxIterations;

  return {
    maxIterations,
    perIterationTokens: perIteration,
    lowEstimateTokens: lowEstimate,
    highEstimateTokens: highEstimate,
    assumptions: {
      specTokens,
      verifierOutputTokens,
      agentEditTokensPerIteration,
      skillOverheadTokens,
    },
    note: "Rough range, not a prediction. agentEditTokensPerIteration is the dominant and most variable term — override it with --edit-tokens if you have a sense of how big the actual changes will be.",
  };
}

export function extractMaxIterationsFromSpec(specContent) {
  const re = /(?:^|\n)##\s+Termination\s*\n([\s\S]*?)(?=\n##\s+|$)/;
  const m = specContent.match(re);
  if (!m) return null;
  const numMatch = m[1].match(/max\s+iterations?\s*:?\s*(\d+)/i);
  return numMatch ? parseInt(numMatch[1], 10) : null;
}
