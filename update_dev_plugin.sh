#!/bin/bash

# This script updates the dev plugin to the latest version of the plugin.

WORDPRESS_DIR="${HOME}/wordpress"
PLUGIN_DIR="${WORDPRESS_DIR}/wp-content/plugins/wp-super-gallery"
SOURCE_PLUGIN_DIR="$(pwd)/wp-plugin/wp-super-gallery"

# Check if the plugin directory exists
if [ ! -d "$PLUGIN_DIR" ]; then
  echo "Error: Plugin directory not found at $PLUGIN_DIR"
  exit 1
fi

# sudo -i -u www-data

# Remove existing plugin files
echo "Removing existing plugin files from $PLUGIN_DIR..."
sudo -u www-data rm -rf "${PLUGIN_DIR:?}/"*

# Copy the contents of the dev plugin to the plugin directory
echo "Updating the dev plugin at $PLUGIN_DIR with contents from $SOURCE_PLUGIN_DIR..."
sudo -u www-data cp -r "${SOURCE_PLUGIN_DIR}/." "$PLUGIN_DIR/"

# Set appropriate permissions for the plugin files
echo "Setting permissions for plugin directories..."
sudo -u www-data find "$PLUGIN_DIR" -type d -exec chmod 755 {} \;
echo "Setting permissions for plugin files..."
sudo -u www-data find "$PLUGIN_DIR" -type f -exec chmod 644 {} \;
echo "Setting ownership for plugin files..."
sudo -u www-data chown -R www-data:www-data "$PLUGIN_DIR"

echo "Dev plugin updated successfully at $PLUGIN_DIR."
