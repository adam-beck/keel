FROM ghcr.io/nubjs/nub:0.9.3

WORKDIR /app

COPY --chown=node:node package.json nub.lock ./
RUN nub ci

COPY --chown=node:node . .

EXPOSE 3000
CMD ["nub", "run", "dev"]

