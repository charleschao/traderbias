# Deploy 6 Quick Fixes - Action Plan

## ✅ What's Ready to Deploy

### Backend Changes (Complete):
- Flow Confluence as primary signal (35% weight)
- Coin-specific CVD thresholds (BTC $50k, ETH $20k, SOL $5k)
- Momentum mode for funding analysis
- Win rate tracking system
- New API endpoints: `/api/win-rates/:coin`, `/api/predictions/:coin`

### Files Changed:
- `server/biasProjection.js` - Algorithm improvements
- `server/winRateTracker.js` - NEW FILE
- `server/server.js` - New endpoints

---

## Step 1: Commit & Push Backend

```bash
cd "C:\Users\Charl\Pdrive\My files\gitprojects\traderbias.app"

git status
git add server/
git commit -m "feat: 6 quick fixes for bias projection algorithm

- Add Flow Confluence as primary signal (35% weight)
- Coin-specific CVD thresholds (BTC $50k, ETH $20k, SOL $5k)
- Momentum mode for funding (catches bullish trends + contrarian extremes)
- Win rate tracking with 10H evaluation
- New endpoints: /api/win-rates, /api/predictions

Expected: 57-60% win rate for STRONG signals"

git push
```

---

## Step 2: Deploy Backend to VPS

```bash
# SSH to VPS
ssh c@82.29.128.123 -p 22222

# Navigate to backend
cd /var/www/traderbias/server

# Pull latest code
git pull

# Rebuild Docker containers
docker compose down
docker compose up -d --build

# Watch logs (Ctrl+C to exit)
docker logs traderbias-backend -f
```

**Expected Log Output:**
```
[DataCollector] Starting data collection workers...
[WhaleWatcher] Starting exchange connections...
[WinRateTracker] Loaded 0 predictions
Server running on port 3001
```

**Verify:**
```bash
# Test health
curl http://localhost:3001/api/health

# Test projection (should show Flow Confluence first)
curl http://localhost:3001/api/btc/projection | grep "Flow Confluence"

# Test win rates (will be empty initially)
curl http://localhost:3001/api/win-rates/BTC
```

**Exit SSH:** `exit`

---

## Step 3: Frontend Integration (NEXT TASK)

**I need to create frontend code that:**
1. Fetches backend projections for BTC, ETH, SOL
2. Displays them in BiasCard
3. Shows win rates

**Should I proceed with creating the frontend integration code now?**

The frontend changes will be:
- `src/App.jsx` - Add projection fetching
- `src/components/BiasCard.jsx` - Display backend projection + win rates
- Test locally, then deploy via `./deploy-dev.ps1`

---

## Step 4: Test & Deploy Frontend

```bash
# Test locally first
npm run dev
# Visit http://localhost:5173

# Deploy to dev
./deploy-dev.ps1
# Test at https://newdev.traderbias.app

# Deploy to prod (after testing)
./deploy-prod.ps1
# Live at https://traderbias.app
```

---

## Step 5: Monitor Win Rates

**Check daily for 2 weeks:**
```bash
curl https://traderbias.app/api/win-rates/BTC
curl https://traderbias.app/api/predictions/BTC?limit=10
```

**Target: 57-60% win rate for STRONG signals**

If achieved → Proceed to Tier 1 fixes (+27% alpha)
If not → Review data, adjust thresholds

---

## Rollback Plan

**If backend breaks:**
```bash
ssh c@82.29.128.123 -p 22222
cd /var/www/traderbias/server
git log --oneline  # Find previous commit
git reset --hard <commit-hash>
docker compose down && docker compose up -d --build
```

---

## Ready to Proceed?

**Option A:** I'll create frontend integration code now
**Option B:** Deploy backend first, integrate frontend later

**Which would you prefer?**
