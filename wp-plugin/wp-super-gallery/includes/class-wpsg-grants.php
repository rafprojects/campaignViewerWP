<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * WPSG_Grants — P64-A: single home for access-grant list logic.
 *
 * Access grants live in three stores (campaign postmeta, company termmeta,
 * space-table JSON) but share one entry shape and the same handful of
 * operations: upsert-by-user, remove-by-user, expiry checks, expiry-param
 * parsing, access-level normalisation, and page-slice user enrichment. Before
 * this class those were copy-pasted across ~10 call sites in four files, so any
 * change to grant shape had to be made in every copy.
 *
 * These are pure array/logic helpers — storage stays exactly where it is
 * (postmeta / termmeta / space-table JSON); nothing here reads or writes it,
 * except enrich_users() which batches a single get_users() lookup.
 */
class WPSG_Grants {

    /**
     * Insert or replace the entry for its userId. Enforces the one-grant-per-user
     * invariant every store relies on (replaces any existing entry for the same
     * user, then appends the new one). Works for grant lists and deny-override
     * lists alike — both dedupe by userId.
     */
    public static function upsert(array $grants, array $entry): array {
        $user_id  = intval($entry['userId'] ?? 0);
        $filtered = array_filter($grants, static function ($item) use ($user_id) {
            return intval($item['userId'] ?? 0) !== $user_id;
        });
        $filtered[] = $entry;
        return array_values($filtered);
    }

    /**
     * Remove every entry for the given user.
     */
    public static function remove(array $grants, int $user_id): array {
        return array_values(array_filter($grants, static function ($item) use ($user_id) {
            return intval($item['userId'] ?? 0) !== $user_id;
        }));
    }

    /**
     * True when the entry carries an expiry that is in the past.
     *
     * An empty/absent expiry never expires; an unparseable expiry is treated as
     * "no valid expiry set" (not expired) rather than silently expiring the
     * grant. For real data — where expires_at is always either null or an ISO
     * string produced by gmdate('c', …) — this matches the historical inline
     * checks exactly.
     *
     * @param int|null $now Unix timestamp to compare against; defaults to now.
     */
    public static function is_expired(array $entry, ?int $now = null): bool {
        $expires_at = $entry['expires_at'] ?? null;
        if (empty($expires_at)) {
            return false;
        }
        $ts = strtotime($expires_at);
        if ($ts === false) {
            return false;
        }
        return $ts < ($now ?? time());
    }

    /**
     * Keep only the non-expired grants.
     */
    public static function filter_active(array $grants, ?int $now = null): array {
        $now = $now ?? time();
        return array_values(array_filter($grants, static function ($entry) use ($now) {
            return !self::is_expired($entry, $now);
        }));
    }

    /**
     * Parse an `expires_at` request param into a normalised ISO-8601 string.
     *
     * @param mixed $raw Raw request value.
     * @return string|null|WP_Error ISO-8601 string, null (no expiry supplied),
     *                              or a 400 WP_Error for an unparseable value.
     */
    public static function parse_expiry_param($raw) {
        if ($raw === null || $raw === '') {
            return null;
        }
        $ts = strtotime(sanitize_text_field($raw));
        if ($ts === false) {
            return new WP_Error('wpsg_invalid_expires_at', 'expires_at must be a valid ISO 8601 datetime', ['status' => 400]);
        }
        return gmdate('c', $ts);
    }

    /**
     * Normalise an access_level to one of the accepted tiers, defaulting to
     * 'viewer' (the migration default for legacy grants without a level).
     * Canonical home for this rule; WPSG_REST_Base::validate_access_level()
     * delegates here.
     *
     * @param mixed $level
     * @return string 'viewer' | 'editor' | 'owner'
     */
    public static function validate_access_level($level): string {
        return in_array($level, ['viewer', 'editor', 'owner'], true)
            ? (string) $level
            : 'viewer';
    }

    /**
     * Attach display user objects (and normalise access_level) to a page slice
     * of grant entries, batching the lookup into a single get_users() call.
     *
     * @param array    $entries     Page slice of grant entries (post-pagination).
     * @param bool     $with_expiry When true, also normalise expires_at and add
     *                              an is_expired flag (for list views that surface
     *                              expiry). Left off for the company-access list,
     *                              which historically omits those fields.
     * @param int|null $now         Timestamp for the expiry computation.
     * @return array Entries with 'user' + normalised 'access_level' (+ expiry).
     */
    public static function enrich_users(array $entries, bool $with_expiry = false, ?int $now = null): array {
        $now      = $now ?? time();
        $user_ids = array_unique(array_filter(array_map(static function ($entry) {
            return intval($entry['userId'] ?? 0);
        }, $entries)));

        $user_map = [];
        if (!empty($user_ids)) {
            $users = get_users(['include' => $user_ids, 'fields' => ['ID', 'user_email', 'display_name', 'user_login']]);
            foreach ($users as $user) {
                $user_map[$user->ID] = [
                    'displayName' => $user->display_name,
                    'email'       => $user->user_email,
                    'login'       => $user->user_login,
                ];
            }
        }

        return array_map(function ($entry) use ($user_map, $with_expiry, $now) {
            $uid = intval($entry['userId'] ?? 0);
            if (isset($user_map[$uid])) {
                $entry['user'] = $user_map[$uid];
            }
            $entry['access_level'] = self::validate_access_level($entry['access_level'] ?? 'viewer');
            if ($with_expiry) {
                $expires_at          = $entry['expires_at'] ?? null;
                $entry['expires_at'] = $expires_at;
                $entry['is_expired'] = self::is_expired($entry, $now);
            }
            return $entry;
        }, $entries);
    }
}
