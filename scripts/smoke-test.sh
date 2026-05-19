#!/usr/bin/env bash
# Local smoke test — starts docker postgres, migrates, runs API, runs integration test.
# Usage: ./scripts/smoke-test.sh

set -euo pipefail
cd "$(dirname "$0")/.."

API_PID=""

cleanup() {
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
  echo ""
  echo "Stopping postgres..."
  docker stop holomem-postgres 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Building packages..."
npm run build

echo "==> Starting postgres (port 5433)..."
docker run -d --rm --name holomem-postgres \
  -e POSTGRES_DB=holomem \
  -e POSTGRES_USER=holomem \
  -e POSTGRES_PASSWORD=holomem_dev \
  -p 5433:5432 postgres:16-alpine
sleep 5  # wait for postgres to accept connections

echo "==> Applying schema..."
npm run db:migrate

echo "==> Starting API server (port 3001)..."
node --env-file .env apps/api/dist/index.js &
API_PID=$!

echo "==> Waiting for API to be ready..."
for i in $(seq 1 20); do
  if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo "    API is up"
    break
  fi
  if [[ $i -eq 20 ]]; then
    echo "    ERROR: API did not start in time"
    exit 1
  fi
  sleep 1
done

echo "==> Running integration tests..."
npm run test:integration

echo ""
echo "All done."
