import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
        start_url: '/',
        scope: '/',
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
