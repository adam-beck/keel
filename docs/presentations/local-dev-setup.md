# Local Dev Environments That Don't Lie to You

**~10-15 min walkthrough — setting up a local dev environment**

> A note before you start: this repo happens to run Postgres, Hono, and
> React. None of that matters for this talk. Swap in whatever stack you
> like — the five pieces below (reverse proxy, local CA, file watching,
> a tunnel, a process runner) are the actual point, and they're stack-agnostic.

---

## 1. Framing (~1-2 min)

**Say:**

"Most local dev setups quietly lie to you. You run `npm run dev`, hit
`http://localhost:5173`, and everything looks fine — until you deploy and
discover a cookie that's `Secure`-only, a service worker that refuses to
register over HTTP, or a mixed-content error nobody saw coming. Or you
want to show a teammate or test on your phone and you're stuck tunneling
through ngrok with a setup that's different from what you actually run
day to day.

The goal here isn't to gold-plate a dev environment for its own sake —
it's to close the gap between 'works on my machine' and 'works,
period,' cheaply enough that you actually do it."

**Show:** nothing yet — this is scene-setting.

---

## 2. The shape of the setup (~2 min)

**Say:**

"Before the individual features, here's the overall shape. There are
three things running:

1. **Docker Compose** for the backend services — the database and a
   reverse proxy (Caddy) sit in containers, because they're
   infrastructure, not code you're actively editing line-by-line.
2. **The UI dev server, run natively** (not in Docker) — Vite (or
   whatever your frontend tooling is) wants direct filesystem access for
   fast HMR, and Docker's filesystem layer just gets in the way of that.
3. **[mprocs](https://github.com/pvolok/mprocs)** to tie both of those
   — plus an optional tunnel — into a single terminal pane instead of
   juggling three windows."

**Show:** [compose.yml](../../compose.yml) and [mprocs.yaml](../../mprocs.yaml) side by side — just the shape, don't dive in yet.

---

## 3. HTTPS locally with mkcert + Caddy (~3 min)

**Say:**

"First feature: local HTTPS. Not 'nice to have' HTTPS — actually
necessary, because a growing list of browser features straight up don't
work over plain HTTP: `Secure` cookies, service workers, most
Permissions-Policy-gated APIs, WebAuthn. If your local environment can't
exercise those code paths, you're not really testing your app.

The trick is [mkcert](https://github.com/FiloSottile/mkcert). It
generates a local certificate authority, installs it into your system
and browser trust stores, and then mints real, browser-trusted
certificates for any hostname you want — no red padlock warnings, no
`--ignore-certificate-errors` flags.

Then [Caddy](https://caddyserver.com/) sits in front of everything as a
reverse proxy: it terminates TLS using that mkcert certificate, and
routes requests — `/api/*` goes to the backend container, everything
else goes to the UI dev server running on the host."

**Show / run live:**

```bash
cat scripts/setup-certs.sh
```

"This installs the mkcert CA once, then generates a cert for
`keel.localhost`."

```bash
cat Caddyfile
```

"And this is the whole reverse proxy config — TLS plus two routing
rules."

```bash
./scripts/setup-certs.sh
docker compose up
```

Open `https://keel.localhost` in a browser — real padlock, no warnings.

**Callout:** "The domain doesn't have to be a fake TLD. mkcert works
with any hostname you control in `/etc/hosts` or your router's DNS —
`keel.localhost` just happens to resolve to loopback automatically on
most systems without extra config."

---

## 4. Docker Compose watch for the backend (~2-3 min)

**Say:**

"Second feature: the backend container needs to pick up code changes
without a full rebuild every time — that's `docker compose watch`,
Compose's built-in file-sync feature. Point it at a `develop.watch`
block, tell it which paths to `sync` straight into the container and
which files (`package.json`, the lockfile) should trigger a full
`rebuild`, and it does the rest.

Here's the thing nobody tells you: Compose's sync is *not* inotify —
it's polling-based on the host side, then writes files into the
container. Depending on your OS and filesystem, the file-watcher
*inside* the container (chokidar, in tsx's case) can silently stop
noticing those writes, because it's trusting native filesystem events
that don't always fire for a sync-written file. The fix is small but
easy to miss: tell the in-container watcher to poll too."

**Show:**

```bash
cat compose.yml
```

Point at:

```yaml
    environment:
      CHOKIDAR_USEPOLLING: "true"
      CHOKIDAR_INTERVAL: "300"
    develop:
      watch:
        - action: sync
          path: ./apps/backend/src
          target: /app/src
        - action: rebuild
          path: ./apps/backend/package.json
        - action: rebuild
          path: ./apps/backend/nub.lock
```

**Run live:** with `docker compose watch` running, edit a line in the
backend source, save, and show the container picking it up without a
rebuild.

```bash
docker compose watch
```

**Callout:** "This is the kind of thing that works fine in your quick
local test, then flakes three weeks later on someone else's laptop for
no apparent reason. If your Compose watch setup feels unreliable,
`CHOKIDAR_USEPOLLING` is worth trying before you give up on it."

---

## 5. A tunnel for testing on your phone (~2-3 min)

**Say:**

"Third feature: sometimes you need to test on an actual device — a
phone, a tablet, someone else's laptop on the same wifi — not just
resize your browser window. For that we use
[cloudflared](https://github.com/cloudflare/cloudflared)'s quick
tunnels: one command gives you a public HTTPS URL that forwards to your
machine, no account or DNS setup required.

The detail worth calling out: the tunnel doesn't point at the UI dev
server directly — it points back at Caddy, on `https://localhost`, with
the mkcert root CA passed in so cloudflared can verify the local
certificate instead of skipping verification. That means the tunnel
exercises the *exact same* HTTPS + routing path as your normal local
setup, instead of a shortcut that behaves differently."

**Show:**

```bash
cat mprocs.yaml
```

Point at the `tunnel` proc:

```yaml
  tunnel:
    autostart: false
    shell: >
      $HOME/.local/bin/cloudflared tunnel --url https://localhost:443
      --http-host-header keel.localhost
      --origin-server-name keel.localhost
      --origin-ca-pool $HOME/.local/share/mkcert/rootCA.pem
```

**Callout:** "It's `autostart: false` on purpose — a quick tunnel
exposes your dev server to the public internet for as long as it's
running. You opt in when you actually need it, not every time you start
your dev environment."

**Run live (if comfortable doing this in front of the room):** start
the tunnel proc, open the printed `*.trycloudflare.com` URL on a phone.

---

## 6. Tying it together with mprocs (~1-2 min)

**Say:**

"Last piece: mprocs. It's a terminal UI that runs several long-lived
processes side by side, in one pane, with a shared log view and process
list you switch between — instead of three terminal tabs you lose track
of.

Here it's running three things: `docker compose up`, the UI dev server,
and the optional tunnel. One command, one screen, and the risky/optional
proc (the tunnel) stays off unless you ask for it."

**Show / run live:**

```bash
mprocs
```

**Callout — be honest about scope:** "If this were a monorepo with a
single top-level `dev` script that already starts everything, mprocs
buys you a lot less — you might just run that one script. It earns its
keep specifically when you've got genuinely separate processes (a
containerized backend plus a natively-run frontend, here) that don't
share a process tree."

---

## 7. Takeaways (~1 min)

**Say:**

"None of this is about the specific stack. Swap Postgres for MySQL, Hono
for Express, React for Svelte — doesn't matter. What's portable is the
shape:

- A **reverse proxy** (Caddy, nginx, whatever) so your local URL and
  routing match prod.
- A **local CA** (mkcert) so HTTPS-gated browser features actually work
  locally.
- **File watching** (Compose watch, or your own bind-mount + poll
  setup) so containerized services still feel like local dev.
- A **tunnel** (cloudflared, ngrok) for testing on real devices, wired
  through the same HTTPS path you use locally — not a bypass.
- A **process runner** (mprocs, overmind, foreman) so starting 'dev'
  is one command, not a ritual.

Pick the pieces that solve a problem you actually have. All five together
took this repo about an hour to wire up once, and now nobody thinks
about it again."

---

## Appendix: command cheat sheet

```bash
# One-time setup
./scripts/setup-certs.sh

# Everyday dev
mprocs                    # starts docker compose up + the UI dev server
# inside mprocs, select the "tunnel" proc and press 's' to start it on demand

# Equivalent manual commands, if not using mprocs
docker compose watch      # backend + db, with live sync
cd apps/ui && nub run dev # UI dev server (or: npm run dev)
```
