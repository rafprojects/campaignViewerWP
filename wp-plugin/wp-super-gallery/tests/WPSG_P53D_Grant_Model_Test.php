<?php

/**
 * P53-D: editing/managing comes from the wpsg_editor role; grants are viewer-only.
 *
 * - A space editor (manage_wpsg) can edit campaigns in spaces they can access;
 *   a delegated-space editor WITHOUT access cannot (closes the residual F2 gap
 *   on the edit endpoints).
 * - A non-admin with a legacy editor/owner grant can VIEW but not mutate.
 * - The campaign access-grant endpoint only accepts the `viewer` level.
 */
class WPSG_P53D_Grant_Model_Test extends WP_UnitTestCase {

    private function set_system_admin(): int {
        $uid  = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg');
        wp_set_current_user($uid);
        return $uid;
    }

    /** Space editor: manage_wpsg but NOT manage_options. */
    private function make_editor(): int {
        $uid  = self::factory()->user->create(['role' => 'subscriber']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg');
        return $uid;
    }

    private function make_space(string $iso = 'open'): int {
        return WPSG_DB::insert_space([
            'name'           => 'D ' . $iso,
            'slug'           => 'd-' . wp_generate_password(6, false),
            'isolation_mode' => $iso,
        ]);
    }

    private function grant_space(int $space_id, int $user_id): void {
        WPSG_DB::update_space($space_id, [
            'access_grants' => [['userId' => $user_id, 'access_level' => 'viewer']],
        ]);
    }

    private function campaign(int $space_id = 0, string $visibility = 'public'): int {
        $id = wp_insert_post(['post_type' => 'wpsg_campaign', 'post_title' => 'D', 'post_status' => 'publish']);
        update_post_meta($id, 'status', 'active');
        update_post_meta($id, 'visibility', $visibility);
        if ($space_id > 0) {
            update_post_meta($id, '_wpsg_space_id', $space_id);
        }
        return intval($id);
    }

    private function update_status(int $cid): int {
        $req = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$cid}");
        $req->set_param('title', 'Edited');
        return rest_do_request($req)->get_status();
    }

    // ── Editing comes from the role + space access ────────────────────────

    public function test_editor_role_can_edit_campaign_in_accessible_space() {
        // P53-A: open-mode no longer grants implicit access; editor needs explicit grant.
        $editor = $this->make_editor();
        $space  = $this->make_space('open');
        $this->grant_space($space, $editor);
        $cid = $this->campaign($space);
        wp_set_current_user($editor);

        $this->assertSame(200, $this->update_status($cid), 'a wpsg_editor may edit a campaign in a space it has been granted access to');
    }

    public function test_editor_role_denied_in_delegated_space_without_access() {
        $editor = $this->make_editor();
        $cid    = $this->campaign($this->make_space('delegated'));
        wp_set_current_user($editor);

        // Closes the residual F2 gap: bare manage_wpsg no longer bypasses space scope on edit endpoints.
        $this->assertSame(403, $this->update_status($cid), 'a wpsg_editor cannot edit campaigns in a delegated space they lack access to');
    }

    public function test_editor_role_allowed_in_delegated_space_with_grant() {
        $editor = $this->make_editor();
        $space  = $this->make_space('delegated');
        $this->grant_space($space, $editor);
        $cid = $this->campaign($space);
        wp_set_current_user($editor);

        $this->assertSame(200, $this->update_status($cid), 'a granted wpsg_editor may edit in a delegated space');
    }

    // ── A legacy grant lets you view, not mutate ──────────────────────────

    public function test_legacy_editor_grant_can_view_but_not_edit() {
        $admin = $this->set_system_admin();
        $cid   = $this->campaign(0, 'private');
        // Subscriber with a legacy campaign-level 'editor' grant.
        $sub = self::factory()->user->create(['role' => 'subscriber']);
        update_post_meta($cid, 'access_grants', [[
            'userId' => $sub, 'campaignId' => $cid, 'source' => 'campaign',
            'grantedAt' => gmdate('c'), 'access_level' => 'editor',
        ]]);
        wp_set_current_user($sub);

        $view = rest_do_request(new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$cid}"))->get_status();
        $this->assertSame(200, $view, 'a granted user can still VIEW the private campaign');
        $this->assertSame(403, $this->update_status($cid), 'a legacy editor grant must NOT confer edit rights');
    }

    // ── The grant endpoint is viewer-only ─────────────────────────────────

    public function test_grant_endpoint_rejects_non_viewer_level() {
        $this->set_system_admin();
        $cid = $this->campaign();
        $target = self::factory()->user->create(['role' => 'subscriber']);

        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access");
        $req->set_param('userId', $target);
        $req->set_param('source', 'campaign');
        $req->set_param('access_level', 'editor'); // no longer allowed
        $this->assertSame(400, rest_do_request($req)->get_status(), 'access_level=editor must be rejected by the viewer-only enum');

        $ok = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access");
        $ok->set_param('userId', $target);
        $ok->set_param('source', 'campaign');
        $ok->set_param('access_level', 'viewer');
        $this->assertSame(200, rest_do_request($ok)->get_status(), 'a viewer grant is accepted');
    }

    // ── Space management is role + space-scoped (require_space_admin) ──────

    public function test_editor_can_manage_accessible_space() {
        // P53-A: open-mode no longer grants implicit access; editor needs explicit grant.
        $editor = $this->make_editor();
        $space  = $this->make_space('open');
        $this->grant_space($space, $editor);
        $target = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($editor);

        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/spaces/{$space}/access");
        $req->set_param('userId', $target);
        $req->set_param('access_level', 'viewer');
        $this->assertSame(200, rest_do_request($req)->get_status(), 'an editor may manage access in a space it has been granted access to');
    }

    public function test_editor_denied_managing_delegated_space_without_access() {
        $editor = $this->make_editor();
        $space  = $this->make_space('delegated');
        $target = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($editor);

        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/spaces/{$space}/access");
        $req->set_param('userId', $target);
        $req->set_param('access_level', 'viewer');
        $this->assertSame(403, rest_do_request($req)->get_status(), 'an editor without space access cannot manage it (F2)');
    }

    public function test_subscriber_viewer_grant_can_read_but_not_manage_space() {
        $sub   = self::factory()->user->create(['role' => 'subscriber']);
        $space = $this->make_space('delegated');
        $this->grant_space($space, $sub);
        wp_set_current_user($sub);

        $read = rest_do_request(new WP_REST_Request('GET', "/wp-super-gallery/v1/spaces/{$space}/settings"))->get_status();
        $this->assertSame(200, $read, 'a space viewer-grantee can READ the space');

        $target = self::factory()->user->create(['role' => 'subscriber']);
        $manage = new WP_REST_Request('POST', "/wp-super-gallery/v1/spaces/{$space}/access");
        $manage->set_param('userId', $target);
        $manage->set_param('access_level', 'viewer');
        $this->assertSame(403, rest_do_request($manage)->get_status(), 'a viewer-grantee (no manage_wpsg) cannot manage the space');
    }

    public function test_space_grant_endpoint_rejects_non_viewer_level() {
        $this->set_system_admin();
        $space  = $this->make_space('open');
        $target = self::factory()->user->create(['role' => 'subscriber']);

        $bad = new WP_REST_Request('POST', "/wp-super-gallery/v1/spaces/{$space}/access");
        $bad->set_param('userId', $target);
        $bad->set_param('access_level', 'owner');
        $this->assertSame(400, rest_do_request($bad)->get_status(), 'space access_level=owner must be rejected by the viewer-only enum');

        $ok = new WP_REST_Request('POST', "/wp-super-gallery/v1/spaces/{$space}/access");
        $ok->set_param('userId', $target);
        $ok->set_param('access_level', 'viewer');
        $this->assertSame(200, rest_do_request($ok)->get_status());
    }
}
