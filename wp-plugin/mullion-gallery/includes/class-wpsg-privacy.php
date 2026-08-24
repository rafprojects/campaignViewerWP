<?php
/**
 * WP Super Gallery — WordPress core privacy integration (P72-B).
 *
 * Registers personal-data exporters/erasers so a site admin can fulfil DSAR
 * (data-subject access / erasure) requests through the core WordPress tools at
 * Tools → Export/Erase Personal Data, instead of the manual SQL/WP-CLI process
 * previously documented in PRIVACY.md §5.
 *
 * Two PII tables are covered, with a deliberate asymmetry:
 *   - wp_wpsg_access_requests (visitor emails): full DSAR support — an exporter
 *     AND an eraser, both keyed on the email address.
 *   - wp_wpsg_audit_log (staff usernames / attempted logins): EXPORT ONLY. An
 *     audit/accountability log is a legitimate-interest record (GDPR Art.
 *     6(1)(f), with Art. 17(3)(b) as the erasure exemption) — its purpose is to
 *     show who did what, so a self-service erasure request (reachable only when
 *     the requester's email matches their own actor_login) must NOT be able to
 *     remove the record of their own privileged actions. There is intentionally
 *     no audit-log eraser; time-boxed retention (P72-F) bounds it instead.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Privacy {

    /** Rows exported per page (WP core pages exporters until done === true). */
    const PAGE_SIZE = 100;

    /**
     * Hook the exporter/eraser registration filters.
     */
    public static function register(): void {
        add_filter('wp_privacy_personal_data_exporters', [self::class, 'register_exporters']);
        add_filter('wp_privacy_personal_data_erasers', [self::class, 'register_erasers']);
    }

    /**
     * @param array $exporters WP core exporter registry.
     * @return array
     */
    public static function register_exporters($exporters) {
        $exporters['wpsg-access-requests'] = [
            'exporter_friendly_name' => __('WP Super Gallery — Access Requests', 'wp-super-gallery'),
            'callback'               => [self::class, 'export_access_requests'],
        ];
        // Export-only for the audit log (see class docblock). No eraser below.
        $exporters['wpsg-audit-log'] = [
            'exporter_friendly_name' => __('WP Super Gallery — Audit Log', 'wp-super-gallery'),
            'callback'               => [self::class, 'export_audit_log'],
        ];
        return $exporters;
    }

    /**
     * @param array $erasers WP core eraser registry.
     * @return array
     */
    public static function register_erasers($erasers) {
        // Access-request rows (visitor emails) are fully erasable. The audit log
        // is deliberately absent — it is export-only (legitimate-interest record).
        $erasers['wpsg-access-requests'] = [
            'eraser_friendly_name' => __('WP Super Gallery — Access Requests', 'wp-super-gallery'),
            'callback'             => [self::class, 'erase_access_requests'],
        ];
        return $erasers;
    }

    // ── Access requests (email) — export + erase ────────────────────────────

    /**
     * Exporter callback: the visitor's gallery access-request records.
     *
     * @param string $email_address
     * @param int    $page
     * @return array{data: array, done: bool}
     */
    public static function export_access_requests($email_address, $page = 1) {
        if (!class_exists('WPSG_DB')) {
            return ['data' => [], 'done' => true];
        }

        $page   = max(1, (int) $page);
        $offset = ($page - 1) * self::PAGE_SIZE;
        $rows   = WPSG_DB::get_access_requests_by_email((string) $email_address, self::PAGE_SIZE, $offset);

        $items = [];
        foreach ($rows as $row) {
            $items[] = [
                'group_id'          => 'wpsg-access-requests',
                'group_label'       => __('WP Super Gallery — Access Requests', 'wp-super-gallery'),
                'group_description' => __('Gallery access requests submitted with this email address.', 'wp-super-gallery'),
                'item_id'           => 'wpsg-access-request-' . $row['id'],
                'data'              => [
                    ['name' => __('Email', 'wp-super-gallery'),        'value' => $row['email']],
                    ['name' => __('Campaign ID', 'wp-super-gallery'),  'value' => $row['campaign_id']],
                    ['name' => __('Status', 'wp-super-gallery'),       'value' => $row['status']],
                    ['name' => __('Requested at', 'wp-super-gallery'), 'value' => $row['requested_at']],
                    ['name' => __('Resolved at', 'wp-super-gallery'),  'value' => $row['resolved_at'] ?? ''],
                ],
            ];
        }

        return [
            'data' => $items,
            'done' => count($rows) < self::PAGE_SIZE,
        ];
    }

    /**
     * Eraser callback: delete every access-request row for the email address.
     *
     * @param string $email_address
     * @param int    $page
     * @return array{items_removed: bool, items_retained: bool, messages: array, done: bool}
     */
    public static function erase_access_requests($email_address, $page = 1) {
        $removed = 0;
        if (class_exists('WPSG_DB')) {
            $removed = WPSG_DB::delete_access_requests_by_email((string) $email_address);
        }

        return [
            'items_removed'  => $removed > 0,
            'items_retained' => false,
            'messages'       => [],
            // A single DELETE clears every matching row, so we are always done.
            'done'           => true,
        ];
    }

    // ── Audit log (staff) — export only ─────────────────────────────────────

    /**
     * Exporter callback: audit-log entries attributable to the user who owns
     * this email address. Returns nothing if the email maps to no WP user
     * (audit rows are only ever attributed to real staff accounts).
     *
     * @param string $email_address
     * @param int    $page
     * @return array{data: array, done: bool}
     */
    public static function export_audit_log($email_address, $page = 1) {
        if (!class_exists('WPSG_DB')) {
            return ['data' => [], 'done' => true];
        }

        $user = get_user_by('email', (string) $email_address);
        if (!$user) {
            return ['data' => [], 'done' => true];
        }

        $page   = max(1, (int) $page);
        $offset = ($page - 1) * self::PAGE_SIZE;
        $rows   = WPSG_DB::get_audit_entries_by_actor((int) $user->ID, (string) $user->user_login, self::PAGE_SIZE, $offset);

        $items = [];
        foreach ($rows as $row) {
            $items[] = [
                'group_id'          => 'wpsg-audit-log',
                'group_label'       => __('WP Super Gallery — Audit Log', 'wp-super-gallery'),
                'group_description' => __('Administrative actions recorded under this account. Retained for accountability and not erased on request.', 'wp-super-gallery'),
                'item_id'           => 'wpsg-audit-' . $row['id'],
                'data'              => [
                    ['name' => __('Action', 'wp-super-gallery'),  'value' => $row['action']],
                    ['name' => __('Summary', 'wp-super-gallery'), 'value' => $row['summary']],
                    ['name' => __('Actor', 'wp-super-gallery'),   'value' => $row['actor_login']],
                    ['name' => __('Date', 'wp-super-gallery'),    'value' => $row['created_at']],
                ],
            ];
        }

        return [
            'data' => $items,
            'done' => count($rows) < self::PAGE_SIZE,
        ];
    }
}
