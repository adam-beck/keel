# keel

## Using this template

Clone it with [giget](https://github.com/unjs/giget), then rename the project (hostname, database, and DB user) with the `keel` CLI:

```sh
npx giget gh:adam-beck/keel my-app
cd my-app
nub install
./scripts/cli/bin/keel init my-app
./scripts/cli/bin/keel certs
docker compose up
```

`keel init` only sets the hostname, database name, and database user — everything it touches (`README.md`, `mprocs.yaml`, `Caddyfile`, `compose.yml`, `apps/backend/src/db.ts`, `apps/backend/drizzle.config.ts`) is a plain config file, so feel free to edit any of those values further by hand, including the ones it just set.

It also generates `secrets/postgres_password.txt` with a random password if one doesn't already exist (that file is gitignored, so a fresh clone never has one). Edit its contents anytime to use your own password instead.

## Troubleshooting

**`docker compose up` fails to bind port 443 with a permission error.** This happens under rootless Docker or Podman, where the daemon runs unprivileged and can't open ports below 1024 on its own. Fix it once per machine by lowering the unprivileged port floor:

```sh
sudo sysctl -w net.ipv4.ip_unprivileged_port_start=443
```

To make it persist across reboots, add `net.ipv4.ip_unprivileged_port_start=443` to `/etc/sysctl.d/99-rootless-docker.conf`. After that, `docker compose up` can bind 443 directly and `https://keel.localhost` works with no port in the URL. (This is a Linux-only sysctl; it doesn't apply to Docker Desktop on macOS/Windows, which proxies ports through its VM and doesn't hit this restriction.)
