# ┌───────────────────────────────────────────────────────────────┐
# │ 1. Build stage: Install deps & build the app                 │
# └───────────────────────────────────────────────────────────────┘
FROM node:lts-bullseye AS builder
WORKDIR /app

# Copy and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and build the app
COPY . .
RUN npm run build

# ┌───────────────────────────────────────────────────────────────┐
# │ 2. Runtime stage: Only essentials, copy build, entrypoint    │
# └───────────────────────────────────────────────────────────────┘
FROM node:lts-bullseye AS runtime
WORKDIR /app

# Install only prod dependencies (and CLI for migrations)
COPY package.json package-lock.json ./
RUN npm ci

# Copy Drizzle config and migrations for runtime migrations
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src ./src

# COPY migrations ./migrations
# 
# Make sure the db directory exists (for first run)
RUN mkdir -p /db
VOLUME ["/db"]

# Copy built app from builder
COPY --from=builder /app/build ./build
RUN touch /db/local.db
# COPY --from=builder /app/local.db /db/local.db

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh


# Expose the SvelteKit server port
EXPOSE 3000

# You may want to copy your .env file for fallback/local dev, but
# Compose's `environment:` or `env_file:` is preferred for prod

# Set defaults (overridable in Compose)
ARG AI_SERVER_URL
ENV DATABASE_URL="file:/db/local.db"
# ENV AI_SERVER_URL="http://zendown-ai:8000"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "build/index.js"]
