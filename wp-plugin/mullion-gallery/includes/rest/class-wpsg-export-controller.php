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
                'permission_callback' => WPSG_Permissions::gate('campaigns.batch.export_binary'),
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
                'permission_callback' => WPSG_Permissions::gate('campaign.export'),
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/campaigns/import', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'import_campaign'],
                'permission_callback' => WPSG_Permissions::gate('campaigns.import'),
            ],
        ]);

        // P39-CM1: Binary export / import
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/export/binary', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'export_campaign_binary'],
                'permission_callback' => WPSG_Permissions::gate('campaign.export_binary'),
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/campaigns/import/binary', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'import_campaign_binary'],
                'permission_callback' => WPSG_Permissions::gate('campaigns.import_binary'),
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/export-jobs/(?P<job_id>[a-f0-9]{32})', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'get_export_job'],
                'permission_callback' => WPSG_Permissions::gate('export_jobs.read'),
            ],
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_export_job'],
                'permission_callback' => WPSG_Permissions::gate('export_jobs.delete'),
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/export-jobs/(?P<job_id>[a-f0-9]{32})/download', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'download_export_job'],
                'permission_callback' => WPSG_Permissions::gate('export_jobs.download'),
            ],
        ]);
    }

    public static function export_campaign($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        // P65-A: single source of truth for the export entry. build_entry()
        // fixes A-4 (layout template embedded via WPSG_Layout_Templates::get,
        // not the old get_post(intval($uuid)) that always yielded null).
        $entry    = WPSG_Campaign_IO::build_entry($post_id, false);
        $campaign = $entry['campaign'];

        $payload = [
            'version'          => 1,
            'exported_at'      => gmdate('c'),
            'campaign'         => $campaign,
            'layout_template'  => $entry['layout_template'],
            'media_references' => $entry['media_references'],
        ];

        self::add_audit_entry($post_id, 'campaign.exported', [
            'format'     => 'json',
            'mediaCount' => count($entry['media_references']),
        ], [
            'summary'        => 'Campaign exported as JSON (' . count($entry['media_references']) . ' media references)',
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

        // P65-A: thin wrapper over the shared import pipeline. JSON import is
        // URL-only (no ZIP), so media become `source: 'external'` references and
        // the layout template is created via WPSG_Layout_Templates::create()
        // (A-4 fix — previously this path built the wrong CPT by hand).
        $entry = [
            'campaign'         => $body['campaign'],
            'layout_template'  => $body['layout_template'] ?? null,
            'media_references' => $body['media_references'] ?? [],
        ];
        $result = WPSG_Campaign_IO::import_entry($entry, null, ['via' => 'rest', 'format' => 'json']);
        if (is_wp_error($result)) {
            return $result;
        }

        return new WP_REST_Response(self::format_campaign(get_post($result['id'])), 201);
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

        $media = get_post_meta($post_id, 'media_items', true) ?: [];

        // P65-A: build the v2 manifest from the shared export entry (version=2,
        // each media_reference carries a `filename`). The raw $media is still
        // needed below so the engine can zip the actual files.
        $entry    = WPSG_Campaign_IO::build_entry($post_id, true);
        $campaign = $entry['campaign'];

        $manifest = wp_json_encode([
            'version'          => 2,
            'exported_at'      => gmdate('c'),
            'campaign'         => $campaign,
            'layout_template'  => $entry['layout_template'],
            'media_references' => $entry['media_references'],
        ]);
        if ($manifest === false) {
            return new WP_Error('wpsg_encode_failed', 'Failed to encode export manifest.', ['status' => 500]);
        }

        // P63-I: stamp the campaign's space so read/download re-checks space access.
        $space_id = self::resolve_campaign_space_id($post_id);
        $job_id   = WPSG_Export_Engine::create_job(
            'campaign',
            $manifest,
            (array) $media,
            space_ids: $space_id > 0 ? [$space_id] : []
        );

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

        $campaigns_data      = [];
        $all_media_items     = [];
        $seen_urls           = [];
        $canonical_filenames = []; // url => filename actually written to the ZIP.
        $skipped_ids         = [];
        $space_ids           = []; // P63-I: contributing spaces for the read/download gate.

        foreach ($ids as $post_id) {
            if (!self::campaign_exists($post_id)) {
                $skipped_ids[] = $post_id;
                continue;
            }

            $space_id = self::resolve_campaign_space_id($post_id);
            if ($space_id > 0) {
                $space_ids[] = $space_id;
            }

            $media = (array) (get_post_meta($post_id, 'media_items', true) ?: []);

            // P65-A: each entry comes from the shared builder (fixes A-4 here too).
            $campaigns_data[] = WPSG_Campaign_IO::build_entry($post_id, true);

            // Deduplicate media items by URL across campaigns: the ZIP holds one
            // file per unique URL, written under the filename of whichever
            // campaign referenced it first.
            foreach ($media as $item) {
                $url = $item['url'] ?? '';
                if ($url && !isset($seen_urls[$url])) {
                    $seen_urls[$url]     = true;
                    $all_media_items[]   = $item;
                    $canonical_filenames[$url] = WPSG_Export_Engine::get_media_filename($item);
                }
            }
        }

        if (empty($campaigns_data)) {
            return new WP_Error('wpsg_not_found', 'No valid campaigns found for export.', ['status' => 404]);
        }

        // build_entry() derives each manifest filename from that campaign's own
        // item id, but a later campaign sharing a URL with an earlier one never
        // got its own file written to the archive (dedup above keeps only the
        // first). Rewrite every reference to the filename actually in the ZIP so
        // re-import doesn't silently drop media shared across campaigns.
        foreach ($campaigns_data as &$campaign_entry) {
            foreach ($campaign_entry['media_references'] as &$ref) {
                if (!empty($ref['filename']) && !empty($ref['url']) && isset($canonical_filenames[$ref['url']])) {
                    $ref['filename'] = $canonical_filenames[$ref['url']];
                }
            }
            unset($ref);
        }
        unset($campaign_entry);

        $manifest = wp_json_encode([
            'version'      => 3,
            'type'         => 'multi',
            'exported_at'  => gmdate('c'),
            'campaigns'    => $campaigns_data,
        ]);
        if ($manifest === false) {
            return new WP_Error('wpsg_encode_failed', 'Failed to encode export manifest.', ['status' => 500]);
        }

        // P63-I: stamp every contributing space; read/download requires access to
        // all of them (create_job dedups). Symmetric with the batch create gate.
        $job_id = WPSG_Export_Engine::create_job(
            'multi_campaign',
            $manifest,
            $all_media_items,
            space_ids: $space_ids
        );

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

    /**
     * P63-E: enforce the tier stamped on the job at creation time, plus (P63-E-2
     * follow-up) creator-ownership so a same-tier peer in a different campaign space
     * cannot pull a job they did not create.
     *
     * The permission_callback for the job endpoints (export_jobs.read/delete/download)
     * is the coarse `require_admin` floor (manage_wpsg). Two gates are re-applied here:
     *
     *   1. Tier — jobs created under a stricter gate (audit / media-library export →
     *      System Admin) stamp `required_tier`, which must be re-checked so a
     *      lower-tier user who obtains the job ID cannot pull content they could
     *      never have created. Missing tier (pre-P63-E jobs still in flight) defaults
     *      to the old floor, TIER_EDITOR.
     *
     *   2. Ownership — `require_admin` is a *global* capability (not space-scoped),
     *      so without this a manage_wpsg editor in one campaign space could
     *      read/download a `campaign` / `multi_campaign` export created by an editor
     *      in another space merely by holding the 32-hex job ID. A non-System-Admin
     *      actor may therefore only touch a job they created; System Admins retain
     *      access to any job (support / debugging) — and because System-Admin-gated
     *      jobs already require that tier at step 1, audit / media-library jobs stay
     *      reachable by any System Admin exactly as before. Enforced only when the
     *      creator id is known (> 0), so pre-stamp in-flight jobs and CLI-created jobs
     *      (no logged-in user → created_by 0) fall back to the tier-only check.
     *
     *   3. Space (P63-I) — for jobs stamped with the campaign space(s) their content
     *      was exported from, a non-System-Admin requesting editor must *currently*
     *      have access to **every** contributing space. This is symmetric with the
     *      `require_campaign_batch_space_access` create gate (any inaccessible space
     *      denies the whole aggregate — no cross-space read of a batch that mixes
     *      spaces the reader was never granted). System Admins are `owner` in every
     *      space and bypass. Jobs with no stamped space (audit / media-library /
     *      spaceless campaigns / legacy in-flight) skip this gate and rely on tier +
     *      ownership. Because the check is re-evaluated at read time, an editor whose
     *      grant to a contributing space was revoked after creating the job loses
     *      access to it — least-privilege, per Key Decision D ("all contributing
     *      spaces").
     *
     * @return true|WP_Error  true when authorized, WP_Error(403) otherwise.
     */
    private static function authorize_job_access(array $job) {
        $required = $job['required_tier'] ?? WPSG_Permissions::TIER_EDITOR;
        if (!WPSG_Permissions::actor_has_tier($required)) {
            return self::job_forbidden();
        }

        $is_system_admin = WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_SYSTEM_ADMIN);

        // Ownership gate (P63-E-2): a non-System-Admin may only access jobs they
        // created. Skipped when the creator is unknown (created_by 0) so in-flight
        // pre-stamp jobs and CLI-created jobs keep working under the tier-only check.
        $creator = (int) ($job['created_by'] ?? 0);
        if ($creator > 0 && $creator !== get_current_user_id() && !$is_system_admin) {
            return self::job_forbidden();
        }

        // Space gate (P63-I): the requesting editor must currently have access to
        // EVERY contributing space. System Admins bypass (owner everywhere); an empty
        // set (non-space / legacy jobs) skips the gate.
        $space_ids = $job['space_ids'] ?? [];
        if (!empty($space_ids) && !$is_system_admin) {
            $user_id = get_current_user_id();
            foreach ($space_ids as $space_id) {
                if (!self::can_access_space((int) $space_id, $user_id)) {
                    return self::job_forbidden();
                }
            }
        }

        return true;
    }

    /** P63-I: the single 403 an unauthorized job access returns. */
    private static function job_forbidden(): WP_Error {
        return new WP_Error(
            'wpsg_forbidden',
            'You do not have permission to access this export job.',
            ['status' => 403]
        );
    }

    // GET /export-jobs/{job_id} — poll job status.
    public static function get_export_job($request) {
        $job_id = sanitize_key($request->get_param('job_id'));
        $job    = WPSG_Export_Engine::get_job($job_id);

        if (!$job) {
            return new WP_Error('wpsg_not_found', 'Export job not found', ['status' => 404]);
        }

        $authorized = self::authorize_job_access($job);
        if (is_wp_error($authorized)) {
            return $authorized;
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

        $authorized = self::authorize_job_access($job);
        if (is_wp_error($authorized)) {
            return $authorized;
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

        $authorized = self::authorize_job_access($job);
        if (is_wp_error($authorized)) {
            return $authorized;
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
            // P65-A: shared import pipeline (streamed ZIP reads, MD5 dedup,
            // attachmentId stamping — previously divergent across transports).
            $result = WPSG_Campaign_IO::import_entry($entry, $zip, ['via' => 'rest', 'format' => 'binary']);
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
                $result = WPSG_Campaign_IO::import_entry($entry, $zip, ['via' => 'rest', 'format' => 'binary']);
                if (!is_wp_error($result)) {
                    $created[] = ['id' => $result['id'], 'title' => $result['title']];
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

}
