import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Plain Node, no jsdom: a test touching window/document fails here, which keeps the core framework-free.
    environment: 'node',
  },
})
