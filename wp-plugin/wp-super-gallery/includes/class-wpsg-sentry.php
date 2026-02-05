<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Sentry {
    private static $initialized = false;

    public static function init() {
        if (self::$initialized) {
            return;
        }

        $dsn = apply_filters('wpsg_sentry_dsn', '');
        if (empty($dsn)) {
            return;
        }

        $autoload = WPSG_PLUGIN_DIR . 'vendor/autoload.php';
        if (file_exists($autoload)) {
            require_once $autoload;
        }

        if (!function_exists('Sentry\\init')) {
            return;
        }

        \Sentry\init([
            'dsn' => $dsn,
            'environment' => function_exists('wp_get_environment_type') ? wp_get_environment_type() : 'production',
            'release' => defined('WPSG_VERSION') ? WPSG_VERSION : 'unknown',
        ]);

        self::$initialized = true;
    }

    public static function capture_message($message, $context = []) {
        self::init();
        if (!function_exists('Sentry\\captureMessage')) {
            return;
        }

        \Sentry\captureMessage($message, null, [
            'extra' => $context,
        ]);
    }
}