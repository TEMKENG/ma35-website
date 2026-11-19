import { defineConfig } from 'vite';

// Relativer Base-Pfad: funktioniert unter https://name.github.io/,
// https://name.github.io/<repo>/ und unter einer Custom Domain, ohne Anpassung.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 700,
  },
});
