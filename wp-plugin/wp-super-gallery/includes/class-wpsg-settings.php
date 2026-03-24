<?php
/**
 * WP Super Gallery Settings Page
 *
 * Handles plugin configuration through WordPress admin.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Settings class for WP Super Gallery.
 */
class WPSG_Settings {

    /**
     * Option name for all plugin settings.
     */
    const OPTION_NAME = 'wpsg_settings';

    /**
     * Settings page slug.
     */
    const PAGE_SLUG = 'wpsg-settings';

    /**
     * Default settings values.
     *
     * The $defaults array is the single source of truth for ALL settings.
     * Snake-case keys are auto-converted to camelCase for the REST/JS layer
     * via snake_to_camel(). Adding a key here automatically wires it into
     * get_public_settings(), update_settings(), and sanitize_settings().
     *
     * @var array
     */
    private static $defaults = [
        'auth_provider'              => 'wp-jwt',
        'api_base'                   => '',
        'theme'                      => 'default-dark',
        'allow_user_theme_override'  => true,
        'gallery_layout'             => 'grid',
        'items_per_page'             => 12,
        'enable_lightbox'            => true,
        'enable_animations'          => true,
        'video_viewport_height'      => 420,
        'image_viewport_height'      => 420,
        'thumbnail_scroll_speed'     => 1.0,
        'scroll_animation_style'     => 'smooth',
        'scroll_animation_duration_ms' => 350,
        'scroll_animation_easing'    => 'ease',
        'scroll_transition_type'     => 'slide-fade',
        'image_border_radius'        => 8,
        'video_border_radius'        => 8,
        'transition_fade_enabled'    => true,
        // P12-A/B: Advanced thumbnail strip
        'video_thumbnail_width'      => 60,
        'video_thumbnail_height'     => 45,
        'image_thumbnail_width'      => 60,
        'image_thumbnail_height'     => 60,
        'thumbnail_gap'              => 6,
        'thumbnail_wheel_scroll_enabled' => true,
        'thumbnail_drag_scroll_enabled'  => true,
        'thumbnail_scroll_buttons_visible' => false,
        // P12-H: Navigation Overlay Arrows
        'nav_arrow_position'         => 'center',
        'nav_arrow_size'             => 36,
        'nav_arrow_color'            => '#ffffff',
        'nav_arrow_bg_color'         => 'rgba(0,0,0,0.45)',
        'nav_arrow_border_width'     => 0,
        'nav_arrow_hover_scale'      => 1.1,
        'nav_arrow_auto_hide_ms'     => 0,
        // P12-I: Dot Navigator
        'dot_nav_enabled'            => true,
        'dot_nav_position'           => 'below',
        'dot_nav_size'               => 10,
        'dot_nav_active_color'       => 'var(--wpsg-color-primary)',
        'dot_nav_inactive_color'     => 'rgba(128,128,128,0.4)',
        'dot_nav_shape'              => 'circle',
        'dot_nav_spacing'            => 6,
        'dot_nav_active_scale'       => 1.3,
        // P12-J: Shadow & Depth
        'image_shadow_preset'        => 'subtle',
        'video_shadow_preset'        => 'subtle',
        'image_shadow_custom'        => '0 2px 8px rgba(0,0,0,0.15)',
        'video_shadow_custom'        => '0 2px 8px rgba(0,0,0,0.15)',
        // P12-C: Gallery Adapters
        'image_gallery_adapter_id'   => 'classic',
        'video_gallery_adapter_id'   => 'classic',
        'unified_gallery_enabled'    => false,
        'unified_gallery_adapter_id' => 'compact-grid',
        'grid_card_width'            => 160,
        'grid_card_height'           => 224,
        'mosaic_target_row_height'   => 200,
        // Tile appearance (hex / circle / diamond / masonry / justified)
        'tile_size'                  => 150,
        'tile_gap_x'                 => 8,
        'tile_gap_y'                 => 8,
        'tile_border_width'          => 0,
        'tile_border_color'          => '#ffffff',
        'tile_glow_enabled'          => false,
        'tile_glow_color'            => '#7c9ef8',
        'tile_glow_spread'           => 12,
        'tile_hover_bounce'          => true,
        'masonry_columns'            => 0,
        // Viewport backgrounds
        'image_bg_type'              => 'none',
        'image_bg_color'             => '#1a1a2e',
        'image_bg_gradient'          => 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
        'image_bg_image_url'         => '',
        'video_bg_type'              => 'none',
        'video_bg_color'             => '#0d0d0d',
        'video_bg_gradient'          => 'linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 100%)',
        'video_bg_image_url'         => '',
        'unified_bg_type'            => 'none',
        'unified_bg_color'           => '#1a1a2e',
        'unified_bg_gradient'        => 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
        'unified_bg_image_url'       => '',
        // P13-A: Campaign Card
        'card_border_radius'         => 8,
        'card_border_width'          => 4,
        'card_border_mode'           => 'auto',
        'card_border_color'          => '#228be6',
        'card_shadow_preset'         => 'subtle',
        'card_thumbnail_height'      => 200,
        'card_thumbnail_fit'         => 'cover',
        'card_grid_columns'          => 0,
        'card_gap_h'                 => 16,
        'card_gap_v'                 => 16,
        'card_max_width'             => 0,
        'modal_cover_height'         => 240,
        'modal_transition'           => 'pop',
        'modal_transition_duration'  => 300,
        'modal_max_height'           => 90,
        // P13-F: Card Gallery Pagination
        'card_display_mode'          => 'load-more',
        'card_rows_per_page'         => 3,
        'card_page_dot_nav'          => false,
        'card_page_transition_ms'    => 300,
        // P13-E: Header visibility toggles
        'show_gallery_title'         => true,
        'show_gallery_subtitle'      => true,
        'show_access_mode'           => true,
        'show_filter_tabs'           => true,
        'show_search_box'            => true,
        // P13-E: App width, padding & per-gallery tile sizes
        'app_max_width'              => 1200,
        'app_padding'                => 16,
        'wp_full_bleed_desktop'      => false,
        'wp_full_bleed_tablet'       => false,
        'wp_full_bleed_mobile'       => false,
        'image_tile_size'            => 150,
        'video_tile_size'            => 150,
        'cache_ttl'                  => 3600,
        // P14-C: Thumbnail cache TTL (seconds).
        'thumbnail_cache_ttl'        => 86400,
        // P14-F: Image optimization on upload.
        'optimize_on_upload'         => false,
        'optimize_max_width'         => 1920,
        'optimize_max_height'        => 1920,
        'optimize_quality'           => 82,
        'optimize_webp_enabled'      => false,
        // ── P14-B: Advanced Settings toggle ───────────────────
        'advanced_settings_enabled'  => false,
        // ── P14-B: Card Appearance (advanced) ─────────────────
        'card_locked_opacity'            => 0.5,
        'card_gradient_start_opacity'    => 0.0,
        'card_gradient_end_opacity'      => 0.85,
        'card_lock_icon_size'            => 32,
        'card_access_icon_size'          => 14,
        'card_badge_offset_y'            => 8,
        'card_company_badge_max_width'   => 160,
        'card_thumbnail_hover_transition_ms' => 300,
        // ── P14-B: Gallery Text (advanced) ────────────────────
        'gallery_title_text'             => 'Gallery',
        'gallery_subtitle_text'          => '',
        'campaign_about_heading_text'    => 'About',
        // ── P14-B: Modal / Viewer (advanced) ──────────────────
        'modal_cover_mobile_ratio'       => 0.6,
        'modal_cover_tablet_ratio'       => 0.75,
        'modal_close_button_size'        => 36,
        'modal_close_button_bg_color'    => 'rgba(0,0,0,0.5)',
        'modal_content_max_width'        => 900,
        'campaign_description_line_height' => 1.6,
        'modal_mobile_breakpoint'        => 768,
        'card_page_transition_opacity'   => 0.3,
        // ── P14-B: Upload / Media (advanced) ──────────────────
        'upload_max_size_mb'             => 50,
        'upload_allowed_types'           => 'image/*,video/*',
        'library_page_size'              => 20,
        'media_list_page_size'           => 50,
        'media_compact_card_height'      => 100,
        'media_small_card_height'        => 80,
        'media_medium_card_height'       => 240,
        'media_large_card_height'        => 340,
        'media_list_min_width'           => 600,
        'swr_deduping_interval_ms'       => 5000,
        'notification_dismiss_ms'        => 4000,
        // ── P14-B: Tile / Adapter (advanced) ──────────────────
        'tile_hover_overlay_opacity'     => 0.6,
        'tile_bounce_scale_hover'        => 1.08,
        'tile_bounce_scale_active'       => 1.02,
        'tile_bounce_duration_ms'        => 300,
        'tile_base_transition_duration_ms' => 250,
        'hex_vertical_overlap_ratio'     => 0.25,
        'diamond_vertical_overlap_ratio' => 0.45,
        'hex_clip_path'                  => 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        'diamond_clip_path'              => 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        'tile_default_per_row'           => 5,
        'photo_normalize_height'         => 300,
        'masonry_auto_column_breakpoints' => '480:2,768:3,1024:4,1280:5',
        'grid_card_hover_shadow'         => '0 4px 12px rgba(0,0,0,0.3)',
        'grid_card_default_shadow'       => '0 2px 8px rgba(0,0,0,0.15)',
        'grid_card_hover_scale'          => 1.02,
        'tile_transition_duration_ms'    => 200,
        // ── P14-B: Lightbox (advanced) ────────────────────────
        'lightbox_transition_ms'         => 250,
        'lightbox_backdrop_color'        => 'rgba(0,0,0,0.92)',
        'lightbox_entry_scale'           => 0.92,
        'lightbox_video_max_width'       => 900,
        'lightbox_video_height'          => 506,
        'lightbox_media_max_height'      => '85vh',
        'lightbox_z_index'               => 1000,
        // ── P14-B: Navigation (advanced) ──────────────────────
        'dot_nav_max_visible_dots'       => 7,
        'nav_arrow_edge_inset'           => 8,
        'nav_arrow_min_hit_target'       => 44,
        'nav_arrow_fade_duration_ms'     => 200,
        'nav_arrow_scale_transition_ms'  => 150,
        'viewport_height_mobile_ratio'   => 0.65,
        'viewport_height_tablet_ratio'   => 0.8,
        'search_input_min_width'         => 200,
        'search_input_max_width'         => 280,
        // ── P14-B: System (advanced) ──────────────────────────
        'expiry_warning_threshold_ms'    => 300000,
        'admin_search_debounce_ms'       => 300,
        'login_min_password_length'      => 1,
        'login_form_max_width'           => 400,
        'auth_bar_backdrop_blur'         => 8,
        'auth_bar_mobile_breakpoint'     => 768,
        'card_auto_columns_breakpoints'  => '480:1,768:2,1024:3,1280:4',
        // ── P15-A: Per-breakpoint gallery selection ───────────
        // ── P20-K: Session idle timeout (minutes). 0 = disabled. ──
        'session_idle_timeout_minutes' => 0,
        'gallery_selection_mode'         => 'unified',
        'desktop_image_adapter_id'       => 'classic',
        'desktop_video_adapter_id'       => 'classic',
        'tablet_image_adapter_id'        => 'classic',
        'tablet_video_adapter_id'        => 'classic',
        'mobile_image_adapter_id'        => 'classic',
        'mobile_video_adapter_id'        => 'classic',
        'layout_builder_scope'           => 'full',
        // ── P20-E: Uninstall data preservation ────────────────
        'preserve_data_on_uninstall'     => false,
        // ── D-4: Archive purge safeguards ─────────────────────
        'archive_purge_days'             => 0,
        'archive_purge_grace_days'       => 30,
        // ── D-20: Analytics data retention ────────────────────
        'analytics_retention_days'       => 0,
        // ── P21-B: Card visibility toggles ────────────────────
        'show_card_company_name'         => true,
        'show_card_media_counts'         => true,
        'show_card_title'                => true,
        'show_card_description'          => true,
        'show_card_border'               => true,
        'show_card_access_badge'         => true,
        'show_card_thumbnail_fade'       => true,
        // ── P21-D: Viewer background & border ─────────────────
        'viewer_bg_type'                 => 'theme',
        'viewer_bg_color'                => '',
        'viewer_bg_gradient'             => [],
        'show_viewer_border'             => true,
        // ── P21-C: Card aspect ratio & max columns ────────────
        'card_max_columns'               => 0,
        'card_aspect_ratio'              => 'auto',
        'card_min_height'                => 0,
        // ── P21-F: CampaignViewer enhancements ────────────────
        'campaign_modal_fullscreen'      => false,
        'show_campaign_company_name'     => true,
        'show_campaign_date'             => true,
        'show_campaign_about'            => true,
        'show_campaign_description'      => true,
        'show_campaign_stats'            => true,
        'campaign_stats_admin_only'      => true,
        'campaign_open_mode'             => 'full',
        // P21-E: Auth bar display mode
        'auth_bar_display_mode'          => 'floating',
        'auth_bar_drag_margin'           => 16,
        // P21-H: Settings tooltips
        'show_settings_tooltips'         => true,
        // P21-I: Typography overrides & in-context editors
        'typography_overrides'           => '{}',
        'show_in_context_editors'        => true,
        // P21-J: QA fixes & UX enhancements
        'show_card_info_panel'           => true,
        'show_campaign_cover_image'      => true,
        'show_campaign_tags'             => true,
        'show_campaign_admin_actions'    => true,
        'show_campaign_gallery_labels'   => true,
        'fullscreen_content_max_width'   => 0,
        // P22-K: Modal max width & background
        'modal_max_width'                => 1200,
        'modal_bg_type'                  => 'theme',
        'modal_bg_color'                 => '',
        'modal_bg_gradient'              => '{}',
        // P21-G: Gallery label customisation
        'gallery_image_label'            => 'Images',
        'gallery_video_label'            => 'Videos',
        'gallery_label_justification'    => 'left',
        'show_gallery_label_icon'        => false,
        // P22-M: Modal gallery width/gap/margin
        'modal_gallery_max_width'        => 0,
        'modal_gallery_gap'              => 32,
        'modal_gallery_margin'           => 0,
        // P22-M: Gallery sizing mode + manual height constraint
        'gallery_sizing_mode'            => 'auto',
        'gallery_manual_height'          => '420px',
        // P22-P2: Dimension propagation — gallery section sizing
        'gallery_section_max_width'      => 0,
        'gallery_section_max_height'     => 0,
        'gallery_section_height_mode'    => 'auto',
        'gallery_section_min_width'      => 300,
        'gallery_section_min_height'     => 150,
        'per_type_section_equal_height'  => false,
        'modal_inner_padding'            => 16,
        'gallery_section_padding'        => 16,
        'adapter_content_padding'        => 0,
        'adapter_sizing_mode'            => 'fill',
        'adapter_max_width_pct'          => 100,
        'adapter_max_height_pct'         => 100,
        // P22-P7: Card width unit, justification, adapter gap & justification
        'card_max_width_unit'            => 'px',
        'card_justify_content'           => 'center',
        'adapter_item_gap'               => 16,
        'adapter_justify_content'        => 'center',
    ];

    /**
     * Settings that are admin-only (not exposed to public/anonymous users).
     *
     * @var string[]
     */
    private static $admin_only_fields = [
        'auth_provider',
        'api_base',
        'allow_user_theme_override',
        'cache_ttl',
        'thumbnail_cache_ttl',
        'optimize_on_upload',
        'optimize_max_width',
        'optimize_max_height',
        'optimize_quality',
        'optimize_webp_enabled',
        'advanced_settings_enabled',
        'upload_max_size_mb',
        'upload_allowed_types',
        'swr_deduping_interval_ms',
        'notification_dismiss_ms',
        'expiry_warning_threshold_ms',
        'admin_search_debounce_ms',
        'login_min_password_length',
        'login_form_max_width',
        'auth_bar_backdrop_blur',
        'auth_bar_mobile_breakpoint',
        'session_idle_timeout_minutes',
        'preserve_data_on_uninstall',
        'archive_purge_days',
        'archive_purge_grace_days',
        'analytics_retention_days',
    ];

    /**
     * Valid options for select fields.
     *
     * @var array
     */
    private static $valid_options = [
        'auth_provider'  => ['wp-jwt', 'none'],
        'theme'          => [
            'default-dark',
            'default-light',
            'material-dark',
            'material-light',
            'darcula',
            'nord',
            'solarized-dark',
            'solarized-light',
            'high-contrast',
            'catppuccin-mocha',
            'tokyo-night',
            'gruvbox-dark',
            'cyberpunk',
            'synthwave',
        ],
        'gallery_layout' => ['grid', 'masonry', 'carousel'],
        'scroll_animation_style' => ['smooth', 'instant'],
        'scroll_animation_easing' => ['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out'],
        'scroll_transition_type' => ['fade', 'slide', 'slide-fade'],
        'nav_arrow_position'     => ['top', 'center', 'bottom'],
        'dot_nav_position'       => ['below', 'overlay-bottom', 'overlay-top'],
        'dot_nav_shape'          => ['circle', 'pill', 'square'],
        'image_shadow_preset'    => ['none', 'subtle', 'medium', 'strong', 'custom'],
        'video_shadow_preset'    => ['none', 'subtle', 'medium', 'strong', 'custom'],
        'card_shadow_preset'     => ['none', 'subtle', 'medium', 'dramatic'],
        'card_thumbnail_fit'     => ['cover', 'contain'],
        'card_border_mode'       => ['auto', 'single', 'individual'],
        'modal_transition'       => ['pop', 'fade', 'slide-up'],
        'card_display_mode'      => ['show-all', 'load-more', 'paginated'],
        'image_bg_type'          => ['none', 'solid', 'gradient', 'image'],
        'video_bg_type'          => ['none', 'solid', 'gradient', 'image'],
        'unified_bg_type'        => ['none', 'solid', 'gradient', 'image'],
        'image_gallery_adapter_id'   => ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond'],
        'video_gallery_adapter_id'   => ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond'],
        'unified_gallery_adapter_id' => ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond'],
        // P15-A: Per-breakpoint gallery selection
        'gallery_selection_mode'     => ['unified', 'per-breakpoint'],
        'desktop_image_adapter_id'   => ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond', 'layout-builder'],
        'desktop_video_adapter_id'   => ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond', 'layout-builder'],
        'tablet_image_adapter_id'    => ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond', 'layout-builder'],
        'tablet_video_adapter_id'    => ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond', 'layout-builder'],
        'mobile_image_adapter_id'    => ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond', 'layout-builder'],
        'mobile_video_adapter_id'    => ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond', 'layout-builder'],
        'layout_builder_scope'       => ['full', 'viewport'],
        // P21-D: Viewer background type
        'viewer_bg_type'             => ['theme', 'transparent', 'solid', 'gradient'],
        // P22-K: Modal background type
        'modal_bg_type'              => ['theme', 'transparent', 'solid', 'gradient'],
        // P21-C: Card aspect ratio
        'card_aspect_ratio'          => ['auto', '16:9', '4:3', '1:1', '3:4', '9:16', '2:3', '3:2', '21:9'],
        // P21-G: Gallery label justification
        'gallery_label_justification' => ['left', 'center', 'right'],
        // P21-F: Campaign open mode
        'campaign_open_mode'          => ['full', 'galleries-only'],
        // P21-E: Auth bar display mode
        'auth_bar_display_mode'       => ['bar', 'floating', 'draggable', 'minimal', 'auto-hide'],
        // P22-M: Gallery sizing mode
        'gallery_sizing_mode'         => ['auto', 'viewport', 'manual'],
        // P22-P2: Gallery section height mode
        'gallery_section_height_mode' => ['auto', 'manual', 'viewport'],
        // P22-P2: Adapter sizing mode
        'adapter_sizing_mode'         => ['fill', 'manual'],
        // P22-P7: Card max width unit
        'card_max_width_unit'         => ['px', '%'],
        // P22-P7: Card justification
        'card_justify_content'        => ['start', 'center', 'end', 'space-between', 'space-evenly'],
        // P22-P7: Adapter justification
        'adapter_justify_content'     => ['start', 'center', 'end', 'space-between', 'space-evenly', 'stretch'],
    ];

    /**
     * Min/max ranges for numeric settings.
     * Keys not listed here have no range clamping beyond type coercion.
     *
     * @var array<string, array{0: int|float, 1: int|float}>
     */
    private static $field_ranges = [
        'items_per_page'              => [1, 100],
        'video_viewport_height'       => [180, 900],
        'image_viewport_height'       => [180, 900],
        'thumbnail_scroll_speed'      => [0.25, 3],
        'scroll_animation_duration_ms' => [0, 2000],
        'image_border_radius'         => [0, 48],
        'video_border_radius'         => [0, 48],
        'video_thumbnail_width'       => [30, 200],
        'video_thumbnail_height'      => [30, 200],
        'image_thumbnail_width'       => [30, 200],
        'image_thumbnail_height'      => [30, 200],
        'thumbnail_gap'               => [0, 24],
        'nav_arrow_size'              => [20, 64],
        'nav_arrow_border_width'      => [0, 6],
        'nav_arrow_hover_scale'       => [1.0, 1.5],
        'nav_arrow_auto_hide_ms'      => [0, 10000],
        'dot_nav_size'                => [4, 24],
        'dot_nav_spacing'             => [2, 20],
        'dot_nav_active_scale'        => [1.0, 2.0],
        'mosaic_target_row_height'    => [60, 600],
        'grid_card_width'             => [80, 400],
        'grid_card_height'            => [80, 600],
        'tile_size'                   => [60, 400],
        'tile_gap_x'                  => [0, 60],
        'tile_gap_y'                  => [0, 60],
        'tile_border_width'           => [0, 20],
        'tile_glow_spread'            => [2, 60],
        'masonry_columns'             => [0, 8],
        'card_border_radius'          => [0, 24],
        'card_border_width'           => [0, 8],
        'card_thumbnail_height'       => [100, 400],
        'card_grid_columns'           => [0, 6],
        'card_gap_h'                  => [0, 48],
        'card_gap_v'                  => [0, 48],
        'modal_cover_height'          => [100, 400],
        'modal_transition_duration'   => [100, 1000],
        'modal_max_height'            => [50, 100],
        'card_rows_per_page'          => [1, 10],
        'card_page_transition_ms'     => [100, 800],
        'app_max_width'               => [0, 3000],
        'app_padding'                 => [0, 100],
        'image_tile_size'             => [60, 400],
        'video_tile_size'             => [60, 400],
        'cache_ttl'                   => [0, 604800],
        // P14 ranges
        'thumbnail_cache_ttl'         => [0, 604800],
        'optimize_max_width'          => [100, 4096],
        'optimize_max_height'         => [100, 4096],
        'optimize_quality'            => [10, 100],
        // Advanced setting ranges
        'card_locked_opacity'         => [0, 1],
        'card_gradient_start_opacity' => [0, 1],
        'card_gradient_end_opacity'   => [0, 1],
        'card_lock_icon_size'         => [12, 64],
        'card_access_icon_size'       => [8, 32],
        'card_badge_offset_y'         => [0, 32],
        'card_company_badge_max_width' => [60, 400],
        'card_thumbnail_hover_transition_ms' => [0, 1000],
        'modal_cover_mobile_ratio'    => [0.2, 1],
        'modal_cover_tablet_ratio'    => [0.2, 1],
        'modal_close_button_size'     => [20, 64],
        'modal_content_max_width'     => [400, 2000],
        'campaign_description_line_height' => [1.0, 3.0],
        'modal_mobile_breakpoint'     => [320, 1280],
        'card_page_transition_opacity' => [0, 1],
        'upload_max_size_mb'          => [1, 500],
        'library_page_size'           => [5, 100],
        'media_list_page_size'        => [10, 200],
        'media_compact_card_height'   => [40, 300],
        'media_small_card_height'     => [40, 300],
        'media_medium_card_height'    => [100, 600],
        'media_large_card_height'     => [100, 800],
        'media_list_min_width'        => [200, 1200],
        'swr_deduping_interval_ms'    => [0, 60000],
        'notification_dismiss_ms'     => [1000, 30000],
        'tile_hover_overlay_opacity'  => [0, 1],
        'tile_bounce_scale_hover'     => [1.0, 1.5],
        'tile_bounce_scale_active'    => [0.8, 1.2],
        'tile_bounce_duration_ms'     => [0, 1000],
        'tile_base_transition_duration_ms' => [0, 1000],
        'hex_vertical_overlap_ratio'  => [0, 0.5],
        'diamond_vertical_overlap_ratio' => [0, 0.8],
        'tile_default_per_row'        => [1, 12],
        'photo_normalize_height'      => [100, 800],
        'grid_card_hover_scale'       => [1.0, 1.3],
        'tile_transition_duration_ms' => [0, 1000],
        'lightbox_transition_ms'      => [0, 1000],
        'lightbox_entry_scale'        => [0.5, 1.0],
        'lightbox_video_max_width'    => [300, 2000],
        'lightbox_video_height'       => [200, 1200],
        'lightbox_z_index'            => [1, 100000],
        'dot_nav_max_visible_dots'    => [3, 20],
        'nav_arrow_edge_inset'        => [0, 48],
        'nav_arrow_min_hit_target'    => [24, 80],
        'nav_arrow_fade_duration_ms'  => [0, 1000],
        'nav_arrow_scale_transition_ms' => [0, 1000],
        'viewport_height_mobile_ratio' => [0.3, 1.0],
        'viewport_height_tablet_ratio' => [0.3, 1.0],
        'search_input_min_width'      => [100, 600],
        'search_input_max_width'      => [100, 800],
        'expiry_warning_threshold_ms' => [60000, 3600000],
        'admin_search_debounce_ms'    => [50, 2000],
        'login_min_password_length'   => [1, 32],
        'login_form_max_width'        => [200, 800],
        'auth_bar_backdrop_blur'      => [0, 24],
        'auth_bar_mobile_breakpoint'  => [320, 1280],
        'session_idle_timeout_minutes' => [0, 480],
        'archive_purge_days'           => [0, 365],
        'archive_purge_grace_days'     => [7, 90],
        'analytics_retention_days'     => [0, 730],
        // P21-C: Card max columns & min height
        'card_max_columns'             => [0, 8],
        'card_min_height'              => [0, 600],
        // P21-E: Auth bar drag margin
        'auth_bar_drag_margin'         => [0, 64],
        // P21-J: Fullscreen content max width (0 = full responsive)
        'fullscreen_content_max_width' => [0, 3000],
        // P22-K: Modal max width (0 = default 'xl')
        'modal_max_width'              => [0, 3000],
        // P22-M: Modal gallery width/gap/margin
        'modal_gallery_max_width'      => [0, 3000],
        'modal_gallery_gap'            => [0, 120],
        'modal_gallery_margin'         => [0, 120],
        // P22-P2: Gallery section sizing ranges
        'gallery_section_max_width'    => [0, 3000],
        'gallery_section_max_height'   => [0, 3000],
        'gallery_section_min_width'    => [0, 1200],
        'gallery_section_min_height'   => [0, 1200],
        'modal_inner_padding'          => [0, 64],
        'gallery_section_padding'      => [0, 32],
        'adapter_content_padding'      => [0, 24],
        'adapter_max_width_pct'        => [50, 100],
        'adapter_max_height_pct'       => [50, 100],
        // P22-P7: Adapter item gap
        'adapter_item_gap'             => [0, 64],
    ];

    /**
     * Register hooks for admin menu and settings.
     */
    public static function init() {
        add_action('admin_menu', [self::class, 'add_menu_page']);
        add_action('admin_init', [self::class, 'register_settings']);
        add_action('wp_ajax_wpsg_test_auth', [self::class, 'ajax_test_auth']);

        // Hook into filters to provide settings values.
        add_filter('wpsg_auth_provider', [self::class, 'filter_auth_provider']);
        add_filter('wpsg_api_base', [self::class, 'filter_api_base']);
    }

    /**
     * Add settings page to admin menu.
     */
    public static function add_menu_page() {
        add_submenu_page(
            'edit.php?post_type=wpsg_campaign',
            __('Super Gallery Settings', 'wp-super-gallery'),
            __('Settings', 'wp-super-gallery'),
            'manage_options',
            self::PAGE_SLUG,
            [self::class, 'render_settings_page']
        );
    }

    /**
     * Register settings with WordPress Settings API.
     */
    public static function register_settings() {
        register_setting(
            'wpsg_settings_group',
            self::OPTION_NAME,
            [
                'type'              => 'array',
                'sanitize_callback' => [self::class, 'sanitize_settings'],
                'default'           => self::$defaults,
            ]
        );

        // Authentication Section.
        add_settings_section(
            'wpsg_auth_section',
            __('Authentication', 'wp-super-gallery'),
            [self::class, 'render_auth_section'],
            self::PAGE_SLUG
        );

        add_settings_field(
            'auth_provider',
            __('Auth Provider', 'wp-super-gallery'),
            [self::class, 'render_auth_provider_field'],
            self::PAGE_SLUG,
            'wpsg_auth_section'
        );

        add_settings_field(
            'api_base',
            __('API Base URL', 'wp-super-gallery'),
            [self::class, 'render_api_base_field'],
            self::PAGE_SLUG,
            'wpsg_auth_section'
        );

        // Display Section.
        add_settings_section(
            'wpsg_display_section',
            __('Display Settings', 'wp-super-gallery'),
            [self::class, 'render_display_section'],
            self::PAGE_SLUG
        );

        add_settings_field(
            'theme',
            __('Theme', 'wp-super-gallery'),
            [self::class, 'render_theme_field'],
            self::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'allow_user_theme_override',
            __('Allow User Theme Override', 'wp-super-gallery'),
            [self::class, 'render_allow_user_theme_override_field'],
            self::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'gallery_layout',
            __('Default Layout', 'wp-super-gallery'),
            [self::class, 'render_layout_field'],
            self::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'items_per_page',
            __('Items Per Page', 'wp-super-gallery'),
            [self::class, 'render_items_per_page_field'],
            self::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'enable_lightbox',
            __('Enable Lightbox', 'wp-super-gallery'),
            [self::class, 'render_lightbox_field'],
            self::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'enable_animations',
            __('Enable Animations', 'wp-super-gallery'),
            [self::class, 'render_animations_field'],
            self::PAGE_SLUG,
            'wpsg_display_section'
        );

        // Performance Section.
        add_settings_section(
            'wpsg_performance_section',
            __('Performance', 'wp-super-gallery'),
            [self::class, 'render_performance_section'],
            self::PAGE_SLUG
        );

        add_settings_field(
            'cache_ttl',
            __('Cache Duration', 'wp-super-gallery'),
            [self::class, 'render_cache_ttl_field'],
            self::PAGE_SLUG,
            'wpsg_performance_section'
        );
    }

    /**
     * Google Font family names that may be loaded from the CDN.
     * Must stay in sync with GOOGLE_FONT_NAMES in TypographyEditor.tsx.
     */
    const GOOGLE_FONT_NAMES = [
        // Sans-serif
        'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
        'Oswald', 'Raleway', 'Nunito', 'Source Sans 3', 'PT Sans', 'Noto Sans',
        'Work Sans', 'Quicksand', 'Barlow', 'Cabin', 'DM Sans', 'Fira Sans',
        'Karla', 'Mulish', 'Rubik', 'Ubuntu', 'Josefin Sans', 'Manrope',
        'Plus Jakarta Sans', 'Outfit',
        // Serif
        'Playfair Display', 'Merriweather', 'Libre Baskerville', 'Crimson Text',
        'EB Garamond', 'Bitter', 'Cormorant Garamond', 'Lora', 'PT Serif',
        'Noto Serif',
        // Display / Handwriting
        'Dancing Script', 'Pacifico', 'Lobster', 'Caveat', 'Satisfy',
        // Monospace
        'Fira Code', 'JetBrains Mono', 'Source Code Pro',
    ];

    /**
     * Per-font axis specifications for Google Fonts CSS API v2.
     * Must stay in sync with GOOGLE_FONT_SPECS in loadGoogleFont.ts.
     *
     * null = no axes needed (regular 400 only, e.g. Pacifico).
     */
    const GOOGLE_FONT_SPECS = [
        // Sans-serif
        'Inter'             => 'ital,wght@0,100..900;1,100..900',
        'Roboto'            => 'ital,wght@0,100..900;1,100..900',
        'Open Sans'         => 'ital,wght@0,300..800;1,300..800',
        'Lato'              => 'ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900',
        'Montserrat'        => 'ital,wght@0,100..900;1,100..900',
        'Poppins'           => 'ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900',
        'Oswald'            => 'wght@200..700',
        'Raleway'           => 'ital,wght@0,100..900;1,100..900',
        'Nunito'            => 'ital,wght@0,200..1000;1,200..1000',
        'Source Sans 3'     => 'ital,wght@0,200..900;1,200..900',
        'PT Sans'           => 'ital,wght@0,400;0,700;1,400;1,700',
        'Noto Sans'         => 'ital,wght@0,100..900;1,100..900',
        'Work Sans'         => 'ital,wght@0,100..900;1,100..900',
        'Quicksand'         => 'wght@300..700',
        'Barlow'            => 'ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900',
        'Cabin'             => 'ital,wght@0,400..700;1,400..700',
        'DM Sans'           => 'ital,wght@0,100..1000;1,100..1000',
        'Fira Sans'         => 'ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900',
        'Karla'             => 'ital,wght@0,200..800;1,200..800',
        'Mulish'            => 'ital,wght@0,200..1000;1,200..1000',
        'Rubik'             => 'ital,wght@0,300..900;1,300..900',
        'Ubuntu'            => 'ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,500;1,700',
        'Josefin Sans'      => 'ital,wght@0,100..700;1,100..700',
        'Manrope'           => 'wght@200..800',
        'Plus Jakarta Sans' => 'ital,wght@0,200..800;1,200..800',
        'Outfit'            => 'wght@100..900',
        // Serif
        'Playfair Display'   => 'ital,wght@0,400..900;1,400..900',
        'Merriweather'       => 'ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900',
        'Libre Baskerville'  => 'ital,wght@0,400;0,700;1,400',
        'Crimson Text'       => 'ital,wght@0,400;0,600;0,700;1,400;1,600;1,700',
        'EB Garamond'        => 'ital,wght@0,400..800;1,400..800',
        'Bitter'             => 'ital,wght@0,100..900;1,100..900',
        'Cormorant Garamond' => 'ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
        'Lora'               => 'ital,wght@0,400..700;1,400..700',
        'PT Serif'           => 'ital,wght@0,400;0,700;1,400;1,700',
        'Noto Serif'         => 'ital,wght@0,100..900;1,100..900',
        // Display / Handwriting
        'Dancing Script' => 'wght@400..700',
        'Pacifico'       => null,
        'Lobster'        => null,
        'Caveat'         => 'wght@400..700',
        'Satisfy'        => null,
        // Monospace
        'Fira Code'      => 'wght@300..700',
        'JetBrains Mono' => 'ital,wght@0,100..800;1,100..800',
        'Source Code Pro' => 'ital,wght@0,200..900;1,200..900',
    ];

    /**
     * Extract Google Font family names from typography_overrides.
     *
     * @param array $settings Plugin settings array.
     * @return array Deduplicated Google Font family names.
     */
    public static function extract_google_font_families($settings) {
        $raw = isset($settings['typography_overrides']) ? $settings['typography_overrides'] : '{}';
        $overrides = is_string($raw) ? json_decode($raw, true) : (is_array($raw) ? $raw : []);
        if (!is_array($overrides)) {
            return [];
        }

        $families = [];
        $google_set = array_flip(self::GOOGLE_FONT_NAMES);

        foreach ($overrides as $entry) {
            if (!is_array($entry) || empty($entry['fontFamily'])) {
                continue;
            }
            // fontFamily is like "Roboto, sans-serif" — extract first name.
            $parts = explode(',', $entry['fontFamily']);
            $name = trim($parts[0], " \t\n\r\0\x0B\"'");
            if ($name !== '' && isset($google_set[$name])) {
                $families[$name] = true;
            }
        }

        return array_keys($families);
    }

    /**
     * Get all settings with defaults applied.
     *
     * @return array Settings array.
     */
    public static function get_settings() {
        $settings = get_option(self::OPTION_NAME, []);
        return wp_parse_args($settings, self::$defaults);
    }

    /**
     * Get a single setting value.
     *
     * @param string $key     Setting key.
     * @param mixed  $default Default value if not set.
     * @return mixed Setting value.
     */
    public static function get_setting($key, $default = null) {
        $settings = self::get_settings();
        if (isset($settings[$key])) {
            return $settings[$key];
        }
        return $default !== null ? $default : (self::$defaults[$key] ?? null);
    }

    // =========================================================================
    // DRY snake_case ↔ camelCase conversion (B-8)
    // =========================================================================

    /**
     * Convert a snake_case key to camelCase.
     *
     * @param string $key Snake-case key, e.g. 'video_viewport_height'.
     * @return string CamelCase key, e.g. 'videoViewportHeight'.
     */
    public static function snake_to_camel($key) {
        return lcfirst(str_replace('_', '', ucwords($key, '_')));
    }

    /**
     * Convert stored PHP settings to a camelCase JS-ready array.
     *
     * Uses $defaults as the registry: every key in $defaults is included.
     * Admin-only fields are omitted unless $admin is true.
     *
     * @param array $settings Settings array (snake_case keys).
     * @param bool  $admin    Whether to include admin-only fields.
     * @return array Associative array with camelCase keys.
     */
    public static function to_js($settings, $admin = false) {
        $result = [];
        foreach (self::$defaults as $snake => $default) {
            if (!$admin && in_array($snake, self::$admin_only_fields, true)) {
                continue;
            }
            $val = $settings[$snake] ?? $default;
            // Ensure gradient is always a JSON object, never an array.
            if ($snake === 'viewer_bg_gradient' && is_array($val) && empty($val)) {
                $val = (object) [];
            }
            $result[self::snake_to_camel($snake)] = $val;
        }
        return $result;
    }

    /**
     * Convert a camelCase JS request body to snake_case input for sanitization.
     *
     * Only includes keys that exist in both the request body and $defaults.
     *
     * @param array $body Decoded JSON body (camelCase keys).
     * @return array Associative array with snake_case keys.
     */
    public static function from_js($body) {
        $input = [];
        foreach (self::$defaults as $snake => $default) {
            $camel = self::snake_to_camel($snake);
            if (array_key_exists($camel, $body)) {
                $input[$snake] = $body[$camel];
            }
        }
        return $input;
    }

    /**
     * Get the defaults array (useful for React-side reference).
     *
     * @return array
     */
    public static function get_defaults() {
        return self::$defaults;
    }

    /**
     * Sanitize settings before saving.
     *
     * @param array $input Raw input array.
     * @return array Sanitized settings.
     */
    public static function sanitize_settings($input) {
        $sanitized = [];

        // Auth provider - must be valid option.
        if (isset($input['auth_provider'])) {
            $sanitized['auth_provider'] = in_array($input['auth_provider'], self::$valid_options['auth_provider'], true)
                ? $input['auth_provider']
                : self::$defaults['auth_provider'];
        }

        // API base - sanitize URL, empty means use home_url().
        if (isset($input['api_base'])) {
            $sanitized['api_base'] = esc_url_raw(trim($input['api_base']));
        }

        // Theme - must be valid option.
        if (isset($input['theme'])) {
            $sanitized['theme'] = in_array($input['theme'], self::$valid_options['theme'], true)
                ? $input['theme']
                : self::$defaults['theme'];
        }

        // Gallery layout - must be valid option.
        if (isset($input['gallery_layout'])) {
            $sanitized['gallery_layout'] = in_array($input['gallery_layout'], self::$valid_options['gallery_layout'], true)
                ? $input['gallery_layout']
                : self::$defaults['gallery_layout'];
        }

        // Items per page - integer between 1 and 100.
        if (isset($input['items_per_page'])) {
            $items = intval($input['items_per_page']);
            $sanitized['items_per_page'] = max(1, min(100, $items));
        }

        if (isset($input['video_viewport_height'])) {
            $height = intval($input['video_viewport_height']);
            $sanitized['video_viewport_height'] = max(180, min(900, $height));
        }

        if (isset($input['image_viewport_height'])) {
            $height = intval($input['image_viewport_height']);
            $sanitized['image_viewport_height'] = max(180, min(900, $height));
        }

        if (isset($input['gallery_manual_height'])) {
            $height = sanitize_text_field((string) $input['gallery_manual_height']);
            $height = trim($height);
            if (preg_match('/^\d+(?:\.\d+)?\s*(px|em|rem|vh|dvh|svh|lvh|vw|%)$/i', $height)) {
                $sanitized['gallery_manual_height'] = $height;
            } else {
                $sanitized['gallery_manual_height'] = self::$defaults['gallery_manual_height'];
            }
        }

        if (isset($input['thumbnail_scroll_speed'])) {
            $speed = floatval($input['thumbnail_scroll_speed']);
            $sanitized['thumbnail_scroll_speed'] = max(0.25, min(3, $speed));
        }

        if (isset($input['scroll_animation_style'])) {
            $sanitized['scroll_animation_style'] = in_array($input['scroll_animation_style'], self::$valid_options['scroll_animation_style'], true)
                ? $input['scroll_animation_style']
                : self::$defaults['scroll_animation_style'];
        }

        if (isset($input['scroll_animation_duration_ms'])) {
            $duration = intval($input['scroll_animation_duration_ms']);
            $sanitized['scroll_animation_duration_ms'] = max(0, min(2000, $duration));
        }

        if (isset($input['scroll_animation_easing'])) {
            $sanitized['scroll_animation_easing'] = in_array($input['scroll_animation_easing'], self::$valid_options['scroll_animation_easing'], true)
                ? $input['scroll_animation_easing']
                : self::$defaults['scroll_animation_easing'];
        }

        if (isset($input['scroll_transition_type'])) {
            $sanitized['scroll_transition_type'] = in_array($input['scroll_transition_type'], self::$valid_options['scroll_transition_type'], true)
                ? $input['scroll_transition_type']
                : self::$defaults['scroll_transition_type'];
        }

        if (isset($input['image_border_radius'])) {
            $radius = intval($input['image_border_radius']);
            $sanitized['image_border_radius'] = max(0, min(48, $radius));
        }

        if (isset($input['video_border_radius'])) {
            $radius = intval($input['video_border_radius']);
            $sanitized['video_border_radius'] = max(0, min(48, $radius));
        }

        if (isset($input['transition_fade_enabled'])) {
            $sanitized['transition_fade_enabled'] = (bool) $input['transition_fade_enabled'];
        }

        // P12-A/B: Advanced thumbnail strip
        if (isset($input['video_thumbnail_width'])) {
            $sanitized['video_thumbnail_width'] = max(30, min(200, intval($input['video_thumbnail_width'])));
        }
        if (isset($input['video_thumbnail_height'])) {
            $sanitized['video_thumbnail_height'] = max(30, min(200, intval($input['video_thumbnail_height'])));
        }
        if (isset($input['image_thumbnail_width'])) {
            $sanitized['image_thumbnail_width'] = max(30, min(200, intval($input['image_thumbnail_width'])));
        }
        if (isset($input['image_thumbnail_height'])) {
            $sanitized['image_thumbnail_height'] = max(30, min(200, intval($input['image_thumbnail_height'])));
        }
        if (isset($input['thumbnail_gap'])) {
            $sanitized['thumbnail_gap'] = max(0, min(24, intval($input['thumbnail_gap'])));
        }
        if (isset($input['thumbnail_wheel_scroll_enabled'])) {
            $sanitized['thumbnail_wheel_scroll_enabled'] = (bool) $input['thumbnail_wheel_scroll_enabled'];
        }
        if (isset($input['thumbnail_drag_scroll_enabled'])) {
            $sanitized['thumbnail_drag_scroll_enabled'] = (bool) $input['thumbnail_drag_scroll_enabled'];
        }
        if (isset($input['thumbnail_scroll_buttons_visible'])) {
            $sanitized['thumbnail_scroll_buttons_visible'] = (bool) $input['thumbnail_scroll_buttons_visible'];
        }

        // P12-H: Navigation Overlay Arrows
        if (isset($input['nav_arrow_position'])) {
            $sanitized['nav_arrow_position'] = in_array($input['nav_arrow_position'], self::$valid_options['nav_arrow_position'], true)
                ? $input['nav_arrow_position']
                : self::$defaults['nav_arrow_position'];
        }
        if (isset($input['nav_arrow_size'])) {
            $sanitized['nav_arrow_size'] = max(20, min(64, intval($input['nav_arrow_size'])));
        }
        if (isset($input['nav_arrow_color'])) {
            $sanitized['nav_arrow_color'] = sanitize_text_field($input['nav_arrow_color']);
        }
        if (isset($input['nav_arrow_bg_color'])) {
            $sanitized['nav_arrow_bg_color'] = sanitize_text_field($input['nav_arrow_bg_color']);
        }
        if (isset($input['nav_arrow_border_width'])) {
            $sanitized['nav_arrow_border_width'] = max(0, min(6, intval($input['nav_arrow_border_width'])));
        }
        if (isset($input['nav_arrow_hover_scale'])) {
            $sanitized['nav_arrow_hover_scale'] = max(1.0, min(1.5, floatval($input['nav_arrow_hover_scale'])));
        }
        if (isset($input['nav_arrow_auto_hide_ms'])) {
            $sanitized['nav_arrow_auto_hide_ms'] = max(0, min(10000, intval($input['nav_arrow_auto_hide_ms'])));
        }

        // P12-I: Dot Navigator
        if (isset($input['dot_nav_enabled'])) {
            $sanitized['dot_nav_enabled'] = (bool) $input['dot_nav_enabled'];
        }
        if (isset($input['dot_nav_position'])) {
            $sanitized['dot_nav_position'] = in_array($input['dot_nav_position'], self::$valid_options['dot_nav_position'], true)
                ? $input['dot_nav_position']
                : self::$defaults['dot_nav_position'];
        }
        if (isset($input['dot_nav_size'])) {
            $sanitized['dot_nav_size'] = max(4, min(24, intval($input['dot_nav_size'])));
        }
        if (isset($input['dot_nav_active_color'])) {
            $sanitized['dot_nav_active_color'] = sanitize_text_field($input['dot_nav_active_color']);
        }
        if (isset($input['dot_nav_inactive_color'])) {
            $sanitized['dot_nav_inactive_color'] = sanitize_text_field($input['dot_nav_inactive_color']);
        }
        if (isset($input['dot_nav_shape'])) {
            $sanitized['dot_nav_shape'] = in_array($input['dot_nav_shape'], self::$valid_options['dot_nav_shape'], true)
                ? $input['dot_nav_shape']
                : self::$defaults['dot_nav_shape'];
        }
        if (isset($input['dot_nav_spacing'])) {
            $sanitized['dot_nav_spacing'] = max(2, min(20, intval($input['dot_nav_spacing'])));
        }
        if (isset($input['dot_nav_active_scale'])) {
            $sanitized['dot_nav_active_scale'] = max(1.0, min(2.0, floatval($input['dot_nav_active_scale'])));
        }

        // P12-J: Shadow & Depth
        if (isset($input['image_shadow_preset'])) {
            $sanitized['image_shadow_preset'] = in_array($input['image_shadow_preset'], self::$valid_options['image_shadow_preset'], true)
                ? $input['image_shadow_preset']
                : self::$defaults['image_shadow_preset'];
        }
        if (isset($input['video_shadow_preset'])) {
            $sanitized['video_shadow_preset'] = in_array($input['video_shadow_preset'], self::$valid_options['video_shadow_preset'], true)
                ? $input['video_shadow_preset']
                : self::$defaults['video_shadow_preset'];
        }
        if (isset($input['image_shadow_custom'])) {
            $sanitized['image_shadow_custom'] = sanitize_text_field($input['image_shadow_custom']);
        }
        if (isset($input['video_shadow_custom'])) {
            $sanitized['video_shadow_custom'] = sanitize_text_field($input['video_shadow_custom']);
        }

        // P12-C: Gallery Adapters
        $valid_adapters = class_exists('WPSG_CPT') ? WPSG_CPT::VALID_ADAPTERS
            : ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond', 'layout-builder'];
        if (isset($input['image_gallery_adapter_id'])) {
            $sanitized['image_gallery_adapter_id'] = in_array($input['image_gallery_adapter_id'], $valid_adapters, true)
                ? $input['image_gallery_adapter_id']
                : 'classic';
        }
        if (isset($input['video_gallery_adapter_id'])) {
            $sanitized['video_gallery_adapter_id'] = in_array($input['video_gallery_adapter_id'], $valid_adapters, true)
                ? $input['video_gallery_adapter_id']
                : 'classic';
        }
        if (isset($input['unified_gallery_enabled'])) {
            $sanitized['unified_gallery_enabled'] = (bool) $input['unified_gallery_enabled'];
        }
        if (isset($input['unified_gallery_adapter_id'])) {
            $sanitized['unified_gallery_adapter_id'] = in_array($input['unified_gallery_adapter_id'], $valid_adapters, true)
                ? $input['unified_gallery_adapter_id']
                : 'compact-grid';
        }
        // P15-A: Per-breakpoint gallery selection
        if (isset($input['gallery_selection_mode'])) {
            $sanitized['gallery_selection_mode'] = in_array($input['gallery_selection_mode'], ['unified', 'per-breakpoint'], true)
                ? $input['gallery_selection_mode']
                : 'unified';
        }
        $bp_adapter_fields = [
            'desktop_image_adapter_id', 'desktop_video_adapter_id',
            'tablet_image_adapter_id',  'tablet_video_adapter_id',
            'mobile_image_adapter_id',  'mobile_video_adapter_id',
        ];
        $valid_bp_adapters = $valid_adapters;
        foreach ($bp_adapter_fields as $field) {
            if (isset($input[$field])) {
                $sanitized[$field] = in_array($input[$field], $valid_bp_adapters, true)
                    ? $input[$field]
                    : 'classic';
            }
        }
        if (isset($input['layout_builder_scope'])) {
            $sanitized['layout_builder_scope'] = in_array($input['layout_builder_scope'], ['full', 'viewport'], true)
                ? $input['layout_builder_scope']
                : 'full';
        }
        if (isset($input['mosaic_target_row_height'])) {
            $sanitized['mosaic_target_row_height'] = max(60, min(600, intval($input['mosaic_target_row_height'])));
        }
        if (isset($input['grid_card_width'])) {
            $sanitized['grid_card_width'] = max(80, min(400, intval($input['grid_card_width'])));
        }
        if (isset($input['grid_card_height'])) {
            $sanitized['grid_card_height'] = max(80, min(600, intval($input['grid_card_height'])));
        }
        // Tile appearance settings
        if (isset($input['tile_size'])) {
            $sanitized['tile_size'] = max(60, min(400, intval($input['tile_size'])));
        }
        if (isset($input['tile_gap_x'])) {
            $sanitized['tile_gap_x'] = max(0, min(60, intval($input['tile_gap_x'])));
        }
        if (isset($input['tile_gap_y'])) {
            $sanitized['tile_gap_y'] = max(0, min(60, intval($input['tile_gap_y'])));
        }
        if (isset($input['tile_border_width'])) {
            $sanitized['tile_border_width'] = max(0, min(20, intval($input['tile_border_width'])));
        }
        if (isset($input['tile_border_color'])) {
            $sanitized['tile_border_color'] = sanitize_hex_color($input['tile_border_color']) ?: '#ffffff';
        }
        if (isset($input['tile_glow_enabled'])) {
            $sanitized['tile_glow_enabled'] = (bool) $input['tile_glow_enabled'];
        }
        if (isset($input['tile_glow_color'])) {
            $sanitized['tile_glow_color'] = sanitize_hex_color($input['tile_glow_color']) ?: '#7c9ef8';
        }
        if (isset($input['tile_glow_spread'])) {
            $sanitized['tile_glow_spread'] = max(2, min(60, intval($input['tile_glow_spread'])));
        }
        if (isset($input['tile_hover_bounce'])) {
            $sanitized['tile_hover_bounce'] = (bool) $input['tile_hover_bounce'];
        }
        if (isset($input['masonry_columns'])) {
            $sanitized['masonry_columns'] = max(0, min(8, intval($input['masonry_columns'])));
        }

        // Viewport backgrounds.
        $allowed_bg_types = ['none', 'solid', 'gradient', 'image'];
        if (isset($input['image_bg_type'])) { $sanitized['image_bg_type'] = in_array($input['image_bg_type'], $allowed_bg_types, true) ? $input['image_bg_type'] : 'none'; }
        if (isset($input['image_bg_color'])) { $sanitized['image_bg_color'] = sanitize_text_field($input['image_bg_color']); }
        if (isset($input['image_bg_gradient'])) { $sanitized['image_bg_gradient'] = sanitize_text_field($input['image_bg_gradient']); }
        if (isset($input['image_bg_image_url'])) { $sanitized['image_bg_image_url'] = esc_url_raw($input['image_bg_image_url']); }
        if (isset($input['video_bg_type'])) { $sanitized['video_bg_type'] = in_array($input['video_bg_type'], $allowed_bg_types, true) ? $input['video_bg_type'] : 'none'; }
        if (isset($input['video_bg_color'])) { $sanitized['video_bg_color'] = sanitize_text_field($input['video_bg_color']); }
        if (isset($input['video_bg_gradient'])) { $sanitized['video_bg_gradient'] = sanitize_text_field($input['video_bg_gradient']); }
        if (isset($input['video_bg_image_url'])) { $sanitized['video_bg_image_url'] = esc_url_raw($input['video_bg_image_url']); }
        if (isset($input['unified_bg_type'])) { $sanitized['unified_bg_type'] = in_array($input['unified_bg_type'], $allowed_bg_types, true) ? $input['unified_bg_type'] : 'none'; }
        if (isset($input['unified_bg_color'])) { $sanitized['unified_bg_color'] = sanitize_text_field($input['unified_bg_color']); }
        if (isset($input['unified_bg_gradient'])) { $sanitized['unified_bg_gradient'] = sanitize_text_field($input['unified_bg_gradient']); }
        if (isset($input['unified_bg_image_url'])) { $sanitized['unified_bg_image_url'] = esc_url_raw($input['unified_bg_image_url']); }

        // P13-A: Campaign Card settings.
        if (isset($input['card_border_radius'])) {
            $sanitized['card_border_radius'] = max(0, min(24, intval($input['card_border_radius'])));
        }
        if (isset($input['card_border_width'])) {
            $sanitized['card_border_width'] = max(0, min(8, intval($input['card_border_width'])));
        }
        if (isset($input['card_border_mode']) && in_array($input['card_border_mode'], self::$valid_options['card_border_mode'], true)) {
            $sanitized['card_border_mode'] = $input['card_border_mode'];
        }
        if (isset($input['card_border_color'])) {
            $sanitized['card_border_color'] = sanitize_hex_color($input['card_border_color']) ?: '#228be6';
        }
        if (isset($input['card_shadow_preset']) && in_array($input['card_shadow_preset'], self::$valid_options['card_shadow_preset'], true)) {
            $sanitized['card_shadow_preset'] = $input['card_shadow_preset'];
        }
        if (isset($input['card_thumbnail_height'])) {
            $sanitized['card_thumbnail_height'] = max(100, min(400, intval($input['card_thumbnail_height'])));
        }
        if (isset($input['card_thumbnail_fit']) && in_array($input['card_thumbnail_fit'], self::$valid_options['card_thumbnail_fit'], true)) {
            $sanitized['card_thumbnail_fit'] = $input['card_thumbnail_fit'];
        }
        if (isset($input['card_grid_columns'])) {
            $sanitized['card_grid_columns'] = max(0, min(6, intval($input['card_grid_columns'])));
        }
        if (isset($input['card_gap_h'])) {
            $sanitized['card_gap_h'] = max(0, min(48, intval($input['card_gap_h'])));
        }
        if (isset($input['card_gap_v'])) {
            $sanitized['card_gap_v'] = max(0, min(48, intval($input['card_gap_v'])));
        }
        if (isset($input['modal_cover_height'])) {
            $sanitized['modal_cover_height'] = max(100, min(400, intval($input['modal_cover_height'])));
        }
        if (isset($input['modal_transition']) && in_array($input['modal_transition'], self::$valid_options['modal_transition'], true)) {
            $sanitized['modal_transition'] = $input['modal_transition'];
        }
        if (isset($input['modal_transition_duration'])) {
            $sanitized['modal_transition_duration'] = max(100, min(1000, intval($input['modal_transition_duration'])));
        }
        if (isset($input['modal_max_height'])) {
            $sanitized['modal_max_height'] = max(50, min(100, intval($input['modal_max_height'])));
        }

        // P13-F: Card Gallery Pagination.
        if (isset($input['card_display_mode']) && in_array($input['card_display_mode'], self::$valid_options['card_display_mode'], true)) {
            $sanitized['card_display_mode'] = $input['card_display_mode'];
        }
        if (isset($input['card_rows_per_page'])) {
            $sanitized['card_rows_per_page'] = max(1, min(10, intval($input['card_rows_per_page'])));
        }
        if (isset($input['card_page_dot_nav'])) {
            $sanitized['card_page_dot_nav'] = (bool) $input['card_page_dot_nav'];
        }
        if (isset($input['card_page_transition_ms'])) {
            $sanitized['card_page_transition_ms'] = max(100, min(800, intval($input['card_page_transition_ms'])));
        }

        // P13-E: Header visibility toggles.
        if (isset($input['show_gallery_title'])) {
            $sanitized['show_gallery_title'] = (bool) $input['show_gallery_title'];
        }
        if (isset($input['show_gallery_subtitle'])) {
            $sanitized['show_gallery_subtitle'] = (bool) $input['show_gallery_subtitle'];
        }
        if (isset($input['show_access_mode'])) {
            $sanitized['show_access_mode'] = (bool) $input['show_access_mode'];
        }
        if (isset($input['show_filter_tabs'])) {
            $sanitized['show_filter_tabs'] = (bool) $input['show_filter_tabs'];
        }
        if (isset($input['show_search_box'])) {
            $sanitized['show_search_box'] = (bool) $input['show_search_box'];
        }

        // P13-E: App width, padding & per-gallery tile sizes.
        if (isset($input['app_max_width'])) {
            $sanitized['app_max_width'] = max(0, min(3000, intval($input['app_max_width'])));
        }
        if (isset($input['app_padding'])) {
            $sanitized['app_padding'] = max(0, min(100, intval($input['app_padding'])));
        }
        if (isset($input['wp_full_bleed_desktop'])) {
            $sanitized['wp_full_bleed_desktop'] = (bool) $input['wp_full_bleed_desktop'];
        }
        if (isset($input['wp_full_bleed_tablet'])) {
            $sanitized['wp_full_bleed_tablet'] = (bool) $input['wp_full_bleed_tablet'];
        }
        if (isset($input['wp_full_bleed_mobile'])) {
            $sanitized['wp_full_bleed_mobile'] = (bool) $input['wp_full_bleed_mobile'];
        }
        if (isset($input['image_tile_size'])) {
            $sanitized['image_tile_size'] = max(60, min(400, intval($input['image_tile_size'])));
        }
        if (isset($input['video_tile_size'])) {
            $sanitized['video_tile_size'] = max(60, min(400, intval($input['video_tile_size'])));
        }

        // Boolean fields. Only set when explicitly provided in $input so that
        // callers that merge $sanitized into existing settings (e.g. REST
        // partial updates) do not inadvertently overwrite existing values.
        if (isset($input['enable_lightbox'])) {
            $sanitized['enable_lightbox'] = (bool) $input['enable_lightbox'];
        }
        if (isset($input['enable_animations'])) {
            $sanitized['enable_animations'] = (bool) $input['enable_animations'];
        }
        if (isset($input['allow_user_theme_override'])) {
            $sanitized['allow_user_theme_override'] = (bool) $input['allow_user_theme_override'];
        }

        // Cache TTL - integer, 0 means disabled, max 1 week.
        if (isset($input['cache_ttl'])) {
            $ttl = intval($input['cache_ttl']);
            $sanitized['cache_ttl'] = max(0, min(604800, $ttl));
        }

        // P21-I: Typography overrides — JSON object with per-element typography.
        if (isset($input['typography_overrides'])) {
            $raw = $input['typography_overrides'];
            $decoded = is_string($raw) ? json_decode($raw, true) : (is_array($raw) ? $raw : null);
            if (!is_array($decoded)) {
                $decoded = [];
            }
            $allowed_props = [
                'fontFamily', 'fontFallback1', 'fontFallback2',
                'fontSize', 'fontWeight', 'fontStyle',
                'textTransform', 'textDecoration', 'lineHeight',
                'letterSpacing', 'wordSpacing', 'color',
                'textStrokeWidth', 'textStrokeColor',
                'textShadowOffsetX', 'textShadowOffsetY', 'textShadowBlur', 'textShadowColor',
                'textGlowColor', 'textGlowBlur',
            ];
            $allowed_elements = [
                'viewerTitle', 'viewerSubtitle',
                'cardTitle', 'cardDescription', 'cardCompanyName', 'cardMediaCounts',
                'campaignTitle', 'campaignDescription', 'campaignDate',
                'campaignAboutHeading', 'campaignStatsValue', 'campaignStatsLabel',
                'galleryLabel', 'mediaCaption', 'authBarText', 'accessBadgeText',
            ];
            $clean = [];
            foreach ($decoded as $element_id => $overrides) {
                if (!is_string($element_id) || !is_array($overrides)) {
                    continue;
                }
                if (!in_array($element_id, $allowed_elements, true)) {
                    continue;
                }
                $element_clean = [];
                foreach ($overrides as $prop => $val) {
                    if (!in_array($prop, $allowed_props, true)) {
                        continue;
                    }
                    if ($prop === 'fontWeight') {
                        $val = max(100, min(900, intval($val)));
                    } elseif ($prop === 'lineHeight') {
                        $val = max(0.5, min(5.0, floatval($val)));
                    } else {
                        $val = sanitize_text_field((string) $val);
                    }
                    $element_clean[$prop] = $val;
                }
                if (!empty($element_clean)) {
                    $clean[$element_id] = $element_clean;
                }
            }
            $sanitized['typography_overrides'] = wp_json_encode($clean);
        }

        // P21-K: Viewer background gradient — structured JSON object.
        if (isset($input['viewer_bg_gradient'])) {
            $raw = $input['viewer_bg_gradient'];
            $decoded = is_string($raw) ? json_decode($raw, true) : (is_array($raw) ? $raw : null);
            if (!is_array($decoded)) {
                $decoded = [];
            }
            $clean_grad = [];
            $allowed_types = ['linear', 'radial', 'conic'];
            $allowed_dirs  = ['horizontal', 'vertical', 'diagonal-right', 'diagonal-left'];
            $allowed_shapes = ['circle', 'ellipse'];
            $allowed_sizes  = ['farthest-corner', 'farthest-side', 'closest-corner', 'closest-side'];
            if (isset($decoded['type']) && in_array($decoded['type'], $allowed_types, true)) {
                $clean_grad['type'] = $decoded['type'];
            }
            if (isset($decoded['direction']) && in_array($decoded['direction'], $allowed_dirs, true)) {
                $clean_grad['direction'] = $decoded['direction'];
            }
            if (isset($decoded['angle'])) {
                $clean_grad['angle'] = max(0, min(360, intval($decoded['angle'])));
            }
            if (isset($decoded['radialShape']) && in_array($decoded['radialShape'], $allowed_shapes, true)) {
                $clean_grad['radialShape'] = $decoded['radialShape'];
            }
            if (isset($decoded['radialSize']) && in_array($decoded['radialSize'], $allowed_sizes, true)) {
                $clean_grad['radialSize'] = $decoded['radialSize'];
            }
            if (isset($decoded['centerX'])) {
                $clean_grad['centerX'] = max(0, min(100, intval($decoded['centerX'])));
            }
            if (isset($decoded['centerY'])) {
                $clean_grad['centerY'] = max(0, min(100, intval($decoded['centerY'])));
            }
            if (isset($decoded['stops']) && is_array($decoded['stops'])) {
                $clean_stops = [];
                foreach (array_slice($decoded['stops'], 0, 3) as $stop) {
                    if (!is_array($stop)) {
                        continue;
                    }
                    $clean_stop = [];
                    if (isset($stop['color'])) {
                        $clean_stop['color'] = sanitize_text_field((string) $stop['color']);
                    }
                    if (isset($stop['position'])) {
                        $clean_stop['position'] = max(0, min(100, intval($stop['position'])));
                    }
                    if (!empty($clean_stop)) {
                        $clean_stops[] = $clean_stop;
                    }
                }
                if (!empty($clean_stops)) {
                    $clean_grad['stops'] = $clean_stops;
                }
            }
            $sanitized['viewer_bg_gradient'] = empty($clean_grad) ? (object) [] : $clean_grad;
        }

        // ── Generic fallback for P14+ settings not explicitly handled above ──
        // Infers sanitization from the default value's PHP type and applies
        // range clamping from $field_ranges when available.  Select fields
        // are validated against $valid_options.
        foreach ($input as $key => $value) {
            if (isset($sanitized[$key])) {
                continue; // Already handled by explicit rule above.
            }
            if (!array_key_exists($key, self::$defaults)) {
                continue; // Unknown setting — skip.
            }

            // Select / enum validation.
            if (isset(self::$valid_options[$key])) {
                $sanitized[$key] = in_array($value, self::$valid_options[$key], true)
                    ? $value
                    : self::$defaults[$key];
                continue;
            }

            $default = self::$defaults[$key];

            if (is_bool($default)) {
                $sanitized[$key] = (bool) $value;
            } elseif (is_int($default)) {
                $val = intval($value);
                if (isset(self::$field_ranges[$key])) {
                    $val = max((int) self::$field_ranges[$key][0], min((int) self::$field_ranges[$key][1], $val));
                }
                $sanitized[$key] = $val;
            } elseif (is_float($default)) {
                $val = floatval($value);
                if (isset(self::$field_ranges[$key])) {
                    $val = max((float) self::$field_ranges[$key][0], min((float) self::$field_ranges[$key][1], $val));
                }
                $sanitized[$key] = $val;
            } else {
                // String — sanitize_text_field for most; esc_url_raw for URLs.
                if (str_ends_with($key, '_url') || str_ends_with($key, '_image_url')) {
                    $sanitized[$key] = esc_url_raw((string) $value);
                } else {
                    $sanitized[$key] = sanitize_text_field((string) $value);
                }
            }
        }

        return $sanitized;
    }

    /**
     * Filter: Provide auth_provider setting value.
     *
     * @param string $default Default value.
     * @return string Auth provider.
     */
    public static function filter_auth_provider($default) {
        return self::get_setting('auth_provider', $default);
    }

    /**
     * Filter: Provide api_base setting value.
     *
     * @param string $default Default value.
     * @return string API base URL.
     */
    public static function filter_api_base($default) {
        $api_base = self::get_setting('api_base', '');
        return !empty($api_base) ? $api_base : $default;
    }

    // =========================================================================
    // Section Renderers
    // =========================================================================

    /**
     * Render authentication section description.
     */
    public static function render_auth_section() {
        echo '<p>' . esc_html__('Configure how the gallery authenticates with the WordPress REST API.', 'wp-super-gallery') . '</p>';
    }

    /**
     * Render display section description.
     */
    public static function render_display_section() {
        echo '<p>' . esc_html__('Configure default display settings for galleries.', 'wp-super-gallery') . '</p>';
    }

    /**
     * Render performance section description.
     */
    public static function render_performance_section() {
        echo '<p>' . esc_html__('Configure caching and performance settings.', 'wp-super-gallery') . '</p>';
    }

    // =========================================================================
    // Field Renderers
    // =========================================================================

    /**
     * Render auth provider select field.
     */
    public static function render_auth_provider_field() {
        $value = self::get_setting('auth_provider');
        $options = [
            'wp-jwt' => __('WordPress JWT (Recommended)', 'wp-super-gallery'),
            'none'   => __('None (Public Access Only)', 'wp-super-gallery'),
        ];
        ?>
        <select name="<?php echo esc_attr(self::OPTION_NAME); ?>[auth_provider]" id="wpsg_auth_provider">
            <?php foreach ($options as $key => $label) : ?>
                <option value="<?php echo esc_attr($key); ?>" <?php selected($value, $key); ?>>
                    <?php echo esc_html($label); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <p class="description">
            <?php esc_html_e('Select the authentication method for REST API access.', 'wp-super-gallery'); ?>
        </p>
        <p style="margin-top: 10px;">
            <button type="button" class="button" id="wpsg-test-auth">
                <?php esc_html_e('Test Connection', 'wp-super-gallery'); ?>
            </button>
            <span id="wpsg-test-auth-result" style="margin-left: 10px;"></span>
        </p>
        <?php
    }

    /**
     * Render API base URL field.
     */
    public static function render_api_base_field() {
        $value = self::get_setting('api_base');
        ?>
        <input type="url"
               name="<?php echo esc_attr(self::OPTION_NAME); ?>[api_base]"
               id="wpsg_api_base"
               value="<?php echo esc_attr($value); ?>"
               class="regular-text"
               placeholder="<?php echo esc_attr(home_url()); ?>">
        <p class="description">
            <?php esc_html_e('Leave empty to use the current site URL. Only change this for multi-site or headless setups.', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render theme select field with all available themes.
     */
    public static function render_theme_field() {
        $value = self::get_setting('theme');
        $theme_groups = [
            __('Default', 'wp-super-gallery') => [
                'default-dark'    => __('Default Dark', 'wp-super-gallery'),
                'default-light'   => __('Default Light', 'wp-super-gallery'),
            ],
            __('Material', 'wp-super-gallery') => [
                'material-dark'   => __('Material Dark', 'wp-super-gallery'),
                'material-light'  => __('Material Light', 'wp-super-gallery'),
            ],
            __('Classic', 'wp-super-gallery') => [
                'darcula'         => __('Darcula', 'wp-super-gallery'),
                'nord'            => __('Nord', 'wp-super-gallery'),
            ],
            __('Solarized', 'wp-super-gallery') => [
                'solarized-dark'  => __('Solarized Dark', 'wp-super-gallery'),
                'solarized-light' => __('Solarized Light', 'wp-super-gallery'),
            ],
            __('Accessibility', 'wp-super-gallery') => [
                'high-contrast'   => __('High Contrast (WCAG AAA)', 'wp-super-gallery'),
            ],
            __('Community', 'wp-super-gallery') => [
                'catppuccin-mocha' => __('Catppuccin Mocha', 'wp-super-gallery'),
                'tokyo-night'      => __('Tokyo Night', 'wp-super-gallery'),
                'gruvbox-dark'     => __('Gruvbox Dark', 'wp-super-gallery'),
            ],
            __('Neon', 'wp-super-gallery') => [
                'cyberpunk'        => __('Cyberpunk', 'wp-super-gallery'),
                'synthwave'        => __('Synthwave \u002784', 'wp-super-gallery'),
            ],
        ];
        ?>
        <select name="<?php echo esc_attr(self::OPTION_NAME); ?>[theme]" id="wpsg_theme">
            <?php foreach ($theme_groups as $group_label => $options) : ?>
                <optgroup label="<?php echo esc_attr($group_label); ?>">
                    <?php foreach ($options as $key => $label) : ?>
                        <option value="<?php echo esc_attr($key); ?>" <?php selected($value, $key); ?>>
                            <?php echo esc_html($label); ?>
                        </option>
                    <?php endforeach; ?>
                </optgroup>
            <?php endforeach; ?>
        </select>
        <p class="description">
            <?php esc_html_e('Default color theme for gallery display. Users can override this if allowed below.', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render allow user theme override checkbox.
     */
    public static function render_allow_user_theme_override_field() {
        $value = self::get_setting('allow_user_theme_override');
        ?>
        <label>
            <input type="checkbox"
                   name="<?php echo esc_attr(self::OPTION_NAME); ?>[allow_user_theme_override]"
                   id="wpsg_allow_user_theme_override"
                   value="1"
                   <?php checked($value, true); ?>>
            <?php esc_html_e('Allow visitors to switch themes via the gallery UI.', 'wp-super-gallery'); ?>
        </label>
        <p class="description">
            <?php esc_html_e('When disabled, the gallery will always use the theme selected above and hide the theme picker from visitors.', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render gallery layout select field.
     */
    public static function render_layout_field() {
        $value = self::get_setting('gallery_layout');
        $options = [
            'grid'     => __('Grid', 'wp-super-gallery'),
            'masonry'  => __('Masonry', 'wp-super-gallery'),
            'carousel' => __('Carousel', 'wp-super-gallery'),
        ];
        ?>
        <select name="<?php echo esc_attr(self::OPTION_NAME); ?>[gallery_layout]" id="wpsg_gallery_layout">
            <?php foreach ($options as $key => $label) : ?>
                <option value="<?php echo esc_attr($key); ?>" <?php selected($value, $key); ?>>
                    <?php echo esc_html($label); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <p class="description">
            <?php esc_html_e('Default layout for displaying gallery items.', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render items per page number field.
     */
    public static function render_items_per_page_field() {
        $value = self::get_setting('items_per_page');
        ?>
        <input type="number"
               name="<?php echo esc_attr(self::OPTION_NAME); ?>[items_per_page]"
               id="wpsg_items_per_page"
               value="<?php echo esc_attr($value); ?>"
               min="1"
               max="100"
               step="1"
               class="small-text">
        <p class="description">
            <?php esc_html_e('Number of items to display per page (1-100).', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render enable lightbox checkbox.
     */
    public static function render_lightbox_field() {
        $value = self::get_setting('enable_lightbox');
        ?>
        <label>
            <input type="checkbox"
                   name="<?php echo esc_attr(self::OPTION_NAME); ?>[enable_lightbox]"
                   id="wpsg_enable_lightbox"
                   value="1"
                   <?php checked($value, true); ?>>
            <?php esc_html_e('Enable fullscreen lightbox when clicking gallery items.', 'wp-super-gallery'); ?>
        </label>
        <?php
    }

    /**
     * Render enable animations checkbox.
     */
    public static function render_animations_field() {
        $value = self::get_setting('enable_animations');
        ?>
        <label>
            <input type="checkbox"
                   name="<?php echo esc_attr(self::OPTION_NAME); ?>[enable_animations]"
                   id="wpsg_enable_animations"
                   value="1"
                   <?php checked($value, true); ?>>
            <?php esc_html_e('Enable smooth animations and transitions.', 'wp-super-gallery'); ?>
        </label>
        <p class="description">
            <?php esc_html_e('Disable for better performance on low-end devices.', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render cache TTL number field.
     */
    public static function render_cache_ttl_field() {
        $value = self::get_setting('cache_ttl');
        $options = [
            0      => __('Disabled', 'wp-super-gallery'),
            10     => __('10 seconds', 'wp-super-gallery'),
            30     => __('30 seconds', 'wp-super-gallery'),
            60     => __('1 minute', 'wp-super-gallery'),
            300    => __('5 minutes', 'wp-super-gallery'),
            900    => __('15 minutes', 'wp-super-gallery'),
            1200   => __('20 minutes', 'wp-super-gallery'),
            1800   => __('30 minutes', 'wp-super-gallery'),
            2700   => __('45 minutes', 'wp-super-gallery'),
            3600   => __('1 hour', 'wp-super-gallery'),
            7200   => __('2 hours', 'wp-super-gallery'),
            14400  => __('4 hours', 'wp-super-gallery'),
            28800  => __('8 hours', 'wp-super-gallery'),
            43200  => __('12 hours', 'wp-super-gallery'),
            86400  => __('1 day', 'wp-super-gallery'),
            259200 => __('3 days', 'wp-super-gallery'),
            604800 => __('1 week', 'wp-super-gallery'),
        ];
        ?>
        <select name="<?php echo esc_attr(self::OPTION_NAME); ?>[cache_ttl]" id="wpsg_cache_ttl">
            <?php foreach ($options as $seconds => $label) : ?>
                <option value="<?php echo esc_attr($seconds); ?>" <?php selected($value, $seconds); ?>>
                    <?php echo esc_html($label); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <p class="description">
            <?php esc_html_e('How long to cache API responses. Higher values improve performance but show stale data.', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    // =========================================================================
    // Settings Page
    // =========================================================================

    /**
     * Render the settings page.
     */
    public static function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        // Check for settings saved message.
        if (isset($_GET['settings-updated'])) {
            add_settings_error(
                'wpsg_messages',
                'wpsg_message',
                __('Settings Saved', 'wp-super-gallery'),
                'updated'
            );
        }
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

            <?php settings_errors('wpsg_messages'); ?>

            <form action="options.php" method="post">
                <?php
                settings_fields('wpsg_settings_group');
                do_settings_sections(self::PAGE_SLUG);
                submit_button(__('Save Settings', 'wp-super-gallery'));
                ?>
            </form>

            <hr>

            <h2><?php esc_html_e('Shortcode Usage', 'wp-super-gallery'); ?></h2>
            <p><?php esc_html_e('Embed a gallery using the following shortcode:', 'wp-super-gallery'); ?></p>
            <code>[super-gallery campaign="your-campaign-slug"]</code>

            <h3><?php esc_html_e('Shortcode Attributes', 'wp-super-gallery'); ?></h3>
            <table class="widefat" style="max-width: 600px;">
                <thead>
                    <tr>
                        <th><?php esc_html_e('Attribute', 'wp-super-gallery'); ?></th>
                        <th><?php esc_html_e('Description', 'wp-super-gallery'); ?></th>
                        <th><?php esc_html_e('Default', 'wp-super-gallery'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><code>campaign</code></td>
                        <td><?php esc_html_e('Campaign slug or ID to display', 'wp-super-gallery'); ?></td>
                        <td>—</td>
                    </tr>
                    <tr>
                        <td><code>company</code></td>
                        <td><?php esc_html_e('Filter by company slug', 'wp-super-gallery'); ?></td>
                        <td>—</td>
                    </tr>
                    <tr>
                        <td><code>compact</code></td>
                        <td><?php esc_html_e('Use compact display mode', 'wp-super-gallery'); ?></td>
                        <td>false</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <script>
        (function() {
            var testBtn = document.getElementById('wpsg-test-auth');
            var resultSpan = document.getElementById('wpsg-test-auth-result');

            if (testBtn) {
                testBtn.addEventListener('click', function() {
                    testBtn.disabled = true;
                    resultSpan.textContent = '<?php echo esc_js(__('Testing...', 'wp-super-gallery')); ?>';
                    resultSpan.style.color = '';

                    fetch(ajaxurl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                            action: 'wpsg_test_auth',
                            _ajax_nonce: '<?php echo wp_create_nonce('wpsg_test_auth'); ?>'
                        })
                    })
                    .then(function(response) { return response.json(); })
                    .then(function(data) {
                        testBtn.disabled = false;
                        if (data.success) {
                            resultSpan.textContent = '✓ ' + data.data.message;
                            resultSpan.style.color = 'green';
                        } else {
                            resultSpan.textContent = '✗ ' + (data.data.message || 'Connection failed');
                            resultSpan.style.color = 'red';
                        }
                    })
                    .catch(function(err) {
                        testBtn.disabled = false;
                        resultSpan.textContent = '✗ Request failed';
                        resultSpan.style.color = 'red';
                    });
                });
            }
        })();
        </script>
        <?php
    }

    /**
     * AJAX handler for testing authentication.
     */
    public static function ajax_test_auth() {
        check_ajax_referer('wpsg_test_auth');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Permission denied.', 'wp-super-gallery')]);
        }

        $settings = self::get_settings();
        $api_base = !empty($settings['api_base']) ? $settings['api_base'] : home_url();
        $test_url = trailingslashit($api_base) . 'wp-json/wp-super-gallery/v1/campaigns';

        $response = wp_remote_get($test_url, [
            'timeout'   => 10,
            'sslverify' => apply_filters('https_local_ssl_verify', false),
        ]);

        if (is_wp_error($response)) {
            wp_send_json_error([
                'message' => sprintf(
                    __('Connection failed: %s', 'wp-super-gallery'),
                    $response->get_error_message()
                ),
            ]);
        }

        $code = wp_remote_retrieve_response_code($response);

        if ($code === 200) {
            wp_send_json_success([
                'message' => __('API connection successful!', 'wp-super-gallery'),
            ]);
        } elseif ($code === 401 || $code === 403) {
            // Auth required but endpoint is reachable - this is expected for auth provider 'wp-jwt'.
            wp_send_json_success([
                'message' => __('API reachable. Authentication required for protected endpoints.', 'wp-super-gallery'),
            ]);
        } else {
            wp_send_json_error([
                'message' => sprintf(
                    __('Unexpected response: HTTP %d', 'wp-super-gallery'),
                    $code
                ),
            ]);
        }
    }
}
