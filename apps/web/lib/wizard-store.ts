'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WizardStep = 1 | 2 | 3;

interface WizardState {
  orderId: string | null;
  step: WizardStep;
  setOrderId: (id: string) => void;
  setStep: (step: WizardStep) => void;
  reset: () => void;
}

/**
 * Tracks only the in-progress order id + step in sessionStorage — a refresh
 * mid-wizard resumes at the right screen by refetching the order (server is
 * the source of truth for the order's own fields; see ARCHITECTURE §7).
 */
export const useOrderWizard = create<WizardState>()(
  persist(
    (set) => ({
      orderId: null,
      step: 1,
      setOrderId: (orderId) => set({ orderId }),
      setStep: (step) => set({ step }),
      reset: () => set({ orderId: null, step: 1 }),
    }),
    {
      name: 'handly-order-wizard',
      storage: {
        getItem: (name) => {
          if (typeof window === 'undefined') return null;
          const raw = sessionStorage.getItem(name);
          return raw ? JSON.parse(raw) : null;
        },
        setItem: (name, value) => sessionStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => sessionStorage.removeItem(name),
      },
    },
  ),
);
