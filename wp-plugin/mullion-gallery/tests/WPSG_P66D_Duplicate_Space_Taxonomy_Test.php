<?php

/**
 * P66-D: duplicating a campaign preserves its space (_wpsg_space_id) and its
 * category/tag taxonomies — previously both were silently dropped, so a
 * duplicate escaped its delegated space and lost its categorization.
 */
class WPSG_P66D_Duplicate_Space_Taxonomy_Test extends WP_UnitTestCase {

    private function create_source(int $space_id): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'P66-D Source',
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        update_post_meta($id, '_wpsg_space_id', $space_id);
        return intval($id);
    }

    public function test_duplicate_keeps_space_id() {
        $space_id = 4242;
        $source   = $this->create_source($space_id);

        $new_id = WPSG_Campaign_Duplicator::duplicate($source, 'Copy', false, false);

        $this->assertIsInt($new_id);
        $this->assertSame(
            (string) $space_id,
            get_post_meta($new_id, '_wpsg_space_id', true),
            'Duplicate must stay in the source campaign space'
        );
    }

    public function test_duplicate_copies_category_and_tag_terms() {
        $source = $this->create_source(7);

        $cat = wp_insert_term('P66D Category', 'wpsg_campaign_category');
        $tag = wp_insert_term('P66D Tag', 'wpsg_campaign_tag');
        wp_set_object_terms($source, [(int) $cat['term_id']], 'wpsg_campaign_category');
        wp_set_object_terms($source, [(int) $tag['term_id']], 'wpsg_campaign_tag');

        $new_id = WPSG_Campaign_Duplicator::duplicate($source, 'Copy', false, false);

        $new_cats = wp_get_post_terms($new_id, 'wpsg_campaign_category', ['fields' => 'ids']);
        $new_tags = wp_get_post_terms($new_id, 'wpsg_campaign_tag', ['fields' => 'ids']);

        $this->assertContains((int) $cat['term_id'], $new_cats, 'Duplicate must carry the category term');
        $this->assertContains((int) $tag['term_id'], $new_tags, 'Duplicate must carry the tag term');
    }

    public function test_duplicate_without_terms_is_harmless() {
        $source = $this->create_source(1);

        $new_id = WPSG_Campaign_Duplicator::duplicate($source, 'Copy', false, false);

        $this->assertIsInt($new_id);
        $this->assertSame([], wp_get_post_terms($new_id, 'wpsg_campaign_category', ['fields' => 'ids']));
    }
}
