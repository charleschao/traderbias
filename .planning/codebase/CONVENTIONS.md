# Coding Conventions

**Analysis Date:** 2026-01-12

## Naming Patterns

**Files:**
- PascalCase.jsx for React components (`BiasCard.jsx`, `FlowConfluenceSection.jsx`)
- camelCase.js for utilities, hooks, services (`biasCalculations.js`, `useWhaleWebSockets.js`)
- *.test.* pattern not used (no tests)

**Functions:**
- camelCase for all functions (`calculateCompositeBias`, `fetchMarketData`)
- No special prefix for async functions
- handle* for event handlers (`handleClick`, `handleTimeframeChange`)

**Variables:**
- camelCase for variables (`currentPrice`, `oiChangePercent`)
- UPPER_SNAKE_CASE for constants (`DEFAULT_EXCHANGE`, `COINS`)
- No underscore prefix for private members

**Types:**
- No TypeScript (JavaScript ES6+ only)
- JSDoc comments used sparingly for complex functions

## Code Style

**Formatting:**
- 2-space indentation (enforced in CLAUDE.md)
- No explicit Prettier config (use editor defaults)
- Single quotes for strings in JSX, double quotes in regular JS vary
- Semicolons not strictly enforced (mixed usage)

**Linting:**
- ESLint 9.x with flat config (`eslint.config.js`)
- Extends: `js.configs.recommended`, `reactHooks.configs.flat.recommended`
- Custom rule: `no-unused-vars` with varsIgnorePattern for uppercase
- Run: `npm run lint`

## Import Organization

**Order (observed pattern):**
1. React imports (`import { useState, useEffect } from 'react'`)
2. External packages (`import { ArrowUp } from 'lucide-react'`)
3. Internal components (`import BiasCard from './components/BiasCard'`)
4. Internal utilities (`import { calculateCompositeBias } from './utils/biasCalculations'`)
5. Styles (if any) (`import './App.css'`)

**Grouping:**
- No strict blank line separation between groups
- No automatic sorting

**Path Aliases:**
- None configured (use relative paths)

## Error Handling

**Patterns:**
- try/catch around async operations
- Console.error for logging errors
- Graceful fallbacks in UI (default values on fetch failure)

**Error Types:**
- No custom error classes
- Throw standard Error objects
- No Result<T, E> pattern

**Example pattern:**
```javascript
try {
  const data = await fetch(url);
  // process data
} catch (error) {
  console.error('Failed to fetch:', error);
  // return default or continue without data
}
```

## Logging

**Framework:**
- Console.log for normal output
- Console.error for errors
- No structured logging library

**Patterns:**
- Log API failures with context
- Log WebSocket connection state changes
- Avoid verbose logging in production (but no build-time removal)

## Comments

**When to Comment:**
- Explain complex bias calculations
- Document algorithm weights and factors
- Explain "why" for non-obvious logic

**JSDoc:**
- Used sparingly for complex utility functions
- Not required for components

**TODO Comments:**
- Format: `// TODO:` followed by description
- Not linked to issue tracker

## Function Design

**Size:**
- No strict limit, but prefer smaller focused functions
- App.jsx is notably large (~2,008 lines) - historical pattern

**Parameters:**
- Destructure objects in function body or signature
- No max parameter count enforced

**Return Values:**
- Return objects for multiple values
- Early returns for guard clauses preferred

## Module Design

**Exports:**
- Default exports for React components
- Named exports for utilities
- One component per file

**Barrel Files:**
- Not used (import from specific files)

## React Patterns

**Component Structure:**
```javascript
import { useState, useEffect } from 'react';
import { Icon } from 'lucide-react';

export default function ComponentName({ prop1, prop2, onAction }) {
  const [state, setState] = useState(initialValue);

  useEffect(() => {
    // side effects
  }, [dependencies]);

  const handleAction = () => {
    // handler logic
    onAction?.(result);
  };

  return (
    <div className="tailwind-classes">
      {/* JSX content */}
    </div>
  );
}
```

**State Management:**
- useState for local state
- useRef for mutable data that shouldn't trigger re-renders
- No external state library (Redux, Zustand, etc.)

**Props:**
- Destructure in function signature
- Use optional chaining for callbacks (`onAction?.()`)

## CSS/Styling

**Approach:**
- Tailwind CSS 4.x utility classes
- Inline in JSX (`className="..."`)
- Component-scoped styles rare

**Color Theme:**
- CSS variables for theme support
- Light/dark mode via class toggle

---

*Convention analysis: 2026-01-12*
*Update when patterns change*
