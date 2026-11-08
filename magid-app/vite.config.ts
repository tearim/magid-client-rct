import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// `vite build` builds the full app (dist/). `vite build --mode embed` builds the embeddable Magid (dist-embed/:
// magid-embed.js with React bundled in, plus magid-embed.css, which mountMagid loads next to the script).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  ...(mode === 'embed' && {
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      outDir: 'dist-embed',
      emptyOutDir: true,
      cssCodeSplit: false,
      lib: {
        entry: 'src/embed/index.ts',
        formats: ['es'],
        fileName: () => 'magid-embed.js',
        cssFileName: 'magid-embed',
      },
    },
  }),
  test: {
    environment: 'jsdom',
    // Protocol/parsing tests live in @magiden/client-core (its own repo); the app only tests its components.
    passWithNoTests: true,
  },
}))
