// Capture window logic.
//
// Two ways a prompt arrives here:
//   1. Manual — the user types/pastes into the textarea.
//   2. Auto — the background watcher detected a draft in the user's AI tool and
//      seeded it (see "capture:get-seeded" in main.js); we prefill and run.
// Either way it goes through the same GitHub-aware recommendation and the same
// "Approve & apply" action.

(async function () {
  const input = document.getElementById("capture-input");
  const contextEl = document.getElementById("capture-context");
  const resultEl = document.getElementById("capture-result");
  const ratingEl = document.getElementById("capture-rating");
  const scoreEl = document.getElementById("capture-score");
  const savingsEl = document.getElementById("capture-savings");
  const issuesEl = document.getElementById("capture-issues");
  const filesWrap = document.getElementById("capture-files-wrap");
  const filesEl = document.getElementById("capture-files");
  const focusedEl = document.getElementById("capture-focused");
  const aiBadgeEl = document.getElementById("capture-ai-badge");
  const aiNoteEl = document.getElementById("capture-ai-note");
  const btnApply = document.getElementById("btn-apply");
  const btnCopy = document.getElementById("btn-copy");
  const btnClose = document.getElementById("btn-close");

  // Show what the recommendation is scoped to (connected repo, if any).
  const repoUrl = await window.metriq.getCaptureRepoUrl();
  contextEl.textContent = repoUrl ? `Scoped to ${shortRepo(repoUrl)}` : "No repository connected";

  let debounceTimer = null;
  let latestImproved = "";
  let latestStats = null;
  let runToken = 0;

  function shortRepo(url) {
    const m = String(url).match(/github\.com[/:]([^/]+\/[^/.]+)/i);
    return m ? m[1] : url;
  }

  function renderResult(rec) {
    resultEl.classList.remove("hidden");

    const a = rec.analysis || {};
    ratingEl.textContent = a.rating || "N/A";
    ratingEl.className = `capture-badge rating-${a.rating || "moderate"}`;
    scoreEl.textContent = `breadth ${a.breadthScore ?? 0}/100`;

    const s = rec.tokenSaving || {};
    savingsEl.textContent = s.savedTokens > 0 ? `saves ~${s.savedTokens} tokens (${s.savedPct}%)` : "";

    issuesEl.innerHTML = "";
    for (const issue of (a.issues || []).slice(0, 2)) {
      const li = document.createElement("li");
      li.textContent = `• ${issue.message}`;
      issuesEl.append(li);
    }

    // Relevant files from the connected GitHub repo.
    const files = rec.relevantFiles || [];
    if (files.length) {
      filesWrap.classList.remove("hidden");
      filesEl.innerHTML = "";
      for (const f of files) {
        const li = document.createElement("li");
        li.textContent = f.path;
        li.title = (f.reasons || []).join(" · ");
        filesEl.append(li);
      }
    } else {
      filesWrap.classList.add("hidden");
    }

    focusedEl.textContent = rec.improvedPrompt || "";
    latestImproved = rec.improvedPrompt || "";
    latestStats = {
      savedTokens: s.savedTokens || 0,
      savedPct: s.savedPct || 0,
      rating: a.rating,
      promptRunId: rec.promptRunId || null,
    };

    if (aiBadgeEl) aiBadgeEl.classList.toggle("hidden", !rec.aiTailored);
    if (aiNoteEl) {
      if (rec.aiError) {
        aiNoteEl.textContent = "AI rewrite unavailable — showing offline rewrite";
        aiNoteEl.classList.remove("hidden");
      } else {
        aiNoteEl.classList.add("hidden");
      }
    }

    // Surface whether Project Intelligence found the files (active project path).
    if (rec.source === "project" && contextEl) {
      const via =
        rec.contextSource === "typesense"
          ? "Project Intelligence"
          : rec.contextSource === "scanner"
            ? "local scan"
            : "active project";
      const name = rec.activeProject?.name;
      contextEl.textContent = name
        ? `Scoped to ${name} · via ${via}`
        : `Active project · via ${via}`;
    }
  }

  function clearResult() {
    resultEl.classList.add("hidden");
    latestImproved = "";
    latestStats = null;
  }

  async function run(prompt) {
    // capture:recommend can now wait on an AI network round-trip, so a slow
    // response to an earlier keystroke must not clobber a newer one.
    const myRun = ++runToken;
    const rec = await window.metriq.recommendPrompt(prompt);
    if (myRun !== runToken) return;
    renderResult(rec);
  }

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const prompt = input.value.trim();
    if (!prompt) {
      clearResult();
      return;
    }
    debounceTimer = setTimeout(() => run(prompt), 350);
  });

  // Approve -> put the improved prompt on the clipboard. The popup STAYS OPEN so
  // you can paste it (and keep working through more prompts); close it with the
  // × or Esc. Cross-app write-back is the gated seam, so this is clipboard-only.
  btnApply.addEventListener("click", async () => {
    if (!latestImproved) return;
    const result = await window.metriq.applyPrompt(latestImproved, latestStats);
    btnApply.textContent =
      result?.applied === "clipboard+terminal"
        ? "Inserted into terminal"
        : result?.applied === "clipboard+editor"
          ? "Inserted into editor"
          : "Applied. Paste with ⌘/Ctrl+V";
    setTimeout(() => (btnApply.textContent = "Approve & apply"), 1600);
  });

  btnCopy.addEventListener("click", async () => {
    if (!latestImproved) return;
    await window.metriq.copyToClipboard(latestImproved, latestStats);
    btnCopy.textContent = "Copied!";
    setTimeout(() => (btnCopy.textContent = "Copy"), 1200);
  });

  btnClose.addEventListener("click", () => window.metriq.closeCapture());

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") window.metriq.closeCapture();
  });

  // If the background watcher seeded a prompt, prefill and analyze immediately.
  const seeded = await window.metriq.getSeededPrompt();
  if (seeded) {
    input.value = seeded;
    run(seeded.trim());
  }

  // While this popup stays open, a newly-copied prompt is pushed in live.
  window.metriq.onSeedPrompt((prompt) => {
    input.value = prompt;
    run(String(prompt).trim());
  });

  input.focus();
})();
