#!/bin/bash

set -e

echo "🚀 Building Zendown..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "zendown-frontend/package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check for SemWare environment variables
print_status "Checking SemWare environment variables..."

# Check if SEMWARE_API_KEY is set
if [ -z "$SEMWARE_API_KEY" ]; then
    print_warning "SEMWARE_API_KEY is not set"
    print_warning "To enable related notes feature, set it in your fish shell:"
    echo "  set -x SEMWARE_API_KEY \"your-secure-api-key-here\""
    echo ""
    print_warning "You can also set it temporarily for this session:"
    echo "  set -x SEMWARE_API_KEY \"your-secure-api-key-here\" && ./build.sh"
    echo ""
else
    print_status "SEMWARE_API_KEY is set ✓"
fi

# Check if SEMWARE_URL is set
if [ -z "$SEMWARE_URL" ]; then
    print_warning "SEMWARE_URL is not set (will use default: http://localhost:8000)"
    print_warning "To customize SemWare URL, set it in your fish shell:"
    echo "  set -x SEMWARE_URL \"http://your-semware-server:8000\""
    echo ""
else
    print_status "SEMWARE_URL is set to: $SEMWARE_URL ✓"
fi

echo ""

# Build frontend
print_status "Building frontend..."
cd zendown-frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing frontend dependencies..."
    npm install
fi

# Install adapter-static if not already installed
if ! npm list @sveltejs/adapter-static > /dev/null 2>&1; then
    print_status "Installing adapter-static..."
    npm install @sveltejs/adapter-static@^3.0.8
fi

# Build the frontend
print_status "Compiling frontend to static files..."
npm run build

# Check if build was successful
if [ ! -d "build" ]; then
    print_error "Frontend build failed - build directory not found"
    exit 1
fi

print_status "Frontend build completed successfully"

# Copy build files to backend
print_status "Copying build files to backend..."
cd ..
if [ -d "zendown-backend/build" ]; then
    rm -rf zendown-backend/build
fi
cp -r zendown-frontend/build zendown-backend/

# Build Go backend
print_status "Building Go backend..."
cd zendown-backend

# Download dependencies
print_status "Downloading Go dependencies..."
go mod tidy

# Build the binary in the backend directory (where embed can find build files)
print_status "Compiling Go binary with embedded frontend..."
go build -o zendown main.go

# Check if build was successful
if [ ! -f "zendown" ]; then
    print_error "Go build failed - binary not found"
    exit 1
fi

print_status "Go binary built successfully with embedded frontend"

# Move binary to project root
cd ..
if [ -f "zendown" ]; then
    rm zendown
fi
mv zendown-backend/zendown .

# Clean up build files from backend (they're now embedded)
print_status "Cleaning up build files..."
rm -rf zendown-backend/build

print_status "Build completed successfully! 🎉"
print_status "You can now run the application with: ./zendown"
print_status "The app will be available at: http://localhost:8080"
print_status "The binary is now standalone and contains the embedded frontend!"
print_status "Database will be created as: zendown.db"

# SemWare feature information
if [ -n "$SEMWARE_API_KEY" ]; then
    print_status "Related notes feature is enabled! 🧠"
    print_status "Make sure SemWare server is running at: ${SEMWARE_URL:-http://localhost:8000}"
else
    print_warning "Related notes feature is disabled (SEMWARE_API_KEY not set)"
    print_warning "To enable it, set SEMWARE_API_KEY and rebuild"
fi 