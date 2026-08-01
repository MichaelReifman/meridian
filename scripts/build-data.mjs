/**
 * Meridian data pipeline (PRD §7).
 *
 * Produces, from two public-domain / permissive sources vendored as devDependencies:
 *   public/data/world-50m.json        Natural Earth Admin-0 topology, verbatim, for rendering
 *   src/data/countries.generated.ts   typed metadata for the ~195 playable countries
 *
 * Run with `npm run data`. Deterministic — same inputs always produce the same output.
 *
 * Three data hazards this script exists to handle, all of which silently corrupt the
 * game if ignored:
 *
 *  1. DUPLICATE IDS. Natural Earth emits two features under ISO numeric 036:
 *     "Australia" and "Ashmore and Cartier Is." (a 3 km² uninhabited reef). Keying a
 *     Map by id keeps whichever comes last, which turns Australia into an islet off
 *     its own north coast. We merge every feature sharing an id into one MultiPolygon.
 *
 *  2. SCATTERED TERRITORIES. Admin-0 folds overseas departments into the parent
 *     country: France carries Guadeloupe, Martinique, Guyane, Réunion and Mayotte, so
 *     its true spherical centroid lands in the Atlantic ~400 km off Spain. Distance
 *     and heatmap feedback keyed on that centroid would be actively misleading. We
 *     instead compute a MAIN-CLUSTER centroid (see mainClusterCentroid below).
 *
 *  3. MISSING MICRO-STATES. Tuvalu has no geometry at all at 50m resolution, and a
 *     further ~20 UN members are far too small to click at world zoom. Both are
 *     handled by flagging them for marker-based hit targets in the renderer; Tuvalu's
 *     centroid is recovered from the 10m topology so it is still fully playable.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import { geoArea, geoCentroid, geoBounds } from 'd3-geo';
import worldCountries from 'world-countries';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DATA = path.join(ROOT, 'public', 'data');
const OUT_SRC = path.join(ROOT, 'src', 'data');

const EARTH_RADIUS_KM = 6371.0088; // IUGG mean radius, matches src/lib/geo.ts

/**
 * Polygons whose centroid sits further than this from the largest polygon's centroid
 * are treated as detached territory and excluded from the country's game location.
 *
 * 3000 km is chosen to sit above the span of every genuinely contiguous country
 * (Russia's mainland is a single polygon, so its span is irrelevant here) and below
 * the distance to every classic outlier: Alaska is ~3400 km from the contiguous US
 * centroid, Réunion ~9000 km from Paris, Hawaii ~5500 km. Verified against the
 * spot-check table this script prints on every run.
 */
const MAIN_CLUSTER_KM = 3000;

/**
 * Countries below this area get an always-clickable marker in addition to whatever
 * polygon they have. ~12000 km² is roughly Jamaica / Qatar / Bahamas — the point at
 * which a country stops being a reliable tap target at world zoom on a phone.
 */
const MICRO_STATE_AREA_KM2 = 12_000;

// ---------------------------------------------------------------------------
// spherical helpers
// ---------------------------------------------------------------------------

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/** Great-circle distance in km between two [lon, lat] points. */
function haversineKm([lon1, lat1], [lon2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Area-weighted mean of [lon, lat] points, computed in 3D so it behaves correctly
 * across the antimeridian (a naive mean of longitudes puts Fiji in Africa).
 */
function weightedSphericalMean(points, weights) {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < points.length; i++) {
    const [lon, lat] = points[i];
    const w = weights[i];
    const la = toRad(lat);
    const lo = toRad(lon);
    const c = Math.cos(la);
    x += w * c * Math.cos(lo);
    y += w * c * Math.sin(lo);
    z += w * Math.sin(la);
  }
  const hyp = Math.sqrt(x * x + y * y);
  if (hyp < 1e-12 && Math.abs(z) < 1e-12) return points[0];
  return [toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, hyp))];
}

/** Explode a Polygon/MultiPolygon geometry into individual Polygon geometries. */
function explode(geometry) {
  if (geometry.type === 'Polygon') return [geometry];
  if (geometry.type === 'MultiPolygon')
    return geometry.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }));
  return [];
}

/**
 * The country's game location: the area-weighted centroid of its main landmass
 * cluster, ignoring detached overseas territory. See hazard 2 in the file header.
 */
function mainClusterCentroid(geometry) {
  const parts = explode(geometry)
    .map((g) => ({ area: geoArea(g), centroid: geoCentroid(g) }))
    .filter((p) => Number.isFinite(p.centroid[0]) && Number.isFinite(p.centroid[1]))
    .sort((a, b) => b.area - a.area);

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].centroid;

  const anchor = parts[0];
  const kept = parts.filter((p) => haversineKm(anchor.centroid, p.centroid) <= MAIN_CLUSTER_KM);
  return weightedSphericalMean(
    kept.map((p) => p.centroid),
    kept.map((p) => p.area),
  );
}

// ---------------------------------------------------------------------------
// load + merge topology
// ---------------------------------------------------------------------------

function loadTopo(resolution) {
  const file = path.join(ROOT, 'node_modules', 'world-atlas', `countries-${resolution}.json`);
  const topo = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { topo, fc: feature(topo, topo.objects.countries) };
}

/**
 * Merge every feature sharing an ISO numeric id into one geometry.
 * See hazard 1 in the file header — this is what keeps Australia continent-sized.
 */
function mergeById(features) {
  const merged = new Map();
  for (const f of features) {
    if (f.id === undefined || f.id === null) continue;
    const id = String(f.id).padStart(3, '0');
    const polys = explode(f.geometry).map((g) => g.coordinates);
    if (polys.length === 0) continue;
    const existing = merged.get(id);
    if (existing) {
      existing.coordinates.push(...polys);
      // Keep the name of whichever part is larger, so "Australia" wins over
      // "Ashmore and Cartier Is." regardless of source ordering.
      const incomingArea = geoArea(f.geometry);
      if (incomingArea > existing.namedArea) {
        existing.name = f.properties?.name ?? existing.name;
        existing.namedArea = incomingArea;
      }
    } else {
      merged.set(id, {
        id,
        name: f.properties?.name ?? id,
        namedArea: geoArea(f.geometry),
        coordinates: [...polys],
      });
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------

const { topo: topo50, fc: fc50 } = loadTopo('50m');
const merged50 = mergeById(fc50.features);

const warnings = [];
const countries = [];

// The playable roster: UN member and observer states. `world-countries` marks the
// Holy See as unMember, which is not strictly correct (it is an observer), but the
// resulting set is exactly the ~195 the PRD asks for, so we take it as-is and add
// Palestine, the other observer, explicitly.
const roster = worldCountries.filter((c) => c.unMember || c.cca3 === 'PSE');

for (const c of roster) {
  const id = String(c.ccn3).padStart(3, '0');
  const entry = merged50.get(id);

  let centroid = null;
  let areaKm2 = 0;
  let hasPolygon = false;

  if (entry) {
    const geometry = { type: 'MultiPolygon', coordinates: entry.coordinates };
    centroid = mainClusterCentroid(geometry);
    areaKm2 = geoArea(geometry) * EARTH_RADIUS_KM * EARTH_RADIUS_KM;
    hasPolygon = true;
  }

  // Recover anything absent at 50m from the 10m topology (Tuvalu, today). The
  // polygon stays out of the rendered map — nine atolls totalling 26 km² are not
  // visible at any usable zoom — but the country is fully playable via its marker.
  if (!centroid) {
    const { fc: fc10 } = loadTopo('10m');
    const merged10 = mergeById(fc10.features);
    const fallback = merged10.get(id);
    if (fallback) {
      const geometry = { type: 'MultiPolygon', coordinates: fallback.coordinates };
      centroid = mainClusterCentroid(geometry);
      areaKm2 = geoArea(geometry) * EARTH_RADIUS_KM * EARTH_RADIUS_KM;
      warnings.push(`${c.name.common} (${c.cca3}): absent at 50m, centroid recovered from 10m`);
    }
  }

  if (!centroid) {
    warnings.push(`${c.name.common} (${c.cca3}): NO GEOMETRY at any resolution — excluded`);
    continue;
  }

  const capital = Array.isArray(c.capital) ? c.capital[0] : undefined;
  if (!capital) {
    warnings.push(`${c.name.common} (${c.cca3}): no capital in source — excluded from Capital mode`);
  }

  countries.push({
    id,
    cca2: c.cca2.toLowerCase(),
    cca3: c.cca3,
    name: c.name.common,
    official: c.name.official,
    capital: capital ?? null,
    // Every capital the source lists, so Capital mode can accept e.g. all three of
    // South Africa's as valid clue text without treating them as separate puzzles.
    capitals: Array.isArray(c.capital) ? c.capital : [],
    lon: Number(centroid[0].toFixed(4)),
    lat: Number(centroid[1].toFixed(4)),
    areaKm2: Math.round(areaKm2),
    region: c.region ?? 'Other',
    subregion: c.subregion ?? '',
    hasPolygon,
    micro: areaKm2 < MICRO_STATE_AREA_KM2,
  });
}

countries.sort((a, b) => a.name.localeCompare(b.name, 'en'));

// Ids the renderer must draw as inert terrain: present in the topology, never a
// legal guess or target. Everything not in the playable set.
const playableIds = new Set(countries.map((c) => c.id));
const inertIds = [];
for (const [id, entry] of merged50) {
  if (!playableIds.has(id)) inertIds.push(id);
}
// Features with no id at all (Somaliland, Kosovo, N. Cyprus, …) are matched by name.
const inertNames = [];
for (const f of fc50.features) {
  if (f.id === undefined || f.id === null) inertNames.push(f.properties?.name ?? '');
}

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------

const errors = [];

// Every playable country must be uniquely identifiable by its clue in every mode.
const byName = new Map();
for (const c of countries) {
  if (byName.has(c.name)) errors.push(`duplicate country name: ${c.name}`);
  byName.set(c.name, c);
}
const capitalOwners = new Map();
for (const c of countries) {
  for (const cap of c.capitals) {
    const prev = capitalOwners.get(cap);
    if (prev) errors.push(`capital "${cap}" claimed by both ${prev} and ${c.name}`);
    capitalOwners.set(cap, c.name);
  }
}
for (const c of countries) {
  if (Math.abs(c.lat) > 90 || Math.abs(c.lon) > 180) errors.push(`${c.name}: centroid out of range`);
  if (!/^[a-z]{2}$/.test(c.cca2)) errors.push(`${c.name}: bad cca2 "${c.cca2}"`);
}

// ---------------------------------------------------------------------------
// emit
// ---------------------------------------------------------------------------

fs.mkdirSync(OUT_DATA, { recursive: true });
fs.mkdirSync(OUT_SRC, { recursive: true });

// Topology is copied verbatim: re-encoding or simplifying it risks dropping exactly
// the small countries we work hardest to keep clickable. 756 KB raw, ~250 KB gzipped,
// precached once by the service worker.
fs.writeFileSync(path.join(OUT_DATA, 'world-50m.json'), JSON.stringify(topo50));

const header = `// GENERATED by scripts/build-data.mjs — do not edit by hand. Run \`npm run data\`.
//
// Sources:
//   Boundaries  Natural Earth Admin-0 via world-atlas (public domain)
//   Metadata    world-countries (ODbL)
//   Flags       flagcdn.com, vendored to public/flags by scripts/fetch-flags.mjs
//
// \`lon\`/\`lat\` are MAIN-CLUSTER centroids, not raw geometric centroids: detached
// overseas territory is excluded so that distance feedback matches where a player
// actually believes the country is. See the build script for the full rationale.

import type { Country } from '@/types/game';

export const COUNTRIES: readonly Country[] = `;

const body = JSON.stringify(
  countries.map((c) => ({
    id: c.id,
    cca2: c.cca2,
    cca3: c.cca3,
    name: c.name,
    official: c.official,
    capital: c.capital,
    capitals: c.capitals,
    lon: c.lon,
    lat: c.lat,
    areaKm2: c.areaKm2,
    region: c.region,
    subregion: c.subregion,
    hasPolygon: c.hasPolygon,
    micro: c.micro,
  })),
  null,
  2,
);

const footer = ` as const;

/** ISO numeric ids present in the topology that are never a legal guess or target. */
export const INERT_IDS: ReadonlySet<string> = new Set(${JSON.stringify(inertIds.sort())});

/** Unidentified topology features (disputed / non-state), matched by Natural Earth name. */
export const INERT_NAMES: ReadonlySet<string> = new Set(${JSON.stringify([...new Set(inertNames)].sort())});

/** Countries too small to reliably tap at world zoom — the renderer gives them markers. */
export const MICRO_STATE_AREA_KM2 = ${MICRO_STATE_AREA_KM2};
`;

fs.writeFileSync(path.join(OUT_SRC, 'countries.generated.ts'), header + body + footer);

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

const SPOT_CHECKS = [
  ['France', 'central France, not the Atlantic'],
  ['United States', 'contiguous 48, not mid-Pacific'],
  ['Australia', 'continental interior, not a reef'],
  ['Russia', 'central Siberia'],
  ['New Zealand', 'between the two main islands'],
  ['Fiji', 'not displaced by the antimeridian'],
  ['Kiribati', 'not displaced by the antimeridian'],
  ['Indonesia', 'within the archipelago'],
  ['Netherlands', 'Europe, not the Caribbean'],
  ['Norway', 'mainland, not Svalbard'],
  ['Chile', 'mainland, not Easter Island'],
  ['Ecuador', 'mainland, not the Galápagos'],
  ['Portugal', 'Iberia, not the Azores'],
  ['Spain', 'Iberia, not the Canaries'],
];

console.log(`\n  Meridian data build\n  ${'─'.repeat(64)}`);
console.log(`  playable countries   ${countries.length}`);
console.log(`  with polygons        ${countries.filter((c) => c.hasPolygon).length}`);
console.log(`  micro-states         ${countries.filter((c) => c.micro).length} (marker hit targets)`);
console.log(`  with capitals        ${countries.filter((c) => c.capital).length}`);
console.log(`  inert terrain ids    ${inertIds.length}`);
console.log(`  topology             ${(fs.statSync(path.join(OUT_DATA, 'world-50m.json')).size / 1024).toFixed(0)} KB`);

console.log(`\n  centroid spot checks\n  ${'─'.repeat(64)}`);
for (const [name, expectation] of SPOT_CHECKS) {
  const c = countries.find((x) => x.name === name);
  if (!c) {
    console.log(`  ${name.padEnd(16)} NOT FOUND`);
    continue;
  }
  console.log(
    `  ${name.padEnd(16)} ${String(c.lat.toFixed(2)).padStart(7)}, ${String(c.lon.toFixed(2)).padStart(8)}   ${expectation}`,
  );
}

if (warnings.length) {
  console.log(`\n  warnings\n  ${'─'.repeat(64)}`);
  for (const w of warnings) console.log(`  · ${w}`);
}

if (errors.length) {
  console.error(`\n  ERRORS\n  ${'─'.repeat(64)}`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('');
  process.exit(1);
}

console.log(`\n  ✓ wrote public/data/world-50m.json + src/data/countries.generated.ts\n`);
