// POST /api/recommend
//
// Body: { prompt: string, repoUrl?: string }
// The full pipeline (shared with the desktop app via @metriq/optimize): analyze
// the prompt, find the most relevant files in the connected GitHub repo, and
// generate an improved, token-cheap prompt with a token-saving explanation.
// Works without a repo too (it just can't name files).

import { recommend } from "../../../../packages/optimize/index.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prompt = String(body?.prompt || "").trim();
  if (!prompt) {
    return Response.json({ error: "Enter a prompt to optimize." }, { status: 400 });
  }

  try {
    const recommendation = await recommend(prompt, { repoUrl: body?.repoUrl });
    return Response.json(recommendation);
  } catch (e) {
    return Response.json({ error: e.message || "Failed to optimize the prompt." }, { status: e.status || 502 });
  }
}
