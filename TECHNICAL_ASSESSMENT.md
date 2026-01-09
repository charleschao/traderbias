# Technical Assessment: traderbias.app

*Generated: January 8, 2026*

---

## 1. Highest Risk of Errors/Regressions

From recent development sessions:

- **The `calculateCompositeBias` function** — We've been adjusting weights dynamically based on exchange (whale data availability). Any future changes to bias calculation could easily break the weighting logic silently.
- **localStorage persistence** — We debugged a race condition with CVD data being overwritten. Race conditions in state persistence are notoriously hard to catch in manual testing.
- **Exchange-specific conditionals** — Scattered `if (exchange === 'hyperliquid')` checks throughout UI and logic. These are fragile and easy to miss when adding new features.

---

## 2. Where to Simplify First

Start with **consolidating exchange-specific logic** into a single configuration-driven approach:

```javascript
const EXCHANGE_CONFIG = {
  hyperliquid: { hasWhaleData: true, hasFlowData: true, ... },
  binance: { hasWhaleData: false, hasFlowData: true, ... }
}
```

**Why:** Right now, feature flags are implicit in conditional checks scattered across components. A central config makes behavior predictable and testable.

---

## 3. Problems Not Visible Yet (But Coming)

| Area | Latent Issue |
|------|-------------|
| **Timeframe data accumulation** | localStorage will hit size limits as historical data grows |
| **WebSocket connections** | Multiple concurrent connections without proper cleanup = memory leaks on long sessions |
| **Component state coupling** | Parent-child prop drilling creates cascading re-renders as data volume increases |
| **Multiple exchange support** | Each new exchange will multiply the conditional complexity exponentially |

---

## 4. Technical Decisions Limiting Scalability/Maintainability

- **localStorage for time-series data** — Works for MVP, but doesn't scale. Eventually needs a proper data layer (IndexedDB or server-side persistence).
- **Synchronous state updates across components** — Race conditions we've seen are symptoms of this.
- **No data validation layer** — API responses are trusted directly. One malformed response could cascade errors.
- **Hardcoded exchange logic** — Adding a third exchange would require touching many files.

---

## 5. What to Isolate/Document/Test First

**Priority order:**

1. **`calculateCompositeBias`** — This is the core logic. Unit tests here would catch regressions fast.
2. **Data persistence layer** — Abstract localStorage operations into a service with clear contracts.
3. **Exchange configuration** — Single source of truth for what each exchange supports.
4. **WebSocket connection management** — Document reconnection logic, cleanup, and error handling.

---

## 6. Where Behavior Can Diverge from Intent

- **Bias score edge cases** — What happens when all data sources return null? Does the UI show 0, "N/A", or crash?
- **Race conditions in data loading** — User toggles timeframe before data loads → stale data displayed with wrong label.
- **Tooltip/expanded view sync** — We've adjusted visibility conditions separately; they can fall out of sync.
- **"Collecting data" state** — The Flow Confluence issue we debugged — it's unclear when "collecting" should transition to "ready."

---

## 7. Patterns to Reduce Complexity

| Pattern | Benefit |
|---------|---------|
| **Feature flags/config objects** | Replace scattered conditionals |
| **Custom hooks for data fetching** | Encapsulate loading/error/success states |
| **Event-driven state updates** | Decouple components, prevent race conditions |
| **Presenter/Container separation** | Logic vs. display clearly separated |
| **TypeScript interfaces** | Self-documenting data shapes, catch errors at compile time |

---

## 8. Handoff Pain Points

If someone took over tomorrow:

1. **No clear data flow diagram** — Where does data come from? How does it flow through components?
2. **Exchange-specific quirks are tribal knowledge** — "Hyperliquid has whale data, others don't" isn't documented
3. **Implicit dependencies** — The order of state updates matters but isn't obvious
4. **No test suite** — Every change requires manual verification
5. **Deploy scripts exist but may have env-specific assumptions**

---

## 9. Best Impact-to-Effort Ratio (Quick Wins)

| Improvement | Effort | Impact |
|-------------|--------|--------|
| Create `EXCHANGE_CONFIG` object | 1-2 hours | Eliminates scattered conditionals |
| Add null/error guards to bias calculation | 30 min | Prevents silent failures |
| Document the data flow in README | 1 hour | Massive handoff improvement |
| Abstract localStorage into a service | 2-3 hours | Fixes race conditions, enables future migration |
| Add 5-10 unit tests for core calculations | 2-3 hours | Confidence for future changes |

---

## 10. What Prevents "Production-Robust"?

The honest gaps:

- ❌ **No automated tests** — Manual testing only
- ❌ **No error boundaries** — One component crash takes down the page
- ❌ **No logging/monitoring** — Silent failures in production
- ❌ **No input validation** — Trusting API responses blindly
- ❌ **No graceful degradation** — If whale data fails, does the UI handle it?
- ❌ **Race conditions in state management** — We've patched specific cases, but the architecture allows them

---

## Summary: Top 3 Priority Actions

If prioritizing:

1. **Create an exchange configuration system** — Biggest bang for complexity reduction
2. **Abstract data persistence** — Fixes race conditions and prepares for scale
3. **Add tests for `calculateCompositeBias`** — Protects the core value proposition
