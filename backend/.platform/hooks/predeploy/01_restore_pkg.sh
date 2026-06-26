#!/bin/bash
# Restore the real package.json after npm install phase.
if [ -f /tmp/package.json.real ]; then
  cp /tmp/package.json.real /var/app/current/package.json
  echo "[01_restore_pkg] package.json restored from /tmp"
fi
