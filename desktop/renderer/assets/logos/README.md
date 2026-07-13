# Tool logos

Drop real logo files here (SVG preferred, PNG fine) using the exact filenames
below. The Tools page looks for these automatically — if a file is missing,
that card just falls back to the existing hand-drawn glyph, so it's safe to
add them one at a time.

Served from the app's own origin (CSP already allows `img-src 'self'`), so
no CSP change is needed — just add the files.

Make sure you have the right to bundle each file (most vendors publish
brand/press-kit assets with usage terms — check those before adding one).

| File | Tool | Status |
| --- | --- | --- |
| `claude.png` | Claude (Anthropic) | ✅ added |
| `chatgpt.webp` | ChatGPT (OpenAI) | ✅ added |
| `vscode.svg` | VS Code | ✅ added |
| `cursor.png` | Cursor | ✅ added |
| `windsurf.jpeg` | Windsurf (Future integrations) | ✅ added |
| `gemini.png` | Gemini (Future integrations) | ✅ added |
| `github-copilot.png` | GitHub Copilot Chat (Future integrations) | ✅ added |
| `perplexity.webp` | Perplexity (Future integrations) | ✅ added |

The exact extension doesn't matter (the code points at whatever file is
actually there) — PNG, SVG, and WebP all work fine via `<img src>`.

Real logos get a white backing chip behind them (`.itg-tool-icon:has(.itg-tool-logo)`
in styles.css), regardless of app theme or toggle state — some brand marks
are dark, some are light, and this avoids re-sourcing a file just because it
doesn't contrast well against a particular surface color.

All 7 real logos are in. "Other / terminal" has no real brand and
intentionally keeps its generic glyph — no file needed for it.
