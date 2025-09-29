# PiText Travel - Cloudflare Deployment Script (PowerShell)
# This script deploys all three services in the correct order

param(
    [switch]$SkipDependencies,
    [switch]$SkipSecrets
)

$ErrorActionPreference = "Stop"

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

function Stop-Deployment {
    param([string]$Message)
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Error $Message
    Write-Error "Deployment failed at $timestamp. Aborting remaining steps."
    try { [console]::Beep() } catch {}
    exit 1
}

function Invoke-Step {
    param(
        [string]$FailureMessage,
        [scriptblock]$Action
    )

    try {
        $result = & $Action
        if ($LASTEXITCODE -ne 0) {
            Stop-Deployment $FailureMessage
        }
        return $result
    } catch {
        Stop-Deployment "$FailureMessage`n$($_.Exception.Message)"
    }
}

# Check if wrangler is installed
try {
    $null = Get-Command wrangler -ErrorAction Stop
} catch {
    Write-Error "Wrangler CLI is not installed. Please install it first:"
    Write-Host "npm install -g wrangler"
    Stop-Deployment "Wrangler CLI is not installed."
}

# Check if user is logged in to Cloudflare
try {
    $null = wrangler whoami 2>$null
} catch {
    Write-Error "Not logged in to Cloudflare. Please run:"
    Write-Host "wrangler login"
    Stop-Deployment "Cloudflare authentication required."
}

Write-Status "Deploying Infflow Map services in order: Voice → Backend → Frontend"

# 1. Deploy Voice Service
Write-Status "Deploying Voice Service..."
Set-Location "apps/voice"

if (-not (Test-Path "package.json")) {
    Stop-Deployment "Voice service package.json not found"
}

# Install dependencies if needed
if (-not $SkipDependencies -and -not (Test-Path "node_modules")) {
    Write-Status "Installing voice service dependencies..."
    Invoke-Step "Voice service dependency installation failed." { npm install }
}

# Deploy voice service
$VoiceDeployOutput = Invoke-Step "Voice service deployment failed." { wrangler deploy --env="" }
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
    Stop-Deployment "Backend service package.json not found"
}

# Install dependencies if needed
if (-not $SkipDependencies -and -not (Test-Path "node_modules")) {
    Write-Status "Installing backend service dependencies..."
    Invoke-Step "Backend service dependency installation failed." { npm install }
}

# Set voice service URL
if (-not $SkipSecrets) {
    Write-Status "Setting voice service URL..."
    Invoke-Step "Setting voice service URL failed." { $VoiceUrl | wrangler secret put VOICE_SERVICE_URL --env="" }
}

# Deploy backend service
$BackendDeployOutput = Invoke-Step "Backend service deployment failed." { wrangler deploy --env="" }
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
    Stop-Deployment "Frontend service package.json not found"
}

# Install dependencies if needed
if (-not $SkipDependencies -and -not (Test-Path "node_modules")) {
    Write-Status "Installing frontend service dependencies..."
    Invoke-Step "Frontend service dependency installation failed." { npm install }
}

# Build frontend
Write-Status "Building frontend..."
Invoke-Step "Frontend build failed." { npm run build }

# Deploy frontend service
$FrontendDeployOutput = Invoke-Step "Frontend service deployment failed." { wrangler deploy --env="" }
$FrontendUrl = ($FrontendDeployOutput | Select-String "https://.*\.workers\.dev" | Select-Object -First 1).Matches[0].Value
if ($FrontendUrl) {
    Write-Success "Frontend service deployed at: $FrontendUrl"
} else {
    Write-Warning "Frontend service deployed but URL not extracted"
    $FrontendUrl = "https://infflow-map.prabhatravib.workers.dev"
}

# Summary
Write-Host ""
$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Write-Success " Deployment Complete at $timestamp!"
try { [console]::Beep() } catch {}
Write-Host ""
Write-Host "Service URLs:"
Write-Host "  Frontend:  $FrontendUrl"
Write-Host "  Backend:   $BackendUrl"
Write-Host "  Voice:     $VoiceUrl"
Write-Status "Your Infflow Map application is now live on Cloudflare!"

# Return to original directory
Set-Location "../.."
