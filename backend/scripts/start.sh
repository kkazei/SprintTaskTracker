#!/bin/sh
# Container entrypoint: apply migrations, optionally load demo data, then start the API.
set -e

echo "Applying database migrations..."
alembic upgrade head

if [ "${SEED_DEMO_DATA:-true}" = "true" ]; then
  echo "Loading demo data (skipped automatically if users already exist)..."
  python -m app.db.seed
fi

# PORT is injected by hosting platforms such as Render; default to 8000 locally.
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips "*"
