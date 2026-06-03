<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * WPSG_Export_Engine — reusable background export job manager.
 *
 * Callers (campaign export, future: audit export, media library export) build
 * their own manifest JSON and media-item list, then hand them to create_job().
 * This class owns the packaging (ZIP) and delivery (job transient + download).
 */
class WPSG_Export_Engine {

    const JOB_PROCESS_HOOK = 'wpsg_export_process_job';
    const JOB_CLEANUP_HOOK = 'wpsg_export_cleanup';
    const SIZE_LIMIT_BYTES = 104857600; // 100 MB
    const JOB_TTL          = 86400;     // 24 h
    const JOB_INDEX_OPT    = 'wpsg_export_job_index';

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    public static function register(): void {
        add_action(self::JOB_PROCESS_HOOK, [self::class, 'process_job']);
        add_action(self::JOB_CLEANUP_HOOK, [self::class, 'cleanup_expired_jobs']);
        if (!wp_next_scheduled(self::JOB_CLEANUP_HOOK)) {
            wp_schedule_event(time(), 'hourly', self::JOB_CLEANUP_HOOK);
        }
    }

    // ── Job CRUD ──────────────────────────────────────────────────────────────

    /**
     * Create an export job and schedule it for background processing.
     *
     * @param string $type        Caller-defined type string (e.g. 'campaign').
     * @param string $manifest    JSON-encoded manifest to embed as manifest.json.
     * @param array  $media_items Array of {id, url, title} tuples to fetch.
     * @param int    $size_limit  Maximum total ZIP size in bytes.
     * @return string             Opaque job ID (32-char hex string).
     */
    public static function create_job(
        string $type,
        string $manifest,
        array $media_items,
        int $size_limit = self::SIZE_LIMIT_BYTES
    ): string {
        $id = bin2hex(random_bytes(16));

        $job = [
            'id'          => $id,
            'type'        => sanitize_key($type),
            'status'      => 'pending',
            'created_at'  => gmdate('c'),
            'manifest'    => $manifest,
            'media_items' => $media_items,
            'zip_path'    => '',
            'size_limit'  => $size_limit,
            'error'       => null,
        ];

        set_transient('wpsg_export_job_' . $id, $job, self::JOB_TTL);
        self::index_add($id);
        wp_schedule_single_event(time(), self::JOB_PROCESS_HOOK, [$id]);
        return $id;
    }

    public static function get_job(string $id): ?array {
        $job = get_transient('wpsg_export_job_' . $id);
        return is_array($job) ? $job : null;
    }

    /**
     * Reset a stuck job back to pending so process_job() will re-run it.
     * Safe to call on any status; no-ops if the job does not exist.
     */
    public static function reset_job(string $id): bool {
        $job = self::get_job($id);
        if (!$job) {
            return false;
        }
        $job['status'] = 'pending';
        $job['error']  = null;
        set_transient('wpsg_export_job_' . $id, $job, self::JOB_TTL);
        return true;
    }

    public static function delete_job(string $id): void {
        $job      = self::get_job($id);
        $zip_path = ($job && !empty($job['zip_path'])) ? $job['zip_path'] : self::expected_zip_path($id);
        if (file_exists($zip_path)) {
            @unlink($zip_path); // phpcs:ignore WordPress.PHP.NoSilencedErrors
        }
        delete_transient('wpsg_export_job_' . $id);
        self::index_remove($id);
    }

    // ── Background processor ──────────────────────────────────────────────────

    public static function process_job(string $id): void {
        $job = self::get_job($id);
        if (!$job || $job['status'] !== 'pending') {
            return;
        }

        $job['status'] = 'processing';
        set_transient('wpsg_export_job_' . $id, $job, self::JOB_TTL);

        try {
            $zip_path        = self::build_zip($id, $job['manifest'], $job['media_items'], $job['size_limit']);
            $job['status']   = 'complete';
            $job['zip_path'] = $zip_path;
            $job['error']    = null;
        } catch (\Throwable $e) {
            $job['status'] = 'failed';
            $job['error']  = $e->getMessage();
        }

        set_transient('wpsg_export_job_' . $id, $job, self::JOB_TTL);
    }

    // ── ZIP builder ───────────────────────────────────────────────────────────

    private static function build_zip(
        string $id,
        string $manifest_json,
        array $media_items,
        int $size_limit
    ): string {
        if (!self::check_zip_available()) {
            throw new RuntimeException('ext-zip is required for binary export.');
        }

        $upload_dir = wp_upload_dir();
        $export_dir = trailingslashit($upload_dir['basedir']) . 'wpsg-exports/';
        wp_mkdir_p($export_dir);

        $zip_path = $export_dir . 'wpsg-export-' . $id . '.zip';
        $zip      = new ZipArchive();

        if ($zip->open($zip_path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Could not create export archive.');
        }

        $zip->addFromString('manifest.json', $manifest_json);
        $accumulated = strlen($manifest_json);
        $tmp_files   = [];
        $skipped     = [];

        foreach ($media_items as $item) {
            $url = $item['url'] ?? '';
            if (!$url) {
                continue;
            }

            // HEAD check: bail early if projected size would overflow.
            $head = wp_safe_remote_head($url, ['timeout' => 10]);
            if (!is_wp_error($head)) {
                $cl = intval(wp_remote_retrieve_header($head, 'content-length'));
                if ($cl > 0 && ($accumulated + $cl) > $size_limit) {
                    $zip->close();
                    foreach ($tmp_files as $f) { @unlink($f); } // phpcs:ignore
                    @unlink($zip_path); // phpcs:ignore
                    throw new RuntimeException(
                        'Export would exceed the ' . round($size_limit / 1048576) . ' MB size limit.'
                    );
                }
            }

            $safe_name = self::get_media_filename($item);
            $tmp       = wp_tempnam($safe_name);
            if ($tmp === false) {
                $zip->close();
                foreach ($tmp_files as $f) { @unlink($f); } // phpcs:ignore
                @unlink($zip_path); // phpcs:ignore
                throw new RuntimeException('Could not create a temporary file for media export.');
            }

            // Stream the download directly to disk to avoid buffering the full
            // file body in PHP memory (important near the size limit).
            $response = wp_safe_remote_get($url, ['timeout' => 60, 'stream' => true, 'filename' => $tmp]);
            if (is_wp_error($response)) {
                @unlink($tmp); // phpcs:ignore
                $skipped[] = ['id' => $item['id'] ?? '', 'url' => $url, 'reason' => $response->get_error_message()];
                continue;
            }

            // phpcs:ignore WordPress.PHP.NoSilencedErrors
            $file_size = @filesize($tmp);
            if (!$file_size) {
                // Fallback: a pre_http_request filter (or certain HTTP transports) may
                // return an in-memory response without writing to the stream file.
                $body = wp_remote_retrieve_body($response);
                if (empty($body)) {
                    @unlink($tmp); // phpcs:ignore
                    continue;
                }
                // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
                file_put_contents($tmp, $body);
                unset($body);
                clearstatcache(true, $tmp); // Invalidate cached stat so filesize() reflects written bytes.
                $file_size = @filesize($tmp); // phpcs:ignore WordPress.PHP.NoSilencedErrors
                if (!$file_size) {
                    @unlink($tmp); // phpcs:ignore
                    continue;
                }
            }

            if (($accumulated + $file_size) > $size_limit) {
                @unlink($tmp); // phpcs:ignore
                $zip->close();
                foreach ($tmp_files as $f) { @unlink($f); } // phpcs:ignore
                @unlink($zip_path); // phpcs:ignore
                throw new RuntimeException(
                    'Export would exceed the ' . round($size_limit / 1048576) . ' MB size limit.'
                );
            }

            $tmp_files[] = $tmp;
            $zip->addFile($tmp, 'media/' . $safe_name);
            $accumulated += $file_size;
        }

        if (!empty($skipped)) {
            $zip->addFromString('skipped_media.json', wp_json_encode($skipped) ?: '[]');
        }
        $zip->close();
        foreach ($tmp_files as $f) {
            @unlink($f); // phpcs:ignore
        }

        return $zip_path;
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    public static function cleanup_expired_jobs(): void {
        foreach (self::index_get() as $id) {
            $job = self::get_job($id);
            if (!$job) {
                // Transient already expired — clean up any orphaned ZIP file.
                $zip_path = self::expected_zip_path($id);
                if (file_exists($zip_path)) {
                    @unlink($zip_path); // phpcs:ignore WordPress.PHP.NoSilencedErrors
                }
                self::index_remove($id);
                continue;
            }
            $age = time() - strtotime($job['created_at']);
            if ($age > self::JOB_TTL) {
                self::delete_job($id);
            }
        }
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    /**
     * Derive the deterministic filename used for a media item inside the ZIP.
     *
     * Both the manifest builder (REST layer) and the ZIP builder must use
     * this method so the filename in manifest.json matches the actual file
     * in media/.
     */
    public static function get_media_filename(array $item): string {
        $item_id = sanitize_key($item['id'] ?? '');
        $url     = $item['url'] ?? '';
        $path    = parse_url($url, PHP_URL_PATH) ?: '';
        $ext     = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        $base = $item_id ?: md5($url);
        return 'media-' . $base . ($ext ? '.' . $ext : '');
    }

    public static function check_zip_available(): bool {
        return class_exists('ZipArchive');
    }

    private static function expected_zip_path(string $id): string {
        $upload_dir = wp_upload_dir();
        return trailingslashit($upload_dir['basedir']) . 'wpsg-exports/wpsg-export-' . $id . '.zip';
    }

    // ── Job index ─────────────────────────────────────────────────────────────

    private static function index_get(): array {
        return (array) get_option(self::JOB_INDEX_OPT, []);
    }

    private static function index_add(string $id): void {
        $ids   = self::index_get();
        $ids[] = $id;
        update_option(self::JOB_INDEX_OPT, array_values(array_unique($ids)), false);
    }

    private static function index_remove(string $id): void {
        $ids = array_values(array_filter(self::index_get(), fn($i) => $i !== $id));
        update_option(self::JOB_INDEX_OPT, $ids, false);
    }
}
