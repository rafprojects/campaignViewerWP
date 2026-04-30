# Refactoring Plan: Settings System with Zustand, React Query, and Zod

> Note: this original proposal has now been evaluated and refined in [PHASE25_SETTINGS_REFACTOR.md](PHASE25_SETTINGS_REFACTOR.md).
>
> The main scope changes are:
> - legacy bridge removal is now intended in the same phase because the plugin is still unreleased
> - campaign legacy override cleanup is included with the settings cleanup
> - TanStack Query is scoped to settings in Phase 25, with app-wide SWR replacement deferred to a later phase

## Information Section

### Problem Statement

The current settings implementation in `wp-super-gallery` suffers from several architectural challenges:

1. **Monolithic Type Definition**: The `GalleryBehaviorSettings` interface in `src/types/index.ts` is over 600 lines, mixing UI toggles, layout parameters, and theme configurations. This makes it difficult to maintain, test, and reason about.

2. **Legacy-to-Modern Bridge**: A complex mapping layer in `src/utils/galleryConfig.ts` converts between flat legacy settings (e.g., `imageBgColor`) and nested modern configuration (`galleryConfig.breakpoints.desktop.image.common.viewportBgColor`). This creates double maintenance burden and potential for sync errors.

3. **Manual State Management**: `SettingsPanel.tsx` manually tracks `settings`, `originalSettings`, dirty state, and loading/error states using `useState` and `useEffect`. This pattern is error-prone and hard to test.

4. **Direct API Calls**: Settings are fetched directly via `apiClient.getSettings()` without caching, deduplication, background refetching, or automatic invalidation.

5. **Fragile Type Coercion**: `mergeSettingsWithDefaults.ts` manually parses JSON strings, coerces types (e.g., string to number), and falls back to defaults. This is untestable and lacks clear error reporting.

### Proposed Solution

Adopt a three-library stack to address each concern:

- **Zod**: Schema validation and automatic TypeScript type generation. Replaces manual parsing and type coercion.
- **Zustand**: Centralized state management for draft settings with undo/redo, persistence, and devtools support.
- **React Query**: Data fetching, caching, deduplication, background refetching, and automatic invalidation.

### Benefits

| Area | Before | After |
|---|---|---|
| **Validation** | Manual JSON parsing + type coercion | Zod schemas with `preprocess` and `safeParse` |
| **Types** | Manual `interface` duplication | `z.infer` from Zod schemas |
| **State** | `useState`/`useEffect` in components | Zustand store with DevTools |
| **Data Fetching** | Direct `apiClient` calls | React Query with caching and invalidation |
| **Testing** | Hard to test component logic | Testable hooks + store logic |
| **DevEx** | Manual debugging | Zustand DevTools + React Query DevTools |

### Target Areas

1. **Primary**: Settings system (`SettingsPanel.tsx`, `galleryConfig.ts`, `mergeSettingsWithDefaults.ts`)
2. **Secondary**: Campaign management (`Campaign` components)
3. **Tertiary**: Gallery viewer (`CardViewer` components)
4. **Quaternary**: Authentication (`Auth` components)

---

## Phase Section

### Phase 1: Foundation — Zod Schemas & Type Safety

**Duration**: Weeks 1-2

**Objective**: Replace manual validation and type definitions with Zod schemas.

**Actionable Tasks**:

1. **Create Zod Schema Files**
   - Create `src/types/settingsSchemas.ts`
   - Define sub-schemas for nested objects:
     - `TypographyOverrideSchema`
     - `BreakpointConfigSchema` (desktop + mobile)
     - `GalleryConfigSchema`
   - Define master schema: `GalleryBehaviorSettingsSchema`
   - Export inferred types using `z.infer`

2. **Update `mergeSettingsWithDefaults.ts`**
   - Replace manual JSON parsing with `GalleryBehaviorSettingsSchema.safeParse()`
   - Use `preprocess` for legacy string-to-number coercion
   - Return `Result<{ data: GalleryBehaviorSettings; error: z.ZodError | null }>`

3. **Deprecate Old Interface**
   - Mark `GalleryBehaviorSettings` interface as `@deprecated`
   - Add migration guide commenta
   - Keep for backward compatibility during transition

4. **Write Tests**
   - Create `src/types/settingsSchemas.test.ts`
   - Test valid/invalid inputs
   - Test `preprocess` transformations
   - Test `safeParse` error messages

**Deliverables**:
- `src/types/settingsSchemas.ts` with complete Zod schemas
- Updated `src/utils/mergeSettingsWithDefaults.ts`
- `src/types/settingsSchemas.test.ts`
- Deprecated `GalleryBehaviorSettings` interface in `src/types/index.ts`

---

### Phase 2: Data Fetching — React Query Integration

**Duration**: Weeks 3-4

**Objective**: Replace direct API calls with React Query for caching and automatic invalidation.

**Actionable Tasks**:

1. **Set Up React Query Provider**
   - Ensure `QueryClientProvider` wraps the app in `src/main.tsx`
   - Configure default options (retry, staleTime)

2. **Create Query Hooks**
   - Create `src/services/settingsQuery.ts`
   - Implement `useGetSettings()` with caching (staleTime: 5 minutes)
   - Implement `useUpdateSettings()` with automatic invalidation
   - Define `SETTINGS_QUERY_KEY = ['settings']`

3. **Migrate `SettingsPanel.tsx`**
   - Replace `apiClient.getSettings()` with `useGetSettings()`
   - Replace `apiClient.updateSettings()` with `useUpdateSettings()`
   - Use React Query's `isLoading`, `error`, `data` states
   - Remove manual loading/error state management

4. **Handle Edge Cases**
   - Add retry logic (retry: 2)
   - Handle network errors gracefully
   - Add loading skeletons

5. **Write Tests**
   - Create `src/services/settingsQuery.test.ts`
   - Test query caching behavior
   - Test mutation invalidation
   - Mock `apiClient` responses

**Deliverables**:
- `src/services/settingsQuery.ts` with hooks
- Updated `SettingsPanel.tsx` using React Query
- `src/services/settingsQuery.test.ts`

---

### Phase 3: State Management — Zustand Store

**Duration**: Weeks 5-6

**Objective**: Replace local state in `SettingsPanel.tsx` with a Zustand store.

**Actionable Tasks**:

1. **Create Zustand Store**
   - Create `src/contexts/SettingsStore.ts`
   - Define `SettingsState` interface with:
     - `settings: GalleryBehaviorSettings | null`
     - `originalSettings: GalleryBehaviorSettings | null`
     - `isLoading: boolean`
     - `error: string | null`
     - Actions: `setSettings`, `loadSettings`, `saveSettings`, `resetSettings`, `updateSetting`
   - Use `immer` middleware for nested state updates (optional but recommended)

2. **Integrate with React Query**
   - Connect `useGetSettings` to Zustand's `setSettings`
   - Connect `useUpdateSettings` to Zustand's `saveSettings`
   - Sync `originalSettings` after successful save

3. **Simplify `SettingsPanel.tsx`**
   - Replace `useState`/`useEffect` with Zustand selectors
   - Use `useSettingsStore((state) => state.settings)`
   - Remove manual dirty state tracking (compare `settings` vs `originalSettings`)

4. **Add DevTools**
   - Enable Zustand DevTools in development
   - Document how to use for debugging

5. **Write Tests**
   - Create `src/contexts/SettingsStore.test.ts`
   - Test state updates
   - Test `updateSetting` with immer
   - Test `resetSettings` behavior

**Deliverables**:
- `src/contexts/SettingsStore.ts` with store logic
- Simplified `SettingsPanel.tsx`
- `src/contexts/SettingsStore.test.ts`

---

### Phase 4: Backend Alignment — Remove Legacy Bridge

**Duration**: Weeks 7-8

**Objective**: Align PHP backend with frontend's nested structure and remove the legacy bridge.

**Actionable Tasks**:

1. **Update PHP Settings Service**
   - Edit `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-service.php`
   - Modify `getSettings()` to return nested `galleryConfig` structure
   - Modify `updateSettings()` to accept nested structure
   - Ensure JSON encoding/decoding preserves nested objects

2. **Update PHP Settings Registry**
   - Edit `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php`
   - Register nested fields if not already done
   - Add sanitization for nested JSON fields

3. **Remove Legacy Bridge**
   - Deprecate `src/utils/galleryConfig.ts`
   - Update any remaining consumers to use `GalleryConfig` directly
   - Remove flat-to-nested mapping functions

4. **Update Zod Schemas**
   - Remove `preprocess` for deprecated flat fields
   - Keep only necessary backward-compat shims
   - Mark deprecated fields in schemas

5. **Write Integration Tests**
   - Update PHPUnit tests in `wp-plugin/wp-super-gallery/tests/`
   - Test nested JSON storage and retrieval
   - Verify frontend/backend data alignment

**Deliverables**:
- Updated PHP backend files
- Deprecated `galleryConfig.ts`
- Updated Zod schemas
- Updated PHPUnit tests

---

### Phase 5: Expansion — Apply to Other Areas

**Duration**: Weeks 9-12

**Objective**: Extend the pattern to Campaign management, Gallery viewer, and Authentication.

**Actionable Tasks**:

1. **Campaign Management**
   - Create Zod schemas for `Campaign` in `src/types/campaignSchemas.ts`
   - Create React Query hooks in `src/services/campaignQuery.ts`
     - `useGetCampaigns()`, `useCreateCampaign()`, `useUpdateCampaign()`
   - Create Zustand store for draft campaign state in `src/contexts/CampaignStore.ts`
   - Migrate campaign creation/editing flows

2. **Gallery Viewer**
   - Create Zustand store for viewer state in `src/contexts/ViewerStore.ts`
     - `currentSlide`, `isZoomed`, `setSlide()`, `toggleZoom()`
   - Use React Query with `staleTime` for viewer settings
   - Validate viewer config with Zod before rendering

3. **Authentication**
   - Create Zustand store for auth state in `src/contexts/AuthStore.ts`
     - `user`, `token`, `login()`, `logout()`
   - Use React Query for auth status checks and token refresh
   - Create Zod schemas for auth responses

4. **Documentation**
   - Update `docs/COMPONENT_TREE_MAP_PHASE23.md` if structure changes
   - Update `docs/STYLING_GUIDE.md` if styling patterns change
   - Add new section to architecture docs

**Deliverables**:
- `src/types/campaignSchemas.ts`
- `src/services/campaignQuery.ts`
- `src/contexts/CampaignStore.ts`
- `src/contexts/ViewerStore.ts`
- `src/contexts/AuthStore.ts`
- Updated documentation

---

## Migration Checklist

- [ ] Phase 1: Zod schemas created and tested
- [ ] Phase 2: React Query hooks created and integrated
- [ ] Phase 3: Zustand store created and integrated
- [ ] Phase 4: Backend aligned and legacy bridge removed
- [ ] Phase 5: Pattern applied to other areas
- [ ] All existing tests passing
- [ ] New tests added for each phase
- [ ] Documentation updated
- [ ] Deprecated code removed or marked
- [ ] Build process verified (`npm run build:wp`)

---

## Risk Mitigation

1. **Backward Compatibility**: Keep deprecated fields in Zod schemas with `preprocess` until Phase 4.
2. **Testing**: Write tests alongside each phase to catch regressions early.
3. **Rollback Plan**: Use feature flags or gradual rollout if issues arise.
4. **Developer Training**: Provide examples and documentation for the new patterns.
5. **Performance**: Monitor bundle size impact of new dependencies (Zod, Zustand, React Query).

---

## Dependencies

- **Zod**: `npm install zod`
- **Zustand**: `npm install zustand immer` (immer optional)
- **React Query**: `npm install @tanstack/react-query`

---

## Success Metrics

1. **Type Safety**: Zero `any` types in settings code
2. **Test Coverage**: >80% coverage for new schemas and hooks
3. **Bundle Size**: <50KB increase from new dependencies
4. **Developer Time**: 30% reduction in settings-related bugs
5. **Performance**: No increase in settings panel load time