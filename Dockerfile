# Multi-stage build for ZenDown with embedded frontend
# Best practice approach for multi-platform builds

# Stage 1: Build frontend (always use build platform)
FROM --platform=$BUILDPLATFORM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy frontend files
COPY zendown-frontend/package*.json ./
COPY zendown-frontend/svelte.config.js ./
COPY zendown-frontend/vite.config.ts ./
COPY zendown-frontend/tsconfig.json ./
COPY zendown-frontend/src ./src
COPY zendown-frontend/static ./static

# Install dependencies and build frontend
RUN npm ci && npm run build

# Stage 2: Build Go backend (cross-compilation approach)
FROM --platform=$BUILDPLATFORM golang:1.24 AS backend-builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy go mod files
COPY zendown-backend/go.mod zendown-backend/go.sum ./

# Download dependencies
RUN go mod download

# Copy backend source code
COPY zendown-backend/ ./

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/build ./build

# Set up cross-compilation environment
ENV CGO_ENABLED=0
ARG TARGETPLATFORM
ARG TARGETOS
ARG TARGETARCH

# Configure Go for cross-compilation based on target platform
RUN case "$TARGETPLATFORM" in \
        "linux/amd64") \
            export GOOS=linux GOARCH=amd64 GOAMD64=v1 \
            && echo "Building for linux/amd64 with GOAMD64=v1" ;; \
        "linux/arm64") \
            export GOOS=linux GOARCH=arm64 \
            && echo "Building for linux/arm64" ;; \
        *) \
            echo "Unsupported platform: $TARGETPLATFORM" && exit 1 ;; \
    esac \
    && echo "Building with GOOS=$GOOS GOARCH=$GOARCH" \
    && go build -ldflags="-s -w" -o zendown ./

# Stage 3: Runtime (use target platform)
FROM --platform=$TARGETPLATFORM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    sqlite \
    curl

# Copy the binary from builder stage
COPY --from=backend-builder /app/zendown /app/zendown

# Set working directory
WORKDIR /app

# Create directories for volumes
RUN mkdir -p /app/data /app/attachments

# Expose port
EXPOSE 8080

# Set environment variables with defaults
ENV SEMWARE_API_KEY=""
ENV SEMWARE_URL=""

# Set the entrypoint to run the binary
ENTRYPOINT ["/app/zendown"] 