/**
 * The reveal (PRD §5) — the one place the dark cosmic direction is allowed to be loud.
 *
 * The flat map crossfades into a rotating globe, the camera flies in on the target,
 * a gold pin drops, and a faint great-circle trail traces the player's guesses across
 * the surface. Everything else in the app stays at 250 ms and understated; this is the
 * single showpiece, and it is fully skipped under prefers-reduced-motion.
 *
 * This module is lazy-loaded by the shell, which is why it may import three, R3F and
 * topojson-client at module scope. Nothing on the critical path may import it.
 */

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  LineSegments,
  Points,
  PointsMaterial,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type MeshBasicMaterial,
} from 'three';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { FeatureCollection, GeometryObject, Position } from 'geojson';
import { ArrowRight } from 'lucide-react';
import { EARTH_RADIUS_KM, clamp01, distanceKm, lonLatToVec3, slerpLonLat } from '@/lib/geo';
import { parseCssColor, toHexColor } from '@/lib/ramp';
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
const TRAIL_RADIUS = 1.012;
/** Extra height at the midpoint of a leg, scaled by how far that leg travels. */
const TRAIL_BULGE = 0.12;
const NODE_RADIUS = 1.008;
const ATMOSPHERE_RADIUS = 1.16;
const STAR_RADIUS = 34;
const PIN_STEM = 0.075;
/** How far above the surface the pin starts its drop, in globe radii. */
const PIN_DROP_HEIGHT = 0.38;

/* -------------------------------------------------------------------- choreography */

const FLY_SECONDS = 2.2;
const TRAIL_START = 0.3;
const TRAIL_SECONDS = 1.45;
const PIN_START = 1.5;
const PIN_SECONDS = 0.6;
const CAM_START_Z = 4.6;
const CAM_END_Z = 2.35;
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

const TOPOLOGY_URL = '/data/world-50m.json';

const NEBULA =
  'radial-gradient(60rem 42rem at 14% 8%, rgba(123, 108, 246, 0.20), transparent 62%),' +
  'radial-gradient(46rem 34rem at 88% 94%, rgba(79, 209, 197, 0.12), transparent 60%)';

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
 * Normalising here is load-bearing twice over: the palette tokens resolve to
 * `rgb(11 14 26)` rather than hex, and three's `Color.setStyle` does not understand
 * CSS Color 4's space-separated `rgb()` — so handing the raw value to a material
 * would fail as surely as parsing it as hex would.
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

const RIM_VERTEX = `
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Dark ocean with a limb light: f rises from 0 at the sub-camera point to 1 at the edge. */
const GLOBE_FRAGMENT = `
uniform vec3 uBase;
uniform vec3 uRim;
varying vec3 vNormal;
void main() {
  float f = pow(1.0 - clamp(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 2.4);
  gl_FragColor = vec4(uBase + uRim * f, 1.0);
}
`;

/**
 * The atmosphere is a back-side shell. Only the annulus outside the globe's silhouette
 * survives the depth test, and across it the view-space normal tips away from the
 * camera — so keying on -dot puts the brightest ring hard against the limb and fades
 * it to nothing at the shell's own edge. Alpha stays at 1 because additive blending
 * multiplies by it; the falloff is premultiplied into the colour instead.
 */
const ATMOSPHERE_FRAGMENT = `
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vNormal;
void main() {
  float f = pow(clamp(-dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 2.4);
  gl_FragColor = vec4(uColor * f * uIntensity, 1.0);
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

function loadCoastlines(): Promise<Float32Array | null> {
  if (coastCache) return Promise.resolve(coastCache);
  if (!coastRequest) {
    coastRequest = fetch(TOPOLOGY_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`world topology responded ${res.status}`);
        return res.json() as Promise<Topology<WorldObjects>>;
      })
      .then((topo) => {
        coastCache = buildCoastPositions(feature(topo, topo.objects.countries));
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
  const material = new LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  return new Line(geometry, material);
}

/**
 * A fixed starfield. Seeded rather than Math.random so the sky is identical on every
 * reveal — a field that reshuffles between rounds reads as a glitch.
 */
function makeStars(color: string): Points {
  const COUNT = 900;
  const arr = new Float32Array(COUNT * 3);
  let seed = 0x9e3779b9;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < COUNT; i++) {
    // Uniform over the sphere needs a uniform cos(θ); sampling θ directly clumps at
    // the poles.
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = STAR_RADIUS * (0.85 + rand() * 0.3);
    arr[i * 3] = s * Math.cos(phi) * r;
    arr[i * 3 + 1] = u * r;
    arr[i * 3 + 2] = s * Math.sin(phi) * r;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(arr, 3));
  const material = new PointsMaterial({
    color,
    size: 0.06,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new Points(geometry, material);
  points.renderOrder = -1;
  return points;
}

function makeGlobeMaterial(): ShaderMaterial {
  const [br, bg, bb] = tokenRgb01('--terrain', '#1c2238');
  const [cr, cg, cb] = tokenRgb01('--cyan', '#4fd1c5');
  return new ShaderMaterial({
    uniforms: {
      uBase: { value: new Vector3(br, bg, bb) },
      uRim: { value: new Vector3(cr * 0.3, cg * 0.3, cb * 0.3) },
    },
    vertexShader: RIM_VERTEX,
    fragmentShader: GLOBE_FRAGMENT,
  });
}

function makeAtmosphereMaterial(): ShaderMaterial {
  const [r, g, b] = tokenRgb01('--cyan', '#4fd1c5');
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Vector3(r, g, b) },
      uIntensity: { value: 2.6 },
    },
    vertexShader: RIM_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    side: BackSide,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
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

  const gold = token('--gold', '#e8b34d');
  const cyan = token('--cyan', '#4fd1c5');
  const parchment = token('--parchment', '#f4f1ea');

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
    () => (coastPositions ? makeLineSegments(coastPositions, parchment, 0.5) : null),
    [coastPositions, parchment],
  );
  const trail = useMemo(
    () => (trailPositions ? makeTrail(trailPositions, cyan) : null),
    [trailPositions, cyan],
  );
  const stars = useMemo(() => makeStars(parchment), [parchment]);
  const globeMaterial = useMemo(makeGlobeMaterial, []);
  const atmosphereMaterial = useMemo(makeAtmosphereMaterial, []);

  const trailVertices = trailPositions ? trailPositions.length / 3 : 0;

  // Everything built imperatively above is owned by this mount and released with it;
  // the declarative meshes below are disposed by R3F.
  useEffect(
    () => () => {
      disposeRenderable(coast);
      disposeRenderable(trail);
      disposeRenderable(stars);
      globeMaterial.dispose();
      atmosphereMaterial.dispose();
    },
    [coast, trail, stars, globeMaterial, atmosphereMaterial],
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
    <>
      <primitive object={stars} dispose={null} />

      {/* Outside the spinning group: a sphere is rotation-invariant, so spinning it
          would only cost transform updates. */}
      <mesh>
        <sphereGeometry args={[ATMOSPHERE_RADIUS, 48, 32]} />
        <primitive object={atmosphereMaterial} attach="material" dispose={null} />
      </mesh>

      <group ref={globeRef}>
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS, 128, 80]} />
          <primitive object={globeMaterial} attach="material" dispose={null} />
        </mesh>

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
            <meshBasicMaterial color={cyan} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}

        <group ref={pinRef} quaternion={pinQuaternion} visible={false}>
          <mesh position={[0, PIN_STEM / 2, 0]}>
            <cylinderGeometry args={[0.004, 0.004, PIN_STEM, 8]} />
            <meshBasicMaterial color={gold} toneMapped={false} />
          </mesh>
          <mesh position={[0, PIN_STEM, 0]}>
            <sphereGeometry args={[0.02, 16, 12]} />
            <meshBasicMaterial color={gold} toneMapped={false} />
          </mesh>
          <mesh ref={haloRef} position={[0, PIN_STEM, 0]}>
            <sphereGeometry args={[0.055, 16, 12]} />
            <meshBasicMaterial
              ref={haloMaterialRef}
              color={gold}
              transparent
              opacity={0.3}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>
    </>
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

const plural = (n: number): string => (n === 1 ? 'guess' : 'guesses');

function hideBrokenFlag(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = 'none';
}

function GlobeStage({ target, guessPath, solved, guessCount, onDone, children }: RevealProps): JSX.Element {
  const reduced = usePrefersReducedMotion();
  const coastPositions = useCoastlines();
  const [entered, setEntered] = useState(false);
  const [flightDone, setFlightDone] = useState(reduced);
  const [announcement, setAnnouncement] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const outcome = solved
    ? `Solved in ${guessCount} ${plural(guessCount)}`
    : guessCount > 0
      ? `Revealed after ${guessCount} ${plural(guessCount)}`
      : 'Revealed';
  const place = target.subregion || target.region;
  const subtitle = [target.capital, place].filter(Boolean).join(' · ');
  const summary = `${target.name}. ${outcome}. Capital: ${target.capital ?? 'none listed'}. Region: ${place}.`;

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
      aria-label={`${target.name} — ${outcome}`}
      className={`ease-swift fixed inset-0 z-50 bg-space transition-opacity duration-500 ${
        entered ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: NEBULA }} />

      <div aria-hidden="true" className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, CAM_START_Z], fov: 38, near: 0.1, far: 120 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          frameloop={reduced ? 'demand' : 'always'}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
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
          <div className="hud-panel animate-rise-in w-full max-w-lg rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <img
                src={`/flags/${target.cca2}.webp`}
                alt=""
                onError={hideBrokenFlag}
                decoding="async"
                className="h-11 w-auto shrink-0 rounded border border-hairline shadow-hud"
              />
              <div className="min-w-0 flex-1">
                <p className="text-hud tabular font-mono uppercase text-gold">{outcome}</p>
                <h2 className="font-display truncate text-2xl leading-tight text-parchment sm:text-3xl">
                  {target.name}
                </h2>
                {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-hairline pt-4">
              {children}
              <button
                ref={primaryRef}
                type="button"
                onClick={onDone}
                className="ease-swift inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-space transition-colors duration-200 hover:bg-gold/90"
              >
                Continue
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
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
