# Løft API

Small Node 22 + TypeScript API (Hono + pg) with PostgreSQL.

## Run locally
Requires Docker Desktop. From the repo root:

```sh
docker compose up --build
curl http://localhost:8787/health   # → {"ok":true}
```

Data lives in the `db-data` Docker volume and survives restarts. `docker compose down -v` deletes it.

Settings (see `.env.example` in the repo root): copy to `.env` to change the database password,
`JWT_SECRET` (at least 32 random characters on a real server) and `CORS_ORIGINS`.

## Develop / test
```sh
docker run -d --name loeft-testdb -e POSTGRES_USER=loeft -e POSTGRES_PASSWORD=loeft \
  -e POSTGRES_DB=loeft_test -p 5433:5432 postgres:17-alpine
cd server && npm ci && npm run typecheck && npm test
```

Migrations are plain SQL files in `migrations/`, run in name order at startup.
