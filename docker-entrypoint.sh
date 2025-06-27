#!/bin/sh
set -e

echo "HELLLOOO WORLD"

# 0) write out a .env for dotenv (optional)
# cat > /app/.env <<EOF
# DATABASE_URL=${DATABASE_URL}
# AI_SERVER_URL=${AI_SERVER_URL}
# ADMIN_USERNAME=${ADMIN_USERNAME}
# ADMIN_PASSWORD=${ADMIN_PASSWORD}
# PUBLIC_SITE_TITLE=${PUBLIC_SITE_TITLE}
# EOF

echo "Set environment variables."

# --- Debugging ---
echo "--- Environment Variables ---"
echo "ORIGIN: ${ORIGIN}"
echo "SITE_ADDRESS: ${SITE_ADDRESS}"
echo "DATABASE_URL: ${DATABASE_URL}"
echo "AI_SERVER_URL: ${AI_SERVER_URL}"
echo "ADMIN_USERNAME: ${ADMIN_USERNAME}"
echo "---------------------------"
# --- End Debugging ---

touch "/db/local.db"

echo "CREATED EMPTY DB"
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
