/**
 * The playing surface: an equal-area world chart that accepts a guess per country.
 *
 * Drawn as an engraved chart rather than a screen: flat inked ground, hairline
 * coastlines, and no fill that is not carrying information. Ocean is a shade darker than
 * land, which is the relationship a printed atlas has always used to separate water from
 * territory on light stock — invert it and the eye reads the sea as the continent.
 *
 * Design notes that are not obvious from the code:
 *
 * · Projection is Equal Earth. The game is decided by distance intuition, and any
 *   conformal projection (Mercator above all) inflates high latitudes so badly that
 *   "Greenland looks continental" becomes a systematic lie about proximity.
 *
 * · The heatmap is centred on the player's *guesses*, never on the answer. Each wrong
 *   guess contributes a ring — the answer lies exactly that far away — and a country is
 *   inked by how well it satisfies every ring at once. Centring on the answer instead
 *   would hand the game away: a field peaking at the target makes the target the most
 *   heavily inked country on the map, and even a flat-filled disc betrays its own centre.
 *   Rings reveal nothing alone and only pin a location where they intersect, which is
 *   the triangulation the HUD readout has always described.
 *
 * · All 195 fills are recomputed together and memoised on `targetId` + `rings`; nothing
 *   else may invalidate them, because a zoom frame that recomputed 195×N haversines
 *   would drop frames.
 *
 * · Colour is never the only proximity signal — the HUD's compass arrow and kilometre
 *   readout carry the same information independently, and the ramp descends in luminance
 *   so it survives greyscale.
 *
 * · The chart itself is held to `dir="ltr"`. Geography is not layout: a right-to-left
 *   interface mirrors the controls around the map, but flipping the world would put the
 *   Atlantic east of Africa. The skip control, the zoom cluster and the safe-area insets
 *   all mirror; everything inside the projection does not.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  Marker,
  Sphere,
  ZoomableGroup,
  useZoomPanContext,
} from 'react-simple-maps';
import { Maximize2, Minus, Plus } from 'lucide-react';

import { COUNTRIES, INERT_NAMES } from '@/data/countries.generated';
import { useTranslator } from '@/i18n';
import type { Country } from '@/types/game';
import type { DistanceRing } from '@/lib/geo';
import { quantizeBands, ringConsistency, ringTolerance } from '@/lib/geo';
import { rampColor } from '@/lib/ramp';
import { TOPOLOGY_URL as GEO_URL } from '@/lib/paths';
import { toCountryId, useCountryLookup } from '@/components/map/useCountryLookup';

const MIN_ZOOM = 1;
/** Generous on purpose: Monaco is 12 km² and needs real magnification to be legible. */
const MAX_ZOOM = 24;
const ZOOM_STEP = 1.8;

/**
 * Extent of the Equal Earth projection at `scale(1)`, measured from
 * `geoPath(geoEqualEarth().scale(1).translate([0,0])).bounds({type:'Sphere'})`.
 * react-simple-maps never fits the projection to the viewport, so we derive the scale
 * ourselves instead of inheriting d3's 960px-wide default.
 */
const EE_WIDTH_AT_SCALE_1 = 5.4132599673921495;
const EE_HEIGHT_AT_SCALE_1 = 2.6347255183148266;
/** A hair of slack so the sphere's outline stroke is not clipped by the viewBox edge. */
const FIT_INSET = 0.98;

/** A pointer that moved further or lingered longer than this was a pan, not a guess. */
const TAP_SLOP_PX = 6;
const TAP_MAX_MS = 500;
/**
 * d3-zoom keeps double-click-to-zoom, and a double tap is two press/release pairs.
 * Without this window the gesture would spend two guesses on one country.
 */
const REPEAT_GUESS_MS = 400;

/* SVG paint, so these are colour strings rather than Tailwind classes — but still
   derived from the palette tokens so the map cannot drift from the rest of the UI. */

/** Playable territory, before any ring has tinted it. */
const LAND_FILL = 'var(--land)';
/**
 * Territory the game never plays. A quieter stock than `LAND_FILL` rather than a
 * different hue: the difference has to be legible at a glance, without hovering, but it
 * must not compete with the heatmap for attention.
 */
const INERT_FILL = 'var(--leaf)';
const INERT_STROKE = 'var(--coast)';
const COAST_STROKE = 'rgb(var(--coast-rgb) / 0.9)';
const GUESSED_STROKE = 'rgb(var(--ink-rgb) / 0.75)';
const LAST_GUESS_STROKE = 'var(--oxblood)';
const MICRO_RING = 'rgb(var(--ink-rgb) / 0.5)';
/* The graticule is a reference grid, not a feature: barely more than a crease in the
   paper, and it must never read as a border. */
const GRATICULE_STROKE = 'rgb(var(--ink-rgb) / 0.07)';

const FILL_TRANSITION = 'fill 200ms cubic-bezier(0.22, 1, 0.36, 1), stroke 150ms linear';

/**
 * Tailwind's focus ring is a box-shadow, and SVG elements do not paint box-shadows —
 * so the global `:focus-visible` rule leaves 234 keyboard targets with no visible
 * focus at all. An `outline` does render on SVG, and this selector outranks the
 * global rule without needing `!important`. Drawn in ink, because a printed sheet
 * indicates focus with a rule rather than a colour.
 */
const FOCUS_CSS = `
.mrd-map [tabindex='0']:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
}
.mrd-map [tabindex]:focus:not(:focus-visible) {
  outline: none;
}
`;

/** The 39 countries too small to tap at world zoom; they get markers as well as paths. */
const MICRO_COUNTRIES: readonly Country[] = COUNTRIES.filter((c) => c.micro);

/**
 * A topology feature after react-simple-maps has attached its cached path string.
 * The library types this as `any`; narrowing it here keeps the rest of the file honest.
 */
interface PreparedGeography {
  readonly rsmKey: string;
  readonly svgPath: string;
  readonly id?: string | number;
  readonly properties?: { readonly name?: string };
}

export interface WorldMapProps {
  targetId: string;
  /**
   * One entry per *wrong* guess. A correct guess would contribute a zero-radius ring
   * centred on the answer, which is the exact leak this mechanic exists to avoid.
   */
  rings: readonly DistanceRing[];
  guessedIds: ReadonlySet<string>;
  lastGuessId: string | null;
  disabled: boolean;
  onGuess(countryId: string): void;
}

/** Tracks one pointer gesture so a pan or a pinch can never be mistaken for a guess. */
interface Gesture {
  x: number;
  y: number;
  t: number;
  /** Peak simultaneous pointers; anything above 1 was a pinch. */
  pointers: number;
  /** False when the gesture opened with a non-primary button — never a guess. */
  primary: boolean;
  tap: boolean;
}

export function WorldMap({
  targetId,
  rings,
  guessedIds,
  lastGuessId,
  disabled,
  onGuess,
}: WorldMapProps) {
  const t = useTranslator();
  const { byId, isPlayable } = useCountryLookup();
  const containerRef = useRef<HTMLDivElement>(null);
  const skipTargetRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  /* The map is edge to edge, so its pixel size is whatever the shell gives it. The
     viewBox is kept 1:1 with CSS pixels, which makes every "keep this 14px" rule below
     a plain division by the zoom factor. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      const w = Math.max(1, Math.round(box.width));
      const h = Math.max(1, Math.round(box.height));
      /* Debounced because the size is a remount key below: applying it mid-drag would
         tear the map down and rebuild it on every frame of a window resize. */
      if (settle) clearTimeout(settle);
      settle = setTimeout(() => {
        setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
      }, 140);
    });
    observer.observe(el);
    // Measure once synchronously so the first paint is not delayed by the debounce.
    const first = el.getBoundingClientRect();
    setSize({ w: Math.max(1, Math.round(first.width)), h: Math.max(1, Math.round(first.height)) });
    return () => {
      if (settle) clearTimeout(settle);
      observer.disconnect();
    };
  }, []);

  const projectionConfig = useMemo(
    () => ({
      scale: size
        ? Math.min(size.w / EE_WIDTH_AT_SCALE_1, size.h / EE_HEIGHT_AT_SCALE_1) * FIT_INSET
        : 1,
    }),
    [size],
  );

  /* ---------------------------------------------------------------- heatmap ---- */

  const fills = useMemo(() => {
    const next = new Map<string, string>();
    if (!byId.has(targetId)) return next;
    const tolerance = ringTolerance(rings);
    /* Only HEAT_BANDS distinct colours are ever used, so resolving each one once and
       reusing it keeps this to a handful of ramp evaluations instead of 195. */
    const paint = new Map<number, string>();
    for (const c of COUNTRIES) {
      const band = quantizeBands(ringConsistency([c.lon, c.lat], rings, tolerance));
      if (band <= 0) {
        next.set(c.id, LAND_FILL);
        continue;
      }
      let colour = paint.get(band);
      if (colour === undefined) {
        colour = rampColor(band);
        paint.set(band, colour);
      }
      next.set(c.id, colour);
    }
    return next;
  }, [byId, targetId, rings]);

  /* ------------------------------------------------------- guess dispatching ---- */

  /* Both are read from click handlers that are deliberately stable, so the 241 memoised
     paths never re-render just because the parent handed us a fresh closure. */
  const onGuessRef = useRef(onGuess);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    onGuessRef.current = onGuess;
  }, [onGuess]);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const lastAcceptedRef = useRef<{ id: string; at: number }>({ id: '', at: 0 });

  const commitGuess = useCallback((countryId: string) => {
    if (disabledRef.current) return;
    const now = performance.now();
    const prev = lastAcceptedRef.current;
    if (prev.id === countryId && now - prev.at < REPEAT_GUESS_MS) return;
    lastAcceptedRef.current = { id: countryId, at: now };
    onGuessRef.current(countryId);
  }, []);

  const activePointersRef = useRef<Set<number>>(new Set());
  const gestureRef = useRef<Gesture>({
    x: 0,
    y: 0,
    t: 0,
    pointers: 0,
    primary: false,
    tap: false,
  });

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const active = activePointersRef.current;
    active.add(event.pointerId);
    const gesture = gestureRef.current;
    if (active.size === 1) {
      gesture.x = event.clientX;
      gesture.y = event.clientY;
      gesture.t = performance.now();
      gesture.pointers = 1;
      gesture.primary = event.button === 0;
      gesture.tap = false;
      return;
    }
    /* A second finger means a pinch. Poison the whole gesture: releasing either finger
       must not drop a guess wherever the pinch happened to start. */
    gesture.pointers = Math.max(gesture.pointers, active.size);
    gesture.tap = false;
  }, []);

  /* Listening on `window` guarantees the release is seen even when the finger lifts
     outside the map — otherwise a stale pointer would linger and make the next tap look
     like a pinch. The listener is in the CAPTURE phase so the verdict is settled before
     the released country's own `pointerup` handler runs. */
  useEffect(() => {
    const finish = (event: PointerEvent) => {
      if (!activePointersRef.current.delete(event.pointerId)) return;
      const gesture = gestureRef.current;
      if (event.type === 'pointercancel') {
        gesture.tap = false;
        return;
      }
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      gesture.tap =
        gesture.primary &&
        gesture.pointers === 1 &&
        performance.now() - gesture.t <= TAP_MAX_MS &&
        dx * dx + dy * dy <= TAP_SLOP_PX * TAP_SLOP_PX;
    };
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', finish, true);
    return () => {
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', finish, true);
    };
  }, []);

  /* Deliberately driven by `pointerup`, not `click`: d3-zoom leaves its `clickDistance`
     at 0, so it suppresses the click after *any* mouse movement during the press. A one
     pixel hand tremor would silently swallow the guess. Pointer events also give touch
     and pen the same code path, with the slop and pinch rules above doing the real
     click-versus-drag work. */
  const handlePointerGuess = useCallback(
    (countryId: string) => {
      const gesture = gestureRef.current;
      if (!gesture.tap) return;
      /* Consume the verdict so nothing else in this release can reuse it. */
      gesture.tap = false;
      commitGuess(countryId);
    },
    [commitGuess],
  );

  /* SVG shapes are not buttons: Enter and Space do not synthesise a click for them, so
     keyboard activation is wired explicitly — and bypasses the tap test, which only
     describes pointers. */
  const handleKeyGuess = useCallback(
    (event: ReactKeyboardEvent<SVGPathElement>, countryId: string) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      event.preventDefault();
      commitGuess(countryId);
    },
    [commitGuess],
  );

  /* ----------------------------------------------------------- view controls ---- */

  const [view, setView] = useState<{ center: [number, number]; zoom: number }>({
    center: [0, 0],
    zoom: 1,
  });

  /* react-simple-maps only re-applies `center`/`zoom` when they differ from the last
     position it observed, so mirroring the user's own gestures into state is what keeps
     the buttons below able to move the map afterwards. Fires once per gesture. */
  const handleMoveEnd = useCallback((position: { coordinates: [number, number]; zoom: number }) => {
    setView({ center: position.coordinates, zoom: position.zoom });
  }, []);

  const nudgeZoom = useCallback((factor: number) => {
    setView((prev) => ({
      center: prev.center,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor)),
    }));
  }, []);

  const resetView = useCallback(() => {
    setView({ center: [0, 0], zoom: 1 });
  }, []);

  const allowZoomGesture = useCallback((event: SVGElement): boolean => {
    /* The published types call this an SVGElement; d3-zoom actually passes the source
       DOM event. d3's default filter also rejects `ctrlKey`, which is exactly the flag
       browsers set for a trackpad pinch — keeping that rejection would hand the pinch to
       browser page zoom instead of the map. */
    const source = event as unknown as { button?: number; type?: string };

    /* Reject double-click-to-zoom. In a game where clicking IS the move, a player who
       taps a country twice — the natural thing to do when unsure — gets the viewport
       flung at it instead. Zoom stays available through the wheel, pinch, and the
       explicit buttons, so nothing is lost by refusing it here. */
    if (source.type === 'dblclick') return false;

    // Only the secondary mouse button is otherwise refused.
    return !source.button;
  }, []);

  const skipMap = useCallback(() => {
    skipTargetRef.current?.focus();
  }, []);

  const enabled = !disabled;

  /* Safe-area insets are physical — a notch stays on the side of the device it is on,
     whichever way the type runs — so the logical edge has to pick the matching one. */
  const insetStart = t.dir === 'rtl' ? 'var(--inset-r)' : 'var(--inset-l)';

  return (
    <div
      ref={containerRef}
      /* `touch-none` hands every touch gesture to d3-zoom; without it iOS steals the
         pinch for page zoom and the map judders. */
      className="mrd-map relative h-full w-full select-none overflow-hidden bg-paper touch-none"
      onPointerDownCapture={handlePointerDown}
    >
      <style>{FOCUS_CSS}</style>

      {/* 234 focusable countries is a long tab tunnel; this is the way out of it. */}
      <button
        type="button"
        onClick={skipMap}
        className="sheet absolute start-3 top-3 z-30 -translate-y-[200%] px-3 py-2 text-sm text-ink shadow-lifted transition-transform duration-200 ease-swift focus-visible:translate-y-0"
      >
        {t('play.skipMap')}
      </button>

      <div
        className="pointer-events-none absolute bottom-0 start-0 z-20 flex"
        style={{
          paddingBottom: 'calc(1rem + var(--inset-b))',
          paddingInlineStart: `calc(1rem + ${insetStart})`,
        }}
      >
        {/* An instrument face laid on the chart: square-cut, three keys stacked behind
            one hairline, dividers rather than gaps. */}
        <div className="sheet pointer-events-auto flex flex-col overflow-hidden rounded-none shadow-lifted">
          <MapControlButton label={t('play.zoomIn')} onClick={() => nudgeZoom(ZOOM_STEP)}>
            <Plus size={16} strokeWidth={1.75} />
          </MapControlButton>
          <div aria-hidden="true" className="h-px bg-rule" />
          <MapControlButton label={t('play.zoomOut')} onClick={() => nudgeZoom(1 / ZOOM_STEP)}>
            <Minus size={16} strokeWidth={1.75} />
          </MapControlButton>
          <div aria-hidden="true" className="h-px bg-rule" />
          {/* The shell forwards its own "Recentre the map" key to this control by
              matching this accessible name, so both sides read it from `play.resetView`
              rather than from a literal that only agrees in English. */}
          <MapControlButton label={t('play.resetView')} onClick={resetView}>
            <Maximize2 size={15} strokeWidth={1.75} />
          </MapControlButton>
        </div>
      </div>

      {size && (
        /* The one element in the app that is pinned left-to-right. `dir` is inherited,
           so without this the projection would sit in a right-to-left context — and the
           chart, its controls and any future in-map type would be free to mirror. */
        <div dir="ltr" className="h-full w-full">
          <ComposableMap
            /* Remount on resize. react-simple-maps caches each feature's projected path
               string when it first parses the topology and never re-derives it when the
               projection changes, so a rotated phone keeps drawing the world at the old
               scale — at 375px wide the world spanned 485px and could not be seen whole.
               Rebuilding is the only reliable way to re-project; the debounce above keeps
               it to once per settled resize, and the topology is already cached. */
            key={`${size.w}x${size.h}`}
            projection="geoEqualEarth"
            projectionConfig={projectionConfig}
            width={size.w}
            height={size.h}
            role="group"
            aria-label={t('play.mapLabel')}
            className="block h-full w-full"
          >
            <ZoomableGroup
              center={view.center}
              zoom={view.zoom}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              /* Keeps the world inside the viewport: without it the map can be flung into
                 empty space and the player has to hunt for it. */
              translateExtent={[
                [0, 0],
                [size.w, size.h],
              ]}
              filterZoomEvent={allowZoomGesture}
              onMoveEnd={handleMoveEnd}
            >
              {/* The ocean. Deliberately darker than either land tone: on light stock the
                  water has to be the heavier ink or the chart reads inside out. */}
              <Sphere
                id="mrd-sphere"
                fill="var(--sea)"
                stroke="var(--coast)"
                strokeWidth={0.75}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
              <Graticule
                step={[20, 20]}
                fill="none"
                stroke={GRATICULE_STROKE}
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />

              <Geographies geography={GEO_URL}>
                {({ geographies }) => {
                  const features = geographies as readonly PreparedGeography[];
                  const last = lastGuessId
                    ? features.find((g) => toCountryId(g.id) === lastGuessId)
                    : undefined;

                  return (
                    <>
                      {features.map((geography) => {
                        const id = toCountryId(geography.id);
                        const name = geography.properties?.name ?? '';
                        /* Three ways to be inert: an id the game does not play, a Natural
                           Earth name flagged as disputed/non-state, or no id at all. */
                        const country =
                          isPlayable(geography.id) && !INERT_NAMES.has(name)
                            ? byId.get(id)
                            : undefined;

                        if (!country) {
                          return (
                            <CountryPath
                              key={geography.rsmKey}
                              geography={geography}
                              countryId=""
                              label={null}
                              enabled={false}
                              fill={INERT_FILL}
                              stroke={INERT_STROKE}
                              strokeWidth={0.5}
                              onPointerGuess={handlePointerGuess}
                              onKeyGuess={handleKeyGuess}
                            />
                          );
                        }

                        const guessed = guessedIds.has(country.id);
                        const isLast = country.id === lastGuessId;
                        /* The spoken name of a country is the player's own name for it,
                           and "already guessed" is one key with the name substituted in —
                           the two halves swap order between languages. */
                        const localised = t.country(country);
                        return (
                          <CountryPath
                            key={geography.rsmKey}
                            geography={geography}
                            countryId={country.id}
                            label={
                              guessed
                                ? t('play.a11y.alreadyGuessed', { country: localised })
                                : localised
                            }
                            enabled={enabled}
                            fill={fills.get(country.id) ?? LAND_FILL}
                            stroke={
                              isLast
                                ? LAST_GUESS_STROKE
                                : guessed
                                  ? GUESSED_STROKE
                                  : COAST_STROKE
                            }
                            strokeWidth={isLast ? 1.6 : guessed ? 1.1 : 0.5}
                            onPointerGuess={handlePointerGuess}
                            onKeyGuess={handleKeyGuess}
                          />
                        );
                      })}

                      {/* Neighbouring outlines overpaint each other, so the most recent
                          guess is redrawn on top where it cannot be half-hidden. */}
                      {last && (
                        <path
                          d={last.svgPath}
                          fill="none"
                          stroke={LAST_GUESS_STROKE}
                          strokeWidth={2.25}
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                          pointerEvents="none"
                        />
                      )}
                    </>
                  );
                }}
              </Geographies>

              <MicroMarkerLayer
                fills={fills}
                guessedIds={guessedIds}
                lastGuessId={lastGuessId}
                enabled={enabled}
                onPointerGuess={handlePointerGuess}
                onKeyGuess={handleKeyGuess}
              />
            </ZoomableGroup>
          </ComposableMap>
        </div>
      )}

      <span ref={skipTargetRef} tabIndex={-1} className="sr-only">
        {t('play.endOfMap')}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces ---- */

function MapControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center text-graphite transition-colors duration-200 ease-swift hover:bg-ink/5 hover:text-ink active:text-oxblood"
    >
      <span aria-hidden="true" className="flex items-center justify-center">
        {children}
      </span>
    </button>
  );
}

interface CountryPathProps {
  geography: PreparedGeography;
  countryId: string;
  /** `null` marks inert terrain: no name, no focus, no pointer, no hover. */
  label: string | null;
  enabled: boolean;
  fill: string;
  stroke: string;
  strokeWidth: number;
  onPointerGuess(countryId: string): void;
  onKeyGuess(event: ReactKeyboardEvent<SVGPathElement>, countryId: string): void;
}

/**
 * One country path. Memoised because a single guess re-tints all 195 playable fills
 * while leaving most strokes untouched — shallow-comparing the resolved fill and stroke
 * means only the countries that actually changed re-render. The `geography` object is
 * referentially stable between renders (react-simple-maps memoises its prepared feature
 * list), so it participates in that comparison for free.
 */
const CountryPath = memo(function CountryPath({
  geography,
  countryId,
  label,
  enabled,
  fill,
  stroke,
  strokeWidth,
  onPointerGuess,
  onKeyGuess,
}: CountryPathProps) {
  const playable = label !== null;
  const active = playable && enabled;

  /* No `outline: none` here — an inline outline would beat the stylesheet rule above
     and silently delete the keyboard focus indicator. */
  const base: CSSProperties = {
    fill,
    stroke,
    strokeWidth,
    strokeLinejoin: 'round',
    cursor: active ? 'pointer' : 'default',
    transition: FILL_TRANSITION,
  };
  /* react-simple-maps applies `hover` on keyboard focus too, so this doubles as the
     focus treatment for the country fill. */
  const lifted: CSSProperties = active
    ? { ...base, stroke: 'var(--oxblood)', strokeWidth: Math.max(strokeWidth, 1.75) }
    : base;

  return (
    <Geography
      geography={geography}
      /* Strokes are hairlines at world zoom and must stay hairlines at 24×. */
      vectorEffect="non-scaling-stroke"
      tabIndex={active ? 0 : -1}
      role={playable ? 'button' : undefined}
      aria-label={label ?? undefined}
      aria-disabled={playable && !enabled ? true : undefined}
      aria-hidden={playable ? undefined : true}
      onPointerUp={active ? () => onPointerGuess(countryId) : undefined}
      onKeyDown={active ? (event) => onKeyGuess(event, countryId) : undefined}
      style={{ default: base, hover: lifted, pressed: lifted }}
    />
  );
});

interface MicroMarkerLayerProps {
  fills: ReadonlyMap<string, string>;
  guessedIds: ReadonlySet<string>;
  lastGuessId: string | null;
  enabled: boolean;
  onPointerGuess(countryId: string): void;
  onKeyGuess(event: ReactKeyboardEvent<SVGPathElement>, countryId: string): void;
}

/**
 * Markers for the 39 countries that cannot be hit as polygons — Monaco is 12 km², and
 * Tuvalu has no geometry at all at 50m, so without this layer five of them would be
 * literally unplayable.
 *
 * Each marker has to cancel out the zoom so it stays a constant size on screen, and the
 * obvious way to do that — subscribe to the zoom transform and re-render — puts 39 React
 * components on the hot path of every pan and pinch frame. Instead the counter-scale is
 * published once per frame as a CSS custom property on this group, and the markers below
 * consume it through `transform: scale(var(--mrd-inv))`. Style resolution handles the
 * rest, so a zoom frame costs one attribute write rather than 39 reconciliations, and
 * React never renders during a gesture at all.
 */
function MicroMarkerLayer({
  fills,
  guessedIds,
  lastGuessId,
  enabled,
  onPointerGuess,
  onKeyGuess,
}: MicroMarkerLayerProps) {
  const t = useTranslator();
  const { k } = useZoomPanContext();
  const groupRef = useRef<SVGGElement>(null);

  /* Written straight to the DOM rather than rendered. `k` changes on every frame of a
     gesture, so returning it through JSX would re-render this subtree 60 times a second;
     an effect that only touches one custom property costs nothing and leaves the React
     tree completely still while the map moves. */
  useEffect(() => {
    groupRef.current?.style.setProperty('--mrd-inv', String(1 / (k || 1)));
  }, [k]);

  return (
    <g
      ref={groupRef}
      className="mrd-micro"
      // Seeds the property for the first paint, before the effect above has run.
      style={{ ['--mrd-inv' as string]: String(1 / (k || 1)) }}
    >
      {MICRO_COUNTRIES.map((country) => {
        const guessed = guessedIds.has(country.id);
        const isLast = country.id === lastGuessId;
        const localised = t.country(country);
        return (
          <MicroMarker
            key={country.id}
            country={country}
            enabled={enabled}
            fill={fills.get(country.id) ?? LAND_FILL}
            ring={isLast ? LAST_GUESS_STROKE : guessed ? GUESSED_STROKE : MICRO_RING}
            label={
              guessed ? t('play.a11y.alreadyGuessed', { country: localised }) : localised
            }
            onPointerGuess={onPointerGuess}
            onKeyGuess={onKeyGuess}
          />
        );
      })}
    </g>
  );
}

interface MicroMarkerProps {
  country: Country;
  enabled: boolean;
  fill: string;
  ring: string;
  label: string;
  onPointerGuess(countryId: string): void;
  onKeyGuess(event: ReactKeyboardEvent<SVGPathElement>, countryId: string): void;
}

/** Radius of the invisible hit area, in CSS pixels — a 28px target, thumb-sized. */
const MICRO_HIT_RADIUS = 14;

const MicroMarker = memo(function MicroMarker({
  country,
  enabled,
  fill,
  ring,
  label,
  onPointerGuess,
  onKeyGuess,
}: MicroMarkerProps) {
  const base: CSSProperties = {
    /* `color` is inherited, so the circles below can pick it up as `currentColor` and
       react-simple-maps' hover/focus swap becomes the whole focus treatment. */
    color: ring,
    cursor: enabled ? 'pointer' : 'default',
    transition: 'color 150ms linear',
  };
  const lifted: CSSProperties = enabled ? { ...base, color: 'var(--oxblood)' } : base;

  return (
    <Marker
      coordinates={[country.lon, country.lat]}
      tabIndex={enabled ? 0 : -1}
      role="button"
      aria-label={label}
      aria-disabled={enabled ? undefined : true}
      onPointerUp={enabled ? () => onPointerGuess(country.id) : undefined}
      onKeyDown={enabled ? (event) => onKeyGuess(event, country.id) : undefined}
      style={{ default: base, hover: lifted, pressed: lifted }}
    >
      {/* The viewBox is 1:1 with CSS pixels, so scaling by 1/zoom pins both the hit area
          and the ring to a fixed on-screen size at every zoom level. The factor arrives
          as a custom property set on the layer above, so this element is never
          re-rendered by a gesture — the style engine re-resolves it instead. */}
      <g style={{ transform: 'scale(var(--mrd-inv, 1))' }}>
        <circle r={MICRO_HIT_RADIUS} fill="transparent" style={{ pointerEvents: 'all' }} />
        <circle r={5} fill={fill} stroke="currentColor" strokeWidth={1.25} />
      </g>
    </Marker>
  );
});
