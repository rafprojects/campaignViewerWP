<?php

/**
 * P66-E: user campaign templates (wpsg_campaign posts flagged
 * _wpsg_is_template) must not surface in the campaigns.list API. They remain
 * reachable through the dedicated templates endpoint.
 */
class WPSG_P66E_Template_Listing_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        $user_id = self::factory()->user->create(['role' => 'administrator']);
        $user    = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $user->add_cap($cap);
        }
        wp_set_current_user($user_id);
        // Isolate this test's cache key from any prior listing.
        WPSG_REST::bump_cache_version();
    }

    public function tearDown(): void {
        wp_set_current_user(0);
        parent::tearDown();
    }

    private function create_campaign(string $title, bool $is_template = false): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $title,
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', $is_template ? 'draft' : 'active');
        if ($is_template) {
            update_post_meta($id, WPSG_Campaign_Templates::META_IS_TEMPLATE, '1');
        }
        return intval($id);
    }

    private function list_ids(): array {
        $request  = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $request->set_param('include_archived', 'true');
        $request->set_param('per_page', 50);
        $data = rest_do_request($request)->get_data();
        return array_map('strval', array_column($data['items'], 'id'));
    }

    public function test_templates_absent_from_campaign_list() {
        $normal   = $this->create_campaign('Regular Campaign');
        $template = $this->create_campaign('Saved Template', true);

        $ids = $this->list_ids();

        $this->assertContains((string) $normal, $ids, 'A normal campaign must be listed');
        $this->assertNotContains((string) $template, $ids, 'A template must be excluded from campaigns.list');
    }

    public function test_templates_still_returned_by_templates_api() {
        $template = $this->create_campaign('Saved Template', true);

        $templates = WPSG_Campaign_Templates::get_user_templates();
        $ids       = array_map(function ($t) { return (string) $t['id']; }, $templates);

        $this->assertContains((string) $template, $ids, 'Templates must remain reachable through their own endpoint');
    }
}
