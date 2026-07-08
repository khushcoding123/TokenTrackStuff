(async function () {
  const input = document.getElementById("capture-input");
  const contextEl = document.getElementById("capture-context");
  const resultEl = document.getElementById("capture-result");
  const ratingEl = document.getElementById("capture-rating");
  const scoreEl = document.getElementById("capture-score");
  const savingsEl = document.getElementById("capture-savings");
  const issuesEl = document.getElementById("capture-issues");
  const focusedEl = document.getElementById("capture-focused");
  const btnCopy = document.getElementById("btn-copy");

  const { activeProject } = await window.metriq.getCaptureContext();
  contextEl.textContent = activeProject ? `Checking against ${activeProject.name}` : "No project linked";

  let debounceTimer = null;
  let latestFocusedPrompt = "";

  function renderResult(result) {
    resultEl.classList.remove("hidden");
    ratingEl.textContent = result.rating;
    ratingEl.className = `capture-badge rating-${result.rating}`;
    scoreEl.textContent = `breadth ${result.breadthScore}/100`;
    savingsEl.textContent = result.savedTokens > 0 ? `saves ~${result.savedTokens} tokens (${result.savedPct}%)` : "";

    issuesEl.innerHTML = "";
    for (const issue of result.issues.slice(0, 3)) {
      const li = document.createElement("li");
      li.textContent = `• ${issue.message}`;
      issuesEl.append(li);
    }

    focusedEl.textContent = result.focusedPrompt;
    latestFocusedPrompt = result.focusedPrompt;
  }

  function clearResult() {
    resultEl.classList.add("hidden");
    latestFocusedPrompt = "";
  }

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const prompt = input.value.trim();
    if (!prompt) {
      clearResult();
      return;
    }
    debounceTimer = setTimeout(async () => {
      const result = await window.metriq.analyzePrompt(prompt);
      renderResult(result);
    }, 350);
  });

  btnCopy.addEventListener("click", async () => {
    if (!latestFocusedPrompt) return;
    await window.metriq.copyToClipboard(latestFocusedPrompt);
    btnCopy.textContent = "Copied!";
    setTimeout(() => {
      btnCopy.textContent = "Copy improved prompt";
    }, 1200);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") window.metriq.closeCapture();
  });

  input.focus();
})();
