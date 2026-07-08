"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";

// Circular sun/moon toggle. The theme change is revealed with a top-to-bottom
// curtain wipe rather than an instant color swap:
//  - Primary path: the View Transitions API clips the new theme's snapshot
//    in from the top (see ::view-transition-new(root) in globals.css).
//  - Fallback (no View Transitions support, e.g. Firefox): a translucent
//    overlay portaled to <body> scales down from the top over the same
//    curve/duration while the real theme flips underneath it.
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);
  const phaseRef = useRef("idle"); // "idle" | "animating" — guards double-fire
  const timeoutsRef = useRef([]);

  useEffect(() => {
    setMounted(true);
    return () => timeoutsRef.current.forEach(clearTimeout);
  }, []);

  const flip = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  const handleClick = () => {
    if (phaseRef.current !== "idle") return;
    phaseRef.current = "animating";

    if (typeof document !== "undefined" && "startViewTransition" in document) {
      const transition = document.startViewTransition(() => {
        // flushSync forces the theme class + effects to commit synchronously
        // inside the callback, so the browser's "after" snapshot already
        // reflects the new theme when it takes the screenshot.
        flushSync(flip);
      });
      transition.finished.finally(() => {
        phaseRef.current = "idle";
      });
      return;
    }

    // Fallback: theme flips immediately, hidden under the curtain overlay.
    flip();
    setOverlayActive(true);
    const hide = setTimeout(() => {
      setOverlayActive(false);
      const release = setTimeout(() => {
        phaseRef.current = "idle";
      }, 550);
      timeoutsRef.current.push(release);
    }, 550);
    timeoutsRef.current.push(hide);
  };

  if (!mounted) {
    return <div className="w-8 h-8 rounded-full" aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <>
      <button
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="flex items-center justify-center w-8 h-8 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-glass cursor-pointer transition-[color,background-color,transform] duration-150 ease-out hover:scale-110 active:scale-[0.96]"
        onClick={handleClick}
        type="button"
      >
        <span className="material-symbols-outlined text-[20px]">
          {isDark ? "light_mode" : "dark_mode"}
        </span>
      </button>
      {mounted &&
        createPortal(
          <div aria-hidden="true" className={`theme-wipe-overlay${overlayActive ? " is-active" : ""}`} />,
          document.body
        )}
    </>
  );
}
