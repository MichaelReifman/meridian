/**
 * Sources localised capital-city names from Wikidata into src/data/capitalNames.generated.ts.
 *
 * `world-countries` translates country names but not capitals, which left Capital mode
 * showing a Latin-script city inside an Arabic page — the one visible seam in the
 * six-language release. Wikidata carries the labels properly, so they are fetched once at
 * build time and vendored, exactly like the flags.
 *
 * Two things this script is careful about, because both would produce a table that looks
 * complete and is quietly wrong:
 *
 *  1. MULTI-CAPITAL COUNTRIES. Wikidata's P36 lists all of them — South Africa has three,
 *     Bolivia two. The roster names one primary, so the matching capital is selected by
 *     its ENGLISH label rather than by taking whichever row arrived last.
 *
 *  2. SILENT GAPS. A missing language for one city would fall back to Latin script for
 *     that one clue and read as a bug rather than a limitation, so coverage is reported
 *     per language and anything missing is named.
 *
 * Run with `npm run capitals`. Cached; pass --force to re-query.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, '.cache', 'wikidata-capitals.json');
const OUT = path.join(ROOT, 'src', 'data', 'capitalNames.generated.ts');
const GENERATED = path.join(ROOT, 'src', 'data', 'countries.generated.ts');

const FORCE = process.argv.includes('--force');
const LOCALES = ['es', 'fr', 'de', 'pt', 'ar'];

/** English is fetched too, purely to disambiguate which capital a row belongs to. */
const QUERY = `SELECT ?iso ?cap ?lang ?label WHERE {
  ?country wdt:P297 ?iso .
  ?country wdt:P36 ?cap .
  ?cap rdfs:label ?label .
  BIND(LANG(?label) AS ?lang)
  FILTER(?lang IN ("en", ${LOCALES.map((l) => `"${l}"`).join(', ')}))
}`;

/**
 * Compare two spellings of the same city forgivingly.
 *
 * The roster and Wikidata disagree on punctuation more often than on the name: "Sana'a"
 * against "Sanaa", "Saint John's" against "Saint Johns". Stripping diacritics and
 * anything that is not a letter or a digit makes those the same string, which is the
 * difference between matching Yemen's capital and silently falling back to English.
 */
function looseName(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function readRoster() {
  const src = fs.readFileSync(GENERATED, 'utf8');
  const start = src.indexOf('] = ') + 4;
  const end = src.lastIndexOf('] as const') + 1;
  if (start < 4 || end <= start) throw new Error('run `npm run data` first');
  return JSON.parse(src.slice(start, end));
}

async function fetchRows() {
  if (!FORCE && fs.existsSync(CACHE)) {
    return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  }
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(QUERY)}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      // Wikidata rejects anonymous clients; identifying the project is their stated
      // requirement rather than a nicety.
      'User-Agent': 'Meridian-build/0.1 (https://github.com/MichaelReifman/meridian)',
    },
  });
  if (!res.ok) throw new Error(`Wikidata returned HTTP ${res.status}`);
  const body = await res.json();
  const rows = body.results.bindings.map((r) => ({
    iso: r.iso.value.toLowerCase(),
    cap: r.cap.value,
    lang: r.lang.value,
    label: r.label.value,
  }));
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(rows));
  return rows;
}

const roster = readRoster();
const rows = await fetchRows();

// iso -> capital entity -> { lang: label }
const byIso = new Map();
for (const row of rows) {
  let caps = byIso.get(row.iso);
  if (!caps) byIso.set(row.iso, (caps = new Map()));
  let labels = caps.get(row.cap);
  if (!labels) caps.set(row.cap, (labels = {}));
  labels[row.lang] = row.label;
}

const names = Object.fromEntries(LOCALES.map((l) => [l, {}]));
const missing = [];
const unmatched = [];

for (const country of roster) {
  if (!country.capital) continue;
  const caps = byIso.get(country.cca2);
  if (!caps || caps.size === 0) {
    unmatched.push(`${country.name} (${country.cca2}) — no capital in Wikidata`);
    continue;
  }

  /* Pick by English label so a three-capital country resolves to the one the roster
     actually names. Falls back to the sole entry when there is only one, which covers
     the handful whose English label differs in spelling from our source. */
  const wanted = looseName(country.capital);
  let chosen = null;
  for (const labels of caps.values()) {
    if (looseName(labels.en ?? '') === wanted) {
      chosen = labels;
      break;
    }
  }
  if (!chosen && caps.size === 1) chosen = [...caps.values()][0];
  if (!chosen) {
    unmatched.push(
      `${country.name}: roster says "${country.capital}", Wikidata offers ${[...caps.values()]
        .map((l) => l.en ?? '?')
        .join(' / ')}`,
    );
    continue;
  }

  for (const locale of LOCALES) {
    const label = chosen[locale];
    if (label) names[locale][country.id] = label;
    else missing.push(`${locale}: ${country.name} — ${country.capital}`);
  }
}

fs.writeFileSync(
  OUT,
  `// GENERATED by scripts/fetch-capitals.mjs — do not edit by hand. Run \`npm run capitals\`.
//
// Localised capital-city names, keyed by locale then by ISO numeric country id. English
// lives in countries.generated.ts as the canonical \`capital\` and is absent here.
//
// Source: Wikidata (CC0). Where a language is missing a label the entry is simply
// absent, and the caller falls back to the English name — so a gap degrades to Latin
// script for one clue rather than to a blank.

export const CAPITAL_NAMES: Readonly<Record<string, Readonly<Record<string, string>>>> = ${JSON.stringify(
    names,
    null,
    2,
  )};
`,
);

const withCapital = roster.filter((c) => c.capital).length;
console.log(`\n  Capital name table\n  ${'─'.repeat(58)}`);
for (const locale of LOCALES) {
  const n = Object.keys(names[locale]).length;
  console.log(
    `  ${locale}   ${String(n).padStart(3)} / ${withCapital}   ${((n / withCapital) * 100).toFixed(0)}%`,
  );
}
console.log(`  file  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);

if (unmatched.length) {
  console.log(`\n  unmatched (${unmatched.length}) — fall back to English:`);
  for (const u of unmatched) console.log(`  · ${u}`);
}
if (missing.length) {
  console.log(`\n  ${missing.length} language gaps — these clues stay in Latin script:`);
  for (const m of missing.slice(0, 20)) console.log(`  · ${m}`);
  if (missing.length > 20) console.log(`  · …and ${missing.length - 20} more`);
}
console.log('');
