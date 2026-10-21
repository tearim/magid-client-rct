import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Protocol/parsing tests live in magid-core; the app has none of its own yet.
    passWithNoTests: true,
  },
})
