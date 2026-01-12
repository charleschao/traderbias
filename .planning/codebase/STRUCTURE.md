# Codebase Structure

**Analysis Date:** 2026-01-12

## Directory Layout

```
traderbias.app/
├── src/                    # Frontend source code
│   ├── components/         # React UI components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API clients
│   ├── utils/              # Pure utility functions
│   ├── config/             # Exchange configs, WebSocket configs
│   ├── agents/             # Development-only platform analysis (DEV)
│   ├── assets/             # Static assets (images, fonts)
│   ├── App.jsx             # Main application orchestrator
│   ├── App.css             # App-level styles
│   ├── main.jsx            # React entry point
│   └── index.css           # Global styles
├── server/                 # Backend Node.js server
│   ├── data/               # JSON persistence (gitignored)
│   ├── scripts/            # Utility scripts
│   ├── server.js           # Express server entry
│   ├── dataCollector.js    # Exchange data polling
│   ├── dataStore.js        # In-memory data storage
│   ├── biasProjection.js   # 8-12H projection algorithm
│   ├── dailyBiasProjection.js  # 24H projection algorithm
│   ├── whaleWatcher.js     # Whale trade tracking
│   ├── winRateTracker.js   # Prediction accuracy tracking
│   └── *.js                # Other collectors and utilities
├── docs/                   # Project documentation
├── public/                 # Static public files
├── dist/                   # Build output (gitignored)
├── node_modules/           # Frontend dependencies (gitignored)
├── .planning/              # GSD planning files
└── [config files]          # Root config files
```

## Directory Purposes

**src/**
- Purpose: All frontend React application code
- Contains: JSX components, hooks, utilities, config
- Key files: `App.jsx` (main orchestrator), `main.jsx` (entry)
- Subdirectories: components, hooks, services, utils, config, agents

**src/components/**
- Purpose: Presentational React components
- Contains: One component per .jsx file
- Key files: `BiasCard.jsx`, `FlowConfluenceSection.jsx`, `MegaWhaleFeed.jsx`, `BiasProjection.jsx`, `DailyBiasTab.jsx`
- Subdirectories: None (flat structure)

**src/hooks/**
- Purpose: Custom React hooks for stateful logic
- Contains: WebSocket management, data history tracking
- Key files: `useWhaleWebSockets.js`, `useSparklineHistory.js`, `useSignalHistory.js`, `useWhaleNotifications.js`

**src/services/**
- Purpose: API communication layer
- Contains: `backendApi.js` - centralized backend API client
- Key files: `backendApi.js`

**src/utils/**
- Purpose: Pure utility functions for calculations
- Contains: Bias calculations, flow signals, formatters
- Key files: `biasCalculations.js`, `flowSignals.js`, `formatters.js`

**src/config/**
- Purpose: Configuration objects
- Contains: Exchange definitions, WebSocket configs
- Key files: `exchanges.js`, `whaleWsConfig.js`

**server/**
- Purpose: Express.js backend for data aggregation
- Contains: Server, collectors, projection algorithms
- Key files: `server.js` (entry), `biasProjection.js`, `dataCollector.js`, `dataStore.js`
- Subdirectories: `data/` (persistence), `scripts/` (utilities)

**docs/**
- Purpose: Project documentation
- Contains: Architecture docs, API reference, deployment guides
- Key files: `ARCHITECTURE.md`, `BACKEND_ARCHITECTURE_REVIEW.md`, `BACKEND_API_REFERENCE.md`

## Key File Locations

**Entry Points:**
- `src/main.jsx` - React application entry
- `src/App.jsx` - Main application orchestrator (~2,008 lines)
- `server/server.js` - Backend Express server entry

**Configuration:**
- `package.json` - Frontend dependencies and scripts
- `server/package.json` - Backend dependencies and scripts
- `vite.config.js` - Vite build config with dev proxies
- `eslint.config.js` - ESLint flat config
- `.env.example` - Frontend environment template
- `server/.env.example` - Backend environment template
- `server/docker-compose.yml` - Docker deployment config

**Core Logic:**
- `src/utils/biasCalculations.js` - Composite bias calculation (frontend)
- `src/utils/flowSignals.js` - CVD divergence, absorption detection
- `server/biasProjection.js` - 8-12H projection algorithm
- `server/dailyBiasProjection.js` - 24H daily bias algorithm
- `server/dataCollector.js` - Exchange API polling
- `server/dataStore.js` - In-memory data management

**Testing:**
- No test files configured

**Documentation:**
- `README.md` - Project overview
- `CLAUDE.md` - AI assistant instructions
- `docs/ARCHITECTURE.md` - System architecture
- `docs/BACKEND_ARCHITECTURE_REVIEW.md` - Backend design review

## Naming Conventions

**Files:**
- PascalCase.jsx: React components (`BiasCard.jsx`, `FlowConfluenceSection.jsx`)
- camelCase.js: Utilities, hooks, configs (`biasCalculations.js`, `useWhaleWebSockets.js`)
- UPPERCASE.md: Important project files (`README.md`, `CLAUDE.md`, `CHANGELOG.md`)

**Directories:**
- lowercase: All directories (`components`, `hooks`, `utils`)
- Plural for collections: `components`, `hooks`, `utils`, `services`

**Special Patterns:**
- `use*.js`: Custom hooks (`useWhaleWebSockets.js`)
- `*Collector.js`: Backend data collectors (`dataCollector.js`, `etfFlowCollector.js`)
- `*.old.jsx`: Legacy backups (e.g., `App.old.jsx` - do not modify)

## Where to Add New Code

**New Component:**
- Implementation: `src/components/{ComponentName}.jsx`
- Import in: `src/App.jsx` or parent component
- Style: Use Tailwind classes inline

**New Custom Hook:**
- Implementation: `src/hooks/use{HookName}.js`
- Import in: `src/App.jsx`

**New Utility Function:**
- Implementation: `src/utils/{domain}.js` (add to existing file or create new)
- Import in: Components or App.jsx as needed

**New API Endpoint (Backend):**
- Route: Add to `server/server.js`
- Logic: Create collector in `server/{name}Collector.js` or add to existing

**New Exchange:**
- Config: Add to `src/config/exchanges.js`
- WebSocket: Add parser to `src/config/whaleWsConfig.js`
- Backend: Update `server/dataCollector.js`

**New Projection Algorithm:**
- Implementation: `server/{name}Projection.js`
- Endpoint: Register in `server/server.js`

## Special Directories

**dist/**
- Purpose: Production build output
- Source: Generated by `npm run build`
- Committed: No (gitignored)

**server/data/**
- Purpose: JSON file persistence for backend
- Source: Runtime-generated (`historical-data.json`, `predictions.json`, etc.)
- Committed: No (gitignored)

**src/agents/**
- Purpose: Development-only platform analysis tools
- Source: `PlatformImprovementAgent.js` and analysis modules
- Committed: Yes, but excluded from production builds

**node_modules/**
- Purpose: npm dependencies (frontend and backend have separate)
- Committed: No (gitignored)

---

*Structure analysis: 2026-01-12*
*Update when directory structure changes*
