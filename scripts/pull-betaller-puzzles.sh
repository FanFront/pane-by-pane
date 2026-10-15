#!/usr/bin/env bash
# Pull Betaller's public puzzle JSON into the local app bundle at build time.
# This generates data for the current build; the upstream game files are not
# committed to the pane-by-pane Git tree.
set -euo pipefail
cd "$(dirname "$0")/.."

UPSTREAM_URL="https://github.com/Betaller/SolverOfTheArtisanOfGlimmith.git"
OUTPUT="${BETALLER_OUTPUT:-public/presets/betaller.json}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "Downloading Betaller puzzle definitions..."
git clone --quiet --depth 1 "$UPSTREAM_URL" "$WORKDIR/Betaller"
echo "Betaller source revision: $(git -C "$WORKDIR/Betaller" rev-parse HEAD)"
node scripts/convert-betaller.mjs --root "$WORKDIR/Betaller" --output "$OUTPUT"

# Fail the build if an upstream format change silently drops most levels.
# Currently 1,229/1,231 pass all game-engine validation checks.
node --input-type=module - "$OUTPUT" <<'NODE'
import {readFileSync} from 'node:fs';
const file = process.argv[2];
const report = JSON.parse(readFileSync(file + '.report.json', 'utf8'));
if (report.converted < 1200) {
  console.error('Too few valid Betaller puzzles: ' + JSON.stringify(report));
  process.exit(1);
}
console.log(`Bundled ${report.converted} verified offline puzzles; skipped ${report.skipped}.`);
NODE
