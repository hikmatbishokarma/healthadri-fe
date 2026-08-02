import Svg, { Ellipse, Path, Rect, Circle, G } from 'react-native-svg';
import { colors } from '../theme/colors';

// Flat 2D illustration for the "no appointments scheduled" empty state —
// solid fills only, no gradient/bevel, per the design DNA's flat-2D direction.
export default function ApptEmptyIllustration({ size = 64 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Ellipse cx={30} cy={56} rx={20} ry={4} fill="#000" opacity={0.05} />
      <Path
        d="M14 16h6v-5a2 2 0 1 1 4 0v5h12v-5a2 2 0 1 1 4 0v5h6v34H14Z"
        fill="#fff"
        stroke="#CBD9E1"
        strokeWidth={1.2}
      />
      <Rect x={14} y={16} width={32} height={9} fill={colors.primary} />
      <G fill="#DCE7EC">
        <Rect x={19} y={30} width={6} height={6} rx={1.5} />
        <Rect x={29} y={30} width={6} height={6} rx={1.5} />
        <Rect x={39} y={30} width={6} height={6} rx={1.5} />
        <Rect x={19} y={40} width={6} height={6} rx={1.5} />
        <Rect x={29} y={40} width={6} height={6} rx={1.5} />
      </G>
      <Circle cx={46} cy={46} r={9} fill={colors.success} />
      <Path
        d="M42 46.5 45 49.5 51 42.5"
        stroke="#fff"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
