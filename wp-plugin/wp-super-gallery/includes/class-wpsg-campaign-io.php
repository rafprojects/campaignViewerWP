<?php
/**
 * WPSG_Campaign_IO — single source of truth for campaign export/import.
 *
 * P65-A (C-1): the campaign import/export pipeline previously existed in four
 * drifting copies — REST JSON (`WPSG_Export_Controller::import_campaign` /
 * `export_campaign`), REST ZIP (`import_single_campaign_from_zip` /
 * `export_campaign_binary`), CLI JSON and CLI ZIP (`WPSG_CLI::campaign_import*`
 * / `campaign_export`). The copies had diverged into real bugs:
 *
 *   - A-4: only the REST JSON path mishandled layout templates (it created posts
 *          of the unregistered CPT `wpsg_layout_template` and read them via
 *          `get_post(intval($uuid))`); every other path used the CRUD class.
 *   - MD5 dedup ran on REST ZIP import but not CLI ZIP import.
 *   - Schedule datetimes were normalized (`strtotime`) on REST but not CLI.
 *   - `layoutBinding` was recursively sanitized on REST but not CLI.
 *   - Media `source` was written as `'url'` (JSON) — not a valid source value
 *          (G-4); the frontend treats anything that is not `'external'` as an
 *          uploaded attachment, so URL-only imports were mislabeled.
 *   - Sideloaded media never carried `attachmentId`, so imported attachments
 *          were invisible to orphan detection and metadata enrichment (both gate
 *          on `attachmentId`).
 *   - ZIP entries were read fully into memory via `getFromName()` (E-4).
 *
 * This service exposes two primitives — {@see build_entry()} (export) and
 * {@see import_entry()} (import) — around which the REST controllers and CLI
 * commands are thin transport wrappers. Every concern above is resolved here,
 * once, by construction.
 *
 * @since P65-A
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Campaign_IO {

    /**
     * Build one campaign export entry: { campaign, layout_template, media_references }.
     *
     * This is the shared unit used by every export transport. The version
     * envelope (v1 JSON / v2 single ZIP / v3 multi ZIP) is added by the caller.
     *
     * @param int  $post_id Campaign post ID (assumed to exist — callers gate).
     * @param bool $binary  When true, each media_reference carries the
     *                      deterministic `filename` the ZIP builder will write.
     * @return array{campaign: array, layout_template: ?array, media_references: array}
     */
    public static function build_entry(int $post_id, bool $binary = false): array {
        $post     = get_post($post_id);
        $campaign = WPSG_REST_Base::format_campaign($post);
        $media    = (array) (get_post_meta($post_id, 'media_items', true) ?: []);

        // A-4 fix: layout templates are always resolved through the CRUD class
        // (UUID `post_name` lookup), never `get_post(intval($uuid))`.
        $template_id     = get_post_meta($post_id, '_wpsg_layout_binding_template_id', true);
        $layout_template = $template_id ? WPSG_Layout_Templates::get($template_id) : null;

        $media_references = array_values(array_map(function ($item) use ($binary) {
            $ref = [
                'id'    => $item['id'] ?? '',
                'url'   => $item['url'] ?? '',
                'title' => $item['title'] ?? '',
            ];
            if ($binary) {
                $ref['filename'] = WPSG_Export_Engine::get_media_filename($item);
            }
            return $ref;
        }, $media));

        return [
            'campaign'         => $campaign,
            'layout_template'  => is_array($layout_template) ? $layout_template : null,
            'media_references' => $media_references,
        ];
    }

    /**
     * Import one campaign entry.
     *
     * @param array           $entry Manifest entry: { campaign, layout_template?, media_references[] }.
     * @param ZipArchive|null $zip   Open archive when importing a binary package;
     *                              null for URL-only (JSON) imports.
     * @param array           $opts  { via?: 'rest'|'cli', format?: 'json'|'binary' } — audit shaping only.
     * @return array|WP_Error        { id, title, media_imported, media_skipped[] } on success.
     */
    public static function import_entry(array $entry, ?ZipArchive $zip = null, array $opts = []) {
        if (empty($entry['campaign']) || !is_array($entry['campaign'])) {
            return new WP_Error('wpsg_invalid_entry', 'Manifest entry is missing a valid "campaign" object.', ['status' => 400]);
        }

        $src         = $entry['campaign'];
        $title       = sanitize_text_field($src['title'] ?? 'Imported Campaign');
        $description = sanitize_textarea_field($src['description'] ?? '');

        $post_id = wp_insert_post([
            'post_title'   => $title,
            'post_content' => $description,
            'post_type'    => 'wpsg_campaign',
            'post_status'  => 'publish',
        ], true);
        if (is_wp_error($post_id)) {
            return new WP_Error('wpsg_internal_error', $post_id->get_error_message(), ['status' => 500]);
        }

        self::apply_scalar_meta($post_id, $src);
        self::apply_gallery_overrides($post_id, $src);
        self::apply_layout_template($post_id, $src, $entry['layout_template'] ?? null);

        $skipped = [];
        if ($zip instanceof ZipArchive) {
            $result      = self::sideload_media_items($post_id, (array) ($entry['media_references'] ?? []), $zip);
            $media_items = $result['items'];
            $skipped     = $result['skipped'];
        } else {
            $media_items = self::build_url_media_items((array) ($entry['media_references'] ?? []));
        }
        if (!empty($media_items)) {
            update_post_meta($post_id, 'media_items', $media_items);
        }

        $format = $opts['format'] ?? ($zip instanceof ZipArchive ? 'binary' : 'json');
        $via    = $opts['via'] ?? 'rest';
        $source = $via === 'cli' ? ($format === 'binary' ? 'cli-binary' : 'cli') : 'rest';
        WPSG_REST_Base::add_audit_entry($post_id, 'campaign.imported', [
            'source_title' => $title,
            'format'       => $format,
            'mediaCount'   => count($media_items),
        ], [
            'summary'        => "Campaign imported ({$format}): {$title}",
            'resource_type'  => 'campaign',
            'resource_id'    => (string) $post_id,
            'resource_label' => $title,
            'source'         => $source,
        ]);
        WPSG_REST_Base::clear_accessible_campaigns_cache();

        return [
            'id'             => $post_id,
            'title'          => $title,
            'media_imported' => count($media_items),
            'media_skipped'  => $skipped,
        ];
    }

    // ── Import stages ──────────────────────────────────────────────────────────

    /**
     * Copy scalar campaign meta. Imports are always drafts. Schedule datetimes
     * are normalized via strtotime → 'Y-m-d H:i:s' on every transport (was
     * REST-only before P65-A).
     */
    private static function apply_scalar_meta(int $post_id, array $src): void {
        $meta_map = [
            'visibility'  => 'visibility',
            'tags'        => 'tags',
            'coverImage'  => 'cover_image',
            'publishAt'   => 'publish_at',
            'unpublishAt' => 'unpublish_at',
        ];
        update_post_meta($post_id, 'status', 'draft');
        foreach ($meta_map as $src_key => $meta_key) {
            if (empty($src[$src_key])) {
                continue;
            }
            if ($src_key === 'tags' && is_array($src[$src_key])) {
                update_post_meta($post_id, $meta_key, array_values(array_map('sanitize_text_field', $src[$src_key])));
            } elseif (in_array($src_key, ['publishAt', 'unpublishAt'], true)) {
                $ts = strtotime(sanitize_text_field($src[$src_key]));
                if ($ts !== false) {
                    update_post_meta($post_id, $meta_key, gmdate('Y-m-d H:i:s', $ts));
                }
            } else {
                update_post_meta($post_id, $meta_key, sanitize_text_field($src[$src_key]));
            }
        }
    }

    private static function apply_gallery_overrides(int $post_id, array $src): void {
        $gallery_overrides = WPSG_REST_Base::promote_campaign_gallery_overrides($src['galleryOverrides'] ?? null);
        if (!empty($gallery_overrides)) {
            update_post_meta($post_id, '_wpsg_gallery_overrides', wp_json_encode($gallery_overrides));
        }
    }

    /**
     * Create the embedded layout template (if any) via the CRUD class and bind
     * it to the campaign. A-4 fix: always `WPSG_Layout_Templates::create()`,
     * never a hand-rolled CPT insert. `layoutBinding` is always recursively
     * sanitized (was REST-only before P65-A).
     */
    private static function apply_layout_template(int $post_id, array $src, $layout_template): void {
        if (!is_array($layout_template) || empty($layout_template)) {
            return;
        }
        // Support legacy manifests that used 'title' instead of 'name'.
        if (!isset($layout_template['name']) && isset($layout_template['title'])) {
            $layout_template['name'] = $layout_template['title'];
        }
        $created = WPSG_Layout_Templates::create($layout_template);
        if (is_wp_error($created)) {
            return;
        }
        update_post_meta($post_id, '_wpsg_layout_binding_template_id', $created['id']);

        if (!empty($src['layoutBinding'])) {
            $binding = $src['layoutBinding'];
            if (is_array($binding)) {
                array_walk_recursive($binding, function (&$v) {
                    if (is_string($v)) {
                        $v = sanitize_text_field($v);
                    }
                });
                $binding['templateId'] = $created['id'];
            }
            update_post_meta($post_id, '_wpsg_layout_binding', $binding);
        }
    }

    /**
     * Build media items for a URL-only (JSON) import — no binary transfer, so
     * there is no WP attachment. G-4 fix: `source` is `'external'` (a real
     * source value the frontend understands), not the historical `'url'`.
     */
    private static function build_url_media_items(array $media_references): array {
        $items = [];
        foreach ($media_references as $ref) {
            if (!is_array($ref)) {
                continue;
            }
            $items[] = [
                'id'     => sanitize_text_field($ref['id'] ?? '') ?: wp_generate_uuid4(),
                'url'    => esc_url_raw($ref['url'] ?? ''),
                'title'  => sanitize_text_field($ref['title'] ?? ''),
                'type'   => 'image',
                'source' => 'external',
                'order'  => 0,
            ];
        }
        return $items;
    }

    /**
     * Sideload media from an open ZIP — SSRF-safe (reads from the archive, never
     * from manifest URLs). Streams each entry to disk (E-4), dedupes by MD5 on
     * every transport (was REST-only), and stamps `attachmentId` on each item so
     * orphan detection and metadata enrichment see the imported attachment.
     *
     * @return array{items: array, skipped: array<int, array{filename: string, reason: string}>}
     */
    private static function sideload_media_items(int $post_id, array $media_references, ZipArchive $zip): array {
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $items   = [];
        $skipped = [];

        foreach ($media_references as $ref) {
            if (!is_array($ref)) {
                continue;
            }
            $filename = sanitize_file_name($ref['filename'] ?? '');
            if (!$filename) {
                continue;
            }

            $tmp = wp_tempnam($filename);
            if ($tmp === false) {
                $skipped[] = ['filename' => $filename, 'reason' => 'Could not create temporary file.'];
                continue;
            }

            // E-4: stream the entry to disk rather than buffering it in memory.
            if (!WPSG_Export_Engine::stream_zip_entry_to_file($zip, 'media/' . $filename, $tmp)) {
                wp_delete_file($tmp);
                $skipped[] = ['filename' => $filename, 'reason' => 'Entry not found in archive.'];
                continue;
            }

            // Reuse an existing attachment when the file bytes are identical.
            // md5_file() streams the temp file, so memory stays flat.
            $md5         = md5_file($tmp) ?: '';
            $existing_id = $md5 ? WPSG_REST_Base::find_attachment_by_md5($md5) : 0;
            if ($existing_id > 0) {
                $existing_url = wp_get_attachment_url($existing_id);
                if ($existing_url) {
                    wp_delete_file($tmp);
                    $items[] = self::upload_media_item($existing_id, $existing_url, $ref);
                    continue;
                }
            }

            $file_array = ['name' => $filename, 'tmp_name' => $tmp];
            $att_id     = media_handle_sideload($file_array, $post_id, sanitize_text_field($ref['title'] ?? ''));
            wp_delete_file($tmp);

            if (is_wp_error($att_id)) {
                $skipped[] = ['filename' => $filename, 'reason' => $att_id->get_error_message()];
                continue;
            }

            if ($md5) {
                update_post_meta($att_id, '_wpsg_file_md5', $md5);
            }
            $items[] = self::upload_media_item((int) $att_id, wp_get_attachment_url($att_id), $ref);
        }

        return ['items' => $items, 'skipped' => $skipped];
    }

    /**
     * Canonical media item for a sideloaded (uploaded) attachment. Matches the
     * shape produced by the normal upload route: `id` is a uniqid string
     * (preserved from the manifest so layout-slot bindings still resolve),
     * `attachmentId` is the WP post ID.
     */
    private static function upload_media_item(int $att_id, $url, array $ref): array {
        return [
            'id'           => sanitize_text_field($ref['id'] ?? '') ?: wp_generate_uuid4(),
            'attachmentId' => $att_id,
            'url'          => $url ?: '',
            'title'        => sanitize_text_field($ref['title'] ?? ''),
            'type'         => 'image',
            'source'       => 'upload',
            'order'        => 0,
        ];
    }
}
