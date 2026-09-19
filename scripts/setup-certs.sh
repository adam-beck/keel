#!/usr/bin/env bash
# Generates a locally-trusted TLS cert for keel.localhost using mkcert.
set -euo pipefail

if ! command -v mkcert >/dev/null 2>&1; then
	echo "error: mkcert is not installed or not on PATH." >&2
	echo "Install it first: https://github.com/FiloSottile/mkcert#installation" >&2
	exit 1
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ -f "$CAROOT/rootCA.pem" ] && [ -f "$CAROOT/rootCA-key.pem" ]; then
  echo "mkcert CA already installed, skipping."
else
  mkcert -install
fi

mkdir -p certs
mkcert -cert-file certs/keel.localhost.pem -key-file certs/keel.localhost-key.pem keel.localhost

echo "Certs written to ./certs. Run 'docker compose up' and visit https://keel.localhost"
