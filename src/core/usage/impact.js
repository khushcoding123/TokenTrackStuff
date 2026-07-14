// A benchmark-equivalent footprint, not a meter reading for Claude/Codex.
// Google measured these values for its median Gemini Apps text prompt in May
// 2025 using a full-stack serving methodology. We scale by request count and
// use Metriq's wasted-token share only to show potentially avoidable impact.
export const IMPACT_BENCHMARK = Object.freeze({
  name: "Google median Gemini Apps text prompt (May 2025)",
  energyWhPerRequest: 0.24,
  waterMlPerRequest: 0.26,
  carbonGPerRequest: 0.03,
  sourceUrl: "https://arxiv.org/abs/2508.15734",
});

function round(value, places = 4) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

export function estimateUsageImpact({ requests, totalTokens, wastedTokens }) {
  const requestCount = Math.max(0, Math.round(Number(requests) || 0));
  const tokens = Math.max(0, Number(totalTokens) || 0);
  const wasted = Math.min(tokens, Math.max(0, Number(wastedTokens) || 0));
  const wastedShare = tokens > 0 ? wasted / tokens : 0;
  const efficiencyPct = round((1 - wastedShare) * 100, 1);

  const estimated = {
    energyWh: round(requestCount * IMPACT_BENCHMARK.energyWhPerRequest),
    waterMl: round(requestCount * IMPACT_BENCHMARK.waterMlPerRequest),
    carbonG: round(requestCount * IMPACT_BENCHMARK.carbonGPerRequest),
  };
  const potentiallyAvoidable = {
    energyWh: round(estimated.energyWh * wastedShare),
    waterMl: round(estimated.waterMl * wastedShare),
    carbonG: round(estimated.carbonG * wastedShare),
  };

  return {
    available: requestCount > 0,
    requests: requestCount,
    totalTokens: tokens,
    wastedTokens: wasted,
    wastedShare: round(wastedShare, 6),
    efficiencyPct,
    estimated,
    potentiallyAvoidable,
    benchmark: IMPACT_BENCHMARK,
  };
}
