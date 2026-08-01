/**
 * Vendors every playable country's flag into public/flags/{cca2}.webp.
 *
 * The PRD names flagcdn.com as the flag source, but a CDN fetched at runtime is
 * incompatible with the app's offline promise: a freshly installed PWA with no
 * network would show 195 broken images in Flag mode. So we pull the set once at
 * build time and precache it with the rest of the app shell.
 *
 * The originals are SVG and total ~2.8 MB, which is far too much to precache: a
 * handful of flags carrying detailed coats of arms (El Salvador, Bolivia,
 * Afghanistan, Ecuador) are 200 KB+ each on their own. Since a flag is only ever
 * displayed at one modest size in this game, vector scalability buys nothing, so
 * we rasterise to WebP at RASTER_WIDTH — which is still 2x the largest size the UI
 * ever renders — and ship those instead. The SVG originals are cached outside
 * public/ so re-running is cheap without bloating the install.
 *
 * Run with `npm run flags`. Idempotent. Pass --force to re-download and re-encode.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'flags');
const CACHE = path.join(ROOT, '.cache', 'flags-svg');
const GENERATED = path.join(ROOT, 'src', 'data', 'countries.generated.ts');

const FORCE = process.argv.includes('--force');
const CONCURRENCY = 8;

/** 2x the largest size the UI renders a flag at (~256 CSS px on the reveal card). */
const RASTER_WIDTH = 512;

/** Read the generated roster without needing a TypeScript loader. */
function readRoster() {
  const src = fs.readFileSync(GENERATED, 'utf8');
  const start = src.indexOf('] = ') + 4;
  const end = src.lastIndexOf('] as const') + 1;
  if (start < 4 || end <= start) {
    throw new Error('could not parse countries.generated.ts — run `npm run data` first');
  }
  return JSON.parse(src.slice(start, end));
}

async function download(code) {
  const dest = path.join(OUT, `${code}.webp`);
  const cached = path.join(CACHE, `${code}.svg`);

  if (!FORCE && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    return { code, bytes: fs.statSync(dest).size, svgBytes: 0, skipped: true };
  }

  let svg;
  if (!FORCE && fs.existsSync(cached) && fs.statSync(cached).size > 0) {
    svg = fs.readFileSync(cached);
  } else {
    const res = await fetch(`https://flagcdn.com/${code}.svg`, {
      headers: { 'User-Agent': 'Meridian-build/0.1' },
    });
    if (!res.ok) throw new Error(`${code}: HTTP ${res.status}`);
    svg = Buffer.from(await res.arrayBuffer());
    if (svg.length === 0) throw new Error(`${code}: empty response`);
    if (!svg.subarray(0, 400).toString('utf8').toLowerCase().includes('<svg')) {
      throw new Error(`${code}: response is not SVG`);
    }
    fs.writeFileSync(cached, svg);
  }

  // `density` has to be raised before rasterising: librsvg renders at 72 DPI by
  // default, so a flag declared in small user units would otherwise be upscaled
  // from a blurry thumbnail rather than rendered cleanly at the target width.
  const webp = await sharp(svg, { density: 384 })
    .resize({ width: RASTER_WIDTH, fit: 'inside', withoutEnlargement: false })
    .webp({ quality: 88, effort: 6 })
    .toBuffer();

  fs.writeFileSync(dest, webp);
  return { code, bytes: webp.length, svgBytes: svg.length, skipped: false };
}

/** Simple fixed-size worker pool — flagcdn is a free service, so we stay polite. */
async function pool(items, worker, size) {
  const results = [];
  const failures = [];
  let cursor = 0;
  const runners = Array.from({ length: size }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        results.push(await worker(item));
      } catch (err) {
        failures.push({ item, message: err instanceof Error ? err.message : String(err) });
      }
    }
  });
  await Promise.all(runners);
  return { results, failures };
}

const roster = readRoster();
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

// Any leftover SVGs from an earlier revision of this script would still be picked
// up by the service worker's precache glob, silently doubling the install size.
for (const stale of fs.readdirSync(OUT).filter((f) => f.endsWith('.svg'))) {
  fs.unlinkSync(path.join(OUT, stale));
}

console.log(`\n  Fetching ${roster.length} flags from flagcdn.com${FORCE ? ' (forced)' : ''}…`);

const { results, failures } = await pool(
  roster.map((c) => c.cca2),
  download,
  CONCURRENCY,
);

const downloaded = results.filter((r) => !r.skipped);
const totalBytes = results.reduce((n, r) => n + r.bytes, 0);
const totalSvgBytes = results.reduce((n, r) => n + r.svgBytes, 0);
const biggest = [...results].sort((a, b) => b.bytes - a.bytes).slice(0, 5);

console.log(`  ${'─'.repeat(64)}`);
console.log(`  encoded      ${downloaded.length}`);
console.log(`  already had  ${results.length - downloaded.length}`);
console.log(`  shipped      ${(totalBytes / 1024).toFixed(0)} KB across ${results.length} WebP files`);
if (totalSvgBytes > 0) {
  console.log(
    `  from         ${(totalSvgBytes / 1024).toFixed(0)} KB of SVG (${(100 - (totalBytes / totalSvgBytes) * 100).toFixed(0)}% smaller)`,
  );
}
console.log(`  largest      ${biggest.map((b) => `${b.code} ${(b.bytes / 1024).toFixed(1)}KB`).join(', ')}`);

if (failures.length) {
  console.error(`\n  FAILED (${failures.length}):`);
  for (const f of failures) console.error(`  ✗ ${f.item}: ${f.message}`);
  console.error('  Re-run `npm run flags` to retry just these.\n');
  process.exit(1);
}

console.log(`\n  ✓ ${results.length} flags in public/flags\n`);
