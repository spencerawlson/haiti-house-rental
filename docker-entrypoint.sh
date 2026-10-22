#!/bin/sh
# Starts the app as the unprivileged `node` user (Phase 6). The uploads
# volume predates this and its files are owned by root, so the one thing
# done as root is handing that folder to `node`; then root is dropped.
set -e
mkdir -p /app/public/uploads
chown -R node:node /app/public/uploads
exec su-exec node "$@"
