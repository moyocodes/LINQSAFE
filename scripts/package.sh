#!/bin/sh
# Builds the site and zips exactly what the server needs, for upload to cPanel.
#   npm run package   →   linqsafe-deploy.zip
set -e
cd "$(dirname "$0")/.."
VITE_APP_STAGE=${VITE_APP_STAGE:-prod} npm run build
rm -f linqsafe-deploy.zip
zip -rq linqsafe-deploy.zip app.cjs package.json package-lock.json server dist -x "*.DS_Store"
echo "Created linqsafe-deploy.zip ($(du -h linqsafe-deploy.zip | cut -f1)). Upload it to your app folder in cPanel and extract."
