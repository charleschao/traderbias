# Trader Bias - Deploy to Production VPS
# Run: .\deploy-debian

$VPS_USER = "c"
$VPS_HOST = "192.168.1.5"
$VPS_PORT = "22222"
$VPS_PATH = "/var/www/traderbias"

Write-Host "`n[1/3] Updating .env for production..." -ForegroundColor Cyan
(Get-Content .env) -replace 'VITE_BACKEND_API_URL=.*', 'VITE_BACKEND_API_URL=https://traderbias.app' | Set-Content .env

Write-Host "[2/3] Building frontend..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }

Write-Host "[3/3] Deploying to VPS..." -ForegroundColor Cyan
scp -r -P $VPS_PORT dist/* "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"
if ($LASTEXITCODE -ne 0) { Write-Host "Deploy failed!" -ForegroundColor Red; exit 1 }

Write-Host "`n[OK] Deployed to https://traderbias.app/" -ForegroundColor Green
Write-Host "Run 'ssh $VPS_USER@$VPS_HOST -p $VPS_PORT' and check 'pm2 status' for backend" -ForegroundColor Yellow
