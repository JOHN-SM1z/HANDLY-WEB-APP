/**
 * Handly support contacts — single source of truth (see docs/DESIGN_SYSTEM.md §7).
 * Rendered product-wide via <SupportContacts />; the future Admin settings
 * screen (M5) must read from here too. Never hard-code these numbers elsewhere.
 */
export interface SupportPhone {
  /** Human-readable, grouped form. */
  display: string;
  /** E.164 for tel: links. */
  tel: string;
}

export const SUPPORT_PHONES: SupportPhone[] = [
  { display: '+998 90 414 02 19', tel: '+998904140219' },
  { display: '+998 50 775 56 88', tel: '+998507755688' },
];
