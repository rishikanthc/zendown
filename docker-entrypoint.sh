#!/bin/sh
set -e

echo "HELLLOOO WORLD"
# 1. Apply Drizzle migrations
echo "⏳ Running migrations..."
npx drizzle-kit generate
if ! npx drizzle-kit migrate; then
    echo "Migration application failed, but continuing..." # Corrected message
fi

echo "Running database push..."
if ! npx drizzle-kit push; then
    echo "Database push failed, but continuing..."
fi


# npx drizzle-kit push --force
# npm run db:push --force

# 2. Then exec whatever CMD was given (i.e. “node build/index.js”)
echo "✅ Database operations complete. Starting server." # Adjusted message for clarity
exec "$@"

