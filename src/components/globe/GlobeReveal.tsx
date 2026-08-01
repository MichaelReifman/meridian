/**
 * The reveal (PRD §5) — a copperplate globe, printed on the same page as everything else.
 *
 * The flat map crossfades into an engraved sphere on paper: brass graticule, ink
 * coastlines, a crisp ink limb at the silhouette. The camera flies in on the target, an
 * oxblood pin drops, and a fine great-circle trail traces the player's guesses across
 * the surface. Everything else in the app stays at 250 ms and understated; this is the
 * single showpiece, and it is fully skipped under prefers-reduced-motion.
 *
 * Nothing here emits light. There is no atmosphere shell and no starfield — both were
 * artefacts of the dark direction, and additive blending on a cream ground only blows
 * out to white anyway. Depth is carried by linework, exactly as an engraver would.
 *
 * This module is lazy-loaded by the shell, which is why it may import three, R3F and
 * topojson-client at module scope. Nothing on the critical path may import it.
 */

import {
  Component,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  LineSegments,
  CanvasTexture,
  Quaternion,
  NoColorSpace,
  ShaderMaterial,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type MeshBasicMaterial,
} from 'three';
import { feature } from 'topojson-client';
import { geoEquirectangular, geoPath } from 'd3-geo';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { FeatureCollection, GeometryObject, Position } from 'geojson';
import { ArrowRight } from 'lucide-react';
import { useTranslator } from '@/i18n';
import type { TranslationKey } from '@/i18n/en';
import { COUNTRIES } from '@/data/countries.generated';
import { EARTH_RADIUS_KM, clamp01, distanceKm, lonLatToVec3, slerpLonLat } from '@/lib/geo';
import { parseCssColor, toHexColor } from '@/lib/ramp';
import { TOPOLOGY_URL, flagUrl } from '@/lib/paths';
import type { Country, LonLat } from '@/types/game';
import { RevealFallback } from './RevealFallback';

export interface GlobeRevealProps {
  target: Country;
  guessPath: readonly Country[]; // in guess order, may be empty on a give-up
  solved: boolean;
  guessCount: number;
  onDone(): void;
}

/**
 * `children` is the shell's slot for Share / Next. Adding an optional prop keeps the
 * component assignable wherever `(props: GlobeRevealProps) => JSX.Element` is expected,
 * so the published contract above is unchanged.
 */
type RevealProps = GlobeRevealProps & { readonly children?: ReactNode };

/* ------------------------------------------------------------------ geometry scale */

/** The globe is a unit sphere, matching the unit vectors lonLatToVec3 hands back. */
const GLOBE_RADIUS = 1;
/**
 * A 128×80 sphere sags at most ~0.0003 below the true radius between its facets, so
 * outlines at +0.0025 clear it everywhere without visibly floating.
 */
const COAST_RADIUS = 1.0025;
/** Just inside the coastlines: the instrument's scale is ruled *under* the land. */
const GRATICULE_RADIUS = 1.0015;
/** Degrees between meridians and parallels, and degrees per drawn segment. */
const GRATICULE_STEP = 30;
const GRATICULE_RESOLUTION = 4;
const TRAIL_RADIUS = 1.012;
/** Extra height at the midpoint of a leg, scaled by how far that leg travels. */
const TRAIL_BULGE = 0.12;
const NODE_RADIUS = 1.008;
const PIN_STEM = 0.075;
/** How far above the surface the pin starts its drop, in globe radii. */
const PIN_DROP_HEIGHT = 0.38;

/* -------------------------------------------------------------------- choreography */

const FLY_SECONDS = 2.2;
const TRAIL_START = 0.3;
const TRAIL_SECONDS = 1.45;
const PIN_START = 1.5;
const PIN_SECONDS = 0.6;
/**
 * Camera distances, in globe radii.
 *
 * These are what decide whether the reveal reads as a plate or as a close-up. At a 38°
 * field of view the sphere subtends asin(1/z); ending at 2.35 made that 25° against a
 * 19° half-frame, so the globe overflowed the viewport by half again and its limb was
 * cropped away entirely — the one line that tells the eye it is looking at a sphere at
 * all. Ending at 4.9 puts the silhouette at about 62% of frame height, which leaves a
 * clear margin of paper on every side and lets the brass graticule wrap a visible edge.
 *
 * The wider start keeps the fly-in proportional: the same ratio of travel as before, so
 * the choreography timings below did not need retuning.
 */
const CAM_START_Z = 8.2;
const CAM_END_Z = 4.9;
/** ±2.6° of post-arrival wander: enough to read as alive, not enough to lose the pin. */
const IDLE_AMPLITUDE = 0.045;
const IDLE_SPEED = 0.42;
/**
 * Degrees of longitude the globe unwinds on the way in. The fly-in *is* the idle spin:
 * starting the aim this far east of the target and easing out means the globe enters
 * turning at speed and decelerates into place, which lands the target dead centre
 * instead of drifting past it the way an independent spin would.
 */
const START_LON_LEAD = 64;
const START_LAT_FLATTEN = 0.35;
const START_TILT_DEG = 14;

const SAFE_PADDING =
  'calc(var(--inset-t) + 1rem) calc(var(--inset-r) + 1rem)' +
  ' calc(var(--inset-b) + 1rem) calc(var(--inset-l) + 1rem)';

const POLE = new Vector3(0, 1, 0);
const SCREEN_X = new Vector3(1, 0, 0);
const DEG = Math.PI / 180;

/* -------------------------------------------------------------------------- tokens */

/**
 * Colours come from src/theme/tokens.css rather than literals so the globe cannot
 * drift away from the 2D map's palette — the same rule src/lib/ramp.ts follows.
 */
const tokenCache = new Map<string, string>();

/**
 * Always returns `#rrggbb`, whatever form the token is authored in.
 *
 * Normalising here is load-bearing twice over: the palette tokens are stored as channel
 * triples and composed back up, so they resolve to `rgb(242 237 225)` rather than hex,
 * and three's `Color.setStyle` does not understand CSS Color 4's space-separated
 * `rgb()` — so handing the raw value to a material would fail as surely as parsing it
 * as hex would.
 */
function token(name: string, fallback: string): string {
  const hit = tokenCache.get(name);
  if (hit !== undefined) return hit;
  let raw = fallback;
  if (typeof getComputedStyle === 'function') {
    const read = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (read) raw = read;
  }
  const value = toHexColor(raw);
  tokenCache.set(name, value);
  return value;
}

/**
 * Channels on 0..1, still sRGB-encoded. The shaders below write straight to the
 * framebuffer without three's colour-management epilogue, so they need the encoded
 * values; MeshBasicMaterial and friends take the hex string instead and let three
 * do the linear round trip.
 */
function tokenRgb01(name: string, fallback: string): [number, number, number] {
  const [r, g, b] = parseCssColor(token(name, fallback));
  return [r / 255, g / 255, b / 255];
}

/* ------------------------------------------------------------------------- shaders */

const LIMB_VERTEX = `
varying vec3 vNormal;
varying vec2 vUv;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Flat stock with an inked limb.
 *
 * `f` is the facing ratio: 0 at the sub-camera point, 1 at the silhouette. Raised to a
 * high power it stays at nothing across the whole disc and only climbs in the last few
 * degrees, which lands the ink as a hairline hard against the edge rather than as a
 * shaded terminator. That is how an engraver draws a sphere: the body is untouched
 * paper and the roundness is one line at the limb.
 */
const GLOBE_FRAGMENT = `
uniform sampler2D uMap;
uniform vec3 uLimb;
varying vec3 vNormal;
varying vec2 vUv;
void main() {
  vec3 base = texture2D(uMap, vUv).rgb;

  /* A very shallow gradient across the disc. Enough to say sphere rather than disc,
     far too little to read as a lit ball — a hand-coloured plate is washed evenly and
     gets its roundness from the drawing, so the shading here only has to keep the limb
     from looking pasted on. */
  vec3 n = normalize(vNormal);
  float lambert = clamp(dot(n, normalize(vec3(-0.35, 0.45, 0.92))), 0.0, 1.0);
  base *= 0.88 + 0.12 * lambert;

  /* The inked limb. f is the facing ratio, 0 at the sub-camera point and 1 at the
     silhouette; raised this high it stays at nothing across the whole disc and climbs
     only in the last few degrees, landing as a hairline hard against the edge rather
     than as a shaded terminator. */
  float f = pow(1.0 - clamp(dot(n, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 16.0);
  gl_FragColor = vec4(mix(base, uLimb, f * 0.92), 1.0);
}
`;

/* ------------------------------------------------------------------------- easings */

const easeOutQuart = (t: number): number => 1 - (1 - t) ** 4;

/**
 * Overshoots by ~10%, which drives the pin a hair into the surface before it settles —
 * the difference between a marker appearing and a pin being planted.
 */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/* ------------------------------------------------------------------ WebGL preflight */

type LoseContextCapable = {
  getExtension(name: 'WEBGL_lose_context'): { loseContext(): void } | null;
};

let webglSupported: boolean | null = null;

function hasWebGL(): boolean {
  if (webglSupported !== null) return webglSupported;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (gl) {
      // Hand the probe context straight back. Browsers cap the number of live GL
      // contexts (commonly 16) and the real Canvas below needs one of them; without
      // this, repeatedly opening the reveal eventually starves it.
      (gl as LoseContextCapable).getExtension('WEBGL_lose_context')?.loseContext();
    }
    webglSupported = gl !== null;
  } catch {
    webglSupported = false;
  }
  return webglSupported;
}

/* ------------------------------------------------------------- coastline topology */

type CoastProps = { name?: string };
type WorldObjects = { countries: GeometryCollection<CoastProps> };

/**
 * Parsed once per session and kept as a plain Float32Array rather than as a live
 * BufferGeometry: the array survives unmount, so a second reveal is instant, while the
 * GPU resources stay owned by — and disposed with — the mount that created them.
 */
let coastCache: Float32Array | null = null;
/** Painted alongside the coastlines from the same parse, and cached for the session. */
let earthCache: HTMLCanvasElement | null = null;
let coastRequest: Promise<Float32Array | null> | null = null;

function writeVertex(out: Float32Array, offset: number, point: Position, radius: number): number {
  const [x, y, z] = lonLatToVec3(point[0], point[1]);
  out[offset] = x * radius;
  out[offset + 1] = y * radius;
  out[offset + 2] = z * radius;
  return offset + 3;
}

/**
 * Country outlines as one LineSegments buffer. Rings are collected first so the exact
 * vertex count is known before allocating — the 50 m topology expands to well over a
 * hundred thousand segments and growing a plain array to that size churns memory
 * during the one frame the reveal can least afford it.
 */
function buildCoastPositions(fc: FeatureCollection<GeometryObject, CoastProps>): Float32Array {
  const rings: Position[][] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (g.type === 'Polygon') {
      for (const ring of g.coordinates) rings.push(ring);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) for (const ring of poly) rings.push(ring);
    }
  }

  let segments = 0;
  for (const ring of rings) segments += Math.max(0, ring.length - 1);

  const out = new Float32Array(segments * 6);
  let o = 0;
  for (const ring of rings) {
    for (let i = 0; i + 1 < ring.length; i++) {
      o = writeVertex(out, o, ring[i], COAST_RADIUS);
      o = writeVertex(out, o, ring[i + 1], COAST_RADIUS);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ earth texture */

/**
 * The globe's surface, painted once onto an offscreen canvas.
 *
 * Drawing filled continents as 3D geometry would mean triangulating 195 polygons onto a
 * sphere; painting them flat and wrapping the result costs one canvas and reuses the
 * projection maths d3 already has. 2048×1024 is the smallest size at which a coastline
 * still reads as a line rather than a staircase at the zoom the fly-in ends on.
 *
 * The mapping is equirectangular, which is exactly what THREE.SphereGeometry's own UVs
 * are: u runs 0..1 for longitude −180..180, and v is 1 at the north pole, which with the
 * default `flipY` puts the top row of the image at the top of the globe. So no offset or
 * flip is needed — the canvas is drawn in plate carrée and lands where it should.
 */
const TEXTURE_W = 2048;
const TEXTURE_H = 1024;

/** Continent washes, deepened for the globe: this reads as the Earth, not as a chart. */
const GLOBE_WASH: Readonly<Record<string, string>> = {
  Africa: '--wash-africa',
  Americas: '--wash-americas',
  Asia: '--wash-asia',
  Europe: '--wash-europe',
  Oceania: '--wash-oceania',
};

/** ISO numeric ids that are drawn as permanent ice rather than as territory. */
const ICE_IDS = new Set(['010', '304']); // Antarctica, Greenland

const REGION_BY_ID: ReadonlyMap<string, string> = new Map(
  COUNTRIES.map((c) => [c.id, c.region] as const),
);

function buildEarthCanvas(fc: FeatureCollection<GeometryObject, CoastProps>): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_W;
  canvas.height = TEXTURE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = token('--ocean', '#4a6e88');
  ctx.fillRect(0, 0, TEXTURE_W, TEXTURE_H);

  const projection = geoEquirectangular()
    .translate([TEXTURE_W / 2, TEXTURE_H / 2])
    .scale(TEXTURE_W / (2 * Math.PI));
  const path = geoPath(projection, ctx);

  const land = token('--land', '#e4dcc8');
  const ice = token('--ice', '#e9edec');

  for (const f of fc.features) {
    const id = f.id === undefined || f.id === null ? '' : String(f.id).padStart(3, '0');
    const region = REGION_BY_ID.get(id);
    ctx.fillStyle = ICE_IDS.has(id)
      ? ice
      : region
        ? token(GLOBE_WASH[region] ?? '--land', land)
        : land;
    ctx.beginPath();
    path(f);
    ctx.fill();
  }

  /* Coastlines last, so every wash is already down and the ink sits on top of all of
     them — the order a plate was actually printed and then coloured in reverse. */
  ctx.strokeStyle = token('--ink', '#17140f');
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.55;
  for (const f of fc.features) {
    ctx.beginPath();
    path(f);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  return canvas;
}

function loadCoastlines(): Promise<Float32Array | null> {
  if (coastCache) return Promise.resolve(coastCache);
  if (!coastRequest) {
    coastRequest = fetch(TOPOLOGY_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`world topology responded ${res.status}`);
        return res.json() as Promise<Topology<WorldObjects>>;
      })
      .then((topo) => {
        const fc = feature(topo, topo.objects.countries);
        coastCache = buildCoastPositions(fc);
        earthCache = buildEarthCanvas(fc);
        return coastCache;
      })
      .catch((err: unknown) => {
        // A globe without outlines is still a reveal, and a later round should be free
        // to retry, so the failure is reported but never cached.
        console.warn('[GlobeReveal] world topology unavailable:', err);
        coastRequest = null;
        return null;
      });
  }
  return coastRequest;
}

function useCoastlines(): Float32Array | null {
  const [positions, setPositions] = useState<Float32Array | null>(() => coastCache);
  useEffect(() => {
    if (positions) return;
    let alive = true;
    void loadCoastlines().then((p) => {
      if (alive && p) setPositions(p);
    });
    return () => {
      alive = false;
    };
  }, [positions]);
  return positions;
}

/* ---------------------------------------------------------------- trail + geometry */

const separationDeg = (a: LonLat, b: LonLat): number => distanceKm(a, b) / EARTH_RADIUS_KM / DEG;

/**
 * The guess path as one continuous great-circle polyline, so a single drawRange can
 * reveal it progressively. Each leg is subdivided with slerpLonLat — a straight chord
 * between two guesses would cut through the planet — and lifted off the surface, both
 * to avoid z-fighting and to give long legs a visible hop.
 */
function buildTrailPositions(path: readonly LonLat[]): Float32Array | null {
  if (path.length < 2) return null;
  const out: number[] = [];
  for (let leg = 0; leg + 1 < path.length; leg++) {
    const a = path[leg];
    const b = path[leg + 1];
    const sep = separationDeg(a, b);
    if (sep < 1e-4) continue;
    const steps = Math.min(160, Math.max(10, Math.round(sep * 1.5)));
    const bulge = TRAIL_BULGE * Math.min(1, sep / 90);
    // Consecutive legs share an endpoint; only the first leg emits its start vertex.
    const from = out.length === 0 ? 0 : 1;
    for (let i = from; i <= steps; i++) {
      const t = i / steps;
      const [lon, lat] = slerpLonLat(a, b, t);
      const r = TRAIL_RADIUS + bulge * Math.sin(Math.PI * t);
      const [x, y, z] = lonLatToVec3(lon, lat);
      // slerp is undefined for exactly antipodal endpoints. Real centroids never are,
      // but a NaN here would poison the bounding sphere and cull the whole trail.
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      out.push(x * r, y * r, z * r);
    }
  }
  return out.length >= 6 ? new Float32Array(out) : null;
}

type MeshLike = { geometry: BufferGeometry; material: Material | Material[] };

function disposeRenderable(obj: MeshLike | null): void {
  if (!obj) return;
  obj.geometry.dispose();
  if (Array.isArray(obj.material)) for (const m of obj.material) m.dispose();
  else obj.material.dispose();
}

function makeLineSegments(positions: Float32Array, color: string, opacity: number): LineSegments {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
  });
  return new LineSegments(geometry, material);
}

function makeTrail(positions: Float32Array, color: string): Line {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  // Ordinary alpha blending: a drawn line sits *on* the paper. Additive would lighten
  // the cream ground towards white, which is the opposite of ink.
  const material = new LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    toneMapped: false,
  });
  return new Line(geometry, material);
}

/**
 * The graticule at 30°, as an atlas plate rules it: meridians pole to pole, parallels
 * stopping at ±60° so the lines do not knot into a solid cap where they converge.
 *
 * Segmented every few degrees rather than drawn as chords — a straight line between two
 * points 30° apart would sink through the sphere and disappear behind it.
 */
function buildGraticulePositions(): Float32Array {
  const out: number[] = [];
  const push = (lon: number, lat: number): void => {
    const [x, y, z] = lonLatToVec3(lon, lat);
    out.push(x * GRATICULE_RADIUS, y * GRATICULE_RADIUS, z * GRATICULE_RADIUS);
  };
  for (let lon = -180; lon < 180; lon += GRATICULE_STEP) {
    for (let lat = -90; lat < 90; lat += GRATICULE_RESOLUTION) {
      push(lon, lat);
      push(lon, lat + GRATICULE_RESOLUTION);
    }
  }
  for (let lat = -60; lat <= 60; lat += GRATICULE_STEP) {
    for (let lon = -180; lon < 180; lon += GRATICULE_RESOLUTION) {
      push(lon, lat);
      push(lon + GRATICULE_RESOLUTION, lat);
    }
  }
  return new Float32Array(out);
}

/**
 * A flat ocean stand-in, used for the frame or two before the topology has parsed.
 *
 * The sphere has to have *something* bound to `uMap`: sampling an unset sampler2D is
 * undefined behaviour and renders black on some drivers, which would flash a dark disc
 * in the middle of a cream page.
 */
function makeOceanFallback(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = token('--ocean', '#4a6e88');
  ctx.fillRect(0, 0, 2, 2);
  return new CanvasTexture(canvas);
}

function makeGlobeMaterial(map: CanvasTexture | null): ShaderMaterial {
  const [lr, lg, lb] = tokenRgb01('--ink', '#17140f');
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uLimb: { value: new Vector3(lr, lg, lb) },
    },
    vertexShader: LIMB_VERTEX,
    fragmentShader: GLOBE_FRAGMENT,
  });
}

/* ------------------------------------------------------------------------- aiming */

/**
 * The orientation that brings [lon, lat] to face the camera down +Z with north still up.
 *
 * Derived rather than taken from Quaternion.setFromUnitVectors: the minimal rotation
 * between two vectors carries roll, so the globe would arrive tilted for any target off
 * the prime meridian. Yawing about the pole to slide the meridian under the camera and
 * then pitching by the latitude keeps the pole in the vertical plane throughout.
 */
function aimAt(lon: number, lat: number): Quaternion {
  const yaw = new Quaternion().setFromAxisAngle(POLE, -Math.PI / 2 - lon * DEG);
  const pitch = new Quaternion().setFromAxisAngle(SCREEN_X, lat * DEG);
  return pitch.multiply(yaw);
}

/* -------------------------------------------------------------------------- scene */

interface SceneProps {
  readonly target: Country;
  readonly guessPath: readonly Country[];
  readonly coastPositions: Float32Array | null;
  readonly reduced: boolean;
}

function GlobeScene({ target, guessPath, coastPositions, reduced }: SceneProps): JSX.Element {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  const globeRef = useRef<Group>(null);
  const pinRef = useRef<Group>(null);
  const haloRef = useRef<Mesh>(null);
  const haloMaterialRef = useRef<MeshBasicMaterial>(null);
  const nodeRefs = useRef<(Mesh | null)[]>([]);
  const elapsed = useRef(0);

  const oxblood = token('--oxblood', '#7b2d26');
  const brass = token('--brass', '#a8834a');
  const ink = token('--ink', '#17140f');

  const targetVec = useMemo(
    () => new Vector3(...lonLatToVec3(target.lon, target.lat)),
    [target.lon, target.lat],
  );
  const pinQuaternion = useMemo(() => new Quaternion().setFromUnitVectors(POLE, targetVec), [targetVec]);
  const scratch = useMemo(() => new Quaternion(), []);

  const aim = useMemo(() => {
    const end = aimAt(target.lon, target.lat);
    const start = aimAt(
      target.lon - START_LON_LEAD,
      target.lat * START_LAT_FLATTEN + START_TILT_DEG,
    );
    return { start, end };
  }, [target.lon, target.lat]);

  /** Guess markers, minus the winning guess — the pin already marks that spot. */
  const nodes = useMemo(
    () =>
      guessPath
        .filter((c) => c.id !== target.id)
        .map((c, i) => {
          const [x, y, z] = lonLatToVec3(c.lon, c.lat);
          // The same country can legitimately be guessed twice, so the ordinal is part
          // of the key rather than the id alone.
          return {
            key: `${c.id}:${i}`,
            position: [x * NODE_RADIUS, y * NODE_RADIUS, z * NODE_RADIUS] as [number, number, number],
          };
        }),
    [guessPath, target.id],
  );

  const trailPositions = useMemo(() => {
    const points: LonLat[] = guessPath.map((c) => [c.lon, c.lat]);
    const last = guessPath[guessPath.length - 1];
    // A solved round already ends on the target; a give-up needs the final leg added.
    if (!last || last.id !== target.id) points.push([target.lon, target.lat]);
    return buildTrailPositions(points);
  }, [guessPath, target]);

  const coast = useMemo(
    () => (coastPositions ? makeLineSegments(coastPositions, ink, 0.62) : null),
    [coastPositions, ink],
  );
  const trail = useMemo(
    () => (trailPositions ? makeTrail(trailPositions, ink) : null),
    [trailPositions, ink],
  );
  // Faint on purpose: the graticule is the instrument the map is drawn on, and it must
  // never compete with the coastlines it sits under.
  const graticule = useMemo(
    () => makeLineSegments(buildGraticulePositions(), brass, 0.3),
    [brass],
  );
  /**
   * Rebuilt once the topology lands, which is what swaps the flat ocean for the painted
   * Earth. Keyed on `coastPositions` because the canvas is produced by the same parse —
   * if the outlines are here, the texture is too.
   */
  const globeMaterial = useMemo(() => {
    const map = earthCache ? new CanvasTexture(earthCache) : makeOceanFallback();
    if (map) {
      /**
       * Deliberately left un-managed rather than tagged sRGB.
       *
       * These shaders write straight to the framebuffer with no colour-management
       * epilogue — which is why tokenRgb01 hands them sRGB-encoded values. Tagging the
       * texture sRGB makes three decode it to linear on sample, and with nothing
       * re-encoding on the way out the whole globe renders several stops too dark and
       * oversaturated. Leaving it unmanaged means the canvas pixels arrive exactly as
       * they were painted, which is the same contract the rest of this file follows.
       */
      map.colorSpace = NoColorSpace;
      map.anisotropy = 4;
    }
    return makeGlobeMaterial(map);
  }, [coastPositions]);

  // The texture is ours rather than R3F's, so it is released with the material.
  useEffect(() => {
    return () => {
      const map = globeMaterial.uniforms.uMap?.value as CanvasTexture | null;
      map?.dispose();
      globeMaterial.dispose();
    };
  }, [globeMaterial]);

  const trailVertices = trailPositions ? trailPositions.length / 3 : 0;

  // Everything built imperatively above is owned by this mount and released with it;
  // the declarative meshes below are disposed by R3F.
  useEffect(
    () => () => {
      disposeRenderable(coast);
      disposeRenderable(trail);
      disposeRenderable(graticule);
      globeMaterial.dispose();
    },
    [coast, trail, graticule, globeMaterial],
  );

  // Under reduced motion the loop runs on demand, so the outlines arriving late need
  // an explicit repaint.
  useEffect(() => invalidate(), [invalidate, coast]);

  useFrame((_, delta) => {
    // A backgrounded tab hands back one enormous delta on return; clamping keeps the
    // fly-in from teleporting through its own choreography.
    elapsed.current += Math.min(delta, 0.05);
    const t = elapsed.current;
    const flight = reduced ? 1 : easeOutQuart(clamp01(t / FLY_SECONDS));

    const globe = globeRef.current;
    if (globe) {
      globe.quaternion.slerpQuaternions(aim.start, aim.end, flight);
      if (!reduced && t > FLY_SECONDS) {
        // Post-arrival life. An oscillation rather than a continuing spin, because a
        // spin would carry the pin off centre while the player reads the card.
        scratch.setFromAxisAngle(POLE, IDLE_AMPLITUDE * Math.sin((t - FLY_SECONDS) * IDLE_SPEED));
        globe.quaternion.multiply(scratch);
      }
    }
    camera.position.z = CAM_START_Z + (CAM_END_Z - CAM_START_Z) * flight;

    const drawn = reduced ? 1 : clamp01((t - TRAIL_START) / TRAIL_SECONDS);
    if (trail && trailVertices > 0) {
      const count = Math.round(drawn * trailVertices);
      trail.geometry.setDrawRange(0, count < 2 ? 0 : count);
    }
    for (let i = 0; i < nodeRefs.current.length; i++) {
      const node = nodeRefs.current[i];
      // Node i sits at roughly i/legs along the path, so it lights up as the line
      // reaches it. The `drawn > 0` guard keeps the first dot from sitting on an
      // otherwise empty globe during the opening wide shot.
      if (node) node.visible = drawn > 0 && drawn >= i / nodeRefs.current.length;
    }

    const pin = pinRef.current;
    if (pin) {
      const dropped = reduced ? 1 : clamp01((t - PIN_START) / PIN_SECONDS);
      pin.visible = dropped > 0;
      pin.position.copy(targetVec).multiplyScalar(1 + (1 - easeOutBack(dropped)) * PIN_DROP_HEIGHT);
    }
    const halo = haloRef.current;
    const haloMaterial = haloMaterialRef.current;
    if (halo && haloMaterial) {
      const beat = reduced ? 0 : Math.sin(t * 2.4);
      halo.scale.setScalar(1 + 0.32 * beat);
      haloMaterial.opacity = 0.3 - 0.14 * beat;
    }
  });

  return (
    <group ref={globeRef}>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 128, 80]} />
        <primitive object={globeMaterial} attach="material" dispose={null} />
      </mesh>

      <primitive object={graticule} dispose={null} />
      {coast && <primitive object={coast} dispose={null} />}
      {trail && <primitive object={trail} dispose={null} />}

      {nodes.map((node, i) => (
        <mesh
          key={node.key}
          ref={(m) => {
            nodeRefs.current[i] = m;
          }}
          position={node.position}
          visible={false}
        >
          <sphereGeometry args={[0.011, 10, 8]} />
          <meshBasicMaterial color={ink} transparent opacity={0.72} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}

      <group ref={pinRef} quaternion={pinQuaternion} visible={false}>
        <mesh position={[0, PIN_STEM / 2, 0]}>
          <cylinderGeometry args={[0.004, 0.004, PIN_STEM, 8]} />
          <meshBasicMaterial color={ink} toneMapped={false} />
        </mesh>
        <mesh position={[0, PIN_STEM, 0]}>
          <sphereGeometry args={[0.02, 16, 12]} />
          <meshBasicMaterial color={oxblood} toneMapped={false} />
        </mesh>
        {/* The old glow, redrawn as an engraved target circle: a hairline ring lying in
            the tangent plane at the pin's foot. It breathes rather than blooms. The
            ring's own hole clears the stem, so nothing z-fights the surface below. */}
        <mesh ref={haloRef} position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.05, 0.056, 64]} />
          <meshBasicMaterial
            ref={haloMaterialRef}
            color={oxblood}
            transparent
            opacity={0.3}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/* -------------------------------------------------------------------------- shell */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function hideBrokenFlag(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = 'none';
}

/** Which of the three outcome sentences this round earns. */
function outcomeKey(solved: boolean, guessCount: number): TranslationKey {
  if (guessCount === 0) return 'reveal.revealed';
  return solved ? 'reveal.solvedIn' : 'reveal.revealedAfter';
}

/**
 * The outcome, set as an engraved caption.
 *
 * The same words the dialog's accessible name uses, but with the numeral lifted into
 * mono tabular figures — a printed sheet never mixes a count into running text without
 * changing the face. The sentence is never assembled from pieces: it arrives as one
 * translated string and the `{count}` placeholder is filled with a node instead of with
 * text, so the count lands wherever the language puts it.
 */
function OutcomeLine({ template, count }: { template: string; count: string }): JSX.Element {
  const parts = template.split('{count}');
  if (parts.length !== 2) return <>{template}</>;
  return (
    <>
      {parts[0]}
      <span className="tabular font-mono text-ink">{count}</span>
      {parts[1]}
    </>
  );
}

function GlobeStage({ target, guessPath, solved, guessCount, onDone, children }: RevealProps): JSX.Element {
  const t = useTranslator();
  const reduced = usePrefersReducedMotion();
  const coastPositions = useCoastlines();
  const [entered, setEntered] = useState(false);
  const [flightDone, setFlightDone] = useState(reduced);
  const [announcement, setAnnouncement] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const sentence = outcomeKey(solved, guessCount);
  const countText = t.num(guessCount);
  const outcome = t(sentence, { count: countText });
  const name = t.country(target);
  const place = target.subregion || target.region;
  /* Capital and region arrive from the source data in Latin script and are never
     translated, so each is isolated below rather than joined into one string. */
  const facts = [t.capital(target), place].filter((value): value is string => Boolean(value));
  const summary = `${name}. ${outcome}. ${t('reveal.capital')}: ${
    t.capital(target) || t('common.none')
  }. ${t('reveal.region')}: ${place}.`;

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      // Two things that both need to happen one frame after mount: the crossfade needs
      // a paint at opacity 0 to run from, and the live region needs to be *empty* when
      // it is inserted — screen readers announce changes, and text that is already
      // there at insertion time is commonly skipped.
      setEntered(true);
      setAnnouncement(summary);
    });
    return () => cancelAnimationFrame(id);
  }, [summary]);

  useEffect(() => {
    if (reduced) {
      setFlightDone(true);
      return;
    }
    const id = window.setTimeout(() => setFlightDone(true), FLY_SECONDS * 1000 + 120);
    return () => window.clearTimeout(id);
  }, [reduced]);

  useEffect(() => {
    if (flightDone) primaryRef.current?.focus();
  }, [flightDone]);

  // The reveal covers the map, so it behaves as a modal: Escape dismisses (which also
  // lets a keyboard player cut the animation short) and Tab stays inside the card,
  // since the map beneath is still rendered and still focusable.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDone();
        return;
      }
      if (event.key !== 'Tab') return;
      const card = cardRef.current;
      if (!card) return;
      const stops = card.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      const outside = !card.contains(active);
      if (event.shiftKey ? active === first || outside : active === last || outside) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} — ${outcome}`}
      className={`ease-swift fixed inset-0 z-50 bg-paper transition-opacity duration-500 ${
        entered ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* The plate mark. A hairline rule inset from the page edge is what turns a
          full-bleed render into something printed *on* the sheet — the same device the
          icon and the reveal card use, at page scale. Purely decorative, and it sits
          above the canvas so the globe appears to be struck inside it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-10 border border-rule"
        style={{
          /* Physical on purpose: a frame inset from all four page edges by the device's
             own safe areas, and a notch does not move when the type changes direction. */
          top: 'calc(var(--inset-t) + 0.75rem)',
          right: 'calc(var(--inset-r) + 0.75rem)',
          bottom: 'calc(var(--inset-b) + 0.75rem)',
          left: 'calc(var(--inset-l) + 0.75rem)',
        }}
      />

      {/* Geography is not layout: the sphere is held left-to-right so a right-to-left
          interface cannot mirror the world inside it. Only the card below mirrors. */}
      <div aria-hidden="true" dir="ltr" className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, CAM_START_Z], fov: 38, near: 0.1, far: 120 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          frameloop={reduced ? 'demand' : 'always'}
          // The plate is printed on the same stock as the page around it, so the clear
          // colour is the paper token rather than a transparent hole over black.
          onCreated={({ gl }) => gl.setClearColor(token('--paper', '#f2ede1'), 1)}
        >
          <GlobeScene
            target={target}
            guessPath={guessPath}
            coastPositions={coastPositions}
            reduced={reduced}
          />
        </Canvas>
      </div>

      {/* Announced as soon as the round ends, without waiting for the fly-in. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {flightDone && (
        <div
          ref={cardRef}
          className="absolute inset-x-0 bottom-0 flex justify-center"
          style={{ padding: SAFE_PADDING }}
        >
          <div className="sheet animate-rise-in w-full max-w-lg p-5 sm:p-6">
            <div className="flex items-center gap-4">
              {/* Mounted rather than merely bordered: a hairline frame with a margin of
                  paper inside it, the way a plate is set into a page. */}
              <img
                src={flagUrl(target.cca2)}
                alt=""
                onError={hideBrokenFlag}
                decoding="async"
                className="h-12 w-auto shrink-0 border border-rule bg-paper p-1 shadow-sheet"
              />
              <div className="min-w-0 flex-1">
                <p className="label text-oxblood">
                  <OutcomeLine template={t(sentence)} count={countText} />
                </p>
                {/* Letterspaced capitals are what make Fraunces read as engraved rather
                    than as a book face, and they are why this wraps instead of clipping:
                    a truncated country name is the one thing the reveal cannot do. Both
                    are dropped in Arabic, where `uppercase` is inert and tracking severs
                    the joining forms. */}
                <h2 className="mt-1.5 text-balance font-display text-xl uppercase leading-tight tracking-[0.14em] text-ink rtl:tracking-normal rtl:normal-case sm:text-2xl">
                  {name}
                </h2>
                {facts.length > 0 && (
                  <p className="label mt-2 truncate">
                    {facts.map((fact, i) => (
                      <Fragment key={fact}>
                        {i > 0 && ' · '}
                        {/* Without isolation the bidi algorithm reorders these around
                            the separator: "Doha · Western Asia" comes out reversed. */}
                        <bdi>{fact}</bdi>
                      </Fragment>
                    ))}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-5 border-t border-rule pt-4">
              {children}
              <button
                ref={primaryRef}
                type="button"
                onClick={onDone}
                className="ease-swift -my-2 inline-flex items-center gap-2 border-b border-oxblood/60 py-2 text-sm font-medium text-oxblood transition-colors duration-150 hover:border-oxblood"
              >
                {t('reveal.continue')}
                {/* An arrow of travel, not a bearing: it points the way the interface
                    reads, so it reverses in a right-to-left language. */}
                <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface BoundaryProps {
  readonly fallback: ReactNode;
  readonly children: ReactNode;
}

interface BoundaryState {
  readonly failed: boolean;
}

/**
 * A driver or GPU failure inside the canvas must degrade to the DOM card, never strand
 * the player on a blank reveal with their round already scored.
 */
class RevealErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.warn('[GlobeReveal] falling back to the DOM reveal:', error);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function GlobeReveal(props: RevealProps): JSX.Element {
  const fallback = <RevealFallback {...props} />;
  if (!hasWebGL()) return fallback;
  return (
    <RevealErrorBoundary fallback={fallback}>
      <GlobeStage {...props} />
    </RevealErrorBoundary>
  );
}
