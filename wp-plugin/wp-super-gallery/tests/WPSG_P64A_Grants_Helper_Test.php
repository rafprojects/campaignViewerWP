<?php

/**
 * P64-A: WPSG_Grants — the shared access-grant helper extracted from ~10
 * duplicated call sites (campaign postmeta, company termmeta, space JSON,
 * rest-base precedence, maintenance purge, monitoring metrics).
 *
 * These assert the helper's contract directly, so the behaviour every call site
 * now depends on is pinned in one place — especially the expiry edge cases and
 * malformed-input handling the inline copies each handled slightly differently.
 */
class WPSG_P64A_Grants_Helper_Test extends WP_UnitTestCase {

    // ── upsert ────────────────────────────────────────────────────────────────

    public function test_upsert_appends_new_user() {
        $grants = [['userId' => 1, 'access_level' => 'viewer']];
        $out    = WPSG_Grants::upsert($grants, ['userId' => 2, 'access_level' => 'viewer']);
        $this->assertCount(2, $out);
        $this->assertSame([0, 1], array_keys($out), 'result is reindexed');
        $this->assertSame(2, $out[1]['userId']);
    }

    public function test_upsert_replaces_existing_user_entry() {
        $grants = [
            ['userId' => 1, 'access_level' => 'viewer', 'grantedAt' => 'old'],
            ['userId' => 2, 'access_level' => 'viewer'],
        ];
        $out = WPSG_Grants::upsert($grants, ['userId' => 1, 'access_level' => 'viewer', 'grantedAt' => 'new']);
        $this->assertCount(2, $out, 'no duplicate entry for userId 1');
        $ids = array_column($out, 'userId');
        $this->assertSame(1, array_count_values($ids)[1], 'exactly one entry for userId 1');
        // The replacement is appended last, carrying the new payload.
        $this->assertSame('new', $out[1]['grantedAt']);
    }

    public function test_upsert_treats_missing_user_id_as_zero() {
        $out = WPSG_Grants::upsert([['userId' => 0]], ['foo' => 'bar']);
        $this->assertCount(1, $out, 'entry with no userId collides with existing userId 0');
    }

    // ── remove ────────────────────────────────────────────────────────────────

    public function test_remove_drops_all_entries_for_user_and_reindexes() {
        $grants = [
            ['userId' => 1],
            ['userId' => 2],
            ['userId' => 1], // stray duplicate
        ];
        $out = WPSG_Grants::remove($grants, 1);
        $this->assertCount(1, $out);
        $this->assertSame(2, $out[0]['userId']);
        $this->assertSame([0], array_keys($out), 'reindexed');
    }

    public function test_remove_noop_when_user_absent() {
        $grants = [['userId' => 5]];
        $this->assertSame($grants, WPSG_Grants::remove($grants, 99));
    }

    // ── is_expired ──────────────────────────────────────────────────────────────

    public function test_is_expired_false_for_absent_or_empty_expiry() {
        $this->assertFalse(WPSG_Grants::is_expired([]));
        $this->assertFalse(WPSG_Grants::is_expired(['expires_at' => null]));
        $this->assertFalse(WPSG_Grants::is_expired(['expires_at' => '']));
        $this->assertFalse(WPSG_Grants::is_expired(['expires_at' => '0']));
    }

    public function test_is_expired_true_for_past_expiry() {
        $past = gmdate('c', time() - 3600);
        $this->assertTrue(WPSG_Grants::is_expired(['expires_at' => $past]));
    }

    public function test_is_expired_false_for_future_expiry() {
        $future = gmdate('c', time() + 3600);
        $this->assertFalse(WPSG_Grants::is_expired(['expires_at' => $future]));
    }

    public function test_is_expired_true_for_unparseable_expiry() {
        // Matches the inline `strtotime(...) < now` form this replaces: a
        // `strtotime() === false` result coerces to `0` in that comparison, so
        // garbage was always treated as "expired long ago" (fail closed).
        $this->assertTrue(WPSG_Grants::is_expired(['expires_at' => 'not-a-date']));
    }

    public function test_is_expired_respects_injected_now() {
        $entry = ['expires_at' => gmdate('c', 1_000_000)];
        $this->assertTrue(WPSG_Grants::is_expired($entry, 2_000_000), 'expired relative to a later now');
        $this->assertFalse(WPSG_Grants::is_expired($entry, 500_000), 'not yet expired relative to an earlier now');
    }

    // ── filter_active ───────────────────────────────────────────────────────────

    public function test_filter_active_keeps_only_non_expired() {
        $grants = [
            ['userId' => 1, 'expires_at' => gmdate('c', time() - 60)], // expired
            ['userId' => 2, 'expires_at' => null],                     // never expires
            ['userId' => 3, 'expires_at' => gmdate('c', time() + 60)], // future
        ];
        $out = WPSG_Grants::filter_active($grants);
        $ids = array_column($out, 'userId');
        $this->assertSame([2, 3], $ids);
    }

    // ── has_active_grant ────────────────────────────────────────────────────────

    public function test_has_active_grant_true_for_non_expired_match() {
        $grants = [
            ['userId' => 1, 'expires_at' => gmdate('c', time() - 60)], // expired
            ['userId' => 2, 'expires_at' => null],                     // never expires
        ];
        $this->assertFalse(WPSG_Grants::has_active_grant($grants, 1));
        $this->assertTrue(WPSG_Grants::has_active_grant($grants, 2));
        $this->assertFalse(WPSG_Grants::has_active_grant($grants, 3), 'no entry for this user at all');
    }

    // ── parse_expiry_param ──────────────────────────────────────────────────────

    public function test_parse_expiry_param_null_and_empty_return_null() {
        $this->assertNull(WPSG_Grants::parse_expiry_param(null));
        $this->assertNull(WPSG_Grants::parse_expiry_param(''));
    }

    public function test_parse_expiry_param_normalises_valid_datetime() {
        $out = WPSG_Grants::parse_expiry_param('2030-06-01T12:00:00+00:00');
        $this->assertIsString($out);
        $this->assertSame(strtotime('2030-06-01T12:00:00+00:00'), strtotime($out), 'round-trips to the same instant');
        $this->assertSame(gmdate('c', strtotime('2030-06-01T12:00:00+00:00')), $out, 'normalised via gmdate(c)');
    }

    public function test_parse_expiry_param_rejects_garbage_with_wp_error() {
        $out = WPSG_Grants::parse_expiry_param('definitely not a date');
        $this->assertInstanceOf(WP_Error::class, $out);
        $this->assertSame('wpsg_invalid_expires_at', $out->get_error_code());
        $this->assertSame(400, $out->get_error_data()['status']);
    }

    // ── validate_access_level ────────────────────────────────────────────────────

    public function test_validate_access_level_passes_accepted_tiers() {
        $this->assertSame('viewer', WPSG_Grants::validate_access_level('viewer'));
        $this->assertSame('editor', WPSG_Grants::validate_access_level('editor'));
        $this->assertSame('owner', WPSG_Grants::validate_access_level('owner'));
    }

    public function test_validate_access_level_defaults_junk_to_viewer() {
        $this->assertSame('viewer', WPSG_Grants::validate_access_level('superuser'));
        $this->assertSame('viewer', WPSG_Grants::validate_access_level(null));
        $this->assertSame('viewer', WPSG_Grants::validate_access_level(''));
    }

    // ── enrich_users ────────────────────────────────────────────────────────────

    public function test_enrich_users_attaches_user_and_normalises_level() {
        $uid = self::factory()->user->create([
            'role'         => 'subscriber',
            'display_name' => 'Grace Hopper',
            'user_email'   => 'grace@example.com',
        ]);

        $entries = [['userId' => $uid, 'access_level' => 'bogus']];
        $out     = WPSG_Grants::enrich_users($entries);

        $this->assertSame('Grace Hopper', $out[0]['user']['displayName']);
        $this->assertSame('grace@example.com', $out[0]['user']['email']);
        $this->assertArrayHasKey('login', $out[0]['user']);
        $this->assertSame('viewer', $out[0]['access_level'], 'junk level normalised to viewer');
    }

    public function test_enrich_users_with_expiry_flag_toggles_is_expired() {
        $uid  = self::factory()->user->create(['role' => 'subscriber']);
        $past = ['userId' => $uid, 'expires_at' => gmdate('c', time() - 60)];

        $without = WPSG_Grants::enrich_users([$past], false);
        $this->assertArrayNotHasKey('is_expired', $without[0], 'company-access shape omits is_expired');

        $with = WPSG_Grants::enrich_users([$past], true);
        $this->assertArrayHasKey('is_expired', $with[0]);
        $this->assertTrue($with[0]['is_expired']);
    }

    public function test_enrich_users_leaves_unknown_user_without_user_key() {
        $entries = [['userId' => 999999, 'access_level' => 'viewer']];
        $out     = WPSG_Grants::enrich_users($entries);
        $this->assertArrayNotHasKey('user', $out[0], 'no user object for a non-existent id');
        $this->assertSame('viewer', $out[0]['access_level']);
    }
}
