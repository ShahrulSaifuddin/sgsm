# syntax=docker/dockerfile:1
#
# Multi-stage build for the SGSM Next.js app.
#
#   deps    -> installs the full dependency tree once (cached across builds
#              as long as package.json/package-lock.json don't change)
#   builder -> copies source + deps, seeds the SQLite database from
#              content/*.json, then runs `next build` (output: "standalone")
#   runner  -> the actual runtime image: just the standalone server output,
#              static assets and the seeded database, run as a non-root user
#
# node-sqlite3-wasm and sharp are both listed in `serverExternalPackages` in
# next.config.ts specifically so they run as real Node modules rather than
# being bundled -- this Dockerfile relies on that: `next build`'s standalone
# output traces and copies their actual node_modules folders in, and the
# alpine base still needs sharp's prebuilt binaries, which is why it's
# installed via the ordinary `npm ci` in the `deps` stage rather than hand
# rolled.

FROM node:20-alpine AS base
WORKDIR /app
# sharp's libvips build needs these on alpine; harmless if already present.
RUN apk add --no-cache libc6-compat

# ---------------------------------------------------------------------------
FROM base AS deps
# No package-lock.json exists in this repo, so `npm ci`
# (which hard-requires a lockfile) is not an option here -- `npm install`
# resolves against package.json directly. The wildcard on package-lock.json*
# still copies it in if one is ever added later, so this stays correct either way.
COPY package.json package-lock.json* ./
RUN npm install

# ---------------------------------------------------------------------------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Seed data/sgsm.db from content/*.json so the image ships with data baked
# in (no first-request cold seed, and the DB is present even on a fresh
# volume). Re-running this against a mounted volume in compose is harmless --
# see scripts/seed-db.mjs, which is fully idempotent.
RUN node scripts/seed-db.mjs

RUN npm run build

# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root runtime user (standard Next.js recommendation for the standalone
# output) instead of running the server as root inside the container.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# `output: "standalone"` (next.config.ts) traces only the production
# dependencies the server actually needs into `.next/standalone`, so the
# runtime image never carries the full node_modules or devDependencies.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# The database seeded at build time. In docker-compose this directory is also
# a shared named volume mounted by both replicas -- see deploy/docker-compose.yml.
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

USER nextjs

EXPOSE 3000

# server.js is the standalone entrypoint Next.js generates from next.config.ts's
# `output: "standalone"`.
CMD ["node", "server.js"]
