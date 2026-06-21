// Design tokens — colors.
//
// These are derived from the hex values already scattered across the screens so
// the palette matches today's UI exactly. New code should import from here
// (`colors.primary`) instead of hardcoding hex; existing screens can migrate
// gradually. Nothing breaks by adding this file.

// Raw palette — the actual hues. Prefer the semantic names below in components.
const palette = {
  // Brand blues — from the Healthadri pinwheel logo (cyan family). Deepened from
  // the raw logo cyan so white text on primary surfaces keeps enough contrast.
  brandBlue900: '#0C4A66', // darkest — splash, dark backgrounds
  brandBlue800: '#11607F', // dark blue — headings on light surfaces
  brandBlue600: '#1B8FBF', // primary brand
  brandBlue100: '#E6F4FB', // light tint — selected/brand-bg surfaces
  brandBlue50: '#F1F9FD', // faint blue page background

  // Brand accents — from the Healthadri pinwheel logo (cyan + yellow).
  cyan500: '#29ABE2', // logo cyan
  cyan100: '#E8F6FD', // light cyan tint
  yellow500: '#F7B500', // logo yellow
  yellow100: '#FEF6E0', // light yellow tint

  // Status / semantic hues
  red500: '#EF4444',
  red100: '#FEE2E2',
  green: '#16A34A', // success-600
  green500: '#22C55E',
  greenBg: '#DCFCE7', // success-100
  amber500: '#F59E0B',
  amber600: '#D97706',
  amber100: '#FEF3C7',
  blue600: '#2563EB',
  blue50: '#EFF6FF',
  violet600: '#7C3AED',

  // Neutral / slate scale
  white: '#FFFFFF',
  slate50: '#F8FAFC',
  gray50: '#F9FAFB',
  bgGray: '#F4F6F8',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate500: '#64748B',
  slate400: '#94A3B8',
  taupe: '#9A9186',
  navy: '#1A1A2E',
  black: '#000000',
};

export const colors = {
  // Brand
  primary: palette.brandBlue600,
  primaryDark: palette.brandBlue800,
  primaryDarkest: palette.brandBlue900,
  primaryTint: palette.brandBlue100,
  primarySurface: palette.brandBlue50,

  // Brand accents (logo cyan + yellow)
  accent: palette.cyan500,
  accentTint: palette.cyan100,
  accentWarm: palette.yellow500,
  accentWarmTint: palette.yellow100,

  // Accents
  accentBlue: palette.blue600,
  accentBlueTint: palette.blue50,
  accentViolet: palette.violet600,

  // Semantic
  success: palette.green,
  successStrong: palette.green500,
  successTint: palette.greenBg,
  warning: palette.amber500,
  warningStrong: palette.amber600,
  warningTint: palette.amber100,
  danger: palette.red500,
  dangerTint: palette.red100,

  // Surfaces / backgrounds
  background: palette.bgGray,
  backgroundAlt: palette.gray50,
  surface: palette.white,
  surfaceMuted: palette.slate50,
  surfaceSubtle: palette.slate100,

  // Text
  textPrimary: palette.brandBlue800,
  textBody: palette.navy,
  textSecondary: palette.slate500,
  textMuted: palette.slate400,
  textTaupe: palette.taupe,
  textOnPrimary: palette.white,

  // Borders / dividers
  border: palette.slate200,
  borderStrong: palette.slate400,

  // Misc
  white: palette.white,
  black: palette.black,
  overlay: 'rgba(0,0,0,0.5)',
  transparent: 'transparent',

  // Brand-tinted shadows / overlays — kept in sync with the primary blue so a
  // re-theme updates them too. (RN style values, used in boxShadow/backgroundColor.)
  primaryShadowSoft: 'rgba(27,143,191,0.10)', // subtle elevation
  primaryShadowStrong: 'rgba(27,143,191,0.30)', // floating action button
  primaryOverlay: 'rgba(27,143,191,0.12)', // faint brand background wash
  primaryDarkShadow: 'rgba(12,74,102,0.08)', // soft shadow on light cards
};

export { palette };
export default colors;
