// Regenerates every mobile app icon from the real brand logo (assets/logo.svg).
//
// Usage (sharp is not a project dependency, so install it on the fly):
//   cd healthadri-fe/scripts && npm init -y >/dev/null && npm install sharp
//   node generate-icons.mjs
//   cd .. && npx expo prebuild --clean --platform android   # bakes icons into android/
//
// To update the logo later: replace assets/logo.svg and re-run the two commands.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dirname, '..', 'assets');
const SRC = resolve(ASSETS, 'logo.svg');

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function logoBuffer(inner, { white = false } = {}) {
  let buf = await sharp(SRC, { density: 1024 })
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
  if (white) {
    // Threshold alpha into a clean solid white silhouette (the SVG is a trace
    // with semi-transparent edges that would otherwise look patchy).
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const ch = info.channels;
    for (let i = 0; i < data.length; i += ch) {
      const on = data[i + ch - 1] > 110;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      data[i + ch - 1] = on ? 255 : 0;
    }
    buf = await sharp(data, { raw: info }).png().toBuffer();
  }
  return buf;
}

async function make(target, { size, pad, bg = null, white = false }) {
  const inner = Math.round(size * pad);
  const logo = await logoBuffer(inner, { white });
  await sharp({ create: { width: size, height: size, channels: 4, background: bg || TRANSPARENT } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(target);
  console.log('✓', target);
}

// App launcher icon — full-bleed, opaque white background (iOS/Play need no transparency).
await make(`${ASSETS}/icon.png`, { size: 1024, pad: 0.82, bg: WHITE });
// Android adaptive icon foreground — transparent, sized for the safe zone.
await make(`${ASSETS}/adaptive-icon.png`, { size: 1024, pad: 0.62 });
// Notification small icon — white silhouette on transparent (Android uses alpha only).
await make(`${ASSETS}/notification-icon.png`, { size: 256, pad: 0.84, white: true });
// Splash mark — full-colour logo, shown on the light splash background.
await make(`${ASSETS}/splash-icon.png`, { size: 512, pad: 0.72 });
// Web favicon.
await make(`${ASSETS}/favicon.png`, { size: 64, pad: 0.9, bg: WHITE });

console.log('\nDone. Run `npx expo prebuild --clean --platform android` to bake into native.');
