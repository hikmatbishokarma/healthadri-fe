// Regenerates every app icon from the Healthadri pinwheel mark defined below.
//
// Usage (sharp is not a project dependency, so install it on the fly):
//   cd healthadri-fe/scripts && npm init -y >/dev/null && npm install sharp
//   node generate-icons.mjs
//   cd .. && npx expo prebuild --clean --platform android   # bakes icons into android/
//
// To swap in the real brand artwork later: replace BLADE / COLORS with your
// own SVG (or point sharp at an .svg file) and re-run the two commands above.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FE = resolve(__dirname, '..', 'assets');
const ADMIN = resolve(__dirname, '..', '..', 'healthadri-admin', 'public');

// Brand colours.
const COLORS = ['#29ABE2', '#F7B500', '#1A1A1A']; // cyan, yellow, black
// One pinwheel blade pointing up from the centre of a 512x512 canvas;
// six copies rotated 60° apart form the mark.
const BLADE = 'M256 256 C 196 214 184 150 244 90 C 284 142 300 206 256 256 Z';

function buildSvg({ size, white = false, bg = null, pad = 1.0 }) {
  const blades = Array.from({ length: 6 }, (_, i) => {
    const fill = white ? '#FFFFFF' : COLORS[i % 3];
    return `<path d="${BLADE}" fill="${fill}" transform="rotate(${i * 60} 256 256)"/>`;
  }).join('');
  const group = `<g transform="translate(256 256) scale(${pad}) translate(-256 -256)">${blades}<circle cx="256" cy="256" r="26" fill="#FFFFFF"/></g>`;
  const background = bg ? `<rect width="512" height="512" fill="${bg}"/>` : '';
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${background}${group}</svg>`,
  );
}

const render = async (target, opts) => {
  await sharp(buildSvg(opts)).png().toFile(target);
  console.log('✓', target);
};

// Mobile app.
await render(`${FE}/icon.png`, { size: 1024, bg: '#FFFFFF', pad: 1.2 });
await render(`${FE}/adaptive-icon.png`, { size: 1024, pad: 1.0 });
await render(`${FE}/notification-icon.png`, { size: 256, white: true, pad: 1.25 });
await render(`${FE}/splash-icon.png`, { size: 512, white: true, pad: 0.95 });
await render(`${FE}/favicon.png`, { size: 64, bg: '#FFFFFF', pad: 1.3 });
// Admin site (header logo + browser favicon).
await render(`${ADMIN}/logo.png`, { size: 512, pad: 1.45 });

console.log('\nDone. Run `npx expo prebuild --clean --platform android` to bake into native.');
