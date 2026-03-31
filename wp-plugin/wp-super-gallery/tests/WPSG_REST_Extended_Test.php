<?php

/**
 * Extended REST endpoint tests covering previously untested handlers.
 *
 * Covers: duplicate, batch, export, import, analytics, media CRUD,
 * media usage, access control, companies, users, roles, permissions,
 * nonce, taxonomy endpoints, admin health/cache, layout templates,
 * overlay library, and audit.
 */
class WPSG_REST_Extended_Test extends WP_UnitTestCase {

    private $admin_id;

    public function setUp(): void {
        parent::setUp();
        $this->admin_id = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $this->admin_id);
        $user->add_cap('manage_wpsg');
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $user->add_cap($cap);
        }
        wp_set_current_user($this->admin_id);

        // Ensure CPT is registered.
        WPSG_CPT::register();
    }

    private function create_campaign(string $title = 'Test Campaign', string $status = 'active'): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $title,
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', $status);
        update_post_meta($id, 'visibility', 'public');
        update_post_meta($id, 'media_items', []);
        update_post_meta($id, 'tags', []);
        return $id;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Campaign Management
    // ═══════════════════════════════════════════════════════════════════════

    public function test_duplicate_campaign() {
        $cid = $this->create_campaign('Original');
        update_post_meta($cid, 'media_items', [
            ['id' => 'm1', 'url' => 'https://example.com/1.jpg', 'title' => 'Img'],
        ]);
        update_post_meta($cid, '_wpsg_gallery_overrides', wp_json_encode([
            'mode' => 'unified',
            'breakpoints' => [
                'desktop' => [
                    'unified' => [
                        'adapterId' => 'classic',
                    ],
                ],
            ],
        ]));

        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/duplicate");
        $res = rest_do_request($req);

        $this->assertContains($res->get_status(), [200, 201]);
        $data = $res->get_data();
        $this->assertNotEquals($cid, $data['id'] ?? $cid);
        $this->assertEquals('unified', $data['galleryOverrides']['mode'] ?? null);
        $this->assertEquals(
            'classic',
            $data['galleryOverrides']['breakpoints']['desktop']['unified']['adapterId'] ?? null
        );
    }

    public function test_batch_campaigns_archive() {
        $c1 = $this->create_campaign('Batch1');
        $c2 = $this->create_campaign('Batch2');

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns/batch');
        $req->set_param('action', 'archive');
        $req->set_param('ids', [$c1, $c2]);
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
    }

    public function test_export_campaign() {
        $cid = $this->create_campaign('Export Me');

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$cid}/export");
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $data = $res->get_data();
        $this->assertArrayHasKey('version', $data);
    }

    public function test_import_campaign() {
        $payload = [
            'version'  => 1,
            'campaign' => [
                'title'       => 'Imported Campaign',
                'description' => 'From export',
                'visibility'  => 'private',
                'status'      => 'draft',
                'tags'        => ['imported'],
                'galleryOverrides' => [
                    'mode' => 'per-type',
                    'breakpoints' => [
                        'desktop' => [
                            'image' => [
                                'adapterId' => 'masonry',
                            ],
                            'video' => [
                                'adapterId' => 'diamond',
                            ],
                        ],
                    ],
                ],
                'media_items' => [],
            ],
        ];

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns/import');
        $req->set_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode($payload));
        $res = rest_do_request($req);

        $this->assertContains($res->get_status(), [200, 201]);
        $data = $res->get_data();
        $this->assertEquals('per-type', $data['galleryOverrides']['mode'] ?? null);
        $this->assertEquals(
            'masonry',
            $data['galleryOverrides']['breakpoints']['desktop']['image']['adapterId'] ?? null
        );
        $this->assertEquals(
            'diamond',
            $data['galleryOverrides']['breakpoints']['desktop']['video']['adapterId'] ?? null
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Media CRUD
    // ═══════════════════════════════════════════════════════════════════════

    public function test_list_media() {
        $cid = $this->create_campaign('Media List');
        update_post_meta($cid, 'media_items', [
            ['id' => 'm1', 'url' => 'https://example.com/1.jpg', 'title' => 'One', 'type' => 'image'],
            ['id' => 'm2', 'url' => 'https://example.com/2.jpg', 'title' => 'Two', 'type' => 'image'],
        ]);

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$cid}/media");
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $data = $res->get_data();
        $this->assertIsArray($data);
    }

    public function test_delete_media() {
        $cid = $this->create_campaign('Delete Media');
        update_post_meta($cid, 'media_items', [
            ['id' => 'del1', 'url' => 'https://example.com/1.jpg', 'title' => 'Del'],
        ]);

        $req = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/campaigns/{$cid}/media/del1");
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $items = get_post_meta($cid, 'media_items', true);
        $remaining = array_filter($items, fn($i) => ($i['id'] ?? '') === 'del1');
        $this->assertEmpty($remaining);
    }

    public function test_update_media() {
        $cid = $this->create_campaign('Update Media');
        update_post_meta($cid, 'media_items', [
            ['id' => 'upd1', 'url' => 'https://example.com/1.jpg', 'title' => 'Old', 'type' => 'image'],
        ]);

        $req = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$cid}/media/upd1");
        $req->set_param('caption', 'New Caption');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
    }

    public function test_reorder_media() {
        $cid = $this->create_campaign('Reorder');
        update_post_meta($cid, 'media_items', [
            ['id' => 'r1', 'url' => 'https://example.com/1.jpg', 'title' => 'A', 'order' => 0],
            ['id' => 'r2', 'url' => 'https://example.com/2.jpg', 'title' => 'B', 'order' => 1],
        ]);

        $req = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$cid}/media/reorder");
        $req->set_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode([
            'items' => [
                ['id' => 'r1', 'order' => 1],
                ['id' => 'r2', 'order' => 0],
            ],
        ]));
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
    }

    public function test_rescan_media_types() {
        $cid = $this->create_campaign('Rescan');
        update_post_meta($cid, 'media_items', [
            ['id' => 'rs1', 'url' => 'https://example.com/video.mp4', 'title' => 'Video', 'type' => 'unknown'],
        ]);

        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/media/rescan");
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
    }

    public function test_rescan_all_media_types() {
        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/media/rescan-all');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $data = $res->get_data();
        $this->assertArrayHasKey('campaigns_scanned', $data);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Media Usage
    // ═══════════════════════════════════════════════════════════════════════

    public function test_get_media_usage_endpoint() {
        // Ensure refs table exists.
        WPSG_DB::maybe_upgrade();

        $cid = $this->create_campaign('Usage Test');
        WPSG_DB::sync_media_refs($cid, [['id' => 'mu_1']]);

        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/media/mu_1/usage');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $data = $res->get_data();
        $this->assertIsArray($data);
    }

    public function test_get_media_usage_summary_endpoint() {
        WPSG_DB::maybe_upgrade();

        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/media/usage-summary');
        $req->set_param('ids', ['abc', 'def']);
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Analytics
    // ═══════════════════════════════════════════════════════════════════════

    public function test_get_campaign_analytics() {
        WPSG_DB::maybe_upgrade();
        $cid = $this->create_campaign('Analytics');

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/analytics/campaigns/{$cid}");
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $data = $res->get_data();
        $this->assertArrayHasKey('totalViews', $data);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Access Control
    // ═══════════════════════════════════════════════════════════════════════

    public function test_list_access() {
        $cid = $this->create_campaign('Access Test');

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$cid}/access");
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $this->assertIsArray($res->get_data());
    }

    public function test_grant_and_revoke_access() {
        $cid = $this->create_campaign('Grant Access');
        $viewer = self::factory()->user->create(['role' => 'subscriber']);

        // Grant access.
        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access");
        $req->set_param('userId', $viewer);
        $req->set_param('source', 'campaign');
        $res = rest_do_request($req);
        $this->assertEquals(200, $res->get_status());

        // Revoke access.
        $req2 = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/campaigns/{$cid}/access/{$viewer}");
        $res2 = rest_do_request($req2);
        $this->assertEquals(200, $res2->get_status());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Audit
    // ═══════════════════════════════════════════════════════════════════════

    public function test_list_audit() {
        $cid = $this->create_campaign('Audit Test');

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$cid}/audit");
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $this->assertIsArray($res->get_data());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Users & Roles & Permissions
    // ═══════════════════════════════════════════════════════════════════════

    public function test_search_users() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/users/search');
        $req->set_param('search', 'admin');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $this->assertIsArray($res->get_data());
    }

    public function test_list_roles() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/roles');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $data = $res->get_data();
        $this->assertIsArray($data);
        $this->assertNotEmpty($data);
    }

    public function test_list_permissions() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/permissions');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $data = $res->get_data();
        $this->assertArrayHasKey('isAdmin', $data);
        $this->assertArrayHasKey('userId', $data);
    }

    public function test_refresh_nonce() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/nonce');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $data = $res->get_data();
        $this->assertArrayHasKey('nonce', $data);
    }

    public function test_create_user() {
        // Capture wp_mail to prevent actual sends.
        add_filter('pre_wp_mail', function () { return true; }, 10, 0);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/users');
        $req->set_param('email', 'newuser-' . uniqid() . '@example.com');
        $req->set_param('displayName', 'Test User');
        $req->set_param('role', 'subscriber');
        $res = rest_do_request($req);

        $this->assertContains($res->get_status(), [200, 201]);
        $data = $res->get_data();
        $this->assertArrayHasKey('userId', $data);
    }

    public function test_create_user_applies_authenticated_rate_limit() {
        add_filter('wpsg_rate_limit_authenticated', fn() => 1);
        add_filter('pre_wp_mail', function () { return true; }, 10, 0);
        $_SERVER['REMOTE_ADDR'] = '198.51.100.33';

        $first = new WP_REST_Request('POST', '/wp-super-gallery/v1/users');
        $first->set_param('email', 'limited-user-' . uniqid() . '@example.com');
        $first->set_param('displayName', 'Limited User One');
        $first->set_param('role', 'subscriber');

        $second = new WP_REST_Request('POST', '/wp-super-gallery/v1/users');
        $second->set_param('email', 'limited-user-' . uniqid() . '@example.com');
        $second->set_param('displayName', 'Limited User Two');
        $second->set_param('role', 'subscriber');

        $first_response = rest_do_request($first);
        $second_response = rest_do_request($second);

        $this->assertContains($first_response->get_status(), [200, 201]);
        $this->assertEquals(429, $second_response->get_status());

        remove_all_filters('wpsg_rate_limit_authenticated');
        unset($_SERVER['REMOTE_ADDR']);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Taxonomy Endpoints
    // ═══════════════════════════════════════════════════════════════════════

    public function test_list_campaign_categories() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaign-categories');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $this->assertIsArray($res->get_data());
    }

    public function test_list_campaign_tags() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/tags/campaign');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $this->assertIsArray($res->get_data());
    }

    public function test_list_media_tags() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/tags/media');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $this->assertIsArray($res->get_data());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Company Endpoints
    // ═══════════════════════════════════════════════════════════════════════

    public function test_list_companies() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/companies');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $this->assertIsArray($res->get_data());
    }

    public function test_archive_company() {
        // Create a company term.
        $term = wp_insert_term('Test Corp', 'wpsg_company');
        $term_id = is_array($term) ? $term['term_id'] : 0;
        $this->assertGreaterThan(0, $term_id);

        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/companies/{$term_id}/archive");
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
    }

    public function test_list_company_access() {
        $term = wp_insert_term('Access Corp', 'wpsg_company');
        $term_id = is_array($term) ? $term['term_id'] : 0;

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/companies/{$term_id}/access");
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
    }

    public function test_grant_and_revoke_company_access() {
        $term = wp_insert_term('Grant Corp', 'wpsg_company');
        $term_id = is_array($term) ? $term['term_id'] : 0;
        $viewer = self::factory()->user->create(['role' => 'subscriber']);

        // Grant.
        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/companies/{$term_id}/access");
        $req->set_param('userId', $viewer);
        $res = rest_do_request($req);
        $this->assertEquals(200, $res->get_status());

        // Revoke.
        $req2 = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/companies/{$term_id}/access/{$viewer}");
        $res2 = rest_do_request($req2);
        $this->assertEquals(200, $res2->get_status());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Admin Health & Cache
    // ═══════════════════════════════════════════════════════════════════════

    public function test_get_health_data_endpoint() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/admin/health');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $data = $res->get_data();
        $this->assertArrayHasKey('phpVersion', $data);
    }

    public function test_get_oembed_failures_endpoint() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/admin/oembed-failures');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
    }

    public function test_reset_oembed_failures_endpoint() {
        $req = new WP_REST_Request('DELETE', '/wp-super-gallery/v1/admin/oembed-failures');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
    }

    public function test_get_thumbnail_cache_stats_endpoint() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/admin/thumbnail-cache');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $data = $res->get_data();
        $this->assertArrayHasKey('totalFiles', $data);
    }

    public function test_clear_thumbnail_cache_endpoint() {
        $req = new WP_REST_Request('DELETE', '/wp-super-gallery/v1/admin/thumbnail-cache');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
    }

    public function test_refresh_thumbnail_cache_endpoint() {
        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/thumbnail-cache/refresh');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Layout Template REST Endpoints
    // ═══════════════════════════════════════════════════════════════════════

    public function test_list_layout_templates_endpoint() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/admin/layout-templates');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $this->assertIsArray($res->get_data());
    }

    public function test_create_layout_template_endpoint() {
        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/layout-templates');
        $req->set_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode([
            'name' => 'Test Template',
            'slots' => [
                ['type' => 'media', 'width' => '100%', 'height' => 'auto'],
            ],
        ]));
        $res = rest_do_request($req);

        $this->assertContains($res->get_status(), [200, 201]);
        $data = $res->get_data();
        $this->assertArrayHasKey('id', $data);

        return $data['id'];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Overlay Library REST
    // ═══════════════════════════════════════════════════════════════════════

    public function test_list_overlay_library_endpoint() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/admin/overlay-library');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $this->assertIsArray($res->get_data());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Access Request Workflow
    // ═══════════════════════════════════════════════════════════════════════

    private function setup_access_request_tables(): void {
        WPSG_DB::maybe_upgrade();
    }

    public function test_list_access_requests() {
        $this->setup_access_request_tables();
        $cid = $this->create_campaign('Access Req List');

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $this->assertIsArray($res->get_data());
    }

    public function test_submit_access_request_returns_201_and_token() {
        $this->setup_access_request_tables();
        $cid = $this->create_campaign('AR Submit');

        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $req->set_body_params(['email' => 'newuser@example.com']);
        $res = rest_do_request($req);

        $this->assertEquals(201, $res->get_status());
        $data = $res->get_data();
        $this->assertArrayHasKey('token', $data);
        $this->assertNotEmpty($data['token']);
    }

    public function test_submit_access_request_rejects_invalid_email() {
        $this->setup_access_request_tables();
        $cid = $this->create_campaign('AR Bad Email');

        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $req->set_body_params(['email' => 'not-an-email']);
        $res = rest_do_request($req);

        $this->assertEquals(400, $res->get_status());
    }

    public function test_submit_access_request_404_for_missing_campaign() {
        $this->setup_access_request_tables();

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns/999999/access-requests');
        $req->set_body_params(['email' => 'test@example.com']);
        $res = rest_do_request($req);

        $this->assertEquals(404, $res->get_status());
    }

    public function test_submit_duplicate_pending_request_returns_409() {
        $this->setup_access_request_tables();
        $cid = $this->create_campaign('AR Dup');

        // First submission.
        $req1 = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $req1->set_body_params(['email' => 'dup@example.com']);
        $res1 = rest_do_request($req1);
        $this->assertEquals(201, $res1->get_status());

        // Duplicate while still pending.
        $req2 = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $req2->set_body_params(['email' => 'dup@example.com']);
        $res2 = rest_do_request($req2);
        $this->assertEquals(409, $res2->get_status());
    }

    public function test_submit_after_denial_within_cooldown_returns_429() {
        $this->setup_access_request_tables();
        $cid = $this->create_campaign('AR Cooldown');

        // Submit + deny.
        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $req->set_body_params(['email' => 'cool@example.com']);
        $res = rest_do_request($req);
        $token = $res->get_data()['token'];

        $deny = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests/{$token}/deny");
        rest_do_request($deny);

        // Re-submit within 24h.
        $req2 = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $req2->set_body_params(['email' => 'cool@example.com']);
        $res2 = rest_do_request($req2);
        $this->assertEquals(429, $res2->get_status());
    }

    public function test_approve_access_request_provisions_user() {
        $this->setup_access_request_tables();
        $cid = $this->create_campaign('AR Approve');

        // Submit.
        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $req->set_body_params(['email' => 'approve-me@example.com']);
        $res = rest_do_request($req);
        $token = $res->get_data()['token'];

        // Approve.
        $approve = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests/{$token}/approve");
        $ares = rest_do_request($approve);
        $this->assertEquals(200, $ares->get_status());

        // Status should be approved.
        $row = WPSG_DB::get_access_request($token);
        $this->assertEquals('approved', $row['status']);
        $this->assertNotNull($row['resolved_at']);

        // A WP user should exist for the email.
        $user = get_user_by('email', 'approve-me@example.com');
        $this->assertNotFalse($user);
    }

    public function test_approve_already_resolved_returns_409() {
        $this->setup_access_request_tables();
        $cid = $this->create_campaign('AR Already');

        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $req->set_body_params(['email' => 'resolved@example.com']);
        $token = rest_do_request($req)->get_data()['token'];

        // Approve first time.
        $a1 = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests/{$token}/approve");
        $this->assertEquals(200, rest_do_request($a1)->get_status());

        // Approve again — should be 409.
        $a2 = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests/{$token}/approve");
        $this->assertEquals(409, rest_do_request($a2)->get_status());
    }

    public function test_deny_access_request() {
        $this->setup_access_request_tables();
        $cid = $this->create_campaign('AR Deny');

        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $req->set_body_params(['email' => 'deny-me@example.com']);
        $token = rest_do_request($req)->get_data()['token'];

        $deny = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests/{$token}/deny");
        $dres = rest_do_request($deny);
        $this->assertEquals(200, $dres->get_status());

        $row = WPSG_DB::get_access_request($token);
        $this->assertEquals('denied', $row['status']);
    }

    public function test_approve_nonexistent_token_returns_404() {
        $this->setup_access_request_tables();
        $cid = $this->create_campaign('AR Missing');

        $fake_token = wp_generate_uuid4();
        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests/{$fake_token}/approve");
        $res = rest_do_request($req);
        $this->assertEquals(404, $res->get_status());
    }

    public function test_list_access_requests_returns_formatted_entries() {
        $this->setup_access_request_tables();
        $cid = $this->create_campaign('AR List Format');

        // Submit two requests.
        foreach (['a@e.com', 'b@e.com'] as $email) {
            $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
            $req->set_body_params(['email' => $email]);
            rest_do_request($req);
        }

        $list = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $res = rest_do_request($list);
        $data = $res->get_data();

        $this->assertEquals(200, $res->get_status());
        $this->assertCount(2, $data);
        // Check response shape.
        $first = $data[0];
        $this->assertArrayHasKey('token', $first);
        $this->assertArrayHasKey('email', $first);
        $this->assertArrayHasKey('status', $first);
        $this->assertArrayHasKey('requested_at', $first);
    }

    public function test_list_access_requests_filters_by_status_param() {
        $this->setup_access_request_tables();
        $cid = $this->create_campaign('AR Status Filter');

        // Submit 2 requests, approve one.
        $req1 = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $req1->set_body_params(['email' => 'f1@e.com']);
        $t1 = rest_do_request($req1)->get_data()['token'];

        $req2 = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $req2->set_body_params(['email' => 'f2@e.com']);
        rest_do_request($req2);

        $approve = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests/{$t1}/approve");
        rest_do_request($approve);

        // Filter pending — should get 1.
        $listPending = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $listPending->set_param('status', 'pending');
        $pending = rest_do_request($listPending)->get_data();
        $this->assertCount(1, $pending);
        $this->assertEquals('f2@e.com', $pending[0]['email']);

        // Filter approved — should get 1.
        $listApproved = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $listApproved->set_param('status', 'approved');
        $approved = rest_do_request($listApproved)->get_data();
        $this->assertCount(1, $approved);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Media Library (WP attachments)
    // ═══════════════════════════════════════════════════════════════════════

    public function test_list_media_library() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/media/library');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $this->assertIsArray($res->get_data());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Unauthenticated access checks
    // ═══════════════════════════════════════════════════════════════════════

    public function test_admin_endpoints_reject_unauthenticated() {
        wp_set_current_user(0);

        $admin_routes = [
            ['GET', '/wp-super-gallery/v1/admin/health'],
            ['GET', '/wp-super-gallery/v1/users/search'],
            ['GET', '/wp-super-gallery/v1/roles'],
        ];

        foreach ($admin_routes as [$method, $route]) {
            $req = new WP_REST_Request($method, $route);
            $res = rest_do_request($req);
            $this->assertGreaterThanOrEqual(
                400,
                $res->get_status(),
                "Route $route should reject unauthenticated request"
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Cache Version
    // ═══════════════════════════════════════════════════════════════════════

    public function test_get_cache_version_returns_integer() {
        delete_option('wpsg_cache_version');
        $v = WPSG_REST::get_cache_version();
        $this->assertIsInt($v);
        $this->assertGreaterThanOrEqual(1, $v);
    }

    public function test_bump_cache_version_increments() {
        delete_option('wpsg_cache_version');
        $before = WPSG_REST::get_cache_version();
        WPSG_REST::bump_cache_version();
        $after = WPSG_REST::get_cache_version();
        $this->assertEquals($before + 1, $after);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Record Analytics Event
    // ═══════════════════════════════════════════════════════════════════════

    public function test_record_analytics_event_disabled_by_default() {
        WPSG_DB::maybe_upgrade();
        $cid = $this->create_campaign('Analytics Record');

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/analytics/event');
        $req->set_param('campaign_id', $cid);
        $req->set_param('event_type', 'view');
        $res = rest_do_request($req);

        // Analytics disabled by default (enable_analytics not set).
        $this->assertEquals(403, $res->get_status());
    }

    public function test_record_analytics_event_when_enabled() {
        WPSG_DB::maybe_upgrade();
        $cid = $this->create_campaign('Analytics Record On');

        // Enable analytics.
        $settings = get_option('wpsg_settings', []);
        $settings['enable_analytics'] = true;
        update_option('wpsg_settings', $settings);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/analytics/event');
        $req->set_param('campaign_id', $cid);
        $req->set_param('event_type', 'view');
        $res = rest_do_request($req);

        $this->assertEquals(201, $res->get_status());
        $data = $res->get_data();
        $this->assertTrue($data['recorded']);

        // Cleanup.
        $settings['enable_analytics'] = false;
        update_option('wpsg_settings', $settings);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Layout Template Public
    // ═══════════════════════════════════════════════════════════════════════

    public function test_get_layout_template_public_not_found() {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/layout-templates/00000000-0000-0000-0000-000000000000');
        $res = rest_do_request($req);

        $this->assertEquals(404, $res->get_status());
    }

    public function test_get_layout_template_public_success() {
        // Create a template via the class directly.
        $tpl = WPSG_Layout_Templates::create([
            'name' => 'Public Template',
            'config' => ['columns' => 3],
        ]);
        $this->assertIsArray($tpl);
        $id = $tpl['id'];

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/layout-templates/{$id}");
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status());
        $data = $res->get_data();
        $this->assertEquals('Public Template', $data['name']);
    }
}
