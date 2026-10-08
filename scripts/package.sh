#!/bin/sh
# Builds the site and zips exactly what the server needs, for upload to cPanel.
#   npm run package       → linqsafe-prod.zip  (for linqsafe.com and admin.linqsafe.com)
#   npm run package:dev   → linqsafe-dev.zip   (for dev.linqsafe.com; shows a DEV badge)
#   npm run package:admin → linqsafe-admin.zip (for admin.linqsafe.com; same build as prod; the site
#                           switches to the founder console by itself on the admin. address)
# Never includes .env files: each server keeps its own .env.
set -e
cd "$(dirname "$0")/.."
TARGET=${1:-prod}
STAGE=$TARGET
[ "$TARGET" = admin ] && STAGE=prod
VITE_APP_STAGE=$STAGE npm run build
OUT="linqsafe-$TARGET.zip"
rm -f "$OUT"
zip -rq "$OUT" app.cjs package.json package-lock.json server dist -x "*.DS_Store"
echo "Created $OUT ($(du -h "$OUT" | cut -f1)). Upload it to the $TARGET app folder in cPanel, extract, then Restart."
