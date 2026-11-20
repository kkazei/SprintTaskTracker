#!/bin/sh
# Container entrypoint: apply migrations, optionally load demo data, then start the API.
set -e

echo "Applying database migrations..."
alembic upgrade head

if [ "${SEED_DEMO_DATA:-true}" = "true" ]; then
  echo "Loading demo data (skipped automatically if users already exist)..."
  python -m app.db.seed
fi

# Do NOT trust forwarded headers: the API is publicly reachable, so X-Forwarded-For could be
# forged. Client identity for rate limiting comes from the BFF's signed assertion instead.
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
