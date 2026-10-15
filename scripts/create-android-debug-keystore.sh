#!/usr/bin/env bash
# Run ONCE on a trusted computer with JDK keytool available.
# Do not commit or publish the keystore or its base64 representation.
set -euo pipefail
umask 077

out="${1:-$HOME/pane-by-pane-debug.keystore}"
if [[ -e "$out" || -e "$out.base64.txt" ]]; then
  echo "Refusing to overwrite an existing signing key: $out" >&2
  exit 1
fi
command -v keytool >/dev/null || { echo "Install a JDK (keytool) first." >&2; exit 1; }
keytool -genkeypair -noprompt \
  -keystore "$out" -storetype PKCS12 -alias androiddebugkey \
  -keyalg RSA -keysize 3072 -validity 10000 \
  -storepass android -keypass android \
  -dname "CN=Pane by Pane Personal Debug, O=Personal Offline Game, C=US"
base64 < "$out" | tr -d '\n' > "$out.base64.txt"
printf '\n' >> "$out.base64.txt"
chmod 600 "$out" "$out.base64.txt"
echo "Created: $out"
echo "GitHub Actions secret value is in: $out.base64.txt"
echo "Secret name: ANDROID_DEBUG_KEYSTORE_BASE64"
echo "Optional GitHub CLI command:"
echo "  gh secret set ANDROID_DEBUG_KEYSTORE_BASE64 -R FanFront/pane-by-pane < \"$out.base64.txt\""
echo "Keep BOTH files private and backed up; do not generate another key for updates."
keytool -list -v -keystore "$out" -storepass android -alias androiddebugkey | grep -E 'SHA256:|Valid from:'
