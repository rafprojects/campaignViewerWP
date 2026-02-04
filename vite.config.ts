/// <reference types="vitest" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    manifest: true,
    target: 'es2015',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-mantine': ['@mantine/core', '@mantine/hooks', '@mantine/modals', '@mantine/notifications'],
          'vendor-icons': ['@tabler/icons-react'],
          // Admin chunks (lazy loaded)
          'admin': [
            './src/components/Admin/AdminPanel.tsx',
            './src/components/Admin/SettingsPanel.tsx',
            './src/components/Admin/MediaTab.tsx',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  // @ts-expect-error Vitest config extension
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
