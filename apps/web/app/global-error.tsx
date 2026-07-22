'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Last-resort fallback if the root layout itself throws — must render its
 * own <html>/<body> per Next.js's requirement, and can't lean on the design
 * system (tokens.css/Providers) since that's exactly what may have failed.
 * error.tsx above handles every ordinary page-level error; this is the
 * rarer case underneath it.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="uz">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <main
          style={{
            display: 'flex',
            minHeight: '100dvh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Nimadir xato ketdi</h1>
          <p style={{ fontSize: '14px', color: '#666', maxWidth: '320px', margin: 0 }}>
            Ilova ishga tushmadi. Qayta urinib ko&apos;ring.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              height: '44px',
              padding: '0 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#111418',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Qayta urinish
          </button>
        </main>
      </body>
    </html>
  );
}
