# Handly Design System — Product Usage

How the brand ([BRAND.md](BRAND.md) is the logo's source of truth) appears
inside the product. Tokens live in `packages/ui/src/tokens.css` (CSS variables,
light + dark) and are exposed to Tailwind via `packages/ui/tailwind-preset.cjs`.
Components live in `apps/web/components/ui/`.

---

## 1. Logo placement

| Context | Rule | Implementation |
|---|---|---|
| App header / navbar | Mark 30px + wordmark, top-left, links to `/home` | `<Logo size={30} withWordmark />` inside `AppHeader` |
| Auth screens | Mark 44px centered above the title | `AuthHeader` |
| Loading / splash | Mark 44–48px, centered, `animate-pulse` | root `page.tsx`, guarded screens |
| Favicon / PWA icon | The mark full-bleed | `app/icon.svg`, `manifest.webmanifest` |
| Marketing / footer | Lockup on warm paper or ink; respect clearspace | — |

Never introduce alternate marks, seasonal variants, or per-page logos.

## 2. UI colors (semantic tokens)

Always style through tokens — never hard-code hex in components. Light values
shown; dark equivalents are defined per-token in `tokens.css`.

| Token | Light | Tailwind utility |
|---|---|---|
| `--color-background-primary` | `#FBFAF7` | `bg-background` |
| `--color-background-secondary` | `#F1EFE8` | `bg-background-secondary` |
| `--color-surface` | `#FFFFFF` | `bg-surface` |
| `--color-text-primary` | `#1C1B18` | `text-content-primary` |
| `--color-text-secondary` | `#57544B` | `text-content-secondary` |
| `--color-text-muted` | `#8A8677` | `text-content-muted` |
| `--color-border-primary/secondary/tertiary` | `#CFCBBE / #E4E1D7 / #ECE9E1` | `border-border-*` |
| `--color-primary` (brand blue) | `#185FA5` | `bg-primary`, `text-primary` |
| `--color-primary-soft` / `-soft-fg` | `#E6F1FB` / `#0C447C` | `bg-primary-soft`, `text-primary-soft-fg` |
| `--color-ink` / `--color-ink-fg` | `#111418` / `#FFFFFF` | `bg-ink`, `text-ink-fg` |
| Success fg/bg | `#27500A` / `#EAF3DE` | `text-success-fg`, `bg-success-bg` |
| Warning fg/bg | `#633806` / `#FAEEDA` | `text-warning-fg`, `bg-warning-bg` |
| Danger fg/bg (+solid) | `#791F1F` / `#FCEBEB` (`#E24B4A`) | `text-danger-fg`, `bg-danger-bg` |
| Info fg/bg | `#0C447C` / `#E6F1FB` | `text-info-fg`, `bg-info-bg` |
| Star | `#EF9F27` | `text-star` |

Color discipline:
- **Ink** = primary actions and the logo tile. **Brand blue** = links, active
  nav item, selection states, focus rings, "the dot's meaning" (live/active).
- Status colors are reserved for status (badges, alerts) — never decoration.
- Order-status badge mapping: Draft `bg-gray`(neutral), Priced `info`,
  Searching `info`, Assigned/On-the-way `info`, Completed `success`,
  Urgent/Emergency `danger`, Warnings/Pending review `warning`.

## 3. Typography

Family: **Inter** with system-sans fallback (`--font-sans`); antialiased;
`text-balance` on headings; `tabular-nums` for numbers that align (timers,
money).

| Role | Size / weight | Example |
|---|---|---|
| Screen title | `text-xl font-semibold tracking-tight` | "Assalomu alaykum 👋" |
| Section label | `text-sm font-medium` | form labels |
| Overline | `text-xs uppercase tracking-wide text-content-muted` | "REFERAL KOD" |
| Body | `text-sm text-content-secondary` | descriptions |
| Caption | `text-xs text-content-muted` | footer, hints |
| Money | semibold, tabular-nums, so'm suffix | `80 000 – 160 000 so'm` |

Uzbek first, Russian second; sentence case (no ALL-CAPS except overlines).

## 4. Buttons (`components/ui/button.tsx`)

| Variant | Style | Use |
|---|---|---|
| `primary` | ink bg, white text | The one main action per screen |
| `brand` | brand-blue bg | Rare; "live" actions (e.g. call, track) |
| `soft` | soft-blue bg, deep-blue text | Secondary emphasis |
| `outline` | 1px border | Secondary / cancel |
| `ghost` | text only | Tertiary, in headers |

Sizes `sm/md/lg` (36/44/48px). Full-width on mobile forms. Loading state uses
the built-in spinner — never disable without feedback. Focus = 2px brand ring
(`focus-visible:ring-focus`) on every interactive element.

## 5. Core components

- **TextField / PasswordField** — 44px, `rounded-md`, border-secondary, leading
  icon slot, error text in `danger-fg`, focus ring brand.
- **OtpInput** — 6 boxes, auto-advance, paste support, `one-time-code`.
- **Alert** — info / success / error tinted rows with icon.
- **Badge** — `text-xs` pill, status colors per §2 mapping.
- **Card** — `bg-surface border border-border-tertiary rounded-xl shadow-card p-4/5`.
- **AuthTabs / segmented control** — active segment = ink pill.
- **Bottom nav** — 5 slots, center slot = raised ink circle "+" (new order);
  active item `text-primary`, inactive `text-content-secondary`; labels 10–11px.
- **Stepper (wizard)** — done = ink dot ✓, active = brand dot, todo = outlined
  dot, connected by hairlines (wireframe `pdot`/`pline`).
- Radius scale: `--radius-sm/md/lg/xl` = 6/10/16/24. Phone frames and modal
  sheets use `xl`.

## 6. Layout & spacing

- Mobile-first; content column `max-w-md mx-auto`; page padding `px-5`;
  vertical rhythm in 4px steps (gap-4/5/6). Desktop simply centers the column —
  never build a separate desktop IA for the PWA.
- Sticky bottom CTA on wizard steps; keep 16px safe-area padding
  (`pb-[env(safe-area-inset-bottom)]` where fixed).
- Wide content (tables, media strips) scrolls inside its own container.

## 7. Support contact (product-wide)

Numbers come **only** from `apps/web/lib/support.ts` (`SUPPORT_PHONES`) and
render via `<SupportContacts />` as tappable `tel:` links:
`+998 90 414 02 19` → `tel:+998904140219`, `+998 50 775 56 88` →
`tel:+998507755688`.

Required surfaces: auth footer, Help Center (`/help`), home footer, order help
sheet, and — when the Admin dashboard ships (M5) — Admin → Settings → Support.
Never hard-code the numbers elsewhere.

## 8. Accessibility

- Contrast ≥ 4.5:1 for text tokens on their grounds (both themes).
- Every icon-only control gets `aria-label`; alerts use `role="alert"/"status"`.
- Respect `prefers-reduced-motion` (already globally handled).
- Touch targets ≥ 44px.
