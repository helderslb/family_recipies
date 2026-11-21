import 'dotenv/config';
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';
import path from 'path';

export default defineConfig({
  integrations: [tailwind()],
  // Hybrid: every page is still prerendered to static HTML, but the /api/*
  // endpoints (login, recipe create/update) run on demand on the Node server.
  output: 'hybrid',
  adapter: vercel(),
  // Astro 4 ignores `devOptions` — dev *and* preview read `server`.
  // Binding 0.0.0.0 is required for the devcontainer port-forward
  // (it connects to 127.0.0.1 inside the container; the default `localhost`
  // only binds ::1, so the forwarded port appeared dead).
  server: {
    host: '0.0.0.0',
    port: 4321,
  },
  vite: {
    server: {
      // Fail loudly instead of silently moving to a port that isn't forwarded.
      strictPort: true,
      // Vite 5.4 blocks requests whose Host header isn't localhost;
      // forwarded/proxied devcontainer URLs need this.
      allowedHosts: true,
      // Documents are edited through the admin API (and the workspace is a bind
      // mount where inotify events don't always arrive), so poll for changes.
      // Without this a saved recipe only appeared after restarting the server.
      watch: {
        usePolling: true,
        interval: 400,
      },
    },
    resolve: {
      alias: {
        '@': path.resolve('./src'),
      },
    },
  },
});

