/**
 * Base-aware URLs for the assets that are fetched at runtime.
 *
 * Vite rewrites asset URLs it can see at build time — imports, and references inside
 * index.html — but it cannot rewrite a string that is assembled in JavaScript. The
 * topology and the 195 flags are both fetched by path, so on any deployment served
 * from a subdirectory (GitHub Pages puts this app under /meridian/) a literal
 * '/flags/fr.webp' resolves against the domain root and 404s.
 *
 * Everything runtime-fetched therefore goes through `asset()`, which reads the base
 * Vite was built with. That keeps the app correct at a domain root and under a
 * subpath without a second code path for either.
 */

/** Prefix a public-directory path with the deployment's base URL. */
export function asset(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** Natural Earth Admin-0 topology, shared by the flat map and the globe. */
export const TOPOLOGY_URL = asset('data/world-50m.json');

/** The flag for an ISO 3166-1 alpha-2 code, lowercase. */
export function flagUrl(cca2: string): string {
  return asset(`flags/${cca2}.webp`);
}
