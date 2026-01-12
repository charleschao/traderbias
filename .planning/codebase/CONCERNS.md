# Codebase Concerns

**Analysis Date:** 2026-01-12

## Tech Debt

**Monolithic App.jsx (~2,007 lines):**
- Issue: All state management, API calls, and data coordination in single file
- Files: `src/App.jsx`
- Why: Organic growth during rapid development
- Impact: Difficult to maintain, slow hot-reload, hard to reason about data flow
- Fix approach: Extract state management to context/hooks, split into feature modules

**No Test Coverage:**
- Issue: Zero automated tests for business-critical bias calculations
- Files: `src/utils/biasCalculations.js`, `src/utils/flowSignals.js`, `server/biasProjection.js`
- Why: Fast iteration priority over test infrastructure
- Impact: Regressions go unnoticed, refactoring is risky
- Fix approach: Add Vitest, prioritize testing calculation utilities

**Mixed Quote Styles:**
- Issue: Inconsistent string quoting (single vs double quotes)
- Files: Throughout codebase
- Why: No strict formatting enforcement
- Impact: Minor - code style inconsistency
- Fix approach: Add Prettier config, run format on codebase

## Known Bugs

**No active bugs documented**
- Codebase appears stable based on recent commits
- No TODO/FIXME comments found in source code

## Security Considerations

**VPN Credentials in Docker Compose:**
- Risk: ProtonVPN credentials stored in `server/docker-compose.yml` comments/examples
- Files: `server/docker-compose.yml`, `server/.env.example`
- Current mitigation: Actual credentials in .env (gitignored)
- Recommendations: Document that `.env` must never be committed; consider secrets management

**No API Rate Limiting:**
- Risk: Backend endpoints have no rate limiting
- Files: `server/server.js`
- Current mitigation: Backend not publicly exposed (internal use only)
- Recommendations: Add rate limiting if exposing API publicly

**No Input Validation:**
- Risk: API endpoints accept parameters without validation
- Files: `server/server.js` (route handlers)
- Current mitigation: Limited attack surface (read-only endpoints)
- Recommendations: Add Zod or Joi validation for query params

## Performance Bottlenecks

**Large localStorage Persistence:**
- Problem: Historical data stored in localStorage with 60min retention
- Files: `src/App.jsx` (localStorage operations)
- Measurement: Not measured, but localStorage is synchronous
- Cause: Frequent reads/writes to localStorage on state updates
- Improvement path: Debounce writes, consider IndexedDB for large data

**Component Re-renders:**
- Problem: App.jsx state changes trigger widespread re-renders
- Files: `src/App.jsx`, all child components
- Measurement: Not measured
- Cause: All state in single component, no memoization
- Improvement path: Add React.memo to components, useMemo for expensive calculations

## Fragile Areas

**WebSocket Connection Management:**
- Files: `src/hooks/useWhaleWebSockets.js`, `src/config/whaleWsConfig.js`
- Why fragile: 5+ exchange connections, each with custom parser
- Common failures: Exchange API changes break parsers silently
- Safe modification: Test each exchange connection individually after changes
- Test coverage: None (manual testing only)

**Bias Calculation Weights:**
- Files: `src/utils/biasCalculations.js`, `server/biasProjection.js`
- Why fragile: Magic numbers for weights (55%, 20%, etc.) scattered in code
- Common failures: Weight changes can dramatically alter bias output
- Safe modification: Extract weights to config, add unit tests before changing
- Test coverage: None

## Scaling Limits

**In-Memory Data Storage (Backend):**
- Current capacity: 24 hours of historical data for all coins
- Files: `server/dataStore.js`
- Limit: Memory-bound (no database)
- Symptoms at limit: Process memory grows, potential OOM
- Scaling path: Add Redis or SQLite for persistence

**Single Backend Instance:**
- Current capacity: Single VPS handling all requests
- Limit: CPU/memory bound for data collection
- Symptoms at limit: Slow response times, missed data collection intervals
- Scaling path: Add Redis pub/sub for horizontal scaling

## Dependencies at Risk

**react-router-dom 7.x:**
- Risk: Major version, API may change
- Impact: Routing could break on minor updates
- Migration plan: Pin version, test before upgrading

**rolldown-vite (npm alias):**
- Risk: Using fork of Vite (rolldown-vite@7.2.5)
- Impact: May diverge from mainline Vite, community support limited
- Migration plan: Monitor Vite/Rolldown unification progress

## Missing Critical Features

**No Authentication:**
- Problem: Dashboard is public, no user accounts
- Current workaround: N/A (designed as public tool)
- Blocks: User-specific settings, saved preferences
- Implementation complexity: Low (add Supabase Auth if needed)

**No Persistent User Settings:**
- Problem: Exchange selection, timeframe preferences reset on refresh
- Current workaround: Default values used
- Blocks: Personalized experience
- Implementation complexity: Low (localStorage or backend storage)

## Test Coverage Gaps

**Bias Calculation Logic:**
- What's not tested: `calculateCompositeBias`, `detectFlowConfluence`, all signal detection
- Files: `src/utils/biasCalculations.js`, `src/utils/flowSignals.js`
- Risk: Core business logic could have calculation errors
- Priority: High
- Difficulty to test: Low (pure functions, easy to unit test)

**Backend Projection Algorithms:**
- What's not tested: 8-12H and daily bias projections
- Files: `server/biasProjection.js`, `server/dailyBiasProjection.js`
- Risk: Projections could be incorrect, win rate tracking inaccurate
- Priority: High
- Difficulty to test: Medium (need mock data for historical calculations)

**WebSocket Parsers:**
- What's not tested: Exchange-specific message parsing
- Files: `src/config/whaleWsConfig.js`
- Risk: Parser breaks silently when exchange changes message format
- Priority: Medium
- Difficulty to test: Medium (need mock WebSocket messages)

---

*Concerns audit: 2026-01-12*
*Update as issues are fixed or new ones discovered*
