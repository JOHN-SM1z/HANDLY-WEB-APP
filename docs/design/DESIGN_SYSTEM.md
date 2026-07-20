# Handly — Design System
**Status: FINAL — approved source of truth for all Handly product surfaces.**

Built on the **Handly Design System** starter (Inter, warm-neutral surfaces, ink/orange roles, mobile-first PWA at ~375–390px). The brand ramp is re-toned from the starter's blue to **Handly Orange** under identical token names, so the system stays structurally compatible while the brand reads warm and human. All values ship as CSS custom properties in **`handly-tokens.css`** — import it in every screen and use `var(--token)`; never hard-code a hex, size, or radius the tokens already carry.

---

## Color

### Brand — Handly Orange
`--brand-50 … --brand-900` · base **`--brand-500 #F26A1B`**, hover `--brand-600 #DD560F`.
`50/100/200` for soft fills & chips · `500` for the mark, icons, highlights · `600–700` for pressed/hover · `700+` for orange text on light.

### Ink & neutrals
`--ink #111418` · `--neutral-50 … --neutral-900` (warm stone `#FAF9F6` → `#1C1B18`).

### Semantic roles
| Token | Value | Use |
|---|---|---|
| `--color-primary` / `-hover` / `-fg` | `#F26A1B` / `#DD560F` / `#FFFFFF` | Brand actions, accents |
| `--color-primary-soft` / `-soft-fg` | `#FFE9D8` / `#8F3410` | Tinted chips, badges |
| `--color-ink` / `-fg` | `#111418` / `#FFFFFF` | **Primary buttons**, dark surfaces |
| `--color-surface` / `-raised` | `#FFFFFF` | Cards |
| `--color-background-primary` / `-secondary` | `#FBFAF7` / `#F1EFE8` | Page grounds |
| `--color-text-primary` / `-secondary` / `-muted` / `-inverse` | `#1C1B18` / `#57544B` / `#8A8677` / `#FFFFFF` | Text hierarchy |
| `--color-border-primary` / `-secondary` / `-tertiary` | `#CFCBBE` / `#E4E1D7` / `#ECE9E1` | Dividers, card edges |
| `--color-success` / `-warning` / `-danger` (`-bg`/`-fg`), `--color-danger-solid` | — | Status |
| `--color-star` | `#EF9F27` | Rating stars |
| `--color-focus` | `#F26A1B` | Focus rings |

**Contrast rule:** vibrant orange can't carry small white text at AA. So **primary buttons are ink (charcoal) + white**; orange is the accent everywhere else. Reserve white-on-orange for large (≥18px bold) hero CTAs only. This is a deliberate, final decision — not an oversight.

---

## Typography

**Inter** (`--font-sans`), `--font-mono` for codes/IDs.

| Token | Size | Typical use |
|---|---|---|
| `--text-xs` | 12 | Labels, captions |
| `--text-sm` | 14 | Body, controls |
| `--text-base` | 16 | Body large |
| `--text-lg` | 18 | Section titles |
| `--text-xl` | 20 | Screen titles |
| `--text-2xl` | 24 | Page headers |
| `--text-3xl` | 30 | Hero (app) |

Weights: `--weight-regular 400`, `medium 500`, `semibold 600`, `bold 700`. Line-height: `--leading-tight 1.2` (headings) · `--leading-normal 1.5` (UI) · `--leading-relaxed 1.6` (reading). Headings track −0.01 to −0.03em. *Marketing display type (40–76px, as used on the landing hero) is an allowed extension of the scale, Inter Bold, same tracking rule.*

---

## Spacing & layout

4px base: `--space-1 4` · `2 8` · `3 12` · `4 16` · `5 20` · `6 24` · `8 32` · `10 40` · `12 48` · `16 64`.

- **App (mobile) screens:** single-column phone frame, content column **`--container-max 448px`**, screen padding `20`, card padding `14–16`.
- **Marketing (desktop) pages:** content max-width **1160px**, section vertical rhythm 64–96px, grid `gap` 14–20px.

## Radius & elevation
`--radius-sm 6` (chips) · `md 10` (buttons, inputs) · `lg 16` (cards) · `xl 24` (feature panels, app-icon tile) · `full` (pills, avatars).
`--shadow-card` (resting surfaces) · `--shadow-pop` (menus, sheets, app icon, phone frame). Motion: `--duration-fast 120ms` / `--duration-normal 180ms`, `--ease-standard`.

---

## Components

| Component | Spec |
|---|---|
| **Button** | radius-md, Inter 500–700, heights sm 36 / md 44 / lg 48–52. Variants: **primary** (ink + white — default for key actions), **brand** (orange + white, large/hero CTAs only), **soft** (orange-soft bg), **outline** (border-primary), **ghost**. |
| **Card** | surface bg, 1px `border-tertiary`, radius-lg, `shadow-card`, padding 14–20. |
| **TextField / input row** | label 14/500, row radius-md border-secondary → `--color-primary` on focus (+2px focus ring), input/row height 44–48, optional leading/trailing icon. |
| **Icon** | Stroke set — 24 viewBox, 1.8px stroke, round caps/joins, `currentColor`. Filled only for the rating star. Reference sheet: `docs/design/assets/icons/icon-sheet.svg`. |
| **Logo** | Ink squircle + H + orange check, or bare mark. `withWordmark` → "Handly" 700–800. See `BRAND.md` for full asset manifest. |
| **Chip / badge** | orange-soft bg + `-soft-fg` text, radius-full, 10–12px, used for "Verified" and promos. |
| **Rating** | `--color-star` filled star + value in `--weight-semibold`. |
| **Bottom nav (app)** | 4 items, active = `--color-primary` + semibold label, inactive = `--color-text-muted` + medium label, 10px labels, icons 22px. |
| **Progress / stepper** | 3–4px segmented bar, filled segments `--color-primary`, unfilled `--color-border-secondary`. |
| **Timeline (route/status)** | 20px node column, done = filled `--color-success-bg` check, active = pulsing `--color-primary` dot with soft ring, upcoming = outline circle; 2px connecting line in `--color-border-secondary`. |

### Interaction states
Hover: brand → `--color-primary-hover`, ink → ~90% opacity, subtle bg on ghost/outline. Focus: 2px `--color-focus` ring, 2px offset. Disabled: 60% opacity, no pointer. Respect `--duration-fast` / `--duration-normal` with `--ease-standard`.

**Full implementation-ready spec (variants, states, CSS snippets) for every component: `components/COMPONENTS.md`.**

---

## Screens (finalized, canonical — project root)

| File | Frame | Key states |
|---|---|---|
| `Handly Landing.dc.html` | Desktop, 1160px content | Hero + live booking widget, service grid, 3-step explainer, trust/guarantee panel, master-recruitment CTA, footer |
| `Handly Customer Home.dc.html` | Mobile, 390×812 phone frame | Active booking tracker, service grid, top-masters list, promo, bottom nav |
| `Handly Service Request.dc.html` | Mobile, 390×812 phone frame | 3-step flow (problem → time/address → price+master confirm) with working state, progress bar, success screen |
| `Handly Master Dashboard.dc.html` | Mobile, 390×812 phone frame | Online/offline toggle, live incoming-request accept/decline with countdown, today's route timeline, weekly earnings chart |
| `Handly Logo.dc.html` | Spec sheet | Hero lockup, anatomy/clear-space, two-tone & mono, app-icon tiles, favicon + responsive scale |

Responsive rule for future screens: **mobile app UI** designs to the 390px phone frame at `--container-max 448px`; **marketing/web** designs to the 1160px desktop grid and should degrade to the same mobile frame conventions below ~600px (stack the grid columns, keep 20px side padding).

---

## Files — permanent source of truth
This is the complete, current map of `docs/design/`. Nothing here is provisional; implement strictly from these files — do not redesign or guess undocumented values.

```
docs/design/
  BRAND.md                        — brand rules, logo rules, color psychology, asset manifest
  DESIGN_SYSTEM.md                — this file: tokens, type, spacing, components (overview), screens
  components/
    COMPONENTS.md                 — implementation-ready spec for every component (variants, states, CSS)
  tokens/
    handly-tokens.css             — the token stylesheet (source of every var(--*) used)
  logos/                          — all logo/app-icon artwork (see BRAND.md manifest for the full list)
    handly-mark.svg, handly-lockup.svg, handly-icon-ink|orange|light.svg,
    handly-mono-black|white.svg, favicon.svg, png/icon-ink-1024|512|192|180.png,
    png/favicon-32|16.png, png/icon-orange-512.png, png/icon-light-512.png,
    png/mark-transparent-512.png
  assets/
    icons/icon-sheet.svg          — UI stroke-icon reference sheet
  screens/                        — reference copies of every finalized screen (read-only reference;
                                     paths patched to resolve tokens at ../tokens/handly-tokens.css)
    Handly Landing.dc.html, Handly Customer Home.dc.html, Handly Service Request.dc.html,
    Handly Master Dashboard.dc.html, Handly Logo.dc.html
    *.png                          — flat screenshots of each screen at its designed size
  exports/
    design-tokens.json            — machine-readable copy of every token (color/type/spacing/radius/shadow/motion/layout)
    MANIFEST.md                   — flat index of every file in docs/design/ with a one-line description
```

**Note on `.dc.html` files under `screens/`:** these are Design Component source — real HTML/CSS markup (inline-styled, CSS-variable-driven), not a proprietary format. Open and read them as plain HTML to lift exact markup, styles, and structure. They are reference copies; the live/editable originals remain at the project root of the design tool this system was authored in.

Project root of the authoring project (live, interactive — not part of the repo handoff):
```
handly-tokens.css               — same token file as tokens/handly-tokens.css
Handly Logo.dc.html, Handly Landing.dc.html, Handly Customer Home.dc.html,
Handly Service Request.dc.html, Handly Master Dashboard.dc.html  — live originals
Handly Brand Identity.dc.html   — ARCHIVED: original 5-concept exploration (Modernist DS). Superseded; kept for history only, not part of the final system.
```
