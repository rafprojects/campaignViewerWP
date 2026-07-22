/**
 * Layout Builder data model: templates, slots, layers, effects, groups, guides.
 *
 * Split out of `types/index.ts` (Phase 70-G); re-exported from `./index`.
 */
import type { ResponsiveBreakpoint, TypographyOverride } from './gallerySettings';

// ── P15-B: Layout Builder Data Model ──────────────────────────────

/**
 * Shape preset for a layout slot. Each maps to a CSS clip-path value.
 * 'custom' uses the slot's own `clipPath` string.
 */
export type LayoutSlotShape =
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'hexagon'
  | 'diamond'
  | 'parallelogram-left'
  | 'parallelogram-right'
  | 'chevron'
  | 'arrow'
  | 'trapezoid'
  | 'custom';

/**
 * A single media slot inside a layout template.
 * All position/size values are percentages (0–100) of the canvas dimensions.
 */
export interface LayoutSlot {
  id: string;
  /** % from left edge */
  x: number;
  /** % from top edge */
  y: number;
  /** % of canvas width */
  width: number;
  /** % of canvas height */
  height: number;
  /** Layer order */
  zIndex: number;
  /** Shape preset */
  shape: LayoutSlotShape;
  /** Custom CSS clip-path (used when shape === 'custom') */
  clipPath?: string | undefined;
  /** CSS mask-image URL (legacy — prefer maskLayer for new templates) */
  maskUrl?: string | undefined;
  /** CSS mask-mode (legacy — prefer maskLayer for new templates) */
  maskMode?: 'luminance' | 'alpha' | undefined;
  /** Mask layer with full position/scale/feather controls (replaces maskUrl). */
  maskLayer?: MaskLayer | undefined;
  /** Corner rounding in px (for rectangle shapes) */
  borderRadius: number;
  /** Border thickness in px (0 = none) */
  borderWidth: number;
  /** Border CSS color */
  borderColor: string;
  /** How the image fills the slot */
  objectFit: 'cover' | 'contain' | 'fill';
  /** CSS object-position for focal point, e.g. '50% 30%' */
  objectPosition: string;
  /** Fixed media binding (overrides auto-assignment) */
  mediaId?: string | undefined;
  /** WP attachment post ID for cross-campaign matching (same image → same attachmentId). */
  mediaAttachmentId?: number | undefined;
  /** Media URL for cross-campaign matching fallback. */
  mediaUrl?: string | undefined;
  /** Click behavior in rendered gallery */
  clickAction: 'lightbox' | 'none';
  /** Hover behavior in rendered gallery */
  hoverEffect: 'pop' | 'glow' | 'none';
  /** Per-slot glow color (overrides campaign-level tileGlowColor when hoverEffect is 'glow'). */
  glowColor?: string | undefined;
  /** Per-slot glow spread in px (overrides campaign-level tileGlowSpread when hoverEffect is 'glow'). */
  glowSpread?: number | undefined;
  // ── Layer system (P16) ──
  /** Human-readable label shown in the layer panel. Defaults to "Slot N" if absent. */
  name?: string | undefined;
  /** Builder-only visibility. false = ghost at 10% opacity in editor; no effect on gallery rendering. */
  visible?: boolean | undefined;
  /** Prevents drag/resize in the builder. No effect on gallery rendering. */
  locked?: boolean | undefined;
  /** When true, drag-resize handles maintain the width/height ratio. */
  lockAspectRatio?: boolean | undefined;
  // ── Image effects (P20 QA-R3) ──
  /** CSS filter chain (brightness, contrast, etc.). */
  filterEffects?: SlotFilterEffects | undefined;
  /** Drop-shadow or glow applied via CSS filter. */
  shadow?: SlotShadow | undefined;
  /** 3D tilt on mouse interaction. Applied in gallery only (not builder). */
  tilt?: SlotTiltEffect | undefined;
  /** CSS mix-blend-mode. Default: 'normal'. */
  blendMode?: SlotBlendMode | undefined;
  /** Darken/lighten overlay on the slot. */
  overlayEffect?: SlotOverlayEffect | undefined;
  /** Visual rotation in degrees (0–359). Does not affect drag/resize bounding box. */
  rotation?: number | undefined;
  /** Render opacity 0–1 (default 1 = fully opaque). Applies in builder preview/edit and gallery. */
  opacity?: number | undefined;
  /** Scroll-reveal entrance animation in the rendered gallery (P58-E). Absent = no animation. */
  entranceAnimation?: SlotEntranceAnimation | undefined;
}

/** Keys of LayoutSlot that can be overridden per breakpoint (P58-B). */
export const SLOT_BREAKPOINT_OVERRIDE_KEYS = [
  'x', 'y', 'width', 'height', 'visible', 'rotation', 'opacity', 'zIndex',
] as const;
export type SlotBreakpointOverrideKey = typeof SLOT_BREAKPOINT_OVERRIDE_KEYS[number];
/** Sparse per-breakpoint overrides for a single slot (P58-B). */
export type SlotBreakpointOverrides = Partial<Pick<LayoutSlot, SlotBreakpointOverrideKey>>;

/** Sensible defaults for a new layout slot. */
export const DEFAULT_LAYOUT_SLOT: LayoutSlot = {
  id: '',
  x: 0,
  y: 0,
  width: 25,
  height: 25,
  zIndex: 0,
  shape: 'rectangle',
  borderRadius: 4,
  borderWidth: 0,
  borderColor: '#ffffff',
  objectFit: 'cover',
  objectPosition: '50% 50%',
  clickAction: 'lightbox',
  hoverEffect: 'pop',
};

/**
 * A decorative graphic layer rendered above slots (P15-H, renamed P17-F).
 * All position/size values are percentages (0–100) of the canvas.
 * Stored in `template.overlays` (key unchanged for DB compatibility).
 */
export interface LayoutGraphicLayer {
  id: string;
  /** Transparent PNG/SVG URL */
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  /** 0–1 */
  opacity: number;
  /** false = click-through (default) */
  pointerEvents: boolean;
  // ── Layer system (P16) ──
  /** Human-readable label shown in the layer panel. Defaults to "Overlay N" if absent. */
  name?: string | undefined;
  /** Builder-only visibility. false = ghost at 10% opacity in editor; no effect on gallery rendering. */
  visible?: boolean | undefined;
  /** Prevents drag/resize in the builder. No effect on gallery rendering. */
  locked?: boolean | undefined;
  // ── Transform (P50-J asset-layer parity) ──
  /** Rotation in degrees applied to the visual content (the bounding box stays axis-aligned). */
  rotation?: number | undefined;
  /** Mirror the image horizontally. */
  flipH?: boolean | undefined;
  /** Mirror the image vertically. */
  flipV?: boolean | undefined;
  // ── Shape & geometry (P50-J) — reuses the slot shape/clip/mask sub-systems ──
  /** Shape preset; absent or 'rectangle' = no clipping. */
  shape?: LayoutSlotShape | undefined;
  /** Custom CSS clip-path (used when shape === 'custom'). */
  clipPath?: string | undefined;
  /** Mask layer with position/scale/feather controls (CSS mask-image). */
  maskLayer?: MaskLayer | undefined;
  // ── Border (P50-J) ──
  /** Corner rounding in px (rectangle shapes). */
  borderRadius?: number | undefined;
  /** Border thickness in px (0 / absent = none). */
  borderWidth?: number | undefined;
  /** Border CSS color. */
  borderColor?: string | undefined;
  // ── Effects (P50-J) — reuses the slot effect helpers ──
  /** CSS filter chain (brightness, contrast, blur, …). */
  filterEffects?: SlotFilterEffects | undefined;
  /** Drop-shadow applied via CSS filter. */
  shadow?: SlotShadow | undefined;
  /** CSS mix-blend-mode. Default: 'normal'. */
  blendMode?: SlotBlendMode | undefined;
}

// ── P59-A: Text Layer ─────────────────────────────────────────────

/** Semantic role for a text layer — selects the rendered HTML element. */
export type LayoutTextSemanticTag = 'heading' | 'subheading' | 'paragraph' | 'caption';

/** Horizontal text alignment for a text layer. */
export type LayoutTextAlign = 'left' | 'center' | 'right';

/**
 * A first-class text layer rendered above slots (P59-A).
 *
 * Position/size values are percentages (0–100) of the canvas, mirroring
 * `LayoutGraphicLayer`. `content` is a plain user-authored string rendered as
 * real, semantic, screen-reader-reachable DOM text (never baked into an image),
 * so it stays editable, accessible, and translatable by multilingual plugins.
 * Typography reuses the shared {@link TypographyOverride} system. Stored in
 * `template.texts`.
 */
export interface LayoutTextLayer {
  id: string;
  /** % from left edge */
  x: number;
  /** % from top edge */
  y: number;
  /** % of canvas width */
  width: number;
  /** % of canvas height */
  height: number;
  /** Layer order */
  zIndex: number;
  /** Render opacity 0–1 (default 1 = fully opaque). */
  opacity: number;
  // ── Text content & role ──
  /** The text to render (plain string; output directly as semantic DOM). */
  content: string;
  /** Semantic role → element: heading→h2, subheading→h3, paragraph→p, caption→styled p. */
  semanticTag: LayoutTextSemanticTag;
  /** Horizontal text alignment within the layer box (not part of TypographyOverride). */
  textAlign: LayoutTextAlign;
  /**
   * Typography — reuses the shared {@link TypographyOverride} system, so the
   * properties panel can drop in `<TypographyEditor>` and the render path can
   * use the same override→CSS converter (`typographyOverrideToStyle`) as the
   * rest of the app. Sparse: unset keys inherit theme/element defaults.
   */
  typography: TypographyOverride;
  // ── Layer system (P16 parity) ──
  /** Human-readable label shown in the layer panel. Defaults to "Text Layer N" if absent. */
  name?: string | undefined;
  /** Builder-only visibility. false = ghost in editor; no effect on gallery rendering. */
  visible?: boolean | undefined;
  /** Prevents drag/resize in the builder. No effect on gallery rendering. */
  locked?: boolean | undefined;
  /** Visual rotation in degrees. Does not affect the drag/resize bounding box. */
  rotation?: number | undefined;
}

/** Sensible defaults for a new text layer. Typography is sparse — only seeds a
 *  legible starting style; unset keys inherit the theme font. */
export const DEFAULT_TEXT_LAYER: LayoutTextLayer = {
  id: '',
  x: 20,
  y: 20,
  width: 40,
  height: 12,
  zIndex: 0,
  opacity: 1,
  content: 'Text',
  semanticTag: 'heading',
  textAlign: 'left',
  typography: {
    fontSize: '28px',
    fontWeight: 600,
    lineHeight: 1.2,
    color: '#ffffff',
  },
};

export type BackgroundMode = 'none' | 'color' | 'gradient' | 'image';

/** Gradient type: linear, radial, or conic. */
export type GradientType = 'linear' | 'radial' | 'conic';

/**
 * Direction presets (kept for backward compat).
 * With `gradientType` + `gradientAngle`, these serve as quick-select shortcuts.
 */
export type GradientDirection = 'horizontal' | 'vertical' | 'diagonal-right' | 'diagonal-left' | 'radial';

/** Radial gradient shape: `circle` or `ellipse` (default). */
export type RadialShape = 'circle' | 'ellipse';

/** Radial gradient size keyword. */
export type RadialSize = 'closest-side' | 'closest-corner' | 'farthest-side' | 'farthest-corner';

export interface GradientStop {
  color: string;      // rgba or hex
  position?: number | undefined;  // 0–100 %
}

// ── Mask Layer Sub-System ─────────────────────────────────────────

/**
 * A mask layer sits as a child of a slot, controlling how the slot's image is
 * clipped via CSS mask-image.  Position/size are percentages relative to the
 * slot bounding box.
 */
export interface MaskLayer {
  /** Mask image URL (SVG/PNG). */
  url: string;
  /** 'luminance' (default) interprets white=visible, black=hidden. 'alpha' uses transparency. */
  mode: 'luminance' | 'alpha';
  /** Horizontal offset as % of slot width (0 = left-aligned). */
  x: number;
  /** Vertical offset as % of slot height (0 = top-aligned). */
  y: number;
  /** Mask width as % of slot width (100 = same width). */
  width: number;
  /** Mask height as % of slot height (100 = same height). */
  height: number;
  /** Gaussian-blur feather intensity in px applied to the mask edges (0 = sharp). */
  feather: number;
  /** When false the mask is temporarily hidden without removing config. Defaults to true. */
  visible?: boolean;
}

/** Default mask layer positioned to fill its slot. */
export const DEFAULT_MASK_LAYER: Omit<MaskLayer, 'url'> = {
  mode: 'luminance',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  feather: 0,
};

// ── Image Effects ─────────────────────────────────────────────────

/** CSS filter chain values.  All default to their identity/no-op value. */
export interface SlotFilterEffects {
  brightness?: number;   // 100 = identity, 0–200+
  contrast?: number;     // 100 = identity, 0–200+
  saturate?: number;     // 100 = identity, 0–200+
  blur?: number;         // px, 0 = none
  grayscale?: number;    // 0–100 %
  sepia?: number;        // 0–100 %
  hueRotate?: number;    // degrees 0–360
  invert?: number;       // 0–100 %
}

/** Drop- or glow-shadow applied via CSS filter. */
export interface SlotShadow {
  offsetX: number;   // px
  offsetY: number;   // px
  blur: number;      // px
  color: string;     // rgba
}

/** 3D tilt effect on mouse interaction.  Applied via CSS transform + JS onMouseMove. */
export interface SlotTiltEffect {
  enabled: boolean;
  /** Max rotation angle in degrees (default 15). */
  maxAngle: number;
  /** Perspective distance in px (default 1000). */
  perspective: number;
  /** Transition speed in ms when resetting tilt (default 300). */
  resetSpeed: number;
}

/** Entrance (scroll-reveal) animation for a slot in the rendered gallery (P58-E). */
export type SlotEntranceType = 'fade' | 'slide' | 'zoom';
export type SlotEntranceDirection = 'up' | 'down' | 'left' | 'right';
export interface SlotEntranceAnimation {
  /** Animation variant. */
  type: SlotEntranceType;
  /** Slide direction (only used when type === 'slide'). Default 'up'. */
  direction?: SlotEntranceDirection | undefined;
  /** Duration in ms (default 600). */
  durationMs?: number | undefined;
  /** Delay before the animation starts, in ms — for staggering (default 0). */
  delayMs?: number | undefined;
}

/** CSS mix-blend-mode for the slot element. */
export type SlotBlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

/** Static darken/lighten overlay on the slot (applied as a CSS pseudo-layer). */
export interface SlotOverlayEffect {
  /** 'darken' adds semi-transparent black, 'lighten' adds semi-transparent white, 'none' disables. */
  mode: 'none' | 'darken' | 'lighten';
  /** Intensity 0–100 (maps to overlay opacity). */
  intensity: number;
  /** Whether overlay only appears on hover. */
  onHoverOnly: boolean;
}

/** Persistent guide line saved per-template in the Layout Builder (P57-E). */
export interface PersistentGuide {
  id: string;
  /** 'x' = vertical line at x% of canvas width; 'y' = horizontal line at y% of canvas height. */
  axis: 'x' | 'y';
  /** Position as 0–100% of the canvas along the guide's axis dimension. */
  position: number;
  locked: boolean;
}

/**
 * A reusable layout template that defines the visual arrangement of media slots
 * on a fixed-ratio canvas. Stored globally in `wpsg_layout_templates` WP option.
 */
export interface LayoutTemplate {
  id: string;
  name: string;
  /** Schema version for future migrations (starts at 1) */
  schemaVersion: number;
  /** Canvas width / height ratio (e.g. 16/9 ≈ 1.778) */
  canvasAspectRatio: number;
  /** Minimum render width in px */
  canvasMinWidth: number;
  /** Maximum render width in px (0 = fill container) */
  canvasMaxWidth: number;
  /**
   * How canvas height is determined.
   * - `'aspect-ratio'` (default): height = width / canvasAspectRatio
   * - `'fixed-vh'`: height = canvasHeightVh % of viewport height
   */
  canvasHeightMode?: 'aspect-ratio' | 'fixed-vh' | undefined;
  /** Viewport-height percentage used when canvasHeightMode is 'fixed-vh' (1–100, default 50). */
  canvasHeightVh?: number | undefined;
  /** Background mode: 'none' (transparent), 'color', 'gradient', or 'image'. Default: 'color'. */
  backgroundMode?: BackgroundMode | undefined;
  /** CSS background color for the canvas */
  backgroundColor: string;
  /** Gradient type: linear, radial, or conic. Default: 'linear'. */
  backgroundGradientType?: GradientType | undefined;
  /** Gradient direction preset (legacy shortcut, maps to angle). */
  backgroundGradientDirection?: GradientDirection | undefined;
  /** Custom angle in degrees for linear/conic gradients (overrides direction preset). */
  backgroundGradientAngle?: number | undefined;
  /** Gradient color stops (2–3 entries). */
  backgroundGradientStops?: GradientStop[] | undefined;
  /** Radial gradient shape. Default: 'ellipse'. */
  backgroundRadialShape?: RadialShape | undefined;
  /** Radial gradient size. Default: 'farthest-corner'. */
  backgroundRadialSize?: RadialSize | undefined;
  /** Radial / conic gradient center X as % (0–100). Default: 50. */
  backgroundGradientCenterX?: number | undefined;
  /** Radial / conic gradient center Y as % (0–100). Default: 50. */
  backgroundGradientCenterY?: number | undefined;
  /** Optional background image URL (layered on top of backgroundColor) */
  backgroundImage?: string | undefined;
  /** How the background image fills the canvas (default: 'cover') */
  backgroundImageFit?: 'cover' | 'contain' | 'fill' | undefined;
  /** Background image opacity 0–1 (default: 1) */
  backgroundImageOpacity?: number | undefined;
  /** Ordered list of media slots */
  slots: LayoutSlot[];
  /** Decorative graphic layers (P15-H). Key is `overlays` for DB compatibility. */
  overlays: LayoutGraphicLayer[];
  /** First-class text layers rendered above slots (P59-A). Absent on pre-v3 templates. */
  texts?: LayoutTextLayer[] | undefined;
  /**
   * Nested slot/overlay groups (P30-G). Each group has direct leaf members
   * (memberIds) and optional child groups (childGroupIds), forming a tree.
   * All slot positions are canvas-absolute; group frame geometry (x/y/width/height)
   * is derived from the union of all descendants and stored for resolver efficiency.
   */
  groups?: LayoutGroup[] | undefined;
  /** Persistent guide lines saved with the template (P57-E). */
  guides?: PersistentGuide[] | undefined;
  /**
   * Per-breakpoint slot overrides (P58-B). Each key is a ResponsiveBreakpoint;
   * value maps slotId → sparse overrides (position, size, visibility, appearance).
   * Desktop is always the base; tablet/mobile entries are sparse overrides on top.
   * Absent = no overrides (desktop-only layout).
   */
  breakpointOverrides?: Partial<Record<ResponsiveBreakpoint, Record<string, SlotBreakpointOverrides>>> | undefined;
  /** ISO 8601 created timestamp */
  createdAt: string;
  /** ISO 8601 last-updated timestamp */
  updatedAt: string;
  /** Organizational tags */
  tags: string[];
}

/**
 * Named group of slots/overlays that can be locked/hidden/moved as a unit.
 * Groups form a tree via parentGroupId / childGroupIds (P30-G). Flat groups
 * from P29-G-C are migrated on load: parentGroupId = null, childGroupIds = [].
 *
 * Slot positions are always canvas-absolute (0–100%). The group's own
 * x/y/width/height is the union bounding box of all descendant slots in canvas
 * space — kept up-to-date after every move/resize/regroup operation so callers
 * can read it without re-deriving from the full slot tree.
 */
export interface LayoutGroup {
  id: string;
  /** Display name shown in the Layers panel. */
  name?: string | undefined;
  /** IDs of DIRECT leaf slot/overlay members (not child groups). */
  memberIds: string[];
  /**
   * IDs of immediate child groups (P30-G).
   * Absent on pre-P30-G data; treated as empty on read.
   */
  childGroupIds?: string[] | undefined;
  /**
   * ID of the parent group, or null for a top-level group (P30-G).
   * Absent on pre-P30-G data; treated as null on read.
   */
  parentGroupId?: string | null | undefined;
  /**
   * Union bounding box of all descendants in canvas % coordinates (P30-G).
   * Derived and stored after each structural change for read efficiency.
   * May be absent on legacy data — call `computeGroupRect()` to derive on demand.
   */
  x?: number | undefined;
  y?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  /** When true the group row is collapsed in the Layers panel. */
  collapsed?: boolean | undefined;
  /** When true, member slots/overlays cannot be moved or resized. */
  locked?: boolean | undefined;
  /** When false, member slots/overlays are hidden in the editor. */
  visible?: boolean | undefined;
}

/**
 * Per-campaign binding that references a global template and stores
 * per-slot overrides (e.g. fixed media assignments, focal point tweaks).
 * Stored as post_meta `_wpsg_layout_binding`.
 */
export interface CampaignLayoutBinding {
  templateId: string;
  slotOverrides: Record<string, {
    mediaId?: string;
    objectPosition?: string;
  }>;
}
