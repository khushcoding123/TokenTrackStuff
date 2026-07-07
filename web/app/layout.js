import "./globals.css";

export const metadata = {
  title: "metriq — Focus your prompts, save your tokens",
  description:
    "Terminal-first AI assistant for vibecoders. metriq analyzes your coding prompts before they reach Cursor or Claude Code, flags broad prompts, estimates token cost, and rewrites vague prompts into focused ones — so you save tokens and keep your AI on target.",
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
    title: "metriq — Focus your prompts, save your tokens",
    description:
      "Analyze coding prompts before they reach your AI tool. Flag broad prompts, estimate token cost, and rewrite them into focused ones — right in your terminal.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#08090d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="glow" aria-hidden="true" />
        <div className="content">{children}</div>
      </body>
    </html>
  );
}
