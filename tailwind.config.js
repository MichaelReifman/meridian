/** @type {import('tailwindcss').Config} */
// Meridian design system — "Engraved Atlas" (PRD §9, re-read as a printed chart rather
// than a dark-mode UI). Colours are wired to the CSS variables in src/theme/tokens.css
// so the palette has one source of truth, shared with the WebGL globe which reads them
// at runtime.
//
// Note what is deliberately absent: no glow shadows, no blur utilities in the component
// layer, no gradient stops. See tokens.css for why.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // `rgb(var(--x-rgb) / <alpha-value>)` rather than a bare `var(--x)`: Tailwind 3
      // rewrites that placeholder to generate `bg-ink/10` and friends, and cannot do so
      // from a finished colour.
      colors: {
        paper: 'rgb(var(--paper-rgb) / <alpha-value>)',
        leaf: 'rgb(var(--leaf-rgb) / <alpha-value>)',
        plate: 'rgb(var(--plate-rgb) / <alpha-value>)',
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        graphite: 'rgb(var(--graphite-rgb) / <alpha-value>)',
        oxblood: 'rgb(var(--oxblood-rgb) / <alpha-value>)',
        brass: 'rgb(var(--brass-rgb) / <alpha-value>)',
        sea: 'rgb(var(--sea-rgb) / <alpha-value>)',
        land: 'rgb(var(--land-rgb) / <alpha-value>)',
        coast: 'rgb(var(--coast-rgb) / <alpha-value>)',
        ice: 'rgb(var(--ice-rgb) / <alpha-value>)',
        ocean: 'rgb(var(--ocean-rgb) / <alpha-value>)',
        // One pigment per mode, for the title page. See tokens.css.
        'mode-country': 'rgb(var(--mode-country-rgb) / <alpha-value>)',
        'mode-capital': 'rgb(var(--mode-capital-rgb) / <alpha-value>)',
        'mode-flag': 'rgb(var(--mode-flag-rgb) / <alpha-value>)',
        // Translucent by definition — they carry their own alpha, so no placeholder.
        rule: 'var(--rule)',
        'rule-soft': 'var(--rule-soft)',
      },
      fontFamily: {
        // Display: an engraver's serif. Titles and the reveal only, with restraint.
        display: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],
        // Body/UI: quiet, gets out of the way, never draws attention to itself.
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        // Numerals: tabular figures reinforce the instrument reading of the HUD.
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Engraved small-caps labels: small, widely letterspaced, never bold.
        label: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.16em' }],
        hud: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.1em' }],
      },
      letterSpacing: {
        wordmark: '0.28em',
      },
      borderRadius: {
        // Paper is cut, not rounded. 2px is the most a printed card ever admits to.
        none: '0',
        sheet: '2px',
        DEFAULT: '2px',
      },
      boxShadow: {
        /* The only permitted shadow: a tight contact shadow, as though one sheet of
           stock is resting on another. No spread, no colour, no halo. */
        sheet: '0 1px 0 rgb(var(--ink-rgb) / 0.06), 0 1px 2px rgb(var(--ink-rgb) / 0.08)',
        lifted: '0 1px 0 rgb(var(--ink-rgb) / 0.08), 0 2px 6px rgb(var(--ink-rgb) / 0.10)',
        // A pressed key on an instrument: inset, not raised.
        pressed: 'inset 0 1px 2px rgb(var(--ink-rgb) / 0.14)',
      },
      transitionTimingFunction: {
        swift: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pin-pulse': {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '0.12', transform: 'scale(1.85)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out both',
        'rise-in': 'rise-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'pin-pulse': 'pin-pulse 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
