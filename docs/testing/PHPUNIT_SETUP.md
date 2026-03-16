# Setting Up PHPUnit Testing for WordPress Plugins in wp-env

## Overview

This document details the process of setting up PHPUnit testing for a WordPress plugin using wp-env, focusing on testing SSRF (Server-Side Request Forgery) mitigations in an oEmbed proxy. The journey involved significant debugging due to compatibility issues between PHPUnit versions, WordPress test libraries, and polyfills. What started as a simple setup turned into a deep dive into PHP autoloading, test discovery, and dependency management.

## Initial Setup

### 1. Project Structure
The WordPress plugin is located in `/wp-plugin/wp-super-gallery/` within the project root. The plugin includes:
- Core files in `includes/`
- REST API endpoints with oEmbed proxy functionality
- SSRF protections (HTTPS enforcement, allowlist, private IP blocking)

### 2. Installing Dependencies
First, installed the necessary testing dependencies using Composer in the plugin directory:

```bash
cd wp-plugin/wp-super-gallery
composer require --dev yoast/phpunit-polyfills phpunit/phpunit
```

This installed:
- `yoast/phpunit-polyfills`: Provides compatibility between PHPUnit versions and WordPress test framework
- `phpunit/phpunit`: The testing framework

### 3. Creating PHPUnit Configuration
Created `phpunit.xml.dist` in the plugin root:

```xml
<?xml version="1.0"?>
<phpunit
    bootstrap="tests/bootstrap.php"
    backupGlobals="false"
    colors="true"
    convertErrorsToExceptions="true"
    convertWarningsToExceptions="true"
    convertNoticesToExceptions="true"
    convertDeprecationsToExceptions="true"
>
    <testsuites>
        <testsuite name="testing">
            <directory prefix="test-" suffix=".php">./tests/</directory>
        </testsuite>
    </testsuites>
</phpunit>
```

### 4. Setting Up Test Bootstrap
Created `tests/bootstrap.php` with the standard WordPress plugin test bootstrap:

```php
<?php
/**
 * PHPUnit bootstrap file.
 */

$_tests_dir = getenv('WP_TESTS_DIR');
if (!$_tests_dir) {
    $_tests_dir = rtrim(sys_get_temp_dir(), '/\\') . '/wordpress-tests-lib';
}

if (!file_exists("{$_tests_dir}/includes/functions.php")) {
    echo "Could not find {$_tests_dir}/includes/functions.php\n";
    exit(1);
}

require_once "{$_tests_dir}/includes/functions.php";

function _manually_load_plugin() {
    require dirname(dirname(__FILE__)) . '/wp-super-gallery.php';
}
tests_add_filter('muplugins_loaded', '_manually_load_plugin');

require "{$_tests_dir}/includes/bootstrap.php";
```

### 5. Writing Test Files
Created test files in `tests/`:
- `test-proxy-oembed.php`: Basic oEmbed proxy tests
- `test-proxy-oembed-ssrf.php`: SSRF mitigation tests

Test classes extended `WP_UnitTestCase` and included methods for testing various scenarios.

## Problems Encountered

### 1. Test Discovery Failure
Initial attempts to run tests resulted in "0 tests found" despite files existing in the container.

### 2. Class Not Found Errors
When running individual test files, PHPUnit reported "Class test-proxy-oembed cannot be found", even though the files were present.

### 3. Polyfills Compatibility Issues
The WordPress test framework requires polyfills for PHPUnit compatibility, but different versions had conflicts.

### 4. Autoloading Conflicts
The WordPress test bootstrap and polyfills autoloader caused issues with class loading.

### 5. PHPUnit Version Conflicts
Different PHPUnit versions (9, 10, 11) had varying compatibility with WordPress test libs and polyfills.

## Debugging Process

### Step 1: Verifying File Mounting
First, confirmed that test files were correctly mounted in the wp-env container:

```bash
docker exec -u 1000 -i <container_id> bash -lc "cd /var/www/html/wp-content/plugins/wp-super-gallery && ls -la tests/"
```

Files were present, so mounting wasn't the issue.

### Step 2: Checking PHP Syntax
Verified test files had no syntax errors:

```bash
php -l tests/test-proxy-oembed.php
```

Syntax was valid.

### Step 3: Testing Bootstrap Loading
Created a debug script to check if the bootstrap loaded correctly and classes were available:

```php
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/test-proxy-oembed.php';
echo 'Proxy Test exists: ' . (class_exists('WPSG_REST_Proxy_OEmbed_Test') ? 'yes' : 'no') . PHP_EOL;
echo 'WP_UnitTestCase exists: ' . (class_exists('WP_UnitTestCase') ? 'yes' : 'no') . PHP_EOL;
```

This confirmed classes existed when manually loaded.

### Step 4: Investigating Test Discovery
Ran PHPUnit with debug options:

```bash
./vendor/bin/phpunit tests/ --debug
```

Output showed "Bootstrap Finished" but "Test Suite Loaded (0 tests)", indicating discovery failure.

### Step 5: Testing Individual Files
Attempted running specific test files:

```bash
./vendor/bin/phpunit tests/test-proxy-oembed.php
```

Resulted in "Class test-proxy-oembed cannot be found", suggesting PHPUnit expected class names matching file names.

### Step 6: Checking PHPUnit Configuration
Experimented with different `phpunit.xml.dist` configurations:
- Using `<file>` elements instead of `<directory>`
- Changing prefixes and suffixes
- Using different directory scanning options

### Step 7: Investigating Polyfills Issues
The WordPress test framework failed with "PHPUnit Polyfills library is a requirement". Updated bootstrap to load polyfills correctly:

```php
require_once __DIR__ . '/../vendor/autoload.php';
define('WP_TESTS_PHPUNIT_POLYFILLS_PATH', __DIR__ . '/../vendor/yoast/phpunit-polyfills/src/');
```

### Step 8: Debugging Autoloading
Added debug output to test files to confirm they were being loaded during test discovery.

### Step 9: Version Compatibility Testing
Tested different combinations of PHPUnit and polyfills versions due to errors like "Call to undefined method PHPUnit\Util\Test::parseTestMethodAnnotations()".

## Solutions Implemented

### 1. Renaming Test Files
Renamed test files to follow PHPUnit naming conventions:
- `test-proxy-oembed.php` → `ProxyOEmbedTest.php`
- `test-proxy-oembed-ssrf.php` → `ProxyOEmbedSSRFTest.php`

Updated class names accordingly:
- `WPSG_REST_Proxy_OEmbed_Test` → `ProxyOEmbedTest`
- `WPSG_REST_Proxy_OEmbed_SSRF_Test` → `ProxyOEmbedSSRFTest`

### 2. Updating PHPUnit Configuration
Modified `phpunit.xml.dist` to use suffix-based discovery:

```xml
<directory suffix="Test.php">./tests/</directory>
```

This tells PHPUnit to scan `tests/` for files ending in `Test.php` and load them.

### 3. Resolving Polyfills Compatibility
Downgraded to compatible versions:
- PHPUnit 9.6.34
- yoast/phpunit-polyfills 2.0.5

Updated `composer.json`:

```json
{
    "require": {
        "yoast/phpunit-polyfills": "^2.0",
        "phpunit/phpunit": "^9.0"
    },
    "config": {
        "platform": {
            "php": "8.3"
        }
    }
}
```

### 4. Fixing Bootstrap Autoloading
Ensured polyfills autoload is loaded before WordPress bootstrap:

```php
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../vendor/yoast/phpunit-polyfills/phpunitpolyfills-autoload.php';
require "{$_tests_dir}/includes/bootstrap.php";
```

### 5. Handling Platform Requirements
Added platform configuration to ignore PHP version conflicts and regenerated autoload:

```bash
composer dump-autoload --ignore-platform-reqs
```

## Final Working Setup

### Directory Structure
```
wp-plugin/wp-super-gallery/
├── composer.json
├── phpunit.xml.dist
├── tests/
│   ├── bootstrap.php
│   ├── ProxyOEmbedTest.php
│   └── ProxyOEmbedSSRFTest.php
└── vendor/
    ├── autoload.php
    └── yoast/phpunit-polyfills/
```

### Running Tests
Use wp-env to run tests in the proper environment:

```bash
wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && ./vendor/bin/phpunit -c phpunit.xml.dist"
```

This produces:
```
PHPUnit 9.6.34 by Sebastian Bergmann and contributors.

.....                                                               5 / 5 (100%)

Time: 00:00.082, Memory: 42.50 MB

OK (5 tests, 18 assertions)
```

### Test Coverage
The tests validate:
- Missing URL parameter returns 400
- Cached payload is returned
- HTTPS URLs are enforced
- Private IP addresses are blocked
- Unresolvable hosts return 400

## Lessons Learned

### 1. Test File Naming is Critical
PHPUnit expects test files to end in `Test.php` and class names to match. WordPress plugin testing often uses `test-*.php`, but this conflicts with PHPUnit's discovery mechanism.

### 2. Version Compatibility is Complex
WordPress test framework, PHPUnit, and polyfills must be compatible. The wp-env container uses specific versions, so local dependencies must match.

### 3. Autoloading Order Matters
Polyfills must be loaded before WordPress bootstrap to provide missing PHPUnit methods.

### 4. Debugging Requires Isolation
Use debug scripts, manual class loading, and incremental testing to isolate issues.

### 5. Platform Requirements Can Block Testing
Composer platform checks can prevent test execution; use `--ignore-platform-reqs` when necessary.

### 6. Official Documentation May Not Cover Edge Cases
While wp-env and WordPress testing docs provide basics, complex setups require experimentation and debugging.

### 7. Container vs Local Environment Differences
wp-env uses different PHPUnit versions and paths than local installations.

## Recommendations

1. **Start with Standard Naming**: Use `*Test.php` files and matching class names from the beginning.

2. **Check Version Compatibility**: Verify PHPUnit, polyfills, and WordPress test lib versions match.

3. **Test Bootstrap Thoroughly**: Create debug scripts to verify class loading and environment setup.

4. **Use wp-env for Testing**: Always run tests in the wp-env container to match production environment.

5. **Document Your Setup**: Keep detailed notes on versions and configurations for future maintenance.

This setup now provides reliable testing for WordPress plugin functionality, including security features like SSRF protection.
