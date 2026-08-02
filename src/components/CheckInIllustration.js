import Svg, { Path, Polyline, Circle } from 'react-native-svg';

// Decorative mark for the check-in hero: an EKG line drawn through a heart.
// Fixed palette by design — it's a one-off accent, not a themeable icon.
export default function CheckInIllustration({ size = 58 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M50 8 C70 8 90 26 90 50 C90 74 70 90 48 90 C26 90 8 72 10 50 C12 28 30 8 50 8 Z"
        fill="#CFEEE4"
      />
      <Path
        d="M50,68 C50,68 28,52 28,38 C28,27 38,22 50,33 C62,22 72,27 72,38 C72,52 50,68 50,68 Z"
        fill="#1B8FBF"
      />
      <Polyline
        points="14,50 30,50 36,34 44,66 52,38 60,50 86,50"
        stroke="#FF8F6B"
        strokeWidth={3.4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={76} cy={26} r={3} fill="#0C4A66" opacity={0.7} />
      <Circle cx={18} cy={72} r={2.5} fill="#FF8F6B" opacity={0.8} />
      <Circle cx={80} cy={70} r={2} fill="#1B8FBF" opacity={0.5} />
    </Svg>
  );
}
