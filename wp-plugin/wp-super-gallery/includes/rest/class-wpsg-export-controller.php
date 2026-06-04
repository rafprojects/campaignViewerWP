<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Export_Controller extends WPSG_REST_Base {

    public static function register_routes(): void {
        // P41-EX3: Bulk binary export — specific route before parameterised /{id}/ siblings.
        register_rest_route('wp-super-gallery/v1', '/campaigns/batch/export/binary', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'batch_export_binary'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'ids' => [
                        'required'  => true,
                        'type'      => 'array',
                        'items'     => ['type' => 'integer'],
                        'minItems'  => 1,
                        'maxItems'  => 50,
                    ],
                ],
            ],
        ]);

        // P18-D: Export / Import
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/export', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'export_campaign'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/campaigns/import', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'import_campaign'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P39-CM1: Binary export / import
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/export/binary', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'export_campaign_binary'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/campaigns/import/binary', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'import_campaign_binary'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/export-jobs/(?P<job_id>[a-f0-9]{32})', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'get_export_job'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_export_job'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/export-jobs/(?P<job_id>[a-f0-9]{32})/download', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'download_export_job'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
    }

    public static function export_campaign($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $post      = get_post($post_id);
        $campaign  = self::format_campaign($post);
        $media     = get_post_meta($post_id, 'media_items', true) ?: [];

        // Embed layout template by value so export is self-contained.
        $template_id  = get_post_meta($post_id, '_wpsg_layout_binding_template_id', true);
        $layout_template = null;
        if ($template_id) {
            $tmpl = get_post(intval($template_id));
            if ($tmpl) {
                $layout_template = [
                    'id'          => (string) $tmpl->ID,
                    'title'       => $tmpl->post_title,
                    'slots'       => get_post_meta($tmpl->ID, 'slots', true) ?: [],
                    'background'  => get_post_meta($tmpl->ID, 'background', true) ?: [],
                    'graphicLayers' => get_post_meta($tmpl->ID, 'graphic_layers', true) ?: [],
                ];
            }
        }

        $payload = [
            'version'          => 1,
            'exported_at'      => gmdate('c'),
            'campaign'         => $campaign,
            'layout_template'  => $layout_template,
            'media_references' => array_values(array_map(function ($item) {
                return ['id' => $item['id'] ?? '', 'url' => $item['url'] ?? '', 'title' => $item['title'] ?? ''];
            }, $media)),
        ];

        self::add_audit_entry($post_id, 'campaign.exported', [
            'format'     => 'json',
            'mediaCount' => count($media),
        ], [
            'summary'        => 'Campaign exported as JSON (' . count($media) . ' media references)',
            'resource_type'  => 'campaign',
            'resource_id'    => (string) $post_id,
            'resource_label' => $campaign['title'] ?? '',
        ]);

        $response = new WP_REST_Response($payload, 200);
        $response->header('Content-Disposition', 'attachment; filename="campaign-' . $post_id . '.json"');
        return $response;
    }

    // P18-D: Import a campaign from a JSON export payload.
    public static function import_campaign($request) {
        $body    = $request->get_json_params();

        if (empty($body) || !isset($body['campaign'])) {
            return new WP_Error('wpsg_invalid_payload', 'Invalid payload: missing campaign key', ['status' => 400]);
        }
        $version = intval($body['version'] ?? 0);
        if ($version !== 1) {
            return new WP_Error('wpsg_unsupported_version', 'Unsupported export version', ['status' => 400]);
        }

        $src = $body['campaign'];
        $title = sanitize_text_field($src['title'] ?? 'Imported Campaign');
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

        // Copy scalar meta fields; always import as draft.
        $meta_map = [
            'visibility'   => 'visibility',
            'tags'         => 'tags',
            'coverImage'   => 'cover_image',
            'publishAt'    => 'publish_at',
            'unpublishAt'  => 'unpublish_at',
        ];
        update_post_meta($post_id, 'status', 'draft');
        foreach ($meta_map as $src_key => $meta_key) {
            if (!empty($src[$src_key])) {
                if ($src_key === 'tags' && is_array($src[$src_key])) {
                    update_post_meta($post_id, $meta_key, array_values(array_map('sanitize_text_field', $src[$src_key])));
                } else {
                    update_post_meta($post_id, $meta_key, sanitize_text_field($src[$src_key]));
                }
            }
        }

        $gallery_overrides = self::promote_campaign_gallery_overrides($src['galleryOverrides'] ?? null);
        if (!empty($gallery_overrides)) {
            update_post_meta($post_id, '_wpsg_gallery_overrides', wp_json_encode($gallery_overrides));
        }

        // Embed layout binding by value if provided.
        $layout_template = $body['layout_template'] ?? null;
        if ($layout_template && is_array($layout_template)) {
            // Route through the same sanitization pipeline used by template
            // create/update so imported payloads receive identical validation.
            $sanitized = WPSG_Layout_Templates::sanitize_template_data($layout_template);

            $tmpl_id = wp_insert_post([
                'post_title'  => sanitize_text_field($layout_template['title'] ?? 'Imported Template'),
                'post_type'   => 'wpsg_layout_template',
                'post_status' => 'publish',
            ]);
            if (!is_wp_error($tmpl_id)) {
                update_post_meta($tmpl_id, 'slots', $sanitized['slots']);
                update_post_meta($tmpl_id, 'background', [
                    'backgroundMode'              => $sanitized['backgroundMode'],
                    'backgroundColor'             => $sanitized['backgroundColor'],
                    'backgroundGradientDirection'  => $sanitized['backgroundGradientDirection'],
                    'backgroundGradientStops'     => $sanitized['backgroundGradientStops'],
                    'backgroundGradientType'      => $sanitized['backgroundGradientType'],
                    'backgroundGradientAngle'     => $sanitized['backgroundGradientAngle'],
                    'backgroundRadialShape'       => $sanitized['backgroundRadialShape'],
                    'backgroundRadialSize'        => $sanitized['backgroundRadialSize'],
                    'backgroundGradientCenterX'   => $sanitized['backgroundGradientCenterX'],
                    'backgroundGradientCenterY'   => $sanitized['backgroundGradientCenterY'],
                    'backgroundImage'             => $sanitized['backgroundImage'],
                    'backgroundImageFit'          => $sanitized['backgroundImageFit'],
                    'backgroundImageOpacity'      => $sanitized['backgroundImageOpacity'],
                ]);
                update_post_meta($tmpl_id, 'graphic_layers', $sanitized['overlays']);
                update_post_meta($post_id, '_wpsg_layout_binding_template_id', (string) $tmpl_id);
                if (!empty($src['layoutBinding'])) {
                    // Sanitize layout binding the same way as apply_campaign_meta.
                    $binding = $src['layoutBinding'];
                    if (is_array($binding)) {
                        array_walk_recursive($binding, function (&$v) {
                            if (is_string($v)) {
                                $v = sanitize_text_field($v);
                            }
                        });
                    }
                    update_post_meta($post_id, '_wpsg_layout_binding', $binding);
                }
            }
        }

        // Import media references (URL-only, no binary transfer).
        $media_refs = $body['media_references'] ?? [];
        if (is_array($media_refs) && !empty($media_refs)) {
            $media_items = array_values(array_map(function ($ref) {
                return [
                    'id'    => sanitize_text_field($ref['id'] ?? wp_generate_uuid4()),
                    'url'   => esc_url_raw($ref['url'] ?? ''),
                    'title' => sanitize_text_field($ref['title'] ?? ''),
                    'type'  => 'image',
                    'source' => 'url',
                    'order' => 0,
                ];
            }, $media_refs));
            update_post_meta($post_id, 'media_items', $media_items);
        }

        self::add_audit_entry($post_id, 'campaign.imported', [
            'source_title'  => $title,
            'format'        => 'json',
            'mediaRefCount' => count($media_refs),
        ], [
            'summary'        => "Campaign imported from JSON: {$title}",
            'resource_type'  => 'campaign',
            'resource_id'    => (string) $post_id,
            'resource_label' => $title,
        ]);
        self::clear_accessible_campaigns_cache();
        $new_post = get_post($post_id);
        return new WP_REST_Response(self::format_campaign($new_post), 201);
    }

    // ─────────────────────────────────────────────────────────────────────
    // P39-CM1: Binary export / import
    // ─────────────────────────────────────────────────────────────────────

    // POST /campaigns/{id}/export/binary — enqueue a background ZIP export job.
    public static function export_campaign_binary($request) {
        if (!WPSG_Export_Engine::check_zip_available()) {
            return new WP_Error(
                'wpsg_missing_dependency',
                'ext-zip is required for binary export.',
                ['status' => 500]
            );
        }

        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $post     = get_post($post_id);
        $campaign = self::format_campaign($post);
        $media    = get_post_meta($post_id, 'media_items', true) ?: [];

        $template_id     = get_post_meta($post_id, '_wpsg_layout_binding_template_id', true);
        $layout_template = $template_id ? WPSG_Layout_Templates::get($template_id) : null;

        // Build v2 manifest — same as v1 but version=2 and each media_reference
        // carries a `filename` matching the file the engine will write to media/.
        $media_references = array_values(array_map(function ($item) {
            return [
                'id'       => $item['id'] ?? '',
                'url'      => $item['url'] ?? '',
                'title'    => $item['title'] ?? '',
                'filename' => WPSG_Export_Engine::get_media_filename($item),
            ];
        }, (array) $media));

        $manifest = wp_json_encode([
            'version'          => 2,
            'exported_at'      => gmdate('c'),
            'campaign'         => $campaign,
            'layout_template'  => $layout_template,
            'media_references' => $media_references,
        ]);
        if ($manifest === false) {
            return new WP_Error('wpsg_encode_failed', 'Failed to encode export manifest.', ['status' => 500]);
        }

        $job_id = WPSG_Export_Engine::create_job('campaign', $manifest, (array) $media);

        self::add_audit_entry($post_id, 'campaign.exported', [
            'format'     => 'binary',
            'mediaCount' => count($media),
            'jobId'      => $job_id,
        ], [
            'summary'       => 'Binary ZIP export enqueued (' . count($media) . ' media files)',
            'resource_type' => 'campaign',
            'resource_id'   => (string) $post_id,
            'resource_label' => $campaign['title'] ?? '',
        ]);

        return new WP_REST_Response(['jobId' => $job_id, 'status' => 'pending'], 202);
    }

    // POST /campaigns/batch/export/binary — P41-EX3: multi-campaign ZIP.
    public static function batch_export_binary($request) {
        if (!WPSG_Export_Engine::check_zip_available()) {
            return new WP_Error(
                'wpsg_missing_dependency',
                'ext-zip is required for binary export.',
                ['status' => 500]
            );
        }

        $ids = array_map('intval', (array) $request->get_param('ids'));

        $campaigns_data  = [];
        $all_media_items = [];
        $seen_urls       = [];
        $skipped_ids     = [];

        foreach ($ids as $post_id) {
            if (!self::campaign_exists($post_id)) {
                $skipped_ids[] = $post_id;
                continue;
            }

            $post     = get_post($post_id);
            $campaign = self::format_campaign($post);
            $media    = (array) (get_post_meta($post_id, 'media_items', true) ?: []);

            $template_id     = get_post_meta($post_id, '_wpsg_layout_binding_template_id', true);
            $layout_template = $template_id ? WPSG_Layout_Templates::get($template_id) : null;

            $media_references = array_values(array_map(function ($item) {
                return [
                    'id'       => $item['id'] ?? '',
                    'url'      => $item['url'] ?? '',
                    'title'    => $item['title'] ?? '',
                    'filename' => WPSG_Export_Engine::get_media_filename($item),
                ];
            }, $media));

            $campaigns_data[] = [
                'campaign'         => $campaign,
                'layout_template'  => $layout_template,
                'media_references' => $media_references,
            ];

            // Deduplicate media items by URL across campaigns.
            foreach ($media as $item) {
                $url = $item['url'] ?? '';
                if ($url && !isset($seen_urls[$url])) {
                    $seen_urls[$url]   = true;
                    $all_media_items[] = $item;
                }
            }
        }

        if (empty($campaigns_data)) {
            return new WP_Error('wpsg_not_found', 'No valid campaigns found for export.', ['status' => 404]);
        }

        $manifest = wp_json_encode([
            'version'      => 3,
            'type'         => 'multi',
            'exported_at'  => gmdate('c'),
            'campaigns'    => $campaigns_data,
        ]);
        if ($manifest === false) {
            return new WP_Error('wpsg_encode_failed', 'Failed to encode export manifest.', ['status' => 500]);
        }

        $job_id = WPSG_Export_Engine::create_job('multi_campaign', $manifest, $all_media_items);

        self::add_audit_entry(0, 'campaign.batch_exported', [
            'format'       => 'binary',
            'campaignIds'  => array_map('intval', $ids),
            'skippedIds'   => $skipped_ids,
            'mediaCount'   => count($all_media_items),
            'jobId'        => $job_id,
        ], [
            'scope'         => 'system',
            'summary'       => 'Bulk ZIP export enqueued (' . count($campaigns_data) . ' campaigns, ' . count($all_media_items) . ' media files)',
            'resource_type' => 'campaign',
        ]);

        return new WP_REST_Response(['jobId' => $job_id, 'status' => 'pending'], 202);
    }

    // GET /export-jobs/{job_id} — poll job status.
    public static function get_export_job($request) {
        $job_id = sanitize_key($request->get_param('job_id'));
        $job    = WPSG_Export_Engine::get_job($job_id);

        if (!$job) {
            return new WP_Error('wpsg_not_found', 'Export job not found', ['status' => 404]);
        }

        $payload = [
            'jobId'      => $job['id'],
            'type'       => $job['type'],
            'status'     => $job['status'],
            'createdAt'  => $job['created_at'],
            'error'      => $job['error'],
        ];

        if ($job['status'] === 'complete') {
            $payload['downloadUrl'] = rest_url('wp-super-gallery/v1/export-jobs/' . $job_id . '/download');
        }

        return new WP_REST_Response($payload, 200);
    }

    // DELETE /export-jobs/{job_id} — cancel / discard a job.
    public static function delete_export_job($request) {
        $job_id = sanitize_key($request->get_param('job_id'));
        $job    = WPSG_Export_Engine::get_job($job_id);

        if (!$job) {
            return new WP_Error('wpsg_not_found', 'Export job not found', ['status' => 404]);
        }

        WPSG_Export_Engine::delete_job($job_id);
        return new WP_REST_Response(['deleted' => true], 200);
    }

    // GET /export-jobs/{job_id}/download — stream the ZIP file.
    public static function download_export_job($request) {
        $job_id = sanitize_key($request->get_param('job_id'));
        $job    = WPSG_Export_Engine::get_job($job_id);

        if (!$job) {
            return new WP_Error('wpsg_not_found', 'Export job not found', ['status' => 404]);
        }

        if ($job['status'] !== 'complete') {
            return new WP_Error(
                'wpsg_not_ready',
                'Export is not complete (status: ' . esc_html($job['status']) . ')',
                ['status' => 409]
            );
        }

        $zip_path = $job['zip_path'];
        if (!$zip_path || !file_exists($zip_path)) {
            return new WP_Error('wpsg_file_missing', 'Export file not found', ['status' => 404]);
        }

        $filename = basename($zip_path);
        // phpcs:disable WordPress.Security.EscapeOutput.OutputNotEscaped
        while (ob_get_level()) {
            ob_end_clean();
        }
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($zip_path));
        header('Cache-Control: no-store');
        readfile($zip_path); // phpcs:ignore WordPress.WP.AlternativeFunctions
        // phpcs:enable
        exit;
    }

    // POST /campaigns/import/binary — accept a ZIP upload and import its campaign.
    public static function import_campaign_binary($request) {
        if (!WPSG_Export_Engine::check_zip_available()) {
            return new WP_Error(
                'wpsg_missing_dependency',
                'ext-zip is required for binary import.',
                ['status' => 500]
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

        $body = json_decode($manifest_json, true);
        if (!is_array($body)) {
            $zip->close();
            return new WP_Error('wpsg_invalid_manifest', 'Invalid manifest structure', ['status' => 400]);
        }

        $version = intval($body['version'] ?? 0);

        if ($version === 2) {
            if (!isset($body['campaign'])) {
                $zip->close();
                return new WP_Error('wpsg_invalid_manifest', 'Invalid manifest structure', ['status' => 400]);
            }
            $entry = [
                'campaign'         => $body['campaign'],
                'layout_template'  => $body['layout_template'] ?? null,
                'media_references' => $body['media_references'] ?? [],
            ];
            $result = self::import_single_campaign_from_zip($zip, $entry);
            $zip->close();
            if (is_wp_error($result)) {
                return $result;
            }
            return new WP_REST_Response(self::format_campaign(get_post($result['id'])), 201);

        } elseif ($version === 3 && ($body['type'] ?? '') === 'multi') {
            if (!isset($body['campaigns']) || !is_array($body['campaigns'])) {
                $zip->close();
                return new WP_Error('wpsg_invalid_manifest', 'Invalid v3 manifest structure', ['status' => 400]);
            }
            $created = [];
            foreach ($body['campaigns'] as $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                $result = self::import_single_campaign_from_zip($zip, $entry);
                if (!is_wp_error($result)) {
                    $created[] = $result;
                }
            }
            $zip->close();
            if (empty($created)) {
                return new WP_Error('wpsg_import_failed', 'No campaigns could be imported from the archive.', ['status' => 422]);
            }
            self::add_audit_entry(0, 'campaign.batch_imported', [
                'format'   => 'binary',
                'imported' => count($created),
            ], [
                'summary'        => count($created) . ' campaigns imported from bulk ZIP',
                'resource_type'  => 'campaign',
                'resource_id'    => '0',
                'resource_label' => 'bulk import',
            ]);
            self::clear_accessible_campaigns_cache();
            return new WP_REST_Response(['imported' => $created], 201);

        } else {
            $zip->close();
            return new WP_Error(
                'wpsg_unsupported_version',
                'Binary import requires manifest version 2 or a v3 multi-campaign archive.',
                ['status' => 400]
            );
        }
    }

    /**
     * Sideload one campaign entry from an open ZipArchive.
     *
     * @param ZipArchive $zip   Open archive to read media from.
     * @param array      $entry Manifest entry: { campaign, layout_template?, media_references[] }.
     * @return array|WP_Error   ['id' => int, 'title' => string] on success.
     */
    private static function import_single_campaign_from_zip(ZipArchive $zip, array $entry) {
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

        $meta_map = [
            'visibility'  => 'visibility',
            'tags'        => 'tags',
            'coverImage'  => 'cover_image',
            'publishAt'   => 'publish_at',
            'unpublishAt' => 'unpublish_at',
        ];
        update_post_meta($post_id, 'status', 'draft');
        foreach ($meta_map as $src_key => $meta_key) {
            if (!empty($src[$src_key])) {
                if ($src_key === 'tags' && is_array($src[$src_key])) {
                    update_post_meta($post_id, $meta_key, array_values(array_map('sanitize_text_field', $src[$src_key])));
                } else {
                    update_post_meta($post_id, $meta_key, sanitize_text_field($src[$src_key]));
                }
            }
        }

        $gallery_overrides = self::promote_campaign_gallery_overrides($src['galleryOverrides'] ?? null);
        if (!empty($gallery_overrides)) {
            update_post_meta($post_id, '_wpsg_gallery_overrides', wp_json_encode($gallery_overrides));
        }

        $layout_template = is_array($entry['layout_template'] ?? null) ? $entry['layout_template'] : null;
        if ($layout_template) {
            // Support legacy manifests that used 'title' instead of 'name'.
            if (!isset($layout_template['name']) && isset($layout_template['title'])) {
                $layout_template['name'] = $layout_template['title'];
            }
            $created_tpl = WPSG_Layout_Templates::create($layout_template);
            if (!is_wp_error($created_tpl)) {
                update_post_meta($post_id, '_wpsg_layout_binding_template_id', $created_tpl['id']);
                if (!empty($src['layoutBinding'])) {
                    $binding = $src['layoutBinding'];
                    if (is_array($binding)) {
                        array_walk_recursive($binding, function (&$v) {
                            if (is_string($v)) { $v = sanitize_text_field($v); }
                        });
                        $binding['templateId'] = $created_tpl['id'];
                    }
                    update_post_meta($post_id, '_wpsg_layout_binding', $binding);
                }
            }
        }

        // Sideload media from the ZIP — SSRF-safe: we read from the archive,
        // never from the URLs in the manifest.
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $media_items = [];
        foreach ((array) ($entry['media_references'] ?? []) as $ref) {
            $filename = sanitize_file_name($ref['filename'] ?? '');
            if (!$filename) {
                continue;
            }

            $file_data = $zip->getFromName('media/' . $filename);
            if ($file_data === false) {
                continue;
            }

            // Reuse an existing attachment when the file bytes are identical.
            $md5         = md5($file_data);
            $existing_id = self::find_attachment_by_md5($md5);
            if ($existing_id > 0) {
                $existing_url = wp_get_attachment_url($existing_id);
                if ($existing_url) {
                    $media_items[] = [
                        'id'     => (string) $existing_id,
                        'url'    => $existing_url,
                        'title'  => sanitize_text_field($ref['title'] ?? ''),
                        'type'   => 'image',
                        'source' => 'upload',
                        'order'  => 0,
                    ];
                    continue;
                }
            }

            $tmp = wp_tempnam($filename);
            if ($tmp === false) {
                continue;
            }
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
            file_put_contents($tmp, $file_data);
            unset($file_data);

            $file_array = ['name' => $filename, 'tmp_name' => $tmp];
            $att_id     = media_handle_sideload($file_array, $post_id, sanitize_text_field($ref['title'] ?? ''));
            @unlink($tmp); // phpcs:ignore WordPress.PHP.NoSilencedErrors

            if (is_wp_error($att_id)) {
                continue;
            }

            update_post_meta($att_id, '_wpsg_file_md5', $md5);

            $media_items[] = [
                'id'     => (string) $att_id,
                'url'    => wp_get_attachment_url($att_id),
                'title'  => sanitize_text_field($ref['title'] ?? ''),
                'type'   => 'image',
                'source' => 'upload',
                'order'  => 0,
            ];
        }

        if (!empty($media_items)) {
            update_post_meta($post_id, 'media_items', $media_items);
        }

        self::add_audit_entry($post_id, 'campaign.imported', [
            'source_title' => $title,
            'format'       => 'binary',
            'mediaCount'   => count($media_items),
        ], [
            'summary'        => "Campaign imported from binary ZIP: {$title}",
            'resource_type'  => 'campaign',
            'resource_id'    => (string) $post_id,
            'resource_label' => $title,
        ]);
        self::clear_accessible_campaigns_cache();

        return ['id' => $post_id, 'title' => $title];
    }

    // ─────────────────────────────────────────────────────────────────────
    // P18-F: Analytics
    // ─────────────────────────────────────────────────────────────────────

    /**
     * POST /analytics/event
     * Public endpoint (rate-limited). Accepts { campaign_id, event_type }.
     * Requires `enable_analytics` setting to be truthy.
     */
}
