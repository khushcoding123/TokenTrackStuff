"use client";

import { useEffect, useState } from "react";
import { PROVIDERS, DEFAULT_PROVIDER } from "../../../src/config.js";
import { useToast } from "../components/ToastProvider";

const PROVIDER_KEY = "metriq:provider";
const MOTION_KEY = "metriq:reducedMotion";

export default function SettingsForm() {
  const { notify } = useToast();
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const storedProvider = localStorage.getItem(PROVIDER_KEY);
    const storedMotion = localStorage.getItem(MOTION_KEY) === "true";
    if (storedProvider && PROVIDERS[storedProvider]) setProvider(storedProvider);
    setReducedMotion(storedMotion);
    document.documentElement.dataset.reducedMotion = String(storedMotion);
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  const handleProviderChange = (e) => {
    const value = e.target.value;
    setProvider(value);
    localStorage.setItem(PROVIDER_KEY, value);
    notify(`Default pricing model set to ${PROVIDERS[value].label}`);
  };

  const handleMotionToggle = () => {
    const next = !reducedMotion;
    setReducedMotion(next);
    localStorage.setItem(MOTION_KEY, String(next));
    document.documentElement.dataset.reducedMotion = String(next);
    notify(next ? "Reduced motion enabled" : "Reduced motion disabled");
  };

  return (
    <div className="flex flex-col gap-stack-lg max-w-xl">
      <div className="glass-card p-6 flex flex-col gap-3">
        <h3 className="font-headline-md text-headline-md text-on-surface">Default pricing model</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Used to convert projected token counts into a $ estimate across the dashboard (e.g. Prompt Studio).
        </p>
        <select
          className="bg-surface-glass border border-border-subtle rounded-lg px-3 py-2 text-label-md font-label-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full"
          onChange={handleProviderChange}
          value={provider}
        >
          {Object.entries(PROVIDERS).map(([key, p]) => (
            <option key={key} value={key}>
              {p.label} — ${p.pricePer1M}/1M tokens
            </option>
          ))}
        </select>
      </div>

      <div className="glass-card p-6 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-headline-md text-headline-md text-on-surface">Reduced motion</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Disables pulsing/animated indicators across the dashboard (live-feed dot, status badges).
          </p>
        </div>
        <button
          aria-pressed={reducedMotion}
          className={`shrink-0 w-12 h-7 rounded-full border transition-colors relative ${
            reducedMotion ? "bg-primary/30 border-primary" : "bg-surface-container-highest border-border-subtle"
          }`}
          onClick={handleMotionToggle}
          type="button"
        >
          <span
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-on-background transition-transform ${
              reducedMotion ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
