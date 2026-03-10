<?php

class WPSG_CPT_Registration_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        // Ensure CPT/taxonomies/meta are registered (may be cleared by other test teardowns).
        WPSG_CPT::register();
    }

    // ── Post type registration ─────────────────────────────────────────────

    public function test_wpsg_campaign_post_type_is_registered() {
        $this->assertTrue(post_type_exists('wpsg_campaign'));
    }

    public function test_wpsg_layout_tpl_post_type_is_registered() {
        $this->assertTrue(post_type_exists('wpsg_layout_tpl'));
    }

    public function test_campaign_post_type_is_not_public() {
        $obj = get_post_type_object('wpsg_campaign');
        $this->assertFalse($obj->public);
    }

    public function test_campaign_post_type_supports_title_and_editor() {
        $supports = get_all_post_type_supports('wpsg_campaign');
        $this->assertArrayHasKey('title', $supports);
        $this->assertArrayHasKey('editor', $supports);
    }

    public function test_campaign_post_type_has_rest_support() {
        $obj = get_post_type_object('wpsg_campaign');
        $this->assertTrue($obj->show_in_rest);
    }

    // ── Taxonomy registration ──────────────────────────────────────────────

    public function test_wpsg_company_taxonomy_is_registered() {
        $this->assertTrue(taxonomy_exists('wpsg_company'));
    }

    public function test_wpsg_campaign_tag_taxonomy_is_registered() {
        $this->assertTrue(taxonomy_exists('wpsg_campaign_tag'));
    }

    public function test_wpsg_campaign_category_taxonomy_is_registered() {
        $this->assertTrue(taxonomy_exists('wpsg_campaign_category'));
    }

    public function test_wpsg_media_tag_taxonomy_is_registered() {
        $this->assertTrue(taxonomy_exists('wpsg_media_tag'));
    }

    public function test_company_taxonomy_applies_to_campaign() {
        $taxonomies = get_object_taxonomies('wpsg_campaign');
        $this->assertContains('wpsg_company', $taxonomies);
        $this->assertContains('wpsg_campaign_tag', $taxonomies);
    }

    // ── CPT_CAPS constant ──────────────────────────────────────────────────

    public function test_cpt_caps_constant_is_array() {
        $this->assertIsArray(WPSG_CPT::CPT_CAPS);
    }

    public function test_cpt_caps_contains_expected_capabilities() {
        $expected = [
            'edit_wpsg_campaigns',
            'edit_others_wpsg_campaigns',
            'publish_wpsg_campaigns',
            'read_private_wpsg_campaigns',
            'delete_wpsg_campaigns',
            'delete_private_wpsg_campaigns',
            'delete_published_wpsg_campaigns',
            'delete_others_wpsg_campaigns',
            'edit_private_wpsg_campaigns',
            'edit_published_wpsg_campaigns',
        ];

        foreach ($expected as $cap) {
            $this->assertContains($cap, WPSG_CPT::CPT_CAPS, "Missing capability: $cap");
        }
    }

    // ── Post meta registration ─────────────────────────────────────────────

    public function test_campaign_meta_fields_are_registered() {
        // Registered meta keys for wpsg_campaign.
        $registered = get_registered_meta_keys('post', 'wpsg_campaign');

        $expected_keys = ['visibility', 'status', 'media_items', 'tags', 'cover_image'];
        foreach ($expected_keys as $key) {
            $this->assertArrayHasKey($key, $registered, "Meta key '$key' not registered for wpsg_campaign");
        }
    }

    // ── Sanitization methods ───────────────────────────────────────────────

    public function test_sanitize_visibility_valid_values() {
        $this->assertEquals('public', WPSG_CPT::sanitize_visibility('public'));
        $this->assertEquals('private', WPSG_CPT::sanitize_visibility('private'));
    }

    public function test_sanitize_visibility_invalid_returns_public() {
        $this->assertEquals('public', WPSG_CPT::sanitize_visibility('invalid'));
        $this->assertEquals('public', WPSG_CPT::sanitize_visibility(''));
        $this->assertEquals('public', WPSG_CPT::sanitize_visibility('unlisted'));
    }

    public function test_sanitize_status_valid_values() {
        $this->assertEquals('active', WPSG_CPT::sanitize_status('active'));
        $this->assertEquals('draft', WPSG_CPT::sanitize_status('draft'));
        $this->assertEquals('archived', WPSG_CPT::sanitize_status('archived'));
    }

    public function test_sanitize_status_invalid_returns_draft() {
        $this->assertEquals('draft', WPSG_CPT::sanitize_status('invalid'));
        $this->assertEquals('draft', WPSG_CPT::sanitize_status(''));
    }

    public function test_sanitize_media_items_strips_html() {
        $items = [
            [
                'id'       => '<script>alert(1)</script>abc',
                'url'      => 'https://example.com/img.jpg',
                'title'    => 'Clean <b>Title</b>',
                'thumbnail' => 'https://example.com/thumb.jpg',
            ],
        ];

        $result = WPSG_CPT::sanitize_media_items($items);
        $this->assertIsArray($result);
        $this->assertCount(1, $result);
        // ID should be sanitized.
        $this->assertStringNotContainsString('<script>', $result[0]['id']);
    }

    public function test_sanitize_media_items_returns_empty_for_non_array() {
        $this->assertEquals([], WPSG_CPT::sanitize_media_items('not-an-array'));
        $this->assertEquals([], WPSG_CPT::sanitize_media_items(null));
    }

    public function test_sanitize_tags_returns_array() {
        $result = WPSG_CPT::sanitize_tags(['tag1', 'tag2', '<b>bold</b>']);
        $this->assertIsArray($result);
        $this->assertContains('tag1', $result);
        $this->assertContains('tag2', $result);
    }

    public function test_sanitize_tags_returns_empty_for_non_array() {
        $this->assertEquals([], WPSG_CPT::sanitize_tags('string'));
        $this->assertEquals([], WPSG_CPT::sanitize_tags(null));
    }

    public function test_sanitize_datetime_valid_iso8601() {
        $input = '2024-03-15T10:30:00Z';
        $result = WPSG_CPT::sanitize_datetime($input);
        $this->assertNotEmpty($result);
    }

    public function test_sanitize_datetime_rejects_invalid() {
        $result = WPSG_CPT::sanitize_datetime('not-a-date');
        $this->assertEmpty($result);
    }

    public function test_sanitize_datetime_empty_input() {
        $result = WPSG_CPT::sanitize_datetime('');
        $this->assertEmpty($result);
    }

    // ── Integration: creating a campaign with meta ─────────────────────────

    public function test_campaign_meta_round_trip() {
        $user_id = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $user->add_cap($cap);
        }
        wp_set_current_user($user_id);

        $cid = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Meta Round Trip',
            'post_status' => 'publish',
        ]);

        update_post_meta($cid, 'visibility', 'public');
        update_post_meta($cid, 'status', 'active');
        update_post_meta($cid, 'media_items', [
            ['id' => 'm1', 'url' => 'https://example.com/1.jpg', 'title' => 'Image 1'],
        ]);

        $this->assertEquals('public', get_post_meta($cid, 'visibility', true));
        $this->assertEquals('active', get_post_meta($cid, 'status', true));

        $items = get_post_meta($cid, 'media_items', true);
        $this->assertIsArray($items);
        $this->assertCount(1, $items);
    }
}
