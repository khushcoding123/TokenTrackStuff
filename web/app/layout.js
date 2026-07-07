import "./globals.css";
import ToastProvider from "./components/ToastProvider";

export const metadata = {
  title: {
    default: "Metriq",
    template: "%s — Metriq",
  },
  description:
    "Terminal-first AI assistant for vibecoders. Metriq analyzes your coding prompts before they reach Cursor or Claude Code, flags broad prompts, estimates token cost, and rewrites vague prompts into focused ones — so you save tokens and keep your AI on target.",
  keywords: [
    "AI coding",
    "token usage",
    "prompt optimization",
    "Claude Code",
    "Cursor",
    "developer tools",
    "CLI",
  ],
  openGraph: {
    title: "Metriq — Focus your prompts, save your tokens",
    description:
      "Analyze coding prompts before they reach your AI tool. Flag broad prompts, estimate token cost, and rewrite them into focused ones — right in your terminal.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#0B0F14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html className="dark" lang="en">
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
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
