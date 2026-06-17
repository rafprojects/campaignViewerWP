<?php

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/class-wpsg-oembed-providers.php';
require_once __DIR__ . '/rest/class-wpsg-rest-base.php';
require_once __DIR__ . '/class-wpsg-permissions.php';
require_once __DIR__ . '/rest/class-wpsg-space-controller.php';
require_once __DIR__ . '/rest/class-wpsg-campaign-controller.php';
require_once __DIR__ . '/rest/class-wpsg-export-controller.php';
require_once __DIR__ . '/rest/class-wpsg-media-controller.php';
require_once __DIR__ . '/rest/class-wpsg-analytics-controller.php';
require_once __DIR__ . '/rest/class-wpsg-access-controller.php';
require_once __DIR__ . '/rest/class-wpsg-auth-controller.php';
require_once __DIR__ . '/rest/class-wpsg-settings-controller.php';
require_once __DIR__ . '/rest/class-wpsg-content-controller.php';
require_once __DIR__ . '/rest/class-wpsg-system-controller.php';

class WPSG_REST extends WPSG_REST_Base {

    public static function register_routes(): void {
        WPSG_Space_Controller::register_routes();
        WPSG_Campaign_Controller::register_routes();
        WPSG_Export_Controller::register_routes();
        WPSG_Media_Controller::register_routes();
        WPSG_Analytics_Controller::register_routes();
        WPSG_Access_Controller::register_routes();
        WPSG_Auth_Controller::register_routes();
        WPSG_Settings_Controller::register_routes();
        WPSG_Content_Controller::register_routes();
        WPSG_System_Controller::register_routes();
    }

}
