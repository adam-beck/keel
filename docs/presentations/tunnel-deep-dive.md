# The Dev Tunnel, In Detail

**Companion doc to [local-dev-setup.md](local-dev-setup.md)** — a closer
look at how the `tunnel` proc actually works, and what else you could
reach for instead.

---

## What problem it solves

Your dev machine almost certainly isn't reachable from the public
internet — it's behind NAT, a router, maybe a firewall, with no port
forwarding set up (and you don't want to set any up just to show
someone a build). A tunnel flips the connection around: instead of the
outside world connecting *in* to you, your machine connects *out* to a
relay service, and that relay hands out a public URL that forwards
traffic back down the connection you opened. No router config, no
inbound firewall rule, nothing to undo afterward — you just stop the
process.

## How the cloudflared quick tunnel works

The proc in [mprocs.yaml](../../mprocs.yaml):

```yaml
  tunnel:
    autostart: false
    shell: >
      $HOME/.local/bin/cloudflared tunnel --url https://localhost:443
      --http-host-header keel.localhost
      --origin-server-name keel.localhost
      --origin-ca-pool $HOME/.local/share/mkcert/rootCA.pem
```

**Step by step:**

1. **Outbound connection only.** `cloudflared` opens a connection from
   your machine *out* to Cloudflare's edge network over HTTP/2 (QUIC
   where available). This is the whole trick — nothing needs to be
   reachable from outside, because your machine initiated the
   connection. That connection stays open and multiplexes requests over
   it in both directions.

2. **A random hostname gets assigned.** Because this is a *quick*
   tunnel (as opposed to a named one — more below), Cloudflare doesn't
   know who you are and issues a throwaway
   subdomain like `https://some-random-words.trycloudflare.com`,
   printed to stdout when the proc starts. It's live for as long as the
   process runs and is torn down — and a new one issued — every time you
   restart it.

3. **Requests flow back down the tunnel to your origin.** When someone
   hits that public URL, Cloudflare forwards the request down the
   open connection to `cloudflared`, which makes a local request to
   whatever `--url` points at — here, `https://localhost:443`, i.e.
   Caddy.

4. **The remaining three flags exist because we're pointing at Caddy,
   not directly at the UI dev server:**

   - **`--http-host-header keel.localhost`** — Caddy's routing in the
     [Caddyfile](../../Caddyfile) is keyed on the `keel.localhost`
     hostname block. Without this, cloudflared would forward the
     original `*.trycloudflare.com` `Host` header, which wouldn't match
     that block and Caddy wouldn't know what to serve.
   - **`--origin-server-name keel.localhost`** — sets the TLS SNI
     (Server Name Indication) cloudflared presents when it connects to
     your local origin, so Caddy — which is serving the
     `keel.localhost` cert — hands back the right certificate for that
     handshake.
   - **`--origin-ca-pool $HOME/.local/share/mkcert/rootCA.pem`** — tells
     cloudflared to trust your mkcert-issued certificate when it
     connects to `https://localhost:443`, by handing it the mkcert root
     CA to validate against. Without this, cloudflared would reject
     Caddy's certificate as untrusted (it's signed by a CA your
     *browser* trusts because `mkcert -install` added it, but
     cloudflared has no reason to trust it on its own) and either error
     out or (worse) you'd be tempted to skip verification entirely.

   Net effect: the public tunnel exercises the *exact same* HTTPS +
   routing path as hitting `https://keel.localhost` yourself — same
   cert, same Caddy rules, same backend routing — rather than a
   simplified path that could behave differently than what you ship.

## Trade-offs of the quick-tunnel approach specifically

- **The URL is throwaway.** It changes every restart, so you can't
  bookmark it, put it in a QR code ahead of time, or rely on it for
  anything beyond "test this right now."
- **No auth in front of it.** Anyone with the URL can reach your dev
  server for as long as the tunnel is up — hence `autostart: false`,
  you opt in deliberately.
- **Not meant for sustained/production traffic.** Cloudflare documents
  quick tunnels as a convenience feature; they can be rate-limited or
  deprioritized under load. Fine for "let me test this on my phone for
  five minutes," not fine as a standing endpoint.
- **Single point of dependency.** If Cloudflare's quick-tunnel service
  has an outage, this specific proc stops working — everything else in
  the dev setup is unaffected.

## Alternatives

| Option | Cost | How it differs |
|---|---|---|
| **cloudflared named tunnel** | Free | Same tool, but you register a tunnel against a domain you manage in Cloudflare DNS. Gives you a stable, permanent hostname instead of a random one per run — worth it if you tunnel often enough that "the URL changes every time" gets annoying. Requires owning a domain on Cloudflare. |
| **[ngrok](https://ngrok.com/)** | Free tier (random URL, rate-limited) / paid (~$8-20+/mo for reserved domains, more connections, team features) | The category-defining tool here. Free tier is similar to cloudflared quick tunnels; paid tiers add reserved subdomains or custom domains, a local web UI for inspecting/replaying requests, and built-in HTTP basic auth in front of the tunnel — handy if you want the "no auth" trade-off above solved without extra work. |
| **[Tailscale Funnel](https://tailscale.com/kb/1223/funnel)** | Free (part of Tailscale's free tier for small teams) | A different model entirely: your devices join a private mesh VPN (Tailscale), and Funnel exposes one service from that mesh to the public internet over a stable `*.ts.net` domain. No per-run URL at all. Best when your team is already using Tailscale for other things (e.g. reaching internal services), since you get this almost for free on top of that. |
| **[localtunnel](https://github.com/localtunnel/localtunnel)** | Free | An npm package (`npx localtunnel --port 3000`), no signup. Conceptually the same as a cloudflared quick tunnel but self-hosted-relay-optional and less actively maintained — reliability and the shared public relay have historically been rougher than cloudflared/ngrok. Fine for a quick one-off if you don't want to install anything extra. |
| **[Pinggy](https://pinggy.io/)** | Free tier (60 min sessions) / paid (~$2-5+/mo for persistent tunnels) | SSH-based — `ssh -p 443 -R0:localhost:3000 a.pinggy.io`, no client install needed beyond `ssh`, which is already on your machine. Paid tiers give persistent subdomains and remove the session time limit. |
| **Reverse SSH tunnel to a VPS you own** | Cost of the VPS (~$4-6/mo, e.g. a small droplet or Lightsail instance) | Fully self-hosted: `ssh -R 8080:localhost:3000 you@your-vps`, then point a domain's DNS at the VPS and reverse-proxy 8080 there (this repo's Caddy setup, run on the VPS, would work for that too). No third-party tunnel service in the loop at all, but you own the ops burden — the VPS, its firewall, its uptime. |

**Picking one:** for "let a teammate or my phone hit my laptop for ten
minutes," the free tier of cloudflared or ngrok is plenty — that's
exactly what this repo uses. Reach for a paid tier or Tailscale Funnel
once you want a *stable* URL you reuse across sessions; reach for your
own VPS only if you specifically don't want a third party in the
request path at all.
