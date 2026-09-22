#!/usr/bin/env bash
# Customizes a fresh clone of this template: renames the dev hostname,
# database, and DB user from "keel" to the given project name, and
# generates a local Postgres password if one doesn't exist yet.
#
#   ./scripts/init-template.sh my-app
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

mkdir -p secrets
if [ ! -f secrets/postgres_password.txt ]; then
  password=$(openssl rand -hex 24 2>/dev/null || head -c32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c32)
  printf '%s\n' "$password" > secrets/postgres_password.txt
  echo "Generated secrets/postgres_password.txt"
fi

name="${1:-}"
if [ -z "$name" ]; then
  read -rp "Project name (lowercase letters, digits, hyphens): " name
fi

if ! [[ "$name" =~ ^[a-z][a-z0-9-]*$ ]]; then
  echo "error: name must start with a letter and contain only lowercase letters, digits, and hyphens." >&2
  exit 1
fi

if ! grep -q "keel" README.md compose.yml Caddyfile mprocs.yaml scripts/setup-certs.sh 2>/dev/null; then
  echo "Nothing to do: this repo doesn't look like an uncustomized keel template anymore."
  exit 0
fi

db_name="${name//-/_}"
db_user="${db_name}_admin"

# Portable in-place sed (GNU and BSD both accept a trailing backup suffix arg).
replace() {
  local file=$1 pattern=$2
  sed -i.bak -E "$pattern" "$file"
  rm -f "$file.bak"
}

replace README.md "s/^# keel$/# ${name}/"
replace mprocs.yaml "s/keel\.localhost/${name}.localhost/g"
replace Caddyfile "s/keel\.localhost/${name}.localhost/g"
replace scripts/setup-certs.sh "s/keel\.localhost/${name}.localhost/g"
replace compose.yml "s/POSTGRES_USER: keel_admin/POSTGRES_USER: ${db_user}/"
replace compose.yml "s/POSTGRES_DB: keel$/POSTGRES_DB: ${db_name}/"

cat <<EOF
Done. Renamed to "${name}" (db "${db_name}", db user "${db_user}").

Next steps:
  ./scripts/setup-certs.sh
  docker compose up

You can delete scripts/init-template.sh once you're happy with the result.
EOF
