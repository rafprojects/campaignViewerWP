<?php
/**
 * P65-A — WPSG_Campaign_IO service tests.
 *
 * Characterization tests for the consolidated campaign import/export pipeline.
 * These assert the concrete behaviors that were previously divergent across the
 * four transport copies and are now guaranteed by construction:
 *
 *   - A-4: JSON export embeds the layout template (was always null); JSON import
 *          creates it under the REGISTERED CPT (`wpsg_layout_tpl`) and binds by
 *          UUID, so it round-trips and is visible to the template library.
 *   - G-4: URL-only (JSON) media import uses `source: 'external'` (was `'url'`).
 *   - attachmentId: sideloaded media carry `attachmentId`, so orphan detection
 *          and metadata enrichment see them.
 *   - datetime: schedule fields are normalized on every transport.
 *   - MD5 dedup + streaming for ZIP media.
 *
 * @package WP_Super_Gallery
 */

class WPSG_P65A_Campaign_IO_Test extends WP_UnitTestCase {

    private int $admin_id;

    public function setUp(): void {
        parent::setUp();
        $this->admin_id = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $this->admin_id);
        $user->add_cap('manage_wpsg');
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $user->add_cap($cap);
        }
        wp_set_current_user($this->admin_id);
        WPSG_CPT::register();
    }

    // ── Fixtures ────────────────────────────────────────────────────────────────

    private function create_campaign(string $title = 'IO Test Campaign'): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $title,
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        update_post_meta($id, 'visibility', 'public');
        return $id;
    }

    private function valid_template_payload(): array {
        return [
            'name'              => 'Round-Trip Template',
            'canvasAspectRatio' => 1.0,
            'slots'             => [
                ['id' => 'slot-1', 'x' => 10, 'y' => 10, 'width' => 40, 'height' => 40, 'shape' => 'rectangle'],
            ],
            'overlays'          => [],
        ];
    }

    /** Build an in-memory v2 ZIP with one media entry backed by a real JPEG. */
    private function build_media_zip(array $media_refs, ?string $jpeg = null): string {
        $jpeg    = $jpeg ?? file_get_contents(__DIR__ . '/stubs/1x1.jpg');
        $tmp_zip = wp_tempnam('p65a-test.zip');
        $zip     = new ZipArchive();
        $zip->open($tmp_zip, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('manifest.json', wp_json_encode(['version' => 2]));
        foreach ($media_refs as $ref) {
            if (!empty($ref['filename'])) {
                $zip->addFromString('media/' . $ref['filename'], $jpeg);
            }
        }
        $zip->close();
        return $tmp_zip;
    }

    // ── build_entry (export) ─────────────────────────────────────────────────────

    public function test_build_entry_embeds_layout_template_a4() {
        $tpl = WPSG_Layout_Templates::create($this->valid_template_payload());
        $this->assertIsArray($tpl);

        $cid = $this->create_campaign();
        update_post_meta($cid, '_wpsg_layout_binding_template_id', $tpl['id']);

        $entry = WPSG_Campaign_IO::build_entry($cid, false);

        // The old REST-JSON export did get_post(intval($uuid)) → always null.
        $this->assertNotNull($entry['layout_template'], 'Layout template must be embedded in the export entry.');
        $this->assertSame($tpl['id'], $entry['layout_template']['id']);
        $this->assertSame('Round-Trip Template', $entry['layout_template']['name']);
    }

    public function test_build_entry_binary_adds_filenames() {
        $cid = $this->create_campaign();
        update_post_meta($cid, 'media_items', [
            ['id' => 'm1', 'url' => 'https://example.com/a.jpg', 'title' => 'A'],
        ]);

        $entry = WPSG_Campaign_IO::build_entry($cid, true);
        $this->assertArrayHasKey('filename', $entry['media_references'][0]);
        $this->assertSame('media-m1.jpg', $entry['media_references'][0]['filename']);

        $json_entry = WPSG_Campaign_IO::build_entry($cid, false);
        $this->assertArrayNotHasKey('filename', $json_entry['media_references'][0]);
    }

    // ── import_entry: JSON (URL-only) ────────────────────────────────────────────

    public function test_json_import_media_source_is_external_g4() {
        $entry = [
            'campaign'         => ['title' => 'JSON Media', 'description' => ''],
            'media_references' => [
                ['id' => 'ref-1', 'url' => 'https://example.com/x.jpg', 'title' => 'X'],
            ],
        ];
        $result = WPSG_Campaign_IO::import_entry($entry, null, ['via' => 'rest', 'format' => 'json']);
        $this->assertIsArray($result);

        $media = get_post_meta($result['id'], 'media_items', true);
        $this->assertSame('external', $media[0]['source'], "URL-only import must be 'external', not 'url'.");
        $this->assertSame('ref-1', $media[0]['id']);
        // URL-only media has no real WP attachment (the registered meta sanitizer
        // normalizes a missing attachmentId to 0, so assert "no positive id").
        $this->assertSame(0, intval($media[0]['attachmentId'] ?? 0), 'URL-only media has no WP attachment.');
    }

    public function test_json_import_creates_layout_template_under_registered_cpt_a4() {
        $entry = [
            'campaign'        => ['title' => 'With Template', 'description' => ''],
            'layout_template' => $this->valid_template_payload(),
        ];
        $result = WPSG_Campaign_IO::import_entry($entry, null, ['via' => 'rest', 'format' => 'json']);
        $this->assertIsArray($result);

        // The binding must be a UUID resolvable through the CRUD class — proving
        // the template lives under the registered CPT (wpsg_layout_tpl), not the
        // old hand-rolled wpsg_layout_template.
        $bound_id = get_post_meta($result['id'], '_wpsg_layout_binding_template_id', true);
        $this->assertNotEmpty($bound_id);
        $fetched = WPSG_Layout_Templates::get($bound_id);
        $this->assertIsArray($fetched, 'Imported template must be retrievable via WPSG_Layout_Templates::get().');
        $this->assertSame('Round-Trip Template', $fetched['name']);

        // The unregistered post type must never be created.
        $orphans = get_posts(['post_type' => 'wpsg_layout_template', 'post_status' => 'any', 'posts_per_page' => -1]);
        $this->assertCount(0, $orphans, 'The unregistered wpsg_layout_template CPT must never be used.');
    }

    public function test_json_import_normalizes_datetimes() {
        $entry = [
            'campaign' => [
                'title'     => 'Scheduled',
                'publishAt' => '2026-08-01T12:30:00+00:00',
            ],
        ];
        $result = WPSG_Campaign_IO::import_entry($entry, null, ['via' => 'cli', 'format' => 'json']);
        $stored = get_post_meta($result['id'], 'publish_at', true);
        $this->assertSame('2026-08-01 12:30:00', $stored, 'Datetime must be normalized to Y-m-d H:i:s on every transport.');
    }

    public function test_service_round_trips_layout_template_end_to_end() {
        $tpl = WPSG_Layout_Templates::create($this->valid_template_payload());
        $src = $this->create_campaign('RT Source');
        update_post_meta($src, '_wpsg_layout_binding_template_id', $tpl['id']);

        // Export → import through the service (JSON path).
        $entry  = WPSG_Campaign_IO::build_entry($src, false);
        $result = WPSG_Campaign_IO::import_entry(
            ['campaign' => $entry['campaign'], 'layout_template' => $entry['layout_template']],
            null,
            ['via' => 'rest', 'format' => 'json']
        );

        $bound_id = get_post_meta($result['id'], '_wpsg_layout_binding_template_id', true);
        $fetched  = WPSG_Layout_Templates::get($bound_id);
        $this->assertIsArray($fetched);
        $this->assertSame('Round-Trip Template', $fetched['name']);
    }

    // ── import_entry: ZIP (sideload) ─────────────────────────────────────────────

    public function test_zip_import_sets_source_upload_and_attachment_id() {
        $refs    = [['id' => 'zref-1', 'title' => 'Zipped', 'filename' => 'media-zref-1.jpg']];
        $tmp_zip = $this->build_media_zip($refs);
        $zip     = new ZipArchive();
        $this->assertTrue($zip->open($tmp_zip) === true);

        $result = WPSG_Campaign_IO::import_entry(
            ['campaign' => ['title' => 'Zip Media', 'description' => ''], 'media_references' => $refs],
            $zip,
            ['via' => 'rest', 'format' => 'binary']
        );
        $zip->close();
        @unlink($tmp_zip);

        $this->assertIsArray($result);
        $this->assertSame(1, $result['media_imported'], 'Real JPEG must sideload successfully.');

        $media = get_post_meta($result['id'], 'media_items', true);
        $this->assertSame('upload', $media[0]['source']);
        $this->assertGreaterThan(0, intval($media[0]['attachmentId']), 'Sideloaded media must carry attachmentId.');
        $this->assertSame('zref-1', $media[0]['id'], 'Source media id is preserved for layout-slot resolution.');
        $this->assertTrue(get_post($media[0]['attachmentId']) instanceof WP_Post);
    }

    public function test_zip_import_dedupes_identical_bytes_by_md5() {
        // Two references with distinct ids but identical file bytes.
        $refs = [
            ['id' => 'd1', 'title' => 'One', 'filename' => 'media-d1.jpg'],
            ['id' => 'd2', 'title' => 'Two', 'filename' => 'media-d2.jpg'],
        ];
        $tmp_zip = $this->build_media_zip($refs);
        $zip     = new ZipArchive();
        $zip->open($tmp_zip);

        $result = WPSG_Campaign_IO::import_entry(
            ['campaign' => ['title' => 'Dedup', 'description' => ''], 'media_references' => $refs],
            $zip,
            ['via' => 'cli', 'format' => 'binary']
        );
        $zip->close();
        @unlink($tmp_zip);

        $media = get_post_meta($result['id'], 'media_items', true);
        $this->assertCount(2, $media);
        $this->assertSame(
            intval($media[0]['attachmentId']),
            intval($media[1]['attachmentId']),
            'Identical bytes must dedupe to the same attachment (MD5 dedup on every transport).'
        );
    }

    // ── streaming helper (E-4) ───────────────────────────────────────────────────

    public function test_stream_zip_entry_to_file_copies_bytes() {
        $tmp_zip = wp_tempnam('stream-test.zip');
        $zip     = new ZipArchive();
        $zip->open($tmp_zip, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('media/hello.txt', 'streamed-content');
        $zip->close();

        $zip = new ZipArchive();
        $zip->open($tmp_zip);
        $dest = wp_tempnam('stream-dest');

        $ok = WPSG_Export_Engine::stream_zip_entry_to_file($zip, 'media/hello.txt', $dest);
        $this->assertTrue($ok);
        $this->assertSame('streamed-content', file_get_contents($dest));

        $missing = WPSG_Export_Engine::stream_zip_entry_to_file($zip, 'media/nope.txt', $dest);
        $this->assertFalse($missing, 'Missing entry must return false.');

        $zip->close();
        @unlink($tmp_zip);
        @unlink($dest);
    }
}
