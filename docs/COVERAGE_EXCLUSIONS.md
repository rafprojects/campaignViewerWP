# Coverage Exclusion Debt

Files excluded from Vitest coverage reporting (in `vite.config.ts`) that contain
non-trivial logic. Each entry should eventually be brought back into the coverage
signal once its test infrastructure is in place.

## Hooks

| File | Reason excluded | Suggested approach |
|---|---|---|
| `src/hooks/useExternalMediaModal.ts` | Complex drag/upload/oembed handlers; requires full media-library mock | Dedicated mock for `useDropzone` and `useOembedResolver` |
| `src/hooks/useArchiveModal.ts` | REST mutation orchestration; needs `server` / `msw` for archive endpoints | Add msw handler for archive/restore routes |
| `src/hooks/useCampaignsRows.tsx` | Tanstack Query + filtered row derivation from REST data | Mock `useCampaigns` and test row-selection/sorting logic |

## Utilities

| File | Reason excluded | Suggested approach |
|---|---|---|
| `src/utils/loadGoogleFont.ts` | DOM manipulation + `document.fonts.load`; needs a DOM-with-fonts environment | Use `vi.spyOn(document.fonts, 'load')` + verify `<link>` injection |
| `src/utils/GalleryCardDimensions.ts` | Layout calculations that call `getBoundingClientRect`; jsdom returns 0 for everything | Test with fixed input dimensions that bypass DOM sizing |

## Complex UI Components

| File | Reason excluded | Notes |
|---|---|---|
| `src/components/Common/TypographyEditor.tsx` | 32 fn-expressions, no practical mount path without full settings context | — |
| `src/components/Common/InContextEditor.tsx` | Requires CKEditor/RTE environment | — |
| `src/components/Common/GradientEditor.tsx` | Requires canvas/color-picker mocks | — |
| `src/components/Common/GalleryConfigEditorModal.tsx` | 1300+ lines; depends on all settings sections | — |
| `src/components/Admin/SettingsPanel.tsx` | Top-level settings container; mocking its children is the correct unit-test target | — |
| `src/components/Settings/*.tsx` (10 files) | Form-heavy panels; each section tested via child-component unit tests | — |
| `src/components/Admin/AdminPanel.tsx` | 59 inline lambdas; integration test via AdminPanel E2E spec | — |
| `src/components/Admin/FontLibraryManager.tsx` | REST-API-driven; depends on msw for font list endpoint | — |
| `src/components/Admin/AccessTab.tsx` | Complex RBAC table; test via `useAccessRows` mock | — |
| `src/components/Admin/MediaTab.tsx` | Media upload pipeline; test via `useMediaUpload` mock | — |
| `src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx` | dockview integration | — |
| `src/components/Admin/LayoutBuilder/LayoutBuilderLayersPanel.tsx` | dockview integration | — |
| `src/components/Admin/LayoutBuilder/LayoutBuilderMediaPanel.tsx` | dockview integration | — |
| `src/components/Admin/LayoutBuilder/LayoutBuilderPropertiesPanel.tsx` | dockview integration | — |
| `src/components/Admin/LayoutBuilder/BackgroundPropertiesPanel.tsx` | dockview integration | — |
| `src/components/Admin/LayoutBuilder/BuilderDockContext.tsx` | dockview integration | — |
| `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` | dockview integration | — |
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | dockview integration | — |
| `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` | dockview integration | — |
| `src/components/Admin/LayoutBuilder/LayerRow.tsx` | dockview integration | — |
| `src/components/Admin/LayoutBuilder/TextPropertiesPanel.tsx` | Complex inline handlers; dockview dependency | — |
| `src/components/Admin/LayoutBuilder/ImagePropertiesPanel.tsx` | Complex inline handlers; dockview dependency | — |
| `src/components/Admin/LayoutBuilder/LayoutBuilderGallery.tsx` | dockview integration | — |
| `src/components/CampaignGallery/CardGallery.tsx` | Many uncovered event handlers; needs `user-event` interaction tests | Add keyboard-nav and drag tests |
| `src/components/CardViewer/CampaignViewer.tsx` | Complex viewer state machine; needs full campaign mock | — |
| `src/components/Campaign/CardTemplateList.tsx` | Gallery template browser with complex hover/select handlers | — |
| `src/components/Campaign/MediaLibraryPicker.tsx` | Media picker; requires media library mock | — |
| `src/components/Campaign/UnifiedCampaignModal.tsx` | Multi-step form wizard | — |
| `src/components/Campaign/ArchiveCampaignModal.tsx` | REST mutation; needs msw for archive endpoint | — |
| `src/components/Admin/QuickAddUserModal.tsx` | REST POST user; needs msw | — |
| `src/components/Admin/CampaignImportModal.tsx` | File upload + parse; needs file mock | — |
| `src/components/Admin/CampaignDuplicateModal.tsx` | REST mutation | — |
| `src/components/CampaignGallery/RequestAccessForm.tsx` | REST mutation + form validation | — |
| `src/components/Auth/AuthBarFloating.tsx` | Floating auth bar with position tracking | — |
| `src/components/Galleries/Adapters/GalleryAdapter.ts` | Pure type/interface file; no executable code | N/A — will never have coverage |

## Priority

Files marked with a suggested approach above are the highest-value targets for
bringing back into the coverage signal. See `docs/FUTURE_TASKS.md` for tracking.
