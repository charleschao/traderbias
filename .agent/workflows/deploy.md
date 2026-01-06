---
description: how to deploy the app to VPS
---
// turbo-all

# Deploy to VPS

## Prerequisites
- SSH access to your VPS
- Node.js installed locally (for building)

## Steps

1. Edit `deploy.ps1` and set your VPS credentials:
   - `$VPS_USER` - your VPS username (e.g., "root")
   - `$VPS_HOST` - your VPS IP or domain
   - `$VPS_PATH` - where to upload (e.g., "/var/www/traderbias")
   - `$SSH_KEY` - path to your SSH key (optional)

2. Run the deploy script:
```powershell
cd d:\gitprojects\traderbias
.\deploy.ps1
```

3. On first deploy, make sure VPS has the target directory:
```bash
ssh user@your-vps "mkdir -p /var/www/traderbias"
```

## What the script does
1. Runs `npm run build` to create production files in `dist/`
2. Uploads `dist/*` to your VPS via SCP
3. Reports success/failure

## Alternative: Git-based deploy
If you have git on your VPS:
```bash
ssh user@your-vps "cd /var/www/traderbias && git pull && npm run build"
```
