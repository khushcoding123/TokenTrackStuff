"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const inputClass =
  "bg-surface-glass border border-border-subtle rounded-lg px-3 py-2 text-label-md font-label-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 18 18">
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.95 10.7a5.4 5.4 0 0 1 0-3.4V4.97H.96a9 9 0 0 0 0 8.06l2.99-2.33Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isDesktop = searchParams.get("desktop") === "1";
  const googleHref = isDesktop ? "/api/auth/google?desktop=1" : "/api/auth/google";

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    setFieldErrors({});

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, desktopHandoff: isDesktop }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFieldErrors(data.fieldErrors || {});
        setFormError(data.error || "Something went wrong. Please try again.");
        return;
      }

      if (isDesktop) {
        const params = new URLSearchParams({ token: data.token });
        if (data.refreshToken) params.set("refresh_token", data.refreshToken);
        params.set("email", data.user.email);
        if (data.user.profile?.name) params.set("name", data.user.profile.name);
        router.push(`/desktop-connected?${params.toString()}`);
        return;
      }

      const next = searchParams.get("next") || "/account";
      router.push(next);
      router.refresh();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-stack-md">
      {isDesktop && (
        <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg px-3 py-2 font-body-sm text-body-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">desktop_windows</span>
          Creating your account to finish connecting the Metriq desktop app.
        </div>
      )}

      <a
        className="flex items-center justify-center gap-2 bg-surface-glass border border-border-subtle text-on-surface px-6 py-3 rounded-lg font-label-md text-label-md hover:bg-white/5 transition-all duration-300"
        href={googleHref}
      >
        <GoogleIcon />
        Continue with Google
      </a>

      <div className="flex items-center gap-3 text-on-surface-variant/60">
        <div className="h-px flex-1 bg-border-subtle" />
        <span className="font-label-sm text-label-sm">or</span>
        <div className="h-px flex-1 bg-border-subtle" />
      </div>

      <form className="flex flex-col gap-stack-md" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          <label className="font-label-sm text-label-sm text-on-surface-variant" htmlFor="email">
            Email
          </label>
          <input
            className={inputClass}
            id="email"
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            value={email}
          />
          {fieldErrors.email && <span className="font-body-sm text-body-sm text-error">{fieldErrors.email}</span>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-label-sm text-label-sm text-on-surface-variant" htmlFor="name">
            Display name <span className="text-on-surface-variant/60">(optional)</span>
          </label>
          <input
            className={inputClass}
            id="name"
            onChange={(e) => setName(e.target.value)}
            type="text"
            value={name}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-label-sm text-label-sm text-on-surface-variant" htmlFor="password">
            Password
          </label>
          <input
            className={inputClass}
            id="password"
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            value={password}
          />
          {fieldErrors.password && (
            <span className="font-body-sm text-body-sm text-error">{fieldErrors.password}</span>
          )}
          <span className="font-body-sm text-body-sm text-on-surface-variant/70 mt-0.5">At least 6 characters.</span>
        </div>

        {formError && (
          <div className="bg-error/10 border border-error/20 text-error rounded-lg px-3 py-2 font-body-sm text-body-sm">
            {formError}
          </div>
        )}

        <button
          className="bg-primary/10 border border-primary text-primary px-6 py-3 rounded-lg font-label-md text-label-md hover:bg-primary/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
    </div>
  );
}
