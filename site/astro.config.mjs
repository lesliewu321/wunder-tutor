import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://wundertutor.com',
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // Keep worktree builds out of the shared node_modules dependency cache.
    cacheDir: '.astro/vite',
    optimizeDeps: { noDiscovery: true, include: [] },
  },
});
