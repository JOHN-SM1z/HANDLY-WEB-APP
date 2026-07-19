/**
 * Token values in JS form, for places that can't read CSS variables
 * (e.g. the PWA manifest theme color, chart libraries, canvas).
 * Keep in sync with tokens.css.
 */
export const brand = {
  50: '#e6f1fb',
  500: '#185fa5',
  600: '#12507f',
  700: '#0c447c',
  900: '#072a4d',
} as const;

export const ink = '#111418';

export const semantic = {
  successFg: '#27500a',
  successBg: '#eaf3de',
  warningFg: '#633806',
  warningBg: '#faeeda',
  dangerFg: '#791f1f',
  dangerBg: '#fcebeb',
  dangerSolid: '#e24b4a',
  infoFg: '#0c447c',
  infoBg: '#e6f1fb',
  star: '#ef9f27',
} as const;

/** Used by the PWA manifest / browser theme. */
export const themeColor = {
  light: '#fbfaf7',
  dark: '#14161a',
} as const;
