// Design system barrel. Import tokens from one place:
//
//   import { colors, spacing, radius, typography, shadows } from '../theme';

export { colors, palette } from './colors';
export { spacing } from './spacing';
export { radius } from './radius';
export { typography, fontSizes, fontWeights, lineHeights } from './typography';
export { shadows } from './shadows';

import { colors } from './colors';
import { spacing } from './spacing';
import { radius } from './radius';
import { typography, fontSizes, fontWeights, lineHeights } from './typography';
import { shadows } from './shadows';

export const theme = {
  colors,
  spacing,
  radius,
  typography,
  fontSizes,
  fontWeights,
  lineHeights,
  shadows,
};

export default theme;
