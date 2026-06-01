<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Perceptual-hash utility for near-duplicate image detection (P38-MD1).
 *
 * Computes a 64-bit dHash (difference hash) using PHP/GD:
 *   1. Load image, apply grayscale filter.
 *   2. Scale to 9×8 pixels.
 *   3. For each row compare each pixel to its right neighbour → 1 bit.
 *   4. Pack 64 bits into a 16-char lowercase hex string.
 *
 * Hamming distance between two hashes is computed in 16-bit chunks to avoid
 * signed-integer overflow on 32-bit PHP builds.
 *
 * This class has no dependencies on REST, campaign, or upload context and can
 * be used from any PHP code path that has access to GD.
 */
class WPSG_PHash {

    const HASH_BITS     = 64;
    const HASH_HEX_LEN  = 16; // 64 bits / 4 bits-per-nibble
    const DHASH_COLS    = 9;
    const DHASH_ROWS    = 8;

    /**
     * Compute a 64-bit dHash for the image at $file_path.
     *
     * @param string $file_path Absolute path to an image file.
     * @return string|null 16-char lowercase hex string, or null on failure.
     */
    public static function compute(string $file_path): ?string {
        if (!function_exists('imagecreate')) {
            return null;
        }

        $img = self::load_gd_image($file_path);
        if (!$img) {
            return null;
        }

        // Desaturate in-place before scaling (cheaper than per-pixel grayscale).
        imagefilter($img, IMG_FILTER_GRAYSCALE);

        $small = imagescale($img, self::DHASH_COLS, self::DHASH_ROWS, IMG_BILINEAR_FIXED);
        imagedestroy($img);

        if (!$small) {
            return null;
        }

        $bits = '';
        for ($y = 0; $y < self::DHASH_ROWS; $y++) {
            for ($x = 0; $x < self::DHASH_COLS - 1; $x++) {
                // After grayscale filter R=G=B; mask to red channel.
                $left  = (imagecolorat($small, $x,     $y) >> 16) & 0xFF;
                $right = (imagecolorat($small, $x + 1, $y) >> 16) & 0xFF;
                $bits .= ($left >= $right) ? '1' : '0';
            }
        }

        imagedestroy($small);

        return self::bits_to_hex($bits);
    }

    /**
     * Hamming distance between two 16-char hex hashes.
     *
     * Returns PHP_INT_MAX if either string is the wrong length.
     *
     * @param string $a First hash.
     * @param string $b Second hash.
     * @return int Number of differing bits.
     */
    public static function hamming_distance(string $a, string $b): int {
        if (strlen($a) !== self::HASH_HEX_LEN || strlen($b) !== self::HASH_HEX_LEN) {
            return PHP_INT_MAX;
        }

        $distance = 0;
        // Process 4 hex chars (16 bits) at a time — safe on both 32-bit and 64-bit PHP.
        $chunks_a = str_split($a, 4);
        $chunks_b = str_split($b, 4);

        foreach ($chunks_a as $i => $chunk_a) {
            $xor = hexdec($chunk_a) ^ hexdec($chunks_b[$i] ?? '0000');
            // Brian Kernighan popcount.
            while ($xor > 0) {
                $xor &= ($xor - 1);
                $distance++;
            }
        }

        return $distance;
    }

    /**
     * Whether $mime is an image type that GD can decode for hashing.
     *
     * @param string $mime MIME type string.
     * @return bool
     */
    public static function is_image_mime(string $mime): bool {
        return in_array($mime, [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
        ], true);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Load a GD image resource from $file_path using MIME sniffing.
     *
     * @param string $file_path
     * @return \GdImage|resource|false
     */
    private static function load_gd_image(string $file_path) {
        if (!is_readable($file_path)) {
            return false;
        }

        // Use getimagesize() for reliable type detection rather than file extension.
        $info = @getimagesize($file_path);
        if (!$info) {
            return false;
        }

        switch ($info[2]) {
            case IMAGETYPE_JPEG:
                return function_exists('imagecreatefromjpeg') ? @imagecreatefromjpeg($file_path) : false;
            case IMAGETYPE_PNG:
                return function_exists('imagecreatefrompng')  ? @imagecreatefrompng($file_path)  : false;
            case IMAGETYPE_GIF:
                return function_exists('imagecreatefromgif')  ? @imagecreatefromgif($file_path)  : false;
            case IMAGETYPE_WEBP:
                return function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($file_path) : false;
            default:
                return false;
        }
    }

    /**
     * Convert a 64-char binary string to a 16-char lowercase hex string.
     *
     * @param string $bits 64 '0'/'1' characters.
     * @return string
     */
    private static function bits_to_hex(string $bits): string {
        $hex = '';
        foreach (str_split($bits, 4) as $nibble) {
            $hex .= dechex(bindec($nibble));
        }
        return str_pad($hex, self::HASH_HEX_LEN, '0', STR_PAD_LEFT);
    }
}
