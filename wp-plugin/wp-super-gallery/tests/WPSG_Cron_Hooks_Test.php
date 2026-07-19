<?php

/**
 * P66-F: the canonical cron-hook list (includes/wpsg-cron-hooks.php) is the
 * single source of truth shared by wpsg_deactivate() and uninstall.php. This
 * test pins the literal list against every originating class constant so a
 * rename can never silently desync them again, and confirms deactivation
 * actually clears the whole set.
 */
class WPSG_Cron_Hooks_Test extends WP_UnitTestCase {

    private function expected_hooks(): array {
        return [
            WPSG_Maintenance::CLEANUP_HOOK,
            WPSG_Maintenance::TRASH_PURGE_HOOK,
            WPSG_Maintenance::ANALYTICS_PURGE_HOOK,
            WPSG_Maintenance::EXPIRED_GRANTS_HOOK,
            'wpsg_schedule_auto_archive',
            'wpsg_thumbnail_cache_cleanup',
            WPSG_Alerts::CRON_HOOK,
            WPSG_Webhooks::RETRY_HOOK,
            WPSG_Export_Engine::JOB_PROCESS_HOOK,
            WPSG_Export_Engine::JOB_CLEANUP_HOOK,
            WPSG_DB::FILESIZE_BACKFILL_HOOK,
        ];
    }

    public function test_canonical_list_matches_every_class_constant() {
        $hooks = wpsg_get_cron_hooks();

        foreach ($this->expected_hooks() as $hook) {
            $this->assertContains($hook, $hooks, "Canonical cron-hook list is missing {$hook}");
        }
        $this->assertCount(
            count($this->expected_hooks()),
            $hooks,
            'Canonical cron-hook list has an unexpected number of entries — update this test and both consumers.'
        );
    }

    public function test_deactivate_clears_every_scheduled_hook() {
        foreach (wpsg_get_cron_hooks() as $i => $hook) {
            wp_schedule_event(time() + 3600 + $i, 'daily', $hook);
        }

        wpsg_deactivate();

        foreach (wpsg_get_cron_hooks() as $hook) {
            $this->assertFalse(
                wp_next_scheduled($hook),
                "{$hook} must be cleared on deactivation"
            );
        }
    }
}
