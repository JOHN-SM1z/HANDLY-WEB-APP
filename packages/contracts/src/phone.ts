import { z } from 'zod';

/**
 * Uzbekistan phone numbers in E.164: +998 followed by 9 digits.
 * We normalize common input shapes (spaces, dashes, leading 00/8) before validating.
 */
export const UZ_PHONE_REGEX = /^\+998\d{9}$/;

export function normalizeUzPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  let normalized = digits;

  if (normalized.startsWith('00')) normalized = `+${normalized.slice(2)}`;
  if (normalized.startsWith('998')) normalized = `+${normalized}`;
  // A bare 9-digit national number -> assume UZ.
  if (/^\d{9}$/.test(normalized)) normalized = `+998${normalized}`;

  return UZ_PHONE_REGEX.test(normalized) ? normalized : null;
}

export const uzPhoneSchema = z
  .string()
  .trim()
  .transform((val, ctx) => {
    const normalized = normalizeUzPhone(val);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Telefon raqami noto'g'ri. Namuna: +998 90 123 45 67",
      });
      return z.NEVER;
    }
    return normalized;
  });
