<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Campaign_Templates {

    const META_IS_TEMPLATE = '_wpsg_is_template';

    const BUILTIN = [
        [
            'id'          => 'builtin_blank',
            'name'        => 'Blank Gallery',
            'description' => 'A clean starting point with no pre-configured settings.',
            'source'      => 'builtin',
            'editable'    => false,
            'settings'    => [
                'visibility'       => 'private',
                'galleryOverrides' => null,
                'layoutTemplateId' => null,
            ],
        ],
        [
            'id'          => 'builtin_public_showcase',
            'name'        => 'Public Showcase',
            'description' => 'Public visibility, ready for external sharing straight after creation.',
            'source'      => 'builtin',
            'editable'    => false,
            'settings'    => [
                'visibility'       => 'public',
                'galleryOverrides' => null,
                'layoutTemplateId' => null,
            ],
        ],
    ];

    /**
     * Resolve the localized name/description for a built-in template.
     *
     * The `BUILTIN` const stores English defaults (compile-time constants cannot
     * call __()); this overlays the active-locale translation at request time.
     * Literal strings are kept here so `wp i18n make-pot` can harvest them.
     */
    private static function translate_builtin(array $t): array {
        switch ($t['id']) {
            case 'builtin_blank':
                $t['name']        = __('Blank Gallery', 'wp-super-gallery');
                $t['description'] = __('A clean starting point with no pre-configured settings.', 'wp-super-gallery');
                break;
            case 'builtin_public_showcase':
                $t['name']        = __('Public Showcase', 'wp-super-gallery');
                $t['description'] = __('Public visibility, ready for external sharing straight after creation.', 'wp-super-gallery');
                break;
        }
        return $t;
    }

    public static function get_builtins(): array {
        return array_map(static function ($t) {
            return array_merge(self::translate_builtin($t), ['createdAt' => null]);
        }, self::BUILTIN);
    }

    public static function is_builtin(string $id): bool {
        foreach (self::BUILTIN as $t) {
            if ($t['id'] === $id) {
                return true;
            }
        }
        return false;
    }

    public static function get_builtin(string $id): ?array {
        foreach (self::BUILTIN as $t) {
            if ($t['id'] === $id) {
                return array_merge(self::translate_builtin($t), ['createdAt' => null]);
            }
        }
        return null;
    }

    public static function post_to_template(WP_Post $post): array {
        return [
            'id'          => strval($post->ID),
            'name'        => $post->post_title,
            'description' => $post->post_content,
            'source'      => 'user',
            'editable'    => true,
            'settings'    => [
                'visibility'       => (string) (get_post_meta($post->ID, 'visibility', true) ?: 'private'),
                'galleryOverrides' => get_post_meta($post->ID, '_wpsg_gallery_overrides', true) ?: null,
                'layoutTemplateId' => (string) (get_post_meta($post->ID, '_wpsg_layout_binding_template_id', true) ?: '') ?: null,
            ],
            'createdAt'   => get_post_time('c', true, $post),
        ];
    }

    public static function get_user_templates(): array {
        $posts = get_posts([
            'post_type'      => 'wpsg_campaign',
            'post_status'    => 'publish',
            'posts_per_page' => -1,
            'meta_query'     => [[
                'key'   => self::META_IS_TEMPLATE,
                'value' => '1',
            ]],
            'orderby'        => 'date',
            'order'          => 'ASC',
        ]);

        return array_map([self::class, 'post_to_template'], $posts);
    }
}
