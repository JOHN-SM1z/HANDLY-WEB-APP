import { withSentryConfig } from '@sentry/nextjs';

// Derive the API's http(s) + ws(s) origins from the same env var the app
// itself calls (lib/api.ts / lib/socket.ts), so the CSP never drifts out of
// sync with what the app actually connects to across dev/staging/prod.
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const apiOrigin = new URL(apiUrl).origin;
const apiWsOrigin = apiOrigin.replace(/^http/, 'ws');

// Sentry (if configured) posts events to a per-project ingest host embedded
// in the DSN itself — e.g. https://<key>@o123.ingest.us.sentry.io/456.
// Parsed here rather than hardcoded so this doesn't silently break (or
// silently stay untuned) if the DSN's org/region ever changes.
let sentryConnectSrc = '';
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    sentryConnectSrc = ` ${new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).origin}`;
  } catch {
    // Malformed DSN — Sentry.init() itself will no-op/warn; CSP just omits it.
  }
}

// Live GPS map (real-time GPS feature) — same "only widen CSP when the
// feature is actually configured" shape as Sentry above. Yandex Maps JS API
// loads its bootstrap script from api-maps.yandex.ru and fetches map tiles
// from the *.maps.yandex.net subdomain family; both are only reachable once
// NEXT_PUBLIC_YANDEX_MAPS_API_KEY is set (empty in dev is a no-op — the map
// component renders a "not configured" placeholder instead of a live map).
const yandexMapsScriptSrc = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY
  ? ' https://api-maps.yandex.ru'
  : '';
const yandexMapsConnectSrc = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY
  ? ' https://api-maps.yandex.ru https://*.maps.yandex.net'
  : '';
const yandexMapsImgSrc = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY
  ? ' https://*.maps.yandex.net'
  : '';

// 'unsafe-inline' on script/style is a pragmatic default for a Next.js App
// Router app without nonce-based CSP middleware (Next injects small inline
// bootstrap/hydration scripts and Tailwind/font inline styles). Tightening
// this to a nonce + 'strict-dynamic' is a real follow-up, not done here —
// it requires a middleware.ts issuing a per-request nonce end-to-end.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${yandexMapsScriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${yandexMapsImgSrc}`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${apiWsOrigin}${sentryConnectSrc}${yandexMapsConnectSrc}`,
  `media-src 'self' ${apiOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Both workspace packages must be transpiled by Next: @handly/ui ships TS
  // source, and @handly/contracts' CommonJS build otherwise trips Fast Refresh
  // ("Cannot use 'import.meta'") when imported into client components in dev.
  transpilePackages: ['@handly/ui', '@handly/contracts'],
  // Batch 4 added a real ESLint config + a dedicated CI lint job — build-time
  // linting stays off here so it isn't run twice (and to keep build times
  // down); CI is what actually gates merges on lint failures.
  eslint: { ignoreDuringBuilds: true },
  // Batch 4: standalone output traces only the node_modules this app
  // actually needs into .next/standalone — the Docker image copies that
  // instead of the full monorepo node_modules tree.
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

// Required, not cosmetic: without this wrapper, Sentry's Next.js SDK has no
// way to tell webpack which of its own submodules are server-only — the
// client bundle ends up pulling in @sentry/node's Node-only instrumentation
// (require-in-the-middle, @opentelemetry/instrumentation) alongside it,
// which references __dirname/process.binding and throws when actually
// executed in a browser, breaking client hydration on every page. Source-map
// upload (org/project/authToken) is left unset — with no SENTRY_AUTH_TOKEN
// the plugin skips the upload step rather than failing the build.
export default withSentryConfig(nextConfig, { silent: true });
