// @metriq/optimize — GitHub-aware prompt optimization, shared by the web
// /optimize page and the desktop capture flow.
//
// One entry point, recommend(), runs the whole pipeline:
//   connect/fetch repo tree -> score files by relevance -> generate a focused,
//   token-cheap prompt with a savings explanation.

import { getRepoTree, parseRepoUrl } from "./github.js";
import { scoreFiles } from "./scorer.js";
import { buildRecommendation } from "./generator.js";

/**
 * @param {string} prompt
 * @param {{ repoUrl?:string, limit?:number }} [opts]
 * @returns {Promise<import("./generator.js").Recommendation & { repo: object|null }>}
 */
export async function recommend(prompt, opts = {}) {
  let tree = null;
  if (opts.repoUrl) tree = await getRepoTree(opts.repoUrl);

  const files = tree?.files || [];
  const relevant = scoreFiles(prompt, files, opts.limit || 6);
  const rec = buildRecommendation(prompt, relevant, {
    allFiles: files,
    repo: tree ? { owner: tree.owner, repo: tree.repo, branch: tree.branch } : null,
  });

  return {
    ...rec,
    repo: tree ? { owner: tree.owner, repo: tree.repo, branch: tree.branch, fileCount: files.length } : null,
  };
}

export { getRepoTree, parseRepoUrl, fetchRepoTree } from "./github.js";
export { scoreFiles } from "./scorer.js";
export { buildRecommendation } from "./generator.js";
