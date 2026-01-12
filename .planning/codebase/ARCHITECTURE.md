# Architecture

**Analysis Date:** 2026-01-12

## Pattern Overview

**Overall:** Monolithic React SPA with Express Backend (Hub-and-Spoke Data Flow)

**Key Characteristics:**
- Single-page application with centralized state in `App.jsx`
- Backend acts as data aggregator and cache layer
- Real-time data via WebSockets to multiple exchanges
- VPN-routed backend for geo-restricted API access
- Client-side historical data persistence via localStorage

## Layers

**Presentation Layer (Frontend):**
- Purpose: Display trading bias data and visualizations
- Contains: React components, styling
- Location: `src/components/*.jsx`
- Depends on: App.jsx state via props
- Used by: End users

**Orchestration Layer (App.jsx):**
- Purpose: Central state management and data coordination
- Contains: All state, API polling, data aggregation, bias calculations
- Location: `src/App.jsx` (~2,008 lines)
- Depends on: Hooks, services, utils
- Used by: All child components

**Custom Hooks Layer:**
- Purpose: Encapsulate reusable stateful logic
- Contains: WebSocket management, notification system, data history
- Location: `src/hooks/*.js`
- Depends on: React hooks, config
- Used by: App.jsx

**Services Layer:**
- Purpose: API communication abstraction
- Contains: Backend API client
- Location: `src/services/backendApi.js`
- Depends on: Fetch API
- Used by: App.jsx

**Utilities Layer:**
- Purpose: Pure calculation functions
- Contains: Bias calculations, flow signals, formatters
- Location: `src/utils/*.js`
- Depends on: Nothing (pure functions)
- Used by: App.jsx, components

**Backend API Layer:**
- Purpose: Data aggregation, caching, bias projections
- Contains: Express routes, data collectors, projection algorithms
- Location: `server/server.js`, `server/*.js`
- Depends on: External exchange APIs
- Used by: Frontend via HTTP

## Data Flow

**Real-Time Market Data Flow:**

1. Backend collectors poll exchange APIs (Hyperliquid, Binance, etc.) - `server/dataCollector.js`
2. Data stored in-memory with 24h rolling window - `server/dataStore.js`
3. Frontend polls backend `/api/data/all` endpoint - `src/services/backendApi.js`
4. App.jsx updates state, triggers re-renders
5. Components receive data via props

**WebSocket Whale Trade Flow:**

1. `useWhaleWebSockets.js` connects to 5+ exchange WebSockets
2. Trade messages parsed per-exchange config - `src/config/whaleWsConfig.js`
3. Mega trades ($4M+) filtered and deduplicated
4. State updated in App.jsx, displayed in `MegaWhaleFeed.jsx`

**Bias Projection Flow:**

1. Frontend requests `/api/:coin/projection` from backend
2. Backend calculates 8-12H projection - `server/biasProjection.js`
3. Weighted factors: Flow Confluence (55%), Funding (20%), Exchange (15%), Whales (5%)
4. Result displayed in `BiasProjection.jsx`

**State Management:**
- No external state library (Redux, Zustand)
- All state in App.jsx via useState
- Historical data persisted to localStorage (60min OI/price, 15min bias)
- useRef for mutable buffers (e.g., historical arrays)

## Key Abstractions

**Component:**
- Purpose: UI presentation unit
- Examples: `BiasCard.jsx`, `FlowConfluenceSection.jsx`, `MegaWhaleFeed.jsx`
- Pattern: Functional components with props, no internal data fetching

**Custom Hook:**
- Purpose: Encapsulate stateful/side-effect logic
- Examples: `useWhaleWebSockets.js`, `useSparklineHistory.js`, `useSignalHistory.js`
- Pattern: React hooks returning state and handlers

**Data Collector (Backend):**
- Purpose: Poll and aggregate external data
- Examples: `dataCollector.js`, `etfFlowCollector.js`, `spotDataCollector.js`
- Pattern: Interval-based polling, in-memory storage

**Projection Engine (Backend):**
- Purpose: Calculate directional bias predictions
- Examples: `biasProjection.js`, `dailyBiasProjection.js`
- Pattern: Weighted factor calculation with configurable weights

## Entry Points

**Frontend Entry:**
- Location: `src/main.jsx`
- Triggers: Browser loads index.html
- Responsibilities: Render React app, set up routing

**App Orchestrator:**
- Location: `src/App.jsx`
- Triggers: React render
- Responsibilities: Initialize state, start polling, coordinate hooks

**Backend Entry:**
- Location: `server/server.js`
- Triggers: `node server.js` or Docker container start
- Responsibilities: Set up Express, start collectors, serve API

## Error Handling

**Strategy:** Try/catch with console.error logging, graceful UI fallbacks

**Patterns:**
- Frontend: try/catch in async operations, default values on fetch failure
- Backend: try/catch per API call, continue on partial failures
- No global error boundary configured

## Cross-Cutting Concerns

**Logging:**
- Console.log/console.error throughout
- No structured logging framework

**Validation:**
- Manual validation in components and backend
- No schema validation library (Zod, Yup)

**Data Freshness:**
- Backend data timestamps tracked
- Frontend displays "X min ago" freshness indicators
- Stale data pruned on load

**Theme Support:**
- Light/dark mode via `ThemeToggle.jsx`
- CSS variables for theme colors

---

*Architecture analysis: 2026-01-12*
*Update when major patterns change*
