/**
 * Performance Analyzer
 *
 * Identifies performance bottlenecks and optimization opportunities
 * Focuses on page load speed, API efficiency, and rendering performance
 */

export class PerformanceAnalyzer {
    constructor() {
        this.metrics = {};
        this.thresholds = this.defineThresholds();
    }

    /**
     * Define performance thresholds
     */
    defineThresholds() {
        return {
            apiResponseTime: {
                good: 500,      // < 500ms
                acceptable: 1000, // < 1s
                poor: 2000      // > 2s
            },
            renderTime: {
                good: 100,
                acceptable: 300,
                poor: 1000
            },
            bundleSize: {
                good: 500000,     // 500KB
                acceptable: 1000000, // 1MB
                poor: 2000000     // 2MB
            },
            memoryUsage: {
                good: 50000000,   // 50MB
                acceptable: 100000000, // 100MB
                poor: 200000000   // 200MB
            }
        };
    }

    /**
     * Analyze performance
     */
    async analyze() {
        const issues = [];

        issues.push(...this.analyzeAPIPerformance());
        issues.push(...this.analyzeRenderPerformance());
        issues.push(...this.analyzeMemoryUsage());
        issues.push(...this.analyzeBundleSize());
        issues.push(...this.analyzeDataEfficiency());

        return issues;
    }

    /**
     * Analyze API call performance
     */
    analyzeAPIPerformance() {
        const issues = [];

        issues.push({
            priority: 'high',
            title: 'Too Many Simultaneous API Calls',
            description: 'App makes 10+ API calls on initial load. Each coin (BTC/ETH/SOL) fetches price, OI, funding, CVD, orderbook separately.',
            metric: '10+ sequential API calls = slow initial load',
            optimization: 'Batch API calls or use a single endpoint that returns all data for a coin. Consider GraphQL or custom aggregate endpoint.'
        });

        issues.push({
            priority: 'medium',
            title: 'No API Response Caching',
            description: 'Every refresh fetches all data again, even if unchanged',
            metric: 'Unnecessary bandwidth and API rate limit usage',
            optimization: 'Implement short-term cache (5-10s) for relatively static data like funding rates'
        });

        issues.push({
            priority: 'medium',
            title: 'Leaderboard Fetched Too Frequently',
            description: 'Whale leaderboard updates every 30s but changes rarely',
            metric: 'Top 200 trader data refetched 120 times/hour',
            optimization: 'Increase polling interval to 60-120s for leaderboard data'
        });

        issues.push({
            priority: 'low',
            title: 'No Request Debouncing',
            description: 'Rapid timeframe changes trigger multiple API calls',
            metric: 'User clicking through timeframes causes API spam',
            optimization: 'Debounce user inputs by 300-500ms before triggering API calls'
        });

        issues.push({
            priority: 'medium',
            title: 'WebSocket Reconnection Storms',
            description: 'When connection drops, all 10 WebSockets retry simultaneously',
            metric: 'Network congestion during reconnection',
            optimization: 'Stagger reconnection attempts with exponential backoff per exchange'
        });

        return issues;
    }

    /**
     * Analyze rendering performance
     */
    analyzeRenderPerformance() {
        const issues = [];

        issues.push({
            priority: 'high',
            title: 'Sparkline Charts Re-render On Every Data Update',
            description: 'All 15+ sparklines (5 per coin × 3 coins) redraw when any data changes',
            metric: 'Expensive canvas operations every 2-3 seconds',
            optimization: 'Use React.memo() on Sparkline component, only re-render when that specific dataset changes'
        });

        issues.push({
            priority: 'high',
            title: 'Whale Trade Feed Causes Layout Shifts',
            description: 'New trades push entire feed down, causing reflow',
            metric: 'CLS (Cumulative Layout Shift) impact',
            optimization: 'Use fixed-height container with virtual scrolling or limit visible trades to 20'
        });

        issues.push({
            priority: 'medium',
            title: 'No Component Memoization',
            description: 'BiasCard and other components re-render even when props unchanged',
            metric: 'Unnecessary re-renders on every state update',
            optimization: 'Wrap components with React.memo(), use useMemo() for expensive calculations'
        });

        issues.push({
            priority: 'medium',
            title: 'Large Arrays Processed On Every Render',
            description: 'Historical data arrays (30+ entries per metric) processed without memoization',
            metric: 'Repeated array operations that could be cached',
            optimization: 'Use useMemo() for array transformations and calculations'
        });

        issues.push({
            priority: 'low',
            title: 'DetailModal Mounts/Unmounts Entire Component',
            description: 'Opening modal causes full component mount, closing causes unmount',
            metric: 'DOM thrashing on open/close',
            optimization: 'Keep modal in DOM and toggle visibility with CSS instead of conditional rendering'
        });

        return issues;
    }

    /**
     * Analyze memory usage
     */
    analyzeMemoryUsage() {
        const issues = [];

        issues.push({
            priority: 'high',
            title: 'WebSocket Messages Not Garbage Collected',
            description: 'Whale trade array grows indefinitely unless manually pruned',
            metric: 'Memory leak potential over long sessions',
            optimization: 'Implement automatic cleanup: keep only last 100 trades, or trades from last 10 minutes'
        });

        issues.push({
            priority: 'medium',
            title: 'Historical Data localStorage Growing Unbounded',
            description: 'OI, price, orderbook history stored for 30 minutes can grow large',
            metric: 'localStorage can hit 5-10MB quota',
            optimization: 'Implement data rotation: keep only last 100 entries per metric, not time-based'
        });

        issues.push({
            priority: 'medium',
            title: 'Interval/Timeout Cleanup Missing',
            description: 'WebSocket ping intervals might not clear on component unmount',
            metric: 'Timers running after component unmounts = memory leak',
            optimization: 'Ensure all intervals cleared in useEffect cleanup functions'
        });

        issues.push({
            priority: 'low',
            title: 'Large Objects Passed As Props',
            description: 'Entire trader arrays passed to child components instead of specific data',
            metric: 'Unnecessary data copying between components',
            optimization: 'Pass only required fields to child components'
        });

        return issues;
    }

    /**
     * Analyze bundle size
     */
    analyzeBundleSize() {
        const issues = [];

        issues.push({
            priority: 'medium',
            title: 'No Code Splitting',
            description: 'All components loaded upfront even if not immediately needed',
            metric: 'Initial bundle includes Detail Modal, rarely-used components',
            optimization: 'Use React.lazy() for modals, less-used sections. Load on demand.'
        });

        issues.push({
            priority: 'low',
            title: 'Potential Duplicate Dependencies',
            description: 'Multiple WebSocket libraries or duplicate utilities',
            metric: 'Bundle bloat from redundant code',
            optimization: 'Audit package.json for duplicates, use single WebSocket implementation'
        });

        issues.push({
            priority: 'low',
            title: 'No Tree Shaking Verification',
            description: 'Unused Tailwind classes and utility functions might be bundled',
            metric: 'Dead code in production bundle',
            optimization: 'Use bundle analyzer to identify unused code, configure Tailwind purge correctly'
        });

        return issues;
    }

    /**
     * Analyze data efficiency
     */
    analyzeDataEfficiency() {
        const issues = [];

        issues.push({
            priority: 'high',
            title: 'Calculating Same Biases Multiple Times',
            description: 'Composite bias recalculated on every render instead of only when data changes',
            metric: 'CPU cycles wasted on redundant calculations',
            optimization: 'Memoize bias calculations with useMemo() keyed to relevant data'
        });

        issues.push({
            priority: 'medium',
            title: 'Inefficient Orderbook Imbalance Calculation',
            description: 'Rolling average recalculated from scratch each time',
            metric: 'O(n) array reduction on every update',
            optimization: 'Maintain running sum, update incrementally instead of full recalculation'
        });

        issues.push({
            priority: 'medium',
            title: 'Sparkline Data Not Downsampled',
            description: 'Storing and rendering all data points even though chart only shows 30',
            metric: 'Extra memory and render time for invisible data',
            optimization: 'Downsample to exactly the number of pixels/points displayed'
        });

        issues.push({
            priority: 'low',
            title: 'JSON Parse/Stringify On Every localStorage Operation',
            description: 'Historical data serialized/deserialized frequently',
            metric: 'CPU overhead from repeated JSON operations',
            optimization: 'Keep parsed data in memory, only serialize on window unload'
        });

        return issues;
    }

    /**
     * Get current performance metrics
     */
    getCurrentMetrics() {
        const metrics = {};

        // Try to get performance data if available
        if (window.performance) {
            const navigation = performance.getEntriesByType('navigation')[0];
            if (navigation) {
                metrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
                metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;
            }

            // Memory usage (Chrome only)
            if (performance.memory) {
                metrics.memoryUsed = performance.memory.usedJSHeapSize;
                metrics.memoryLimit = performance.memory.jsHeapSizeLimit;
            }
        }

        return metrics;
    }
}
