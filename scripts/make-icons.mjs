/**
 * Generates the PWA icon set from a single inline SVG source.
 *
 * The mark is a meridian: a globe reduced to one bright arc of longitude with a gold
 * pin sitting on it — the moment the game is built around. Everything is drawn in the
 * Dark Cosmic palette so the installed icon reads as part of the app rather than as a
 * generic map pin.
 *
 * Maskable variants inset the mark to ~60% of the canvas so Android's adaptive-icon
 * mask cannot crop the arc, which is the usual reason a PWA icon looks decapitated on
 * a home screen.
 *
 * Run with `npm run icons`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'public', 'icons');

const SPACE = '#0B0E1A';
const GOLD = '#E8B34D';
const CYAN = '#4FD1C5';
const VIOLET = '#7B6CF6';

/**
 * @param {number} size    canvas size in px
 * @param {number} inset   fraction of the canvas the mark occupies (1 = full bleed)
 * @param {boolean} round  draw a circular plate instead of a rounded square
 */
function markSvg(size, inset, round) {
  const c = size / 2;
  const r = (size / 2) * inset;
  // Globe circle, one meridian ellipse, one equator ellipse, and the pin.
  const plate = round
    ? `<circle cx="${c}" cy="${c}" r="${size / 2}" fill="url(#bg)"/>`
    : `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>`;

  const pinR = r * 0.135;
  // The pin sits exactly ON the gold meridian arc rather than floating beside it —
  // that intersection is the whole idea behind the name. Solved from the arc's own
  // ellipse (rx 0.60r, ry 0.78r) at 65° from the pole, which lands near its widest
  // point and stays clear of the outer rim.
  const t = (65 * Math.PI) / 180;
  const px = c + r * 0.6 * Math.sin(t);
  const py = c - r * 0.78 * Math.cos(t);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="30%" cy="22%" r="95%">
      <stop offset="0%" stop-color="#1B2140"/>
      <stop offset="55%" stop-color="${SPACE}"/>
      <stop offset="100%" stop-color="#05070F"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.85"/>
      <stop offset="60%" stop-color="${GOLD}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${CYAN}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${VIOLET}" stop-opacity="0.75"/>
    </linearGradient>
  </defs>
  ${plate}
  <g fill="none" stroke-linecap="round">
    <circle cx="${c}" cy="${c}" r="${r * 0.78}" stroke="url(#rim)" stroke-width="${r * 0.065}" opacity="0.9"/>
    <ellipse cx="${c}" cy="${c}" rx="${r * 0.30}" ry="${r * 0.78}" stroke="${CYAN}" stroke-width="${r * 0.045}" opacity="0.42"/>
    <ellipse cx="${c}" cy="${c}" rx="${r * 0.78}" ry="${r * 0.26}" stroke="${CYAN}" stroke-width="${r * 0.045}" opacity="0.30"/>
    <path d="M ${c} ${c - r * 0.78} A ${r * 0.60} ${r * 0.78} 0 0 1 ${c} ${c + r * 0.78}"
          stroke="${GOLD}" stroke-width="${r * 0.075}" opacity="0.95"/>
  </g>
  <circle cx="${px}" cy="${py}" r="${pinR * 3.1}" fill="url(#halo)"/>
  <circle cx="${px}" cy="${py}" r="${pinR}" fill="${GOLD}"/>
</svg>`);
}

fs.mkdirSync(OUT, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, inset: 0.82, round: false },
  { file: 'icon-512.png', size: 512, inset: 0.82, round: false },
  // Android masks adaptive icons aggressively; 0.6 keeps the arc inside every mask shape.
  { file: 'icon-192-maskable.png', size: 192, inset: 0.6, round: false },
  { file: 'icon-512-maskable.png', size: 512, inset: 0.6, round: false },
  { file: 'apple-touch-icon.png', size: 180, inset: 0.82, round: false },
];

for (const t of targets) {
  const png = await sharp(markSvg(t.size, t.inset, t.round), { density: 384 })
    .resize(t.size, t.size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(OUT, t.file), png);
}

// The favicon stays vector so it renders crisply at 16px in a browser tab.
fs.writeFileSync(path.join(OUT, 'favicon.svg'), markSvg(64, 0.86, false));

console.log(`\n  ✓ wrote ${targets.length} PNG icons + favicon.svg to public/icons\n`);
