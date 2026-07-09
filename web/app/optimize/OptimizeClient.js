"use client";

// Optimize screen: connect a GitHub repo once, capture the current prompt, and
// get a focused replacement prompt in a popup.
//
// PROMPT CAPTURE LAYER
// --------------------
// The prompt currently comes from the textarea below (manual input). This is
// deliberately funneled through a single setter, `applyPrompt()`, so a future
// capture source — screen recording, an editor overlay, or a browser-extension
// hook — can feed prompts in the same way without touching the rest of this
// component. When that lands, call applyPrompt(capturedText). Nothing here reads
// the textarea directly except the manual path.

import { useEffect, useRef, useState } from "react";
import { useToast } from "../components/ToastProvider";
import RecommendationModal from "./RecommendationModal";

const REPO_KEY = "metriq:connectedRepo"; // { repoUrl, owner, repo, branch, fileCount }

export default function OptimizeClient() {
  const { notify } = useToast();

  // repo connection
  const [repoUrl, setRepoUrl] = useState("");
  const [connected, setConnected] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  // prompt + analysis
  const [prompt, setPrompt] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const promptRef = useRef(null);

  // Restore a previously-connected repo so users don't reconnect every visit.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(REPO_KEY) || "null");
      if (saved?.repoUrl) {
        setRepoUrl(saved.repoUrl);
        setConnected(saved);
      }
    } catch {
      /* ignore malformed cache */
    }
  }, []);

  // Single entry point for setting the current prompt — see capture-layer note.
  const applyPrompt = (text) => {
    setPrompt(text);
    promptRef.current?.focus();
  };

  async function connectRepo(e) {
    e?.preventDefault();
    setConnectError("");
    if (!repoUrl.trim()) {
      setConnectError("Paste a GitHub repo URL first.");
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch("/api/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConnectError(data.error || "Could not connect that repository.");
        return;
      }
      const record = {
        repoUrl,
        owner: data.repo.owner,
        repo: data.repo.repo,
        branch: data.repo.branch,
        fileCount: data.fileCount,
      };
      setConnected(record);
      localStorage.setItem(REPO_KEY, JSON.stringify(record));
      notify(`Connected ${data.repo.owner}/${data.repo.repo} · ${data.fileCount} files`);
    } catch {
      setConnectError("Network error connecting to the repository.");
    } finally {
      setConnecting(false);
    }
  }

  function disconnectRepo() {
    setConnected(null);
    localStorage.removeItem(REPO_KEY);
    notify("Repository disconnected");
  }

  async function optimize() {
    setError("");
    if (!prompt.trim()) {
      setError("Enter the prompt you're about to send your AI tool.");
      return;
    }
    setOptimizing(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, repoUrl: connected?.repoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not optimize the prompt.");
        return;
      }
      setResult(data);
      setModalOpen(true);
    } catch {
      setError("Network error while optimizing.");
    } finally {
      setOptimizing(false);
    }
  }

  return (
    <div className="flex-1 p-margin-mobile md:p-margin-desktop max-w-container-max mx-auto w-full space-y-stack-xl">
      <div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Optimize a prompt</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-2xl">
          Connect your repo once, paste the prompt you&apos;re about to send your AI coding tool, and Metriq rewrites it to point at the right files — so the AI stops searching the whole project.
        </p>
      </div>

      {/* 1. Connect GitHub repo */}
      <section className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">hub</span>
          <h3 className="font-headline-md text-headline-md text-on-surface">Connected repository</h3>
        </div>

        {connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-body-md text-body-md text-on-surface">
              <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
              <span className="font-label-md">{connected.owner}/{connected.repo}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                · {connected.branch} · {connected.fileCount} files indexed
              </span>
            </div>
            <button
              className="font-label-sm text-label-sm text-on-surface-variant hover:text-error transition-colors"
              onClick={disconnectRepo}
              type="button"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <form className="flex flex-col sm:flex-row gap-2" onSubmit={connectRepo}>
            <input
              className="flex-1 bg-surface-glass border border-border-subtle rounded-lg py-2.5 px-3 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              type="text"
            />
            <button
              className="font-label-md text-label-md text-on-primary bg-primary hover:bg-primary/90 px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              disabled={connecting}
              type="submit"
            >
              {connecting ? "Connecting…" : "Connect"}
            </button>
          </form>
        )}
        {connectError && (
          <p className="mt-2 font-label-sm text-label-sm text-error">{connectError}</p>
        )}
        <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant">
          Public repos work out of the box. The file structure is cached so you only connect once.
        </p>
      </section>

      {/* 2. Capture the current prompt */}
      <section className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">edit_note</span>
          <h3 className="font-headline-md text-headline-md text-on-surface">Your current prompt</h3>
        </div>
        <textarea
          ref={promptRef}
          className="w-full min-h-[140px] bg-surface-glass border border-border-subtle rounded-lg p-3 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y"
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='e.g. "fix the dashboard"'
          value={prompt}
        />
        <div className="flex items-center justify-between gap-3 mt-3">
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {connected ? `Scoped to ${connected.owner}/${connected.repo}` : "No repo connected — connect one for file-level targeting"}
          </span>
          <button
            className="font-label-md text-label-md text-on-primary bg-primary hover:bg-primary/90 px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
            disabled={optimizing}
            onClick={optimize}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
            {optimizing ? "Analyzing…" : "Optimize prompt"}
          </button>
        </div>
        {error && <p className="mt-2 font-label-sm text-label-sm text-error">{error}</p>}
      </section>

      {/* Re-open the last recommendation without re-running */}
      {result && !modalOpen && (
        <button
          className="font-label-sm text-label-sm text-primary hover:underline"
          onClick={() => setModalOpen(true)}
          type="button"
        >
          Show last recommendation
        </button>
      )}

      {modalOpen && result && (
        <RecommendationModal
          data={result}
          onClose={() => setModalOpen(false)}
          onUse={(text) => {
            applyPrompt(text);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
