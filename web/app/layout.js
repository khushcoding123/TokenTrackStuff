import "./globals.css";
import ToastProvider from "./components/ToastProvider";
import ThemeProvider from "./components/ThemeProvider";

export const metadata = {
  title: {
    default: "Metriq",
    template: "%s | Metriq",
  },
  description:
    "Metriq is an AI coding companion that analyzes your prompts against your real codebase before they reach Claude, ChatGPT, Cursor, or VS Code. It flags broad prompts, estimates token cost, and rewrites vague prompts into focused ones.",
  keywords: [
    "AI coding",
    "token usage",
    "prompt optimization",
    "Claude Code",
    "Cursor",
    "developer tools",
    "desktop app",
  ],
  openGraph: {
    title: "Metriq focuses your prompts and saves your tokens",
    description:
      "Analyze coding prompts against your real codebase before they reach your AI tool. Flag broad prompts, estimate token cost, and rewrite them into focused ones.",
    type: "website",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0F14" },
    { media: "(prefers-color-scheme: light)", color: "#F5F7FA" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: next-themes sets the light/dark class on
    // <html> via a blocking inline script before hydration (to avoid a
    // flash of the wrong theme), which legitimately differs from whatever
    // the server rendered.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link crossOrigin="" href="https://fonts.gstatic.com" rel="preconnect" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-background font-body-md text-body-md antialiased">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
