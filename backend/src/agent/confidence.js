/**
 * Confidence Scoring Module
 *
 * Calculates a 0.0–1.0 confidence score for the agent's decision
 * based on the quality and completeness of data gathered.
 *
 * The score drives escalation: if confidence < 0.6, the agent escalates
 * rather than acting autonomously.
 *
 * Scoring components:
 *   - Data completeness: are all required fields present?
 *   - Tool success rate: how many tool calls succeeded?
 *   - Consistency: do customer claims match system records?
 *   - Risk signals: fraud, social engineering, threatening language
 *   - KB relevance: did KB search return relevant articles?
 */

/**
 * Calculate confidence score for a given agent state.
 * @param {object} state - The current agent state
 * @returns {{ score: number, breakdown: object, explanation: string }}
 */
function calculateConfidence(state) {
  let score = 1.0;
  const breakdown = {};
  const penalties = [];

  // Component 1: Tool success rate (0–0.3 penalty)
  const totalTools = state.tool_calls.length;
  const failedTools = state.tool_calls.filter((t) => !t.success).length;
  const toolSuccessRate = totalTools > 0 ? (totalTools - failedTools) / totalTools : 0.5;
  const toolPenalty = (1 - toolSuccessRate) * 0.3;
  score -= toolPenalty;
  breakdown.tool_success_rate = parseFloat(toolSuccessRate.toFixed(2));
  if (toolPenalty > 0) penalties.push(`Tool failure rate: ${failedTools}/${totalTools} tools failed (-${toolPenalty.toFixed(2)})`);

  // Component 2: Missing critical data (0–0.25 penalty)
  let missingDataPenalty = 0;
  if (!state.customer) { missingDataPenalty += 0.1; penalties.push("Customer data unavailable (-0.10)"); }
  if (!state.order && state.ticket.body.match(/ord-\d+|order/i)) { missingDataPenalty += 0.1; penalties.push("Order data unavailable (-0.10)"); }
  if (!state.product && state.order) { missingDataPenalty += 0.05; penalties.push("Product data unavailable (-0.05)"); }
  score -= Math.min(missingDataPenalty, 0.25);
  breakdown.missing_data_penalty = parseFloat(missingDataPenalty.toFixed(2));

  // Component 3: Risk signals (0–0.3 penalty)
  let riskPenalty = 0;
  if (state.is_fraud_flagged) { riskPenalty += 0.2; penalties.push("Fraud flag detected (-0.20)"); }
  if (state.is_social_engineering) { riskPenalty += 0.25; penalties.push("Social engineering detected (-0.25)"); }
  if (state.has_threatening_language) { riskPenalty += 0.1; penalties.push("Threatening language detected (-0.10)"); }
  score -= Math.min(riskPenalty, 0.3);
  breakdown.risk_penalty = parseFloat(riskPenalty.toFixed(2));

  // Component 4: Minimum tool call requirement (penalty if < 3 tools called)
  if (totalTools < 3) {
    const shortfallPenalty = (3 - totalTools) * 0.05;
    score -= shortfallPenalty;
    breakdown.insufficient_tool_calls = true;
    penalties.push(`Only ${totalTools} tool calls made (minimum 3 required) (-${shortfallPenalty.toFixed(2)})`);
  }

  // Component 5: KB search helped
  if (state.kb_results && state.kb_results.length > 0) {
    score = Math.min(score + 0.05, 1.0);
    breakdown.kb_boost = 0.05;
  }

  // Clamp to [0, 1]
  score = Math.max(0, Math.min(1, score));
  breakdown.final_score = parseFloat(score.toFixed(2));

  const explanation =
    score >= 0.8
      ? "High confidence — sufficient data and low risk."
      : score >= 0.6
      ? "Moderate confidence — some data gaps or minor risk signals."
      : "Low confidence — escalation recommended due to missing data or risk flags.";

  return {
    score: parseFloat(score.toFixed(2)),
    breakdown,
    explanation,
    penalties,
    requires_escalation: score < 0.6,
  };
}

module.exports = { calculateConfidence };
