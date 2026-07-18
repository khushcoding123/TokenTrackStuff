// Phase 7 — optional conceptual query expansion for Typesense keyword search.
//
// Not vector/embedding search. When hybridSearch is enabled, vague natural-
// language prompts are expanded with product/code synonyms so Typesense can
// still hit the right files (e.g. "tokens consumed" → usage, aggregate,
// renderer). Exact keyword search and the offline scanner remain the fallback
// when this is off or yields nothing.

const CONCEPT_SYNONYMS = [
  {
    match: /\b(token|tokens)\b.*\b(consum|spent|usage|used|cost|bill)/i,
    expand: ["usage", "aggregate", "cache", "pricing", "impact", "renderer"],
  },
  {
    match: /\b(how many|dashboard|screen|panel)\b.*\b(token|usage|cost)/i,
    expand: ["usage", "aggregate", "renderer", "impact", "overview"],
  },
  {
    match: /\b(auth|login|sign[\s-]?in|oauth|session)\b/i,
    expand: ["auth", "login", "signup", "protocol", "callback", "safeStorage", "credentials"],
  },
  {
    match: /\b(prompt|rewrite|optimize|breadth|vague)\b/i,
    expand: ["analyzer", "rewrite", "optimize", "capture", "prompt"],
  },
  {
    match: /\b(project|link|scan|index|folder)\b/i,
    expand: ["scanner", "project-cache", "insforge", "listSourceFiles"],
  },
  {
    match: /\b(theme|dark|light|accessibility|dyslexia|contrast)\b/i,
    expand: ["theme-init", "styles", "accessibility", "colorblind"],
  },
  {
    match: /\b(typesense|search|index|intelligence)\b/i,
    expand: ["typesense", "code-indexer", "context-search", "prompt-memory"],
  },
  {
    match: /\b(clipboard|capture|hotkey|watcher)\b/i,
    expand: ["capture", "prompt-watcher", "clipboard"],
  },
];

/**
 * Expand a user prompt with conceptual synonyms when hybrid mode is on.
 * Pure / deterministic — unit-tested.
 *
 * Important: `q` is built from short keyword tokens + synonyms, NOT the full
 * natural-language sentence. Stuffing the whole sentence into Typesense
 * dilutes ranking (too many low-signal words) and can miss the synonym hits.
 *
 * @param {string} prompt
 * @param {{ hybridSearch?: boolean, keywords?: string[] }} [opts]
 * @returns {{ q: string, expanded: string[], hybrid: boolean }}
 */
function expandQuery(prompt, opts = {}) {
  const base = String(prompt || "").trim();
  const keywords = Array.isArray(opts.keywords)
    ? opts.keywords.filter(Boolean)
    : base
        .toLowerCase()
        .split(/[^a-z0-9_./-]+/)
        .filter((t) => t.length >= 3);

  if (!opts.hybridSearch || !base) {
    return { q: keywords.length ? keywords.join(" ") : base, expanded: [], hybrid: false };
  }
  const expanded = [];
  for (const rule of CONCEPT_SYNONYMS) {
    if (rule.match.test(base)) {
      for (const term of rule.expand) {
        if (!expanded.includes(term)) expanded.push(term);
      }
    }
  }
  const extras = expanded.slice(0, 8);
  // Prefer high-signal tokens: synonyms first, then prompt keywords.
  const merged = [...extras];
  for (const k of keywords) {
    if (!merged.includes(k) && merged.length < 14) merged.push(k);
  }
  if (!merged.length) return { q: base, expanded: [], hybrid: true };
  return { q: merged.join(" "), expanded: extras, hybrid: true };
}

module.exports = {
  CONCEPT_SYNONYMS,
  expandQuery,
};
