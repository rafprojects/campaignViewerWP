# Quick Start: Running PHPUnit Tests for WordPress Plugin

## Prerequisites

Ensure your WordPress plugin testing environment is properly configured:

- ✅ `phpunit.xml.dist` exists in plugin root with correct configuration
- ✅ `tests/bootstrap.php` exists and loads WordPress test environment
- ✅ Test files follow naming convention (`*Test.php`)
- ✅ Dependencies installed: `phpunit/phpunit ^9.0`, `yoast/phpunit-polyfills ^2.0`
- ✅ wp-env environment is set up and running

## Quick Test Execution

### 1. Navigate to Plugin Directory
```bash
cd /home/user/projects/react_projects/wp-super-gallery/wp-plugin/wp-super-gallery
```

**Why:** wp-env commands must be run from the plugin root directory for proper file mounting.

### 2. Run the Tests
```bash
wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && ./vendor/bin/phpunit -c phpunit.xml.dist"
```

**Expected Output:**
```
ℹ Starting 'sh -c cd /var/www/html/wp-content/plugins/wp-super-gallery && ./vendor/bin/phpunit -c phpunit.xml.dist' on the tests-cli container.

Installing...
Running as single site... To run multisite, use -c tests/phpunit/multisite.xml
Not running ajax tests. To execute these, use --group ajax.
Not running ms-files tests. To execute these, use --group ms-files.
Not running external-http tests. To execute these, use --group external-http.
PHPUnit 9.6.34 by Sebastian Bergmann and contributors.

.....                                                               5 / 5 (100%)

Time: 00:00.082, Memory: 42.50 MB

OK (5 tests, 18 assertions)
```

## Command Breakdown

### `wp-env run tests-cli`
- `wp-env`: WordPress environment management tool
- `run`: Execute a command in a specific container
- `tests-cli`: The testing container (includes WordPress test libraries)

### `sh -c "..."`  
- `sh -c`: Execute the quoted command string in a shell
- Required because wp-env needs to run complex commands with multiple parts

### `cd /var/www/html/wp-content/plugins/wp-super-gallery`
- Change to the mounted plugin directory inside the container
- This is where wp-env mounts your local plugin files

### `./vendor/bin/phpunit -c phpunit.xml.dist`
- `./vendor/bin/phpunit`: Run the locally installed PHPUnit (version 9.6.34)
- `-c phpunit.xml.dist`: Use the configuration file in the current directory
- `phpunit.xml.dist`: Contains test suite configuration and bootstrap path

## Troubleshooting

### "No such file or directory" for plugin path
**Problem:** `cd /var/www/html/wp-content/plugins/wp-super-gallery: No such file or directory`

**Solution:** Ensure you're running the command from the plugin root directory:
```bash
cd /home/user/projects/react_projects/wp-super-gallery/wp-plugin/wp-super-gallery
```

### "Composer detected issues in your platform"
**Problem:** PHP version compatibility warnings

**Solution:** This is usually harmless, but if tests fail, regenerate autoload:
```bash
composer dump-autoload --ignore-platform-reqs
```

### "Could not find docker-compose.yml"
**Problem:** wp-env environment not started or corrupted

**Solution:** Restart wp-env from the plugin directory:
```bash
wp-env destroy  # Clean up if needed
wp-env start
```

### Tests not discovered (0 tests found)
**Problem:** PHPUnit can't find test classes

**Solutions:**
1. Verify test files end in `Test.php` and classes match filenames
2. Check `phpunit.xml.dist` configuration
3. Ensure bootstrap loads correctly: `wp-env run tests-cli php tests/bootstrap.php`

### "Class ... cannot be found"
**Problem:** Test classes not loading

**Solution:** Check that polyfills are loaded. The bootstrap should include:
```php
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../vendor/yoast/phpunit-polyfills/phpunitpolyfills-autoload.php';
```

### Permission or mounting issues
**Problem:** Files not accessible in container

**Solution:** Ensure wp-env is run from the plugin directory, not subdirectories like `tests/`

### Slow test execution
**Problem:** Tests take longer than expected

**Solution:** This is normal for WordPress integration tests. The "Installing..." phase sets up the test database.

## Alternative Commands

### Run specific test file:
```bash
wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && ./vendor/bin/phpunit tests/ProxyOEmbedTest.php"
```

### Run with verbose output:
```bash
wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && ./vendor/bin/phpunit -c phpunit.xml.dist -v"
```

### Run tests in different groups:
```bash
wp-env run tests-cli sh -c "cd /var/www/html/wp-content/plugins/wp-super-gallery && ./vendor/bin/phpunit -c phpunit.xml.dist --group ssrf"
```

## Success Indicators

- ✅ "OK (X tests, Y assertions)" - All tests passed
- ✅ No "Errors:" or "Failures:" sections
- ✅ Exit code 0 (success)

If you encounter issues not covered here, refer to the detailed setup guide in `docs/PHPUNIT_SETUP.md`.
