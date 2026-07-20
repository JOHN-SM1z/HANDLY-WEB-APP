# Handly Brand — Logo Identity Rules

**This file is the single source of truth for the Handly logo.** Do not replace,
redraw, or restyle the logo anywhere in the product. Product-usage rules
(placement, spacing, components) live in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

---

## 1. Official logo

The Handly mark is an **ink rounded square** containing a white **"H" letterform**
with a **brand-blue dot** at the top right.

Canonical construction (32×32 grid — see `apps/web/components/ui/logo.tsx` and
`apps/web/app/icon.svg`, which must always stay in sync):

| Element | Spec |
|---|---|
| Tile | 32×32, corner radius **8** (25%), fill **ink `#111418`** (token `--color-ink`) |
| "H" strokes | Two verticals `x=10` and `x=17`, from `y=10` to `y=22`; crossbar `y=16` from `x=10` to `x=17`; stroke width **2.4**, round caps, color `#FFFFFF` (token `--color-ink-fg`) |
| Dot | Circle center `(22, 11.5)`, radius **2.4**, fill **brand blue `#185FA5`** (token `--color-primary`) |

```svg
<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="8" fill="#111418"/>
  <path d="M10 22V10M10 16h7M17 22V10" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="22" cy="11.5" r="2.4" fill="#185FA5"/>
</svg>
```

### Wordmark
The wordmark is the word **Handly** set in the product sans (Inter / system
stack), **semibold (600), tight tracking**, in `--color-text-primary`. The
lockup is: mark + 10px gap + wordmark, vertically centered (implemented as
`<Logo withWordmark />`). Never letterspace, outline, or italicize the wordmark.

## 2. App icon & favicon

- The app icon **is the mark itself** — full-bleed tile, no added padding, no
  extra background. Files: `apps/web/app/icon.svg` (favicon, auto-served by
  Next.js) and `public/manifest.webmanifest` (PWA icon, `theme_color` ink).
- On platforms that mask icons (iOS/Android), the tile's own radius may be
  overridden by the platform mask — that is acceptable; never pre-crop.
- Minimum favicon rendering is 16px: the dot must remain visible — never remove
  it to "simplify" small sizes.

## 3. Brand colors

| Role | Hex | Token | Use |
|---|---|---|---|
| Ink | `#111418` | `--color-ink` | Logo tile, primary buttons, wordmark on light |
| Brand blue | `#185FA5` | `--brand-500` / `--color-primary` | The dot, links, accents, active states |
| Deep blue | `#0C447C` | `--brand-700` | Text on soft-blue fills |
| Soft blue | `#E6F1FB` | `--brand-50` | Tinted fills, badges |
| Warm paper | `#FBFAF7` | `--color-background-primary` | Light app background |
| Warm surface | `#F1EFE8` | `--neutral-100` | Secondary surfaces |

The full theme-aware palette (light + dark, semantic tokens) is defined in
`packages/ui/src/tokens.css` and summarized in DESIGN_SYSTEM.md.

## 4. Meaning / story

- The **ink tile** is the home: solid, safe, dependable — the door the master
  knocks on.
- The **H** is Handly and *hunar* (craft); its two upright strokes are the
  customer and the master, joined by the crossbar — the platform.
- The **blue dot** is the verified master on the map: nearby, on the way,
  present. It sits at the top-right — the direction of progress — and is the
  only accent on the mark, which is why brand blue must stay reserved for
  meaningfully "active" things in the UI.

## 5. Do / Don't

**Do**
- Use `<Logo />` (web) or `icon.svg` — never re-draw the mark by hand.
- Place the mark on warm paper, white, or ink-adjacent dark surfaces.
- Keep clearspace of at least **the dot's diameter × 2** (≈ 15% of tile width)
  on all sides; nothing may enter it.
- Minimum sizes: mark **16px**, lockup (mark + wordmark) **24px** tall.
- In dark theme the mark's tokens flip automatically (tile renders light, "H"
  dark) via `--color-ink`/`--color-ink-fg` — that inversion is the approved
  dark-mode variant.

**Don't**
- ❌ Recolor the tile, the H, or the dot (the dot is never red, green, or ink).
- ❌ Rotate, skew, outline, add gradients, shadows, or strokes.
- ❌ Change the corner radius, stroke width, or dot position.
- ❌ Set the wordmark in another font, weight, or with letterspacing.
- ❌ Use the mark as a repeating pattern or watermark behind content.
- ❌ Place it on busy photography without an ink or paper backing tile.

## 6. Support contact (official)

Published support numbers — always rendered as tappable `tel:` links in product
(single source: `apps/web/lib/support.ts`):

- **+998 90 414 02 19** (`tel:+998904140219`)
- **+998 50 775 56 88** (`tel:+998507755688`)
