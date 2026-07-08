// Central configuration and pricing model for metriq.
// Prices are blended $ per 1M tokens (input + output averaged) and are only
// used to turn token estimates into rough dollar figures. They are deliberately
// approximate — the point is relative savings, not billing accuracy.

export const PROVIDERS = {
  "claude-opus": { label: "Claude Opus", pricePer1M: 30 },
  "claude-sonnet": { label: "Claude Sonnet", pricePer1M: 6 },
  "claude-haiku": { label: "Claude Haiku", pricePer1M: 1.5 },
  "gpt-4o": { label: "GPT-4o", pricePer1M: 7.5 },
  "gemini-pro": { label: "Gemini Pro", pricePer1M: 4 },
};

export const DEFAULT_PROVIDER = "claude-sonnet";

// How many tokens a single unfocused prompt tends to burn once the coding
// assistant starts searching and reading files. Used as the ceiling that a
// maximally broad prompt (breadthScore = 100) is projected to cost.
export const MAX_EXPLORATION_TOKENS = 45000;

// Even a perfectly scoped prompt still costs *some* exploration on top of the
// prompt text itself. This is the floor.
export const MIN_EXPLORATION_TOKENS = 800;

export function priceFor(providerKey = DEFAULT_PROVIDER) {
  return (PROVIDERS[providerKey] || PROVIDERS[DEFAULT_PROVIDER]).pricePer1M;
}

export function dollarsFor(tokens, providerKey = DEFAULT_PROVIDER) {
  return (tokens / 1_000_000) * priceFor(providerKey);
}
