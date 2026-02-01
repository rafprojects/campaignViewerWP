/// <reference types="vitest" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-mantine': ['@mantine/core', '@mantine/hooks', '@mantine/modals', '@mantine/notifications'],
          'vendor-icons': ['@tabler/icons-react'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    testTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        '**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/services/auth/AuthProvider.ts',
        'src/main.tsx',
        'src/shadowStyles.ts',
        'src/data/**',
        'src/types/**',
      ],
    },
  },
})
