/**
 * Generates the PWA icon set from a single inline SVG source.
 *
 * The mark is an engraved globe: a plate of rag paper, the sphere drawn in fine ink
 * line, and one heavier oxblood meridian carrying a pin at the point where it crosses
 * the equator. It is the app's whole idea in one figure, and it is drawn the way the
 * rest of the interface is drawn — flat ink on stock, no gradient, no glow, no bloom.
 *
 * Stroke weights are set as a fraction of the radius rather than in pixels so the mark
 * holds together at 16px in a browser tab and at 512px on a home screen. Below about
 * 24px the two faint construction ellipses stop resolving and the figure reads as a
 * ringed circle with a red dot, which is the intended fallback.
 *
 * Maskable variants inset the mark to ~62% of the canvas so Android's adaptive-icon
 * mask cannot crop the sphere, which is the usual reason a PWA icon looks decapitated.
 *
 * Run with `npm run icons`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'public', 'icons');

// Kept in step with src/theme/tokens.css.
const PAPER = '#F2EDE1';
const INK = '#17140F';
const OXBLOOD = '#7B2D26';
const BRASS = '#A8834A';

/**
 * @param {number} size    canvas size in px
 * @param {number} inset   fraction of the canvas the sphere occupies
 * @param {boolean} plate  draw the paper plate and its border (false for maskable, where
 *                         the ground is bled to the edges instead)
 */
function markSvg(size, inset, plate = true) {
  const c = size / 2;
  const r = (size / 2) * inset;

  // The pin sits where the oxblood meridian crosses the equator — the widest point of
  // the arc, and the one place the two construction lines actually intersect.
  const px = c + r * 0.62;
  const py = c;
  const pinR = r * 0.15;

  const hair = r * 0.045;
  const heavy = r * 0.1;

  /* The inner rule is concentric with the plate, so its radius is the plate's less the
     inset — matching them literally leaves a visible double corner at each corner. */
  const PLATE_R = 0.185;
  const INSET = 0.035;
  const border = plate
    ? `<rect x="${size * INSET}" y="${size * INSET}" width="${size * (1 - INSET * 2)}" height="${size * (1 - INSET * 2)}"
         rx="${size * (PLATE_R - INSET)}" fill="none" stroke="${INK}" stroke-opacity="0.18" stroke-width="${size * 0.012}"/>`
    : '';

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${plate ? size * PLATE_R : 0}" fill="${PAPER}"/>
  ${border}
  <g fill="none" stroke-linecap="round">
    <circle cx="${c}" cy="${c}" r="${r * 0.62}" stroke="${INK}" stroke-width="${hair * 1.5}"/>
    <ellipse cx="${c}" cy="${c}" rx="${r * 0.24}" ry="${r * 0.62}" stroke="${BRASS}" stroke-width="${hair}" stroke-opacity="0.85"/>
    <line x1="${c - r * 0.62}" y1="${c}" x2="${c + r * 0.62}" y2="${c}" stroke="${BRASS}" stroke-width="${hair}" stroke-opacity="0.7"/>
    <path d="M ${c} ${c - r * 0.62} A ${r * 0.62} ${r * 0.62} 0 0 1 ${c} ${c + r * 0.62}"
          stroke="${OXBLOOD}" stroke-width="${heavy}"/>
  </g>
  <circle cx="${px}" cy="${py}" r="${pinR}" fill="${OXBLOOD}"/>
</svg>`);
}

fs.mkdirSync(OUT, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, inset: 0.78, plate: true },
  { file: 'icon-512.png', size: 512, inset: 0.78, plate: true },
  // Android masks adaptive icons aggressively; 0.62 keeps the sphere inside every mask.
  { file: 'icon-192-maskable.png', size: 192, inset: 0.62, plate: false },
  { file: 'icon-512-maskable.png', size: 512, inset: 0.62, plate: false },
  { file: 'apple-touch-icon.png', size: 180, inset: 0.78, plate: true },
];

for (const t of targets) {
  const png = await sharp(markSvg(t.size, t.inset, t.plate), { density: 384 })
    .resize(t.size, t.size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(OUT, t.file), png);
}

// The favicon stays vector so it renders crisply at 16px in a browser tab.
fs.writeFileSync(path.join(OUT, 'favicon.svg'), markSvg(64, 0.8, true));

console.log(`\n  ✓ wrote ${targets.length} PNG icons + favicon.svg to public/icons\n`);
