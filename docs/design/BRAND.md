# Handly — Brand Guidelines
**Status: FINAL — approved source of truth.** Supersedes all earlier concept explorations (see `Handly Brand Identity.dc.html` at the project root, kept only as historical record of the 5-concept process).

**Handly** connects people with verified home-service professionals — plumbers, electricians, cleaners, technicians, and repair specialists. Built for Uzbekistan, designed to scale globally.

> **The one feeling:** *"I can trust this platform to fix problems in my home."*

---

## Brand personality

Handly is the **calm, competent professional** you're relieved to let into your home.

| Trait | We are | We are **not** |
|---|---|---|
| **Trustworthy** | Verified, transparent, accountable | Vague, anonymous, "at your own risk" |
| **Warm** | Human, friendly, on your side | Corporate, cold, transactional |
| **Confident** | Clear, decisive, "handled" | Loud, gimmicky, over-promising |
| **Practical** | Fast, upfront pricing, no fuss | Bureaucratic, hidden fees |
| **Local** | Rooted in the neighborhood | Faceless global platform |

**Voice:** plain-spoken and reassuring. Short sentences. Say what happens next. Lead with the customer's problem, not our features. Never hype — competence *is* the pitch.

- ✅ "A verified plumber, at your door in 60 minutes."
- ✅ "See the price before you book. No surprises."
- ❌ "Revolutionizing the home-services ecosystem."

---

## The logo

The mark is an **H whose crossbar rises into a checkmark** — the brand letter and the single promise (*verified*) fused into one shape. Two equal charcoal/ink or white stems (the H = structure, stability) + one orange checkmark stroke (the crossbar = verified, done). Single stroke weight, rounded terminals for warmth.

Master source: **`Handly Logo.dc.html`** (project root) — the interactive spec sheet (construction, clear space, tile variants, favicon scale). Flat, production-ready files are exported below.

### Logo rules
- **Primary lockup:** ink stems + orange check, wordmark "Handly" in Inter Extra-Bold, −0.03em tracking. File: `handly-lockup.svg`.
- **App icon:** ink (charcoal `#111418`) squircle, white H, orange check — the default tile. File: `handly-icon-ink.svg` / `png/icon-ink-*.png`.
- **Clear space:** keep space equal to the checkmark's height clear on all sides.
- **Minimum size:** 16px (favicon) for the mark; 88px wide for the full lockup.
- **Monochrome:** all-ink on light (`handly-mono-black.svg`), all-white on dark (`handly-mono-white.svg`).

### Never
- ❌ Recolor the stems (they stay ink/white — only the check carries brand color).
- ❌ Add gradients, bevels, drop shadows, or outline the mark.
- ❌ Stretch, rotate, or reposition the checkmark.
- ❌ Place the two-tone mark on a busy photo without a solid chip behind it.
- ❌ Recreate the H with a different letterform — use the supplied artwork only.

### Asset manifest — `docs/design/logos/`
| File | Use |
|---|---|
| `handly-mark.svg` | Mark only, transparent, two-tone (ink + orange) |
| `handly-lockup.svg` | Mark + "Handly" wordmark, horizontal |
| `handly-icon-ink.svg` | App icon — ink tile (primary) |
| `handly-icon-orange.svg` | App icon — orange tile (alt) |
| `handly-icon-light.svg` | App icon — white tile (alt, light contexts) |
| `handly-mono-black.svg` / `handly-mono-white.svg` | Single-color reproduction |
| `favicon.svg` | Scalable favicon (browsers that support SVG favicons) |
| `png/icon-ink-1024\|512\|192\|180.png` | Raster app icon — App Store / Play / Android / iOS touch sizes |
| `png/favicon-32\|16.png` | Raster favicon sizes |
| `png/icon-orange-512.png`, `png/icon-light-512.png` | Raster alt tiles |
| `png/mark-transparent-512.png` | Mark only, no tile, transparent background |
| `../assets/icons/icon-sheet.svg` | Reference sheet of the UI stroke-icon style (see Design System) |

---

## Color psychology

| Role | Color | Why |
|---|---|---|
| **Handly Orange** `#F26A1B` | Energy, warmth, action, human friendliness | The spark that says *go* — reserved for the mark, primary actions, and key highlights. |
| **Charcoal / Ink** `#111418`–`#1C1B18` | Trust, professionalism, stability | The base voice — type, the H, dark surfaces, and primary buttons. |
| **Warm paper** `#FBFAF7` | Space, clarity, calm | Generous ground so price and mark always breathe. |
| **Stone neutrals** | Quiet, dependable structure | Secondary text, borders, and dividers — never competes with orange. |

Orange is used **sparingly and on purpose**. In any screen, most of the surface is ink-on-paper; orange marks the one thing that matters most right now. Two brand colors, endless whitespace.

*Palette note: the bound Handly Design System starter ships a blue primary. This brand intentionally overrides it to **vibrant orange + charcoal** — same token names, re-toned values — documented fully in `DESIGN_SYSTEM.md`. This override is final; do not revert to blue.*

---

## Where everything lives
See `DESIGN_SYSTEM.md` → **Files** for the complete, current map of `docs/design/`.
