<?php
/**
 * Provider Registry
 *
 * Manages embed provider handlers. Handlers are registered with a priority
 * and iterated in priority order (lowest first). The first handler that
 * claims it can_handle() the URL and successfully fetches data wins.
 *
 * Third-party plugins can register additional handlers via the
 * `mullion_register_providers` action hook.
 *
 * @package Mullion
 * @since   0.10.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class Mullion_Provider_Registry {
    /**
     * P67-E: canonical Rumble video-ID token, shared by Mullion_Provider_Rumble and
     * the media controller's normalize_external_media() so the two regexes can't
     * drift. Hosted here (rather than on Mullion_Provider_Rumble) because the
     * registry is the providers module's always-loaded entry point, while the
     * individual handler classes load lazily — the media controller can reference
     * this constant safely without triggering a fatal.
     */
    const RUMBLE_VIDEO_ID_TOKEN = 'v[0-9a-zA-Z]+';

    /**
     * Registered handler instances, keyed by class name.
     *
     * @var Mullion_Provider_Handler[]
     */
    private static array $handlers = [];

    /**
     * Whether the default (built-in) handlers have been loaded.
     *
     * @var bool
     */
    private static bool $defaults_loaded = false;

    /**
     * Register a provider handler.
     *
     * @param Mullion_Provider_Handler $handler Handler instance.
     */
    public static function register(Mullion_Provider_Handler $handler): void {
        self::$handlers[get_class($handler)] = $handler;
    }

    /**
     * Remove a previously registered handler by class name.
     *
     * Useful for replacing built-in handlers with custom implementations.
     *
     * @param string $class_name Fully-qualified class name.
     */
    public static function deregister(string $class_name): void {
        unset(self::$handlers[$class_name]);
    }

    /**
     * Get all registered handlers sorted by priority (lowest first).
     *
     * @return Mullion_Provider_Handler[]
     */
    public static function get_handlers(): array {
        self::ensure_defaults();

        $handlers = array_values(self::$handlers);
        usort($handlers, static function (Mullion_Provider_Handler $a, Mullion_Provider_Handler $b) {
            return $a->get_priority() <=> $b->get_priority();
        });

        return $handlers;
    }

    /**
     * Resolve a URL through the registered handler chain.
     *
     * @param string   $url      The original media URL.
     * @param array    $parsed   Result of parse_url($url).
     * @param string[] $attempts Passed by reference — endpoint URLs tried.
     * @return array|null oEmbed data array on success, null if no handler matched.
     */
    public static function resolve(string $url, array $parsed, array &$attempts): ?array {
        foreach (self::get_handlers() as $handler) {
            if (!$handler->can_handle($url, $parsed)) {
                continue;
            }

            $result = $handler->fetch($url, $parsed, $attempts);
            if (is_array($result) && !empty($result)) {
                return $result;
            }
        }

        return null;
    }

    /**
     * Load built-in default handlers if not already loaded.
     */
    private static function ensure_defaults(): void {
        if (self::$defaults_loaded) {
            return;
        }

        self::$defaults_loaded = true;

        // Load handler class files.
        $dir = __DIR__ . '/';
        require_once $dir . 'interface-mullion-provider-handler.php';
        require_once $dir . 'class-mullion-provider-rumble.php';
        require_once $dir . 'class-mullion-provider-wpcore.php';
        require_once $dir . 'class-mullion-provider-direct.php';
        require_once $dir . 'class-mullion-provider-og-fallback.php';

        // Register built-in handlers in priority order.
        self::register(new Mullion_Provider_Rumble());
        self::register(new Mullion_Provider_WPCore());
        self::register(new Mullion_Provider_Direct());
        self::register(new Mullion_Provider_OG_Fallback());

        /**
         * Action hook for third-party plugins to register additional
         * embed provider handlers.
         *
         * Example:
         *   add_action('mullion_register_providers', function () {
         *       Mullion_Provider_Registry::register(new My_Custom_Handler());
         *   });
         */
        do_action('mullion_register_providers');
    }

    /**
     * Reset registry state (for testing).
     */
    public static function reset(): void {
        self::$handlers = [];
        self::$defaults_loaded = false;
    }
}
