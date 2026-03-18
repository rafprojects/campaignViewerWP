/**
 * Tooltip text catalog for SettingsPanel controls.
 * Keyed by a human-readable identifier matching the setting.
 * Keeping tooltips in a separate file simplifies future i18n.
 */
export const SETTING_TOOLTIPS: Record<string, string> = {
  // ── Card Appearance (advanced) ──
  cardLockedOpacity: 'Opacity of locked campaign cards. 0 = invisible, 1 = fully visible.',
  cardGradientStartOpacity: 'Opacity at the start (top) of the card gradient overlay.',
  cardGradientEndOpacity: 'Opacity at the end (bottom) of the card gradient overlay.',
  cardLockIconSize: 'Size in pixels of the lock icon shown on private campaign cards.',
  cardAccessIconSize: 'Size in pixels of the access badge icon on campaign cards.',
  cardBadgeOffsetY: 'Vertical offset in pixels for the access badge from the card top.',
  cardCompanyBadgeMaxWidth: 'Maximum width in pixels for the company name badge.',
  cardThumbnailHoverTransitionMs: 'Duration (ms) of the zoom effect when hovering a card thumbnail.',
  cardPageTransitionOpacity: 'Opacity of cards during page-change transitions.',
  cardAutoColumnsBreakpoints: 'Comma-separated width:columns pairs. Cards adapt column count to viewport width.',

  // ── Gallery Text (advanced) ──
  galleryTitleText: 'Main heading shown above the campaign card gallery.',
  gallerySubtitleText: 'Subtitle text displayed beneath the gallery title.',
  campaignAboutHeadingText: 'The heading for the "About" section inside the campaign viewer.',

  // ── Modal / Viewer (advanced) ──
  modalCoverMobileRatio: 'Height ratio of the campaign cover image on mobile screens.',
  modalCoverTabletRatio: 'Height ratio of the campaign cover image on tablet screens.',
  modalCloseButtonSize: 'Size in pixels of the modal close (×) button.',
  modalCloseButtonBgColor: 'Background color of the close button pill.',
  modalContentMaxWidth: 'Maximum width (px) of the content area inside the campaign modal.',
  campaignDescriptionLineHeight: 'Line height multiplier for the campaign description text.',
  modalMobileBreakpoint: 'Viewport width (px) below which the modal enters mobile layout.',

  // ── Upload / Media (advanced) ──
  uploadMaxSizeMb: 'Maximum file size (MB) allowed for a single media upload.',
  uploadAllowedTypes: 'Comma-separated MIME patterns for accepted upload types (e.g. image/*,video/*).',
  libraryPageSize: 'Number of items per page in the media library picker.',
  mediaListPageSize: 'Number of items per page in the media list view.',
  mediaCompactCardHeight: 'Height (px) of compact media cards in list or grid view.',
  mediaSmallCardHeight: 'Height (px) of small media cards.',
  mediaMediumCardHeight: 'Height (px) of medium media cards.',
  mediaLargeCardHeight: 'Height (px) of large media cards.',
  mediaListMinWidth: 'Minimum viewport width (px) before the media list collapses to compact mode.',
  swrDedupingIntervalMs: 'Minimum time (ms) between duplicate API requests for the same resource.',
  notificationDismissMs: 'How long (ms) success/error notifications stay visible before dismissing.',
  optimizeOnUpload: 'Automatically resize and compress uploaded images to reduce storage and load times.',
  optimizeMaxWidth: 'Maximum width (px) to resize uploaded images down to.',
  optimizeMaxHeight: 'Maximum height (px) to resize uploaded images down to.',
  optimizeQuality: 'JPEG/WebP compression quality (1–100). Lower = smaller files, more artifacts.',
  optimizeWebpEnabled: 'Generate WebP copies alongside originals for browsers that support it.',
  thumbnailCacheTtl: 'How long (seconds) externally-fetched thumbnails are cached before re-fetching.',

  // ── Tile / Adapter (advanced) ──
  tileHoverOverlayOpacity: 'Opacity of the dark overlay that appears when hovering a gallery tile.',
  tileBounceScaleHover: 'Scale factor applied to tiles on hover (1 = no scale, 1.05 = subtle bounce).',
  tileBounceScaleActive: 'Scale factor applied to tiles when clicked/tapped.',
  tileBounceDurationMs: 'Duration (ms) of the bounce animation on tile hover/active.',
  tileBaseTransitionDurationMs: 'Base CSS transition duration (ms) for tile state changes.',
  tileTransitionDurationMs: 'Duration (ms) of the tile appearance/disappearance transition.',
  hexVerticalOverlapRatio: 'Vertical overlap between hexagonal tile rows (0 = no overlap, 0.25 = standard).',
  diamondVerticalOverlapRatio: 'Vertical overlap between diamond tile rows.',
  hexClipPath: 'CSS clip-path polygon for hexagonal tiles. Change to alter the hex shape.',
  diamondClipPath: 'CSS clip-path polygon for diamond tiles.',
  tileDefaultPerRow: 'Default number of tiles per row in shaped gallery adapters.',
  photoNormalizeHeight: 'Target height (px) for normalizing photo aspect ratios in the justified gallery.',
  masonryAutoColumnBreakpoints: 'Comma-separated width:columns pairs controlling masonry column count.',
  gridCardHoverShadow: 'CSS box-shadow applied to compact grid cards on hover.',
  gridCardDefaultShadow: 'CSS box-shadow applied to compact grid cards at rest.',
  gridCardHoverScale: 'Scale factor for compact grid cards on hover.',

  // ── Lightbox (advanced) ──
  lightboxTransitionMs: 'Duration (ms) of the lightbox open/close animation.',
  lightboxBackdropColor: 'Background color of the lightbox backdrop (default: dark semi-transparent).',
  lightboxEntryScale: 'Initial scale of the image when the lightbox opens (animates to 1).',
  lightboxVideoMaxWidth: 'Maximum width (px) of videos inside the lightbox.',
  lightboxVideoHeight: 'Height (px) of the video player inside the lightbox.',
  lightboxMediaMaxHeight: 'CSS max-height of media inside the lightbox (e.g. 85vh).',
  lightboxZIndex: 'z-index of the lightbox overlay. Increase if it appears behind other elements.',

  // ── Navigation (advanced) ──
  dotNavMaxVisibleDots: 'Maximum number of pagination dots shown before truncation.',
  navArrowEdgeInset: 'Distance (px) of navigation arrows from the carousel edge.',
  navArrowMinHitTarget: 'Minimum touch/click target size (px) for navigation arrows (accessibility).',
  navArrowFadeDurationMs: 'Duration (ms) of the arrow fade-in/fade-out animation.',
  navArrowScaleTransitionMs: 'Duration (ms) of the arrow scale transition on hover.',
  viewportHeightMobileRatio: 'Fraction of the viewport height used for the carousel on mobile.',
  viewportHeightTabletRatio: 'Fraction of the viewport height used for the carousel on tablet.',
  searchInputMinWidth: 'Minimum width (px) of the campaign search input field.',
  searchInputMaxWidth: 'Maximum width (px) of the campaign search input field.',

  // ── System (advanced) ──
  expiryWarningThresholdMs: 'Show a "session expiring" warning this many milliseconds before the token expires.',
  adminSearchDebounceMs: 'Delay (ms) after the last keystroke before firing a search query.',
  loginMinPasswordLength: 'Minimum password length enforced on the login form.',
  loginFormMaxWidth: 'Maximum width (px) of the login form container.',
  authBarBackdropBlur: 'Blur radius (px) of the auth bar backdrop. 0 disables the blur effect.',
  authBarMobileBreakpoint: 'Viewport width (px) below which the auth bar switches to mobile layout.',
  preserveDataOnUninstall: 'Keep all campaigns, templates, analytics, and uploads when the plugin is removed.',

  // ── Data Maintenance ──
  archivePurgeDays: 'Archived campaigns older than this many days are moved to trash. 0 = never auto-purge.',
  archivePurgeGraceDays: 'Trashed campaigns are permanently deleted after this many days.',
  analyticsRetentionDays: 'Analytics events older than this many days are purged. 0 = keep indefinitely.',
};
