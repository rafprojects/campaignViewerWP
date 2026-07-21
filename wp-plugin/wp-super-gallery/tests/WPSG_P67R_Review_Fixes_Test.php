<?php

/**
 * P67-R: regressions found in the Phase 67 PR review and the guards that pin them.
 *
 * - R1 update_object_term_cache()'s second argument is an *object type*, not a
 *   taxonomy. P67-F/G passed 'wpsg_company', which expands to no taxonomies at all
 *   and primes nothing, so the batch priming those tracks added was a silent no-op.
 * - R2 stamp_filesize_meta() skipped the write when the file was unreadable, which
 *   left offloaded/broken attachments permanently without _wpsg_filesize while the
 *   backfill stamped 0 for the same rows.
 * - R3 The _wpsg_filesize backfill looped over the entire attachment library in one
 *   request; it is now bounded per run and resumed on cron.
 * - R4 dispatch() ignored wp_schedule_single_event()'s return value, so a refused
 *   schedule dropped webhook delivery #1 with no log entry.
 */
class WPSG_P67R_Review_Fixes_Test extends WP_UnitTestCase {

    private $tmp_files = [];

    public function tearDown(): void {
        foreach ($this->tmp_files as $f) {
            if (file_exists($f)) {
                @unlink($f);
            }
        }
        $this->tmp_files = [];
        remove_all_filters('wpsg_filesize_backfill_batch_size');
        remove_all_filters('wpsg_filesize_backfill_max_batches');
        remove_all_filters('pre_schedule_event');
        remove_all_filters('pre_http_request');
        parent::tearDown();
    }

    // ── R1: term-cache priming targets the object type, not the taxonomy ──────

    /**
     * The exact core behaviour the regression rested on. Pinned here so the
     * taxonomy-vs-object-type distinction can't be re-confused.
     */
    public function test_object_term_cache_primes_only_for_an_object_type() {
        $this->assertSame(
            [],
            get_object_taxonomies('wpsg_company'),
            'wpsg_company is a taxonomy, not an object type — priming against it is a no-op'
        );
        $this->assertContains(
            'wpsg_company',
            get_object_taxonomies('wpsg_campaign'),
            'the wpsg_campaign object type is what expands to the wpsg_company taxonomy'
        );
    }

    /**
     * get_accessible_campaign_ids() pages with 'fields' => 'ids', which leaves post
     * objects, meta and terms all uncached. Public campaigns short-circuit
     * can_view_campaign() before it touches terms or get_post(), so the caches can
     * only be warm afterwards if the batch priming actually ran.
     */
    public function test_accessible_campaign_ids_primes_post_meta_and_term_caches() {
        $ids = [];
        for ($i = 0; $i < 3; $i++) {
            $id = wp_insert_post([
                'post_type'   => 'wpsg_campaign',
                'post_title'  => 'Primed ' . $i,
                'post_status' => 'publish',
            ]);
            update_post_meta($id, 'status', 'active');
            update_post_meta($id, 'visibility', 'public');
            $term = wp_insert_term('p67r-co-' . $i . '-' . uniqid(), 'wpsg_company');
            wp_set_object_terms($id, [intval($term['term_id'])], 'wpsg_company');
            $ids[] = (int) $id;
        }

        // Cold caches, and a cache-version bump so the per-user transient misses.
        WPSG_REST_Base::clear_accessible_campaigns_cache();
        wp_cache_flush();

        $m = new ReflectionMethod('WPSG_REST_Base', 'get_accessible_campaign_ids');
        $m->setAccessible(true);
        $accessible = $m->invoke(null, 0);

        foreach ($ids as $id) {
            $this->assertContains((string) $id, $accessible, 'public campaigns are accessible');
            $this->assertNotFalse(
                wp_cache_get($id, 'posts'),
                "post object cache primed for {$id}"
            );
            $this->assertNotFalse(
                get_object_term_cache($id, 'wpsg_company'),
                "company term cache primed for {$id} — a taxonomy-name argument primes nothing"
            );
        }
    }

    // ── R2/R3: filesize stamping and the bounded backfill ─────────────────────

    private function make_attachment(int $bytes): int {
        $upload = wp_upload_dir();
        $path   = $upload['basedir'] . '/wpsg-p67r-' . uniqid() . '.bin';
        file_put_contents($path, str_repeat('x', $bytes));
        $this->tmp_files[] = $path;

        return intval(wp_insert_attachment([
            'post_mime_type' => 'image/jpeg',
            'post_title'     => 'p67r',
            'post_status'    => 'inherit',
        ], $path, 0, true));
    }

    public function test_stamp_filesize_meta_records_zero_for_an_unreadable_file() {
        $id = $this->factory->post->create([
            'post_type'   => 'attachment',
            'post_status' => 'inherit',
            'post_title'  => 'offloaded',
        ]);
        update_post_meta($id, '_wp_attached_file', 'does/not/exist.jpg');
        delete_post_meta($id, '_wpsg_filesize');

        WPSG_Media_Controller::stamp_filesize_meta($id);

        $this->assertSame(
            '0',
            (string) get_post_meta($id, '_wpsg_filesize', true),
            'an unreadable attachment is stamped 0, exactly as the backfill stamps it'
        );
    }

    public function test_backfill_completes_and_flags_when_the_library_fits_in_budget() {
        $id = $this->make_attachment(1234);
        delete_post_meta($id, '_wpsg_filesize');
        delete_option('wpsg_filesize_backfilled');
        wp_clear_scheduled_hook(WPSG_DB::FILESIZE_BACKFILL_HOOK);

        WPSG_DB::run_filesize_backfill_batch();

        $this->assertSame(1234, (int) get_post_meta($id, '_wpsg_filesize', true));
        $this->assertSame('1', get_option('wpsg_filesize_backfilled'));
        $this->assertFalse(
            wp_next_scheduled(WPSG_DB::FILESIZE_BACKFILL_HOOK),
            'a backfill that finished must not leave a continuation queued'
        );
    }

    public function test_backfill_is_bounded_per_run_and_resumes_on_cron() {
        // One batch of one row per run: three attachments therefore cannot finish in
        // a single pass, which is the large-library case in miniature.
        add_filter('wpsg_filesize_backfill_batch_size', fn() => 1);
        add_filter('wpsg_filesize_backfill_max_batches', fn() => 1);

        $ids = [$this->make_attachment(11), $this->make_attachment(22), $this->make_attachment(33)];
        foreach ($ids as $id) {
            delete_post_meta($id, '_wpsg_filesize');
        }
        delete_option('wpsg_filesize_backfilled');
        wp_clear_scheduled_hook(WPSG_DB::FILESIZE_BACKFILL_HOOK);

        WPSG_DB::run_filesize_backfill_batch();

        $stamped = 0;
        foreach ($ids as $id) {
            if (get_post_meta($id, '_wpsg_filesize', true) !== '') {
                $stamped++;
            }
        }
        $this->assertSame(1, $stamped, 'exactly one batch of work per run');
        $this->assertFalse(get_option('wpsg_filesize_backfilled'), 'not flagged complete while rows remain');
        $this->assertNotFalse(
            wp_next_scheduled(WPSG_DB::FILESIZE_BACKFILL_HOOK),
            'the remainder is handed to cron rather than run inline'
        );

        // Drain it the way cron would.
        for ($i = 0; $i < 5 && !get_option('wpsg_filesize_backfilled'); $i++) {
            WPSG_DB::run_filesize_backfill_batch();
        }

        $this->assertSame('1', get_option('wpsg_filesize_backfilled'));
        $this->assertSame(11, (int) get_post_meta($ids[0], '_wpsg_filesize', true));
        $this->assertSame(22, (int) get_post_meta($ids[1], '_wpsg_filesize', true));
        $this->assertSame(33, (int) get_post_meta($ids[2], '_wpsg_filesize', true));
    }

    public function test_backfill_cron_hook_is_registered() {
        $this->assertNotFalse(
            has_action(WPSG_DB::FILESIZE_BACKFILL_HOOK, ['WPSG_DB', 'run_filesize_backfill_batch']),
            'the continuation hook must be wired, or a bounded backfill would never resume'
        );
        $this->assertContains(
            WPSG_DB::FILESIZE_BACKFILL_HOOK,
            wpsg_get_cron_hooks(),
            'the hook belongs in the canonical list so deactivate/uninstall clear it'
        );
    }

    // ── R4: a refused cron schedule falls back to inline delivery ─────────────

    public function test_dispatch_delivers_inline_when_cron_refuses_the_schedule() {
        add_filter('pre_http_request', fn() => [
            'response' => ['code' => 200, 'message' => 'OK'],
            'body'     => '',
            'headers'  => [],
            'cookies'  => [],
            'filename' => null,
        ], 10, 3);
        // Stand in for a duplicate-window suppression or a scheduling veto.
        add_filter('pre_schedule_event', fn() => false, 10, 3);

        WPSG_Webhooks::save_endpoints([[
            'id'      => wp_generate_uuid4(),
            'url'     => 'https://hooks.test/refused',
            'secret'  => 'testsecret',
            'events'  => [],
            'enabled' => true,
        ]]);
        update_option(WPSG_Webhooks::LOG_OPTION, []);

        WPSG_Webhooks::dispatch('campaign.created', ['id' => 42, 'title' => 'Fallback']);

        $log = WPSG_Webhooks::get_delivery_log();
        $this->assertCount(1, $log, 'a refused schedule must not silently drop the delivery');
        $this->assertTrue($log[0]['success']);
        $this->assertSame(1, $log[0]['attempt']);
        $this->assertSame('campaign.created', $log[0]['event']);
    }
}
