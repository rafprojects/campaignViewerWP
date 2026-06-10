<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Media_Controller extends WPSG_REST_Base {

    public static function register_routes(): void {
        // P18-G: Media usage — summary before parameterised route.
        register_rest_route('wp-super-gallery/v1', '/media/usage-summary', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_media_usage_summary'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/media/(?P<mediaId>[a-zA-Z0-9_.-]+)/usage', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_media_usage'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_media'],
                'permission_callback' => [self::class, 'rate_limit_public'],
                'args'                => [
                    'sort' => [
                        'type'    => 'string',
                        'enum'    => ['order_asc', 'order_desc', 'title_asc', 'title_desc', 'created_asc', 'created_desc', 'size_asc', 'size_desc'],
                        'default' => 'order_asc',
                    ],
                ],
            ],
            [
                'methods'             => 'POST',
                // P33-C: editor and owner can add media.
                'callback'            => [self::class, 'create_media'],
                'permission_callback' => [self::class, 'require_campaign_editor'],
                'args'                => [
                    'type'   => [
                        'required' => true,
                        'type'     => 'string',
                        'enum'     => ['image', 'video'],
                    ],
                    'source' => [
                        'required' => true,
                        'type'     => 'string',
                        'enum'     => ['upload', 'external', 'library'],
                    ],
                    'url'    => [
                        'type'              => 'string',
                        'sanitize_callback' => 'esc_url_raw',
                    ],
                    'caption' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media/batch', [
            [
                'methods' => 'POST',
                // P33-C: editor and owner can batch-add media.
                'callback' => [self::class, 'create_media_batch'],
                'permission_callback' => [self::class, 'require_campaign_editor'],
            ],
        ]);

        // Register specific sub-routes BEFORE the generic mediaId route to avoid pattern conflicts
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media/reorder', [
            [
                'methods' => 'PUT',
                // P33-C: editor and owner can reorder media.
                'callback' => [self::class, 'reorder_media'],
                'permission_callback' => [self::class, 'require_campaign_editor'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media/rescan', [
            [
                'methods' => 'POST',
                // P33-C: editor and owner can rescan media types.
                'callback' => [self::class, 'rescan_media_types'],
                'permission_callback' => [self::class, 'require_campaign_editor'],
            ],
        ]);

        // Generic mediaId route must come AFTER specific sub-routes
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media/(?P<mediaId>[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)', [
            [
                'methods' => 'PUT',
                // P33-C: editor and owner can update media items.
                'callback' => [self::class, 'update_media'],
                'permission_callback' => [self::class, 'require_campaign_editor'],
            ],
            [
                'methods' => 'DELETE',
                // P33-C: editor and owner can delete media items.
                'callback' => [self::class, 'delete_media'],
                'permission_callback' => [self::class, 'require_campaign_editor'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/media/rescan-all', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'rescan_all_media_types'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/media/library', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_media_library'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'sort' => [
                        'type'    => 'string',
                        'enum'    => ['order_asc', 'order_desc', 'title_asc', 'title_desc', 'created_asc', 'created_desc', 'size_asc', 'size_desc'],
                        'default' => 'created_desc',
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/media/upload', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'upload_media'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'force' => [
                        'type'    => 'boolean',
                        'default' => false,
                    ],
                    'campaign_id' => [
                        'type'    => 'integer',
                        'default' => 0,
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/tags/media', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_media_tags'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'create_media_tag'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/tags/media/(?P<id>\d+)', [
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'delete_media_tag'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P48-F: media library binary export / import.
        register_rest_route('wp-super-gallery/v1', '/admin/media/export/binary', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'export_media_library_binary'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'campaign_id' => ['type' => 'integer', 'required' => false],
                    'mime_type'   => ['type' => 'string',  'required' => false, 'enum' => ['image', 'video', 'all']],
                    'search'      => ['type' => 'string',  'required' => false],
                ],
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/media/import/binary', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'import_media_library_binary'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
    }

    public static function get_media_usage($request) {
        $media_id = sanitize_text_field($request->get_param('mediaId'));

        if (empty($media_id)) {
            return new WP_Error('wpsg_missing_media_id', 'mediaId is required', ['status' => 400]);
        }

        $found = WPSG_DB::get_media_usage($media_id);
        return new WP_REST_Response(['count' => count($found), 'campaigns' => $found], 200);
    }

    /**
     * GET /media/usage-summary?ids[]=id1&ids[]=id2...
     * Returns a map { mediaId: count } for the given IDs.
     * Uses indexed wpsg_media_refs table (P20-I-2).
     */
    public static function get_media_usage_summary($request) {
        $ids     = $request->get_param('ids');

        if (!is_array($ids) || empty($ids)) {
            return new WP_REST_Response((object)[], 200);
        }

        $ids = array_values(array_unique(array_map('sanitize_text_field', $ids)));
        if (count($ids) > 200) {
            return new WP_Error('wpsg_too_many_ids', 'Too many IDs (max 200)', ['status' => 400]);
        }

        $result = WPSG_DB::get_media_usage_summary($ids);
        return new WP_REST_Response((object)$result, 200);
    }


    public static function list_media($request) {
        $start = microtime(true);
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $user_id = get_current_user_id();
        if (!self::can_view_campaign($post_id, $user_id)) {
            return new WP_Error('wpsg_forbidden', 'Forbidden', ['status' => 403]);
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        $media_items = is_array($media_items) ? $media_items : [];

        // Normalize legacy media types on read for accuracy
        $updated_count = 0;
        $normalized = self::normalize_media_items_types($media_items);
        $media_items = self::enrich_media_with_metadata($normalized['items']);
        $updated_count = $normalized['updated'];

        // Backfill missing IDs and repair duplicate IDs.
        // Duplicates arise when the campaign's route {id} param was mistakenly stored as every
        // item's media ID — all items end up with the same ID, so any delete wipes the whole set.
        $ids_backfilled = 0;
        $seen_ids = [];
        foreach ($media_items as &$item) {
            $current_id = $item['id'] ?? '';
            if ($current_id === '' || isset($seen_ids[$current_id])) {
                do {
                    $current_id = wp_generate_uuid4();
                } while (isset($seen_ids[$current_id]));
                $item['id'] = $current_id;
                $ids_backfilled++;
            }
            $seen_ids[$current_id] = true;
        }
        unset($item);

        if ($updated_count > 0 || $ids_backfilled > 0) {
            update_post_meta($post_id, 'media_items', $media_items);
            if ($updated_count > 0) {
                self::add_audit_entry($post_id, 'media.types_rescanned', [
                    'updated' => $updated_count,
                ]);
            }
            if ($ids_backfilled > 0) {
                self::add_audit_entry($post_id, 'media.ids_backfilled', [
                    'count' => $ids_backfilled,
                ]);
            }
        }

        $sort = sanitize_text_field($request->get_param('sort') ?? 'order_asc');
        $media_items = self::sort_media_items($media_items, $sort);

        $payload = [
            'items' => $media_items,
            'meta' => [
                'typesUpdated' => $updated_count,
                'total' => count($media_items),
                'sort' => $sort,
            ],
        ];

        $response = self::respond_with_etag($request, $payload, 200, $post_id . ':' . $sort);
        self::log_slow_rest('media.list', $start, [
            'campaignId' => $post_id,
            'total' => count($media_items),
        ]);
        return $response;
    }

    private static function sort_media_items(array $items, string $sort): array {
        usort($items, static function ($a, $b) use ($sort) {
            switch ($sort) {
                case 'order_desc':
                    return intval($b['order'] ?? 0) <=> intval($a['order'] ?? 0);

                case 'title_asc':
                    return strnatcasecmp($a['caption'] ?? $a['title'] ?? '', $b['caption'] ?? $b['title'] ?? '');

                case 'title_desc':
                    return strnatcasecmp($b['caption'] ?? $b['title'] ?? '', $a['caption'] ?? $a['title'] ?? '');

                case 'created_asc':
                    $ta = strtotime($a['dateUploaded'] ?? '') ?: intval($a['order'] ?? 0);
                    $tb = strtotime($b['dateUploaded'] ?? '') ?: intval($b['order'] ?? 0);
                    return $ta <=> $tb;

                case 'created_desc':
                    $ta = strtotime($a['dateUploaded'] ?? '') ?: intval($a['order'] ?? 0);
                    $tb = strtotime($b['dateUploaded'] ?? '') ?: intval($b['order'] ?? 0);
                    return $tb <=> $ta;

                case 'size_asc':
                    return intval($a['filesize'] ?? 0) <=> intval($b['filesize'] ?? 0);

                case 'size_desc':
                    return intval($b['filesize'] ?? 0) <=> intval($a['filesize'] ?? 0);

                case 'order_asc':
                default:
                    return intval($a['order'] ?? 0) <=> intval($b['order'] ?? 0);
            }
        });
        return $items;
    }

    private static function resolve_campaign_id_from_request($request) {
        $post_id = intval($request->get_param('campaignId') ?? 0);
        if ($post_id > 0) {
            return $post_id;
        }

        $route = method_exists($request, 'get_route') ? $request->get_route() : '';
        if (is_string($route) && preg_match('#/campaigns/(\d+)/media(?:/batch)?$#', $route, $matches)) {
            return intval($matches[1]);
        }

        $route_id = $request->get_param('id');
        if (is_numeric($route_id)) {
            return intval($route_id);
        }

        return 0;
    }

    private static function clamp_media_order($order) {
        $order = intval($order);
        if ($order < 0) {
            return 0;
        }

        if ($order > 1000000) {
            return 1000000;
        }

        return $order;
    }

    private static function get_next_media_order(array $media_items) {
        $max_order = -1;
        foreach ($media_items as $media_item) {
            $max_order = max($max_order, intval($media_item['order'] ?? 0));
        }

        return $max_order + 1;
    }

    private static function build_media_item_from_payload(array $payload) {
        $type = sanitize_text_field($payload['type'] ?? '');
        $source = sanitize_text_field($payload['source'] ?? '');
        $caption = sanitize_text_field($payload['caption'] ?? '');
        $title = sanitize_text_field($payload['title'] ?? '');
        $thumbnail = esc_url_raw($payload['thumbnail'] ?? '');

        if (!in_array($type, ['video', 'image'], true)) {
            return new WP_Error('wpsg_invalid_media_type', 'Invalid media type', ['status' => 400]);
        }

        $custom_media_id = sanitize_text_field($payload['id'] ?? '');
        if ($custom_media_id !== '' && !preg_match('/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/', $custom_media_id)) {
            return new WP_Error('wpsg_invalid_media_id', 'Invalid media ID', ['status' => 400]);
        }

        $media_item = [
            'id' => $custom_media_id !== '' ? $custom_media_id : wp_generate_uuid4(),
            'type' => $type,
            'source' => $source,
            'caption' => $caption,
            'order' => self::clamp_media_order($payload['order'] ?? 0),
        ];

        if ($title !== '') {
            $media_item['title'] = $title;
        }

        if ($source === 'external') {
            $url = esc_url_raw($payload['url'] ?? '');
            if (empty($url)) {
                return new WP_Error('invalid_url', 'URL is required', ['status' => 400]);
            }

            $parsed = wp_parse_url($url);
            if (empty($parsed['scheme']) || strtolower($parsed['scheme']) !== 'https') {
                return new WP_Error('invalid_url', 'URL must use HTTPS', ['status' => 400]);
            }

            if ($type === 'image') {
                $media_item['url'] = $url;
                $media_item['provider'] = 'external';
                if ($thumbnail !== '') {
                    $media_item['thumbnail'] = $thumbnail;
                }
            } else {
                $normalized = self::normalize_external_media($url);
                if (is_wp_error($normalized)) {
                    return new WP_Error('wpsg_bad_request', $normalized->get_error_message(), ['status' => 400]);
                }

                $media_item['url'] = $normalized['url'];
                $media_item['embedUrl'] = $normalized['embedUrl'];
                $media_item['provider'] = $normalized['provider'];
                if ($thumbnail !== '') {
                    $media_item['thumbnail'] = $thumbnail;
                }
            }
        } elseif ($source === 'upload') {
            $attachment_id = intval($payload['attachmentId'] ?? 0);
            if ($attachment_id <= 0) {
                return new WP_Error('wpsg_missing_attachment_id', 'attachmentId is required for uploads', ['status' => 400]);
            }

            $attachment_url = wp_get_attachment_url($attachment_id);
            if (!$attachment_url) {
                return new WP_Error('wpsg_invalid_attachment_id', 'Invalid attachmentId', ['status' => 400]);
            }

            $provider = sanitize_text_field($payload['provider'] ?? '');
            $media_item['attachmentId'] = $attachment_id;
            $media_item['url'] = $attachment_url;
            $media_item['thumbnail'] = $thumbnail ?: $attachment_url;
            if ($provider !== '') {
                $media_item['provider'] = $provider;
            }
        } else {
            return new WP_Error('wpsg_invalid_media_source', 'Invalid media source', ['status' => 400]);
        }

        return $media_item;
    }

    private static function get_max_batch_upload_size() {
        $configured_limit = intval(WPSG_Settings::get_setting('max_batch_upload_size', 20));
        if ($configured_limit <= 0) {
            $configured_limit = 20;
        }

        return intval(apply_filters('wpsg_max_batch_upload_size', $configured_limit));
    }

    private static function get_uploaded_file_entries(array $files) {
        if (!empty($files['file']) && !is_array($files['file']['name'] ?? null)) {
            return [$files['file']];
        }

        if (!empty($files['files']) && is_array($files['files']['name'] ?? null)) {
            $entries = [];
            $names = $files['files']['name'];
            foreach ($names as $index => $name) {
                $entries[] = [
                    'name' => $name,
                    'type' => $files['files']['type'][$index] ?? '',
                    'tmp_name' => $files['files']['tmp_name'][$index] ?? '',
                    'error' => $files['files']['error'][$index] ?? UPLOAD_ERR_NO_FILE,
                    'size' => $files['files']['size'][$index] ?? 0,
                ];
            }

            return $entries;
        }

        return [];
    }

    private static function get_upload_error_data(array $file) {
        if (!isset($file['error']) || $file['error'] === UPLOAD_ERR_OK) {
            return null;
        }

        $message = 'Upload failed.';
        $status = 400;

        switch ($file['error']) {
            case UPLOAD_ERR_INI_SIZE:
            case UPLOAD_ERR_FORM_SIZE:
                $message = 'Uploaded file exceeds the allowed size.';
                $status = 413;
                break;
            case UPLOAD_ERR_PARTIAL:
                $message = 'The uploaded file was only partially uploaded.';
                break;
            case UPLOAD_ERR_NO_FILE:
                $message = 'No file was uploaded.';
                break;
            case UPLOAD_ERR_NO_TMP_DIR:
            case UPLOAD_ERR_CANT_WRITE:
            case UPLOAD_ERR_EXTENSION:
                $message = 'Server error while processing upload.';
                $status = 500;
                break;
        }

        return [
            'message' => $message,
            'status' => $status,
        ];
    }

    private static function is_trusted_uploaded_file($tmp_name, array $file) {
        $allow_non_http_uploads = (bool) apply_filters('wpsg_allow_non_http_uploads', false, $file);
        if ($allow_non_http_uploads) {
            return is_string($tmp_name) && $tmp_name !== '' && file_exists($tmp_name);
        }

        return is_string($tmp_name) && $tmp_name !== '' && is_uploaded_file($tmp_name);
    }

    private static function create_attachment_from_upload(array $upload, $original_name) {
        $file_path = $upload['file'] ?? '';
        if (!is_string($file_path) || $file_path === '' || !file_exists($file_path)) {
            return new WP_Error('wpsg_bad_request', 'Upload failed.', ['status' => 400]);
        }

        $file_name = $original_name ?: wp_basename($file_path);
        $file_type = wp_check_filetype(wp_basename($file_path), null);
        $attachment = [
            'post_mime_type' => $file_type['type'] ?? ($upload['type'] ?? ''),
            'post_title' => sanitize_text_field(pathinfo($file_name, PATHINFO_FILENAME)),
            'post_content' => '',
            'post_status' => 'inherit',
        ];

        $attachment_id = wp_insert_attachment($attachment, $file_path, 0, true);
        if (is_wp_error($attachment_id)) {
            return new WP_Error('wpsg_bad_request', $attachment_id->get_error_message(), ['status' => 400]);
        }

        $attachment_metadata = wp_generate_attachment_metadata($attachment_id, $file_path);
        if (!is_wp_error($attachment_metadata)) {
            wp_update_attachment_metadata($attachment_id, $attachment_metadata);
        }

        return intval($attachment_id);
    }

    private static function prepare_uploaded_attachment_payload($attachment_id) {
        $url = wp_get_attachment_url($attachment_id);
        $thumbnail = null;
        $mime = get_post_mime_type($attachment_id);

        if ($mime && strpos($mime, 'image') === 0) {
            $thumb = wp_get_attachment_image_src($attachment_id, 'medium');
            $thumbnail = $thumb ? $thumb[0] : $url;
        }

        return [
            'attachmentId' => intval($attachment_id),
            'url' => $url,
            'thumbnail' => $thumbnail,
            'mimeType' => $mime,
        ];
    }

    // P38-MD1: Find the closest pHash match within $threshold Hamming bits.
    // Returns ['id' => int, 'url' => string, 'distance' => int] or [].
    private static function find_near_duplicates_by_phash(string $phash, int $threshold): array {
        global $wpdb;
        $limit = max(1, intval(apply_filters('wpsg_phash_max_scan', 5000)));
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT pm.post_id, pm.meta_value
                 FROM {$wpdb->postmeta} pm
                 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
                 WHERE pm.meta_key = %s
                   AND p.post_type = 'attachment'
                   AND p.post_status = 'inherit'
                 LIMIT %d",
                '_wpsg_file_phash',
                $limit
            ),
            ARRAY_A
        );
        if (empty($rows)) {
            return [];
        }

        $best_id       = 0;
        $best_distance = PHP_INT_MAX;

        foreach ($rows as $row) {
            $d = WPSG_PHash::hamming_distance($phash, (string) $row['meta_value']);
            if ($d === 0) {
                $best_id       = intval($row['post_id']);
                $best_distance = 0;
                break;
            }
            if ($d < $best_distance) {
                $best_distance = $d;
                $best_id       = intval($row['post_id']);
            }
        }

        if ($best_distance > $threshold || $best_id <= 0) {
            return [];
        }

        return [
            'id'       => $best_id,
            'url'      => wp_get_attachment_url($best_id) ?: '',
            'distance' => $best_distance,
        ];
    }

    // P38-MD1: Return display name and campaign list for a WordPress attachment.
    // Used to enrich duplicate/near-duplicate 409 responses with context.
    private static function find_attachment_origin_meta(int $id): array {
        $file = get_attached_file($id);
        $name = $file ? basename($file) : (get_the_title($id) ?: '');
        $campaigns = class_exists('WPSG_DB') ? WPSG_DB::get_campaigns_for_attachment_id($id) : [];
        return ['name' => $name, 'campaigns' => $campaigns];
    }

    private static function upload_single_media_file(array $file, bool $force = false) {
        $error = self::get_upload_error_data($file);
        if ($error) {
            return new WP_Error('wpsg_upload_error', $error['message'], ['status' => $error['status']]);
        }

        if (!isset($file['tmp_name']) || !self::is_trusted_uploaded_file($file['tmp_name'], $file)) {
            return new WP_Error('wpsg_invalid_upload', 'Invalid upload', ['status' => 400]);
        }

        $allowed_mimes = apply_filters('wpsg_upload_allowed_mimes', [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/webm',
            'video/ogg',
        ]);

        $size_limit = intval(apply_filters('wpsg_upload_max_bytes', 50 * 1024 * 1024));
        if (isset($file['size']) && intval($file['size']) > $size_limit) {
            return new WP_Error('wpsg_file_too_large', 'File too large', ['status' => 413]);
        }

        $check = wp_check_filetype_and_ext($file['tmp_name'], $file['name']);
        $mime = $check['type'] ?? '';
        $ext = $check['ext'] ?? '';
        $check_filename = wp_check_filetype($file['name']);
        $mime_filename = $check_filename['type'] ?? '';

        if (!$mime || !in_array($mime, $allowed_mimes, true)) {
            return new WP_Error('wpsg_invalid_file_type', 'Invalid file type', ['status' => 415]);
        }

        if (!$ext || ($mime_filename && $mime_filename !== $mime)) {
            return new WP_Error('wpsg_invalid_file_type', 'Invalid file type', ['status' => 415]);
        }

        // P28-N: MD5 duplicate detection — compute before sideload while tmp file is readable.
        $md5 = md5_file($file['tmp_name']) ?: null;
        if ($md5 && !$force) {
            $existing_id = self::find_attachment_by_md5($md5);
            if ($existing_id > 0) {
                $origin = self::find_attachment_origin_meta($existing_id);
                return new WP_Error('wpsg_duplicate_file', 'This file has already been uploaded.', [
                    'status'              => 409,
                    'existing_id'         => $existing_id,
                    'existing_url'        => wp_get_attachment_url($existing_id),
                    'existing_name'       => $origin['name'],
                    'existing_campaigns'  => $origin['campaigns'],
                ]);
            }
        }

        // P38-MD1: pHash near-duplicate detection for images (runs after exact-duplicate check).
        // Compute unconditionally so forced uploads still get their hash stored for future scans.
        $phash = null;
        if (class_exists('WPSG_PHash') && WPSG_PHash::is_image_mime($mime)) {
            $phash = WPSG_PHash::compute($file['tmp_name']);
            if ($phash !== null && !$force) {
                $threshold  = intval(apply_filters('wpsg_phash_hamming_threshold', 10));
                $near_match = self::find_near_duplicates_by_phash($phash, $threshold);
                if (!empty($near_match)) {
                    $origin = self::find_attachment_origin_meta($near_match['id']);
                    return new WP_Error('wpsg_near_duplicate_file', 'A visually similar image has already been uploaded.', [
                        'status'           => 409,
                        'similar_id'       => $near_match['id'],
                        'similar_url'      => $near_match['url'],
                        'distance'         => $near_match['distance'],
                        'similar_name'     => $origin['name'],
                        'similar_campaigns' => $origin['campaigns'],
                    ]);
                }
            }
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $overrides = [
            'test_form' => false,
        ];

        $upload = wp_handle_sideload($file, $overrides);
        if (!empty($upload['error'])) {
            return new WP_Error('wpsg_bad_request', $upload['error'], ['status' => 400]);
        }

        if (class_exists('WPSG_Image_Optimizer')) {
            WPSG_Image_Optimizer::$wpsg_upload_context = true;
            try {
                $upload = WPSG_Image_Optimizer::optimize_on_upload($upload, 'upload');
            } finally {
                WPSG_Image_Optimizer::$wpsg_upload_context = false;
            }
        }

        $attachment_id = self::create_attachment_from_upload($upload, $file['name'] ?? '');
        if (is_wp_error($attachment_id)) {
            return $attachment_id;
        }

        // P28-N: Store MD5 for future duplicate detection.
        if ($md5) {
            update_post_meta($attachment_id, '_wpsg_file_md5', $md5);
        }

        // P38-MD1: Store pHash for near-duplicate detection on future uploads.
        if ($phash !== null) {
            update_post_meta($attachment_id, '_wpsg_file_phash', $phash);
        }

        return self::prepare_uploaded_attachment_payload($attachment_id);
    }

    public static function create_media($request) {
        $post_id = self::resolve_campaign_id_from_request($request);
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $payload = $request->get_json_params();
        if (!is_array($payload)) {
            $payload = [];
        }

        // 'id' is intentionally excluded: the route's {id} capture is the campaign post ID,
        // not a media item ID. If the client wants to supply a custom media ID it must
        // include it in the JSON body; otherwise build_media_item_from_payload generates a UUID.
        foreach (['type', 'source', 'url', 'attachmentId', 'caption', 'order', 'thumbnail', 'provider', 'title'] as $key) {
            if (!array_key_exists($key, $payload)) {
                $value = $request->get_param($key);
                if (!is_null($value)) {
                    $payload[$key] = $value;
                }
            }
        }

        $media_item = self::build_media_item_from_payload($payload);
        if (is_wp_error($media_item)) {
            return $media_item;
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        if (!is_array($media_items)) {
            $media_items = [];
        }
        $media_items[] = $media_item;
        update_post_meta($post_id, 'media_items', $media_items);

        self::add_audit_entry($post_id, 'media.created', [
            'mediaId' => $media_item['id'],
            'type' => $media_item['type'],
            'source' => $media_item['source'],
            'provider' => $media_item['provider'] ?? '',
            'url' => $media_item['url'] ?? '',
            'attachmentId' => $media_item['attachmentId'] ?? 0,
        ]);
        do_action('wpsg_media_added', $post_id, ['mediaId' => $media_item['id'], 'count' => 1]);
        self::bump_cache_version();

        return new WP_REST_Response($media_item, 201);
    }

    public static function create_media_batch($request) {
        $post_id = self::resolve_campaign_id_from_request($request);
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $items = $request->get_param('items');
        if (!is_array($items) || empty($items)) {
            return new WP_Error('wpsg_invalid_items', 'items must be a non-empty array', ['status' => 400]);
        }

        $max_batch_upload_size = self::get_max_batch_upload_size();
        if (count($items) > $max_batch_upload_size) {
            return new WP_Error(
                'wpsg_batch_limit_exceeded',
                sprintf('A maximum of %d items can be added per batch.', $max_batch_upload_size),
                ['status' => 400]
            );
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        $media_items = is_array($media_items) ? $media_items : [];
        $next_order = self::get_next_media_order($media_items);
        $added = [];
        $failed = [];

        foreach ($items as $index => $item) {
            if (!is_array($item)) {
                $failed[] = [
                    'index' => intval($index),
                    'error' => 'Each batch item must be an object.',
                ];
                continue;
            }

            if (!isset($item['order'])) {
                $item['order'] = $next_order;
                $next_order++;
            }

            $media_item = self::build_media_item_from_payload($item);
            if (is_wp_error($media_item)) {
                $failed[] = [
                    'index' => intval($index),
                    'error' => $media_item->get_error_message(),
                ];
                continue;
            }

            $added[] = $media_item;
        }

        if (!empty($added)) {
            $media_items = array_merge($media_items, $added);
            update_post_meta($post_id, 'media_items', $media_items);
            $batch_failed = count($failed);
            self::add_audit_entry($post_id, 'media.batch_created', [
                'count'    => count($added),
                'failed'   => $batch_failed,
                'mediaIds' => array_values(array_map(function ($item) {
                    return $item['id'];
                }, $added)),
            ], [
                'severity'      => $batch_failed > 0 ? 'warning' : 'info',
                'summary'       => count($added) . ' item' . (count($added) === 1 ? '' : 's') . ' added to campaign'
                                   . ($batch_failed > 0 ? " ({$batch_failed} failed)" : ''),
                'resource_type' => 'campaign',
                'resource_id'   => (string) $post_id,
            ]);
            do_action('wpsg_media_added', $post_id, ['count' => count($added)]);
            self::bump_cache_version();
        }

        $status = !empty($added) ? 201 : 400;

        return new WP_REST_Response([
            'added' => $added,
            'failed' => $failed,
            'total' => count($items),
        ], $status);
    }

    public static function update_media($request) {
        $post_id = intval($request->get_param('id'));
        $media_id = sanitize_text_field($request->get_param('mediaId'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        $media_items = is_array($media_items) ? $media_items : [];
        $updated = false;

        foreach ($media_items as &$media_item) {
            if (($media_item['id'] ?? '') === $media_id) {
                if (!is_null($request->get_param('caption'))) {
                    $media_item['caption'] = sanitize_text_field($request->get_param('caption'));
                }
                if (!is_null($request->get_param('order'))) {
                    $media_item['order'] = intval($request->get_param('order'));
                }
                if (!is_null($request->get_param('thumbnail'))) {
                    $media_item['thumbnail'] = esc_url_raw($request->get_param('thumbnail'));
                }
                $updated = true;
                break;
            }
        }
        unset($media_item);

        if (!$updated) {
            return new WP_Error('wpsg_media_not_found', 'Media not found', ['status' => 404]);
        }

        update_post_meta($post_id, 'media_items', $media_items);
        self::add_audit_entry($post_id, 'media.updated', [
            'mediaId' => $media_id,
        ]);
        self::bump_cache_version();
        return new WP_REST_Response(['message' => 'Media updated'], 200);
    }

    public static function reorder_media($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $items = $request->get_param('items');
        if (!is_array($items)) {
            return new WP_Error('wpsg_invalid_items', 'items must be an array', ['status' => 400]);
        }

        $order_map = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $id = sanitize_text_field($item['id'] ?? '');
            $order = intval($item['order'] ?? 0);
            if (!$id) {
                continue;
            }
            if ($order < 0) {
                $order = 0;
            } elseif ($order > 1000000) {
                $order = 1000000;
            }
            $order_map[$id] = $order;
        }

        if (empty($order_map)) {
            return new WP_Error('wpsg_no_valid_items', 'No valid items provided', ['status' => 400]);
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        $media_items = is_array($media_items) ? $media_items : [];

        // Validate that all provided IDs belong to this campaign's media items.
        $existing_ids = array_map(function ($m) { return $m['id'] ?? ''; }, $media_items);
        $invalid = array_values(array_filter(array_keys($order_map), function ($id) use ($existing_ids) {
            return !in_array($id, $existing_ids, true);
        }));
        if (!empty($invalid)) {
            return new WP_Error('wpsg_invalid_media_ids', 'Invalid media id(s) provided', ['status' => 400, 'invalid' => $invalid]);
        }

        foreach ($media_items as &$media_item) {
            $id = $media_item['id'] ?? '';
            if ($id && array_key_exists($id, $order_map)) {
                $media_item['order'] = $order_map[$id];
            }
        }
        unset($media_item);

        update_post_meta($post_id, 'media_items', $media_items);
        self::add_audit_entry($post_id, 'media.reordered', [
            'count' => count($order_map),
        ]);
        self::bump_cache_version();

        return new WP_REST_Response(['message' => 'Media reordered'], 200);
    }


    /**
     * @deprecated Use enrich_media_with_metadata() instead.
     * Kept for call sites that have not yet been migrated; delegates directly.
     */
    private static function enrich_media_with_dimensions(array $items): array {
        return self::enrich_media_with_metadata($items);
    }

    /**
     * Rescan and fix media types for a single campaign.
     */
    public static function rescan_media_types($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        if (!is_array($media_items) || empty($media_items)) {
            return new WP_REST_Response(['message' => 'No media items to scan', 'updated' => 0], 200);
        }

        $updated_count = 0;
        foreach ($media_items as &$media_item) {
            $url = $media_item['url'] ?? '';
            $current_type = $media_item['type'] ?? '';
            $inferred_type = self::infer_media_type_from_url($url);
            
            if ($inferred_type && $inferred_type !== $current_type) {
                $media_item['type'] = $inferred_type;
                $updated_count++;
            }
        }
        unset($media_item);

        if ($updated_count > 0) {
            update_post_meta($post_id, 'media_items', $media_items);
            self::add_audit_entry($post_id, 'media.types_rescanned', [
                'updated' => $updated_count,
            ]);
            self::bump_cache_version();
        }

        return new WP_REST_Response([
            'message' => $updated_count > 0 ? 'Media types updated' : 'No changes needed',
            'updated' => $updated_count,
            'total' => count($media_items),
        ], 200);
    }

    /**
     * Rescan and fix media types for ALL campaigns.
     */
    public static function rescan_all_media_types() {
        $campaigns = get_posts([
            'post_type' => WPSG_CPT::POST_TYPE,
            'posts_per_page' => -1,
            'post_status' => ['publish', 'draft', 'private'],
        ]);

        $total_updated = 0;
        $campaigns_updated = 0;

        foreach ($campaigns as $campaign) {
            $media_items = get_post_meta($campaign->ID, 'media_items', true);
            if (!is_array($media_items) || empty($media_items)) {
                continue;
            }

            $updated_count = 0;
            foreach ($media_items as &$media_item) {
                $url = $media_item['url'] ?? '';
                $current_type = $media_item['type'] ?? '';
                $inferred_type = self::infer_media_type_from_url($url);
                
                if ($inferred_type && $inferred_type !== $current_type) {
                    $media_item['type'] = $inferred_type;
                    $updated_count++;
                }
            }
            unset($media_item);

            if ($updated_count > 0) {
                update_post_meta($campaign->ID, 'media_items', $media_items);
                self::add_audit_entry($campaign->ID, 'media.types_rescanned', [
                    'updated' => $updated_count,
                ]);
                $total_updated += $updated_count;
                $campaigns_updated++;
            }
        }

        if ($total_updated > 0) {
            self::bump_cache_version();
        }

        return new WP_REST_Response([
            'message' => $total_updated > 0 ? 'Media types updated' : 'No changes needed',
            'campaigns_scanned' => count($campaigns),
            'campaigns_updated' => $campaigns_updated,
            'media_updated' => $total_updated,
        ], 200);
    }

    public static function delete_media($request) {
        $post_id = intval($request->get_param('id'));
        $media_id = sanitize_text_field($request->get_param('mediaId'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        if (empty($media_id)) {
            return new WP_Error('wpsg_invalid_media_id', 'mediaId is required', ['status' => 400]);
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        $media_items = is_array($media_items) ? $media_items : [];
        $before_count = count($media_items);
        $media_items = array_values(array_filter($media_items, function ($item) use ($media_id) {
            return ($item['id'] ?? '') !== $media_id;
        }));

        if (count($media_items) === $before_count) {
            return new WP_Error('wpsg_media_not_found', 'Media item not found', ['status' => 404]);
        }

        update_post_meta($post_id, 'media_items', $media_items);

        self::add_audit_entry($post_id, 'media.deleted', [
            'mediaId' => $media_id,
        ]);
        do_action('wpsg_media_removed', $post_id, ['mediaId' => $media_id]);
        self::bump_cache_version();

        return new WP_REST_Response(['message' => 'Media deleted'], 200);
    }

    public static function upload_media($request) {
        $files = $request->get_file_params();
        $entries = self::get_uploaded_file_entries($files);
        if (empty($entries)) {
            return new WP_Error('wpsg_missing_file', 'File is required', ['status' => 400]);
        }

        $force       = (bool) ($request->get_param('force') ?? false);
        $campaign_id = intval($request->get_param('campaign_id') ?? 0);

        $is_batch = count($entries) > 1 || isset($files['files']);
        $max_batch_upload_size = self::get_max_batch_upload_size();
        if ($is_batch && count($entries) > $max_batch_upload_size) {
            return new WP_Error(
                'wpsg_batch_limit_exceeded',
                sprintf('A maximum of %d files can be uploaded per batch.', $max_batch_upload_size),
                ['status' => 400]
            );
        }

        if (!$is_batch) {
            $upload   = self::upload_single_media_file($entries[0], $force);
            $filename = sanitize_file_name($entries[0]['name'] ?? '');
            if (is_wp_error($upload)) {
                if ($upload->get_error_code() === 'wpsg_duplicate_file') {
                    $data = $upload->get_error_data();
                    if ($campaign_id > 0) {
                        self::add_audit_entry($campaign_id, 'media.duplicate_rejected', [
                            'filename'    => $filename,
                            'existingId'  => $data['existing_id'],
                            'existingName' => $data['existing_name'] ?? '',
                        ], [
                            'severity'       => 'warning',
                            'summary'        => "Duplicate file rejected: {$filename}",
                            'resource_type'  => 'media',
                            'resource_label' => $filename,
                        ]);
                    }
                    return new WP_REST_Response([
                        'duplicate'          => true,
                        'existing_id'        => $data['existing_id'],
                        'existing_url'       => $data['existing_url'],
                        'existing_name'      => $data['existing_name'] ?? '',
                        'existing_campaigns' => $data['existing_campaigns'] ?? [],
                    ], 409);
                }
                if ($upload->get_error_code() === 'wpsg_near_duplicate_file') {
                    $data = $upload->get_error_data();
                    if ($campaign_id > 0) {
                        self::add_audit_entry($campaign_id, 'media.near_duplicate_detected', [
                            'filename'    => $filename,
                            'similarId'   => $data['similar_id'],
                            'similarName' => $data['similar_name'] ?? '',
                            'distance'    => $data['distance'],
                        ], [
                            'severity'       => 'warning',
                            'summary'        => "Near-duplicate detected: {$filename}",
                            'resource_type'  => 'media',
                            'resource_label' => $filename,
                        ]);
                    }
                    return new WP_REST_Response([
                        'near_duplicate'    => true,
                        'similar_id'        => $data['similar_id'],
                        'similar_url'       => $data['similar_url'],
                        'distance'          => $data['distance'],
                        'similar_name'      => $data['similar_name'] ?? '',
                        'similar_campaigns' => $data['similar_campaigns'] ?? [],
                    ], 409);
                }
                return $upload;
            }

            if ($force && $campaign_id > 0) {
                self::add_audit_entry($campaign_id, 'media.upload_forced', [
                    'filename' => $filename,
                ], [
                    'summary'        => "Duplicate check bypassed for: {$filename}",
                    'resource_type'  => 'media',
                    'resource_label' => $filename,
                ]);
            }

            return new WP_REST_Response($upload, 201);
        }

        $results      = [];
        $success_count = 0;
        $dup_count    = 0;
        $near_dup_count = 0;
        $forced_count = 0;

        foreach ($entries as $entry) {
            $upload   = self::upload_single_media_file($entry, $force);
            $filename = sanitize_file_name($entry['name'] ?? '');

            if (is_wp_error($upload)) {
                $result = [
                    'filename' => $filename,
                    'success'  => false,
                    'error'    => $upload->get_error_message(),
                ];
                if ($upload->get_error_code() === 'wpsg_duplicate_file') {
                    $data = $upload->get_error_data();
                    $result['duplicate']          = true;
                    $result['existing_id']        = $data['existing_id'];
                    $result['existing_url']       = $data['existing_url'];
                    $result['existing_name']      = $data['existing_name'] ?? '';
                    $result['existing_campaigns'] = $data['existing_campaigns'] ?? [];
                    $dup_count++;
                }
                if ($upload->get_error_code() === 'wpsg_near_duplicate_file') {
                    $data = $upload->get_error_data();
                    $result['near_duplicate']    = true;
                    $result['similar_id']        = $data['similar_id'];
                    $result['similar_url']       = $data['similar_url'];
                    $result['distance']          = $data['distance'];
                    $result['similar_name']      = $data['similar_name'] ?? '';
                    $result['similar_campaigns'] = $data['similar_campaigns'] ?? [];
                    $near_dup_count++;
                }
                $results[] = $result;
                continue;
            }

            if ($force) {
                $forced_count++;
            }
            $results[] = array_merge([
                'filename' => $filename,
                'success'  => true,
            ], $upload);
            $success_count++;
        }

        if ($campaign_id > 0) {
            if ($dup_count > 0) {
                self::add_audit_entry($campaign_id, 'media.duplicate_rejected', [
                    'count' => $dup_count,
                ], [
                    'severity'      => 'warning',
                    'summary'       => "{$dup_count} duplicate file" . ($dup_count === 1 ? '' : 's') . " rejected in batch upload",
                    'resource_type' => 'media',
                ]);
            }
            if ($near_dup_count > 0) {
                self::add_audit_entry($campaign_id, 'media.near_duplicate_detected', [
                    'count' => $near_dup_count,
                ], [
                    'severity'      => 'warning',
                    'summary'       => "{$near_dup_count} near-duplicate" . ($near_dup_count === 1 ? '' : 's') . " detected in batch upload",
                    'resource_type' => 'media',
                ]);
            }
            if ($force && $forced_count > 0) {
                self::add_audit_entry($campaign_id, 'media.upload_forced', [
                    'count' => $forced_count,
                ], [
                    'summary'       => "{$forced_count} file" . ($forced_count === 1 ? '' : 's') . " uploaded with duplicate check bypassed",
                    'resource_type' => 'media',
                ]);
            }
        }

        return new WP_REST_Response([
            'results'   => $results,
            'total'     => count($entries),
            'succeeded' => $success_count,
            'failed'    => count($entries) - $success_count,
        ], 201);
    }

    /**
     * List media items from the WordPress Media Library.
     * Returns image and video attachments that can be associated with campaigns.
     */
    public static function list_media_library($request) {
        $per_page = intval($request->get_param('per_page') ?? 50);
        $page = intval($request->get_param('page') ?? 1);
        $search = sanitize_text_field($request->get_param('search') ?? '');
        $sort = sanitize_text_field($request->get_param('sort') ?? 'created_desc');

        $sort_map = [
            'order_asc'    => ['orderby' => 'menu_order', 'order' => 'ASC'],
            'order_desc'   => ['orderby' => 'menu_order', 'order' => 'DESC'],
            'title_asc'    => ['orderby' => 'title',      'order' => 'ASC'],
            'title_desc'   => ['orderby' => 'title',      'order' => 'DESC'],
            'created_asc'  => ['orderby' => 'date',       'order' => 'ASC'],
            'created_desc' => ['orderby' => 'date',       'order' => 'DESC'],
            'size_asc'     => ['orderby' => 'meta_value_num', 'meta_key' => '_wp_attachment_metadata', 'order' => 'ASC'],
            'size_desc'    => ['orderby' => 'meta_value_num', 'meta_key' => '_wp_attachment_metadata', 'order' => 'DESC'],
        ];
        $sort_opts = $sort_map[$sort] ?? $sort_map['created_desc'];

        $args = [
            'post_type'      => 'attachment',
            'post_status'    => 'inherit',
            'posts_per_page' => min($per_page, 100),
            'paged'          => max($page, 1),
            'orderby'        => $sort_opts['orderby'],
            'order'          => $sort_opts['order'],
            'post_mime_type' => ['image', 'video'],
        ];
        if (isset($sort_opts['meta_key'])) {
            $args['meta_key'] = $sort_opts['meta_key'];
        }

        if (!empty($search)) {
            $args['s'] = $search;
        }

        $query = new WP_Query($args);
        $items = [];

        foreach ($query->posts as $post) {
            $mime = get_post_mime_type($post->ID);
            $type = 'other';
            if (strpos($mime, 'image') === 0) {
                $type = 'image';
            } elseif (strpos($mime, 'video') === 0) {
                $type = 'video';
            }

            $url = wp_get_attachment_url($post->ID);
            $thumbnail = null;
            if ($type === 'image') {
                $thumb = wp_get_attachment_image_src($post->ID, 'thumbnail');
                $thumbnail = $thumb ? $thumb[0] : null;
            } elseif ($type === 'video') {
                // Try to get video poster/thumbnail if WP generated one
                $poster_id = get_post_meta($post->ID, '_thumbnail_id', true);
                if ($poster_id) {
                    $poster_src = wp_get_attachment_image_src(intval($poster_id), 'medium');
                    $thumbnail = $poster_src ? $poster_src[0] : null;
                }
            }

            $items[] = [
                'id' => strval($post->ID),
                'type' => $type,
                'source' => 'upload',
                'url' => $url,
                'thumbnail' => $thumbnail,
                'caption' => $post->post_excerpt ?: $post->post_title,
                'filename' => basename(get_attached_file($post->ID)),
                'mimeType' => $mime,
                'dateCreated' => $post->post_date,
            ];
        }

        $payload = [
            'items' => $items,
            'total' => $query->found_posts,
            'pages' => $query->max_num_pages,
            'page' => $page,
        ];

        return self::respond_with_etag($request, $payload, 200, sprintf('%d:%d:%s:%s', $page, $per_page, $search, $sort));
    }

    private static function normalize_external_media($url) {
        if (empty($url)) {
            return new WP_Error('invalid_url', 'URL is required');
        }

        $parsed = wp_parse_url($url);
        if (empty($parsed['scheme']) || strtolower($parsed['scheme']) !== 'https') {
            return new WP_Error('invalid_url', 'URL must use HTTPS');
        }

        $host = strtolower($parsed['host'] ?? '');
        $path = $parsed['path'] ?? '';
        $query = $parsed['query'] ?? '';

        if (in_array($host, ['www.youtube.com', 'youtube.com', 'youtu.be'], true)) {
            if ($host === 'youtu.be') {
                $video_id = trim($path, '/');
            } else {
                parse_str($query, $params);
                $video_id = $params['v'] ?? '';
            }
            if (!$video_id) {
                return new WP_Error('invalid_url', 'Invalid YouTube URL');
            }
            if (!preg_match('/^[a-zA-Z0-9_-]{4,64}$/', $video_id)) {
                return new WP_Error('invalid_url', 'Invalid YouTube video ID format');
            }
            return [
                'provider' => 'youtube',
                'url' => $url,
                'embedUrl' => 'https://www.youtube.com/embed/' . esc_attr($video_id),
            ];
        }

        if ($host === 'vimeo.com' || $host === 'www.vimeo.com') {
            $video_id = trim($path, '/');
            if (!$video_id) {
                return new WP_Error('invalid_url', 'Invalid Vimeo URL');
            }
            if (!preg_match('/^[0-9]+$/', $video_id)) {
                return new WP_Error('invalid_url', 'Invalid Vimeo video ID format');
            }
            return [
                'provider' => 'vimeo',
                'url' => $url,
                'embedUrl' => 'https://player.vimeo.com/video/' . esc_attr($video_id),
            ];
        }

        if ($host === 'rumble.com' || $host === 'www.rumble.com') {
            $slug = trim($path, '/');
            // Rumble share URLs often end with .html — strip that before validating
            $slug = preg_replace('/\.html$/i', '', $slug);
            if (!$slug) {
                return new WP_Error('invalid_url', 'Invalid Rumble URL');
            }

            // The canonical Rumble video identifier is the first slug segment (e.g. "v72ksce" from "v72ksce-...")
            $parts = explode('-', $slug);
            $video_id = $parts[0] ?? $slug;
            if (!preg_match('/^v[0-9a-zA-Z]+$/i', $video_id)) {
                return new WP_Error('invalid_url', 'Invalid Rumble video ID format');
            }

            // Use the compact embed path that Rumble expects (video id only)
            $embed_url = 'https://rumble.com/embed/' . esc_attr($video_id) . '/';

            return [
                'provider' => 'rumble',
                'url' => $url,
                'embedUrl' => $embed_url,
            ];
        }

        if ($host === 'www.bitchute.com' || $host === 'bitchute.com') {
            $matches = [];
            if (!preg_match('#/video/([a-zA-Z0-9]+)/?#', $path, $matches)) {
                return new WP_Error('invalid_url', 'Invalid BitChute URL');
            }
            $video_id = $matches[1];
            if (!preg_match('/^[a-zA-Z0-9]+$/', $video_id)) {
                return new WP_Error('invalid_url', 'Invalid BitChute video ID format');
            }
            return [
                'provider' => 'bitchute',
                'url' => $url,
                'embedUrl' => 'https://www.bitchute.com/embed/' . esc_attr($video_id) . '/',
            ];
        }

        if ($host === 'odysee.com' || $host === 'www.odysee.com') {
            $matches = [];
            if (!preg_match('#/\$/embed/([^/]+)#', $path, $matches)) {
                $slug = trim($path, '/');
                $slug = preg_replace('#^@#', '', $slug);
                if (!$slug) {
                    return new WP_Error('invalid_url', 'Invalid Odysee URL');
                }
                $parts = explode('/', $slug);
                $embed_slug = end($parts);
            } else {
                $embed_slug = $matches[1];
            }
            if (!preg_match('/^[a-zA-Z0-9_:-]+$/', $embed_slug)) {
                return new WP_Error('invalid_url', 'Invalid Odysee video ID format');
            }
            return [
                'provider' => 'odysee',
                'url' => $url,
                'embedUrl' => 'https://odysee.com/$/embed/' . esc_attr($embed_slug),
            ];
        }

        return new WP_Error('invalid_url', 'Provider not supported');
    }

    // --- P14-C: Thumbnail cache endpoints ---

    public static function list_media_tags($request) {
        [$page, $per_page, $offset] = self::parse_pagination($request);

        $total = (int) wp_count_terms('wpsg_media_tag', ['hide_empty' => false]);

        $terms = get_terms([
            'taxonomy'   => 'wpsg_media_tag',
            'hide_empty' => false,
            'orderby'    => 'name',
            'order'      => 'ASC',
            'number'     => $per_page,
            'offset'     => $offset,
        ]);

        if (is_wp_error($terms)) {
            return self::paginated_response([], 0, $page, $per_page);
        }

        $items = array_map(function ($term) {
            return [
                'id'    => strval($term->term_id),
                'name'  => $term->name,
                'slug'  => $term->slug,
                'count' => $term->count,
            ];
        }, $terms);

        return self::paginated_response($items, $total, $page, $per_page);
    }

    // ── P28-C: Taxonomy CRUD Handlers ────────────────────────

    // ── P28-O: Campaign Templates ────────────────────────────────────────────

    public static function create_media_tag(WP_REST_Request $request) {
        return self::handle_term_insert(
            $request->get_param('name'),
            $request->get_param('slug'),
            'wpsg_media_tag',
        );
    }

    public static function delete_media_tag(WP_REST_Request $request) {
        return self::handle_term_delete($request->get_param('id'), 'wpsg_media_tag');
    }

    // ── P48-F: Media Library Binary Export / Import ────────────────────────────

    public static function export_media_library_binary($request) {
        if (!WPSG_Export_Engine::check_zip_available()) {
            return new WP_Error(
                'wpsg_missing_dependency',
                'ext-zip is required for binary export.',
                ['status' => 503]
            );
        }

        $campaign_id = intval($request->get_param('campaign_id') ?? 0);
        $mime_filter = sanitize_text_field($request->get_param('mime_type') ?? 'all');
        $search      = sanitize_text_field($request->get_param('search') ?? '');

        // Build WP_Query args for WP attachments.
        $query_args = [
            'post_type'      => 'attachment',
            'post_status'    => 'inherit',
            'posts_per_page' => 500,
            'paged'          => 1,
            'orderby'        => 'date',
            'order'          => 'DESC',
        ];

        if ($mime_filter === 'image') {
            $query_args['post_mime_type'] = 'image';
        } elseif ($mime_filter === 'video') {
            $query_args['post_mime_type'] = 'video';
        } else {
            $query_args['post_mime_type'] = ['image', 'video'];
        }

        if (!empty($search)) {
            $query_args['s'] = $search;
        }

        // When filtering by campaign, restrict to attachment IDs referenced by that campaign.
        if ($campaign_id > 0) {
            $media = get_post_meta($campaign_id, 'media_items', true) ?: [];
            $att_ids = array_values(array_filter(array_map(function ($item) {
                $id = intval($item['id'] ?? 0);
                return $id > 0 ? $id : null;
            }, (array) $media)));

            if (empty($att_ids)) {
                // Campaign exists but has no WP-attachment media — return empty export.
                $att_ids = [0]; // Forces WP_Query to return nothing.
            }
            $query_args['post__in'] = $att_ids;
        }

        $query = new WP_Query($query_args);
        $manifest_items = [];
        $media_items    = [];

        foreach ((array) $query->posts as $post) {
            $att_id   = $post->ID;
            $url      = wp_get_attachment_url($att_id);
            $mime     = get_post_mime_type($att_id) ?: '';
            $filename = basename(get_attached_file($att_id) ?: '');
            if (!$url || !$filename) {
                continue;
            }

            $engine_item = [
                'id'    => (string) $att_id,
                'url'   => $url,
                'title' => $post->post_title,
            ];

            $manifest_items[] = [
                'id'       => (string) $att_id,
                'filename' => WPSG_Export_Engine::get_media_filename($engine_item),
                'url'      => $url,
                'title'    => $post->post_title,
                'mimeType' => $mime,
            ];

            $media_items[] = $engine_item;
        }

        $filters_used = array_filter([
            'campaign_id' => $campaign_id > 0 ? $campaign_id : null,
            'mime_type'   => $mime_filter !== 'all' ? $mime_filter : null,
            'search'      => $search ?: null,
        ]);

        $manifest = wp_json_encode([
            'version'    => 1,
            'type'       => 'media_library',
            'exported_at' => gmdate('c'),
            'filters'    => $filters_used,
            'item_count' => count($manifest_items),
            'items'      => $manifest_items,
        ]);
        if ($manifest === false) {
            return new WP_Error('wpsg_encode_failed', 'Failed to encode export manifest.', ['status' => 500]);
        }

        $job_id = WPSG_Export_Engine::create_job('media_library', $manifest, $media_items);
        return new WP_REST_Response(['jobId' => $job_id, 'status' => 'pending'], 202);
    }

    public static function import_media_library_binary($request) {
        if (!WPSG_Export_Engine::check_zip_available()) {
            return new WP_Error(
                'wpsg_missing_dependency',
                'ext-zip is required for binary import.',
                ['status' => 503]
            );
        }

        $files = $request->get_file_params();
        if (empty($files['file'])) {
            return new WP_Error('wpsg_missing_file', 'No file uploaded (field: file)', ['status' => 400]);
        }

        $file = $files['file'];
        if (isset($file['error']) && $file['error'] !== UPLOAD_ERR_OK) {
            return new WP_Error('wpsg_upload_error', 'File upload failed', ['status' => 400]);
        }

        $zip = new ZipArchive();
        if ($zip->open($file['tmp_name']) !== true) {
            return new WP_Error('wpsg_invalid_zip', 'Could not open ZIP archive', ['status' => 400]);
        }

        $manifest_json = $zip->getFromName('manifest.json');
        if ($manifest_json === false) {
            $zip->close();
            return new WP_Error('wpsg_invalid_package', 'manifest.json not found in archive', ['status' => 400]);
        }

        $manifest = json_decode($manifest_json, true);
        if (!is_array($manifest) || ($manifest['type'] ?? '') !== 'media_library') {
            $zip->close();
            return new WP_Error('wpsg_invalid_manifest', 'Invalid or incompatible manifest', ['status' => 400]);
        }

        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $imported = [];
        $skipped  = [];

        foreach ((array) ($manifest['items'] ?? []) as $item) {
            $filename = sanitize_file_name($item['filename'] ?? '');
            if (!$filename) {
                continue;
            }

            $file_data = $zip->getFromName('media/' . $filename);
            if ($file_data === false) {
                $skipped[] = $filename;
                continue;
            }

            $tmp = wp_tempnam($filename);
            if ($tmp === false) {
                $skipped[] = $filename;
                continue;
            }
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
            file_put_contents($tmp, $file_data);
            unset($file_data);

            $file_array = ['name' => $filename, 'tmp_name' => $tmp];
            $att_id     = media_handle_sideload($file_array, 0, sanitize_text_field($item['title'] ?? ''));
            @unlink($tmp); // phpcs:ignore WordPress.PHP.NoSilencedErrors

            if (is_wp_error($att_id)) {
                $skipped[] = $filename;
                continue;
            }

            $imported[] = [
                'id'  => $att_id,
                'url' => wp_get_attachment_url($att_id),
            ];
        }

        $zip->close();

        return new WP_REST_Response([
            'imported' => $imported,
            'skipped'  => $skipped,
        ], 201);
    }

    // ── P15-B: Layout Template Handlers ──────────────────────

    /**
     * List all layout templates (admin).
     */
}
