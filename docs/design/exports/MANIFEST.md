# docs/design/ — File Manifest
Flat index of every file in this folder. This entire directory is the **permanent source of truth** for Handly's brand and UI — copy it as-is into `HANDLY WEB APP/docs/design/`.

## Root
- `BRAND.md` — brand personality, logo rules, color psychology, logo asset manifest
- `DESIGN_SYSTEM.md` — colors, typography, spacing, radius/elevation, components overview, screen specs, full file map

## components/
- `COMPONENTS.md` — implementation-ready spec per component: Button, Card, TextField, Icon set, Logo, Chip, Rating, Bottom nav, Progress, Timeline, Toggle, Booking card — variants, states, sizing, CSS reference snippets

## tokens/
- `handly-tokens.css` — the token stylesheet; every `var(--*)` used anywhere in the system is defined here (colors, type, spacing, radius, shadow, motion)

## logos/
- `handly-mark.svg` — mark only, transparent, two-tone (ink stems + orange check)
- `handly-lockup.svg` — mark + "Handly" wordmark, horizontal
- `handly-icon-ink.svg` — app icon, ink tile (primary/default)
- `handly-icon-orange.svg` — app icon, orange tile (alt)
- `handly-icon-light.svg` — app icon, white tile (alt)
- `handly-mono-black.svg` / `handly-mono-white.svg` — single-color reproduction
- `favicon.svg` — scalable favicon
- `png/icon-ink-1024.png` / `-512.png` / `-192.png` / `-180.png` — raster app icon (App Store / Play / Android / iOS)
- `png/favicon-32.png` / `favicon-16.png` — raster favicons
- `png/icon-orange-512.png` / `icon-light-512.png` — raster alt tiles
- `png/mark-transparent-512.png` — mark only, no tile, transparent

## assets/icons/
- `icon-sheet.svg` — reference sheet of the UI stroke-icon style (12 icons, labeled)

## screens/
Reference copies of every finalized screen (relative token path patched to `../tokens/handly-tokens.css`) plus a flat screenshot of each:
- `Handly Landing.dc.html` + `landing.png` — desktop marketing landing page
- `Handly Customer Home.dc.html` + `customer-home.png` — mobile customer home (390×812)
- `Handly Service Request.dc.html` + `service-request.png` — mobile 3-step booking flow (390×812)
- `Handly Master Dashboard.dc.html` + `master-dashboard.png` — mobile master/pro dashboard (390×812)
- `Handly Logo.dc.html` + `logo-sheet.png` — logo construction/anatomy spec sheet

`.dc.html` files are plain inline-styled HTML/CSS — open and read them directly; no proprietary tooling required.

## exports/
- `design-tokens.json` — every token in machine-readable form (color, typography, spacing, radius, shadow, motion, layout) for non-CSS consumption (build scripts, design-token pipelines, native apps)
- `MANIFEST.md` — this file

---
**Total: 2 top-level docs + 1 component spec + 1 token sheet + 16 logo files + 1 icon sheet + 10 screen files (5 source + 5 screenshots) + 2 export files = 33 files.**
