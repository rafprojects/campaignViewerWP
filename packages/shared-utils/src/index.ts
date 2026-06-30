// --- P50-G baseline ---
export * from './sanitizeCss'
export * from './cssUnits'
export * from './safeLocalStorage'
export * from './useSwipe'
export * from './scrollLock'

// --- P51-B: pure utilities ---
export * from './clampDimension'
export * from './sortByOrder'
export * from './getErrorMessage'
export * from './resolveColumnsFromWidth'
export * from './galleryAnimations'
export * from './maskFeather'

// --- P51-B: pure geometry (canvas / smart-guides / adapter tile layout) ---
export * from './canvasMeasurement'
export * from './smartGuides'
export * from './tileLayout'
export * from './sectionHeight'

// --- P51-B increment 2d: group geometry (generic over structural slot/group) ---
export * from './groupGeometry'

// --- P51-B increment 2d: scope-keyed localStorage view hooks (scopeId injected) ---
export * from './usePersistentAccordion'
export * from './useScrollRestore'
export * from './useReloadSafeView'

// --- P51-B increment 2: decoupled css / geometry / layout helpers ---
export * from './shadowPresets'
export * from './graphicLayerTransform'
export * from './alignSlots'
export * from './breakpointViewport'
export * from './slotEffects'
export * from './gradientCss'
export * from './clipPath'
export * from './resolveBreakpointValue'

// --- P51-B increment 2b: font loaders + recent-fonts store (parametrized) ---
export * from './loadCustomFonts'
export * from './loadGoogleFont'
export * from './useRecentFonts'

// --- P51-B increment 2c: media hooks (generic over item shape) ---
export * from './useMediaDimensions'
export * from './useMediaLightbox'

// --- P51-B: generic browser / React hooks ---
export * from './useCarousel'
export * from './useIdleTimeout'
export * from './useOnlineStatus'
export * from './useTabVisibility'
export * from './useViewportHeight'
export * from './useDirtyGuard'
export * from './useLazyAccordion'
export * from './useXhrUpload'
export * from './useBuilderDeepLink'
export * from './useLightbox'

// --- P51-J: stable per-instance space color (AuthBar carry-over) ---
export * from './spaceColor'
