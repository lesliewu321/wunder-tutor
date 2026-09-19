import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Build date and commit, shown in Settings so a tester can say exactly which version they have. */
const version = (() => {
  try { return `${new Date().toISOString().slice(0, 10)} · ${execSync('git rev-parse --short HEAD').toString().trim()}`; } catch { return 'dev'; }
})();

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    // A preview runner may assign a free port through PORT; 5173 otherwise.
    port: Number(process.env.PORT) || 5173,
    // The optional API proxy (server/index.mjs) keeps Azure / Claude keys server-side.
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        configure: (proxy) => {
          // The proxy server is optional. When it isn't running, answer the health probe with
          // "nothing configured" instead of a 500 so the app quietly stays on its built-in providers.
          proxy.on('error', (_err, req, res) => {
            if (!('writeHead' in res) || res.headersSent) return;
            const health = req.url?.startsWith('/api/health');
            res.writeHead(health ? 200 : 503, { 'Content-Type': 'application/json' });
            res.end(health ? '{"ok":false,"azure":false,"claude":false,"gemini":false}' : '{"error":"api_proxy_not_running"}');
          });
        },
      },
    },
  },
});
