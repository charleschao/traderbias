#!/bin/bash
# Path to your React project build (uploaded via deploy.ps1)
NEW_BUILD_DIR="/home/c/tb"
# Path to live site folder
LIVE_DIR="/var/www/traderbias.app"

# --- SAFETY CHECK ---
# If the new build folder doesn't exist or is empty, STOP immediately.
if [ ! -d "$NEW_BUILD_DIR" ]; then
    echo "❌ ERROR: Folder '$NEW_BUILD_DIR' not found!"
    echo "   Did the deploy script finish uploading?"
    echo "   Aborting to protect live site."
    exit 1
fi

# Check if it is empty
if [ -z "$(ls -A $NEW_BUILD_DIR)" ]; then
    echo "❌ ERROR: Folder '$NEW_BUILD_DIR' is empty!"
    exit 1
fi
# --------------------

echo "Copying new files to live site..."

# Remove old backup to prevent nesting issues or conflicts
if [ -d "backup-good" ]; then
    sudo rm -rf backup-good
fi

# Backup the current live site
# If LIVE_DIR exists, move it to backup-good
if [ -d "$LIVE_DIR" ]; then
    sudo mv "$LIVE_DIR" backup-good/
else
    echo "Warning: $LIVE_DIR does not exist. Skipping backup."
fi

# Move the new content to the live directory
# Note: We are moving /home/c/tb to /var/www/traderbias.app
sudo mv "$NEW_BUILD_DIR" "$LIVE_DIR"

# Set permissions
sudo chown -R www-data:www-data "$LIVE_DIR"

echo "Reloading Nginx..."
sudo systemctl reload nginx

echo "Done! Changes are live."
echo "Remember: Purge Cloudflare cache manually and hard refresh your browser (Ctrl+Shift+R)."
