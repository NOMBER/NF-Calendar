#!/usr/bin/env bash
# Package main.js, manifest.json, styles.css into dist/ and a zip with a
# top-level folder named after the plugin id.
set -euo pipefail
cd "$(dirname "$0")/.."
ID=$(node -p "require('./manifest.json').id")
rm -rf dist && mkdir -p "dist/$ID"
cp main.js manifest.json styles.css dist/
cp main.js manifest.json styles.css "dist/$ID/"
python3 -c "import shutil,sys; shutil.make_archive('dist/'+sys.argv[1], 'zip', 'dist', sys.argv[1])" "$ID"
rm -rf "dist/$ID"
ls -la dist
