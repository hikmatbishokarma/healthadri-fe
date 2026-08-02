import Svg, { Ellipse, Rect, Circle, G, Path } from 'react-native-svg';
import { colors } from '../theme/colors';

// Flat 2D illustration for the "no medications today" empty state — solid
// fills only, no gradient/bevel, per the design DNA's flat-2D direction.
export default function MedsEmptyIllustration({ size = 64 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Ellipse cx={30} cy={56} rx={22} ry={4} fill="#000" opacity={0.05} />
      <Rect x={10} y={12} width={34} height={38} rx={7} fill="#EAF1F6" stroke="#CBD9E1" strokeWidth={1.2} />
      <Circle cx={19} cy={22} r={3.4} fill="#fff" stroke="#B9C9D3" strokeWidth={1.1} />
      <Circle cx={30} cy={22} r={3.4} fill="#fff" stroke="#B9C9D3" strokeWidth={1.1} />
      <Circle cx={19} cy={33} r={3.4} fill="#fff" stroke="#B9C9D3" strokeWidth={1.1} />
      <Circle cx={30} cy={33} r={3.4} fill="#fff" stroke="#B9C9D3" strokeWidth={1.1} />
      <Circle cx={19} cy={44} r={3.4} fill="#fff" stroke="#B9C9D3" strokeWidth={1.1} />
      <Circle cx={30} cy={44} r={3.4} fill="#fff" stroke="#B9C9D3" strokeWidth={1.1} />
      <G transform="translate(30,42) rotate(28)">
        <Rect x={0} y={0} width={24} height={10} rx={5} fill={colors.marigold} />
        <Path d="M12 0h7a5 5 0 0 1 0 10h-7Z" fill={colors.primaryVivid} />
      </G>
      <Circle cx={46} cy={34} r={9} fill={colors.success} />
      <Path
        d="M42 34.5 45 37.5 51 30.5"
        stroke="#fff"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
