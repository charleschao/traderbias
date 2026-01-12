# Technology Stack

**Analysis Date:** 2026-01-12

## Languages

**Primary:**
- JavaScript (ES6+) - All application code (frontend and backend)

**Secondary:**
- JSX - React component syntax
- CSS - Styling via Tailwind CSS 4.x

## Runtime

**Environment:**
- Node.js 18+ (specified in `server/package.json` engines field)
- Browser runtime for frontend (React SPA)

**Package Manager:**
- npm
- Lockfiles: `package-lock.json` (frontend), `server/package-lock.json` (backend)

## Frameworks

**Core:**
- React 19.2 - UI framework (`package.json`)
- Express 4.18 - Backend HTTP server (`server/package.json`)
- WebSocket (ws 8.14) - Real-time data feeds (`server/package.json`)

**Testing:**
- Not configured (no test framework detected)

**Build/Dev:**
- Rolldown-Vite 7.2.5 - Build tool (aliased as `vite` in `package.json`)
- Tailwind CSS 4.1.18 via `@tailwindcss/vite` plugin (`vite.config.js`)
- ESLint 9.39 - Linting (`eslint.config.js`)
- Nodemon 3.0 - Backend development hot-reload (`server/package.json`)

## Key Dependencies

**Critical (Frontend):**
- lucide-react 0.562 - Icon library
- react-router-dom 7.12 - Client-side routing

**Critical (Backend):**
- axios 1.6 - HTTP client for API calls
- cheerio 1.0 - HTML parsing (ETF flow scraping)
- cors 2.8 - CORS middleware
- node-fetch 2.7 - Node.js fetch polyfill

**Infrastructure:**
- Docker + Gluetun VPN - Production deployment with geo-bypass (`server/docker-compose.yml`)
- PM2 - Process manager (`server/ecosystem.config.js`)

## Configuration

**Environment:**
- `.env` files for both frontend and backend (gitignored)
- `.env.example` - Frontend: `VITE_BACKEND_API_URL`, `VITE_USE_BACKEND`
- `server/.env.example` - Backend: API keys, VPN credentials
- Frontend uses `import.meta.env.VITE_*` pattern

**Build:**
- `vite.config.js` - Build config with proxy for Binance/Bybit
- `eslint.config.js` - ESLint flat config

## Platform Requirements

**Development:**
- Any platform with Node.js 18+
- No Docker required (optional for backend)

**Production:**
- Frontend: Static hosting (Vercel, Netlify, GitHub Pages)
- Backend: VPS with Docker (Gluetun VPN for Binance/Bybit access)
- Singapore VPN node for geo-restricted APIs

---

*Stack analysis: 2026-01-12*
*Update after major dependency changes*
