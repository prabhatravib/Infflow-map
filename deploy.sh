#!/bin/bash

# PiText Travel - Cloudflare Deployment Script
# This script deploys all three services in the correct order

set -e

echo "🚀 Starting PiText Travel Cloudflare Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI is not installed. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    print_error "Not logged in to Cloudflare. Please run:"
    echo "wrangler login"
    exit 1
fi

print_status "Deploying services in order: Voice → Backend → Frontend"

# 1. Deploy Voice Service
print_status "Deploying Voice Service..."
cd apps/voice

if [ ! -f "package.json" ]; then
    print_error "Voice service package.json not found"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing voice service dependencies..."
    npm install
fi

# Deploy voice service
wrangler deploy
VOICE_URL=$(wrangler deployments list --format json | jq -r '.[0].url' | head -1)
print_success "Voice service deployed at: $VOICE_URL"

# 2. Deploy Backend Service
print_status "Deploying Backend Service..."
cd ../backend

if [ ! -f "package.json" ]; then
    print_error "Backend service package.json not found"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing backend service dependencies..."
    npm install
fi

# Set voice service URL
print_status "Setting voice service URL..."
echo "$VOICE_URL" | wrangler secret put VOICE_SERVICE_URL

# Deploy backend service
wrangler deploy
BACKEND_URL=$(wrangler deployments list --format json | jq -r '.[0].url' | head -1)
print_success "Backend service deployed at: $BACKEND_URL"

# 3. Deploy Frontend Service
print_status "Deploying Frontend Service..."
cd ../frontend

if [ ! -f "package.json" ]; then
    print_error "Frontend service package.json not found"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing frontend service dependencies..."
    npm install
fi

# Build frontend
print_status "Building frontend..."
npm run build

# Deploy frontend service
wrangler deploy
FRONTEND_URL=$(wrangler deployments list --format json | jq -r '.[0].url' | head -1)
print_success "Frontend service deployed at: $FRONTEND_URL"

# Summary
echo ""
print_success "🎉 Deployment Complete!"
echo ""
echo "Service URLs:"
echo "  Frontend:  $FRONTEND_URL"
echo "  Backend:   $BACKEND_URL"
echo "  Voice:     $VOICE_URL"
echo ""
print_warning "Don't forget to set up your API keys:"
echo "  wrangler secret put OPENAI_API_KEY"
echo "  wrangler secret put GOOGLE_MAPS_API_KEY"
echo ""
print_status "Your PiText Travel application is now live on Cloudflare!"
