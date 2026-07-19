'use client';

import { create } from 'zustand';
import type { SessionUser } from '@handly/contracts';
import { setAccessToken } from './api';

interface SessionState {
  user: SessionUser | null;
  /** True once the initial silent-refresh bootstrap has completed. */
  ready: boolean;
  setSession: (user: SessionUser, accessToken: string) => void;
  clear: () => void;
  setReady: (ready: boolean) => void;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  ready: false,
  setSession: (user, accessToken) => {
    setAccessToken(accessToken);
    set({ user });
  },
  clear: () => {
    setAccessToken(null);
    set({ user: null });
  },
  setReady: (ready) => set({ ready }),
}));
