#!/bin/bash
# Swap package.json with a no-dep version so EB npm install is instant.
# Real package.json backed up in /tmp for predeploy restore.
cp /var/app/staging/package.json /tmp/package.json.real
cat > /var/app/staging/package.json << 'EOF'
{"name":"vitras-backend","version":"1.0.0","main":"src/server.js","type":"module","scripts":{"start":"node src/server.js"}}
EOF
echo "[01_skip_npm] package.json swapped — npm install will be instant"
