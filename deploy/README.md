# Running the SGSM production stack

This directory holds everything needed to run SGSM behind a load balancer
with two application replicas: `nginx.conf` (the load balancer), `docker-compose.yml`
(the stack), and `CDN.md` (the edge caching strategy for a real CDN in front
of this stack).

## Prerequisites

- Docker + Docker Compose v2 (`docker compose`, not the standalone `docker-compose`)
- `content/*.json` present in the repo (already committed) — this is what
  `scripts/seed-db.mjs` seeds `data/sgsm.db` from during the image build

## 1. Build the images

From the **repo root** (not this `deploy/` folder — the compose file's build
context is `..` so the Dockerfile can see `content/`, `scripts/`, `src/`, etc.):

```bash
docker compose -f deploy/docker-compose.yml build
```

This runs the multi-stage `Dockerfile`:

1. `deps` — `npm ci`
2. `builder` — copies the source, runs `node scripts/seed-db.mjs` (builds
   `data/sgsm.db` from `content/*.json` against `src/lib/db/schema.sql`),
   then `next build` (`output: "standalone"` in `next.config.ts`)
3. `runner` — copies only the standalone server output, `public/`, `.next/static`
   and the seeded `data/` directory into a slim `node:20-alpine` image, and
   runs as a non-root `nextjs` user

Both `app1` and `app2` build from the same `Dockerfile`/image — they are
identical replicas, differentiated only by which upstream slot nginx sends
traffic to.

## 2. Seed / re-seed the database

The DB is already seeded during the image build (step 1). To reseed against
updated `content/*.json` without a full rebuild — e.g. iterating locally —
run the seed script directly against the shared volume:

```bash
docker compose -f deploy/docker-compose.yml run --rm \
  -e SGSM_DB_PATH=/app/data/sgsm.db \
  app1 node scripts/seed-db.mjs
```

`scripts/seed-db.mjs` is fully idempotent (it clears and re-inserts every
content-derived table on each run; `membership_applications` is never
touched), so this is safe to run as often as needed.

## 3. Start the stack

```bash
docker compose -f deploy/docker-compose.yml up -d
```

This starts, in dependency order:

- `app1`, `app2` — each waits until healthy (`GET /api/health` returns 200)
  before...
- `nginx` — starts only once both app replicas report healthy, then listens
  on **port 80**

Check status:

```bash
docker compose -f deploy/docker-compose.yml ps
```

## 4. Where the health check is

- **Container-level**: both `app1`/`app2` have a Docker `healthcheck` hitting
  `http://localhost:3000/api/health` inside the container; `nginx` has one
  hitting its own `/healthz` (see next.config.ts's the health route:
  `src/app/api/health/route.ts`, backed by `getHealth()` in
  `src/lib/db/queries.ts`, which returns `503` if it can't query SQLite).
- **Load-balancer-level**: `deploy/nginx.conf` exposes `GET /healthz`, which
  proxies straight through to `sgsm_app`'s `/api/health` — point any external
  uptime monitor (or an upstream cloud load balancer's health check) at
  `http://<host>/healthz`.
- **Passive upstream health**: nginx's `upstream sgsm_app` block also does
  its own passive check — 3 failed proxy attempts to a replica within 30s
  takes it out of rotation for 30s (`max_fails=3 fail_timeout=30s`), so a
  single unhealthy replica doesn't take the whole site down.

Manual check once the stack is up:

```bash
curl -i http://localhost/healthz
```

## 5. Scaling replicas

The compose file ships with exactly two named replicas (`app1`, `app2`) so
`nginx.conf`'s `upstream sgsm_app` block can reference them by fixed
hostname — this is deliberate for a small, predictable deployment. To add
more capacity:

1. Add an `app3` (etc.) service to `docker-compose.yml`, cloned from `app1`/`app2`.
2. Add a matching `server app3:3000 max_fails=3 fail_timeout=30s;` line to
   the `upstream sgsm_app` block in `nginx.conf`.
3. Reload nginx without downtime:
   ```bash
   docker compose -f deploy/docker-compose.yml exec nginx nginx -s reload
   ```

(Docker Compose's `--scale` flag doesn't help here because nginx resolves
`app1`/`app2` as fixed DNS names in its `upstream` block rather than through
Docker's internal load-balanced service DNS — that's why replicas are named
explicitly instead of using `deploy.replicas`.)

## 6. Validating `nginx.conf`

`nginx` is not installed on the Windows dev machine this stack was authored
on, so `nginx.conf` was validated by a careful manual syntax read-through
(brace balance, one directive per statement, valid context nesting) rather
than `nginx -t`. Before trusting a change to it in production, validate it
for real from inside the container:

```bash
docker run --rm -v "$(pwd)/deploy/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:1.27-alpine nginx -t
```

## 7. Stopping / cleaning up

```bash
docker compose -f deploy/docker-compose.yml down       # stop, keep the sgsm_data volume
docker compose -f deploy/docker-compose.yml down -v    # stop and delete the seeded database too
```
