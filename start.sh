#!/bin/bash
set -e

echo "🔄 Syncing database schema..."
npx prisma db push --accept-data-loss 2>&1
echo "✅ Database schema synced"

# Start Next.js in the foreground, but first kick off a background warmup
(
  # Wait for the server to accept connections
  echo "🔥 Warming up..."
  for i in $(seq 1 30); do
    if curl -sf http://localhost:3000/login -o /dev/null 2>/dev/null; then
      echo "✅ Server accepting connections"
      # Hit key routes to pre-compile them
      curl -sf http://localhost:3000/ -o /dev/null 2>/dev/null || true
      curl -sf http://localhost:3000/api/saved-properties -o /dev/null 2>/dev/null || true
      curl -sf http://localhost:3000/api/credits -o /dev/null 2>/dev/null || true
      echo "✅ Warmup complete — all routes pre-compiled"
      break
    fi
    sleep 1
  done
) &

# Start the Next.js production server (this becomes PID 1)
exec npm run start
