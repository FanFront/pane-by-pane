#!/usr/bin/env bash
# Verify that the APK uses exactly the key under ~/.android/debug.keystore.
# This prevents a supposedly updatable APK from silently switching certificates.
set -euo pipefail

APK="android/app/build/outputs/apk/debug/app-debug.apk"
KEYSTORE="$HOME/.android/debug.keystore"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"

if [[ ! -f "$APK" || ! -f "$KEYSTORE" || ! -d "$SDK/build-tools" ]]; then
  echo "APK, debug keystore or Android SDK build-tools missing" >&2
  exit 1
fi

APKSIGNER="$(find "$SDK/build-tools" -mindepth 2 -maxdepth 2 -name apksigner -type f | sort -V | tail -n 1)"
if [[ -z "$APKSIGNER" ]]; then
  echo "apksigner not found in Android SDK" >&2
  exit 1
fi

expected="$(keytool -exportcert -alias androiddebugkey -keystore "$KEYSTORE" -storepass android | sha256sum | awk '{print $1}')"
actual="$("$APKSIGNER" verify --print-certs "$APK" | awk '/Signer #1 certificate SHA-256 digest:/ {print $NF; exit}')"
if [[ -z "$actual" || "${expected,,}" != "${actual,,}" ]]; then
  echo "::error::APK signature is different from the expected persistent debug key." >&2
  exit 1
fi

echo "APK signing verified: ${actual,,}"
