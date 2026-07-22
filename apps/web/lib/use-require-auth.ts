'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { Role } from '@handly/contracts';
import { useSession } from './session';

/**
 * Redirect to /login once the bootstrap finished and no session exists.
 * With `requiredRole` (Batch 3 admin pages), an authenticated user of the
 * wrong role is redirected to /home instead — they're not unauthenticated,
 * just not authorized for this screen.
 */
export function useRequireAuth(requiredRole?: Role) {
  const router = useRouter();
  const ready = useSession((s) => s.ready);
  const user = useSession((s) => s.user);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login');
    } else if (requiredRole && user.role !== requiredRole) {
      router.replace('/home');
    }
  }, [ready, user, requiredRole, router]);

  return { ready, user };
}
