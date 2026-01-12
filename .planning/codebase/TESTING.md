# Testing Patterns

**Analysis Date:** 2026-01-12

## Test Framework

**Runner:**
- Not configured

**Assertion Library:**
- Not configured

**Run Commands:**
```bash
# No test commands available
# Linting only: npm run lint
```

## Test File Organization

**Location:**
- No test files exist

**Naming:**
- No convention established

**Structure:**
```
# No test directory structure
# Tests not implemented
```

## Test Structure

**Suite Organization:**
- Not applicable (no tests)

**Patterns:**
- Not applicable (no tests)

## Mocking

**Framework:**
- Not applicable (no tests)

**Patterns:**
- Not applicable (no tests)

## Fixtures and Factories

**Test Data:**
- Not applicable (no tests)

**Location:**
- Not applicable (no tests)

## Coverage

**Requirements:**
- No coverage requirements defined
- No coverage tooling configured

**Configuration:**
- Not applicable

## Test Types

**Unit Tests:**
- Not implemented

**Integration Tests:**
- Not implemented

**E2E Tests:**
- Not implemented
- Manual testing via browser

## Current Verification Approach

**Manual Testing:**
- Run `npm run dev` for frontend
- Test WebSocket connections via browser DevTools
- Verify API responses in Network tab
- Check console for errors

**Backend Testing:**
- `server/test_coinbase_ws.js` - Manual WebSocket test script
- `server/test_crypto_ws.js` - Manual WebSocket test script
- Run individually with `node server/test_*.js`

## Recommendations for Future Testing

**Suggested Framework:**
- Vitest (fast, Vite-native, compatible with React Testing Library)

**Priority Areas for Tests:**
1. `src/utils/biasCalculations.js` - Core bias calculation logic
2. `src/utils/flowSignals.js` - Signal detection functions
3. `server/biasProjection.js` - Backend projection algorithm
4. `server/dailyBiasProjection.js` - Daily bias algorithm

**Setup Command (if implementing):**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**Example Test Structure (if implementing):**
```javascript
// src/utils/biasCalculations.test.js
import { describe, it, expect } from 'vitest';
import { calculateCompositeBias } from './biasCalculations';

describe('biasCalculations', () => {
  describe('calculateCompositeBias', () => {
    it('should return bullish bias when all signals align', () => {
      const input = { /* test data */ };
      const result = calculateCompositeBias(input);
      expect(result.direction).toBe('BULLISH');
    });
  });
});
```

---

*Testing analysis: 2026-01-12*
*Update when test infrastructure is added*
