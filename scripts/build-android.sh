#!/usr/bin/env bash
# Build a personal-use Android debug APK without modifying the upstream game.
# Requires Node 22.18+, JDK 21 and the Android SDK.
set -euo pipefail
cd "$(dirname "$0")/.."

CAPACITOR_VERSION="8.5.3"

npm ci
npm run typecheck
npm test
npm run build

# Keep the upstream package.json and package-lock.json untouched, which makes
# future upstream merges easier. Pin all Capacitor packages to the same version.
npm install --no-save --package-lock=false --no-audit --no-fund \
  "@capacitor/core@${CAPACITOR_VERSION}" \
  "@capacitor/cli@${CAPACITOR_VERSION}" \
  "@capacitor/android@${CAPACITOR_VERSION}"

# The native project is intentionally generated, not committed.
if [[ -d android ]]; then
  npx --no-install cap sync android
else
  npx --no-install cap add android
  npx --no-install cap sync android
fi

(
  cd android
  bash ./gradlew --no-daemon assembleDebug
)

echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
