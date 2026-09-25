// This is a one-shot data export. Do not watch the shared checkout or start dependency discovery.
export default {
  server: { watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
};
