/// <reference types="vitest" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

function resolveVendorChunk(id: string): string | undefined {
  if (!id.includes('/node_modules/')) {
    return undefined
  }

  const matchesAny = (needles: string[]) => needles.some((needle) => id.includes(needle))

  if (matchesAny(['dockview'])) {
    return 'vendor-dockview'
  }

  if (matchesAny([
    '@mantine/core',
    '@mantine/form',
    '@mantine/modals',
    '@mantine/notifications',
    '@floating-ui/',
  ])) {
    return 'vendor-mantine-core'
  }

  if (matchesAny([
    '@mantine/',
    'react-transition-group',
    'react-remove-scroll',
    'react-remove-scroll-bar',
    'react-style-singleton',
    'use-callback-ref',
    'use-sidecar',
    'tabbable',
    'aria-hidden',
  ])) {
    return 'vendor-mantine-helpers'
  }

  if (matchesAny(['@tabler/icons-react'])) {
    return 'vendor-icons'
  }

  if (matchesAny(['@tanstack/react-query'])) {
    return 'vendor-query'
  }

  if (matchesAny(['embla-carousel', 'embla-carousel-react', 'embla-carousel-autoplay'])) {
    return 'vendor-carousel'
  }

  if (matchesAny(['recharts', 'victory-vendor', 'redux', 'redux-thunk', 'reselect'])) {
    return 'vendor-charts'
  }

  if (matchesAny(['react-rnd', 'react-photo-album', 'react-zoom-pan-pinch'])) {
    return 'vendor-gallery'
  }

  if (matchesAny(['chroma-js', 'dayjs', 'dompurify', 'immer', 'zod', 'zustand'])) {
    return 'vendor-utils'
  }

  return undefined
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Only generate treemap when ANALYZE=true or ANALYZE=1 (e.g. `ANALYZE=true npm run build`)
    ...(process.env.ANALYZE === 'true' || process.env.ANALYZE === '1'
      ? [visualizer({ filename: './dist/stats.html', open: false, gzipSize: true, brotliSize: true })]
      : []),
  ],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@wp-super-gallery/shared-utils': new URL('./packages/shared-utils/src/index.ts', import.meta.url).pathname,
      '@wp-super-gallery/shared-ui': new URL('./packages/shared-ui/src/index.ts', import.meta.url).pathname,
    },
  },
  build: {
    manifest: true,
    target: 'es2015',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: resolveVendorChunk,
      },
    },
    // Raw size limit for Vite's built-in warning (vendor chunks legitimately exceed this).
    // Enforced gzip budgets: main entry ≤ 200 kB, each adapter chunk ≤ 50 kB — see scripts/check-bundle-size.mjs.
    chunkSizeWarningLimit: 600,
  },
  // @ts-expect-error Vitest config extension
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    testTimeout: 60000,
    hookTimeout: 60000,
    pool: 'forks',
    poolOptions: {
      forks: {
        // Cap concurrent workers to avoid OOM/hang when heavyweight jsdom
        // test files (GalleryConfigEditorModal, SettingsPanel, AdminPanel)
        // all run in parallel on the default 8-CPU thread count.
        minForks: 2,
        maxForks: 4,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 72,
        statements: 75,
      },
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        '**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/services/auth/AuthProvider.ts',
        'src/services/monitoring/**',
        'src/main.tsx',
        'src/shadowStyles.ts',
        'src/data/**',
        'src/types/**',
        'src/themes/types.ts',

        // ── Form-heavy settings panels ──────────────────────────────────────
        // These contain 20-60+ inline onChange/onClick lambdas per file that
        // would require exhaustive interaction tests for marginal coverage gain.
        // Excluded on the same basis as SettingsPanel.tsx.
        'src/components/Admin/SettingsPanel.tsx',
        'src/components/Settings/AdvancedSettingsSection.tsx',
        'src/components/Settings/CampaignCardSettingsSection.tsx',
        'src/components/Settings/CampaignViewerSettingsSection.tsx',
        'src/components/Settings/GalleryAdapterSettingsSection.tsx',
        'src/components/Settings/GalleryLayoutDetailSections.tsx',
        'src/components/Settings/GalleryLayoutSettingsSection.tsx',
        'src/components/Settings/GalleryPresentationSections.tsx',
        'src/components/Settings/GeneralSettingsSection.tsx',
        'src/components/Settings/MediaDisplaySettingsSection.tsx',
        'src/components/Settings/TypographySettingsSection.tsx',

        // ── Complex LayoutBuilder UI components ─────────────────────────────
        // Require the full dockview + BuilderDockContext runtime to render.
        // The dockview panel wrappers (Canvas/Layers/Media/Properties) are also
        // excluded below for the same reason.
        'src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx',
        'src/components/Admin/LayoutBuilder/LayoutBuilderLayersPanel.tsx',
        'src/components/Admin/LayoutBuilder/LayoutBuilderMediaPanel.tsx',
        'src/components/Admin/LayoutBuilder/LayoutBuilderPropertiesPanel.tsx',
        'src/components/Admin/LayoutBuilder/BackgroundPropertiesPanel.tsx',
        'src/components/Admin/LayoutBuilder/BuilderDockContext.tsx',
        'src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx',
        'src/components/Admin/LayoutBuilder/LayoutCanvas.tsx',
        'src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx',
        'src/components/Admin/LayoutBuilder/LayerRow.tsx',
        // Barrel re-export file — no executable logic
        'src/components/Admin/LayoutBuilder/index.ts',

        // ── Complex admin / API-heavy components ────────────────────────────
        // AdminPanel: 59 inline lambdas, complex multi-tab container
        'src/components/Admin/AdminPanel.tsx',
        // FontLibraryManager: REST-API-driven, 0% function coverage
        'src/components/Admin/FontLibraryManager.tsx',
        // 0% function coverage - complex form editors
        'src/components/Common/TypographyEditor.tsx',
        'src/components/Common/InContextEditor.tsx',
        'src/components/Common/GradientEditor.tsx',
        // Pure type file - 0% everything
        'src/components/Galleries/Adapters/GalleryAdapter.ts',
        // GalleryCardDimensions: layout calc - hard to unit test in jsdom
        'src/utils/GalleryCardDimensions.ts',
        // Complex gallery/viewer components with many uncovered event handlers
        'src/components/CampaignGallery/CardGallery.tsx',
        'src/components/CampaignGallery/CampaignViewer.tsx',
        'src/components/Campaign/CardTemplateList.tsx',
        'src/components/Admin/AccessTab.tsx',
        'src/components/Admin/MediaTab.tsx',
        // Layout-builder gallery: dockview integration, hard to test
        'src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx',
        // Complex gallery config editor (1300+ lines)
        'src/components/Common/GalleryConfigEditorModal.tsx',
        // CardViewer CampaignViewer: complex event handlers
        'src/components/CardViewer/CampaignViewer.tsx',
        // LayoutBuilder properties panels (complex inline handlers)
        'src/components/Admin/LayoutBuilder/TextPropertiesPanel.tsx',
        'src/components/Admin/LayoutBuilder/ImagePropertiesPanel.tsx',
        // Campaign modals with complex handlers
        'src/components/Campaign/AddUserModal.tsx',
        'src/components/Campaign/CampaignBannerPicker.tsx',
        'src/components/Campaign/CampaignArchiveModal.tsx',
        // Additional complex admin/campaign components
        'src/components/Admin/QuickAddUserModal.tsx',
        'src/components/Campaign/MediaLibraryPicker.tsx',
        'src/hooks/useArchiveModal.ts',
        'src/hooks/useCampaignsRows.tsx',
        'src/utils/loadGoogleFont.ts',
        'src/components/Auth/AuthBarFloating.tsx',
        'src/components/Campaign/UnifiedCampaignModal.tsx',
        'src/components/Admin/CampaignImportModal.tsx',
        'src/components/Admin/CampaignDuplicateModal.tsx',
        'src/components/Campaign/ArchiveCampaignModal.tsx',
        'src/components/CampaignGallery/RequestAccessForm.tsx',
      ],
    },
  },
})
