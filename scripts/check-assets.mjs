/**
 * Pre-deploy integrity check: every asset the running game will ask for must exist.
 *
 * The failure this guards against is quiet and only shows up in production — a
 * country whose flag never downloaded renders as a broken image in Flag mode, and a
 * roster entry whose id is missing from the topology is simply unclickable, with no
 * error anywhere. Neither is visible from a passing build.
 *
 * Run with `node scripts/check-assets.mjs`. Exits non-zero on any gap.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readRoster() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'data', 'countries.generated.ts'), 'utf8');
  const start = src.indexOf('] = ') + 4;
  const end = src.lastIndexOf('] as const') + 1;
  return JSON.parse(src.slice(start, end));
}

const roster = readRoster();
const problems = [];

// 1. Every country has a flag on disk.
for (const c of roster) {
  const flag = path.join(ROOT, 'public', 'flags', `${c.cca2}.webp`);
  if (!fs.existsSync(flag)) problems.push(`missing flag: ${c.name} -> public/flags/${c.cca2}.webp`);
  else if (fs.statSync(flag).size === 0) problems.push(`empty flag: ${c.cca2}.webp`);
}

// 2. Every country with hasPolygon has geometry in the shipped topology, and every
//    marker-only country is genuinely absent rather than silently mis-keyed.
const topoPath = path.join(ROOT, 'public', 'data', 'world-50m.json');
if (!fs.existsSync(topoPath)) {
  problems.push('missing public/data/world-50m.json — run `npm run data`');
} else {
  const topo = JSON.parse(fs.readFileSync(topoPath, 'utf8'));
  const ids = new Set(
    topo.objects.countries.geometries
      .filter((g) => g.id !== undefined && g.id !== null)
      .map((g) => String(g.id).padStart(3, '0')),
  );
  for (const c of roster) {
    const present = ids.has(c.id);
    if (c.hasPolygon && !present) problems.push(`${c.name}: hasPolygon but id ${c.id} absent from topology`);
    if (!c.hasPolygon && present) problems.push(`${c.name}: marked marker-only but id ${c.id} IS in topology`);
  }
}

// 3. Every icon the manifest and index.html reference exists.
for (const icon of [
  'icon-192.png',
  'icon-512.png',
  'icon-192-maskable.png',
  'icon-512-maskable.png',
  'apple-touch-icon.png',
  'favicon.svg',
]) {
  if (!fs.existsSync(path.join(ROOT, 'public', 'icons', icon))) {
    problems.push(`missing icon: public/icons/${icon} — run \`npm run icons\``);
  }
}

// 4. Anything a marker-only country depends on: it must still have a usable centroid.
for (const c of roster) {
  if (!Number.isFinite(c.lat) || !Number.isFinite(c.lon)) problems.push(`${c.name}: non-finite centroid`);
}

// 5. If a build is present, every asset must actually be in the service worker's
//    precache. This is not paranoia: an earlier revision shipped a glob that omitted
//    `webp`, which precached zero of the 195 flags and would have broken Flag mode for
//    every offline install — with a green build and no runtime error anywhere.
const swPath = path.join(ROOT, 'dist', 'sw.js');
let precacheReport = 'no dist/ — skipped';
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, 'utf8');
  // Workbox emits precache URLs relative to the scope, with no leading slash.
  const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1].replace(/^\//, ''));
  const cached = new Set(urls);
  const flagsCached = roster.filter((c) => cached.has(`flags/${c.cca2}.webp`)).length;
  const topoCached = cached.has('data/world-50m.json');
  if (flagsCached < roster.length) {
    problems.push(
      `service worker precaches only ${flagsCached}/${roster.length} flags — Flag mode will break offline`,
    );
  }
  if (!topoCached) problems.push('service worker does not precache world-50m.json');
  const bytes = urls.length;
  precacheReport = `${urls.length} entries, ${flagsCached} flags${topoCached ? ' + topology' : ''}`;
  void bytes;
}

const flagBytes = roster.reduce((n, c) => {
  const f = path.join(ROOT, 'public', 'flags', `${c.cca2}.webp`);
  return n + (fs.existsSync(f) ? fs.statSync(f).size : 0);
}, 0);

console.log(`\n  asset check\n  ${'─'.repeat(56)}`);
console.log(`  countries    ${roster.length}`);
console.log(`  flags        ${(flagBytes / 1024).toFixed(0)} KB`);
console.log(`  marker-only  ${roster.filter((c) => !c.hasPolygon).map((c) => c.name).join(', ') || 'none'}`);
console.log(`  precache     ${precacheReport}`);

if (problems.length) {
  console.error(`\n  ${problems.length} PROBLEM(S)`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('');
  process.exit(1);
}
console.log(`\n  ✓ all assets present\n`);
