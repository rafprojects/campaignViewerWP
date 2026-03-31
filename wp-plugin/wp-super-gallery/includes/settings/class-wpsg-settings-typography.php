<?php
/**
 * Typography settings metadata and helpers for WP Super Gallery.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Settings_Typography {

    /**
     * Google Font family names that may be loaded from the CDN.
     * Must stay in sync with GOOGLE_FONT_NAMES in TypographyEditor.tsx.
     */
    const GOOGLE_FONT_NAMES = [
        // Sans-serif
        'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
        'Oswald', 'Raleway', 'Nunito', 'Source Sans 3', 'PT Sans', 'Noto Sans',
        'Work Sans', 'Quicksand', 'Barlow', 'Cabin', 'DM Sans', 'Fira Sans',
        'Karla', 'Mulish', 'Rubik', 'Ubuntu', 'Josefin Sans', 'Manrope',
        'Plus Jakarta Sans', 'Outfit',
        // Serif
        'Playfair Display', 'Merriweather', 'Libre Baskerville', 'Crimson Text',
        'EB Garamond', 'Bitter', 'Cormorant Garamond', 'Lora', 'PT Serif',
        'Noto Serif',
        // Display / Handwriting
        'Dancing Script', 'Pacifico', 'Lobster', 'Caveat', 'Satisfy',
        // Monospace
        'Fira Code', 'JetBrains Mono', 'Source Code Pro',
    ];

    /**
     * Per-font axis specifications for Google Fonts CSS API v2.
     * Must stay in sync with GOOGLE_FONT_SPECS in loadGoogleFont.ts.
     *
     * null = no axes needed (regular 400 only, e.g. Pacifico).
     */
    const GOOGLE_FONT_SPECS = [
        // Sans-serif
        'Inter'             => 'ital,wght@0,100..900;1,100..900',
        'Roboto'            => 'ital,wght@0,100..900;1,100..900',
        'Open Sans'         => 'ital,wght@0,300..800;1,300..800',
        'Lato'              => 'ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900',
        'Montserrat'        => 'ital,wght@0,100..900;1,100..900',
        'Poppins'           => 'ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900',
        'Oswald'            => 'wght@200..700',
        'Raleway'           => 'ital,wght@0,100..900;1,100..900',
        'Nunito'            => 'ital,wght@0,200..1000;1,200..1000',
        'Source Sans 3'     => 'ital,wght@0,200..900;1,200..900',
        'PT Sans'           => 'ital,wght@0,400;0,700;1,400;1,700',
        'Noto Sans'         => 'ital,wght@0,100..900;1,100..900',
        'Work Sans'         => 'ital,wght@0,100..900;1,100..900',
        'Quicksand'         => 'wght@300..700',
        'Barlow'            => 'ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900',
        'Cabin'             => 'ital,wght@0,400..700;1,400..700',
        'DM Sans'           => 'ital,wght@0,100..1000;1,100..1000',
        'Fira Sans'         => 'ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900',
        'Karla'             => 'ital,wght@0,200..800;1,200..800',
        'Mulish'            => 'ital,wght@0,200..1000;1,200..1000',
        'Rubik'             => 'ital,wght@0,300..900;1,300..900',
        'Ubuntu'            => 'ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,500;1,700',
        'Josefin Sans'      => 'ital,wght@0,100..700;1,100..700',
        'Manrope'           => 'wght@200..800',
        'Plus Jakarta Sans' => 'ital,wght@0,200..800;1,200..800',
        'Outfit'            => 'wght@100..900',
        // Serif
        'Playfair Display'   => 'ital,wght@0,400..900;1,400..900',
        'Merriweather'       => 'ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900',
        'Libre Baskerville'  => 'ital,wght@0,400;0,700;1,400',
        'Crimson Text'       => 'ital,wght@0,400;0,600;0,700;1,400;1,600;1,700',
        'EB Garamond'        => 'ital,wght@0,400..800;1,400..800',
        'Bitter'             => 'ital,wght@0,100..900;1,100..900',
        'Cormorant Garamond' => 'ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700',
        'Lora'               => 'ital,wght@0,400..700;1,400..700',
        'PT Serif'           => 'ital,wght@0,400;0,700;1,400;1,700',
        'Noto Serif'         => 'ital,wght@0,100..900;1,100..900',
        // Display / Handwriting
        'Dancing Script' => 'wght@400..700',
        'Pacifico'       => null,
        'Lobster'        => null,
        'Caveat'         => 'wght@400..700',
        'Satisfy'        => null,
        // Monospace
        'Fira Code'       => 'wght@300..700',
        'JetBrains Mono'  => 'ital,wght@0,100..800;1,100..800',
        'Source Code Pro' => 'ital,wght@0,200..900;1,200..900',
    ];

    /**
     * Extract Google Font family names from typography_overrides.
     *
     * @param array $settings Plugin settings array.
     * @return array Deduplicated Google Font family names.
     */
    public static function extract_google_font_families($settings) {
        $raw = isset($settings['typography_overrides']) ? $settings['typography_overrides'] : '{}';
        $overrides = is_string($raw) ? json_decode($raw, true) : (is_array($raw) ? $raw : []);
        if (!is_array($overrides)) {
            return [];
        }

        $families = [];
        $google_set = array_flip(self::GOOGLE_FONT_NAMES);

        foreach ($overrides as $entry) {
            if (!is_array($entry) || empty($entry['fontFamily'])) {
                continue;
            }

            $parts = explode(',', $entry['fontFamily']);
            $name = trim($parts[0], " \t\n\r\0\x0B\"'");
            if ($name !== '' && isset($google_set[$name])) {
                $families[$name] = true;
            }
        }

        return array_keys($families);
    }
}