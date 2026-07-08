"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Two themes only (no "system" option) — the toggle is a simple sun/moon
// switch, not a tri-state picker. attribute="class" matches Tailwind's
// darkMode: "class" and how globals.css keys its palettes (:root vs :root.light).
export default function ThemeProvider({ children }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      themes={["dark", "light"]}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
