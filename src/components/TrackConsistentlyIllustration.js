import Svg, { Rect, Path } from 'react-native-svg';
import { colors } from '../theme/colors';

// Flat 2D illustration for the "track consistently" tip card — a clipboard
// with a small bar chart, solid fills only, no gradient/bevel.
export default function TrackConsistentlyIllustration({ size = 46 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 46 46">
      <Rect x={8} y={6} width={26} height={34} rx={4} fill="#fff" stroke="#CBD9E1" strokeWidth={1.2} />
      <Rect x={16} y={3} width={10} height={6} rx={2} fill={colors.primary} />
      <Rect x={13} y={16} width={3} height={9} fill={colors.success} />
      <Rect x={18} y={12} width={3} height={13} fill={colors.success} />
      <Rect x={23} y={19} width={3} height={6} fill={colors.success} />
      <Path d="M13 30h14M13 34h10" stroke="#DCE7EC" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
