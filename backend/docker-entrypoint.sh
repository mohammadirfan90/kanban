#!/bin/sh
set -e

echo "==> Running database migrations..."
npx prisma migrate deploy

if [ $# -gt 0 ]; then
  exec "$@"
else
  echo "==> Starting NestJS API server..."
  exec node dist/main.js
fi
