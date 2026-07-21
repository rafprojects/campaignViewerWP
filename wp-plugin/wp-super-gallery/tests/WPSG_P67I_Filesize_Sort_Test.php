<?php

/**
 * P67-I: media-library "size" sort orders by a real numeric _wpsg_filesize meta
 * instead of the serialized _wp_attachment_metadata blob (which cast to 0 for
 * every row). Covers the three write paths — the add_attachment hook, the one-time
 * backfill migration — and the sort itself.
 */
class WPSG_P67I_Filesize_Sort_Test extends WP_UnitTestCase {

    private $tmp_files = [];

    public function tearDown(): void {
        foreach ($this->tmp_files as $f) {
            if (file_exists($f)) {
                @unlink($f);
            }
        }
        $this->tmp_files = [];
        parent::tearDown();
    }

    /**
     * Create a real attachment of an exact byte size. Going through
     * wp_insert_attachment() fires the add_attachment hook, which is what stamps
     * _wpsg_filesize for non-plugin uploads.
     */
    private function make_attachment(int $bytes): int {
        $upload = wp_upload_dir();
        $path   = $upload['basedir'] . '/wpsg-p67i-' . uniqid() . '.bin';
        file_put_contents($path, str_repeat('x', $bytes));
        $this->tmp_files[] = $path;

        return intval(wp_insert_attachment([
            'post_mime_type' => 'image/jpeg',
            'post_title'     => 'p67i',
            'post_status'    => 'inherit',
        ], $path, 0, true));
    }

    private function library_ids(string $sort): array {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/media-library');
        $req->set_param('sort', $sort);
        $req->set_param('per_page', 100);
        $resp = WPSG_Media_Controller::list_media_library($req);
        $data = $resp->get_data();
        return array_map('intval', wp_list_pluck($data['items'], 'id'));
    }

    // ── Write paths ───────────────────────────────────────────────────────────

    public function test_add_attachment_hook_stamps_filesize() {
        $id = $this->make_attachment(4096);
        $this->assertSame(4096, (int) get_post_meta($id, '_wpsg_filesize', true));
    }

    public function test_stamp_filesize_meta_is_idempotent() {
        $id = $this->make_attachment(2048);
        WPSG_Media_Controller::stamp_filesize_meta($id);
        WPSG_Media_Controller::stamp_filesize_meta($id);
        $this->assertSame(2048, (int) get_post_meta($id, '_wpsg_filesize', true));
    }

    public function test_backfill_stamps_attachments_missing_the_meta() {
        $id = $this->make_attachment(1234);
        // Simulate a pre-migration attachment: strip the meta the hook added.
        delete_post_meta($id, '_wpsg_filesize');
        $this->assertSame('', get_post_meta($id, '_wpsg_filesize', true));

        delete_option('wpsg_filesize_backfilled');
        $m = new ReflectionMethod('WPSG_DB', 'maybe_backfill_filesize_meta');
        $m->setAccessible(true);
        $m->invoke(null);

        $this->assertSame(1234, (int) get_post_meta($id, '_wpsg_filesize', true));
        $this->assertSame('1', get_option('wpsg_filesize_backfilled'));
    }

    // ── The sort itself ───────────────────────────────────────────────────────

    public function test_size_sort_orders_by_filesize_both_directions() {
        $small  = $this->make_attachment(100);
        $medium = $this->make_attachment(5000);
        $large  = $this->make_attachment(90000);

        $asc = $this->library_ids('size_asc');
        $this->assertSame(
            [$small, $medium, $large],
            array_values(array_intersect($asc, [$small, $medium, $large])),
            'size_asc orders our attachments smallest → largest'
        );

        $desc = $this->library_ids('size_desc');
        $this->assertSame(
            [$large, $medium, $small],
            array_values(array_intersect($desc, [$large, $medium, $small])),
            'size_desc orders our attachments largest → smallest'
        );
    }
}
