import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    environment: 'node',
    env: { CC_LENS_NO_DISK_CACHE: '1' },
    include: ['lib/**/*.test.ts'],
  },
})
