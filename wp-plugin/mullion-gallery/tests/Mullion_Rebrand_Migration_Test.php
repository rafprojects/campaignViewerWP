<?php
/**
 * P74-E / P74-F: one-time WP Super Gallery → Mullion data-shape migration.
 *
 * Seeds the pre-rename `wpsg_*` rows (the strings the migrator still looks
 * for) and asserts the post-rename `mullion_*` shape is what the plugin queries.
 */
class Mullion_Rebrand_Migration_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        delete_option(Mullion_Rebrand_Migration::VERSION_OPTION);
    }

    public function tearDown(): void {
        if (get_role('wpsg_editor')) {
            remove_role('wpsg_editor');
        }
        if (get_role('wpsg_admin')) {
            remove_role('wpsg_admin');
        }
        parent::tearDown();
    }

    public function test_fresh_install_bumps_version_without_requiring_old_rows() {
        Mullion_Rebrand_Migration::maybe_run();

        $this->assertSame(
            Mullion_Rebrand_Migration::VERSION_KEYS,
            (int) get_option(Mullion_Rebrand_Migration::VERSION_OPTION, 0)
        );
        $this->assertTrue(post_type_exists('mullion_campaign'));
        $this->assertTrue(post_type_exists('mullion_layout_tpl'));
        $this->assertTrue(taxonomy_exists('mullion_company'));
        $this->assertTrue(taxonomy_exists('mullion_campaign_tag'));
        $this->assertTrue(taxonomy_exists('mullion_campaign_category'));
        $this->assertTrue(taxonomy_exists('mullion_media_tag'));
        $this->assertNotNull(get_role('mullion_editor'));
        $this->assertNull(get_role('wpsg_editor'));
    }

    public function test_migrates_post_types_and_taxonomies() {
        $campaign_id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Legacy Campaign',
            'post_status' => 'publish',
        ]);
        $tpl_id = wp_insert_post([
            'post_type'   => 'wpsg_layout_tpl',
            'post_title'  => 'Legacy Layout',
            'post_status' => 'publish',
        ]);
        $this->assertGreaterThan(0, $campaign_id);
        $this->assertGreaterThan(0, $tpl_id);

        foreach (array_keys(Mullion_Rebrand_Migration::TAXONOMIES) as $old_tax) {
            register_taxonomy($old_tax, 'wpsg_campaign', ['public' => false]);
        }

        $company = wp_insert_term('Acme', 'wpsg_company');
        $tag     = wp_insert_term('Summer', 'wpsg_campaign_tag');
        $cat     = wp_insert_term('Weddings', 'wpsg_campaign_category');
        $media   = wp_insert_term('Portrait', 'wpsg_media_tag');
        $this->assertIsArray($company);
        $this->assertIsArray($tag);
        $this->assertIsArray($cat);
        $this->assertIsArray($media);

        wp_set_object_terms($campaign_id, [(int) $company['term_id']], 'wpsg_company');
        wp_set_object_terms($campaign_id, [(int) $tag['term_id']], 'wpsg_campaign_tag');
        wp_set_object_terms($campaign_id, [(int) $cat['term_id']], 'wpsg_campaign_category');

        Mullion_Rebrand_Migration::migrate_object_types();
        Mullion_CPT::register();

        $this->assertSame('mullion_campaign', get_post_type($campaign_id));
        $this->assertSame('mullion_layout_tpl', get_post_type($tpl_id));
        global $wpdb;
        $this->assertSame(
            '0',
            $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'wpsg_campaign'")
        );

        $this->assertNotNull(get_term((int) $company['term_id'], 'mullion_company'));
        $this->assertNotNull(get_term((int) $tag['term_id'], 'mullion_campaign_tag'));
        $this->assertNotNull(get_term((int) $cat['term_id'], 'mullion_campaign_category'));
        $this->assertNotNull(get_term((int) $media['term_id'], 'mullion_media_tag'));

        $this->assertContains(
            (int) $company['term_id'],
            wp_get_object_terms($campaign_id, 'mullion_company', ['fields' => 'ids'])
        );
    }

    public function test_migrates_editor_role_and_caps() {
        $old_caps = [
            'read'         => true,
            'upload_files' => true,
            'manage_wpsg'  => true,
        ];
        add_role('wpsg_editor', 'Gallery Editor', $old_caps);
        $uid = self::factory()->user->create(['role' => 'wpsg_editor']);

        $admin_id = self::factory()->user->create(['role' => 'administrator']);
        $admin    = get_user_by('id', $admin_id);
        $admin->add_cap('manage_wpsg');
        foreach (array_keys(Mullion_Rebrand_Migration::CAPS) as $old_cap) {
            if ($old_cap === 'manage_wpsg') {
                continue;
            }
            $admin->add_cap($old_cap);
        }

        Mullion_Rebrand_Migration::migrate_object_types();

        $user = get_user_by('id', $uid);
        $this->assertContains('mullion_editor', $user->roles);
        $this->assertNotContains('wpsg_editor', $user->roles);
        $this->assertTrue(user_can($uid, 'manage_mullion'));
        $this->assertFalse(user_can($uid, 'manage_wpsg'));
        $this->assertNull(get_role('wpsg_editor'));
        $this->assertNotNull(get_role('mullion_editor'));

        $this->assertTrue(user_can($admin_id, 'manage_mullion'));
        $this->assertFalse(user_can($admin_id, 'manage_wpsg'));
        $this->assertTrue(user_can($admin_id, 'edit_mullion_campaigns'));
        $this->assertFalse(user_can($admin_id, 'edit_wpsg_campaigns'));
    }

    public function test_migrates_legacy_wpsg_admin_role_to_editor() {
        add_role('wpsg_admin', 'Gallery Admin', [
            'read'         => true,
            'upload_files' => true,
            'manage_wpsg'  => true,
        ]);
        $uid = self::factory()->user->create(['role' => 'wpsg_admin']);

        Mullion_Rebrand_Migration::migrate_object_types();

        $user = get_user_by('id', $uid);
        $this->assertContains('mullion_editor', $user->roles);
        $this->assertNotContains('wpsg_admin', $user->roles);
        $this->assertNull(get_role('wpsg_admin'));
        $this->assertTrue(user_can($uid, 'manage_mullion'));
    }

    public function test_second_run_is_noop() {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Once',
            'post_status' => 'publish',
        ]);
        Mullion_Rebrand_Migration::maybe_run();
        $this->assertSame('mullion_campaign', get_post_type($id));
        $this->assertSame(
            Mullion_Rebrand_Migration::VERSION_KEYS,
            (int) get_option(Mullion_Rebrand_Migration::VERSION_OPTION)
        );

        $before = get_post_type($id);
        Mullion_Rebrand_Migration::maybe_run();
        $this->assertSame($before, get_post_type($id));
        $this->assertSame(
            Mullion_Rebrand_Migration::VERSION_KEYS,
            (int) get_option(Mullion_Rebrand_Migration::VERSION_OPTION)
        );
    }

    public function test_migrates_option_keys_and_css_var_values() {
        global $wpdb;
        delete_option('mullion_settings');
        delete_option('mullion_db_version');
        $wpdb->insert($wpdb->options, [
            'option_name'  => 'wpsg_settings',
            'option_value' => serialize([
                'theme'               => 'nord',
                'dot_nav_active_color'=> 'var(--wpsg-color-primary)',
            ]),
            'autoload'     => 'yes',
        ]);
        $wpdb->insert($wpdb->options, [
            'option_name'  => 'wpsg_db_version',
            'option_value' => '17',
            'autoload'     => 'yes',
        ]);

        Mullion_Rebrand_Migration::migrate_persisted_keys();

        $this->assertFalse(get_option('wpsg_settings', false));
        $this->assertFalse(get_option('wpsg_db_version', false));
        $settings = get_option('mullion_settings');
        $this->assertIsArray($settings);
        $this->assertSame('nord', $settings['theme']);
        $this->assertSame('var(--mullion-color-primary)', $settings['dot_nav_active_color']);
        $this->assertSame('17', get_option('mullion_db_version'));
    }

    public function test_migrates_postmeta_keys() {
        $id = wp_insert_post([
            'post_type'   => 'mullion_campaign',
            'post_title'  => 'Meta',
            'post_status' => 'publish',
        ]);
        add_post_meta($id, '_wpsg_space_id', 42, true);
        add_post_meta($id, '_wpsg_is_template', '1', true);

        Mullion_Rebrand_Migration::migrate_persisted_keys();

        $this->assertSame('42', get_post_meta($id, '_mullion_space_id', true));
        $this->assertSame('1', get_post_meta($id, '_mullion_is_template', true));
        $this->assertSame('', get_post_meta($id, '_wpsg_space_id', true));
        $this->assertSame('', get_post_meta($id, '_wpsg_is_template', true));
    }

    public function test_renames_custom_tables() {
        global $wpdb;
        $old = $wpdb->prefix . 'wpsg_spaces';
        $new = $wpdb->prefix . 'mullion_spaces';
        $exists = static function (string $table) use ($wpdb): bool {
            return (int) $wpdb->get_var(
                $wpdb->prepare(
                    'SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s',
                    $table
                )
            ) > 0;
        };

        if ($exists($new)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $wpdb->query("DELETE FROM `{$new}`");
        }
        if ($exists($old)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $wpdb->query("DROP TABLE `{$old}`");
        }
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $wpdb->query("CREATE TABLE `{$old}` (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY) {$wpdb->get_charset_collate()}");

        Mullion_Rebrand_Migration::migrate_persisted_keys();

        $this->assertTrue($exists($new), 'destination table must exist after rename');
        $this->assertFalse($exists($old), 'source table must be gone after rename');
    }

    public function test_option_rename_does_not_overwrite_existing_dest() {
        update_option('mullion_settings', ['theme' => 'kept'], false);
        update_option('wpsg_settings', ['theme' => 'old'], false);

        Mullion_Rebrand_Migration::migrate_persisted_keys();

        $settings = get_option('mullion_settings');
        $this->assertSame('kept', $settings['theme']);
        $this->assertFalse(get_option('wpsg_settings', false));
    }
}
