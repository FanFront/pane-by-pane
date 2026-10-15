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
# Build-tools versions use "Signer #1", "Signer (minSdkVersion=...)",
# or "V2 Signer:" prefixes. Match the certificate digest field regardless of
# prefix, but never mistake the separate "public key SHA-256 digest" for it.
cert_report="$("$APKSIGNER" verify --verbose --print-certs "$APK" 2>&1)"
mapfile -t actuals < <(printf '%s\n' "$cert_report" | awk '/(^|[[:space:]])certificate SHA-256 digest:/ {print tolower($NF)}')

if (( ${#actuals[@]} == 0 )); then
  echo "::error::apksigner did not report any certificate SHA-256 digest." >&2
  printf '%s\n' "$cert_report" | head -n 35 >&2
  exit 1
fi

for actual in "${actuals[@]}"; do
  if [[ ! "$actual" =~ ^[0-9a-f]{64}$ || "$expected" != "$actual" ]]; then
    # Certificate fingerprints are public and safe to report; never print keys.
    echo "::error::APK certificate does not match the persistent debug keystore." >&2
    echo "Expected certificate SHA-256: $expected" >&2
    echo "APK certificate SHA-256: $actual" >&2
    exit 1
  fi
done

echo "APK signing verified: $expected (${#actuals[@]} signer certificate record(s))"
