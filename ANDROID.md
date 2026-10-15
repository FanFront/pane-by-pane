# Android APK (personal/offline play)

This fork runs the **unchanged TypeScript/Vite game** inside a native Android
WebView, using [Capacitor](https://capacitorjs.com/). The web assets are bundled
in the APK, not loaded from the GitHub Pages site. No server, account, or
network connection is needed to play after installation.

## Build with GitHub Actions (no Android Studio required)

1. Open the **Actions** tab in this repository.
2. Select **Build Android APK** and choose **Run workflow** on `main`.
   The workflow also builds automatically when its Android configuration
   changes.
3. Open the successful workflow run and download the
   **pane-by-pane-android-debug** artifact.
4. Extract its ZIP to get `app-debug.apk`.
5. Copy the APK to your phone, open it and allow installation from that source
   when Android prompts you. This is a sideloaded debug APK, **not** an app-store
   release.

The APK is created using GitHub's Java 21 and Android SDK runners. Its web
assets, puzzle generator, solver, touch input, hints, undo/redo and browser
localStorage-based autosaves are the same features as the original web game.

### Android controls and Back navigation

On narrow Android screens, the puzzle actions stay in a bottom toolbar, above
the device's gesture-navigation inset. Undo and Redo move from the header into
this bar; the desktop controls remain unchanged.

The Android build includes the Capacitor App plugin. The system **Back** key:
- goes from a chapter's level grid to the chapter list;
- closes the active level/rules/answer/warning dialog;
- dismisses the introductory rules tip if it is visible;
- otherwise minimizes the app without losing the current window.

In a web browser, Escape closes ordinary dialogs and goes up one level inside
the level browser; no Android plugin is needed for the website.

## GitHub Releases

After the persistent signing secret is configured, each successful **trusted main
branch Android workflow run** automatically publishes its APK to the GitHub
[Releases](https://github.com/FanFront/pane-by-pane/releases) page. The release
is tagged `android-v0.1.<workflow-run-number>` and contains:

- `pane-by-pane-android-v0.1.<run-number>.apk` — the installable package
- `pane-by-pane-android-v0.1.<run-number>.apk.sha256` — its integrity checksum

The APK's Android `versionCode` increases with the workflow run number, so
subsequent downloads remain normal in-place upgrades when the signing key is
the same. Debug builds are marked as GitHub **pre-releases** to distinguish
them from app-store packages.

PR builds do **not** publish a Release, and without
`ANDROID_DEBUG_KEYSTORE_BASE64` a trusted build deliberately fails before
publishing anything. You can also publish a new APK manually from
**Actions → Build Android APK → Run workflow** on `main`.

**Public-release warning:** The offline APK may contain third-party Glimmith
puzzles whose redistribution rights have not been confirmed. GitHub Releases
for a public repository are public. Confirm the right to redistribute those
puzzles before sharing a release publicly; personal use is not a publishing
license.

## Persistent debug signing for APK updates

The GitHub Actions build uses **one persistent Android debug certificate** for
every installable APK. This makes subsequent APKs updatable in place, provided
that the app ID remains `dev.fanfront.panebypane` and the key stays unchanged.

### One-time setup (required before merging the workflow change)

1. On a trusted computer with a JDK, run:
   ```sh
   bash scripts/create-android-debug-keystore.sh
   ```
   This creates `~/pane-by-pane-debug.keystore` and
   `~/pane-by-pane-debug.keystore.base64.txt`. Run **only once**; do not
   regenerate the key for future updates. The debug key uses Android's
   conventional alias `androiddebugkey` and password `android`.
2. In GitHub open this repository's
   **Settings → Secrets and variables → Actions → New repository secret**.
   Set the name to **`ANDROID_DEBUG_KEYSTORE_BASE64`** and set the value to
   the entire single line in `pane-by-pane-debug.keystore.base64.txt`.
   Or, if the GitHub CLI is authenticated:
   ```sh
   gh secret set ANDROID_DEBUG_KEYSTORE_BASE64 -R FanFront/pane-by-pane < ~/pane-by-pane-debug.keystore.base64.txt
   ```
3. Save the original `*.keystore` offline in a safe location. The base64
   text contains the same secret key and must also be kept private.
4. Run **Actions → Build Android APK → Run workflow** on `main`. The build
   fails rather than silently signing with a disposable key when the secret
   is not configured. The workflow checks that the APK certificate SHA-256
   matches the supplied keystore before uploading the installable artifact.

**Security:** Only trusted `push` and manually dispatched workflows receive
the signing secret. Pull requests still run an Android build with an ephemeral
debug keystore, but cannot download the persistent key and do not publish an
installable APK artifact. Do not commit the keystore or its base64 version.

**Migration warning:** Existing APKs signed using a previous GitHub runner's
random debug certificate **cannot be upgraded in place** with the new key.
Android requires matching signing certificates for an update. Keep the old
installation intact until any important puzzle progress has been exported or
otherwise backed up. Uninstalling or clearing app data normally erases its
localStorage and IndexedDB data; **this signing fix does not itself add a
backup/export feature**. Once an installation is using the new persistent
certificate, future APKs can be installed over it.

### Local builds with the same certificate

To produce a locally signed APK matching GitHub Actions, first install
your saved keystore as `~/.android/debug.keystore` on that computer:
```sh
mkdir -p ~/.android
cp ~/pane-by-pane-debug.keystore ~/.android/debug.keystore
chmod 600 ~/.android/debug.keystore
bash scripts/build-android.sh
bash scripts/verify-android-signing.sh
```
Do not replace an existing keystore if other Android projects depend on it.

## Build locally

Prerequisites: Node.js >=22.18, JDK 21, Android SDK/command-line tools (or
Android Studio). Then run:

```sh
bash scripts/build-android.sh
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.

The script installs **Capacitor 8.5.3** as ephemeral dependencies and generates
the native `android/` directory on demand. Neither generated Android project
files nor updated npm lockfiles are committed. This minimizes maintenance
while keeping the upstream game's dependencies and gameplay intact.

## Technical notes

- The app ID is `dev.fanfront.panebypane`.
- `capacitor.config.json` points to the Vite `dist/` output.
- `vite.config.ts` already uses relative asset URLs (`base: './'`).
- All runtime game data is bundled in the built web assets.
- No app-store signing or distribution is configured.
- Original source and PolyForm Noncommercial License are preserved. This
  is intended only for permitted noncommercial personal use.
