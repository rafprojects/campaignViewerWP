<?php

class WPSG_Campaign_Rest_Test extends WP_UnitTestCase {
    private function set_admin_user(): int {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        wp_set_current_user($user_id);
        return $user_id;
    }

    public function test_campaign_create_update_archive_restore_flow() {
        $this->set_admin_user();

        // Create campaign
        $create = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns');
        $create->set_param('title', 'Test Campaign');
        $create->set_param('description', 'Initial description');
        $create->set_param('visibility', 'private');
        $create->set_param('status', 'active');
        $create->set_param('company', 'acme');
        $create->set_param('tags', ['launch']);

        $create_response = rest_do_request($create);
        $this->assertEquals(201, $create_response->get_status());
        $created = $create_response->get_data();
        $this->assertEquals('Test Campaign', $created['title'] ?? null);
        $campaign_id = intval($created['id'] ?? 0);
        $this->assertGreaterThan(0, $campaign_id);

        // Update campaign
        $update = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$campaign_id}");
        $update->set_param('title', 'Updated Campaign');
        $update->set_param('description', 'Updated description');
        $update->set_param('visibility', 'public');
        $update_response = rest_do_request($update);
        $this->assertEquals(200, $update_response->get_status());
        $updated = $update_response->get_data();
        $this->assertEquals('Updated Campaign', $updated['title'] ?? null);

        // Archive campaign
        $archive = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/archive");
        $archive_response = rest_do_request($archive);
        $this->assertEquals(200, $archive_response->get_status());
        $this->assertEquals('archived', get_post_meta($campaign_id, 'status', true));

        // Restore campaign
        $restore = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/restore");
        $restore_response = rest_do_request($restore);
        $this->assertEquals(200, $restore_response->get_status());
        $this->assertEquals('active', get_post_meta($campaign_id, 'status', true));
    }
}
