// Design tokens — colors.
//
// These are derived from the hex values already scattered across the screens so
// the palette matches today's UI exactly. New code should import from here
// (`colors.primary`) instead of hardcoding hex; existing screens can migrate
// gradually. Nothing breaks by adding this file.

// Raw palette — the actual hues. Prefer the semantic names below in components.
const palette = {
  // Brand greens
  green900: '#0D4035', // darkest — splash, dark backgrounds
  green800: '#1A3C34', // dark green — headings on light surfaces
  green600: '#1A6B5A', // primary brand
  green100: '#E8F5F1', // light tint — selected/brand-bg surfaces
  green50: '#F2FAF6', // faint green page background

  // Brand accents — from the Healthadri pinwheel logo (cyan + yellow).
  // Green stays the primary; these are for highlights/accents only.
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
  primary: palette.green600,
  primaryDark: palette.green800,
  primaryDarkest: palette.green900,
  primaryTint: palette.green100,
  primarySurface: palette.green50,

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
  textPrimary: palette.green800,
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

  // Brand-tinted shadows / overlays — kept in sync with the primary green so a
  // re-theme updates them too. (RN style values, used in boxShadow/backgroundColor.)
  primaryShadowSoft: 'rgba(26,107,90,0.10)', // subtle elevation
  primaryShadowStrong: 'rgba(26,107,90,0.30)', // floating action button
  primaryOverlay: 'rgba(26,107,90,0.12)', // faint brand background wash
  primaryDarkShadow: 'rgba(13,64,53,0.08)', // soft shadow on light cards
};

export { palette };
export default colors;
