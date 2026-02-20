<?php
/**
 * Provider Registry
 *
 * Manages embed provider handlers. Handlers are registered with a priority
 * and iterated in priority order (lowest first). The first handler that
 * claims it can_handle() the URL and successfully fetches data wins.
 *
 * Third-party plugins can register additional handlers via the
 * `wpsg_register_providers` action hook.
 *
 * @package WP_Super_Gallery
 * @since   0.10.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Provider_Registry {
    /**
     * Registered handler instances, keyed by class name.
     *
     * @var WPSG_Provider_Handler[]
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
     * @param WPSG_Provider_Handler $handler Handler instance.
     */
    public static function register(WPSG_Provider_Handler $handler): void {
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
     * @return WPSG_Provider_Handler[]
     */
    public static function get_handlers(): array {
        self::ensure_defaults();

        $handlers = array_values(self::$handlers);
        usort($handlers, static function (WPSG_Provider_Handler $a, WPSG_Provider_Handler $b) {
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
        require_once $dir . 'interface-wpsg-provider-handler.php';
        require_once $dir . 'class-wpsg-provider-rumble.php';
        require_once $dir . 'class-wpsg-provider-wpcore.php';
        require_once $dir . 'class-wpsg-provider-direct.php';
        require_once $dir . 'class-wpsg-provider-og-fallback.php';

        // Register built-in handlers in priority order.
        self::register(new WPSG_Provider_Rumble());
        self::register(new WPSG_Provider_WPCore());
        self::register(new WPSG_Provider_Direct());
        self::register(new WPSG_Provider_OG_Fallback());

        /**
         * Action hook for third-party plugins to register additional
         * embed provider handlers.
         *
         * Example:
         *   add_action('wpsg_register_providers', function () {
         *       WPSG_Provider_Registry::register(new My_Custom_Handler());
         *   });
         */
        do_action('wpsg_register_providers');
    }

    /**
     * Reset registry state (for testing).
     */
    public static function reset(): void {
        self::$handlers = [];
        self::$defaults_loaded = false;
    }
}
