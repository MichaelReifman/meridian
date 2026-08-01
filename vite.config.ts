import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// https://vite.dev/config/
/**
 * GitHub Pages serves this project from https://<user>.github.io/meridian/, so every
 * URL the app emits has to carry that prefix. Overridable for a root-domain host
 * (Vercel, a custom domain) with `BASE_PATH=/ npm run build` — anything fetched at
 * runtime goes through src/lib/paths.ts, which reads this back from import.meta.env.
 */
const BASE = process.env.BASE_PATH ?? '/meridian/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      /**
       * 'prompt', not 'autoUpdate', and the reason is a correctness one rather than a
       * matter of taste.
       *
       * Under autoUpdate the new worker calls skipWaiting and takes over mid-session,
       * and Workbox then evicts precache entries that are no longer in the manifest.
       * The globe reveal is a lazy chunk, so a deploy landing while someone is midway
       * through a round would delete globe-<oldhash>.js from the cache while the page
       * still holds a reference to it — and the server only has the new hash. Solving
       * that round would fail to load the reveal.
       *
       * Waiting instead of activating keeps the old precache intact for the whole
       * session, and the player chooses the moment to reload.
       */
      registerType: 'prompt',
      // Registration is owned by src/components/UpdatePrompt.tsx, so the plugin must
      // not also inject its own script — that would register the worker twice.
      injectRegister: null,
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      workbox: {
        // Everything the game needs is precached: there is no runtime network
        // dependency at all (PRD §7 — boundaries and flags are both vendored),
        // so a cold install works fully offline on first launch.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // `webp` is load-bearing, not incidental: the 195 flags are WebP, and leaving
        // the extension out precaches none of them, which silently breaks Flag mode on
        // exactly the offline install this whole approach exists to support.
        globPatterns: ['**/*.{js,css,html,woff2,woff,svg,png,webp,ico,json}'],
        // ~195 flag files + the 739 KB topology push the precache past 3 MB. That is
        // the deliberate trade for a cold install that plays with no network at all.
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Meridian — daily geography deduction',
        short_name: 'Meridian',
        description:
          'Click a country to guess a target — country, capital, or flag — and get pulled closer with every wrong guess.',
        theme_color: '#0B0E1A',
        background_color: '#0B0E1A',
        display: 'standalone',
        orientation: 'any',
        // Must match the deployment base, or Android installs the app and then opens
        // it at the domain root — a 404 inside a standalone window with no address bar.
        start_url: BASE,
        scope: BASE,
        categories: ['games', 'education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // three.js + r3f are only needed for the reveal (PRD §8) — keep them out
          // of the critical render path so the map boots without paying for WebGL.
          if (id.includes('node_modules/three') || id.includes('@react-three')) return 'globe';
          if (id.includes('node_modules/react-simple-maps') || id.includes('node_modules/d3-'))
            return 'map';
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: true,
    // Honour PORT when something else already owns the default, so Meridian can run
    // alongside another Vite project without a manual flag.
    port: Number(process.env.PORT) || 5173,
  },
});
