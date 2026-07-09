# Metriq Desktop — Design System

Single source of truth for the desktop app's visual redesign. Every later
phase (Navigation/Overview, Projects, Tools, Impact, Settings) implements
against this document — no new colors, type sizes, radii, or motion values
should be introduced ad hoc during those phases.

**Scope:** visual only. No IPC, business logic, or data flow described here
changes. This document only replaces `desktop/renderer/styles.css` tokens and
component patterns and restructures `desktop/renderer/index.html` markup;
`desktop/src/*.js` (main process) and the `window.metriq` preload API are
untouched by this redesign.

---

## 0. Where the desktop UI lives (inspection findings)

- **Location:** `desktop/renderer/` — `index.html`, `renderer.js`, `styles.css`,
  plus `capture.html`/`capture.js`/`capture.css` for the floating capture
  window. This is the target for the whole redesign (per your instructions,
  since the UI lives in `desktop/`, not `web/`).
- **Framework:** none. Plain HTML + vanilla JS + hand-written CSS, no build
  step, no bundler. `renderer.js` is a single IIFE that does manual DOM
  creation (`document.createElement`, `.append()`) and manual page-visibility
  toggling (`.hidden` class swaps) instead of a component/router framework.
- **Styling approach:** plain CSS with CSS custom properties already used as
  design tokens (`:root { --background, --surface, --primary, --space-*,
  --text-*, --radius-* }` in `styles.css`), toggled between dark (default)
  and a `.light` class variant. No Tailwind, no CSS Modules, no
  styled-components.
- **Component library:** none — every "component" (stat card, project row,
  tool toggle, activity item) is a hand-rolled CSS class plus inline SVG
  icons matching a Lucide/Heroicons-style stroke system (`stroke-width:
  1.75`, round caps/joins).
- **Navigation:** a fixed bottom tab bar (`.bottom-nav` / `.nav-btn`, 6 items
  after the last change: Overview, Projects, Tools, Usage, Impact, Settings)
  with plain `.hidden` class toggling between `<section class="page">`
  blocks — no router, no URL state, no history.
- **Window:** `BrowserWindow` at a fixed **480×760px** (`desktop/src/main.js`)
  — phone-sized, which is *why* a bottom tab bar was reached for originally,
  but it's the biggest structural tension in this redesign (see the sidebar
  note in §7).
- **Companion surfaces:** the web app (`web/`) is a separate Next.js +
  Tailwind project the desktop CSS already borrows palette values from
  (`--primary: #4be277` mirrors `web/app/globals.css`). This redesign keeps
  that brand continuity rather than introducing a new accent identity — see
  §1 reasoning.

Per your instructions, **not** touching `web/` in this task — everything below
targets `desktop/renderer/`.

---

## 1. Color System

All colors are CSS custom properties on `:root` (dark, the only supported
theme per the global constraint — the existing `.light` override block is
being retired in Phase 1, see §9). No pure black anywhere in the system.

| Token | Hex / Value | Purpose |
|---|---|---|
| `--bg-shell` | `#0A0B0D` | Outermost app chrome — sidebar background, window frame. The darkest layer; everything else sits visually "on top of" it. |
| `--bg-canvas` | `#0C0E11` | Main content area background, one step lighter than the shell so the content pane reads as a distinct region next to the sidebar, not a seamless continuation of it. |
| `--surface-1` | `#121417` | Default card/panel/list-row surface — elevation level 1. Where metric cards, project rows, and tool rows sit. |
| `--surface-2` | `#191C20` | Elevated surface — elevation level 2. Reserved for transient overlays: dropdowns, the capture window, modals/dialogs, toasts. Never used for persistent page chrome. |
| `--surface-hover` | `rgba(255,255,255,0.05)` | Additive hover tint, layered on top of whatever surface a row/button is on. Never a hardcoded hex, so it works identically at every elevation level. |
| `--surface-active` | `rgba(255,255,255,0.09)` | Additive pressed/selected tint — same additive principle, stronger. |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Hairline dividers inside a surface (e.g. list-row separators). |
| `--border-default` | `rgba(255,255,255,0.10)` | Card/panel/input borders — the primary "this is a bounded object" signal, doing the elevation work shadows would do in a light theme. |
| `--border-strong` | `rgba(255,255,255,0.18)` | Emphasized borders: focused inputs, the active sidebar item's rail indicator. |
| `--accent-primary` | `#34D399` | Brand accent — kept as green for continuity with the CLI (`metriq trace`) and web `/usage` dashboard, which both already use green as the "healthy/positive/action" color. Desaturated and darkened from the current `#4be277` so it reads as *precise* rather than *neon* — a deliberate pull back from glow toward restraint. |
| `--on-accent-primary` | `#06120C` | Text/icon color on top of filled `--accent-primary` surfaces (e.g. the primary button label) — near-black reads cleaner against saturated green than white does. |
| `--accent-secondary` | `#6C8EF5` | Muted indigo — the *only* other hue in the system, used exclusively for informational emphasis (focus rings, info-severity insight cards, secondary links). Keeping it separate from green means green stays semantically single-purpose ("primary action / success"), per the "color as wayfinding" principle — one hue, one meaning. |
| `--success` | `--accent-primary` (alias) | Reuses the brand green — success and "primary positive action" are the same concept in this product (e.g. "cache is working well" insights). |
| `--warning` | `#F0A93A` | Medium-severity insights (e.g. "expensive session", "premium-model-heavy spend"). Amber, not yellow — yellow fails contrast on dark surfaces at this saturation. |
| `--error` | `#F2545C` | Inline validation errors, failed IPC calls (e.g. the InsForge 401 message), high-severity insights. |
| `--destructive` | `#F2545C` (alias of `--error`) | Separate token name (not a separate value) so destructive *actions* — Logout, Remove project — can diverge from inline *error text* independently later without a values audit; today they're intentionally identical. |
| `--text-primary` | `#EDEEF0` | Primary text. Off-white, not `#FFFFFF` — reduces glare/eye strain on the near-black surfaces, standard practice for OLED-safe dark UIs. |
| `--text-secondary` | `#9CA3AE` | Supporting text: card sub-labels, project paths, session metadata. |
| `--text-tertiary` | `#6B7280` | Least emphasis: timestamps, placeholder text, hint copy. |
| `--text-disabled` | `rgba(237,238,240,0.35)` | Disabled control labels — derived from `--text-primary` at reduced opacity rather than a new hex, so it stays correct if `--text-primary` ever changes. |

**Contrast check:** `--text-primary` on `--bg-canvas`/`--surface-1`/`--surface-2`
all exceed 14:1 (AAA). `--text-secondary` on the same surfaces sits at ~6.8:1
(AAA for normal text). `--accent-primary` used as text-on-dark (e.g. a plain
"View details" link) is ~9.4:1. `--on-accent-primary` on `--accent-primary`
fill is ~14.8:1. All comfortably clear WCAG AA; most clear AAA.

---

## 2. Typography

**Fonts:**
- **UI text:** `Inter` (already loaded via the `-apple-system, "Inter", "Segoe
  UI"` stack — kept, just formalized as the deliberate choice rather than a
  fallback chain).
- **Data/metrics:** `JetBrains Mono` — new. Every numeric metric (token
  counts, USD costs, percentages, session IDs, the capture hotkey label)
  moves to this family with `font-variant-numeric: tabular-nums`, so digits
  don't shift width as they update live and columns of numbers align. This
  is the single biggest typographic upgrade: today *nothing* in the app uses
  a monospace face, so a "247" and a "1,842" in adjacent stat cards visibly
  wobble against each other. Mirrors the Vercel dashboard reference and is
  already the convention in `metriq trace`'s CLI dashboard (`trace-server.js`
  uses the same mono stack) — this makes the desktop app numerically
  consistent with its two sibling surfaces.

| Role | Font | Size | Weight | Line-height | Tracking |
|---|---|---|---|---|---|
| Page title | Inter | 22px | 700 | 1.2 | −0.01em |
| Section title | Inter | 14px | 600 | 1.3 | 0 |
| Card title | Inter | 13px | 600 | 1.35 | 0 |
| Label / eyebrow | Inter | 11px | 600 | 1.2 | +0.04em, uppercase |
| Body | Inter | 13px | 400 | 1.55 | 0 |
| Caption | Inter | 11px | 500 | 1.4 | 0 |
| Button label | Inter | 13px | 600 | 1 | 0 |
| Metric — large (stat card value) | JetBrains Mono | 24px | 600 | 1.05 | −0.01em |
| Metric — inline (table cells, costs) | JetBrains Mono | 13px | 500 | 1.4 | 0 |
| Metric — micro (badges, hotkey chip) | JetBrains Mono | 11px | 500 | 1.2 | 0 |

Rule: **weight carries hierarchy, not size alone** — e.g. card title (13px/600)
and body (13px/400) share a size but are unmistakably different roles because
of weight, keeping the scale from ballooning into too many discrete sizes.

---

## 3. Spacing

Base unit: **4px**, matching the existing `--space-1` … `--space-8` scale in
`styles.css` (kept as-is — it's already correct). One addition:

| Token | Value | Use |
|---|---|---|
| `--space-1` | 4px | Icon-to-label gaps, tight inline groups |
| `--space-2` | 8px | Row internal padding, chip padding |
| `--space-3` | 12px | Card internal padding (compact), list-item gaps |
| `--space-4` | 16px | Card internal padding (default), form field gaps |
| `--space-5` | 20px | Page horizontal padding |
| `--space-6` | 24px | Section-to-section spacing |
| `--space-8` | 32px | Major section breaks (e.g. above page footer) |
| `--space-10` *(new)* | 40px | Sidebar top padding, page-title-to-content gap on pages with a hero element (Overview's "Check a prompt" CTA) |

**Layout rhythm:** every page follows the same vertical order — page title →
primary action (if any) → stat grid → sectioned content blocks, each block
separated by `--space-6`, each block's internal header-to-content gap fixed
at `--space-2`. This rhythm is what currently exists in `index.html` already
(`.page-title`, `.stat-grid`, `.section-block`) — it's being kept, not
reinvented, and applied consistently to the pages that don't yet follow it.

---

## 4. Elevation

No drop shadows for persistent UI — borders do that job (see `--border-*` in
§1). This is a deliberate dark-mode choice: shadows read as muddy smudges on
near-black backgrounds and are expensive to tune per-surface; a 1px hairline
border reads as "this is a distinct object" more crisply at this luminance
range. Shadows are reserved for the one case borders can't handle: overlays
that need to visually separate from *everything* behind them, including
other cards.

| Level | Surface | Border | Shadow | Used for |
|---|---|---|---|---|
| 0 | `--bg-shell` / `--bg-canvas` | none | none | App chrome, page background |
| 1 | `--surface-1` | `1px solid var(--border-default)` | none | Cards, list rows, stat tiles, input fields |
| 2 | `--surface-2` | `1px solid var(--border-default)` | `0 8px 24px rgba(0,0,0,0.5)` | Modals, dropdown menus, the capture window, toasts |

**Translucency:** used exactly once — the capture window's backdrop, which
already exists as an always-on-top overlay. No blur/glass treatment anywhere
in the main window's persistent chrome (sidebar, page content); this is the
direct fix for the "excessive glassmorphism" anti-pattern called out in the
brief. Where the design references Raycast's "translucent elevation," the
translation here is: translucency signals "this floats above the app," not
"this is decoration" — so it's confined to things that literally float
(popovers, the capture window).

---

## 5. Border Radius

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 4px | Checkboxes, small tags/badges, tooltip |
| `--radius-sm` | 6px | Buttons, inputs, toggle switches, icon buttons |
| `--radius-md` | 8px | Cards, list rows, panels |
| `--radius-lg` | 10px | Modals, the capture window, popovers |

Deliberately smaller than the app's current 12–16px radii. Oversized rounded
corners are explicitly called out as an anti-pattern in the brief and are a
strong "consumer SaaS" signal (rounded pill buttons, bubbly cards); Linear
and Vercel both sit in the 6–10px range, which reads as engineered rather
than soft/toy-like while still feeling contemporary (not brutalist/sharp).

---

## 6. Motion

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 120ms | Hover tint, icon color changes, press feedback |
| `--duration-base` | 180ms | Page/tab switches, toggle state, badge appearance |
| `--duration-slow` | 260ms | Modal/overlay enter-exit, the existing theme-wipe transition (unchanged) |
| Easing (enter) | `cubic-bezier(0.2, 0, 0, 1)` | Decelerate — anything appearing/growing |
| Easing (exit) | `cubic-bezier(0.4, 0, 1, 1)` | Accelerate — anything disappearing/shrinking |

Rules:
- Exactly one element animates state at a time per interaction — no
  compound/staggered effects (this isn't a list-heavy consumer feed).
- `prefers-reduced-motion: reduce` must zero out every new transition the
  same way it already zeroes the theme-wipe curtain in `styles.css` — this is
  a blanket rule for Phase 1 onward, not a per-component decision.
- No hover-triggered layout shift, ever (no growing padding, no width
  changes) — only color/opacity/transform, consistent with the
  `transform-performance` guidance surfaced during research.

---

## 7. Navigation

**Replacing the bottom tab bar with a left sidebar.**

Why: a bottom tab bar is an iOS/Android convention carried over from mobile
where thumb reach and one-handed use matter. On desktop, the mouse has no
"reach" constraint, horizontal space is normally the abundant axis, and every
desktop-native reference in the brief (Linear, Arc, Raycast, VS Code, Slack)
puts primary navigation on the **left edge**, vertically, precisely because
it scales better as destinations grow (5 tabs → 6 tabs → future 7th is a
non-event for a sidebar list, but crowds a bottom bar further) and because it
stays out of the way of the content's natural top-to-bottom reading flow
instead of eating into the vertical space content needs.

**⚠ Flag before implementing (needs your call, not decided silently):** the
window is fixed at **480×760px**. A conventional labeled sidebar (~200px) at
that width would claim >40% of the window for navigation alone. Two options:

1. **Icon-only rail, ~64px wide**, active state shown via a left accent bar +
   filled icon + tinted background, with the destination name as a native
   OS tooltip on hover (keeps 100% of remaining width for content — net
   *more* content room than today, since the bottom bar was already costing
   vertical space in a short window).
2. **Widen the window** (e.g. 480px → 560–600px) to fit a labeled sidebar
   comfortably. This is a window-dimension change, not a logic change, so
   it's arguably in-scope for a "visual redesign" — but I'm calling it out
   explicitly rather than deciding for you, since it changes the app's
   on-screen footprint on the user's desktop.

Recommendation: **option 1** (icon rail) — it achieves the sidebar's actual
benefit (persistent, scalable, out of content's way) without a footprint
change, and labels-on-hover is exactly how VS Code's and Arc's own
icon-density sidebars behave. Proceeding with this in Phase 1 unless you'd
rather widen the window instead.

**Sidebar spec (icon rail):**
- Width: 64px, full height, `--bg-shell`, `1px solid var(--border-subtle)`
  right edge.
- Items: same 6 destinations (Overview, Projects, Tools, Usage, Impact,
  Settings), each a 44×44px hit target (meets the 44×44 minimum touch/click
  target guidance) stacked with 4px gaps.
- Icon: 20px, `--text-secondary` at rest.
- Hover: `--surface-hover` background, icon → `--text-primary`.
- Active: `--surface-1` background, icon → `--accent-primary`, plus a 2px
  `--accent-primary` vertical bar on the rail's left inner edge — the single
  strongest "you are here" signal, consistent with `nav-state-active`
  guidance (current location must be visually distinct, not just a color
  swap).
- Bottom of rail: theme toggle + avatar/identity, visually separated from the
  6 primary destinations by a `--border-subtle` divider — keeps "account
  stuff" from being confused with primary navigation (mirrors
  `destructive-nav-separation`/`nav-hierarchy` guidance: secondary controls
  shouldn't sit inline with primary destinations).
- Keyboard: full tab order through the rail before the content region;
  `Cmd/Ctrl+1..6` reserved as optional future fast-switch shortcuts (not
  required for Phase 1, noted for later since this app is meant to feel
  keyboard-first).

---

## 8. Component Patterns

### Cards (generic container)
- `--surface-1`, `--radius-md`, `1px solid var(--border-default)`,
  `--space-4` padding.
- Hover (only if the whole card is a click target, e.g. a project row):
  `--surface-hover` overlay + `border-color: var(--border-strong)`,
  `--duration-fast`.

### Metric card (stat tile)
- Same container as Card. Value in the "Metric — large" type role
  (JetBrains Mono 24px/600, tabular-nums). Label above or below the value in
  "Label / eyebrow" role (11px uppercase, `--text-tertiary`).
- Accent variant (the app's single most important number per page, e.g.
  "Tokens saved"): value color → `--accent-primary`, card border →
  `rgba(52,211,153,0.35)`, background gets a 6%-opacity accent tint. Used
  for **at most one tile per grid** — if everything is emphasized, nothing
  is.

### Buttons
| Variant | Background | Text | Border | Use |
|---|---|---|---|---|
| Primary | `--accent-primary` fill | `--on-accent-primary` | none | One per screen max — "Check a prompt", "Link a project" |
| Secondary | `--surface-1` | `--text-primary` | `1px solid var(--border-default)` | Everything else that needs a button |
| Ghost | transparent | `--text-secondary` | none | Low-emphasis actions (Cancel, Manage) |
| Destructive | transparent | `--error` | `1px solid rgba(242,84,92,0.4)` | Logout, Remove project — always visually separated (spacing, not just color) from non-destructive actions in the same view |
| Icon button | transparent | `--text-secondary` | none | Edit-name pencil, refresh — 32×32px hit area minimum even if the glyph is 16px |

All buttons: `--radius-sm`, `--duration-fast` transitions, disabled state =
`--text-disabled` color + `cursor: default` + no hover response (never just
opacity alone, so disabled is unambiguous from "loading").

### Toggle switches (Tools page)
- Track: 36×20px, `--surface-2` off / `--accent-primary` on.
- Thumb: 16px circle, `--text-primary`, moves via `transform: translateX`
  only (never animates width/left, per the motion rule in §6).
- Focus: `--border-strong` ring, 2px offset.

### Text inputs
- `--surface-1` background, `1px solid var(--border-default)`, `--radius-sm`.
- Focus: border → `--accent-secondary`, plus a 2px outer ring in
  `rgba(108,142,245,0.25)` — the indigo secondary accent's one dedicated job
  in this system is focus/informational states, so focus rings are
  immediately visually distinct from the green "success/primary" hue.
- Label always visible above the field (never placeholder-only, per
  `input-labels` guidance) — matches the existing display-name edit form's
  pattern, just restyled.

### Alerts (new — replaces raw error text)
Semantic component, one visual family, four color variants driven by a
`data-variant` attribute (`info` / `success` / `warning` / `error`):
- `--surface-1` background, `--radius-md`, `4px` left border in the
  variant's semantic color (not a full-color background — keeps the alert
  from shouting on a page that otherwise has almost no color).
- Icon (16px, variant-colored) + title (13px/600) + body (13px/400,
  `--text-secondary`) + optional action link.
- This directly replaces the current `#projects-error`/`.error-text` raw
  paragraph (Phase 2 target) and the insight cards already built for the
  Usage tab (Phase 4/Usage, restyled onto this same primitive rather than
  its bespoke `.usage-insight` class).

### Badges
- `--surface-2` background, `--radius-xs`, `2px 8px` padding, 11px/600 label,
  `--text-secondary` text unless conveying a semantic state (then variant
  color per the alert palette).

### Empty states
- Icon (24px, `--text-tertiary`) inside a 48px circle of `--surface-1`, not
  floating alone — gives the icon a "frame" instead of reading as an
  accidentally-broken image.
- Title (13px/600, `--text-primary`) + one line of supporting copy (13px/400,
  `--text-secondary`) + optional primary/secondary action button.
- `1px dashed var(--border-default)` container, `--radius-md`,
  `--space-8` padding — kept from the existing `.empty-state` pattern, which
  already does this correctly; just re-themed to the new tokens.

### Loading states / skeletons
- New pattern (none exists today — every async view either shows nothing or
  jumps straight to content/error). Skeleton blocks: `--surface-1` at 60%
  opacity with a slow (1.4s) opacity pulse between 0.6 and 1, respecting
  `prefers-reduced-motion` (falls back to a static 0.8-opacity block, no
  pulse). Shaped to match the content it's replacing (stat-card-shaped
  skeletons for stat grids, row-shaped for lists) so layout doesn't jump when
  real content arrives.

### Modals
- `--surface-2`, `--radius-lg`, elevation level 2 (border + shadow, §4).
- Enter: fade + scale from 0.97→1 over `--duration-slow` with the enter
  easing curve. Exit: reverse, but at `--duration-base` (exit shorter than
  enter, per standard motion guidance).
- Always keyboard-dismissible (`Escape`), always has an explicit close
  affordance, never used for primary navigation flows.

---

## 9. Iconography

- One stroke-based icon system throughout, continuing the app's existing
  approach (inline SVG, `stroke-width: 1.75`, round `stroke-linecap`/
  `stroke-linejoin`, no fills except small status dots) — this already
  matches Lucide/Heroicons conventions, so Phase 1+ keeps hand-rolled inline
  SVGs rather than pulling in an icon library dependency (no new deps in
  `desktop/renderer`, consistent with the project's zero-build-step
  approach).
- Two fixed sizes only: `--icon-sm` (16px, inline with text/labels) and
  `--icon-md` (20px, nav rail and primary buttons). No arbitrary in-between
  sizes.
- Never emoji, anywhere, including in insight/alert copy.
- Brand logos (Claude, ChatGPT, Cursor, VS Code icons on the Tools page,
  Phase 3) use each product's actual mark at correct proportions — not
  generic placeholder glyphs standing in for them, which is what the current
  build does (`sparkle`/`bubble`/`brackets`/`cursor` abstract paths instead
  of recognizable logos).

---

## 10. Accessibility

- **Contrast:** every text/background pairing in §1 is ≥4.5:1 for body text,
  ≥3:1 for large text (18px+/600+) and icons — verified in §1's contrast
  check.
- **Focus states:** every interactive element gets a visible focus ring
  (`--border-strong` + `--accent-secondary` outer glow per §8's text-input
  spec) — never `outline: none` without a replacement. This includes the
  sidebar rail, which today (as a bottom nav) has no visible keyboard-focus
  treatment at all.
- **Keyboard navigation:** tab order = sidebar rail → page title/primary
  action → page content, top to bottom, matching visual order. No keyboard
  traps in the capture window or any future modal (`Escape` always exits).
- **Reduced motion:** every new transition (hover tints, tab switches, modal
  enter/exit, skeleton pulse) is wrapped the same way the existing
  theme-wipe curtain already is — `@media (prefers-reduced-motion: reduce)`
  removes the transition/animation entirely, not just shortens it.
- **Color is never the only signal:** severity (insights), success/error
  (alerts) all pair color with an icon and a text label — never a bare
  colored dot or colored text alone.

---

## 11. References — what came from where, and why

- **Linear** → the elevation model (borders over shadows for persistent UI),
  the restraint on color (one primary accent, used sparingly, everything
  else neutral grays), and the tighter 6–10px radius scale. Linear's actual
  published design tokens (deep near-black background, off-white text,
  hairline borders at low white-opacity) are structurally what §1's layering
  model is built from, adapted to keep this product's existing green brand
  identity instead of Linear's purple.
- **Raycast** → confining translucency/blur to transient overlays only (the
  capture window, popovers) rather than persistent chrome, and giving the
  single primary action ("Check a prompt") outsized visual weight — same
  treatment Raycast gives its command bar as *the* thing you interact with
  first.
- **Arc** → the left-sidebar navigation decision itself, and "color as
  wayfinding" — reserving the accent hue for meaning (active state, primary
  action) rather than decoration, which is why the redesign explicitly
  avoids tinting things that don't need to be tinted.
- **Vercel Dashboard** → monospace tabular figures for every metric
  (JetBrains Mono, tabular-nums) and the general instinct that a data-dense
  developer tool should look like it's presenting *measurements*, not
  marketing copy — directly shaped §2's typography split between Inter (UI)
  and JetBrains Mono (numbers).
- **Superhuman** → the keyboard-navigation requirements in §10 and the
  general principle that every element should be intentional — no decorative
  motion, no elements that exist only to look "designed."

---

## Design tokens (implementation reference for Phase 1+)

The following replaces the `:root` block in `desktop/renderer/styles.css`.
Included here for review; **not applied yet** — Phase 1 implements this.

```css
:root {
  /* Surfaces */
  --bg-shell: #0A0B0D;
  --bg-canvas: #0C0E11;
  --surface-1: #121417;
  --surface-2: #191C20;
  --surface-hover: rgba(255, 255, 255, 0.05);
  --surface-active: rgba(255, 255, 255, 0.09);

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.10);
  --border-strong: rgba(255, 255, 255, 0.18);

  /* Accents */
  --accent-primary: #34D399;
  --on-accent-primary: #06120C;
  --accent-secondary: #6C8EF5;

  /* Semantic */
  --success: var(--accent-primary);
  --warning: #F0A93A;
  --error: #F2545C;
  --destructive: #F2545C;

  /* Text */
  --text-primary: #EDEEF0;
  --text-secondary: #9CA3AE;
  --text-tertiary: #6B7280;
  --text-disabled: rgba(237, 238, 240, 0.35);

  /* Spacing (unchanged from today, + one addition) */
  --space-1: 4px;  --space-2: 8px;   --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px;  --space-8: 32px; --space-10: 40px;

  /* Radius */
  --radius-xs: 4px; --radius-sm: 6px; --radius-md: 8px; --radius-lg: 10px;

  /* Type scale */
  --text-xs: 11px; --text-sm: 12px; --text-base: 13px; --text-md: 14px;
  --text-lg: 16px; --text-xl: 20px; --text-2xl: 22px; --text-metric: 24px;

  /* Fonts */
  --font-ui: "Inter", -apple-system, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;

  /* Motion */
  --duration-fast: 120ms;
  --duration-base: 180ms;
  --duration-slow: 260ms;
  --ease-enter: cubic-bezier(0.2, 0, 0, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);

  --icon-sm: 16px;
  --icon-md: 20px;

  color-scheme: dark;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
```

**Resolved in Phase 5:** the `:root.light` override block, the Settings-page
theme toggle, its sidebar-rail counterpart, and the supporting
`prefs:get/set-theme` IPC + curtain-wipe transition have all been removed.
The toggle stayed functional through Phases 1–4 by design; Phase 5 is where
retiring it (approved during the Phase 0 review) became a visible, explicit
change rather than something dropped silently along the way — see the
comment left in `desktop/renderer/index.html`'s Settings section and in
`styles.css` at the former `:root.light` location.
