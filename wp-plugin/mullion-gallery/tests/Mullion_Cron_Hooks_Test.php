<?php

/**
 * P66-F: the canonical cron-hook list (includes/mullion-cron-hooks.php) is the
 * single source of truth shared by mullion_deactivate() and uninstall.php. This
 * test pins the literal list against every originating class constant so a
 * rename can never silently desync them again, and confirms deactivation
 * actually clears the whole set.
 */
class Mullion_Cron_Hooks_Test extends WP_UnitTestCase {

    private function expected_hooks(): array {
        return [
            Mullion_Maintenance::CLEANUP_HOOK,
            Mullion_Maintenance::TRASH_PURGE_HOOK,
            Mullion_Maintenance::ANALYTICS_PURGE_HOOK,
            Mullion_Maintenance::EXPIRED_GRANTS_HOOK,
            Mullion_Maintenance::ACCESS_REQUESTS_PURGE_HOOK,
            Mullion_Maintenance::AUDIT_LOG_PURGE_HOOK,
            'mullion_schedule_auto_archive',
            'mullion_thumbnail_cache_cleanup',
            Mullion_Alerts::CRON_HOOK,
            Mullion_Webhooks::RETRY_HOOK,
            Mullion_Export_Engine::JOB_PROCESS_HOOK,
            Mullion_Export_Engine::JOB_CLEANUP_HOOK,
            Mullion_DB::FILESIZE_BACKFILL_HOOK,
        ];
    }

    public function test_canonical_list_matches_every_class_constant() {
        $hooks = mullion_get_cron_hooks();

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
        foreach (mullion_get_cron_hooks() as $i => $hook) {
            wp_schedule_event(time() + 3600 + $i, 'daily', $hook);
        }

        mullion_deactivate();

        foreach (mullion_get_cron_hooks() as $hook) {
            $this->assertFalse(
                wp_next_scheduled($hook),
                "{$hook} must be cleared on deactivation"
            );
        }
    }
}
