# Trader Bias - Windows Deploy Script
# Run this from the project root: .\deploy.ps1

# ============== CONFIGURATION ==============
# Edit these values for your VPS
$VPS_USER = "c"                             # Your VPS username
$VPS_HOST = "82.29.128.123"                 # Your VPS IP or domain
$VPS_PORT = "22222"                         # SSH port (default is 22)
$VPS_PATH = "/home/c/tb"           # Path on VPS where app lives
$SSH_KEY = "$env:USERPROFILE\.ssh\id_ed25519"  # Path to your SSH key (optional)

# ============== BUILD ==============
Write-Host "`n[BUILD] Building production bundle..." -ForegroundColor Cyan

# Use full path to npm if not in PATH
$npm = "npm"
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    $npm = "C:\Program Files\nodejs\npm.cmd"
}

# Run build
& $npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Build complete!" -ForegroundColor Green

# ============== DEPLOY ==============
Write-Host "`n[DEPLOY] Deploying to VPS..." -ForegroundColor Cyan

# Check if dist folder exists
if (-not (Test-Path "dist")) {
    Write-Host "[ERROR] dist/ folder not found. Build may have failed." -ForegroundColor Red
    exit 1
}

# Build SCP command
$scpArgs = @("-r", "-P", $VPS_PORT, "dist/*", "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/")

if (Test-Path $SSH_KEY) {
    $scpArgs = @("-i", $SSH_KEY) + $scpArgs
}

Write-Host "Uploading to ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/" -ForegroundColor Yellow

# Run SCP
scp @scpArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Deploy failed! Check your VPS credentials." -ForegroundColor Red
    exit 1
}

Write-Host "`n[OK] Deploy complete!" -ForegroundColor Green
Write-Host "Your app should be live at your VPS URL" -ForegroundColor Cyan
