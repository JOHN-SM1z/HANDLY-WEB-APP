/**
 * Shared Tailwind preset for all Handly frontends.
 * Semantic colors resolve to CSS variables (see tokens.css) so utilities are
 * theme-aware; the brand/neutral scales are also exposed as static values.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
        },
        neutral: {
          50: 'var(--neutral-50)',
          100: 'var(--neutral-100)',
          200: 'var(--neutral-200)',
          300: 'var(--neutral-300)',
          400: 'var(--neutral-400)',
          500: 'var(--neutral-500)',
          600: 'var(--neutral-600)',
          700: 'var(--neutral-700)',
          800: 'var(--neutral-800)',
          900: 'var(--neutral-900)',
        },
        background: {
          DEFAULT: 'var(--color-background-primary)',
          secondary: 'var(--color-background-secondary)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          raised: 'var(--color-surface-raised)',
        },
        content: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          inverse: 'var(--color-text-inverse)',
        },
        border: {
          DEFAULT: 'var(--color-border-secondary)',
          primary: 'var(--color-border-primary)',
          secondary: 'var(--color-border-secondary)',
          tertiary: 'var(--color-border-tertiary)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          fg: 'var(--color-primary-fg)',
          soft: 'var(--color-primary-soft)',
          'soft-fg': 'var(--color-primary-soft-fg)',
        },
        ink: {
          DEFAULT: 'var(--color-ink)',
          fg: 'var(--color-ink-fg)',
        },
        success: { fg: 'var(--color-success-fg)', bg: 'var(--color-success-bg)' },
        warning: { fg: 'var(--color-warning-fg)', bg: 'var(--color-warning-bg)' },
        danger: {
          fg: 'var(--color-danger-fg)',
          bg: 'var(--color-danger-bg)',
          solid: 'var(--color-danger-solid)',
        },
        info: { fg: 'var(--color-info-fg)', bg: 'var(--color-info-bg)' },
        star: 'var(--color-star)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
      },
      ringColor: {
        focus: 'var(--color-focus)',
      },
    },
  },
  plugins: [],
};
