#!/bin/bash
# Fast incremental npm install: copy existing node_modules first, then npm install handles only new/changed packages.
# This avoids a full npm install on every deploy while still picking up new dependencies.

STAGING=/var/app/staging
CURRENT=/var/app/current

if [ -d "$CURRENT/node_modules" ]; then
  echo "[01_skip_npm] Copying node_modules from current to staging..."
  cp -r "$CURRENT/node_modules" "$STAGING/node_modules"
  echo "[01_skip_npm] node_modules copied ($(ls $STAGING/node_modules | wc -l) packages)"
else
  echo "[01_skip_npm] No existing node_modules — full npm install will run"
fi
