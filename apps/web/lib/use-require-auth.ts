'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from './session';

/** Redirect to /login once the bootstrap finished and no session exists. */
export function useRequireAuth() {
  const router = useRouter();
  const ready = useSession((s) => s.ready);
  const user = useSession((s) => s.user);

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  return { ready, user };
}
