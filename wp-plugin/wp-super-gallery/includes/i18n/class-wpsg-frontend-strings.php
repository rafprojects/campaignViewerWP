<?php
/**
 * WPSG_Frontend_Strings — GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Regenerate with: npm run i18n:generate
 * Source of truth: src/i18n-strings.en.json
 *
 * Bridges the React (i18next) front-end string catalogue into the WordPress
 * gettext pipeline. Each i18next key maps to its English default wrapped in
 * __(), so `wp i18n make-pot` harvests the strings into the .pot AND
 * get_translated() can resolve the active-locale translation for injection
 * into window.__WPSG_I18N__.strings (consumed by src/i18n.ts).
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Frontend_Strings {
    /**
     * i18next key => translated string for the current locale.
     *
     * @return array<string, string>
     */
    public static function get_translated(): array {
        return [
            'auth_admin_menu_label' => __('Admin menu', 'wp-super-gallery'),
            'auth_user_nav_label' => __('User navigation', 'wp-super-gallery'),
            'auth_user_menu_label' => __('User menu', 'wp-super-gallery'),
            'auth_signed_in_as' => __('Signed in as {{email}}', 'wp-super-gallery'),
            'auth_admin_panel' => __('Admin Panel', 'wp-super-gallery'),
            'auth_settings' => __('Settings', 'wp-super-gallery'),
            'auth_campaign_divider' => __('Campaign', 'wp-super-gallery'),
            'auth_edit_campaign' => __('Edit Campaign', 'wp-super-gallery'),
            'auth_edit_campaign_label' => __('Edit {{title}}', 'wp-super-gallery'),
            'auth_edit_gallery_config' => __('Edit Gallery Config', 'wp-super-gallery'),
            'auth_edit_gallery_config_label' => __('Edit gallery config for {{title}}', 'wp-super-gallery'),
            'auth_manage_media' => __('Manage Media', 'wp-super-gallery'),
            'auth_manage_media_label' => __('Manage media for {{title}}', 'wp-super-gallery'),
            'auth_archive' => __('Archive', 'wp-super-gallery'),
            'auth_archive_label' => __('Archive {{title}}', 'wp-super-gallery'),
            'auth_sign_out' => __('Sign out', 'wp-super-gallery'),
            'auth_sign_in' => __('Sign in', 'wp-super-gallery'),
            'auth_sign_in_prompt' => __('Sign in to access private campaigns.', 'wp-super-gallery'),
            'auth_space_switcher_label' => __('Switch targeted gallery space', 'wp-super-gallery'),
            'auth_target_space' => __('Target space', 'wp-super-gallery'),
            'login_title' => __('Sign in', 'wp-super-gallery'),
            'login_subtitle' => __('Access private campaigns with your WordPress account.', 'wp-super-gallery'),
            'login_email_label' => __('Email', 'wp-super-gallery'),
            'login_email_placeholder' => __('you@example.com', 'wp-super-gallery'),
            'login_password_label' => __('Password', 'wp-super-gallery'),
            'login_password_placeholder' => __('Enter your password', 'wp-super-gallery'),
            'login_email_error' => __('Enter a valid email', 'wp-super-gallery'),
            'login_password_error' => __('Password must be at least {{count}} character', 'wp-super-gallery'),
            'login_password_error_other' => __('Password must be at least {{count}} characters', 'wp-super-gallery'),
            'login_error_title' => __('Error', 'wp-super-gallery'),
            'login_error_generic' => __('Login failed. Check your credentials.', 'wp-super-gallery'),
            'login_submitting' => __('Signing in...', 'wp-super-gallery'),
            'login_submit' => __('Sign in', 'wp-super-gallery'),
            'lightbox_aria_label' => __('Media lightbox', 'wp-super-gallery'),
            'lightbox_close' => __('Close lightbox', 'wp-super-gallery'),
            'lightbox_prev' => __('Previous image (lightbox)', 'wp-super-gallery'),
            'lightbox_next' => __('Next image (lightbox)', 'wp-super-gallery'),
            'lightbox_video_title' => __('Campaign video', 'wp-super-gallery'),
            'lightbox_image_alt' => __('Campaign image', 'wp-super-gallery'),
            'lightbox_counter' => __('{{current}} / {{total}}', 'wp-super-gallery'),
            'kb_arrow_left' => __('←', 'wp-super-gallery'),
            'kb_arrow_right' => __('→', 'wp-super-gallery'),
            'kb_escape' => __('Esc', 'wp-super-gallery'),
            'kb_hint_navigate' => __('navigate', 'wp-super-gallery'),
            'kb_hint_separator' => __('·', 'wp-super-gallery'),
            'kb_hint_close' => __('close', 'wp-super-gallery'),
            'gallery_video_badge' => __('VIDEO', 'wp-super-gallery'),
            'gallery_no_media' => __('No media', 'wp-super-gallery'),
            'gallery_video_type' => __('Video', 'wp-super-gallery'),
            'gallery_image_type' => __('Image', 'wp-super-gallery'),
            'gallery_item_label' => __('{{type}} {{index}}', 'wp-super-gallery'),
            'gallery_item_position' => __('Item {{index}} of {{total}}', 'wp-super-gallery'),
            'gallery_item_index' => __('Item {{index}}', 'wp-super-gallery'),
            'gallery_play_item' => __('Play: {{caption}}', 'wp-super-gallery'),
            'gallery_view_item' => __('View: {{caption}}', 'wp-super-gallery'),
            'gallery_play_video' => __('Play video {{index}}', 'wp-super-gallery'),
            'gallery_view_image' => __('View image {{index}}', 'wp-super-gallery'),
            'gallery_open_lightbox' => __('Open in lightbox', 'wp-super-gallery'),
            'gallery_empty_slot' => __('Empty', 'wp-super-gallery'),
            'carousel_slide_aria' => __('Slide {{index}} of {{total}}', 'wp-super-gallery'),
            'carousel_view_image_aria' => __('View image {{index}} of {{total}}', 'wp-super-gallery'),
            'carousel_video_aria' => __('Video {{index}} of {{total}}: {{caption}}. Use arrow keys to navigate, Enter or Space to play.', 'wp-super-gallery'),
            'carousel_video_player' => __('Video player: {{caption}}', 'wp-super-gallery'),
            'carousel_untitled_video' => __('Untitled video', 'wp-super-gallery'),
            'carousel_untitled_image' => __('Untitled image', 'wp-super-gallery'),
            'carousel_open_lightbox' => __('Open lightbox', 'wp-super-gallery'),
            'carousel_prev_video' => __('Previous video (overlay)', 'wp-super-gallery'),
            'carousel_next_video' => __('Next video (overlay)', 'wp-super-gallery'),
            'carousel_prev_image' => __('Previous image (overlay)', 'wp-super-gallery'),
            'carousel_next_image' => __('Next image (overlay)', 'wp-super-gallery'),
            'carousel_campaign_listing' => __('Campaign listing', 'wp-super-gallery'),
            'carousel_prev_campaigns' => __('Previous campaigns', 'wp-super-gallery'),
            'carousel_next_campaigns' => __('Next campaigns', 'wp-super-gallery'),
            'filter_all' => __('All', 'wp-super-gallery'),
            'sort_default' => __('Default order', 'wp-super-gallery'),
            'sort_newest' => __('Newest first', 'wp-super-gallery'),
            'sort_oldest' => __('Oldest first', 'wp-super-gallery'),
            'sort_aria_label' => __('Sort order', 'wp-super-gallery'),
            'layout_loading_aria' => __('Loading layout template', 'wp-super-gallery'),
            'layout_loading_text' => __('Loading gallery…', 'wp-super-gallery'),
            'layout_not_found' => __('Layout template not found', 'wp-super-gallery'),
            'layout_view_in_lightbox' => __('View {{title}} in lightbox', 'wp-super-gallery'),
            'layout_media_fallback' => __('media', 'wp-super-gallery'),
            'layout_media_overflow' => __('{{count}} media item(s) have no slot — they won\'t be displayed.', 'wp-super-gallery'),
            'layout_slot_overflow' => __('{{count}} slot(s) have no media — they\'ll appear as placeholders.', 'wp-super-gallery'),
            'layout_assignment_info' => __('Slot assignment info', 'wp-super-gallery'),
            'layout_kept_bindings' => __('Kept bindings: {{summary}}', 'wp-super-gallery'),
            'layout_cleared_bindings' => __('Cleared (media not in campaign): {{summary}}', 'wp-super-gallery'),
            'layout_auto_filled' => __('Auto-filled from remaining media: {{summary}}', 'wp-super-gallery'),
            'layout_empty_slots' => __('Empty (no media remaining): slot{{suffix}} {{summary}}', 'wp-super-gallery'),
            'layout_canvas_aria' => __('Layout gallery: {{name}}', 'wp-super-gallery'),
        ];
    }
}
