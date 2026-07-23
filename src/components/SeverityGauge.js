import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

// Presentation-only ring gauge. Maps the existing categorical triage severity
// (HIGH/MED/LOW/none) to a fill fraction — no new data, no new thresholds.
const FRACTION = { HIGH: 1, MED: 0.66, LOW: 0.33 };

export default function SeverityGauge({
  severity,
  size = 48,
  strokeWidth = 5,
  color,
  trackColor = '#E5E7EB',
  children,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = severity ? (FRACTION[severity] ?? 0) : 0;
  const dashOffset = circumference * (1 - fraction);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {fraction > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        )}
      </Svg>
      {children}
    </View>
  );
}
