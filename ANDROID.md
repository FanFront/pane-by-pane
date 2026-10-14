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

**Important:** GitHub-hosted debug builds may be signed with different
temporary debug keys between workflow runs. If Android refuses to install an
update because the signatures differ, uninstall the older APK first; this
removes its locally saved games. To preserve progress across future APK updates,
set up a persistent signing key rather than relying on temporary debug signing.

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
