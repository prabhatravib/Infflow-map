# Clean Deploy Script - Removes existing Workers and redeploys fresh
# Use this if you're getting Durable Object migration errors

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

Write-Warning "This script will DELETE existing Workers and redeploy fresh."
Write-Warning "This will resolve Durable Object migration conflicts."
Write-Host ""
$confirm = Read-Host "Are you sure you want to continue? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Deployment cancelled."
    exit 0
}

Write-Status "Starting clean deployment..."

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

# 1. Delete existing Voice Service
Write-Status "Deleting existing Voice Service..."
Set-Location "apps/voice"
try {
    wrangler delete infflow-map-voice --force
    Write-Success "Voice service deleted"
} catch {
    Write-Warning "Voice service may not exist or already deleted"
}

# 2. Delete existing Backend Service
Write-Status "Deleting existing Backend Service..."
Set-Location "../backend"
try {
    wrangler delete infflow-map-backend --force
    Write-Success "Backend service deleted"
} catch {
    Write-Warning "Backend service may not exist or already deleted"
}

# 3. Delete existing Frontend Service
Write-Status "Deleting existing Frontend Service..."
Set-Location "../frontend"
try {
    wrangler delete infflow-map --force
    Write-Success "Frontend service deleted"
} catch {
    Write-Warning "Frontend service may not exist or already deleted"
}

Write-Status "Waiting 10 seconds for cleanup to complete..."
Start-Sleep -Seconds 10

# Now run the normal deployment
Write-Status "Starting fresh deployment..."
Set-Location "../.."
./deploy.ps1 -SkipDependencies:$SkipDependencies -SkipSecrets:$SkipSecrets
