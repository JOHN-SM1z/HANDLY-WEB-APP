# Handly — Component Specifications
**Status: FINAL.** Implementation-ready specs for every UI primitive used across the approved screens. All values reference tokens in `../tokens/handly-tokens.css` (or `exports/design-tokens.json` for non-CSS stacks) — never hard-code raw hex/px where a token exists. Reference markup for every component below exists in the live screens under `../screens/`.

---

## Button
Radius `--radius-md` (10px). Font Inter, weight 600–700. Heights: sm 36 · md 44 · lg 48–52px. Horizontal padding 18–26px.

| Variant | Background | Text | Use |
|---|---|---|---|
| `primary` | `--color-ink` | `--color-ink-fg` (white) | **Default for key actions** — orange fails AA at small text sizes |
| `brand` | `--color-primary` | white | Large hero CTAs only (≥18px bold) |
| `soft` | `--color-primary-soft` | `--color-primary-soft-fg` | Low-emphasis brand action |
| `outline` | transparent, 1px `--color-border-primary` | `--color-text-primary` | Secondary action |
| `ghost` | transparent | `--color-text-secondary` | Tertiary / dismiss |

States: hover → `primary` bg `--color-primary-hover`; `ink`/others → ~90% opacity or `--color-background-secondary` tint. Focus → 2px `--color-focus` ring, 2px offset. Disabled → 60% opacity, no pointer events. Transition `--duration-fast` `--ease-standard`.

```css
.btn-primary{background:var(--color-ink);color:var(--color-ink-fg);border-radius:var(--radius-md);height:48px;padding:0 24px;font:700 16px/1 var(--font-sans)}
.btn-brand{background:var(--color-primary);color:#fff}
.btn-brand:hover{background:var(--color-primary-hover)}
```

## Card
`--color-surface` bg, 1px `--color-border-tertiary`, `--radius-lg` (16px), `--shadow-card`. Padding 14–20px (app density: 14–16, marketing: 20).

## TextField / input row
Label 14px/500 above. Row: `--radius-md`, 1px `--color-border-secondary`, height 44–48px, 12–14px horizontal padding, optional leading/trailing 18px icon in `--color-text-muted`. Focus: border → `--color-primary`, + 2px `--color-focus` ring (offset 2px, 20% opacity halo).

## Icon set
Stroke icons: 24×24 viewBox, `stroke-width:1.8`, `stroke-linecap/linejoin:round`, `fill:none`, color inherits via `currentColor`. Exception: the rating star is filled (`fill:var(--color-star); stroke:none`). Reference sheet: `../assets/icons/icon-sheet.svg` (12 icons: search, location, phone, chat, calendar, check, plumbing, electrical, cleaning, repair, home, star). Extend new icons in the same stroke style — never mix filled glyph icons into this set.

## Logo
Ink squircle (`--radius-xl`-style corner, ~22.5% of tile) + white H + orange checkmark crossbar, or bare two-tone mark. Full manifest and rules: `../BRAND.md`. Files: `../logos/`.

## Chip / badge
`--color-primary-soft` bg, `--color-primary-soft-fg` text, `--radius-full`, 10–12px semibold, ~2×8px padding. Used for "Verified" tags and promo labels.

```css
.chip-verified{background:var(--color-primary-soft);color:var(--color-primary-soft-fg);border-radius:var(--radius-full);padding:2px 8px;font:600 10px/1 var(--font-sans)}
```

## Rating
Filled `--color-star` star (14–15px) + numeric value, `--weight-semibold`, inline gap 4px.

## Bottom navigation (app)
4-column grid, 10–22px icon, 10px label. Active: `--color-primary` icon + semibold label. Inactive: `--color-text-muted` + medium label. Optional badge: `--color-primary` filled circle, white bold 9px number, positioned top-right of the icon.

## Progress / stepper
3–4px tall segmented bar, `gap:6px`, filled segment `--color-primary`, unfilled `--color-border-secondary`, `border-radius:2px` per segment.

## Timeline (route / status list)
20px node column, 2px connector line `--color-border-secondary`. States:
- **Done:** filled `--color-success-bg` circle + `--color-success-fg` check, row content at 65% opacity with strikethrough title.
- **Active:** filled `--color-primary` dot (7px inner) with a 4px `--color-primary-soft` halo ring; row border upgrades to 1.5px `--color-primary` + `--shadow-card`.
- **Upcoming:** 2px outline circle `--color-border-primary`, plain row.

## Toggle (online/offline)
Pill track 38×22px. On: `--color-primary` track, knob at right (`left:18px`). Off: `rgba(255,255,255,.25)` track (on dark header) or `--color-border-secondary` (on light), knob at left (`left:2px`). Knob 18px white circle. Transition `--duration-normal`.

## Booking / request card (composite)
`--color-surface`, 1.5px `--color-primary` border, `--radius-lg`, `--shadow-pop`. Header strip `--color-primary-soft` bg with status dot + label + countdown/meta. Body: icon chip (42px, `--radius-md`, `--color-primary-soft`) + title/meta + trailing price. Footer: two actions (`outline` decline + `primary`/brand accept) or a single full-width CTA depending on flow step.

---
Full token reference: `../tokens/handly-tokens.css` · `../exports/design-tokens.json`. Screen-level composition of these components: `../screens/`.
