// Design tokens — elevation/shadows.
//
// Cross-platform: iOS reads shadow*, Android reads elevation. Spread a level
// into a style object:  style={[styles.card, shadows.md]}
//
// Design DNA: shadows are soft, diffuse and warm-tinted (a deep ink navy, never
// pure black) — two levels cover nearly everything. `lg` exists for the rare
// floating/modal case but reach for `sm`/`md` first.

const INK = '#16211F';

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  sm: {
    shadowColor: INK,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: INK,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  lg: {
    shadowColor: INK,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
};

export default shadows;
