set -euo pipefail
NAME=deepfake-watch-$(date +%Y%m%d-%H%M%S).zip
zip -r "$NAME" manifest.json src assets -x "*.DS_Store"
echo "Created $NAME"
