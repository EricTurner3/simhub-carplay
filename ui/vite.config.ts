import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// The dev server proxies the bridge so the page stays same-origin, as it is in production.
const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const bridge = `http://127.0.0.1:${config.bridge.port}`;

export default defineConfig({
  plugins: [svelte()],
  // Relative asset paths so the build also works when loaded from a sub-path or file host.
  base: './',
  build: {
    // Chromium-based WebViews (SimHub's embedded browser, Edge kiosk) only.
    target: 'chrome100',
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/config.json': bridge,
      '/api': bridge,
      '/media': bridge,
      '/maps': bridge,
      '/ws': { target: bridge.replace('http', 'ws'), ws: true },
    },
  },
});
