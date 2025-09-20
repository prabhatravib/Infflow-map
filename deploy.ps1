# PiText Travel - Cloudflare Deployment Script (PowerShell)
# This script deploys all three services in the correct order

param(
    [switch]$SkipDependencies,
    [switch]$SkipSecrets
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

# Check if wrangler is installed
try {
    $null = Get-Command wrangler -ErrorAction Stop
} catch {
    Write-Error "Wrangler CLI is not installed. Please install it first:"
    Write-Host "npm install -g wrangler"
    exit 1
}

# Check if user is logged in to Cloudflare
try {
    $null = wrangler whoami 2>$null
} catch {
    Write-Error "Not logged in to Cloudflare. Please run:"
    Write-Host "wrangler login"
    exit 1
}

Write-Status "Deploying Infflow Map services in order: Voice → Backend → Frontend"

# 1. Deploy Voice Service
Write-Status "Deploying Voice Service..."
Set-Location "apps/voice"

if (-not (Test-Path "package.json")) {
    Write-Error "Voice service package.json not found"
    exit 1
}

# Install dependencies if needed
if (-not $SkipDependencies -and -not (Test-Path "node_modules")) {
    Write-Status "Installing voice service dependencies..."
    npm install
}

# Deploy voice service
$VoiceDeployOutput = wrangler deploy --env=""
$VoiceUrl = ($VoiceDeployOutput | Select-String "https://.*\.workers\.dev" | Select-Object -First 1).Matches[0].Value
if ($VoiceUrl) {
    Write-Success "Voice service deployed at: $VoiceUrl"
} else {
    Write-Warning "Voice service deployed but URL not extracted"
    $VoiceUrl = "https://infflow-map-voice.prabhatravib.workers.dev"
}

# 2. Deploy Backend Service
Write-Status "Deploying Backend Service..."
Set-Location "../backend"

if (-not (Test-Path "package.json")) {
    Write-Error "Backend service package.json not found"
    exit 1
}

# Install dependencies if needed
if (-not $SkipDependencies -and -not (Test-Path "node_modules")) {
    Write-Status "Installing backend service dependencies..."
    npm install
}

# Set voice service URL
if (-not $SkipSecrets) {
    Write-Status "Setting voice service URL..."
    $VoiceUrl | wrangler secret put VOICE_SERVICE_URL --env=""
}

# Deploy backend service
$BackendDeployOutput = wrangler deploy --env=""
$BackendUrl = ($BackendDeployOutput | Select-String "https://.*\.workers\.dev" | Select-Object -First 1).Matches[0].Value
if ($BackendUrl) {
    Write-Success "Backend service deployed at: $BackendUrl"
} else {
    Write-Warning "Backend service deployed but URL not extracted"
    $BackendUrl = "https://infflow-map-backend.prabhatravib.workers.dev"
}

# 3. Deploy Frontend Service
Write-Status "Deploying Frontend Service..."
Set-Location "../frontend"

if (-not (Test-Path "package.json")) {
    Write-Error "Frontend service package.json not found"
    exit 1
}

# Install dependencies if needed
if (-not $SkipDependencies -and -not (Test-Path "node_modules")) {
    Write-Status "Installing frontend service dependencies..."
    npm install
}

# Build frontend
Write-Status "Building frontend..."
npm run build

# Deploy frontend service
$FrontendDeployOutput = wrangler deploy --env=""
$FrontendUrl = ($FrontendDeployOutput | Select-String "https://.*\.workers\.dev" | Select-Object -First 1).Matches[0].Value
if ($FrontendUrl) {
    Write-Success "Frontend service deployed at: $FrontendUrl"
} else {
    Write-Warning "Frontend service deployed but URL not extracted"
    $FrontendUrl = "https://infflow-map.prabhatravib.workers.dev"
}

# Summary
Write-Host ""
Write-Success "🎉 Deployment Complete!"
Write-Host ""
Write-Host "Service URLs:"
Write-Host "  Frontend:  $FrontendUrl"
Write-Host "  Backend:   $BackendUrl"
Write-Host "  Voice:     $VoiceUrl"
Write-Host ""
Write-Warning "Don't forget to set up your API keys:"
Write-Host "  wrangler secret put OPENAI_API_KEY"
Write-Host "  wrangler secret put GOOGLE_MAPS_API_KEY"
Write-Host ""
Write-Status "Your Infflow Map application is now live on Cloudflare!"

# Return to original directory
Set-Location "../.."
