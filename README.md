# keel

## Using this template

Clone it with [giget](https://github.com/unjs/giget), then rename the project (hostname, database, and DB user) with `scripts/init-template.sh`:

```sh
npx giget gh:adam-beck/keel my-app
cd my-app
./scripts/init-template.sh my-app
./scripts/setup-certs.sh
docker compose up
```

The script only sets the hostname, database name, and database user — everything it touches (`README.md`, `mprocs.yaml`, `Caddyfile`, `scripts/setup-certs.sh`, `compose.yml`) is a plain config file, so feel free to edit any of those values further by hand, including the ones the script just set.
