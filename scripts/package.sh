#!/bin/sh
# Builds the site and zips exactly what the server needs, for upload to cPanel.
#   npm run package       → linqsafe-prod.zip  (for linqsafe.com and admin.linqsafe.com)
#   npm run package:dev   → linqsafe-dev.zip   (for dev.linqsafe.com; shows a DEV badge)
# Never includes .env files: each server keeps its own .env.
set -e
cd "$(dirname "$0")/.."
STAGE=${1:-prod}
VITE_APP_STAGE=$STAGE npm run build
OUT="linqsafe-$STAGE.zip"
rm -f "$OUT"
zip -rq "$OUT" app.cjs package.json package-lock.json server dist -x "*.DS_Store"
echo "Created $OUT ($(du -h "$OUT" | cut -f1)). Upload it to the $STAGE app folder in cPanel, extract, then Restart."
