/** @type {import('tailwindcss').Config} */
// Meridian design system — "Dark Cosmic" (PRD §9).
// An antique observatory chart rendered in deep space, not a flat dark-mode UI.
// Colours are wired to CSS variables (src/theme/tokens.css) so the palette has a
// single source of truth shared with the WebGL globe, which reads them at runtime.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Every solid colour is declared as `rgb(var(--x-rgb) / <alpha-value>)` rather
      // than a bare `var(--x)`. Tailwind 3 rewrites that placeholder to generate
      // `bg-gold/90` and friends; with a finished colour it cannot, so opacity
      // utilities silently disappear and `@apply`-ing one is a hard build error.
      colors: {
        space: 'rgb(var(--space-rgb) / <alpha-value>)', // #0B0E1A deep space navy — base, not pure black
        panel: 'rgb(var(--panel-rgb) / <alpha-value>)', // #161B2E panel / chrome surface
        gold: 'rgb(var(--gold-rgb) / <alpha-value>)', // #E8B34D correct answers, reveal pin, streaks
        cyan: 'rgb(var(--cyan-rgb) / <alpha-value>)', // #4FD1C5 globe atmosphere, secondary accent
        violet: 'rgb(var(--violet-rgb) / <alpha-value>)', // #7B6CF6 heatmap cold end, nebula
        parchment: 'rgb(var(--parchment-rgb) / <alpha-value>)', // #F4F1EA text, used sparingly
        terrain: 'rgb(var(--terrain-rgb) / <alpha-value>)',
        'terrain-edge': 'rgb(var(--terrain-edge-rgb) / <alpha-value>)',
        // Translucent by definition — they carry their own alpha, so no placeholder.
        hairline: 'var(--hairline)',
        muted: 'var(--muted)',
      },
      fontFamily: {
        // Display: real antique-atlas / observatory character. Mode titles + reveal only.
        display: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],
        // Body/UI: quiet, gets out of the way.
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        // HUD numerals: tabular figures reinforce the "triangulating a location" readout.
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        hud: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.08em' }],
      },
      boxShadow: {
        // HUD panels float above the map — soft, wide, low-opacity against the dark base.
        hud: '0 2px 8px rgba(0, 0, 0, 0.4), 0 12px 32px rgba(0, 0, 0, 0.3)',
        'gold-glow': '0 0 0 1px rgba(232, 179, 77, 0.35), 0 0 24px rgba(232, 179, 77, 0.25)',
        'cyan-glow': '0 0 0 1px rgba(79, 209, 197, 0.3), 0 0 20px rgba(79, 209, 197, 0.2)',
      },
      transitionTimingFunction: {
        // Everything outside the globe reveal is quick and understated (§9 Motion).
        swift: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pin-pulse': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.15', transform: 'scale(1.9)' },
        },
        'sweep': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(200%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 220ms ease-out both',
        'rise-in': 'rise-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'pin-pulse': 'pin-pulse 2.4s ease-in-out infinite',
        'sweep': 'sweep 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
