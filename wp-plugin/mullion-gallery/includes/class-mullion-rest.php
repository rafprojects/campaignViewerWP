<?php

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/class-mullion-oembed-providers.php';
require_once __DIR__ . '/class-mullion-grants.php';
require_once __DIR__ . '/rest/class-mullion-rest-base.php';
require_once __DIR__ . '/class-mullion-permissions.php';
require_once __DIR__ . '/rest/class-mullion-space-controller.php';
require_once __DIR__ . '/rest/class-mullion-campaign-controller.php';
require_once __DIR__ . '/rest/class-mullion-export-controller.php';
require_once __DIR__ . '/rest/class-mullion-media-controller.php';
require_once __DIR__ . '/rest/class-mullion-analytics-controller.php';
require_once __DIR__ . '/rest/class-mullion-access-controller.php';
require_once __DIR__ . '/rest/class-mullion-auth-controller.php';
require_once __DIR__ . '/rest/class-mullion-settings-controller.php';
require_once __DIR__ . '/rest/class-mullion-content-controller.php';
require_once __DIR__ . '/rest/class-mullion-system-controller.php';

class Mullion_REST extends Mullion_REST_Base {

    public static function register_routes(): void {
        Mullion_Space_Controller::register_routes();
        Mullion_Campaign_Controller::register_routes();
        Mullion_Export_Controller::register_routes();
        Mullion_Media_Controller::register_routes();
        Mullion_Analytics_Controller::register_routes();
        Mullion_Access_Controller::register_routes();
        Mullion_Auth_Controller::register_routes();
        Mullion_Settings_Controller::register_routes();
        Mullion_Content_Controller::register_routes();
        Mullion_System_Controller::register_routes();
    }

}
