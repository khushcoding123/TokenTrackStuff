// Lightweight token estimator.
//
// Real tokenizers (tiktoken, the Claude tokenizer) require large vocab files or
// a network call. For a terminal companion we want an instant, offline, "close
// enough" estimate. We blend two well-known heuristics and take the larger,
// which tracks actual BPE token counts within ~10-15% for typical English +
// code prompts:
//
//   • ~4 characters per token
//   • ~0.75 tokens per word (i.e. ~1.33 words per token)
//
// Code and punctuation tokenize denser than prose, so we nudge the estimate up
// when the text is punctuation-heavy.

export function estimateTokens(text) {
  if (!text) return 0;
  const trimmed = String(text).trim();
  if (!trimmed) return 0;

  const chars = trimmed.length;
  const words = trimmed.split(/\s+/).filter(Boolean).length;

  const byChars = chars / 4;
  const byWords = words / 0.75;

  // Punctuation / symbol density bumps token count (each often its own token).
  const punctuation = (trimmed.match(/[^\w\s]/g) || []).length;
  const punctuationBoost = punctuation * 0.5;

  return Math.max(1, Math.round(Math.max(byChars, byWords) + punctuationBoost));
}

// Convenience: estimate tokens for many strings at once.
export function estimateTokensBatch(texts) {
  return texts.reduce((sum, t) => sum + estimateTokens(t), 0);
}
