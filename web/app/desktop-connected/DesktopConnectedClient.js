"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function DesktopConnectedClient() {
  const searchParams = useSearchParams();
  const [callbackUrl, setCallbackUrl] = useState(null);
  const [missing, setMissing] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setMissing(true);
      return;
    }

    const params = new URLSearchParams({ token });
    const refreshToken = searchParams.get("refresh_token");
    const email = searchParams.get("email");
    const name = searchParams.get("name");
    if (refreshToken) params.set("refresh_token", refreshToken);
    if (email) params.set("email", email);
    if (name) params.set("name", name);
    const url = `metriq://auth-callback?${params.toString()}`;
    setCallbackUrl(url);

    // Scrub the token out of the visible address bar / this tab's history
    // entry now that we've read it — it's already on its way to the OS via
    // the metriq:// redirect below, no reason to leave it sitting here too.
    window.history.replaceState({}, "", "/desktop-connected");

    if (!attempted.current) {
      attempted.current = true;
      window.location.href = url;
    }
  }, [searchParams]);

  if (missing) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <h2 className="font-headline-lg text-headline-lg text-on-background">Nothing to connect</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          This page is used to hand a session back to the Metriq desktop app. Open it by clicking "Log in" from
          inside the app.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-stack-md text-center">
      <div className="w-12 h-12 rounded-full bg-primary/15 border border-border-subtle flex items-center justify-center text-primary">
        <span className="material-symbols-outlined">check_circle</span>
      </div>
      <h2 className="font-headline-lg text-headline-lg text-on-background">You've successfully logged in</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Taking you back to the Metriq desktop app now. You can close this tab once it opens — if nothing happens
        after a few seconds, click below to finish connecting.
      </p>
      {callbackUrl && (
        <a
          autoFocus
          className="bg-primary text-on-primary px-6 py-3 rounded-lg font-label-md text-label-md hover:opacity-90 transition-all duration-300 w-full"
          href={callbackUrl}
        >
          Open Metriq
        </a>
      )}
    </div>
  );
}
