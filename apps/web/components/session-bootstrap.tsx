'use client';

import { useEffect } from 'react';
import { authApi } from '@/lib/auth';
import { useSession } from '@/lib/session';

/** On first load, silently restore a session from the refresh cookie. */
export function SessionBootstrap() {
  const setSession = useSession((s) => s.setSession);
  const setReady = useSession((s) => s.setReady);

  useEffect(() => {
    let active = true;
    authApi
      .refresh()
      .then((res) => {
        if (active) setSession(res.user, res.tokens.accessToken);
      })
      .catch(() => {
        /* no valid session — stay logged out */
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [setSession, setReady]);

  return null;
}
