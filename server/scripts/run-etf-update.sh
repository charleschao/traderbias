#!/bin/bash

# ETF Flow Update Script for Cron Job
# Runs the node scraper and logs output
# Recommended Cron: 15 14-23 * * 1-5 (Mon-Fri, 2:15 PM - 11:15 PM UTC)

# Set the project path
PROJECT_DIR="/var/www/traderbias.app/server"
LOG_FILE="$PROJECT_DIR/logs/etf-update.log"

# Ensure log directory exists
mkdir -p "$PROJECT_DIR/logs"

# Navigate to directory
cd "$PROJECT_DIR" || exit 1

# Add timestamp to log
echo "----------------------------------------" >> "$LOG_FILE"
echo "Running ETF update at $(date)" >> "$LOG_FILE"

# Run the update script
# Using full path to node might be safer depending on env, but 'node' usually works if in path
# If node is not found, use $(which node) or hardcode path like /usr/bin/node
/usr/bin/node update-etf-flows.js >> "$LOG_FILE" 2>&1

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "Success" >> "$LOG_FILE"
else
  echo "Failed with exit code $EXIT_CODE" >> "$LOG_FILE"
fi
