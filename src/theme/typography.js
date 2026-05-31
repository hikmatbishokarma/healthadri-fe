// Design tokens — typography.
//
// Font sizes, weights, and ready-made text variants. Variants are plain style
// objects you can spread into a StyleSheet or pass to <Text style={...}>:
//
//   <Text style={typography.h2}>Title</Text>

export const fontSizes = {
  xs: 11,
  sm: 13,
  body: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  display: 36,
};

// React Native wants fontWeight as a string.
export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
};

export const lineHeights = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
};

export const typography = {
  display: { fontSize: fontSizes.display, fontWeight: fontWeights.heavy },
  h1: { fontSize: fontSizes.xxl, fontWeight: fontWeights.bold },
  h2: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold },
  h3: { fontSize: fontSizes.lg, fontWeight: fontWeights.semibold },
  title: { fontSize: fontSizes.md, fontWeight: fontWeights.semibold },
  body: { fontSize: fontSizes.body, fontWeight: fontWeights.regular },
  bodyStrong: { fontSize: fontSizes.body, fontWeight: fontWeights.semibold },
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium },
  caption: { fontSize: fontSizes.xs, fontWeight: fontWeights.regular },
};

export default typography;
