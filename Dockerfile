# Multi-stage build for ZenDown with embedded frontend

# Stage 1: Build frontend
FROM --platform=$BUILDPLATFORM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy frontend files
COPY zendown-frontend/package*.json ./
COPY zendown-frontend/svelte.config.js ./
COPY zendown-frontend/vite.config.ts ./
COPY zendown-frontend/tsconfig.json ./
COPY zendown-frontend/src ./src
COPY zendown-frontend/static ./static

# Install dependencies
RUN npm ci

# Build frontend and verify it worked
RUN npm run build && ls -la build/

# Stage 2: Build Go backend
FROM --platform=$TARGETPLATFORM golang:1.24 AS backend-builder

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

# Verify the build directory exists and has content
RUN ls -la build/ && echo "Build directory contents verified"

# Build the binary natively for the target platform (pure Go, no CGO)
ENV CGO_ENABLED=0
RUN go build -ldflags="-s -w" -o zendown ./

# Verify the binary was created
RUN ls -la zendown && echo "Binary created successfully"

# Make the binary executable
RUN chmod +x /app/zendown

# Final stage: Runtime
FROM --platform=$TARGETPLATFORM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    sqlite \
    curl

# Copy the binary
COPY --from=backend-builder /app/zendown /app/zendown

# Verify binary exists in final stage
RUN ls -la /app/zendown && echo "Binary verified in final stage"

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