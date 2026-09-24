# Design: `keel` CLI tool (replaces `scripts/*.sh`)

Status: **awaiting approval to implement**

## Goal

Replace `scripts/init-template.sh` and `scripts/setup-certs.sh` with a single
Node/TypeScript CLI that does the same job but with a nicer interactive
experience (color, spinners, validated prompts) instead of raw bash/readline.

## Structure

New package at `scripts/cli/` (own `package.json`, `nub`-managed like
`apps/backend` / `apps/ui`):

- `bin/keel` — executable shebang script (`#!/usr/bin/env -S npx tsx`), so
  invocation stays close to today's pattern:
  - `./scripts/cli/bin/keel init my-app`
  - `./scripts/cli/bin/keel certs`
  No build step — same `tsx` pattern already used for `apps/backend`'s
  `dev` script.
- `src/index.ts` — tiny hand-rolled dispatcher on `process.argv[2]`
  (`init` / `certs` / `--help`). No `commander` dependency — only two
  subcommands, doesn't earn it.
- `src/init.ts` — port of `init-template.sh`:
  - Same name validation (`^[a-z][a-z0-9-]*$`).
  - Same "already customized?" guard (checks for `keel` in the same file
    set before doing anything).
  - Same file replacements (README.md, mprocs.yaml, Caddyfile,
    scripts/setup-certs.sh → will become `certs.ts`'s own logic,
    compose.yml, apps/backend/src/db.ts, apps/backend/drizzle.config.ts),
    done in Node with `fs`/regex instead of `sed`.
  - Postgres password via `node:crypto.randomBytes` instead of shelling
    out to `openssl`/`/dev/urandom`.
- `src/certs.ts` — port of `setup-certs.sh`: same `mkcert` presence check,
  same `-install` / `-cert-file` calls, via `node:child_process`.

## Nicer UX

- `@clack/prompts` for the interactive project-name prompt (validated
  inline, arrow-key friendly) and for `intro`/`outro`/spinners around
  password generation, file rewrites, and mkcert calls.
- `picocolors` for colored success/error/next-steps output.
- Same user-facing behavior otherwise: `keel init [name]` still accepts
  the name as an arg and only prompts if omitted; both commands keep
  their current guard/error conditions (bad name format, mkcert missing,
  etc.) with clearer colored messaging.

## Cleanup

- Delete `scripts/init-template.sh` and `scripts/setup-certs.sh`.
- Update the "Next steps" text the CLI itself prints, and any README
  references, to point at the new CLI.

## Testing

- No existing test harness for these scripts. Verify by manually running
  `init` against a scratch copy of the repo and `certs` (if `mkcert` is
  available in the dev environment) to confirm parity with the old
  scripts. Note explicitly if `certs` can't be fully exercised in a given
  environment (no `mkcert` installed).

## Decisions already made (via AskUserQuestion)

- One CLI, two subcommands (not two separate CLIs).
- Colors + spinners + interactive prompts (not just colored plain text).
- Lives at `scripts/cli/`, run via `tsx` (not a compiled standalone
  binary).
- Old `.sh` scripts are deleted once the CLI replaces them (not kept
  side by side).
