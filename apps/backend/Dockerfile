FROM ghcr.io/nubjs/nub:0.9.3

WORKDIR /app

# The lockfile is shared across the workspace, so every member's manifest has
# to be present for `nub ci` to validate it — even though only the backend's
# dependencies get installed.
COPY --chown=node:node package.json nub.lock ./
COPY --chown=node:node apps/backend/package.json apps/backend/
COPY --chown=node:node apps/ui/package.json apps/ui/
COPY --chown=node:node scripts/cli/package.json scripts/cli/
RUN nub ci --filter backend

COPY --chown=node:node apps/backend apps/backend

WORKDIR /app/apps/backend

EXPOSE 3000
CMD ["nub", "run", "dev"]
