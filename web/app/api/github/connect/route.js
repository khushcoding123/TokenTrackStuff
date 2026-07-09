// POST /api/github/connect
//
// Body: { repoUrl: string }
// Connects (or reuses the cached) GitHub repo and returns a summary of its file
// structure. The tree is cached in @metriq/optimize so later optimizations don't
// re-fetch it; the client only needs to remember the URL.

import { parseRepoUrl, getRepoTree } from "../../../../../packages/optimize/index.js";

export const dynamic = "force-dynamic";

function topDirs(files) {
  const counts = new Map();
  for (const p of files) {
    if (!p.includes("/")) continue;
    const seg = p.split("/")[0];
    counts.set(seg, (counts.get(seg) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    parseRepoUrl(body?.repoUrl); // validate URL shape before the network call
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  try {
    const tree = await getRepoTree(body.repoUrl);
    return Response.json({
      ok: true,
      repo: { owner: tree.owner, repo: tree.repo, branch: tree.branch },
      fileCount: tree.files.length,
      truncated: tree.truncated,
      topDirs: topDirs(tree.files),
    });
  } catch (e) {
    return Response.json({ error: e.message || "Failed to connect repository." }, { status: e.status || 502 });
  }
}
