// Metriq settings page. Reads/writes chrome.storage.local; the background
// worker is the only thing that ever touches the key over the network.

const $ = (id) => document.getElementById(id);

const els = {
  aiEnabled: $("aiEnabled"),
  apiKey: $("apiKey"),
  toggleKey: $("toggleKey"),
  model: $("model"),
  save: $("save"),
  test: $("test"),
  status: $("status"),
};

function setStatus(msg, kind = "muted") {
  els.status.textContent = msg;
  els.status.className = `status ${kind}`;
}

async function load() {
  const d = await chrome.storage.local.get(["apiKey", "model", "aiEnabled"]);
  els.apiKey.value = d.apiKey || "";
  els.model.value = d.model || "claude-opus-4-8";
  els.aiEnabled.checked = d.aiEnabled !== false; // default on
}

async function save() {
  await chrome.storage.local.set({
    apiKey: els.apiKey.value.trim(),
    model: els.model.value,
    aiEnabled: els.aiEnabled.checked,
  });
  setStatus("Saved.", "ok");
}

// Persist first so the background worker tests against the current values.
async function test() {
  await save();
  if (!els.aiEnabled.checked) {
    setStatus("Turn on AI-tailored rewrite to test the key.", "err");
    return;
  }
  if (!els.apiKey.value.trim()) {
    setStatus("Enter an API key first.", "err");
    return;
  }
  setStatus("Testing…", "muted");
  chrome.runtime.sendMessage({ type: "metriq-test-key" }, (res) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message, "err");
      return;
    }
    if (res && res.ok) {
      setStatus("Key works. You're set.", "ok");
    } else {
      setStatus(`Key check failed: ${(res && res.error) || "unknown error"}`, "err");
    }
  });
}

els.toggleKey.addEventListener("click", () => {
  const showing = els.apiKey.type === "text";
  els.apiKey.type = showing ? "password" : "text";
  els.toggleKey.textContent = showing ? "Show" : "Hide";
});

els.save.addEventListener("click", save);
els.test.addEventListener("click", test);
document.addEventListener("DOMContentLoaded", load);
