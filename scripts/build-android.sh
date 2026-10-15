#!/usr/bin/env bash
# Build a personal-use Android debug APK without modifying the upstream game.
# Requires Node 22.18+, JDK 21 and the Android SDK.
set -euo pipefail
cd "$(dirname "$0")/.."

CAPACITOR_VERSION="8.5.3"

npm ci
npm run typecheck
npm test

# Build the self-contained puzzle pack before Vite/Capacitor copy web assets.
# Keep an already generated pack for local offline rebuilds.
if [[ ! -f public/presets/betaller.json ]]; then
  bash scripts/pull-betaller-puzzles.sh
fi
npm run build

# Keep the upstream package.json and package-lock.json untouched, which makes
# future upstream merges easier. Pin all Capacitor packages to the same version.
npm install --no-save --package-lock=false --no-audit --no-fund \
  "@capacitor/core@${CAPACITOR_VERSION}" \
  "@capacitor/cli@${CAPACITOR_VERSION}" \
  "@capacitor/android@${CAPACITOR_VERSION}" \
  "@capacitor/app@8.0.0"

# The native project is intentionally generated, not committed.
if [[ -d android ]]; then
  npx --no-install cap sync android
else
  npx --no-install cap add android
  npx --no-install cap sync android
fi

# Capacitor regenerates app/build.gradle for each build. Explicitly bind the
# debug signing configuration to the persistent CI keystore when supplied,
# rather than assuming Gradle's automatically selected debug key is the same.
# No private key material is copied into the source tree or logged.
if [[ -n "${PBP_ANDROID_SIGNING_KEYSTORE:-}" ]]; then
  if [[ ! -f "$PBP_ANDROID_SIGNING_KEYSTORE" ]]; then
    echo "::error::Persistent Android signing keystore not found" >&2
    exit 1
  fi
  keytool -list -keystore "$PBP_ANDROID_SIGNING_KEYSTORE" \
    -storepass android -alias androiddebugkey >/dev/null

  cat >> android/app/build.gradle <<'GRADLE_SIGNING'
  
// Generated at build time: use the persistent debug certificate for trusted builds.
android {
    signingConfigs {
        debug {
            storeFile file(System.getenv('PBP_ANDROID_SIGNING_KEYSTORE'))
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
    }
}
GRADLE_SIGNING
  echo "Explicit persistent Android debug signing enabled."
fi

# Give published APKs a monotonically increasing versionCode (the workflow
# run number), so Android treats each new release as an update. Local builds
# without PBP_ANDROID_VERSION_CODE retain Capacitor's default version.
if [[ -n "${PBP_ANDROID_VERSION_CODE:-}" ]]; then
  if [[ ! "${PBP_ANDROID_VERSION_CODE}" =~ ^[1-9][0-9]*$ ]] || (( PBP_ANDROID_VERSION_CODE > 2100000000 )); then
    echo "Invalid PBP_ANDROID_VERSION_CODE" >&2
    exit 1
  fi
  APP_GRADLE="android/app/build.gradle"
  [[ -f "$APP_GRADLE" ]] || { echo "Missing $APP_GRADLE" >&2; exit 1; }
  sed -E -i "s/^([[:space:]]*)versionCode[[:space:]]+[0-9]+/\\1versionCode ${PBP_ANDROID_VERSION_CODE}/" "$APP_GRADLE"
  sed -E -i "s/^([[:space:]]*)versionName[[:space:]]+[\"'][^\"']+[\"']/\\1versionName \"0.1.${PBP_ANDROID_VERSION_CODE}\"/" "$APP_GRADLE"
  grep -Eq "^[[:space:]]*versionCode[[:space:]]+${PBP_ANDROID_VERSION_CODE}$" "$APP_GRADLE"
  grep -Fq "versionName \"0.1.${PBP_ANDROID_VERSION_CODE}\"" "$APP_GRADLE"
fi

(
  cd android
  bash ./gradlew --no-daemon assembleDebug
)

echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
